/**
 * FAILSAFE STORAGE SERVICE
 * 
 * Ultra-reliable storage for critical business features:
 * - Survey submissions
 * - Clock in/out
 * - Appointments
 * 
 * Design Principles:
 * 1. Multiple redundancy layers (AsyncStorage + Supabase + Sync Queue)
 * 2. Never throw errors (returns success/failure status)
 * 3. Automatic retry mechanisms
 * 4. Works offline-first
 * 5. Isolated from other features (won't be affected by crashes elsewhere)
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Survey, TimeEntry, Appointment } from '@/types';

// Separate storage keys for critical features (isolated from other app data)
const KEYS = {
  SURVEYS_CRITICAL: '@rainsoft/critical/surveys',
  TIME_ENTRIES_CRITICAL: '@rainsoft/critical/timeEntries',
  APPOINTMENTS_CRITICAL: '@rainsoft/critical/appointments',
  SYNC_QUEUE_CRITICAL: '@rainsoft/critical/syncQueue',
  LAST_BACKUP: '@rainsoft/critical/lastBackup',
};

interface FailsafeResult<T = any> {
  success: boolean;
  data?: T;
  error?: string;
}

/**
 * Save survey with multiple failsafes
 * NEVER throws - always returns success status
 */
export async function saveSurveyFailsafe(survey: Survey): Promise<FailsafeResult<Survey>> {
  console.log(`🛡️ FAILSAFE: Saving survey ${survey.id}...`);
  
  try {
    // LAYER 1: Save to dedicated critical storage (isolated from other data)
    const surveys = await getCriticalSurveys();
    surveys.push(survey);
    
    await AsyncStorage.setItem(KEYS.SURVEYS_CRITICAL, JSON.stringify(surveys));
    console.log(`✅ FAILSAFE: Survey ${survey.id} saved to critical storage`);
    
    // LAYER 2: Try to save to cloud database (non-blocking)
    try {
      const { getSupabaseClient } = require('@/template');
      const supabase = getSupabaseClient();
      
      const { error: cloudError } = await supabase
        .from('surveys')
        .upsert([{
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
          synced_to_salesforce: false,
          synced_to_zapier: false,
          location_verified: survey.locationVerified,
        }]);
      
      if (!cloudError) {
        console.log(`✅ FAILSAFE: Survey ${survey.id} also saved to cloud`);
      } else {
        console.warn(`⚠️ FAILSAFE: Cloud save failed (data safe locally):`, cloudError.message);
        // Add to sync queue for retry
        await addToSyncQueueCritical({ type: 'survey', data: survey });
      }
    } catch (cloudError) {
      console.warn(`⚠️ FAILSAFE: Cloud save error (data safe locally):`, cloudError);
      // Add to sync queue for retry
      await addToSyncQueueCritical({ type: 'survey', data: survey });
    }
    
    // LAYER 3: Create backup checkpoint
    await createBackupCheckpoint();
    
    return { success: true, data: survey };
  } catch (error) {
    console.error(`❌ FAILSAFE: Critical error saving survey:`, error);
    
    // EMERGENCY FALLBACK: Try to save with minimal data
    try {
      const emergencySurvey = {
        id: survey.id,
        employeeId: survey.employeeId,
        timestamp: survey.timestamp,
        category: survey.category,
        emergency: true,
      };
      await AsyncStorage.setItem(`@rainsoft/emergency/${survey.id}`, JSON.stringify(emergencySurvey));
      console.log(`🚨 EMERGENCY: Survey ${survey.id} saved to emergency storage`);
      return { success: true, data: survey, error: 'Saved to emergency storage' };
    } catch (emergencyError) {
      console.error(`❌ EMERGENCY: Total failure:`, emergencyError);
      return { success: false, error: 'Device storage unavailable' };
    }
  }
}

/**
 * Save clock in/out with failsafes
 */
