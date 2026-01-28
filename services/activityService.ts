// Activity tracking service for monitoring employee activity
import { getSupabaseClient } from '@/template';
import * as StorageService from './storageService';
import * as NotificationService from './notificationService';
import { Employee } from '@/types';

const supabase = getSupabaseClient();

export interface ActivityEvent {
  employeeId: string;
  timeEntryId?: string;
  eventType: 'app_heartbeat' | 'survey_started' | 'survey_page_changed' | 'survey_submitted' | 'page_view' | 'kiosk_exited' | 'survey_inactivity_detected';
  pagePath?: string;
  isPageVisible?: boolean;
  metadata?: any;
}

export interface InactiveUser {
  employeeId: string;
  employeeName: string;
  timeEntryId: string;
  lastActivityAt: string;
  inactiveDurationMinutes: number;
  currentPage?: string;
  store?: string;
}

export interface InactivitySettings {
  pushNotificationThreshold: number; // Minutes before sending push notification (default 15)
  smsEscalationThreshold: number; // Minutes before sending SMS (default 30)
  enabled: boolean;
}

// ============================================================
// SIMPLIFIED INACTIVITY DETECTION - ONE SOURCE OF TRUTH
// Uses last survey time as the reliable indicator of activity
// ============================================================

// SIMPLIFIED & RELIABLE: Check for inactive clocked-in users based on last survey time
export const checkInactiveUsers = async (inactivityThresholdMinutes: number = 5): Promise<InactiveUser[]> => {
  try {
    const { getSurveys } = require('@/services/storageService');
    
    // Get all active time entries (clocked in, not clocked out)
    const { data: activeEntries, error: entriesError } = await supabase
      .from('time_entries')
      .select(`
        id,
        employee_id,
        store,
        clock_in,
        employees!inner(id, first_name, last_name)
      `)
      .is('clock_out', null);

    if (entriesError || !activeEntries || activeEntries.length === 0) {
      return [];
    }

    const allSurveys = await getSurveys();
    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();
    const inactiveUsers: InactiveUser[] = [];

    // Check each clocked-in employee
    for (const entry of activeEntries) {
      // Find employee's surveys today
      const employeeSurveysToday = allSurveys.filter(s => 
        s.employeeId === entry.employee_id && 
        s.timestamp.startsWith(today)
      );
      
      // Determine last activity time
      let lastActivityTime: number;
      let lastActivityAt: string;
      
      if (employeeSurveysToday.length > 0) {
        // Use last survey time as last activity
        const lastSurvey = employeeSurveysToday.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];
        lastActivityTime = new Date(lastSurvey.timestamp).getTime();
        lastActivityAt = lastSurvey.timestamp;
      } else {
        // No surveys - use clock in time as last activity
        lastActivityTime = new Date(entry.clock_in).getTime();
        lastActivityAt = entry.clock_in;
      }
      
      // Calculate inactivity duration in minutes
      const inactiveDuration = Math.floor((now - lastActivityTime) / (1000 * 60));
      
      // Check if employee is inactive based on threshold
      if (inactiveDuration >= inactivityThresholdMinutes) {
        inactiveUsers.push({
          employeeId: entry.employee_id,
          employeeName: `${(entry.employees as any).first_name} ${(entry.employees as any).last_name}`,
          timeEntryId: entry.id,
          lastActivityAt,
          inactiveDurationMinutes: inactiveDuration,
          currentPage: employeeSurveysToday.length === 0 ? 'No surveys today' : undefined,
          store: entry.store,
        });
      }
    }

    return inactiveUsers;
  } catch (error) {
    console.error('Error checking inactive users:', error);
    return [];
  }
};

// Get last activity for an employee
export const getLastActivity = async (employeeId: string): Promise<Date | null> => {
  try {
    const { getSurveys } = require('@/services/storageService');
    const allSurveys = await getSurveys();
    const today = new Date().toISOString().split('T')[0];
    
    const employeeSurveysToday = allSurveys.filter(s => 
      s.employeeId === employeeId && 
      s.timestamp.startsWith(today)
    );
    
    if (employeeSurveysToday.length > 0) {
      const lastSurvey = employeeSurveysToday.sort((a, b) => 
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )[0];
      return new Date(lastSurvey.timestamp);
    }
    
    return null;
  } catch (error) {
    console.error('Error getting last activity:', error);
    return null;
  }
};

// Get inactivity settings
export const getInactivitySettings = async (): Promise<InactivitySettings> => {
  const settings = await StorageService.getData<InactivitySettings>('inactivity_alert_settings');
  return settings || {
    pushNotificationThreshold: 15,
    smsEscalationThreshold: 30,
    enabled: true,
  };
};

// Save inactivity settings
export const saveInactivitySettings = async (settings: InactivitySettings): Promise<void> => {
  await StorageService.saveData('inactivity_alert_settings', settings);
};

