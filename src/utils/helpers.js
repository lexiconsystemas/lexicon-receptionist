// Utility functions and helpers

const helpers = {
  // Format phone number to E.164 format
  formatPhoneNumber: (phone) => {
    if (!phone) return null;
    
    // Remove all non-numeric characters
    const cleaned = phone.replace(/\D/g, '');
    
    // Check if it's already in E.164 format
    if (cleaned.startsWith('1') && cleaned.length === 11) {
      return `+${cleaned}`;
    }
    
    // If 10 digits, assume US number
    if (cleaned.length === 10) {
      return `+1${cleaned}`;
    }
    
    // If already has +, return as is
    if (phone.startsWith('+')) {
      return phone;
    }
    
    return phone;
  },

  // Clean and sanitize text input
  sanitizeText: (text) => {
    if (!text) return '';
    
    return text
      .trim()
      .replace(/[<>]/g, '') // Remove potential HTML
      .replace(/[\r\n\t]/g, ' ') // Replace line breaks with spaces
      .replace(/\s+/g, ' ') // Collapse multiple spaces
      .substring(0, 2000); // Limit length
  },

  // Validate email format
  isValidEmail: (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  },

  // Determine urgency level from text
  detectUrgency: (text) => {
    if (!text) return 'low';
    
    const lowerText = text.toLowerCase();
    
    const emergencyWords = [
      // Direct statements
      'emergency', 'call 911', 'dying', 'unconscious', 'not breathing',
      'i think i\'m dying', 'i can\'t stay awake', 'something is very wrong',
      'i feel like passing out', 'i can\'t breathe', 'heart is racing',
      // Neurological
      'sudden confusion', 'can\'t speak', 'worst headache', 'vision loss',
      'can\'t walk', 'one side numb', 'facial drooping', 'slurred speech',
      // Cardiac
      'chest pain', 'chest pressure', 'heart attack', 'fainting',
      'rapid heartbeat', 'irregular heartbeat',
      // Respiratory
      'gasping', 'choking', 'can\'t breathe', 'stridor', 'airway',
      'shortness of breath', 'difficulty breathing',
      // Bleeding
      'vomiting blood', 'coughing blood', 'severe bleeding', 'uncontrolled bleeding',
      // Mental health
      'suicidal', 'want to die', 'kill myself', 'self-harm', 'hurt myself',
      // Overdose
      'overdose', 'poisoning', 'swallowed something'
    ];

    const safetyWords = [
      // Home services specific emergencies
      'gas smell', 'gas leak', 'smell gas', 'carbon monoxide', 'co alarm',
      'fire', 'sparks', 'burning smell', 'electrical fire', 'smoke inside',
      'flooding', 'water won\'t stop', 'sewage backup',
      'no heat', 'no power', 'power outage'
    ];

    const highWords = [
      'leaking', 'leak', 'burst pipe', 'flood', 'broken',
      'outage', 'not working', 'stopped working', 'urgent repair'
    ];
    
    // Medium urgency keywords
    const mediumWords = ['soon', 'this week', 'appointment', 'need help', 'not working'];
    
    if (emergencyWords.some(word => lowerText.includes(word)) || 
        safetyWords.some(word => lowerText.includes(word))) {
      return 'emergency';
    }
    
    if (highWords.some(word => lowerText.includes(word))) {
      return 'high';
    }
    
    if (mediumWords.some(word => lowerText.includes(word))) {
      return 'medium';
    }
    
    return 'low';
  },

  // Extract service type from text
  extractServiceType: (text) => {
    if (!text) return null;
    
    const lowerText = text.toLowerCase();
    
    const serviceKeywords = {
      plumbing: ['plumb', 'leak', 'drain', 'pipe', 'water', 'toilet', 'sink', 'water heater'],
      electrical: ['electric', 'power', 'outlet', 'breaker', 'wiring', 'light', 'switch'],
      hvac: ['heat', 'air conditioning', 'ac', 'furnace', 'thermostat', 'ventilation', 'cooling'],
      general: ['maintenance', 'inspection', 'quote', 'estimate', 'general', 'repair']
    };
    
    for (const [service, keywords] of Object.entries(serviceKeywords)) {
      if (keywords.some(keyword => lowerText.includes(keyword))) {
        return service;
      }
    }
    
    return 'general';
  },

  // Generate unique ID
  generateId: () => {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  },

  // Format timestamp
  formatTimestamp: (date = new Date()) => {
    return date.toISOString();
  },

  // Sleep/delay utility
  sleep: (ms) => {
    return new Promise(resolve => setTimeout(resolve, ms));
  },

  // Retry utility for API calls
  async retry(fn, maxAttempts = 3, delay = 1000) {
    let lastError;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error;
        console.log(`Attempt ${attempt} failed:`, error.message);
        
        if (attempt < maxAttempts) {
          await this.sleep(delay * attempt); // Exponential backoff
        }
      }
    }
    
    throw lastError;
  },

  // Validate required environment variables
  validateEnvironment: () => {
    const required = [
      'TWILIO_ACCOUNT_SID',
      'TWILIO_AUTH_TOKEN',
      'TWILIO_PHONE_NUMBER',
      'OPENAI_API_KEY',
      'SUPABASE_URL',
      'SUPABASE_KEY'
    ];
    
    const missing = required.filter(key => !process.env[key]);
    
    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
    }
  },

  // Log with timestamp
  log: (level, message, data = null) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      message,
      data
    };
    
    console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, data || '');
    
    return logEntry;
  },

  // Error response formatter
  formatError: (error, context = '') => {
    return {
      error: true,
      message: error.message,
      context,
      timestamp: new Date().toISOString(),
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    };
  }
};

module.exports = helpers;
