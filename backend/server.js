const dotenv = require('dotenv');
// Load env before models (USE_FIRESTORE must be set at require-time)
dotenv.config({ path: process.env.ENV_PATH || '.env' });

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');
const { connectDataStore, useFirestore } = require('./config/dataStore');
const logger = require('./utils/logger');
const auth = require('./middleware/auth');
// const { startRecordingSync } = require('./jobs/syncRecordings');
const videoProcessor = require('./middleware/videoProcessor');
const { apiCacheHeaders, staticAssetCache, developmentCacheBust } = require('./middleware/cacheHeaders');

// Handle unhandled promise rejections
process.on('unhandledRejection', (reason, promise) => {
  logger.error('Unhandled Rejection at:', { promise, reason: reason.message || reason });
  // Don't exit the process, just log the error
});

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', { error: error.message, stack: error.stack });
  // Exit gracefully in production, continue in development
  if (process.env.NODE_ENV === 'production') {
    process.exit(1);
  }
});

const app = express();
const isProduction = process.env.NODE_ENV === 'production';

// Trust proxy (Nginx, etc.) so rate limit and X-Forwarded-Proto work correctly
app.set('trust proxy', 1);

// Security headers
app.use(helmet({
  contentSecurityPolicy: false, // API returns JSON; CSP is for HTML
  crossOriginResourcePolicy: { policy: 'cross-origin' }
}));

// HTTPS redirect in production when behind a proxy that sets X-Forwarded-Proto
if (isProduction) {
  app.use((req, res, next) => {
    const proto = req.get('x-forwarded-proto');
    if (proto === 'http') {
      const host = req.get('host') || req.hostname;
      return res.redirect(301, `https://${host}${req.originalUrl}`);
    }
    next();
  });
}

// CORS Configuration for Production
const allowedOrigins = process.env.ALLOWED_ORIGINS
  ? process.env.ALLOWED_ORIGINS.split(',').map((o) => o.trim()).filter(Boolean)
  : ['http://localhost:3000'];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true); // Allow no-origin (e.g. Postman, mobile)
    if (allowedOrigins.indexOf(origin) !== -1) {
      return callback(null, true);
    }
    if (isProduction) {
      return callback(null, false);
    }
    callback(null, true); // Allow all in development
  },
  credentials: true
}));

app.use(express.json());

// Enhanced API cache headers with context-aware caching
app.use('/api', apiCacheHeaders);

// Rate limit auth endpoints (login/register) to reduce brute-force risk
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '50', 10),
  message: { message: 'Too many attempts; please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth', authLimiter);

// Serve uploaded files only for authenticated users (token header or ?token=)
app.use('/uploads', auth, developmentCacheBust, staticAssetCache, express.static(path.join(__dirname, 'uploads'), {
  etag: true,
  lastModified: true,
  setHeaders: (res, filePath) => {
    // Additional headers can be set here if needed
  }
}));

