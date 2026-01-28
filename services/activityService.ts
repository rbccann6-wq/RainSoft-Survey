// Activity tracking service for monitoring employee activity
import { getSupabaseClient } from '@/template';
import AsyncStorage from '@react-native-async-storage/async-storage';
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
  storeName?: string; // Specific store name like "HOME DEPOT 0808"
}

export interface InactivitySettings {
  pushNotificationThreshold: number; // Minutes before sending push notification (default 15)
  smsEscalationThreshold: number; // Minutes before sending SMS (default 30)
  enabled: boolean;
}

// ============================================================
// COMPREHENSIVE INACTIVITY DETECTION
// Uses BOTH heartbeat tracking AND survey activity
// Detects: App exits, minimized apps, and actual work inactivity
// ============================================================

// COMPREHENSIVE: Check for inactive clocked-in users using heartbeat + survey activity
export const checkInactiveUsers = async (inactivityThresholdMinutes: number = 5): Promise<InactiveUser[]> => {
  try {
    const StorageService = require('@/services/storageService');
    
    // CRITICAL: Use local storage to get ALL data (synced and unsynced)
    const allTimeEntries = await StorageService.getTimeEntries();
    const allEmployees = await StorageService.getEmployees();
    const allSurveys = await StorageService.getSurveys();
    
    if (!allTimeEntries || !allEmployees) {
      return [];
    }
    
    // Filter for active time entries (clocked in, not clocked out)
    const activeEntries = allTimeEntries.filter(entry => !entry.clockOut);
    
    if (activeEntries.length === 0) {
      return [];
    }

    const today = new Date().toISOString().split('T')[0];
    const now = Date.now();
    const inactiveUsers: InactiveUser[] = [];

    // Check each clocked-in employee
    for (const entry of activeEntries) {
      // Find employee details from local storage
      const employee = allEmployees.find(emp => emp.id === entry.employeeId);
      if (!employee) continue;
      
      let lastActivityTime: number;
      let lastActivityAt: string;
      let activitySource = '';
      let isInSurveyKiosk = false;
      
      // PRIORITY 1: Check heartbeat activity (most recent indicator)
      // FIX: Use correct field names for local storage (camelCase)
      const { data: recentActivity } = await supabase
        .from('user_activity')
        .select('created_at, event_type, page_path, metadata')
        .eq('employee_id', entry.employeeId) // FIX: Use camelCase
        .eq('time_entry_id', entry.id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      
      if (recentActivity) {
        lastActivityTime = new Date(recentActivity.created_at).getTime();
        lastActivityAt = recentActivity.created_at;
        activitySource = 'heartbeat';
        // Check if user is in survey kiosk based on heartbeat page path
        isInSurveyKiosk = recentActivity.page_path === '/kiosk/survey';
      } else {
        // PRIORITY 2: Check survey activity (indicates actual work)
        const employeeSurveysToday = allSurveys.filter(s => 
          s.employeeId === entry.employeeId && 
          s.timestamp.startsWith(today)
        );
        
        if (employeeSurveysToday.length > 0) {
          const lastSurvey = employeeSurveysToday.sort((a, b) => 
            new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
          )[0];
          lastActivityTime = new Date(lastSurvey.timestamp).getTime();
          lastActivityAt = lastSurvey.timestamp;
          activitySource = 'survey';
          isInSurveyKiosk = false; // If using survey as source, no recent heartbeat means not in kiosk
        } else {
          // PRIORITY 3: No activity - use clock in time
          lastActivityTime = new Date(entry.clockIn).getTime();
          lastActivityAt = entry.clockIn;
          activitySource = 'clock_in';
          isInSurveyKiosk = false;
        }
      }
      
      // Calculate inactivity duration in minutes
      const inactiveDuration = Math.floor((now - lastActivityTime) / (1000 * 60));
      
      // DETECTION CONDITIONS:
      // 1. Employee explicitly exited kiosk mode
      const hasExitedKiosk = entry.isActiveInKiosk === false;
      
      // 2. No heartbeat in last 2 minutes (app not running or not in focus)
      const heartbeatTimeout = activitySource === 'heartbeat' && inactiveDuration >= 2;
      
      // 3. No heartbeat data at all (not in app)
      const notInApp = activitySource !== 'heartbeat';
      
      // 4. No surveys/activity for threshold duration
      const workInactive = inactiveDuration >= inactivityThresholdMinutes;
      
      // Mark as inactive if ANY condition is true
      if (hasExitedKiosk || heartbeatTimeout || notInApp || workInactive) {
        let reason = '';
        if (hasExitedKiosk) {
          reason = 'Exited kiosk mode';
        } else if (notInApp && !isInSurveyKiosk) {
          reason = `Not in app (${inactiveDuration}m)`;
        } else if (heartbeatTimeout) {
          reason = `App not in focus (${inactiveDuration}m)`;
        } else {
          reason = `No activity for ${inactiveDuration}m`;
        }
        
        inactiveUsers.push({
          employeeId: entry.employeeId,
          employeeName: `${employee.firstName} ${employee.lastName}`,
          timeEntryId: entry.id,
          lastActivityAt,
          inactiveDurationMinutes: inactiveDuration,
          currentPage: reason,
          store: entry.store,
          storeName: entry.storeName,
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
    const StorageService = require('@/services/storageService');
    const allSurveys = await StorageService.getSurveys();
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
    console.log(`🔄 Force clocking out time entry: ${timeEntryId}`);
    
    // CRITICAL FIX: Handle both database and local storage entries
    // First try to get the time entry from local storage (includes both synced and unsynced)
    const allTimeEntries = await StorageService.getTimeEntries();
    const timeEntry = allTimeEntries.find(entry => entry.id === timeEntryId);
    
    if (!timeEntry) {
      console.error('❌ Time entry not found:', timeEntryId);
      return false;
    }
    
    console.log('📝 Time entry found:', {
      id: timeEntry.id,
      employeeId: timeEntry.employeeId,
      isTemp: timeEntry.id.startsWith('temp_'),
    });
    
    // Check if this is a temporary (unsynced) entry
    const isLocalOnly = timeEntry.id.startsWith('temp_');
    
    if (isLocalOnly) {
      // Entry is still in local storage only - update it there
      console.log('📱 Updating local storage entry...');
      
      const updatedEntries = allTimeEntries.map(entry => {
        if (entry.id === timeEntryId) {
          return {
            ...entry,
            clockOut: new Date().toISOString(),
            isActiveInKiosk: false,
          };
        }
        return entry;
      });
      
      // Save back to local storage
      const KEYS = {
        LOCAL_TIME_ENTRIES: 'local_time_entries_failsafe',
      };
      await AsyncStorage.setItem(KEYS.LOCAL_TIME_ENTRIES, JSON.stringify(updatedEntries.filter(e => e.id.startsWith('temp_'))));
      console.log('✅ Local entry clocked out successfully');
    } else {
      // Entry exists in database - update it there
      console.log('☁️ Updating database entry...');
      
      const { error } = await supabase
        .from('time_entries')
        .update({
          clock_out: new Date().toISOString(),
          is_active_in_kiosk: false,
        })
        .eq('id', timeEntryId);

      if (error) {
        console.error('❌ Database update failed:', error);
        return false;
      }
      console.log('✅ Database entry clocked out successfully');
    }

    // Log the action
    await logInactivity(
      timeEntry.employeeId,
      timeEntryId,
      timeEntry.clockIn,
      0,
      undefined,
      'force_clocked_out',
      adminId,
      reason
    );

    console.log('✅ Force clock out completed');
    return true;
  } catch (error) {
    console.error('❌ Error force clocking out:', error);
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
