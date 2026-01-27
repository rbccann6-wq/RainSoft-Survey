// Service for sending employee invites via SMS and email
import * as Notifications from 'expo-notifications';

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
    console.log(`📱 SMS sent to: ${phone}`);
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

// In production, integrate with Twilio for SMS and SendGrid/AWS SES for email
export const sendSMS = async (phone: string, message: string): Promise<boolean> => {
  // TODO: Integrate Twilio API
  console.log(`SMS to ${phone}: ${message}`);
  return true;
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
