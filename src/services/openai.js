const OpenAI = require('openai');

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
    const systemPrompt = `You are a Home Services Intake Specialist AI. Your task is to extract and categorize information from customer call transcripts.

Extract the following information and return as JSON:
- name: Customer's full name (if mentioned)
- service: Type of service requested (e.g., "plumbing", "electrical", "hvac", "general")
- urgency: Determine urgency level based on keywords:
  * "emergency" -> "emergency"
  * "leaking", "burst", "fire", "flood", "no power" -> "high"
  * "soon", "this week", "appointment" -> "medium"
  * "when available", "quote", "information" -> "low"
- summary: Brief summary of the customer's issue
- qualification: "qualified" if they seem genuinely interested in services, "unqualified" if spam/sales call, "spam" if clearly spam

Rules:
- If any field is not mentioned, use null
- Always return valid JSON format
- Look for urgency indicators in the transcript
- Be conservative with qualification - only mark as spam if obviously not a customer

Example output:
{
  "name": "John Smith",
  "service": "plumbing",
  "urgency": "high",
  "summary": "Customer has a burst pipe and needs immediate plumbing service",
  "qualification": "qualified"
}`;

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
      const extractedData = JSON.parse(content);
      
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
