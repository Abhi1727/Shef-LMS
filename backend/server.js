const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const { connectMongo } = require('./config/mongo');
// const { startRecordingSync } = require('./jobs/syncRecordings');
const videoProcessor = require('./middleware/videoProcessor');

dotenv.config();

const app = express();

// CORS Configuration for Production
const allowedOrigins = process.env.ALLOWED_ORIGINS 
  ? process.env.ALLOWED_ORIGINS.split(',') 
  : ['http://localhost:3000'];

app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, true); // Allow all in development, restrict in production if needed
    }
  },
  credentials: true
}));

app.use(express.json());

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

// Health check & API root
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
      console.log(`Server running on port ${PORT}`);

      // Start Zoom recording sync scheduler - COMMENTED OUT
      // startRecordingSync();
    });
  })
  .catch((err) => {
    console.error('Failed to start server due to MongoDB error:', err.message);
    process.exit(1);
  });