// Routes
app.use('/api/auth', require('./routes/auth'));
app.use('/api/courses', require('./routes/courses'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/content', require('./routes/content'));
app.use('/api/zoom', require('./routes/zoom'));
app.use('/api/classroom', require('./routes/classroom'));

// Apply video processor middleware for automatic URL/passcode extraction - COMMENTED OUT
// This must come BEFORE the admin routes
// app.use('/api/admin', videoProcessor);
app.use('/api/admin', require('./routes/admin'));
app.use('/api/video', require('./routes/video'));
app.use('/api/teacher', require('./routes/teacher'));
app.use('/api/batches', require('./routes/batches'));
app.use('/api/one-to-one-batches', require('./routes/oneToOneBatches'));
app.use('/api/student', require('./routes/student'));
app.use('/api/activity', require('./routes/activity'));
app.use('/api/resources', require('./routes/resources'));
app.use('/api/assessment-studio', require('./routes/assessmentStudio'));
app.use('/api/classroom-interaction', require('./routes/classroomInteraction'));
app.use('/api/chat', require('./routes/chat'));
app.use('/api/meetings', require('./routes/meetings'));
app.use('/api/certificates', require('./routes/certificates'));

// OAuth redirect landing (Google Meet / Calendar setup). Shows the auth code to paste into setup-meet-oauth.js
app.get('/auth/google/callback', (req, res) => {
  const code = req.query.code ? String(req.query.code) : '';
  const error = req.query.error ? String(req.query.error) : '';
  if (error) {
    return res.status(400).type('html').send(
      `<!doctype html><meta charset="utf-8"><title>Meet OAuth</title>
       <h1>Google OAuth error</h1><pre>${error}</pre>
       <p>${req.query.error_description || ''}</p>`
    );
  }
  if (!code) {
    return res.status(400).type('html').send(
      '<!doctype html><meta charset="utf-8"><title>Meet OAuth</title><h1>No code in URL</h1><p>Retry the setup script auth link.</p>'
    );
  }
  res.type('html').send(`<!doctype html><meta charset="utf-8"><title>Meet OAuth</title>
    <h1>Google authorization OK</h1>
    <p>Copy this code and paste it into the terminal running <code>setup-meet-oauth.js</code>:</p>
    <textarea id="c" style="width:100%;height:120px;font-size:14px">${code.replace(/</g, '&lt;')}</textarea>
    <p><button onclick="navigator.clipboard.writeText(document.getElementById('c').value)">Copy code</button></p>
    <p style="color:#666">You can close this tab after pasting.</p>`);
});

// Fallback endpoint for direct file access (authenticated)
app.get('/api/uploads/notes/:filename', auth, (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, 'uploads', 'notes', filename);
    
    // Security check - prevent directory traversal
    const normalizedPath = path.normalize(filePath);
    const uploadsDir = path.normalize(path.join(__dirname, 'uploads', 'notes'));
    if (!normalizedPath.startsWith(uploadsDir)) {
      return res.status(403).json({ message: 'Access denied' });
    }
    
    // Check if file exists
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ message: 'File not found' });
    }
    
    // Set headers for file download
    res.setHeader('Content-Type', 'application/octet-stream');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Access-Control-Allow-Origin', '*');
    
    // Stream file to response
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
  } catch (error) {
    console.error('Error serving file:', error);
    res.status(500).json({ message: 'Failed to serve file' });
  }
});

// Health check & API root
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', uptime: process.uptime() });
});

app.get('/api', (req, res) => {
  res.json({ message: 'SHEF LMS API is running', status: 'ok' });
});

// Test route
app.get('/', (req, res) => {
  res.json({ message: 'Welcome to SHEF LMS API' });
});

// Error handling middleware (must be after routes)
app.use((error, req, res, next) => {
  logger.error('Error middleware caught', {
    error: error.message,
    url: req.url,
    method: req.method
  });

  if (error.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({
      message: 'File too large. Maximum size is 10MB.',
      code: 'LIMIT_FILE_SIZE'
    });
  }

  if (error.code === 'LIMIT_FILE_COUNT') {
    return res.status(400).json({
      message: 'Too many files uploaded.',
      code: 'LIMIT_FILE_COUNT'
    });
  }

  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return res.status(400).json({
      message: 'Unexpected file field.',
      code: 'LIMIT_UNEXPECTED_FILE'
    });
  }

  if (error.message && error.message.includes('File type')) {
    return res.status(415).json({
      message: error.message,
      code: 'INVALID_FILE_TYPE'
    });
  }

  res.status(error.status || 500).json({
    message: error.message || 'Internal server error',
    code: error.code || 'INTERNAL_ERROR'
  });
});

const PORT = process.env.PORT || 5000;

// Connect data store (Mongo by default; Firestore when USE_FIRESTORE=true on DEV)
connectDataStore()
  .then((store) => {
    app.listen(PORT, () => {
      logger.info('Server running', {
        port: PORT,
        env: process.env.NODE_ENV || 'development',
        dataStore: store?.type || (useFirestore() ? 'firestore' : 'mongo')
      });
      try {
        const { startMeetReminderJob } = require('./jobs/meetReminders');
        startMeetReminderJob();
      } catch (err) {
        logger.error('Failed to start Meet reminder job', { error: err.message });
      }
      try {
        const { startAttendanceAlertJob } = require('./jobs/attendanceAlerts');
        startAttendanceAlertJob();
      } catch (err) {
        logger.error('Failed to start attendance alert job', { error: err.message });
      }
    });
  })
  .catch((err) => {
    logger.error('Failed to start server due to data store error', { error: err.message });
    process.exit(1);
  });
