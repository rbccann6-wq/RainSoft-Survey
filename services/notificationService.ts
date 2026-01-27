// Notification service for push notifications and SMS
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import { Platform } from 'react-native';
import { Employee, Alert, PushNotification, Message, Schedule } from '@/types';
import * as StorageService from './storageService';
import { getSupabaseClient } from '@/template';

const supabase = getSupabaseClient();

// Configure notification handler
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

// Request notification permissions
export async function requestNotificationPermissions(): Promise<boolean> {
  if (!Device.isDevice) {
    console.log('Notifications only work on physical devices');
    return false;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    console.log('Failed to get push notification permissions');
    return false;
  }

  // Configure push notification channel for Android
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.HIGH,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: '#0066CC',
    });
  }

  return true;
}

// Send local push notification
export async function sendLocalNotification(
  title: string,
  body: string,
  data?: any
): Promise<void> {
  try {
    await Notifications.scheduleNotificationAsync({
      content: {
        title,
        body,
        data,
        sound: true,
      },
      trigger: null, // Send immediately
    });
  } catch (error) {
    console.error('Error sending local notification:', error);
  }
}

// Notify managers about employee actions
export async function notifyManagers(
  managers: Employee[],
  title: string,
  body: string,
  actionType: 'clock_in' | 'clock_out' | 'break_start' | 'break_return'
): Promise<void> {
  // Send local push notifications
  await sendLocalNotification(title, body, { actionType });

  // Send SMS to managers (mock for now - will integrate with Twilio when backend is ready)
  await sendSMS(managers, body);
}

// Send SMS via Twilio Edge Function
async function sendSMS(managers: Employee[], message: string): Promise<void> {
  console.log('📱 Sending SMS to managers:');
  
  for (const manager of managers) {
    if (manager.phone) {
      try {
        const { data, error } = await supabase.functions.invoke('send-sms', {
          body: { to: manager.phone, message },
        });

        if (error) {
          console.error(`Failed to send SMS to ${manager.firstName}:`, error);
        } else if (data?.success) {
          console.log(`  ✅ ${manager.firstName} ${manager.lastName} (${manager.phone})`);
        }
      } catch (error) {
        console.error(`Error sending SMS to ${manager.firstName}:`, error);
      }
    }
  }
}

// ============================================================
// PUSH NOTIFICATION SYSTEM
// ============================================================

// Get push notification token for device
export async function registerForPushNotifications(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Push notifications only work on physical devices');
    return null;
  }

  const hasPermission = await requestNotificationPermissions();
  if (!hasPermission) {
    return null;
  }

  try {
    const token = (await Notifications.getExpoPushTokenAsync()).data;
    console.log('📱 Push notification token:', token);
    return token;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}

// Send push notification for new message
export async function notifyNewMessage(
  message: Message,
  recipients: Employee[]
): Promise<void> {
  const title = message.isGroupMessage 
    ? `📢 ${message.senderName} (Group)` 
    : `💬 ${message.senderName}`;
  
  const body = message.content.length > 100 
    ? message.content.substring(0, 100) + '...' 
    : message.content;

  try {
    await sendLocalNotification(title, body, {
      type: 'message',
      messageId: message.id,
      senderId: message.senderId,
    });
  } catch (error) {
    console.log('⚠️ Push notification unavailable:', error);
  }

  try {
    // Save push notification record
    await savePushNotificationRecord({
      id: Date.now().toString(),
      type: 'message',
      title,
      body,
      data: { messageId: message.id },
      sentTo: recipients.map(r => r.id),
      sentAt: new Date().toISOString(),
      deliveryStatus: {},
    });
  } catch (error) {
    console.log('⚠️ Failed to save notification record:', error);
  }
}