export async function saveTimeEntryFailsafe(timeEntry: TimeEntry): Promise<FailsafeResult<TimeEntry>> {
  console.log(`🛡️ FAILSAFE: Saving time entry ${timeEntry.id}...`);
  
  try {
    // LAYER 1: Critical storage
    const entries = await getCriticalTimeEntries();
    const existingIndex = entries.findIndex(e => e.id === timeEntry.id);
    
    if (existingIndex >= 0) {
      entries[existingIndex] = timeEntry;
    } else {
      entries.push(timeEntry);
    }
    
    await AsyncStorage.setItem(KEYS.TIME_ENTRIES_CRITICAL, JSON.stringify(entries));
    console.log(`✅ FAILSAFE: Time entry ${timeEntry.id} saved to critical storage`);
    
    // LAYER 2: Try cloud save
    try {
      const { getSupabaseClient } = require('@/template');
      const supabase = getSupabaseClient();
      
      const { error: cloudError } = await supabase
        .from('time_entries')
        .upsert([{
          id: timeEntry.id,
          employee_id: timeEntry.employeeId,
          clock_in: timeEntry.clockIn,
          clock_out: timeEntry.clockOut,
          store: timeEntry.store,
          store_name: timeEntry.storeName,
          store_number: timeEntry.storeNumber,
          store_address: timeEntry.storeAddress,
          synced_to_adp: false,
          is_active_in_kiosk: timeEntry.isActiveInKiosk,
          gps_latitude: timeEntry.gpsCoordinates?.latitude,
          gps_longitude: timeEntry.gpsCoordinates?.longitude,
          gps_accuracy: timeEntry.gpsCoordinates?.accuracy,
          photo_uri: timeEntry.photoUri,
          location_verified: timeEntry.locationVerified,
          distance_from_store: timeEntry.distanceFromStore,
        }]);
      
      if (!cloudError) {
        console.log(`✅ FAILSAFE: Time entry ${timeEntry.id} also saved to cloud`);
      } else {
        console.warn(`⚠️ FAILSAFE: Cloud save failed (data safe locally)`);
        await addToSyncQueueCritical({ type: 'timeEntry', data: timeEntry });
      }
    } catch (cloudError) {
      console.warn(`⚠️ FAILSAFE: Cloud save error (data safe locally)`);
      await addToSyncQueueCritical({ type: 'timeEntry', data: timeEntry });
    }
    
    await createBackupCheckpoint();
    return { success: true, data: timeEntry };
  } catch (error) {
    console.error(`❌ FAILSAFE: Critical error saving time entry:`, error);
    return { success: false, error: 'Storage error' };
  }
}

/**
 * Get all critical surveys (never throws)
 */
async function getCriticalSurveys(): Promise<Survey[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.SURVEYS_CRITICAL);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading critical surveys:', error);
    return [];
  }
}

/**
 * Get all critical time entries (never throws)
 */
async function getCriticalTimeEntries(): Promise<TimeEntry[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.TIME_ENTRIES_CRITICAL);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading critical time entries:', error);
    return [];
  }
}

/**
 * Add item to critical sync queue (for retry when online)
 */
async function addToSyncQueueCritical(item: any): Promise<void> {
  try {
    const queueData = await AsyncStorage.getItem(KEYS.SYNC_QUEUE_CRITICAL);
    const queue = queueData ? JSON.parse(queueData) : [];
    
    queue.push({
      ...item,
      addedAt: new Date().toISOString(),
      retryCount: 0,
    });
    
    await AsyncStorage.setItem(KEYS.SYNC_QUEUE_CRITICAL, JSON.stringify(queue));
    console.log(`📋 Added to critical sync queue:`, item.type);
  } catch (error) {
    console.error('Error adding to critical sync queue:', error);
  }
}

/**
 * Get critical sync queue
 */
export async function getCriticalSyncQueue(): Promise<any[]> {
  try {
    const data = await AsyncStorage.getItem(KEYS.SYNC_QUEUE_CRITICAL);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.error('Error loading critical sync queue:', error);
    return [];
  }
}

/**
 * Remove item from critical sync queue after successful sync
 */
export async function removeFromCriticalSyncQueue(item: any): Promise<void> {
  try {
    const queue = await getCriticalSyncQueue();
    const filtered = queue.filter(q => 
      !(q.type === item.type && q.data.id === item.data.id)
    );
    await AsyncStorage.setItem(KEYS.SYNC_QUEUE_CRITICAL, JSON.stringify(filtered));
  } catch (error) {
    console.error('Error removing from critical sync queue:', error);
  }
}

/**
 * Create backup checkpoint of critical data
 */
