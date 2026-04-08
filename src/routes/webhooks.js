const express = require('express');
const router = express.Router();
const supabaseService = require('../services/supabase');

// Webhook for Make.com integration
router.post('/make', async (req, res) => {
  try {
    const { leadId, event, data } = req.body;
    
    console.log('🔗 Make.com webhook received:', { leadId, event });
    
    // Get lead details from database
    const lead = await supabaseService.getLeadById(leadId);
    
    if (!lead) {
      return res.status(404).json({
        error: 'Lead not found',
        leadId: leadId
      });
    }
    
    // Prepare webhook payload for Make.com
    const webhookPayload = {
      lead: lead,
      event: event || 'lead_created',
      timestamp: new Date().toISOString(),
      source: 'lexicon-receptionist'
    };
    
    // Send to Make.com webhook URL if configured
    if (process.env.MAKE_WEBHOOK_URL) {
      try {
        const fetch = require('node-fetch');
        const response = await fetch(process.env.MAKE_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(webhookPayload)
        });
        
        if (response.ok) {
          console.log('✅ Data sent to Make.com successfully');
        } else {
          console.error('❌ Failed to send data to Make.com:', response.statusText);
        }
      } catch (makeError) {
        console.error('Error sending to Make.com:', makeError);
      }
    } else {
      console.log('⚠️ Make.com webhook URL not configured, payload:', webhookPayload);
    }
    
    res.json({
      success: true,
      message: 'Webhook processed',
      payload: webhookPayload
    });
    
  } catch (error) {
    console.error('Error processing Make.com webhook:', error);
    res.status(500).json({
      error: 'Failed to process webhook',
      message: error.message
    });
  }
});

// Generic webhook for external integrations
router.post('/external', async (req, res) => {
  try {
    const { service, event, data } = req.body;
    
    console.log(`🔗 External webhook from ${service}:`, { event });
    
    // Log the webhook data
    const webhookLog = {
      service,
      event,
      data,
      received_at: new Date().toISOString(),
      ip: req.ip
    };
    
    // Store webhook log (you could create a webhooks table)
    console.log('Webhook logged:', webhookLog);
    
    // Integration handlers — implement when needed
    console.log(`Webhook received from ${service} — no handler configured yet`);
    
    res.json({
      success: true,
      message: 'External webhook processed',
      service: service,
      event: event
    });
    
  } catch (error) {
    console.error('Error processing external webhook:', error);
    res.status(500).json({
      error: 'Failed to process external webhook',
      message: error.message
    });
  }
});


// Webhook verification endpoint
router.get('/verify', (req, res) => {
  res.json({
    status: 'active',
    timestamp: new Date().toISOString(),
    service: 'lexicon-receptionist-webhooks',
    endpoints: {
      make: '/webhooks/make',
      external: '/webhooks/external'
    }
  });
});

module.exports = router;
