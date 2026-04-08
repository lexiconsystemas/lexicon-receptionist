const { createClient } = require('@supabase/supabase-js');

class SupabaseService {
  constructor() {
    if (!process.env.SUPABASE_URL || !process.env.SUPABASE_KEY) {
      throw new Error('Supabase credentials are required');
    }
    
    // Use service role key for server-side operations
    // Never use the anon key for server writes
    this.client = createClient(
      process.env.SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY
    );
  }

  async saveLead(leadData) {
    try {
      // Always INSERT — never overwrite call history
      // Repeat callers get multiple rows linked by phone_number
      const { data, error } = await this.client
        .from('leads')
        .insert({
          phone_number: leadData.phone_number,
          full_name: leadData.name || null,
          service_requested: leadData.service || null,
          urgency_level: leadData.urgency || 'low',
          qualification_status: leadData.qualification || 'unqualified',
          call_transcript: leadData.transcript || null,
          call_sid: leadData.call_sid || null,
          emergency_triggered: leadData.emergency_triggered || false,
          spam_flagged: leadData.spam_flagged || false,
          call_disposition: leadData.disposition || 'intake_complete',
          structured_data: {
            summary: leadData.summary || null,
            extracted_at: new Date().toISOString()
          },
          follow_up_sent: false
        })
        .select()
        .single();

      if (error) {
        console.error('Supabase error saving lead:', error);
        throw error;
      }

      console.log('Lead saved successfully:', data.id);
      return data;
    } catch (error) {
      console.error('Error saving lead to Supabase:', error);
      throw error;
    }
  }

  // Get lead by ID
  async getLeadById(id) {
    try {
      const { data, error } = await this.client
        .from('leads')
        .select('*')
        .eq('id', id)
        .single();

      if (error && error.code !== 'PGRST116') throw error;
      return data || null;
    } catch (error) {
      console.error('Error fetching lead by ID:', error);
      throw error;
    }
  }

  // Get lead by phone number
  async getLeadByPhone(phoneNumber) {
    try {
      const { data, error } = await this.client
        .from('leads')
        .select('*')
        .eq('phone_number', phoneNumber)
        .single();

      if (error && error.code !== 'PGRST116') { // PGRST116 is "not found"
        console.error('Supabase error fetching lead:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching lead from Supabase:', error);
      throw error;
    }
  }

  // Update lead follow-up status
  async markFollowUpSent(leadId) {
    try {
      const { data, error } = await this.client
        .from('leads')
        .update({ 
          follow_up_sent: true,
          updated_at: new Date().toISOString()
        })
        .eq('id', leadId)
        .select()
        .single();

      if (error) {
        console.error('Supabase error updating follow-up status:', error);
        throw error;
      }

      console.log('Follow-up status updated:', data);
      return data;
    } catch (error) {
      console.error('Error updating follow-up status:', error);
      throw error;
    }
  }

  // Get all leads (for admin/debug)
  async getAllLeads(limit = 50) {
    try {
      const { data, error } = await this.client
        .from('leads')
        .select('*')
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('Supabase error fetching leads:', error);
        throw error;
      }

      return data;
    } catch (error) {
      console.error('Error fetching leads from Supabase:', error);
      throw error;
    }
  }

  // Initialize leads table (for development)
  async initializeLeadsTable() {
    const createTableSQL = `
      CREATE TABLE IF NOT EXISTS leads (
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
      
      CREATE INDEX IF NOT EXISTS idx_leads_phone_number ON leads(phone_number);
      CREATE INDEX IF NOT EXISTS idx_leads_created_at ON leads(created_at);
      CREATE INDEX IF NOT EXISTS idx_leads_urgency ON leads(urgency_level);
    `;

    try {
      const { data, error } = await this.client.rpc('exec_sql', { sql: createTableSQL });
      
      if (error) {
        console.log('Note: Table initialization may need to be done manually in Supabase dashboard');
        console.log('SQL to run:', createTableSQL);
      }
    } catch (error) {
      console.log('Note: RPC exec_sql may not be available. Initialize table manually in Supabase dashboard.');
    }
  }
}

module.exports = new SupabaseService();