async function createBackupCheckpoint(): Promise<void> {
  try {
    const checkpoint = {
      timestamp: new Date().toISOString(),
      surveyCount: (await getCriticalSurveys()).length,
      timeEntryCount: (await getCriticalTimeEntries()).length,
      queueCount: (await getCriticalSyncQueue()).length,
    };
    
    await AsyncStorage.setItem(KEYS.LAST_BACKUP, JSON.stringify(checkpoint));
  } catch (error) {
    console.error('Error creating backup checkpoint:', error);
  }
}

/**
 * Get health status of critical storage
 */
export async function getCriticalStorageHealth(): Promise<{
  healthy: boolean;
  surveysStored: number;
  timeEntriesStored: number;
  queuedForSync: number;
  lastBackup: string | null;
}> {
  try {
    const surveys = await getCriticalSurveys();
    const timeEntries = await getCriticalTimeEntries();
    const queue = await getCriticalSyncQueue();
    const backupData = await AsyncStorage.getItem(KEYS.LAST_BACKUP);
    const backup = backupData ? JSON.parse(backupData) : null;
    
    return {
      healthy: true,
      surveysStored: surveys.length,
      timeEntriesStored: timeEntries.length,
      queuedForSync: queue.length,
      lastBackup: backup?.timestamp || null,
    };
  } catch (error) {
    console.error('Error checking critical storage health:', error);
    return {
      healthy: false,
      surveysStored: 0,
      timeEntriesStored: 0,
      queuedForSync: 0,
      lastBackup: null,
    };
  }
}

/**
 * Sync critical data to cloud (called when online)
 */
export async function syncCriticalDataToCloud(): Promise<{
  surveysSynced: number;
  timeEntriesSynced: number;
  failed: number;
}> {
  console.log('🔄 Syncing critical data to cloud...');
  
  let surveysSynced = 0;
  let timeEntriesSynced = 0;
  let failed = 0;
  
  try {
    const queue = await getCriticalSyncQueue();
    const { getSupabaseClient } = require('@/template');
    const supabase = getSupabaseClient();
    
    for (const item of queue) {
      try {
        if (item.type === 'survey') {
          const { error } = await supabase
            .from('surveys')
            .upsert([{
              id: item.data.id,
              employee_id: item.data.employeeId,
              employee_alias: item.data.employeeAlias,
              store: item.data.store,
              store_name: item.data.storeName,
              store_number: item.data.storeNumber,
              store_address: item.data.storeAddress,
              timestamp: item.data.timestamp,
              answers: item.data.answers,
              signature: item.data.signature,
              category: item.data.category,
              appointment: item.data.appointment,
              synced_to_salesforce: false,
              synced_to_zapier: false,
              location_verified: item.data.locationVerified,
            }]);
          
          if (!error) {
            surveysSynced++;
            await removeFromCriticalSyncQueue(item);
          } else {
            failed++;
          }
        } else if (item.type === 'timeEntry') {
          const { error } = await supabase
            .from('time_entries')
            .upsert([{
              id: item.data.id,
              employee_id: item.data.employeeId,
              clock_in: item.data.clockIn,
              clock_out: item.data.clockOut,
              store: item.data.store,
              store_name: item.data.storeName,
              store_number: item.data.storeNumber,
              store_address: item.data.storeAddress,
              synced_to_adp: false,
              is_active_in_kiosk: item.data.isActiveInKiosk,
              gps_latitude: item.data.gpsCoordinates?.latitude,
              gps_longitude: item.data.gpsCoordinates?.longitude,
              gps_accuracy: item.data.gpsCoordinates?.accuracy,
              photo_uri: item.data.photoUri,
              location_verified: item.data.locationVerified,
              distance_from_store: item.data.distanceFromStore,
            }]);
          
          if (!error) {
            timeEntriesSynced++;
            await removeFromCriticalSyncQueue(item);
          } else {
            failed++;
          }
        }
      } catch (itemError) {
        console.error('Error syncing item:', itemError);
        failed++;
      }
    }
    
    console.log(`✅ Critical sync complete: ${surveysSynced} surveys, ${timeEntriesSynced} time entries, ${failed} failed`);
  } catch (error) {
    console.error('Error syncing critical data:', error);
  }
  
  return { surveysSynced, timeEntriesSynced, failed };
}
