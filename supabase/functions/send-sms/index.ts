// Twilio SMS Edge Function
// Securely sends SMS messages using Twilio API with server-side credentials

import { corsHeaders } from '../_shared/cors.ts';

interface SMSRequest {
  to: string;
  message: string;
}

Deno.serve(async (req) => {
  // Handle CORS preflight request
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    // Parse request body
    const { to, message }: SMSRequest = await req.json();

    // Validate input
    if (!to || !message) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: to, message' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Get Twilio credentials from environment
    const accountSid = Deno.env.get('TWILIO_ACCOUNT_SID');
    const authToken = Deno.env.get('TWILIO_AUTH_TOKEN');
    const fromNumber = Deno.env.get('TWILIO_PHONE_NUMBER');

    if (!accountSid || !authToken || !fromNumber) {
      console.error('Missing Twilio credentials in environment');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Twilio credentials not configured' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    // Format phone number (ensure it starts with +1 for US)
    const formattedTo = to.startsWith('+') ? to : `+1${to.replace(/\D/g, '')}`;
    const formattedFrom = fromNumber.startsWith('+') ? fromNumber : `+${fromNumber}`;

    console.log(`📱 Sending SMS to ${formattedTo}`);

    // Send SMS via Twilio API
    const twilioUrl = `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`;
    
    const response = await fetch(twilioUrl, {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + btoa(`${accountSid}:${authToken}`),
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        To: formattedTo,
        From: formattedFrom,
        Body: message,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Twilio API error:', response.status, errorText);
      
      // Return 200 with error details (Edge Function succeeded, Twilio failed)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Twilio API error: ${response.status}`,
          details: errorText
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' }
        }
      );
    }

    const result = await response.json();
    console.log(`✅ SMS sent successfully. SID: ${result.sid}`);

    return new Response(
      JSON.stringify({ 
        success: true, 
        messageSid: result.sid,
        status: result.status
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );

  } catch (error) {
    console.error('Error sending SMS:', error);
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    );
  }
});