// Log inactivity detection
export const logInactivity = async (
  employeeId: string,
  timeEntryId: string,
  lastActivityAt: string,
  inactiveDurationMinutes: number,
  currentPage?: string,
  actionTaken?: string,
  adminId?: string,
  notes?: string
): Promise<void> => {
  try {
    const { error } = await supabase
      .from('inactivity_log')
      .insert([{
        employee_id: employeeId,
        time_entry_id: timeEntryId,
        last_activity_at: lastActivityAt,
        inactive_duration_minutes: inactiveDurationMinutes,
        current_page: currentPage,
        action_taken: actionTaken,
        admin_id: adminId,
        notes: notes,
      }]);

    if (error) {
      console.error('Failed to log inactivity:', error);
    }
  } catch (error) {
    console.error('Error logging inactivity:', error);
  }
};

// Force clock out an inactive user (admin only)
export const forceClockOut = async (
  timeEntryId: string,
  adminId: string,
  reason: string
): Promise<boolean> => {
  try {
    const { error } = await supabase
      .from('time_entries')
      .update({
        clock_out: new Date().toISOString(),
        is_active_in_kiosk: false,
      })
      .eq('id', timeEntryId);

    if (error) {
      console.error('Failed to force clock out:', error);
      return false;
    }

    // Log the action
    const { data: timeEntry } = await supabase
      .from('time_entries')
      .select('employee_id, clock_in')
      .eq('id', timeEntryId)
      .single();

    if (timeEntry) {
      await logInactivity(
        timeEntry.employee_id,
        timeEntryId,
        timeEntry.clock_in,
        0,
        undefined,
        'force_clocked_out',
        adminId,
        reason
      );
    }

    return true;
  } catch (error) {
    console.error('Error force clocking out:', error);
    return false;
  }
};

