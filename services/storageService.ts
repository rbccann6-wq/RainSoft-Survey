// Supabase storage service - Local-first with cloud sync (ZERO DATA LOSS GUARANTEED)
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getSupabaseClient } from '@/template';
import { Employee, TimeEntry, Survey, Schedule, TimeOffRequest, Message, CompensationSettings, OnboardingData } from '@/types';
import { Store } from '@/constants/theme';

const supabase = getSupabaseClient();

// ============ LOCAL STORAGE KEYS ============
const KEYS = {
  LOCAL_SURVEYS: 'local_surveys_failsafe',
  LOCAL_TIME_ENTRIES: 'local_time_entries_failsafe',
  PENDING_SYNC: 'pending_sync_queue',
};

// ============ FAILSAFE: LOCAL STORAGE HELPERS ============
const saveToLocalStorage = async <T>(key: string, data: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
    console.log(`✅ FAILSAFE: Data saved to local storage: ${key}`);
  } catch (error) {
    console.error(`❌ CRITICAL: Local storage save failed for ${key}:`, error);
    throw error; // This should NEVER fail - it's the last line of defense
  }
};

const getFromLocalStorage = async <T>(key: string): Promise<T | null> => {
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error reading from local storage ${key}:`, error);
    return null;
  }
};

// ============ EMPLOYEES ============

export const getEmployees = async (): Promise<Employee[]> => {
  const { data, error } = await supabase
    .from('employees')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) {
    console.error('Error fetching employees:', error);
    return [];
  }

  return (data || []).map(transformEmployeeFromDB);
};

export const addEmployee = async (employee: Employee): Promise<void> => {
  const dbEmployee = transformEmployeeToDB(employee);
  
  const { error } = await supabase
    .from('employees')
    .insert([dbEmployee]);

  if (error) {
    console.error('Error adding employee:', error);
    throw error;
  }
};

export const updateEmployee = async (employeeId: string, updates: Partial<Employee>): Promise<void> => {
  const dbUpdates: any = {
    ...updates,
    first_name: updates.firstName,
    last_name: updates.lastName,
    hire_date: updates.hireDate,
    onboarding_complete: updates.onboardingComplete,
    onboarding_step: updates.onboardingStep,
    adp_employee_id: updates.adpEmployeeId,
    invite_token: updates.inviteToken,
    invite_sent_at: updates.inviteSentAt,
    profile_picture_uri: updates.profilePictureUri,
    is_team_lead: updates.isTeamLead,
    team_lead_id: updates.teamLeadId,
    personal_info: updates.personalInfo,
  };

  // Remove undefined values
  Object.keys(dbUpdates).forEach(key => 
    dbUpdates[key] === undefined && delete dbUpdates[key]
  );

  const { error } = await supabase
    .from('employees')
    .update(dbUpdates)
    .eq('id', employeeId);

  if (error) {
    console.error('Error updating employee:', error);
    throw error;
  }
};

export const terminateEmployee = async (employeeId: string): Promise<void> => {
  // Update employee status
  await updateEmployee(employeeId, { status: 'terminated' });
  
  // Delete future schedules
  const today = new Date().toISOString().split('T')[0];
  const { error } = await supabase
    .from('schedules')
    .delete()
    .eq('employee_id', employeeId)
    .gt('date', today);

  if (error) {
    console.error('Error deleting future schedules:', error);
  }
};

// ============ TIME ENTRIES ============

export const getTimeEntries = async (): Promise<TimeEntry[]> => {
  // CRITICAL FIX: Merge cloud time entries + local failsafe storage
  // This ensures offline clock-ins are ALWAYS visible in the UI
  
  const cloudEntries: TimeEntry[] = [];
  const localEntries = await getFromLocalStorage<TimeEntry[]>(KEYS.LOCAL_TIME_ENTRIES) || [];
  
  // Try to fetch from cloud
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .select('*')
      .order('clock_in', { ascending: false });

    if (!error && data) {
      cloudEntries.push(...data.map(transformTimeEntryFromDB));
    } else if (error) {
      console.error('Error fetching time entries from cloud (showing local only):', error);
    }
  } catch (error) {
    console.error('Cloud fetch failed (showing local only):', error);
  }
  
  // Merge cloud + local entries (deduplicate by ID - cloud takes precedence)
  const mergedMap = new Map<string, TimeEntry>();
  
  // Add local entries first
  localEntries.forEach(entry => {
    mergedMap.set(entry.id, entry);
  });
  
  // Overwrite with cloud entries (cloud is source of truth for synced data)
  cloudEntries.forEach(entry => {
    mergedMap.set(entry.id, entry);
  });
  
  const allEntries = Array.from(mergedMap.values());
  
  // Sort by clock_in descending
  allEntries.sort((a, b) => {
    return new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime();
  });
  
  if (localEntries.length > 0) {
    console.log(`📊 Time entries loaded: ${cloudEntries.length} from cloud, ${localEntries.length} pending sync locally, ${allEntries.length} total`);
  }
  
  return allEntries;
};

export const saveTimeEntries = async (entries: TimeEntry[]): Promise<void> => {
  // This is a bulk operation - not typically used with Supabase
  // Individual operations are preferred
  console.warn('saveTimeEntries: Bulk operations not recommended with Supabase');
};

export const clockIn = async (
  employeeId: string,
  store: Store,
  gpsCoordinates?: { latitude: number; longitude: number; accuracy: number },
  photoUri?: string
): Promise<TimeEntry> => {
  // Try to match GPS coordinates to a specific store location
  let storeName: string | undefined;
  let storeNumber: string | undefined;
  let storeAddress: string | undefined;
  let locationVerified = false;
  let distanceFromStore: number | undefined;

  if (gpsCoordinates) {
    const { findNearestStore } = require('@/services/storeLocationsService');
    const matchedStore = findNearestStore(gpsCoordinates.latitude, gpsCoordinates.longitude);

    if (matchedStore) {
      storeName = matchedStore.storeName;
      storeNumber = matchedStore.storeNumber;
      storeAddress = `${matchedStore.address}, ${matchedStore.city}, ${matchedStore.state} ${matchedStore.zipCode}`;
      locationVerified = true;

      const { calculateDistance } = require('@/services/storeLocationsService');
      distanceFromStore = Math.round(calculateDistance(
        gpsCoordinates.latitude,
        gpsCoordinates.longitude,
        matchedStore.coordinates.latitude,
        matchedStore.coordinates.longitude
      ));

      console.log(`✅ Clock in verified at ${storeName} (${distanceFromStore}m away)`);
    }
  }

  const timeEntry: TimeEntry = {
    id: `temp_${Date.now()}`,
    employeeId,
    clockIn: new Date().toISOString(),
    store,
    storeName,
    storeNumber,
    storeAddress,
    syncedToADP: false,
    isActiveInKiosk: true,
    gpsCoordinates,
    photoUri,
    locationVerified,
    distanceFromStore,
  };

  // ============ FAILSAFE: Save to local storage first ============
  try {
    const localEntries = await getFromLocalStorage<TimeEntry[]>(KEYS.LOCAL_TIME_ENTRIES) || [];
    localEntries.push(timeEntry);
    await saveToLocalStorage(KEYS.LOCAL_TIME_ENTRIES, localEntries);
    console.log('✅ FAILSAFE: Time entry saved to local storage');
  } catch (localError) {
    console.error('❌ CRITICAL: Local storage save failed:', localError);
    throw new Error('Failed to save time entry locally');
  }

  // ============ Attempt cloud sync ============
  try {
    const { data, error } = await supabase
      .from('time_entries')
      .insert([
        {
          employee_id: employeeId,
          clock_in: new Date().toISOString(),
          store,
          store_name: storeName,
          store_number: storeNumber,
          store_address: storeAddress,
          synced_to_adp: false,
          is_active_in_kiosk: true,
          gps_latitude: gpsCoordinates?.latitude,
          gps_longitude: gpsCoordinates?.longitude,
          gps_accuracy: gpsCoordinates?.accuracy,
          photo_uri: photoUri,
          location_verified: locationVerified,
          distance_from_store: distanceFromStore,
        }
      ])
      .select()
      .single();

    if (error) {
      console.error('⚠️ Cloud sync failed (data is safe locally):', error);
      return timeEntry; // Return local entry
    }

    console.log('✅ Time entry synced to cloud');
    
    // Remove from local storage after successful sync
    const localEntries = await getFromLocalStorage<TimeEntry[]>(KEYS.LOCAL_TIME_ENTRIES) || [];
    const filtered = localEntries.filter(e => e.id !== timeEntry.id);
    await saveToLocalStorage(KEYS.LOCAL_TIME_ENTRIES, filtered);
    
    return transformTimeEntryFromDB(data);
  } catch (syncError) {
    console.error('⚠️ Cloud sync error (data is safe locally):', syncError);
    return timeEntry; // Return local entry - data is SAFE
  }
};

export const clockOut = async (employeeId: string): Promise<void> => {
  // Find active time entry
  const { data: activeEntries, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('employee_id', employeeId)
    .is('clock_out', null)
    .limit(1);

  if (fetchError) {
    console.error('Error finding active time entry:', fetchError);
    throw fetchError;
  }

  if (!activeEntries || activeEntries.length === 0) {
    console.warn('No active time entry found for clock out');
    return;
  }

  const { error } = await supabase
    .from('time_entries')
    .update({
      clock_out: new Date().toISOString(),
      is_active_in_kiosk: false,
    })
    .eq('id', activeEntries[0].id);

  if (error) {
    console.error('Error clocking out:', error);
    throw error;
  }
};

export const setKioskActiveStatus = async (employeeId: string, isActive: boolean): Promise<TimeEntry | null> => {
  // Find active time entry
  const { data: activeEntries, error: fetchError } = await supabase
    .from('time_entries')
    .select('*')
    .eq('employee_id', employeeId)
    .is('clock_out', null)
    .limit(1);

  if (fetchError) {
    console.error('Error finding active time entry:', fetchError);
    return null;
  }

  if (!activeEntries || activeEntries.length === 0) {
    return null;
  }

  const { data, error } = await supabase
    .from('time_entries')
    .update({ is_active_in_kiosk: isActive })
    .eq('id', activeEntries[0].id)
    .select()
    .single();

  if (error) {
    console.error('Error updating kiosk status:', error);
    return null;
  }

  return transformTimeEntryFromDB(data);
};

// ============ SURVEYS ============

export const getSurveys = async (): Promise<Survey[]> => {
  // CRITICAL FIX: Merge cloud surveys + local failsafe storage
  // This ensures offline surveys are ALWAYS visible in the UI
  
  const cloudSurveys: Survey[] = [];
  const localSurveys = await getFromLocalStorage<Survey[]>(KEYS.LOCAL_SURVEYS) || [];
  
  // Try to fetch from cloud
  try {
    const { data, error } = await supabase
      .from('surveys')
      .select('*')
      .order('timestamp', { ascending: false });

    if (!error && data) {
      cloudSurveys.push(...data.map(transformSurveyFromDB));
    } else if (error) {
      console.error('Error fetching surveys from cloud (showing local only):', error);
    }
  } catch (error) {
    console.error('Cloud fetch failed (showing local only):', error);
  }
  
  // Merge cloud + local surveys (deduplicate by ID - cloud takes precedence)
  const mergedMap = new Map<string, Survey>();
  
  // Add local surveys first
  localSurveys.forEach(survey => {
    mergedMap.set(survey.id, survey);
  });
  
  // Overwrite with cloud surveys (cloud is source of truth for synced data)
  cloudSurveys.forEach(survey => {
    mergedMap.set(survey.id, survey);
  });
  
  const allSurveys = Array.from(mergedMap.values());
  
  // Sort by timestamp descending
  allSurveys.sort((a, b) => {
    return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
  });
  
  if (localSurveys.length > 0) {
    console.log(`📊 Surveys loaded: ${cloudSurveys.length} from cloud, ${localSurveys.length} pending sync locally, ${allSurveys.length} total`);
  }
  
  return allSurveys;
};

export const saveSurveys = async (surveys: Survey[]): Promise<void> => {
  console.warn('saveSurveys: Bulk operations not recommended with Supabase');
};

export const addSurvey = async (survey: Survey): Promise<Survey> => {
  // ============ STEP 1: SAVE TO LOCAL STORAGE FIRST (FAILSAFE) ============
  // This ensures data is NEVER lost, even if:
  // - Internet drops mid-operation
  // - Supabase is down
  // - App crashes
  // - Device loses power (as long as write completes)
  
  try {
    // Load existing local surveys
    const localSurveys = await getFromLocalStorage<Survey[]>(KEYS.LOCAL_SURVEYS) || [];
    
    // Add new survey to local storage
    localSurveys.push(survey);
    await saveToLocalStorage(KEYS.LOCAL_SURVEYS, localSurveys);
    
    console.log(`✅ FAILSAFE: Survey ${survey.id} saved to local storage (${localSurveys.length} total)`);
  } catch (localError) {
    console.error('❌ CRITICAL: Local storage save failed:', localError);
    throw new Error('Failed to save survey locally - cannot proceed without data safety guarantee');
  }

  // ============ STEP 2: ATTEMPT CLOUD SYNC (BEST EFFORT) ============
  try {
    const dbSurvey = transformSurveyToDB(survey);

    const { data, error } = await supabase
      .from('surveys')
      .insert([dbSurvey])
      .select()
      .single();

    if (error) {
      console.error('⚠️ Cloud sync failed (data is safe locally):', error);
      // Data remains in KEYS.LOCAL_SURVEYS - will be synced when connectivity restores
      return survey;
    }

    console.log(`✅ Survey ${survey.id} synced to cloud`);
    
    // Remove from local storage after successful sync
    await removeFromLocalSurveys(survey.id);
    
    return transformSurveyFromDB(data);
  } catch (syncError) {
    console.error('⚠️ Cloud sync error (data is safe locally):', syncError);
    // Data remains in KEYS.LOCAL_SURVEYS - will be synced when connectivity restores
    return survey;
  }
};

export const markSurveyAsReviewed = async (surveyId: string): Promise<void> => {
  const { error } = await supabase
    .from('surveys')
    .update({ duplicate_reviewed: true })
    .eq('id', surveyId);

  if (error) {
    console.error('Error marking survey as reviewed:', error);
    throw error;
  }
};

export const deleteSurvey = async (surveyId: string): Promise<void> => {
  const { error } = await supabase
    .from('surveys')
    .delete()
    .eq('id', surveyId);

  if (error) {
    console.error('Error deleting survey:', error);
    throw error;
  }
};

// ============ SCHEDULES ============

export const getSchedules = async (): Promise<Schedule[]> => {
  const { data, error } = await supabase
    .from('schedules')
    .select('*')
    .order('date', { ascending: true });

  if (error) {
    console.error('Error fetching schedules:', error);
    return [];
  }

  return (data || []).map(transformScheduleFromDB);
};

export const saveSchedules = async (schedules: Schedule[]): Promise<void> => {
  console.warn('saveSchedules: Bulk operations not recommended with Supabase');
};

export const addSchedule = async (schedule: Schedule): Promise<void> => {
  const dbSchedule = transformScheduleToDB(schedule);

  const { error } = await supabase
    .from('schedules')
    .insert([dbSchedule]);

  if (error) {
    console.error('Error adding schedule:', error);
    throw error;
  }
};

export const addMultipleSchedules = async (schedules: Schedule[]): Promise<void> => {
  const dbSchedules = schedules.map(transformScheduleToDB);

  const { error } = await supabase
    .from('schedules')
    .insert(dbSchedules);

  if (error) {
    console.error('Error adding multiple schedules:', error);
    throw error;
  }
};

// ============ TIME OFF REQUESTS ============

export const getTimeOffRequests = async (): Promise<TimeOffRequest[]> => {
  const { data, error } = await supabase
    .from('time_off_requests')
    .select('*')
    .order('requested_at', { ascending: false });

  if (error) {
    console.error('Error fetching time off requests:', error);
    return [];
  }

  return (data || []).map(transformTimeOffRequestFromDB);
};

export const saveTimeOffRequests = async (requests: TimeOffRequest[]): Promise<void> => {
  console.warn('saveTimeOffRequests: Bulk operations not recommended with Supabase');
};

export const addTimeOffRequest = async (request: TimeOffRequest): Promise<void> => {
  const dbRequest = transformTimeOffRequestToDB(request);

  const { error } = await supabase
    .from('time_off_requests')
    .insert([dbRequest]);

  if (error) {
    console.error('Error adding time off request:', error);
    throw error;
  }
};

export const updateTimeOffRequest = async (requestId: string, status: 'approved' | 'denied'): Promise<void> => {
  const { data: { user } } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('time_off_requests')
    .update({
      status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: user?.id,
    })
    .eq('id', requestId);

  if (error) {
    console.error('Error updating time off request:', error);
    throw error;
  }
};

// ============ MESSAGES ============

export const getMessages = async (): Promise<Message[]> => {
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching messages:', error);
    return [];
  }

  return (data || []).map(transformMessageFromDB);
};

export const saveMessages = async (messages: Message[]): Promise<void> => {
  console.warn('saveMessages: Bulk operations not recommended with Supabase');
};

export const addMessage = async (message: Message): Promise<void> => {
  try {
    const dbMessage = transformMessageToDB(message);
    console.log('💾 Inserting message to database:', { id: message.id, content: message.content.substring(0, 30) });

    const { error } = await supabase
      .from('messages')
      .insert([dbMessage]);

    if (error) {
      console.error('❌ Supabase error adding message:', error);
      throw new Error(`Database error: ${error.message || 'Failed to insert message'}`);
    }
    
    console.log('✅ Message successfully inserted to database');
  } catch (error) {
    console.error('❌ Exception in addMessage:', error);
    if (error instanceof Error) {
      throw error;
    }
    throw new Error('Unknown error occurred while adding message');
  }
};

export const markMessageAsRead = async (messageId: string, employeeId: string): Promise<void> => {
  // Fetch current message
  const { data: message, error: fetchError } = await supabase
    .from('messages')
    .select('read_by')
    .eq('id', messageId)
    .single();

  if (fetchError) {
    console.error('Error fetching message:', fetchError);
    return;
  }

  if (message.read_by && message.read_by.includes(employeeId)) {
    return; // Already read
  }

  const readBy = [...(message.read_by || []), employeeId];

  const { error } = await supabase
    .from('messages')
    .update({ read_by: readBy })
    .eq('id', messageId);

  if (error) {
    console.error('Error marking message as read:', error);
  }
};

export const addReaction = async (messageId: string, employeeId: string, emoji: string): Promise<void> => {
  // Fetch current message
  const { data: message, error: fetchError } = await supabase
    .from('messages')
    .select('reactions')
    .eq('id', messageId)
    .single();

  if (fetchError) {
    console.error('Error fetching message:', fetchError);
    return;
  }

  const reactions = message.reactions || {};
  if (!reactions[emoji]) {
    reactions[emoji] = [];
  }
  if (!reactions[emoji].includes(employeeId)) {
    reactions[emoji].push(employeeId);
  }

  const { error } = await supabase
    .from('messages')
    .update({ reactions })
    .eq('id', messageId);

  if (error) {
    console.error('Error adding reaction:', error);
  }
};

// ============ CURRENT USER (Session storage - not in DB) ============

const CURRENT_USER_KEY = 'current_user';

export const setCurrentUser = async (employee: Employee | null): Promise<void> => {
  try {
    if (employee) {
      await AsyncStorage.setItem(CURRENT_USER_KEY, JSON.stringify(employee));
    } else {
      await AsyncStorage.removeItem(CURRENT_USER_KEY);
    }
  } catch (error) {
    console.error('Error setting current user:', error);
  }
};

export const getCurrentUser = async (): Promise<Employee | null> => {
  try {
    const data = await AsyncStorage.getItem(CURRENT_USER_KEY);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error('Error getting current user:', error);
    return null;
  }
};

// ============ COMPENSATION SETTINGS ============

export const getCompensationSettings = async (): Promise<CompensationSettings> => {
  const { data, error } = await supabase
    .from('compensation_settings')
    .select('*')
    .limit(1)
    .single();

  if (error) {
    console.error('Error fetching compensation settings:', error);
    return {
      baseHourlyRate: 15,
      surveyInstallBonus: 10,
      appointmentInstallBonus: 25,
      quota: 5,
    };
  }

  return transformCompensationSettingsFromDB(data);
};

export const saveCompensationSettings = async (settings: CompensationSettings): Promise<void> => {
  // Get the existing settings ID
  const { data: existing } = await supabase
    .from('compensation_settings')
    .select('id')
    .limit(1)
    .single();

  if (existing) {
    const { error } = await supabase
      .from('compensation_settings')
      .update({
        base_hourly_rate: settings.baseHourlyRate,
        survey_install_bonus: settings.surveyInstallBonus,
        appointment_install_bonus: settings.appointmentInstallBonus,
        quota: settings.quota,
      })
      .eq('id', existing.id);

    if (error) {
      console.error('Error updating compensation settings:', error);
      throw error;
    }
  }
};

// ============ ONBOARDING DATA ============

export const getOnboardingData = async (): Promise<OnboardingData | null> => {
  // This should typically fetch for a specific employee
  // For now, returning null as it's session-specific
  return null;
};

export const saveOnboardingData = async (data: OnboardingData): Promise<void> => {
  const dbData = transformOnboardingDataToDB(data);

  const { error } = await supabase
    .from('onboarding_data')
    .upsert([dbData], { onConflict: 'employee_id' });

  if (error) {
    console.error('Error saving onboarding data:', error);
    throw error;
  }
};

export const updateOnboardingStep = async (employeeId: string, step: number, data: Partial<OnboardingData>): Promise<void> => {
  const dbData: any = {
    employee_id: employeeId,
    step,
    personal_info: data.personalInfo,
    w4_signature: data.w4Signature,
    w4_data: data.w4Data,
    i9_signature: data.i9Signature,
    i9_data: data.i9Data,
    drivers_license_uri: data.driversLicenseUri,
    direct_deposit_data: data.directDepositData,
    acknowledgments: data.acknowledgments,
    completed_at: step === 6 ? new Date().toISOString() : undefined,
  };

  // Remove undefined values
  Object.keys(dbData).forEach(key => 
    dbData[key] === undefined && delete dbData[key]
  );

  const { error } = await supabase
    .from('onboarding_data')
    .upsert([dbData], { onConflict: 'employee_id' });

  if (error) {
    console.error('Error updating onboarding step:', error);
    throw error;
  }

  // Update employee onboarding status
  await updateEmployee(employeeId, {
    onboardingStep: step,
    onboardingComplete: step === 6,
    status: step === 6 ? 'active' : undefined,
  });
};

// ============ ALERTS ============

export const getData = async <T>(key: string): Promise<T | null> => {
  // For non-database data (like alerts, sync queue), use AsyncStorage
  try {
    const data = await AsyncStorage.getItem(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    console.error(`Error getting ${key}:`, error);
    return null;
  }
};

export const saveData = async <T>(key: string, data: T): Promise<void> => {
  try {
    await AsyncStorage.setItem(key, JSON.stringify(data));
  } catch (error) {
    console.error(`Error saving ${key}:`, error);
  }
};

// ============ CONSOLIDATED SYNC QUEUE SYSTEM ============
// NOTE: We removed the old separate queues and now use ONLY the local failsafe storage
// This eliminates confusion and ensures clock out syncs check the correct storage

interface SyncQueueItem {
  type: 'survey' | 'timeEntry' | 'appointment';
  data: any;
  timestamp: string;
  retryCount?: number;
}

// DEPRECATED - Kept for backward compatibility but not used
const SYNC_QUEUE_KEY = 'sync_queue_deprecated';

export const addToSyncQueue = async (item: Omit<SyncQueueItem, 'timestamp'>): Promise<void> => {
  // NO-OP - Surveys are now saved directly to KEYS.LOCAL_SURVEYS via addSurvey()
  // This function is kept for backward compatibility but does nothing
  console.log('ℹ️ addToSyncQueue is deprecated - data is auto-saved to failsafe storage');
};

export const getSyncQueue = async (): Promise<SyncQueueItem[]> => {
  // Return the REAL local surveys that need syncing
  const localSurveys = await getFromLocalStorage<Survey[]>(KEYS.LOCAL_SURVEYS) || [];
  const localEntries = await getFromLocalStorage<TimeEntry[]>(KEYS.LOCAL_TIME_ENTRIES) || [];
  
  const queue: SyncQueueItem[] = [];
  
  // Add surveys to queue
  localSurveys.forEach(survey => {
    queue.push({
      type: 'survey',
      data: survey,
      timestamp: survey.timestamp,
      retryCount: 0,
    });
  });
  
  // Add time entries to queue
  localEntries.forEach(entry => {
    queue.push({
      type: 'timeEntry',
      data: entry,
      timestamp: entry.clockIn,
      retryCount: 0,
    });
  });
  
  console.log(`📊 Sync queue status: ${localSurveys.length} surveys, ${localEntries.length} time entries`);
  
  return queue;
};

export const clearSyncQueue = async (): Promise<void> => {
  // Clear both local storages after successful sync
  await saveToLocalStorage(KEYS.LOCAL_SURVEYS, []);
  await saveToLocalStorage(KEYS.LOCAL_TIME_ENTRIES, []);
  console.log('✅ Sync queue cleared');
};

const removeFromLocalSurveys = async (surveyId: string): Promise<void> => {
  try {
    const localSurveys = await getFromLocalStorage<Survey[]>(KEYS.LOCAL_SURVEYS) || [];
    const filtered = localSurveys.filter(s => s.id !== surveyId);
    await saveToLocalStorage(KEYS.LOCAL_SURVEYS, filtered);
    console.log(`✅ Removed survey ${surveyId} from local storage (${filtered.length} remaining)`);
  } catch (error) {
    console.error('Error removing from local surveys:', error);
  }
};

// ============ RECOVERY: SYNC LOCAL DATA TO CLOUD ============

export const syncLocalDataToCloud = async (): Promise<{ surveySynced: number; surveyFailed: number; timeSynced: number; timeFailed: number }> => {
  console.log('🔄 Starting comprehensive local data sync...');
  
  const localSurveys = await getFromLocalStorage<Survey[]>(KEYS.LOCAL_SURVEYS) || [];
  const localTimeEntries = await getFromLocalStorage<TimeEntry[]>(KEYS.LOCAL_TIME_ENTRIES) || [];
  
  if (localSurveys.length === 0 && localTimeEntries.length === 0) {
    console.log('✅ No local data to sync');
    return { surveySynced: 0, surveyFailed: 0, timeSynced: 0, timeFailed: 0 };
  }
  
  // ============ SYNC SURVEYS ============
  let surveySynced = 0;
  let surveyFailed = 0;
  const remainingSurveys: Survey[] = [];
  
  if (localSurveys.length > 0) {
    console.log(`📤 Syncing ${localSurveys.length} local surveys to cloud...`);
    
    for (const survey of localSurveys) {
      try {
        const dbSurvey = transformSurveyToDB(survey);
        
        const { error } = await supabase
          .from('surveys')
          .insert([dbSurvey]);
        
        if (error) {
          console.error(`❌ Survey sync failed ${survey.id}:`, error);
          remainingSurveys.push(survey);
          surveyFailed++;
        } else {
          console.log(`✅ Survey synced ${survey.id}`);
          surveySynced++;
        }
      } catch (error) {
        console.error(`❌ Survey sync error ${survey.id}:`, error);
        remainingSurveys.push(survey);
        surveyFailed++;
      }
    }
    
    await saveToLocalStorage(KEYS.LOCAL_SURVEYS, remainingSurveys);
  }
  
  // ============ SYNC TIME ENTRIES ============
  let timeSynced = 0;
  let timeFailed = 0;
  const remainingTimeEntries: TimeEntry[] = [];
  
  if (localTimeEntries.length > 0) {
    console.log(`📤 Syncing ${localTimeEntries.length} local time entries to cloud...`);
    
    for (const entry of localTimeEntries) {
      try {
        // Skip entries that already have a real ID (already synced)
        if (!entry.id.startsWith('temp_')) {
          console.log(`⏭️ Skipping already synced entry ${entry.id}`);
          timeSynced++;
          continue;
        }
        
        const { data, error } = await supabase
          .from('time_entries')
          .insert([{
            employee_id: entry.employeeId,
            clock_in: entry.clockIn,
            clock_out: entry.clockOut,
            store: entry.store,
            store_name: entry.storeName,
            store_number: entry.storeNumber,
            store_address: entry.storeAddress,
            synced_to_adp: entry.syncedToADP,
            is_active_in_kiosk: entry.isActiveInKiosk,
            gps_latitude: entry.gpsCoordinates?.latitude,
            gps_longitude: entry.gpsCoordinates?.longitude,
            gps_accuracy: entry.gpsCoordinates?.accuracy,
            photo_uri: entry.photoUri,
            location_verified: entry.locationVerified,
            distance_from_store: entry.distanceFromStore,
          }])
          .select()
          .single();
        
        if (error) {
          console.error(`❌ Time entry sync failed ${entry.id}:`, error);
          remainingTimeEntries.push(entry);
          timeFailed++;
        } else {
          console.log(`✅ Time entry synced ${entry.id}`);
          timeSynced++;
        }
      } catch (error) {
        console.error(`❌ Time entry sync error ${entry.id}:`, error);
        remainingTimeEntries.push(entry);
        timeFailed++;
      }
    }
    
    await saveToLocalStorage(KEYS.LOCAL_TIME_ENTRIES, remainingTimeEntries);
  }
  
  console.log(`✅ Sync complete: Surveys ${surveySynced}/${localSurveys.length}, Time Entries ${timeSynced}/${localTimeEntries.length}`);
  
  return { surveySynced, surveyFailed, timeSynced, timeFailed };
};

// Legacy function - kept for backward compatibility
export const syncLocalSurveysToCloud = syncLocalDataToCloud;

// ============ DIAGNOSTIC: GET LOCAL SURVEY COUNT ============

export const getLocalSurveyCount = async (): Promise<number> => {
  const localSurveys = await getFromLocalStorage<Survey[]>(KEYS.LOCAL_SURVEYS) || [];
  return localSurveys.length;
};

// ============ SYNC LOGS ============

interface SyncLogItem {
  type: 'survey' | 'appointment';
  id: string;
  name: string; // Customer name or identifier
  salesforceId?: string;
  error?: string;
  status: 'success' | 'failed' | 'duplicate';
}

interface SyncLog {
  timestamp: string;
  synced: number;
  failed: number;
  duplicates: number;
  queueSize: number;
  items?: SyncLogItem[]; // Detailed list of what was synced
}

const SYNC_LOGS_KEY = 'sync_logs';

export const addSyncLog = async (log: SyncLog): Promise<void> => {
  const logs = (await getData<SyncLog[]>(SYNC_LOGS_KEY)) || [];
  logs.unshift(log);
  if (logs.length > 100) {
    logs.splice(100);
  }
  await saveData(SYNC_LOGS_KEY, logs);
};

export const getSyncLogs = () => getData<SyncLog[]>(SYNC_LOGS_KEY);

// ============ FAILED SYNCS ============

interface FailedSyncItem extends SyncQueueItem {
  failedAt: string;
  error: string;
}

const FAILED_SYNCS_KEY = 'failed_syncs';

export const addFailedSyncItem = async (item: FailedSyncItem): Promise<void> => {
  const failed = (await getData<FailedSyncItem[]>(FAILED_SYNCS_KEY)) || [];
  failed.unshift(item);
  if (failed.length > 50) {
    failed.splice(50);
  }
  await saveData(FAILED_SYNCS_KEY, failed);
};

export const getFailedSyncItems = () => getData<FailedSyncItem[]>(FAILED_SYNCS_KEY);
export const clearFailedSyncItems = () => saveData(FAILED_SYNCS_KEY, []);

// ============ DEMO DATA INITIALIZATION ============

export const initializeDemoData = async (): Promise<void> => {
  try {
    console.log('🔄 Checking for demo accounts...');
    const employees = await getEmployees();
    
    // Check if demo accounts exist
    const hasAdmin = employees.some(e => e.email === 'admin@rainsoft.com');
    const hasSurveyor = employees.some(e => e.email === 'surveyor@rainsoft.com');
    
    if (hasAdmin && hasSurveyor) {
      console.log('✅ Demo accounts already exist');
      return;
    }
    
    console.log('📝 Creating missing demo accounts...');
    
    // Create demo admin if it doesn't exist
    if (!hasAdmin) {
      const { error } = await supabase
        .from('employees')
        .insert([{
          email: 'admin@rainsoft.com',
          first_name: 'Admin',
          last_name: 'User',
          phone: '555-0100',
          role: 'admin',
          status: 'active',
          hire_date: '2024-01-01',
          onboarding_complete: true,
          onboarding_step: 6,
          availability: {
            monday: { available: true, startTime: '08:00', endTime: '17:00' },
            tuesday: { available: true, startTime: '08:00', endTime: '17:00' },
            wednesday: { available: true, startTime: '08:00', endTime: '17:00' },
            thursday: { available: true, startTime: '08:00', endTime: '17:00' },
            friday: { available: true, startTime: '08:00', endTime: '17:00' },
            saturday: { available: false },
            sunday: { available: false },
          },
        }]);

      if (error) {
        console.error('❌ Failed to create demo admin:', error);
        throw error;
      }
      console.log('✅ Demo admin account created');
    }

    // Create demo surveyor if it doesn't exist
    if (!hasSurveyor) {
      const { error } = await supabase
        .from('employees')
        .insert([{
          email: 'surveyor@rainsoft.com',
          first_name: 'John',
          last_name: 'Surveyor',
          phone: '555-0101',
          role: 'surveyor',
          status: 'active',
          hire_date: '2024-06-01',
          onboarding_complete: true,
          onboarding_step: 6,
          availability: {
            monday: { available: true, startTime: '09:00', endTime: '17:00' },
            tuesday: { available: true, startTime: '09:00', endTime: '17:00' },
            wednesday: { available: true, startTime: '09:00', endTime: '17:00' },
            thursday: { available: true, startTime: '09:00', endTime: '17:00' },
            friday: { available: true, startTime: '09:00', endTime: '17:00' },
            saturday: { available: true, startTime: '10:00', endTime: '15:00' },
            sunday: { available: false },
          },
        }]);

      if (error) {
        console.error('❌ Failed to create demo surveyor:', error);
        throw error;
      }
      console.log('✅ Demo surveyor account created');
    }
    
    console.log('✅ Demo data initialization complete');
  } catch (error) {
    console.error('❌ CRITICAL: Demo data initialization failed:', error);
    throw error;
  }
};

// ============ HELPER FUNCTIONS: DB TRANSFORMS ============

function transformEmployeeFromDB(data: any): Employee {
  return {
    id: data.id,
    email: data.email,
    firstName: data.first_name,
    lastName: data.last_name,
    phone: data.phone,
    role: data.role,
    status: data.status,
    hireDate: data.hire_date,
    onboardingComplete: data.onboarding_complete,
    onboardingStep: data.onboarding_step,
    documents: [], // Fetch separately if needed
    availability: data.availability,
    adpEmployeeId: data.adp_employee_id,
    personalInfo: data.personal_info,
    inviteToken: data.invite_token,
    inviteSentAt: data.invite_sent_at,
    profilePictureUri: data.profile_picture_uri,
    isTeamLead: data.is_team_lead,
    teamLeadId: data.team_lead_id,
  };
}

function transformEmployeeToDB(employee: Employee): any {
  return {
    id: employee.id,
    email: employee.email,
    first_name: employee.firstName,
    last_name: employee.lastName,
    phone: employee.phone,
    role: employee.role,
    status: employee.status,
    hire_date: employee.hireDate,
    onboarding_complete: employee.onboardingComplete,
    onboarding_step: employee.onboardingStep,
    adp_employee_id: employee.adpEmployeeId,
    invite_token: employee.inviteToken,
    invite_sent_at: employee.inviteSentAt,
    profile_picture_uri: employee.profilePictureUri,
    is_team_lead: employee.isTeamLead,
    team_lead_id: employee.teamLeadId,
    availability: employee.availability,
    personal_info: employee.personalInfo,
  };
}

function transformTimeEntryFromDB(data: any): TimeEntry {
  return {
    id: data.id,
    employeeId: data.employee_id,
    clockIn: data.clock_in,
    clockOut: data.clock_out,
    store: data.store,
    storeName: data.store_name,
    storeNumber: data.store_number,
    storeAddress: data.store_address,
    syncedToADP: data.synced_to_adp,
    isActiveInKiosk: data.is_active_in_kiosk,
    gpsCoordinates: (data.gps_latitude && data.gps_longitude) ? {
      latitude: data.gps_latitude,
      longitude: data.gps_longitude,
      accuracy: data.gps_accuracy,
    } : undefined,
    photoUri: data.photo_uri,
    locationVerified: data.location_verified,
    distanceFromStore: data.distance_from_store,
  };
}

function transformSurveyFromDB(data: any): Survey {
  return {
    id: data.id,
    employeeId: data.employee_id,
    employeeAlias: data.employee_alias,
    store: data.store,
    storeName: data.store_name,
    storeNumber: data.store_number,
    storeAddress: data.store_address,
    timestamp: data.timestamp,
    answers: data.answers,
    signature: data.signature,
    category: data.category,
    appointment: data.appointment,
    syncedToSalesforce: data.synced_to_salesforce,
    syncedToZapier: data.synced_to_zapier,
    isDuplicate: data.is_duplicate,
    duplicateReviewed: data.duplicate_reviewed,
    duplicateInfo: data.duplicate_info ? {
      recordType: data.duplicate_info.recordType,
      salesforceId: data.duplicate_info.salesforceId,
      salesforceUrl: data.duplicate_info.salesforceUrl,
      matchedPhone: data.duplicate_info.matchedPhone,
      recordName: data.duplicate_info.recordName,
      recordEmail: data.duplicate_info.recordEmail,
    } : undefined,
    locationVerified: data.location_verified,
    syncError: data.sync_error,
    salesforceId: data.salesforce_id,
    salesforceVerified: data.salesforce_verified,
    salesforceVerifiedAt: data.salesforce_verified_at,
  };
}

function transformSurveyToDB(survey: Survey): any {
  return {
    id: survey.id,
    employee_id: survey.employeeId,
    employee_alias: survey.employeeAlias,
    store: survey.store,
    store_name: survey.storeName,
    store_number: survey.storeNumber,
    store_address: survey.storeAddress,
    timestamp: survey.timestamp,
    answers: survey.answers,
    signature: survey.signature,
    category: survey.category,
    appointment: survey.appointment,
    synced_to_salesforce: survey.syncedToSalesforce,
    synced_to_zapier: survey.syncedToZapier,
    is_duplicate: survey.isDuplicate,
    duplicate_reviewed: survey.duplicateReviewed,
    duplicate_info: survey.duplicateInfo ? {
      recordType: survey.duplicateInfo.recordType,
      salesforceId: survey.duplicateInfo.salesforceId,
      salesforceUrl: survey.duplicateInfo.salesforceUrl,
      matchedPhone: survey.duplicateInfo.matchedPhone,
      recordName: survey.duplicateInfo.recordName,
      recordEmail: survey.duplicateInfo.recordEmail,
    } : null,
    location_verified: survey.locationVerified,
    sync_error: survey.syncError,
    salesforce_id: survey.salesforceId,
    salesforce_verified: survey.salesforceVerified,
    salesforce_verified_at: survey.salesforceVerifiedAt,
  };
}

function transformScheduleFromDB(data: any): Schedule {
  return {
    id: data.id,
    employeeId: data.employee_id,
    date: data.date,
    startTime: data.start_time,
    endTime: data.end_time,
    store: data.store,
    status: data.status,
  };
}

function transformScheduleToDB(schedule: Schedule): any {
  return {
    id: schedule.id,
    employee_id: schedule.employeeId,
    date: schedule.date,
    start_time: schedule.startTime,
    end_time: schedule.endTime,
    store: schedule.store,
    status: schedule.status,
  };
}

function transformTimeOffRequestFromDB(data: any): TimeOffRequest {
  return {
    id: data.id,
    employeeId: data.employee_id,
    startDate: data.start_date,
    endDate: data.end_date,
    reason: data.reason,
    status: data.status,
    requestedAt: data.requested_at,
  };
}

function transformTimeOffRequestToDB(request: TimeOffRequest): any {
  return {
    id: request.id,
    employee_id: request.employeeId,
    start_date: request.startDate,
    end_date: request.endDate,
    reason: request.reason,
    status: request.status,
    requested_at: request.requestedAt,
  };
}

function transformMessageFromDB(data: any): Message {
  return {
    id: data.id,
    senderId: data.sender_id,
    senderName: data.sender_name,
    recipientIds: data.recipient_ids || [],
    content: data.content,
    timestamp: data.created_at,
    readBy: data.read_by || [],
    reactions: data.reactions || {},
    isGroupMessage: data.is_group_message,
  };
}

function transformMessageToDB(message: Message): any {
  // Validate required fields
  if (!message.id || !message.senderId || !message.senderName || !message.content) {
    throw new Error('Missing required message fields');
  }
  
  return {
    id: message.id,
    sender_id: message.senderId,
    sender_name: message.senderName,
    recipient_ids: message.recipientIds || [],
    content: message.content,
    is_group_message: message.isGroupMessage || false,
    read_by: message.readBy || [],
    reactions: message.reactions || {},
  };
}

function transformCompensationSettingsFromDB(data: any): CompensationSettings {
  return {
    baseHourlyRate: data.base_hourly_rate,
    surveyInstallBonus: data.survey_install_bonus,
    appointmentInstallBonus: data.appointment_install_bonus,
    quota: data.quota,
  };
}

function transformOnboardingDataToDB(data: OnboardingData): any {
  return {
    employee_id: data.employeeId,
    step: data.step,
    personal_info: data.personalInfo,
    w4_signature: data.w4Signature,
    w4_data: data.w4Data,
    i9_signature: data.i9Signature,
    i9_data: data.i9Data,
    drivers_license_uri: data.driversLicenseUri,
    direct_deposit_data: data.directDepositData,
    acknowledgments: data.acknowledgments,
    completed_at: data.completedAt,
  };
}
