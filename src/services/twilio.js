const twilio = require('twilio');

class TwilioService {
  constructor() {
    if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
      throw new Error('Twilio credentials are required');
    }
    
    this.client = twilio(
      process.env.TWILIO_ACCOUNT_SID,
      process.env.TWILIO_AUTH_TOKEN
    );
    this.phoneNumber = process.env.TWILIO_PHONE_NUMBER;
  }

  // Generate TwiML response for voice calls
  generateGatherTwiML() {
    const businessName = process.env.BUSINESS_NAME || 'our business';
    
    return `<?xml version="1.0" encoding="UTF-8"?>
<Response>
  <Gather input="speech" timeout="5" language="en-US" action="/voice/process" method="POST">
    <Say voice="alice">Hi, you've reached ${businessName} automated intake. How can we help you today?</Say>
  </Gather>
  <Say voice="alice">I'm sorry, I didn't catch that. Please call back if you need assistance.</Say>
  <Hangup/>
</Response>`;
  }

  // Send SMS message
  async sendSMS(to, message) {
    try {
      const result = await this.client.messages.create({
        body: message,
        from: this.phoneNumber,
        to: to
      });
      
      console.log(`SMS sent to ${to}: SID ${result.sid}`);
      return { success: true, sid: result.sid };
    } catch (error) {
      console.error('Error sending SMS:', error);
      throw error;
    }
  }

  // Make outbound call
  async makeCall(to, twimlUrl) {
    try {
      const result = await this.client.calls.create({
        url: twimlUrl,
        to: to,
        from: this.phoneNumber
      });
      
      console.log(`Call initiated to ${to}: SID ${result.sid}`);
      return { success: true, sid: result.sid };
    } catch (error) {
      console.error('Error making call:', error);
      throw error;
    }
  }
}

module.exports = new TwilioService();
