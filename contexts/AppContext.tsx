// Global app state context
import React, { createContext, ReactNode, useState, useEffect, useRef } from 'react';
import { AppState, AppStateStatus } from 'react-native';
import { Employee, TimeEntry, Survey, Schedule, Message, TimeOffRequest, DailySurveyCounts } from '@/types';
import { Store } from '@/constants/theme';
import * as StorageService from '@/services/storageService';
import * as SyncService from '@/services/syncService';
import * as NotificationService from '@/services/notificationService';
import NetInfo from '@react-native-community/netinfo';

interface AppContextType {
  currentUser: Employee | null;
  isOnline: boolean;
  activeTimeEntry: TimeEntry | null;
  selectedStore: Store | null;
  dailyCounts: DailySurveyCounts;
  employees: Employee[];
  surveys: Survey[];
  schedules: Schedule[];
  messages: Message[];
  timeOffRequests: TimeOffRequest[];
  
  // Actions
  login: (email: string) => Promise<boolean>;
  logout: () => void;
  selectStore: (store: Store) => void;
  clockIn: (store: Store, gpsCoordinates?: { latitude: number; longitude: number; accuracy: number }, photoUri?: string) => Promise<void>;
  clockOut: () => Promise<void>;
  setKioskActive: (isActive: boolean) => Promise<void>;
  updateLastActivity: () => void;
  calculateDailyStats: () => Promise<{ hoursWorked: number; qualifiedSurveys: number; appointments: number; surveysPerHour: number }>;
  submitSurvey: (survey: Survey) => Promise<void>;
  loadData: () => Promise<void>;
  syncData: () => Promise<void>;
  getClockedInEmployees: () => Promise<Array<{ employee: Employee; timeEntry: TimeEntry; todayStats: { surveys: number; appointments: number } }>>;
}

export const AppContext = createContext<AppContextType | undefined>(undefined);

const INACTIVITY_THRESHOLD = 5 * 60 * 1000; // 5 minutes in milliseconds

