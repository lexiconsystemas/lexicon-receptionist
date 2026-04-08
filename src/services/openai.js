const OpenAI = require('openai');
const SYSTEM_PROMPTS = require('../utils/prompts');

class OpenAIService {
  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OpenAI API key is required');
    }
    
    this.client = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });
  }

  // Extract structured data from call transcript
  async extractLeadData(transcript) {
    const systemPrompt = SYSTEM_PROMPTS.LEAD_EXTRACTION;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: transcript }
        ],
        temperature: 0.3,
        max_tokens: 500
      });

      const content = response.choices[0].message.content;

      // Extract JSON safely — GPT sometimes adds prose before/after the object
      let extractedData;
      try {
        const jsonMatch = content.match(/\{[\s\S]*\}/);
        if (!jsonMatch) throw new Error('No JSON object found in response');
        extractedData = JSON.parse(jsonMatch[0]);
      } catch (parseError) {
        console.error('Failed to parse OpenAI response:', content);
        // Return safe defaults — do not throw, call must complete
        extractedData = {
          name: null,
          service: 'general',
          urgency: 'low',
          summary: 'Unable to extract details from call',
          qualification: 'unqualified'
        };
      }
      
      console.log('Extracted lead data:', extractedData);
      return extractedData;
    } catch (error) {
      console.error('Error extracting lead data:', error);
      throw new Error('Failed to extract lead data from transcript');
    }
  }

  // Generate follow-up SMS content
  async generateFollowUpSMS(leadData) {
    const businessName = process.env.BUSINESS_NAME || 'Our Business';
    const serviceName = leadData.service || 'your request';
    const urgencyNote = leadData.urgency === 'emergency' ? 'We understand this is urgent and ' : '';

    const prompt = `Generate a brief, professional SMS follow-up message for a customer who called about ${serviceName}. 
Customer name: ${leadData.name || 'there'}
Service: ${serviceName}
Urgency: ${leadData.urgency}

The message should:
- Be under 160 characters if possible
- Include the business name: ${businessName}
- Acknowledge their specific service request
- ${urgencyNote}Indicate follow-up timing
- Be professional and friendly

Return only the SMS message content, no quotes or formatting.`;

    try {
      const response = await this.client.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
        max_tokens: 200
      });

      const smsContent = response.choices[0].message.content.trim();
      return smsContent;
    } catch (error) {
      console.error('Error generating follow-up SMS:', error);
      
      // Fallback message
      return `Hi ${leadData.name || 'there'}, this is ${businessName}. We've received your request regarding ${serviceName} and will follow up shortly.`;
    }
  }
}

module.exports = new OpenAIService();
