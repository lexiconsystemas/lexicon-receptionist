const express = require('express');
const router = express.Router();
const twilioService = require('../services/twilio');
const openaiService = require('../services/openai');
const supabaseService = require('../services/supabase');

// Handle inbound voice calls
router.post('/inbound', (req, res) => {
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

// Process gathered speech from call
router.post('/process', async (req, res) => {
  try {
    const { SpeechResult, From, CallSid } = req.body;
    
    console.log('🎤 Processing speech from:', From);
    console.log('📝 Speech result:', SpeechResult);
    
    if (!SpeechResult) {
      console.log('No speech result received');
      return res.type('text/xml').send(`
        <Response>
          <Say voice="alice">I'm sorry, I didn't understand that. Please call back if you need assistance.</Say>
          <Hangup/>
        </Response>
      `);
    }

    // Extract structured data from transcript
    const extractedData = await openaiService.extractLeadData(SpeechResult);
    
    // Prepare lead data for database
    const leadData = {
      phone_number: From,
      name: extractedData.name,
      service: extractedData.service,
      urgency: extractedData.urgency,
      qualification: extractedData.qualification,
      summary: extractedData.summary,
      transcript: SpeechResult,
      call_sid: CallSid
    };

    // Save lead to database
    const savedLead = await supabaseService.saveLead(leadData);
    
    // Generate and send follow-up SMS if qualified
    if (extractedData.qualification === 'qualified') {
      try {
        const smsMessage = await openaiService.generateFollowUpSMS(extractedData);
        await twilioService.sendSMS(From, smsMessage);
        
        // Mark follow-up as sent
        await supabaseService.markFollowUpSent(savedLead.id);
        
        console.log('✅ Follow-up SMS sent to:', From);
      } catch (smsError) {
        console.error('Error sending follow-up SMS:', smsError);
      }
    }

    // Send acknowledgment TwiML
    const businessName = process.env.BUSINESS_NAME || 'our business';
    const urgencyResponse = extractedData.urgency === 'emergency' 
      ? 'We understand this is urgent and will prioritize your request.'
      : 'We will review your request and get back to you soon.';

    const responseTwiML = `
      <Response>
        <Say voice="alice">Thank you for calling ${businessName}. We've received your request regarding ${extractedData.service || 'your inquiry'}. ${urgencyResponse} If this is an emergency, please call 911.</Say>
        <Hangup/>
      </Response>
    `;

    res.type('text/xml');
    res.send(responseTwiML);
    
    console.log('✅ Call processed successfully for:', From);
    
  } catch (error) {
    console.error('Error processing call:', error);
    
    res.type('text/xml').send(`
      <Response>
        <Say voice="alice">I'm sorry, we encountered an error processing your request. Please call back.</Say>
        <Hangup/>
      </Response>
    `);
  }
});

// Handle call status updates
router.post('/status', (req, res) => {
  const { CallSid, CallStatus, From } = req.body;
  
  console.log('📊 Call status update:', {
    callSid: CallSid,
    status: CallStatus,
    from: From
  });
  
  res.status(200).send('Status received');
});

module.exports = router;
