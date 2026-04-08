const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const twilioService = require('../services/twilio');
const openaiService = require('../services/openai');
const supabaseService = require('../services/supabase');
const helpers = require('../utils/helpers');

function validateTwilioSignature(req, res, next) {
  const signature = req.headers['x-twilio-signature'];
  const url = `${req.protocol}://${req.get('host')}${req.originalUrl}`;
  const valid = twilio.validateRequest(
    process.env.TWILIO_AUTH_TOKEN,
    signature,
    url,
    req.body
  );
  if (!valid) {
    console.error('Invalid Twilio signature from:', req.ip);
    return res.status(403).send('Forbidden');
  }
  next();
}

// Handle inbound voice calls
router.post('/inbound', validateTwilioSignature, (req, res) => {
  console.log('📞 Incoming call from:', req.body.From);
  
  try {
    const twiml = twilioService.generateGatherTwiML();
    res.type('text/xml');
    res.send(twiml);
  } catch (error) {
    console.error('Error generating TwiML:', error);
    res.status(500).send('Error generating response');
  }
});

router.post('/process', validateTwilioSignature, async (req, res) => {
  try {
    const { SpeechResult, From, CallSid } = req.body;

    console.log('🎤 Processing speech from:', From);
    console.log('📝 Speech result:', SpeechResult);

    if (!SpeechResult) {
      return res.type('text/xml').send(`
        <Response>
          <Say voice="alice">I'm sorry, I didn't understand that. Please call back if you need assistance.</Say>
          <Hangup/>
        </Response>
      `);
    }

    // EMERGENCY CHECK — runs before anything else, no OpenAI, no DB
    const preCheckUrgency = helpers.detectUrgency(SpeechResult);
    if (preCheckUrgency === 'emergency') {
      // Log the emergency call attempt before exiting
      try {
        await supabaseService.saveLead({
          phone_number: From,
          call_sid: CallSid,
          urgency: 'emergency',
          emergency_triggered: true,
          transcript: SpeechResult,
          qualification: 'unqualified',
          disposition: 'emergency'
        });
      } catch (logErr) {
        console.error('Failed to log emergency call:', logErr);
      }

      return res.type('text/xml').send(`
        <Response>
          <Say voice="alice">I'm not able to help with emergencies. Based on what you've described, this may be a serious situation. Please hang up and call 911 immediately, or go to the nearest emergency room.</Say>
          <Pause length="2"/>
          <Say voice="alice">Please hang up and call 911 immediately.</Say>
          <Hangup/>
        </Response>
      `);
    }

    // Sanitize input before sending to OpenAI
    const sanitizedTranscript = helpers.sanitizeText(SpeechResult);

    // Extract structured data
    const extractedData = await helpers.retry(
      () => openaiService.extractLeadData(sanitizedTranscript),
      3,
      1000
    );

    // Build lead record — all fields explicit, nothing silently dropped
    const leadData = {
      phone_number: From,
      call_sid: CallSid,
      name: extractedData.name || null,
      service: extractedData.service || null,
      urgency: extractedData.urgency || 'low',
      qualification: extractedData.qualification || 'unqualified',
      summary: extractedData.summary || null,
      transcript: sanitizedTranscript,
      emergency_triggered: false,
      spam_flagged: extractedData.qualification === 'spam',
      disposition: extractedData.qualification === 'spam' ? 'spam' : 'intake_complete'
    };

    const savedLead = await supabaseService.saveLead(leadData);

    // Only send SMS to qualified leads — consent check will be added in next block
    if (extractedData.qualification === 'qualified') {
      try {
        const smsMessage = await openaiService.generateFollowUpSMS(extractedData);
        await twilioService.sendSMS(From, smsMessage);
        await supabaseService.markFollowUpSent(savedLead.id);
        console.log('✅ Follow-up SMS sent to:', From);
      } catch (smsError) {
        console.error('Error sending follow-up SMS:', smsError);
        // Do not throw — call handling must complete regardless
      }
    }

    const businessName = process.env.BUSINESS_NAME || 'our business';
    const urgencyResponse = extractedData.urgency === 'high'
      ? 'We understand this is urgent and will prioritize your request.'
      : 'We will review your request and get back to you soon.';

    return res.type('text/xml').send(`
      <Response>
        <Say voice="alice">Thank you for calling ${businessName}. We've received your request regarding ${extractedData.service || 'your inquiry'}. ${urgencyResponse}</Say>
        <Hangup/>
      </Response>
    `);

  } catch (error) {
    console.error('Error processing call:', error);
    return res.type('text/xml').send(`
      <Response>
        <Say voice="alice">I'm sorry, we encountered a technical issue. Please call back and we'll take care of you.</Say>
        <Hangup/>
      </Response>
    `);
  }
});

router.post('/status', validateTwilioSignature, async (req, res) => {
  const { CallStatus, From, CallSid } = req.body;

  console.log('📊 Call status update:', { callSid: CallSid, status: CallStatus, from: From });

  // Missed call recovery — fire SMS within 60 seconds
  if (CallStatus === 'no-answer' || CallStatus === 'busy') {
    const businessName = process.env.BUSINESS_NAME || 'us';
    try {
      await twilioService.sendSMS(
        From,
        `Hi! You just called ${businessName} and we missed you. Reply here or call us back — we want to help.` 
      );
      console.log('📱 Missed call recovery SMS sent to:', From);

      // Log as a lead so it appears in the pipeline
      await supabaseService.saveLead({
        phone_number: From,
        call_sid: CallSid,
        disposition: 'missed_call',
        urgency: 'low',
        qualification: 'unqualified',
        spam_flagged: false,
        emergency_triggered: false
      });
    } catch (err) {
      console.error('Failed to send missed call recovery SMS:', err);
    }
  }

  res.status(200).send('OK');
});

module.exports = router;