export function AppProvider({ children }: { children: ReactNode }) {
  const [currentUser, setCurrentUser] = useState<Employee | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [activeTimeEntry, setActiveTimeEntry] = useState<TimeEntry | null>(null);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [dailyCounts, setDailyCounts] = useState<DailySurveyCounts>({
    renters: 0,
    surveys: 0,
    appointments: 0,
  });
  
  const lastActivityRef = useRef<number>(Date.now());
  const appState = useRef<AppStateStatus>(AppState.currentState);
  
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [schedules, setSchedules] = useState<Schedule[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [timeOffRequests, setTimeOffRequests] = useState<TimeOffRequest[]>([]);

  // Request notification permissions on mount
  useEffect(() => {
    NotificationService.requestNotificationPermissions();
  }, []);

  // Monitor network status with real internet connectivity check
  useEffect(() => {
    let intervalId: NodeJS.Timeout;
    let wasOffline = false;
    
    const checkRealConnectivity = async () => {
      try {
        const netState = await NetInfo.fetch();
        if (!netState.isConnected) {
          setIsOnline(false);
          wasOffline = true;
          return;
        }
        
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 5000);
        
        const response = await fetch('https://www.google.com/generate_204', {
          method: 'HEAD',
          signal: controller.signal,
        });
        
        clearTimeout(timeoutId);
        const isNowOnline = response.ok;
        
        // If we just came back online, sync local data
        if (isNowOnline && wasOffline) {
          console.log('🌐 Connection restored - syncing local data...');
          syncLocalDataToCloud().catch(console.error);
          wasOffline = false;
        }
        
        setIsOnline(isNowOnline);
      } catch (error) {
        setIsOnline(false);
        wasOffline = true;
      }
    };
    
    checkRealConnectivity();
    intervalId = setInterval(checkRealConnectivity, 15000);
    
    const unsubscribe = NetInfo.addEventListener(state => {
      if (!state.isConnected) {
        setIsOnline(false);
        wasOffline = true;
      } else {
        checkRealConnectivity();
      }
    });
    
    // Start background sync
    SyncService.startBackgroundSync();
    
    return () => {
      clearInterval(intervalId);
      unsubscribe();
      SyncService.stopBackgroundSync();
    };
  }, []);

  // Initialize data
  useEffect(() => {
    initializeApp();
  }, []);

  // Update daily counts when current user changes
  useEffect(() => {
    if (currentUser) {
      updateDailyCounts();
    }
  }, [currentUser, surveys]);

  // Monitor app state for inactivity tracking (battery-efficient)
  useEffect(() => {
    const subscription = AppState.addEventListener('change', handleAppStateChange);
    return () => {
      subscription.remove();
    };
  }, [currentUser, activeTimeEntry]);

  const handleAppStateChange = async (nextAppState: AppStateStatus) => {
    // Only track if user is clocked in
    if (!currentUser || !activeTimeEntry) {
      appState.current = nextAppState;
      return;
    }

    // App going to background
    if (appState.current.match(/active/) && nextAppState.match(/inactive|background/)) {
      // Check if user has been inactive for 5+ minutes
      const timeSinceLastActivity = Date.now() - lastActivityRef.current;
      if (timeSinceLastActivity >= INACTIVITY_THRESHOLD) {
        // Mark as inactive
        await setKioskActive(false);
      }
    }

    // App coming to foreground
    if (appState.current.match(/inactive|background/) && nextAppState === 'active') {
      // Mark as active when returning to app
      if (activeTimeEntry.isActiveInKiosk === false) {
        await setKioskActive(true);
      }
      // Reset activity timer
      lastActivityRef.current = Date.now();
    }

    appState.current = nextAppState;
  };

  const updateLastActivity = () => {
    lastActivityRef.current = Date.now();
  };

  const initializeApp = async () => {
    await StorageService.initializeDemoData();
    await loadData();
    
    const user = await StorageService.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      await checkActiveTimeEntry(user.id);
    }
  };

  const loadData = async () => {
    const [
      employeesData,
      surveysData,
      schedulesData,
      messagesData,
      timeOffData,
    ] = await Promise.all([
      StorageService.getEmployees(),
      StorageService.getSurveys(),
      StorageService.getSchedules(),
      StorageService.getMessages(),
      StorageService.getTimeOffRequests(),
    ]);
    
    setEmployees(employeesData || []);
    setSurveys(surveysData || []);
    setSchedules(schedulesData || []);
    setMessages(messagesData || []);
    setTimeOffRequests(timeOffData || []);
  };

  const checkActiveTimeEntry = async (employeeId: string) => {
    const entries = await StorageService.getTimeEntries();
    const active = entries?.find(e => e.employeeId === employeeId && !e.clockOut);
    if (active) {
      setActiveTimeEntry(active);
      if (active.store) {
        setSelectedStore(active.store);
      }
    }
  };

  const updateDailyCounts = () => {
    if (!currentUser) return;
    
    const today = new Date().toISOString().split('T')[0];
    const todaySurveys = surveys.filter(s => 
      s.employeeId === currentUser.id && 
      s.timestamp.startsWith(today)
    );
    
    setDailyCounts({
      renters: todaySurveys.filter(s => s.category === 'renter').length,
      surveys: todaySurveys.filter(s => s.category === 'survey').length,
      appointments: todaySurveys.filter(s => s.category === 'appointment').length,
    });
  };

  const login = async (email: string): Promise<boolean> => {
    console.log('🔐 Attempting login for:', email);
    
    // Ensure demo data is initialized before login
    await StorageService.initializeDemoData();
    
    const employeesData = await StorageService.getEmployees();
    console.log('📋 Found employees:', employeesData.length);
    
    const employee = employeesData?.find(e => 
      e.email.toLowerCase() === email.toLowerCase() && e.status === 'active'
    );
    
    if (employee) {
      console.log('✅ Login successful:', employee.email);
      setCurrentUser(employee);
      await StorageService.setCurrentUser(employee);
      await checkActiveTimeEntry(employee.id);
      return true;
    }
    
    console.error('❌ Login failed - employee not found or inactive');
    return false;
  };

  const logout = async () => {
    setCurrentUser(null);
    setActiveTimeEntry(null);
    setSelectedStore(null);
    await StorageService.setCurrentUser(null);
  };

  const selectStore = (store: Store) => {
    setSelectedStore(store);
  };

  const clockIn = async (
    store: Store, 
    gpsCoordinates?: { latitude: number; longitude: number; accuracy: number },
    photoUri?: string
  ) => {
    if (!currentUser) return;
    
    const entry = await StorageService.clockIn(currentUser.id, store, gpsCoordinates, photoUri);
    setActiveTimeEntry(entry);
    setSelectedStore(store);
    
    await StorageService.addToSyncQueue({ type: 'timeEntry', data: entry });
    
    // Notify managers
    const managers = employees.filter(e => e.role === 'admin' || e.role === 'manager');
    await NotificationService.notifyClockIn(currentUser, store === 'lowes' ? 'Lowes' : 'Home Depot', managers);
  };

  const clockOut = async () => {
    if (!currentUser) return;
    
    // Get stats before clocking out
    const stats = await calculateDailyStats();
    
    // CRITICAL: Force sync all pending data before clocking out
    // This ensures no surveys are ever lost
    try {
      const queue = await StorageService.getSyncQueue();
      if (queue && queue.length > 0) {
        console.log(`⏳ Attempting to sync ${queue.length} pending items before clock out...`);
        
        if (isOnline) {
          // Attempt to sync local data to cloud
          await syncLocalDataToCloud();
          console.log('✅ Sync attempt complete');
        } else {
          console.log('📴 Offline - Data safely stored locally (will auto-sync when online)');
        }
      } else {
        console.log('✅ No pending data to sync');
      }
    } catch (error) {
      console.error('⚠️ Sync error during clock out:', error);
      // Data is ALWAYS saved locally first via failsafe, so nothing is lost
      // Sync will retry automatically when connectivity restores
    }
    
    await StorageService.clockOut(currentUser.id);
    setActiveTimeEntry(null);
    setSelectedStore(null);
    
    // Notify managers
    const managers = employees.filter(e => e.role === 'admin' || e.role === 'manager');
    await NotificationService.notifyClockOut(
      currentUser,
      stats.hoursWorked,
      stats.qualifiedSurveys,
      managers
    );
  };

