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
    throw new Error('Missing Salesforce credentials in environment variables');
  }

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
