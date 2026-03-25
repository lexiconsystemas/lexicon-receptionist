# Lexicon Receptionist MVP

AI-powered receptionist system for lead qualification and automated follow-up using Node.js, Express, Twilio, OpenAI, and Supabase.

## Features

- **Voice Intake**: Automated call handling with Twilio Voice
- **AI Processing**: OpenAI-powered lead qualification and data extraction
- **SMS Follow-up**: Automated SMS responses to qualified leads
- **Database Storage**: Lead management with Supabase/PostgreSQL
- **Webhook Integration**: External integrations via Make.com
- **Emergency Detection**: Priority handling of urgent requests

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Environment Setup

Copy `.env.example` to `.env` and configure your credentials:

```bash
cp .env.example .env
```

Required environment variables:
- `TWILIO_ACCOUNT_SID` - Your Twilio account SID
- `TWILIO_AUTH_TOKEN` - Your Twilio auth token
- `TWILIO_PHONE_NUMBER` - Your Twilio phone number
- `OPENAI_API_KEY` - Your OpenAI API key
- `SUPABASE_URL` - Your Supabase project URL
- `SUPABASE_KEY` - Your Supabase service key
- `MAKE_WEBHOOK_URL` - Optional: Make.com webhook URL
- `BUSINESS_NAME` - Your business name for greetings

### 3. Database Setup

Create the `leads` table in your Supabase project:

```sql
CREATE TABLE leads (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  phone_number TEXT NOT NULL UNIQUE,
  full_name TEXT,
  service_requested TEXT,
  urgency_level TEXT CHECK (urgency_level IN ('low', 'medium', 'high', 'emergency')),
  qualification_status TEXT CHECK (qualification_status IN ('qualified', 'unqualified', 'spam')),
  call_transcript TEXT,
  structured_data JSONB,
  follow_up_sent BOOLEAN DEFAULT FALSE
);

CREATE INDEX idx_leads_phone_number ON leads(phone_number);
CREATE INDEX idx_leads_created_at ON leads(created_at);
CREATE INDEX idx_leads_urgency ON leads(urgency_level);
```

### 4. Start the Server

```bash
# Development mode with auto-reload
npm run dev

# Production mode
npm start
```

The server will start on `http://localhost:3000`

## API Endpoints

### Voice Endpoints
- `POST /voice/inbound` - Handle incoming calls
- `POST /voice/process` - Process speech results
- `POST /voice/status` - Call status updates

### SMS Endpoints
- `POST /sms/send` - Send SMS message
- `POST /sms/inbound` - Handle SMS replies
- `POST /sms/bulk-followup` - Bulk follow-up messages

### Webhook Endpoints
- `POST /webhooks/make` - Make.com integration
- `POST /webhooks/external` - Generic external webhooks
- `GET /webhooks/verify` - Webhook verification

### Utility Endpoints
- `GET /health` - Health check
- `GET /` - API information

## Twilio Configuration

### Voice Webhook URL
Configure your Twilio phone number's voice webhook to:
```
https://your-domain.com/voice/inbound
```

### SMS Webhook URL
Configure your Twilio phone number's SMS webhook to:
```
https://your-domain.com/sms/inbound
```

## Development with Ngrok

For local development, use ngrok to expose your localhost:

```bash
# Install ngrok
npm install -g ngrok

# Start your server
npm run dev

# In another terminal, expose port 3000
ngrok http 3000
```

Use the ngrok URL for your Twilio webhooks.

## System Flow

1. **Incoming Call** → Twilio receives call → Webhook to `/voice/inbound`
2. **AI Interaction** → TwiML greeting → Speech capture → `/voice/process`
3. **Data Extraction** → OpenAI analyzes transcript → Structured JSON output
4. **Lead Storage** → Save to Supabase `leads` table
5. **Follow-up** → Send SMS via Twilio → Update database
6. **Integration** → Webhook to Make.com → External logging

## Emergency Detection

The system automatically detects emergency situations based on keywords:
- **Emergency**: "emergency", "urgent", "immediately"
- **High Priority**: "leaking", "burst", "no power", "gas smell"
- **Medium Priority**: "soon", "this week", "appointment"
- **Low Priority**: "quote", "information", "when available"

## Testing

### Test Voice Flow
```bash
# Test inbound call endpoint
curl -X POST http://localhost:3000/voice/inbound \
  -H "Content-Type: application/x-www-form-urlencoded" \
  -d "From=+1234567890&CallSid=test123"
```

### Test SMS Flow
```bash
# Test SMS sending
curl -X POST http://localhost:3000/sms/send \
  -H "Content-Type: application/json" \
  -d '{"to": "+1234567890", "message": "Test message"}'
```

## Monitoring

Check the console logs for:
- 📞 Incoming calls
- 🎤 Speech processing
- ✅ Successful operations
- ❌ Error details

## License

MIT License - see LICENSE file for details.
