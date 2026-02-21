const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const path = require('path');
const { connectMongo } = require('./config/mongo');
const logger = require('./utils/logger');
// const { startRecordingSync } = require('./jobs/syncRecordings');
const videoProcessor = require('./middleware/videoProcessor');

dotenv.config();

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

// Prevent API response caching - ensures fresh data for users
app.use('/api', (req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});

// Rate limit auth endpoints (login/register) to reduce brute-force risk
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX || '50', 10),
  message: { message: 'Too many attempts; please try again later.' },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/auth', authLimiter);

// Serve uploaded files (e.g., lecture notes) statically
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

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
app.use('/api/student', require('./routes/student'));
app.use('/api/activity', require('./routes/activity'));

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

const PORT = process.env.PORT || 5000;

// Ensure MongoDB is connected before starting the server
connectMongo()
  .then(() => {
    app.listen(PORT, () => {
      logger.info('Server running', { port: PORT, env: process.env.NODE_ENV || 'development' });
    });
  })
  .catch((err) => {
    logger.error('Failed to start server due to MongoDB error', { error: err.message });
    process.exit(1);
  });
