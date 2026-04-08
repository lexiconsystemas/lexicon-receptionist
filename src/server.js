require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const voiceRoutes = require('./routes/voice');
const smsRoutes = require('./routes/sms');
const webhookRoutes = require('./routes/webhooks');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors({
  origin: (process.env.ALLOWED_ORIGINS || 'http://localhost:3000').split(','),
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type', 'x-api-key']
}));
app.use(bodyParser.urlencoded({ extended: false }));
app.use(bodyParser.json());

// Internal API key protection
function requireApiKey(req, res, next) {
  const key = req.headers['x-api-key'];
  if (!key || key !== process.env.INTERNAL_API_KEY) {
    return res.status(401).json({ error: 'Unauthorized' });
  }
  next();
}

// Rate limiting
const rateLimit = require('express-rate-limit');
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests' }
});
const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 10,
  message: { error: 'SMS rate limit exceeded' }
});
app.use(limiter);

// Routes
app.use('/voice', voiceRoutes);
app.use('/sms/inbound', smsRoutes); // Twilio — no API key required
app.use('/sms', smsLimiter, requireApiKey, smsRoutes);
app.use('/webhooks', requireApiKey, webhookRoutes);

// Health check endpoint
app.get('/health', (req, res) => {
  res.status(200).json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'lexicon-receptionist'
  });
});

// Root endpoint
app.get('/', (req, res) => {
  res.json({ 
    message: 'Lexicon Receptionist API',
    version: '1.0.0',
    endpoints: {
      health: '/health',
      voice: '/voice',
      sms: '/sms',
      webhooks: '/webhooks'
    }
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('Error:', err);
  res.status(500).json({ 
    error: 'Internal Server Error',
    message: err.message 
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ 
    error: 'Not Found',
    message: `Route ${req.originalUrl} not found` 
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Lexicon Receptionist server running on port ${PORT}`);
  console.log(`📞 Voice webhook: http://localhost:${PORT}/voice/inbound`);
  console.log(`📱 SMS endpoint: http://localhost:${PORT}/sms/send`);
  console.log(`🔗 Webhook endpoint: http://localhost:${PORT}/webhooks/make`);
});
