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

// HEARTBEAT TRACKING: Detects inactivity based on 5 consecutive missed checks (5 minutes)
const HEARTBEAT_INTERVAL = 60000; // 60 seconds
const INACTIVITY_THRESHOLD = 5; // 5 consecutive misses = 5 minutes
const heartbeatTracking = new Map<string, { lastHeartbeat: number; missedChecks: number }>();

// Log activity event to database
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
    
    // Update heartbeat tracking
    recordHeartbeat(event.employeeId);
  } catch (error) {
    console.error('Error logging activity:', error);
  }
};

// Record heartbeat for an employee (called when activity is logged)
const recordHeartbeat = (employeeId: string): void => {
  heartbeatTracking.set(employeeId, {
    lastHeartbeat: Date.now(),
    missedChecks: 0,
  });
};

// Check heartbeat status (called every 60 seconds)
export const checkHeartbeats = async (): Promise<void> => {
  const now = Date.now();
  const employees = Array.from(heartbeatTracking.entries());
  
  for (const [employeeId, tracking] of employees) {
    const timeSinceLastHeartbeat = now - tracking.lastHeartbeat;
    
    // If more than 60 seconds since last heartbeat, increment missed checks
    if (timeSinceLastHeartbeat > HEARTBEAT_INTERVAL) {
      tracking.missedChecks++;
      
      // If 5 consecutive misses (5 minutes), mark as inactive
      if (tracking.missedChecks >= INACTIVITY_THRESHOLD) {
        console.log(`⚠️ Employee ${employeeId} inactive for ${tracking.missedChecks} minutes`);
        // Keep tracking but don't increment further until they become active again
      }
    }
  }
};

// Get employees who have missed 5+ heartbeats
export const getInactiveEmployeesByHeartbeat = (): string[] => {
  const inactive: string[] = [];
  
  for (const [employeeId, tracking] of heartbeatTracking.entries()) {
    if (tracking.missedChecks >= INACTIVITY_THRESHOLD) {
      inactive.push(employeeId);
    }
  }
  
  return inactive;
};

// Start heartbeat monitoring (call this once when app starts)
let heartbeatInterval: NodeJS.Timeout | null = null;

export const startHeartbeatMonitoring = (): void => {
  if (heartbeatInterval) {
    console.log('⚠️ Heartbeat monitoring already running');
    return;
  }
  
  console.log('🫀 Starting heartbeat monitoring (checks every 60s, 5 consecutive misses = inactive)');
  
  heartbeatInterval = setInterval(() => {
    checkHeartbeats();
  }, HEARTBEAT_INTERVAL);
};

export const stopHeartbeatMonitoring = (): void => {
  if (heartbeatInterval) {
    clearInterval(heartbeatInterval);
    heartbeatInterval = null;
    console.log('⏹️ Heartbeat monitoring stopped');
  }
};

// Get last activity for an employee
export const getLastActivity = async (employeeId: string): Promise<Date | null> => {
  try {
    const { data, error } = await supabase
      .from('user_activity')
      .select('created_at')
      .eq('employee_id', employeeId)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error || !data) {
      return null;
    }

    return new Date(data.created_at);
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

// Check for inactive clocked-in users (admin only) - Enhanced with heartbeat integration
export const checkInactiveUsers = async (inactivityThresholdMinutes: number = 5): Promise<InactiveUser[]> => {
  try {
    // Get all active time entries (clocked in, not clocked out)
    const { data: activeEntries, error: entriesError } = await supabase
      .from('time_entries')
      .select(`
        id,
        employee_id,
        store,
        clock_in,
        is_active_in_kiosk,
        employees!inner(id, first_name, last_name)
      `)
      .is('clock_out', null);

    if (entriesError || !activeEntries || activeEntries.length === 0) {
      return [];
    }

    const inactiveUsers: InactiveUser[] = [];
    const now = new Date();

    // Check each clocked-in employee's last activity
    for (const entry of activeEntries) {
      // Get last activity
      const { data: lastActivity, error: activityError } = await supabase
        .from('user_activity')
        .select('created_at, page_path, event_type, metadata')
        .eq('employee_id', entry.employee_id)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();

      if (activityError || !lastActivity) {
        // No activity recorded - assume inactive since clock in
        const clockInTime = new Date(entry.clock_in);
        const inactiveDuration = Math.floor((now.getTime() - clockInTime.getTime()) / (1000 * 60));

        if (inactiveDuration >= inactivityThresholdMinutes) {
          inactiveUsers.push({
            employeeId: entry.employee_id,
            employeeName: `${(entry.employees as any).first_name} ${(entry.employees as any).last_name}`,
            timeEntryId: entry.id,
            lastActivityAt: entry.clock_in,
            inactiveDurationMinutes: inactiveDuration,
            currentPage: undefined,
            store: entry.store,
          });
        }
        continue;
      }

      const lastActivityTime = new Date(lastActivity.created_at);
      const inactiveDuration = Math.floor((now.getTime() - lastActivityTime.getTime()) / (1000 * 60));

      // Check if user is inactive based on:
      // 1. Not on kiosk survey page for 5+ minutes
      // 2. OR on kiosk survey page but no survey progress (no question changes) for 5+ minutes
      // NEW LOGIC: Check heartbeat first (5 consecutive missed checks = inactive)
      const heartbeatStatus = heartbeatTracking.get(entry.employee_id);
      const isInactiveByHeartbeat = heartbeatStatus && heartbeatStatus.missedChecks >= INACTIVITY_THRESHOLD;
      
      const isOnSurveyPage = lastActivity.page_path === '/kiosk/survey';
      const hasRecentProgress = lastActivity.event_type === 'survey_page_changed' && 
                                lastActivity.metadata?.surveyProgress === true;

      let shouldMarkInactive = false;
      let inactivityReason = '';
      
      // Priority 1: Heartbeat detection (most reliable - based on app activity)
      if (isInactiveByHeartbeat) {
        shouldMarkInactive = true;
        inactivityReason = 'No heartbeat activity for 5+ minutes';
      }
      // Priority 2: Traditional checks (fallback if heartbeat not available)
      else if (!isOnSurveyPage && inactiveDuration >= inactivityThresholdMinutes) {
        // Not on survey page and inactive for threshold
        shouldMarkInactive = true;
        inactivityReason = 'Not on survey kiosk page';
      } else if (isOnSurveyPage && !hasRecentProgress && inactiveDuration >= inactivityThresholdMinutes) {
        // On survey page but no progress (stuck on same question)
        shouldMarkInactive = true;
        inactivityReason = 'No survey progress';
      } else if (entry.is_active_in_kiosk === false) {
        // Manually marked as inactive
        shouldMarkInactive = true;
        inactivityReason = 'Marked inactive by system';
      }

      if (shouldMarkInactive) {
        inactiveUsers.push({
          employeeId: entry.employee_id,
          employeeName: `${(entry.employees as any).first_name} ${(entry.employees as any).last_name}`,
          timeEntryId: entry.id,
          lastActivityAt: lastActivity.created_at,
          inactiveDurationMinutes: inactiveDuration,
          currentPage: lastActivity.page_path,
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
    
    // Get all inactive users (using enhanced heartbeat detection)
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
