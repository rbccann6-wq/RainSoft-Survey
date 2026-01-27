// Activity tracking service for monitoring employee activity
import { getSupabaseClient } from '@/template';

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
  } catch (error) {
    console.error('Error logging activity:', error);
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

// Check for inactive clocked-in users (admin only)
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
      const isOnSurveyPage = lastActivity.page_path === '/kiosk/survey';
      const hasRecentProgress = lastActivity.event_type === 'survey_page_changed' && 
                                lastActivity.metadata?.surveyProgress === true;

      let shouldMarkInactive = false;
      let inactivityReason = '';

      if (!isOnSurveyPage && inactiveDuration >= inactivityThresholdMinutes) {
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