// Get inactivity logs (admin only)
export const getInactivityLogs = async (limit: number = 50): Promise<any[]> => {
  try {
    const { data, error } = await supabase
      .from('inactivity_log')
      .select(`
        *,
        employees!inactivity_log_employee_id_fkey(first_name, last_name),
        admins:employees!inactivity_log_admin_id_fkey(first_name, last_name)
      `)
      .order('detected_at', { ascending: false })
      .limit(limit);

    if (error) {
      console.error('Error fetching inactivity logs:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error getting inactivity logs:', error);
    return [];
  }
};

// AUTOMATIC INACTIVITY ALERTS: Check all clocked-in employees and send alerts
let alertInterval: NodeJS.Timeout | null = null;
const notifiedEmployees = new Map<string, { push: boolean; sms: boolean }>();

export const startInactivityAlerts = async (): Promise<void> => {
  if (alertInterval) {
    console.log('⚠️ Inactivity alerts already running');
    return;
  }
  
  const settings = await getInactivitySettings();
  if (!settings.enabled) {
    console.log('ℹ️ Inactivity alerts disabled in settings');
    return;
  }
  
  console.log(`🔔 Starting automatic inactivity alerts (Push: ${settings.pushNotificationThreshold}min, SMS: ${settings.smsEscalationThreshold}min)`);
  
  // Check every 60 seconds
  alertInterval = setInterval(async () => {
    await checkAndSendInactivityAlerts();
  }, 60000);
  
  // Initial check
  await checkAndSendInactivityAlerts();
};

export const stopInactivityAlerts = (): void => {
  if (alertInterval) {
    clearInterval(alertInterval);
    alertInterval = null;
    notifiedEmployees.clear();
    console.log('⏹️ Inactivity alerts stopped');
  }
};

// Check and send inactivity alerts to admins
const checkAndSendInactivityAlerts = async (): Promise<void> => {
  try {
    const settings = await getInactivitySettings();
    if (!settings.enabled) return;
    
    // Get all inactive users (using simplified detection)
    const inactiveUsers = await checkInactiveUsers(5); // 5 min threshold for detection
    
    if (inactiveUsers.length === 0) {
      // Clear notifications when no one is inactive
      notifiedEmployees.clear();
      return;
    }
    
    // Get all admin/manager employees
    const employees = await StorageService.getEmployees();
    const managers = employees.filter(e => e.role === 'admin' || e.role === 'manager');
    
    if (managers.length === 0) {
      console.log('⚠️ No managers to notify about inactivity');
      return;
    }
    
    for (const inactiveUser of inactiveUsers) {
      const employeeData = employees.find(e => e.id === inactiveUser.employeeId);
      if (!employeeData) continue;
      
      const notifications = notifiedEmployees.get(inactiveUser.employeeId) || { push: false, sms: false };
      
      // Send push notification at threshold (e.g., 15 minutes)
      if (!notifications.push && inactiveUser.inactiveDurationMinutes >= settings.pushNotificationThreshold) {
        await sendInactivityPushNotification(employeeData, inactiveUser, managers);
        notifications.push = true;
        notifiedEmployees.set(inactiveUser.employeeId, notifications);
        
        // Log inactivity
        await logInactivity(
          inactiveUser.employeeId,
          inactiveUser.timeEntryId,
          inactiveUser.lastActivityAt,
          inactiveUser.inactiveDurationMinutes,
          inactiveUser.currentPage,
          'push_notification_sent',
          undefined,
          `Automatic push notification sent to managers at ${inactiveUser.inactiveDurationMinutes} minutes`
        );
      }
      
      // Escalate to SMS at higher threshold (e.g., 30 minutes)
      if (!notifications.sms && inactiveUser.inactiveDurationMinutes >= settings.smsEscalationThreshold) {
        await sendInactivitySMSEscalation(employeeData, inactiveUser, managers);
        notifications.sms = true;
        notifiedEmployees.set(inactiveUser.employeeId, notifications);
        
        // Log escalation
        await logInactivity(
          inactiveUser.employeeId,
          inactiveUser.timeEntryId,
          inactiveUser.lastActivityAt,
          inactiveUser.inactiveDurationMinutes,
          inactiveUser.currentPage,
          'sms_escalation_sent',
          undefined,
          `Automatic SMS escalation sent to managers at ${inactiveUser.inactiveDurationMinutes} minutes`
        );
      }
    }
  } catch (error) {
    console.error('❌ Error checking inactivity alerts:', error);
  }
};

// Send push notification to managers about inactive employee
const sendInactivityPushNotification = async (
  employee: Employee,
  inactiveInfo: InactiveUser,
  managers: Employee[]
): Promise<void> => {
  const title = '⏸️ Employee Inactive';
  const body = `${employee.firstName} ${employee.lastName} has been inactive for ${inactiveInfo.inactiveDurationMinutes} minutes at ${inactiveInfo.store === 'lowes' ? 'Lowes' : 'Home Depot'}`;
  
  console.log(`📱 Sending inactivity push notification: ${employee.firstName} ${employee.lastName} (${inactiveInfo.inactiveDurationMinutes}min)`);
  
  // Send local push notifications to all managers
  for (const manager of managers) {
    const shouldNotify = await NotificationService.shouldSendPushNotification(
      manager.id,
      'inactivityAlerts',
      'inactive'
    );
    
    if (shouldNotify) {
      await NotificationService.sendLocalNotification(title, body, {
        type: 'inactivity_alert',
        employeeId: employee.id,
        inactiveDuration: inactiveInfo.inactiveDurationMinutes,
      });
    }
  }
};

// Send SMS escalation to managers about prolonged inactivity
const sendInactivitySMSEscalation = async (
  employee: Employee,
  inactiveInfo: InactiveUser,
  managers: Employee[]
): Promise<void> => {
  const storeName = inactiveInfo.store === 'lowes' ? 'Lowes' : 'Home Depot';
  const smsBody = `🚨 URGENT: ${employee.firstName} ${employee.lastName} has been INACTIVE for ${inactiveInfo.inactiveDurationMinutes} minutes at ${storeName}. Please check on them immediately.`;
  
  console.log(`📲 Sending inactivity SMS escalation: ${employee.firstName} ${employee.lastName} (${inactiveInfo.inactiveDurationMinutes}min)`);
  
  // Send SMS to managers who have SMS enabled for inactivity alerts
  for (const manager of managers) {
    const shouldSMS = await NotificationService.shouldSendSMS(manager.id, 'inactiveEmployee');
    
    if (shouldSMS && manager.phone) {
      try {
        const { data, error } = await supabase.functions.invoke('send-sms', {
          body: { to: manager.phone, message: smsBody },
        });

        if (error) {
          console.error(`Failed to send SMS to ${manager.firstName}:`, error);
        } else if (data?.success) {
          console.log(`  ✅ SMS sent to ${manager.firstName} ${manager.lastName}`);
        }
      } catch (error) {
        console.error(`Error sending SMS to ${manager.firstName}:`, error);
      }
    }
  }
};

// Log activity event to database (kept for backward compatibility, but not used for inactivity detection)
export const logActivity = async (event: ActivityEvent): Promise<void> => {
  try {
    const { error } = await supabase
      .from('user_activity')
      .insert([{
        employee_id: event.employeeId,
        time_entry_id: event.timeEntryId,
        event_type: event.eventType,
        page_path: event.pagePath,
        is_page_visible: event.isPageVisible,
        metadata: event.metadata,
      }]);

    if (error) {
      console.error('Failed to log activity:', error);
    }
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// REMOVED: Heartbeat tracking - Not reliable, causes confusion
// REMOVED: checkHeartbeats - Not needed with simplified detection
// REMOVED: startHeartbeatMonitoring - Not needed
// REMOVED: stopHeartbeatMonitoring - Not needed
// REMOVED: getInactiveEmployeesByHeartbeat - Not needed
