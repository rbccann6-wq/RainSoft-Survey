// Salesforce Sync Edge Function
// Handles all Salesforce API calls server-side with secure credential storage

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface SalesforceAuthResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
}

let cachedAccessToken: string | null = null;
let tokenExpiry: number = 0;

// Authenticate with Salesforce
async function authenticateSalesforce(): Promise<string> {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiry) {
    return cachedAccessToken;
  }

  const instanceUrl = Deno.env.get('SALESFORCE_INSTANCE_URL');
  const clientId = Deno.env.get('SALESFORCE_CLIENT_ID');
  const clientSecret = Deno.env.get('SALESFORCE_CLIENT_SECRET');
  const username = Deno.env.get('SALESFORCE_USERNAME');
  const password = Deno.env.get('SALESFORCE_PASSWORD');

  if (!instanceUrl || !clientId || !clientSecret || !username || !password) {
    throw new Error('Missing Salesforce credentials in Cloud Secrets. Please configure: SALESFORCE_INSTANCE_URL, SALESFORCE_CLIENT_ID, SALESFORCE_CLIENT_SECRET, SALESFORCE_USERNAME, SALESFORCE_PASSWORD');
  }
  
  console.log('🔐 Authenticating with Salesforce...');
  console.log('   Instance URL:', instanceUrl);
  console.log('   Username:', username);
  console.log('   Password length:', password.length);

  const tokenUrl = `${instanceUrl}/services/oauth2/token`;

  const response = await fetch(tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      grant_type: 'password',
      client_id: clientId,
      client_secret: clientSecret,
      username: username,
      password: password, // No security token needed if IP is whitelisted
    }).toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    
    // Check for invalid_grant error (most common)
    if (errorText.includes('invalid_grant') || errorText.includes('authentication failure')) {
      throw new Error(
        `Salesforce authentication failed. Common causes:\n\n` +
        `1. MISSING SECURITY TOKEN - Your SALESFORCE_PASSWORD must be: password + security token (no spaces)\n` +
        `   Example: If password is 'MyPass123' and token is 'AbCdEfGh1234', enter: MyPass123AbCdEfGh1234\n\n` +
        `2. Get your security token:\n` +
        `   - Log into Salesforce → Profile Icon → Settings\n` +
        `   - Search 'Reset My Security Token'\n` +
        `   - Check email for token\n` +
        `   - Combine: password + token (NO SPACE)\n\n` +
        `3. Update in OnSpace Cloud:\n` +
        `   - Click 'Cloud' → 'Secrets' tab\n` +
        `   - Edit SALESFORCE_PASSWORD\n` +
        `   - Enter: yourPassword123yourSecurityToken\n\n` +
        `Technical error: ${response.status} - ${errorText}`
      );
    }
    
    throw new Error(`Salesforce auth failed: ${response.status} - ${errorText}`);
  }

  const data: SalesforceAuthResponse = await response.json();
  cachedAccessToken = data.access_token;
  tokenExpiry = Date.now() + (90 * 60 * 1000); // 1.5 hours

  console.log('✅ Salesforce authenticated successfully');
  return cachedAccessToken;
}