const setKioskActive = async (isActive: boolean) => {
    if (!currentUser) return;
    const updatedEntry = await StorageService.setKioskActiveStatus(currentUser.id, isActive);
    if (updatedEntry) {
      setActiveTimeEntry(updatedEntry);
    }
    // Reset activity timer when marking as active
    if (isActive) {
      lastActivityRef.current = Date.now();
    }
  };

  const calculateDailyStats = async () => {
    if (!currentUser) return { hoursWorked: 0, qualifiedSurveys: 0, appointments: 0, surveysPerHour: 0 };
    
    const today = new Date().toISOString().split('T')[0];
    
    // Get today's time entries
    const entries = await StorageService.getTimeEntries();
    const todayEntries = entries?.filter(e => 
      e.employeeId === currentUser.id && 
      e.clockIn.startsWith(today)
    ) || [];
    
    // Calculate total hours worked (include ACTIVE entry if clocked in)
    let totalMinutes = 0;
    const now = new Date();
    
    todayEntries.forEach(entry => {
      const clockIn = new Date(entry.clockIn);
      const clockOut = entry.clockOut ? new Date(entry.clockOut) : now; // Use NOW if still clocked in
      const minutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
      totalMinutes += minutes;
    });
    const hoursWorked = totalMinutes / 60;
    
    // Get today's surveys
    const todaySurveys = surveys.filter(s => 
      s.employeeId === currentUser.id && 
      s.timestamp.startsWith(today)
    );
    
    // Count qualified surveys (surveys + appointments)
    const qualifiedSurveys = todaySurveys.filter(s => 
      s.category === 'survey' || s.category === 'appointment'
    ).length;
    
    // Count appointments specifically
    const appointments = todaySurveys.filter(s => 
      s.category === 'appointment'
    ).length;
    
    // Calculate surveys per hour
    const surveysPerHour = hoursWorked > 0 ? qualifiedSurveys / hoursWorked : 0;
    
    return { hoursWorked, qualifiedSurveys, appointments, surveysPerHour };
  };

  const submitSurvey = async (survey: Survey) => {
    // ============ BULLETPROOF SAVE PROCESS ============
    // Step 1: Save to local storage FIRST (failsafe)
    // Step 2: Attempt cloud sync (best effort)
    // Step 3: Queue for retry if sync fails
    
    try {
      // CRITICAL: This save is guaranteed to succeed or throw
      // Local storage is the LAST LINE OF DEFENSE against data loss
      const savedSurvey = await StorageService.addSurvey(survey);
      console.log(`✅ Survey ${survey.id} saved (failsafe active)`);
      
      // Reload UI data
      await loadData();
      
      // Check if survey was synced to cloud or stored locally
      const localCount = await StorageService.getLocalSurveyCount();
      if (localCount > 0) {
        console.log(`📴 ${localCount} survey(s) pending cloud sync (data is safe locally)`);
      } else {
        // Survey made it to cloud database - now sync to Salesforce/Zapier
        console.log(`✅ Survey saved to cloud database - triggering Salesforce/Zapier sync...`);
        
        if (isOnline) {
          try {
            // Immediate Salesforce sync for qualified surveys
            if (survey.category !== 'renter' && survey.answers?.contact_info?.phone) {
              const syncResult = await SyncService.processSyncQueue([{
                type: 'survey',
                data: survey,
                timestamp: survey.timestamp,
              }]);
              console.log(`🔄 Salesforce sync: ${syncResult.synced} synced, ${syncResult.duplicates} duplicates`);
            }
            
            // Immediate Zapier sync for appointments
            if (survey.category === 'appointment' && survey.appointment) {
              const zapierResult = await SyncService.processSyncQueue([{
                type: 'appointment',
                data: { survey, appointment: survey.appointment },
                timestamp: survey.timestamp,
              }]);
              console.log(`🔄 Zapier sync: ${zapierResult.synced} synced`);
            }
            
            // Reload to reflect sync status
            await loadData();
          } catch (syncError) {
            console.warn('⚠️ Salesforce/Zapier sync failed (will retry automatically):', syncError);
          }
        }
      }
      
    } catch (error) {
      console.error('❌ CRITICAL ERROR: Local storage save failed:', error);
      throw new Error('Failed to save survey - device storage may be full or corrupted');
    }
  };
  
  const syncLocalDataToCloud = async () => {
    try {
      // STEP 1: Sync local failsafe storage → Supabase Cloud Database
      console.log('🔄 STEP 1: Syncing local storage → Cloud database...');
      const result = await StorageService.syncLocalDataToCloud();
      const totalSynced = result.surveySynced + result.timeSynced;
      const totalFailed = result.surveyFailed + result.timeFailed;
      
      if (totalSynced > 0) {
        console.log(`✅ Synced ${result.surveySynced} surveys and ${result.timeSynced} time entries to cloud database`);
        await loadData(); // Refresh UI to show cloud data
      }
      if (totalFailed > 0) {
        console.log(`⚠️ ${result.surveyFailed} surveys and ${result.timeFailed} time entries still pending cloud sync`);
      }
      
      // STEP 2: Sync Cloud Database → Salesforce/Zapier
      console.log('🔄 STEP 2: Syncing cloud database → Salesforce/Zapier...');
      const surveysData = await StorageService.getSurveys();
      
      // Find surveys that need Salesforce/Zapier sync
      const needsSalesforceSync = surveysData.filter(s => 
        !s.syncedToSalesforce && 
        s.category !== 'renter' && // Don't sync renters
        s.answers?.contact_info?.phone // Only sync if has phone
      );
      
      const needsZapierSync = surveysData.filter(s => 
        !s.syncedToZapier && 
        s.category === 'appointment' // Only appointments to Zapier
      );
      
      console.log(`📊 Found ${needsSalesforceSync.length} surveys for Salesforce, ${needsZapierSync.length} appointments for Zapier`);
      
      if (needsSalesforceSync.length > 0 || needsZapierSync.length > 0) {
        // Build sync queue for Salesforce/Zapier
        const syncQueue: any[] = [];
        
        // Add surveys for Salesforce
        needsSalesforceSync.forEach(survey => {
          syncQueue.push({
            type: 'survey',
            data: survey,
            timestamp: survey.timestamp,
          });
        });
        
        // Add appointments for Zapier
        needsZapierSync.forEach(survey => {
          if (survey.appointment) {
            syncQueue.push({
              type: 'appointment',
              data: { survey, appointment: survey.appointment },
              timestamp: survey.timestamp,
            });
          }
        });
        
        if (syncQueue.length > 0) {
          console.log(`🔄 Processing ${syncQueue.length} items for Salesforce/Zapier sync...`);
          const syncResult = await SyncService.processSyncQueue(syncQueue);
          console.log(`✅ Salesforce/Zapier sync complete: ${syncResult.synced} synced, ${syncResult.failed} failed, ${syncResult.duplicates} duplicates`);
          
          // Reload to reflect sync status updates
          await loadData();
        }
      }
      
    } catch (error) {
      console.error('Error syncing local data:', error);
    }
  };

  const syncData = async () => {
    const queue = await StorageService.getSyncQueue();
    if (queue && queue.length > 0) {
      await SyncService.processSyncQueue(queue);
      await StorageService.clearSyncQueue();
    }
  };

  const getClockedInEmployees = async () => {
    const entries = await StorageService.getTimeEntries();
    const employeesData = await StorageService.getEmployees();
    const surveysData = await StorageService.getSurveys();
    
    if (!entries || !employeesData) return [];
    
    const today = new Date().toISOString().split('T')[0];
    const activeClockedIn = entries.filter(e => !e.clockOut);
    
    return activeClockedIn.map(timeEntry => {
      const employee = employeesData.find(emp => emp.id === timeEntry.employeeId);
      const todaySurveys = surveysData?.filter(s => 
        s.employeeId === timeEntry.employeeId && 
        s.timestamp.startsWith(today)
      ) || [];
      
      return {
        employee: employee!,
        timeEntry,
        todayStats: {
          surveys: todaySurveys.filter(s => s.category === 'survey').length,
          appointments: todaySurveys.filter(s => s.category === 'appointment').length,
        },
      };
    }).filter(item => item.employee);
  };

  return (
    <AppContext.Provider
      value={{
        currentUser,
        isOnline,
        activeTimeEntry,
        selectedStore,
        dailyCounts,
        employees,
        surveys,
        schedules,
        messages,
        timeOffRequests,
        login,
        logout,
        selectStore,
        clockIn,
        clockOut,
        setKioskActive,
        updateLastActivity,
        calculateDailyStats,
        submitSurvey,
        loadData,
        syncData,
        getClockedInEmployees,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}