// Send push notification for schedule change
export async function notifyScheduleChange(
  employee: Employee,
  schedule: Schedule,
  changeType: 'created' | 'updated' | 'deleted'
): Promise<void> {
  const titles = {
    created: '📅 New Schedule',
    updated: '🔄 Schedule Updated',
    deleted: '❌ Schedule Removed',
  };

  const bodies = {
    created: `You have been scheduled for ${schedule.date} at ${schedule.store}`,
    updated: `Your schedule for ${schedule.date} has been updated`,
    deleted: `Your schedule for ${schedule.date} has been removed`,
  };

  const title = titles[changeType];
  const body = bodies[changeType];

  try {
    await sendLocalNotification(title, body, {
      type: 'schedule',
      scheduleId: schedule.id,
      changeType,
    });
  } catch (error) {
    console.log('⚠️ Push notification unavailable:', error);
  }

  try {
    // Save push notification record
    await savePushNotificationRecord({
      id: Date.now().toString(),
      type: 'schedule',
      title,
      body,
      data: { scheduleId: schedule.id, changeType },
      sentTo: [employee.id],
      sentAt: new Date().toISOString(),
      deliveryStatus: {},
    });
  } catch (error) {
    console.log('⚠️ Failed to save notification record:', error);
  }
}

// Send urgent alert from managers
export async function sendUrgentAlert(
  alert: Alert,
  recipients: Employee[]
): Promise<void> {
  const priorityIcons = {
    low: 'ℹ️',
    medium: '⚠️',
    high: '🔔',
    urgent: '🚨',
  };

  const title = `${priorityIcons[alert.priority]} ${alert.title}`;
  const body = alert.message;

  try {
    // Try to send push notification (may fail on web platform)
    await sendLocalNotification(title, body, {
      type: 'alert',
      alertId: alert.id,
      priority: alert.priority,
    });
    console.log('✅ Push notification sent successfully');
  } catch (error) {
    // Push notifications may not work on web - this is expected
    console.log('⚠️ Push notification unavailable (likely web platform):', error);
  }

  try {
    // Save push notification record
    await savePushNotificationRecord({
      id: Date.now().toString(),
      type: 'alert',
      title,
      body,
      data: { alertId: alert.id, priority: alert.priority },
      sentTo: recipients.map(r => r.id),
      sentAt: new Date().toISOString(),
      deliveryStatus: {},
    });
    console.log('✅ Notification record saved');
  } catch (error) {
    console.log('⚠️ Failed to save notification record:', error);
  }
}

// Save push notification record to storage
async function savePushNotificationRecord(notification: PushNotification): Promise<void> {
  const notifications = await StorageService.getData<PushNotification[]>('push_notifications') || [];
  notifications.push(notification);
  await StorageService.saveData('push_notifications', notifications);
}

// Get all push notification records
export async function getPushNotifications(): Promise<PushNotification[]> {
  return await StorageService.getData<PushNotification[]>('push_notifications') || [];
}

// Employee action notifications
export async function notifyClockIn(
  employee: Employee,
  store: string,
  managers: Employee[]
): Promise<void> {
  const title = '🟢 Employee Clocked In';
  const body = `${employee.firstName} ${employee.lastName} clocked in at ${store}`;
  await notifyManagers(managers, title, body, 'clock_in');
}

export async function notifyClockOut(
  employee: Employee,
  hoursWorked: number,
  surveysCompleted: number,
  managers: Employee[]
): Promise<void> {
  const title = '🔴 Employee Clocked Out';
  const body = `${employee.firstName} ${employee.lastName} clocked out - ${hoursWorked.toFixed(1)}hrs, ${surveysCompleted} surveys`;
  await notifyManagers(managers, title, body, 'clock_out');
}

export async function notifyBreakStart(
  employee: Employee,
  managers: Employee[]
): Promise<void> {
  const title = '⏸️ Employee On Break';
  const body = `${employee.firstName} ${employee.lastName} started a break`;
  await notifyManagers(managers, title, body, 'break_start');
}

export async function notifyBreakReturn(
  employee: Employee,
  store: string,
  managers: Employee[]
): Promise<void> {
  const title = '▶️ Employee Returned';
  const body = `${employee.firstName} ${employee.lastName} returned from break at ${store}`;
  await notifyManagers(managers, title, body, 'break_return');
}
