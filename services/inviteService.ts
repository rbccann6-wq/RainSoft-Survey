// Service for sending employee invites via SMS and email
import * as Notifications from 'expo-notifications';
import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

export const sendEmployeeInvite = async (
  firstName: string,
  lastName: string,
  email: string,
  phone: string,
  inviteToken: string
): Promise<boolean> => {
  try {
    // In production, this would call your backend API to send actual SMS/email
    // For now, we'll log the invitation details
    
    const inviteLink = `rainsoft://onboarding/${inviteToken}`;
    
    const message = `Welcome to RainSoft of the Wiregrass, ${firstName}! Click here to complete your onboarding: ${inviteLink}`;
    
    console.log(`📧 Email sent to: ${email}`);
    
    // Send SMS via Twilio
    console.log(`📱 Sending SMS to: ${phone}`);
    await sendSMS(phone, message);
    
    console.log(`Message: ${message}`);
    
    // Mock notification for demo
    await Notifications.scheduleNotificationAsync({
      content: {
        title: 'Invitation Sent',
        body: `Onboarding invite sent to ${firstName} ${lastName} at ${email}`,
      },
      trigger: null,
    });
    
    return true;
  } catch (error) {
    console.error('Failed to send invite:', error);
    return false;
  }
};

// Send SMS via Twilio Edge Function
export const sendSMS = async (phone: string, message: string): Promise<boolean> => {
  try {
    const { data, error } = await supabase.functions.invoke('send-sms', {
      body: { to: phone, message },
    });

    if (error) {
      console.error('SMS Error:', error);
      return false;
    }

    if (data?.success) {
      console.log('✅ SMS sent successfully');
      return true;
    } else {
      console.error('SMS failed:', data?.error);
      return false;
    }
  } catch (error) {
    console.error('Failed to send SMS:', error);
    return false;
  }
};

export const sendEmail = async (
  email: string, 
  subject: string, 
  body: string
): Promise<boolean> => {
  // TODO: Integrate SendGrid/AWS SES API
  console.log(`Email to ${email} - Subject: ${subject}`);
  return true;
};
