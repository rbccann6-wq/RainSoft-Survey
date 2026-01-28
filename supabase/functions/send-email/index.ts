// Send email via SendGrid
import { corsHeaders } from '../_shared/cors.ts';

const SENDGRID_API_KEY = Deno.env.get('SENDGRID_API_KEY');
// ⚠️ IMPORTANT: This email MUST be verified in SendGrid Dashboard
// Go to: Settings → Sender Authentication → Verify a Single Sender
// Common verified emails: noreply@yourdomain.com, support@yourdomain.com
const FROM_EMAIL = Deno.env.get('SENDGRID_FROM_EMAIL') || 'noreply@rainsoft.com';

interface EmailRequest {
  to: string;
  subject: string;
  body: string;
  isHtml?: boolean;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { to, subject, body, isHtml = false }: EmailRequest = await req.json();

    // Validate inputs
    if (!to || !subject || !body) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Missing required fields: to, subject, body' 
        }),
        { 
          status: 400, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    if (!SENDGRID_API_KEY) {
      console.error('SENDGRID_API_KEY not configured');
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Email service not configured' 
        }),
        { 
          status: 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    // Send email via SendGrid API
    const response = await fetch('https://api.sendgrid.com/v3/mail/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${SENDGRID_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        personalizations: [{
          to: [{ email: to }],
        }],
        from: { email: FROM_EMAIL },
        subject: subject,
        content: [{
          type: isHtml ? 'text/html' : 'text/plain',
          value: body,
        }],
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('SendGrid Error:', response.status, errorText);
      
      // Return 200 with error details (Edge Function succeeded, SendGrid failed)
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `SendGrid: Failed to send email (${response.status})`,
          details: errorText
        }),
        { 
          status: 200, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      );
    }

    console.log(`✅ Email sent to: ${to}`);

    return new Response(
      JSON.stringify({ 
        success: true,
        message: 'Email sent successfully',
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    );

  } catch (error) {
    console.error('Email function error:', error);
    
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