// Main Edge Function handler
Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { action, data } = await req.json();

    const accessToken = await authenticateSalesforce();
    const instanceUrl = Deno.env.get('SALESFORCE_INSTANCE_URL');

    // Route to different Salesforce operations
    switch (action) {
      case 'test_connection': {
        // Test query to verify connection
        const queryUrl = `${instanceUrl}/services/data/v57.0/query`;
        const query = 'SELECT Id FROM Lead LIMIT 1';

        const response = await fetch(
          `${queryUrl}?q=${encodeURIComponent(query)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (response.ok) {
          return new Response(
            JSON.stringify({ success: true, message: 'Salesforce connection successful' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const errorText = await response.text();
          return new Response(
            JSON.stringify({ success: false, message: `HTTP ${response.status}: ${errorText}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      }

      case 'check_duplicate': {
        const { phone } = data;
        const queryUrl = `${instanceUrl}/services/data/v57.0/query`;

        // Check Leads first
        const leadQuery = `SELECT Id, Name, Email FROM Lead WHERE Phone = '${phone}' LIMIT 1`;
        const leadResponse = await fetch(
          `${queryUrl}?q=${encodeURIComponent(leadQuery)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (leadResponse.ok) {
          const leadData = await leadResponse.json();
          if (leadData.totalSize > 0) {
            const record = leadData.records[0];
            return new Response(
              JSON.stringify({
                isDuplicate: true,
                recordType: 'Lead',
                salesforceId: record.Id,
                recordName: record.Name,
                recordEmail: record.Email,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        // Check Accounts
        const accountQuery = `SELECT Id, Name, PersonEmail FROM Account WHERE PersonMobilePhone = '${phone}' OR Phone = '${phone}' LIMIT 1`;
        const accountResponse = await fetch(
          `${queryUrl}?q=${encodeURIComponent(accountQuery)}`,
          {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
              'Content-Type': 'application/json',
            },
          }
        );

        if (accountResponse.ok) {
          const accountData = await accountResponse.json();
          if (accountData.totalSize > 0) {
            const record = accountData.records[0];
            return new Response(
              JSON.stringify({
                isDuplicate: true,
                recordType: 'Account',
                salesforceId: record.Id,
                recordName: record.Name,
                recordEmail: record.PersonEmail,
              }),
              { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
            );
          }
        }

        return new Response(
          JSON.stringify({ isDuplicate: false }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'create_lead': {
        const { leadData } = data;
        const createUrl = `${instanceUrl}/services/data/v57.0/sobjects/Lead`;

        const response = await fetch(createUrl, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(leadData),
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Salesforce Lead creation failed: ${response.status} - ${errorText}`);
        }

        const result = await response.json();
        console.log('✅ Lead created in Salesforce:', result.id);

        return new Response(
          JSON.stringify({ success: true, salesforceId: result.id }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'verify_record': {
        const { recordId } = data;
        const queryUrl = `${instanceUrl}/services/data/v57.0/sobjects/Lead/${recordId}`;

        const response = await fetch(queryUrl, {
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (response.ok) {
          const recordUrl = `${instanceUrl}/lightning/r/Lead/${recordId}/view`;
          return new Response(
            JSON.stringify({ exists: true, recordUrl }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else if (response.status === 404) {
          return new Response(
            JSON.stringify({ exists: false, error: 'Record not found in Salesforce' }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
          );
        } else {
          const errorText = await response.text();
          return new Response(
            JSON.stringify({ exists: false, error: `Verification failed: ${response.status} - ${errorText}` }),
            { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
          );
        }
      }

      case 'delete_record': {
        const { recordId, recordType } = data;
        const deleteUrl = `${instanceUrl}/services/data/v57.0/sobjects/${recordType}/${recordId}`;

        const response = await fetch(deleteUrl, {
          method: 'DELETE',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Salesforce delete failed: ${response.status} - ${errorText}`);
        }

        return new Response(
          JSON.stringify({ success: true }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'run_report': {
        // Run a Salesforce report and return results
        const { reportId } = data;
        
        if (!reportId) {
          throw new Error('reportId is required for run_report action');
        }
        
        console.log(`📊 Running Salesforce report: ${reportId}`);
        
        // Run the report (this triggers execution and returns results)
        const reportUrl = `${instanceUrl}/services/data/v57.0/analytics/reports/${reportId}`;
        
        const response = await fetch(reportUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Salesforce report execution failed: ${response.status} - ${errorText}`);
        }

        const reportResults = await response.json();
        
        console.log(`✅ Report executed successfully`);
        console.log(`   - Rows returned: ${reportResults.factMap?.T?.rows?.length || 0}`);
        
        return new Response(
          JSON.stringify({ success: true, results: reportResults }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      case 'fetch_lead_fields': {
        // Describe Lead object to get all fields
        const describeUrl = `${instanceUrl}/services/data/v57.0/sobjects/Lead/describe`;
        
        const response = await fetch(describeUrl, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Salesforce field fetch failed: ${response.status} - ${errorText}`);
        }

        const metadata = await response.json();
        
        // Map Salesforce field types to simplified types
        const typeMap: Record<string, string> = {
          'string': 'text',
          'textarea': 'text',
          'email': 'text',
          'phone': 'text',
          'url': 'text',
          'picklist': 'picklist',
          'multipicklist': 'picklist',
          'boolean': 'boolean',
          'checkbox': 'boolean',
          'date': 'date',
          'datetime': 'datetime',
          'int': 'number',
          'double': 'number',
          'currency': 'number',
          'percent': 'number',
          'reference': 'reference',
          'id': 'text',
        };
        
        // Extract and format field information
        const fields = metadata.fields.map((field: any) => ({
          name: field.name,
          label: field.label,
          type: typeMap[field.type.toLowerCase()] || 'text',
          custom: field.custom,
          length: field.length,
          picklistValues: field.picklistValues?.map((pv: any) => pv.value) || [],
          referenceTo: field.referenceTo || [],
          required: !field.nillable && !field.defaultedOnCreate,
        }));

        // Sort: Standard fields first, then custom fields, alphabetically within each group
        fields.sort((a: any, b: any) => {
          if (a.custom === b.custom) {
            return a.label.localeCompare(b.label);
          }
          return a.custom ? 1 : -1;
        });

        console.log(`✅ Fetched ${fields.length} Lead fields from Salesforce`);
        
        return new Response(
          JSON.stringify({ success: true, fields }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Unknown action' }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        );
    }
  } catch (error) {
    console.error('❌ Salesforce sync error:', error);
    return new Response(
      JSON.stringify({ error: String(error) }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
