const express = require('express');
const router = express.Router();
const twilio = require('twilio');
const twilioService = require('../services/twilio');
const supabaseService = require('../services/supabase');
const openaiService = require('../services/openai');

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

// Send SMS endpoint
router.post('/send', async (req, res) => {
  try {
    const { to, message, leadId } = req.body;
    
    if (!to || !message) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['to', 'message']
      });
    }

    console.log('📱 Sending SMS to:', to);
    
    // Send SMS via Twilio
    const result = await twilioService.sendSMS(to, message);
    
    // Update lead follow-up status if leadId provided
    if (leadId) {
      try {
        await supabaseService.markFollowUpSent(leadId);
      } catch (updateError) {
        console.error('Error updating lead follow-up status:', updateError);
      }
    }
    
    res.json({
      success: true,
      sid: result.sid,
      to: to,
      message: 'SMS sent successfully'
    });
    
  } catch (error) {
    console.error('Error sending SMS:', error);
    res.status(500).json({
      error: 'Failed to send SMS',
      message: error.message
    });
  }
});

// Handle incoming SMS replies
router.post('/inbound', validateTwilioSignature, async (req, res) => {
  try {
    const { From, Body, MessageSid } = req.body;
    
    console.log('📨 Incoming SMS from:', From);
    console.log('💬 Message:', Body);
    
    // Get existing lead by phone number
    const lead = await supabaseService.getLeadByPhone(From);
    
    if (lead) {
      // Update lead with SMS reply
      const updatedStructuredData = {
        ...lead.structured_data,
        sms_reply: {
          message: Body,
          received_at: new Date().toISOString(),
          message_sid: MessageSid
        }
      };
      
      await supabaseService.saveLead({
        phone_number: From,
        structured_data: updatedStructuredData
      });
      
      console.log('✅ SMS reply logged for lead:', From);
    }
    
    // Send acknowledgment
    const businessName = process.env.BUSINESS_NAME || 'Our Business';
    const acknowledgment = await twilioService.sendSMS(
      From,
      `Thank you for your message to ${businessName}. We've received your reply and will follow up accordingly.`
    );
    
    res.status(200).send('SMS processed');
    
  } catch (error) {
    console.error('Error processing inbound SMS:', error);
    res.status(500).send('Error processing SMS');
  }
});

// Send follow-up to multiple leads
router.post('/bulk-followup', async (req, res) => {
  try {
    const { leadIds, customMessage } = req.body;
    
    if (!leadIds || !Array.isArray(leadIds)) {
      return res.status(400).json({
        error: 'leadIds array is required'
      });
    }
    
    const results = [];
    
    for (const leadId of leadIds) {
      try {
        // Use service method — never call .client directly
        const lead = await supabaseService.getLeadById(leadId);
        if (!lead) {
          results.push({ leadId, success: false, error: 'Lead not found' });
          continue;
        }
        
        // Generate or use custom message
        const message = customMessage || await openaiService.generateFollowUpSMS({
          name: lead.full_name,
          service: lead.service_requested,
          urgency: lead.urgency_level
        });
        
        // Send SMS
        const smsResult = await twilioService.sendSMS(lead.phone_number, message);
        
        // Mark follow-up as sent
        await supabaseService.markFollowUpSent(leadId);
        
        results.push({
          leadId,
          success: true,
          sid: smsResult.sid,
          to: lead.phone_number
        });
        
      } catch (error) {
        results.push({
          leadId,
          success: false,
          error: error.message
        });
      }
    }
    
    res.json({
      success: true,
      results: results,
      total: leadIds.length,
      sent: results.filter(r => r.success).length
    });
    
  } catch (error) {
    console.error('Error in bulk follow-up:', error);
    res.status(500).json({
      error: 'Failed to send bulk follow-up',
      message: error.message
    });
  }
});

module.exports = router;
