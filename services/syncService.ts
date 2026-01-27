// Sync service for Salesforce and Zapier integration
import NetInfo from '@react-native-community/netinfo';
import { Survey, TimeEntry, Appointment } from '@/types';
import * as StorageService from './storageService';
import { lookupZipCode } from './zipLookupService';

// ============================================================
// CONFIGURATION - UPDATE WITH YOUR CREDENTIALS
// ============================================================

// State name to abbreviation mapping
const STATE_ABBREVIATIONS: { [key: string]: string } = {
  // Full names to abbreviations
  'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
  'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
  'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
  'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
  'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
  'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
  'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
  'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
  'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
  'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
  'district of columbia': 'DC', 'puerto rico': 'PR',
};

// Convert state to abbreviation
const getStateAbbreviation = (state: string): string => {
  if (!state) return '';
  
  const trimmed = state.trim();
  
  // If already 2 characters, assume it's an abbreviation
  if (trimmed.length === 2) {
    return trimmed.toUpperCase();
  }
  
  // Look up full name
  const abbr = STATE_ABBREVIATIONS[trimmed.toLowerCase()];
  return abbr || trimmed; // Return original if not found
};

// Salesforce Configuration
export const SALESFORCE_CONFIG = {
  instanceUrl: 'https://rainsoftse.my.salesforce.com',
  clientId: '3MVG9uudbyLbNPZOVAuKR02gSIspVipjLsqn.uFTfCA67gYvmarMV7HvBPuPVb2.oAqFn8eLxG3MuAfLiSpNO',
  clientSecret: '11173C4B71CA90A7E860D9E31D908AB5CF221CAE6CB9E859B16ED5D6DD6F8002',
  username: 'rebecca@rainsoftse.com',
  password: '06RAPPAR.!',
  securityToken: '', // IP Relaxation enabled - no security token needed
};

// Zapier Webhook Configuration
const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/2072141/uqgcl4y/';

// ============================================================
// NETWORK CONNECTIVITY
// ============================================================

export const isOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
};

// ============================================================
// SALESFORCE INTEGRATION
// ============================================================

interface SalesforceAuthResponse {
  access_token: string;
  instance_url: string;
  token_type: string;
}

let salesforceAccessToken: string | null = null;
let salesforceTokenExpiry: number = 0;

// Authenticate with Salesforce
export const authenticateSalesforce = async (): Promise<string> => {
  // Check if we have a valid token
  if (salesforceAccessToken && Date.now() < salesforceTokenExpiry) {
    return salesforceAccessToken;
  }

  try {
    const tokenUrl = `${SALESFORCE_CONFIG.instanceUrl}/services/oauth2/token`;
    
    const response = await fetch(tokenUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'password',
        client_id: SALESFORCE_CONFIG.clientId,
        client_secret: SALESFORCE_CONFIG.clientSecret,
        username: SALESFORCE_CONFIG.username,
        password: SALESFORCE_CONFIG.password + SALESFORCE_CONFIG.securityToken,
      }).toString(),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce auth failed: ${response.status} - ${errorText}`);
    }

    const data: SalesforceAuthResponse = await response.json();
    salesforceAccessToken = data.access_token;
    // Token expires in 2 hours, we'll refresh after 1.5 hours
    salesforceTokenExpiry = Date.now() + (90 * 60 * 1000);
    
    console.log('✅ Salesforce authenticated successfully');
    return salesforceAccessToken;
  } catch (error) {
    console.error('❌ Salesforce authentication failed:', error);
    throw error;
  }
};

// Format phone number to Salesforce format (999) 999-9999
const formatPhoneNumber = (phone: string): string => {
  if (!phone) return '';
  
  // Remove all non-digits
  const digits = phone.replace(/\D/g, '');
  
  // If not 10 digits, return as-is
  if (digits.length !== 10) return phone;
  
  // Format as (999) 999-9999
  return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
};

// Get value from nested object path
const getNestedValue = (obj: any, path: string): any => {
  const keys = path.split('.');
  let value = obj;
  for (const key of keys) {
    value = value?.[key];
    if (value === undefined) return '';
  }
  return value;
};

// Map survey data to Salesforce Lead/Contact fields using stored configuration
const mapSurveyToSalesforceFields = async (survey: Survey) => {
  const answers = survey.answers;
  
  // Auto-lookup missing city/state from zip code before syncing
  if (answers.contact_info?.zipCode && (!answers.contact_info?.city || !answers.contact_info?.state)) {
    console.log('🔍 Missing city/state - attempting zip lookup before sync...');
    const lookupResult = await lookupZipCode(answers.contact_info.zipCode, false);
    
    if (lookupResult.success && lookupResult.city && lookupResult.stateAbbr) {
      // Update survey answers with looked up data
      answers.contact_info.city = lookupResult.city;
      answers.contact_info.state = lookupResult.stateAbbr;
      console.log(`✅ Zip lookup successful: ${lookupResult.city}, ${lookupResult.stateAbbr}`);
      
      // Save updated survey data
      const surveys = await StorageService.getSurveys() || [];
      const surveyIndex = surveys.findIndex(s => s.id === survey.id);
      if (surveyIndex !== -1) {
        surveys[surveyIndex].answers = answers;
        await StorageService.saveSurveys(surveys);
      }
    } else {
      console.warn('⚠️ Zip lookup failed during sync - proceeding with zip code only');
    }
  }
  
  // Load custom field mappings
  const customMappings = await StorageService.getData('salesforce_field_mapping');
  
  // Determine store-specific values
  const isLowes = survey.store === 'lowes';
  const leadSource = isLowes ? 'Lowes' : 'HDS';
  const recordTypeId = isLowes ? '012Rl000007imrJIAQ' : '01236000001QBdgAAG';
  const giftValue = isLowes ? '$20 Lowes GC' : '$20 HD Card';
  
  // Map tastes/odors answer to backend format
  const tastesOdorsValue = answers.tastes_odors === 'Yes' ? 'tastes, odors' : 'no problems';
  
  // If no custom mappings, use defaults
  if (!customMappings || customMappings.length === 0) {
    return {
      FirstName: answers.contact_info?.firstName || '',
      LastName: answers.contact_info?.lastName || '',
      Phone: formatPhoneNumber(answers.contact_info?.phone || ''),
      Street: answers.contact_info?.address || '',
      City: answers.contact_info?.city || '',
      State: getStateAbbreviation(answers.contact_info?.state || ''),
      PostalCode: answers.contact_info?.zipCode || '',
      Buys_Bottled_Water__c: answers.buys_bottled_water === 'Yes',
      Is_Homeowner__c: answers.is_homeowner === 'Yes',
      Uses_Filters__c: answers.uses_filters === 'Yes',
      Tastes_Odors__c: tastesOdorsValue,
      Water_Quality__c: answers.water_quality,
      Water_Source__c: answers.water_source,
      Property_Type__c: answers.property_type,
      Survey_Store__c: isLowes ? 'Lowes' : 'Home Depot',
      Survey_Date__c: survey.timestamp,
      Survey_Employee_ID__c: survey.employeeId,
      Survey_Employee_Alias__c: survey.employeeAlias || '',
      Survey_ID__c: survey.id,
      Has_Signature__c: Boolean(survey.signature),
      RecordTypeId: recordTypeId,
      LeadSource: leadSource,
      gift__c: giftValue,
    };
  }
  
  // Build Salesforce object from custom mappings with store-specific defaults
  const salesforceData: any = {
    RecordTypeId: recordTypeId,
    LeadSource: leadSource,
    gift__c: giftValue,
  };
  
  for (const mapping of customMappings) {
    const { surveyField, salesforceField, fieldType } = mapping;
    
    if (surveyField.startsWith('_')) {
      const metadataKey = surveyField.substring(1);
      // Map metadata fields
      if (metadataKey === 'store') {
        salesforceData[salesforceField] = survey.store === 'lowes' ? 'Lowes' : 'Home Depot';
      } else if (metadataKey === 'timestamp') {
        salesforceData[salesforceField] = survey.timestamp;
      } else if (metadataKey === 'employeeId') {
        salesforceData[salesforceField] = survey.employeeId;
      } else if (metadataKey === 'employeeAlias') {
        salesforceData[salesforceField] = survey.employeeAlias || '';
      } else if (metadataKey === 'surveyId') {
        salesforceData[salesforceField] = survey.id;
      } else if (metadataKey === 'hasSignature') {
        salesforceData[salesforceField] = Boolean(survey.signature);
      }
    } else {
      // Map survey answer fields
      let value = getNestedValue(answers, surveyField);
      
      // Special handling for tastes_odors field
      if (surveyField === 'tastes_odors') {
        value = value === 'Yes' ? 'tastes, odors' : 'no problems';
      }
      
      // Special handling for state field - always use abbreviation
      if (surveyField === 'contact_info.state') {
        value = getStateAbbreviation(value);
      }
      
      // Special handling for phone field - format to Salesforce format
      if (surveyField === 'contact_info.phone' || surveyField === 'phone') {
        value = formatPhoneNumber(value);
      }
      
      if (fieldType === 'boolean') {
        salesforceData[salesforceField] = value === 'Yes' || value === 'yes' || value === true;
      } else if (fieldType === 'date') {
        salesforceData[salesforceField] = value;
      } else {
        salesforceData[salesforceField] = value || '';
      }
    }
  }
  
  return salesforceData;
};

// Check for duplicates in Salesforce
const checkSalesforceDuplicate = async (
  accessToken: string,
  phone: string
): Promise<boolean> => {
  try {
    const queryUrl = `${SALESFORCE_CONFIG.instanceUrl}/services/data/v57.0/query`;
    const query = `SELECT Id FROM Lead WHERE Phone = '${phone}' LIMIT 1`;
    
    const response = await fetch(
      `${queryUrl}?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.warn('⚠️ Duplicate check failed, proceeding with sync');
      return false;
    }

    const data = await response.json();
    return data.totalSize > 0;
  } catch (error) {
    console.warn('⚠️ Duplicate check error:', error);
    return false; // Proceed with sync if check fails
  }
};

// Verify if a record exists in Salesforce by ID
export const verifySalesforceRecord = async (
  recordId: string
): Promise<{ exists: boolean; recordUrl?: string; error?: string }> => {
  try {
    const accessToken = await authenticateSalesforce();
    
    // Query for the specific record
    const queryUrl = `${SALESFORCE_CONFIG.instanceUrl}/services/data/v57.0/sobjects/Lead/${recordId}`;
    
    const response = await fetch(queryUrl, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (response.ok) {
      const recordUrl = `${SALESFORCE_CONFIG.instanceUrl}/lightning/r/Lead/${recordId}/view`;
      return { exists: true, recordUrl };
    } else if (response.status === 404) {
      return { exists: false, error: 'Record not found in Salesforce' };
    } else {
      const errorText = await response.text();
      return { exists: false, error: `Verification failed: ${response.status} - ${errorText}` };
    }
  } catch (error) {
    return { exists: false, error: String(error) };
  }
};

// Sync survey to Salesforce as a Lead
export const syncToSalesforce = async (
  survey: Survey
): Promise<{ success: boolean; isDuplicate?: boolean; salesforceId?: string }> => {
  try {
    console.log('🔄 Starting Salesforce sync for survey:', survey.id);
    
    // Authenticate
    const accessToken = await authenticateSalesforce();
    
    // Check for duplicates if phone number exists
    const phone = survey.answers.phone;
    if (phone) {
      const isDuplicate = await checkSalesforceDuplicate(accessToken, phone);
      if (isDuplicate) {
        console.log('⚠️ Duplicate found in Salesforce:', phone);
        return { success: true, isDuplicate: true };
      }
    }
    
    // Map survey data to Salesforce fields
    const salesforceData = await mapSurveyToSalesforceFields(survey);
    
    // Create Lead in Salesforce
    const createUrl = `${SALESFORCE_CONFIG.instanceUrl}/services/data/v57.0/sobjects/Lead`;
    
    const response = await fetch(createUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(salesforceData),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce sync failed: ${response.status} - ${errorText}`);
    }

    const result = await response.json();
    console.log('✅ Survey synced to Salesforce:', result.id);
    
    return { 
      success: true, 
      isDuplicate: false,
      salesforceId: result.id,
    };
  } catch (error) {
    console.error('❌ Salesforce sync error:', error);
    throw error;
  }
};

// ============================================================
// ZAPIER WEBHOOK INTEGRATION
// ============================================================

// Send appointment to Zapier
export const sendToZapier = async (data: {
  survey: Survey;
  appointment: Appointment;
}): Promise<boolean> => {
  try {
    console.log('🔄 Sending appointment to Zapier:', data.appointment);
    
    // Prepare webhook payload
    const payload = {
      // Survey questions and answers
      buys_bottled_water: data.survey.answers.buys_bottled_water,
      is_homeowner: data.survey.answers.is_homeowner,
      has_salt_system: data.survey.answers.has_salt_system,
      water_quality: data.survey.answers.water_quality,
      water_source: data.survey.answers.water_source,
      current_treatment: data.survey.answers.current_treatment,
      property_type: data.survey.answers.property_type,
      
      // Contact information
      first_name: data.survey.answers.contact_info?.firstName || '',
      last_name: data.survey.answers.contact_info?.lastName || '',
      phone: data.survey.answers.phone || '',
      address: data.appointment.address,
      city: data.survey.answers.contact_info?.city || '',
      state: data.survey.answers.contact_info?.state || '',
      zip_code: data.survey.answers.contact_info?.zipCode || '',
      
      // Appointment details
      appointment_date: data.appointment.date,
      appointment_time: data.appointment.time,
      appointment_notes: data.appointment.notes || '',
      
      // Metadata
      store: data.survey.store === 'lowes' ? 'Lowes' : 'Home Depot',
      survey_date: data.survey.timestamp,
      employee_id: data.survey.employeeId,
      employee_alias: data.survey.employeeAlias || '',
      survey_id: data.survey.id,
    };
    
    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Zapier webhook failed: ${response.status} - ${errorText}`);
    }

    console.log('✅ Appointment sent to Zapier successfully');
    return true;
  } catch (error) {
    console.error('❌ Zapier webhook error:', error);
    throw error;
  }
};

// ============================================================
// SYNC QUEUE PROCESSING
// ============================================================

interface SyncQueueItem {
  type: 'survey' | 'appointment';
  data: any;
  timestamp: string;
  retryCount?: number;
}

const MAX_RETRIES = 3;

export const processSyncQueue = async (
  queue: SyncQueueItem[]
): Promise<{ synced: number; failed: number; duplicates: number }> => {
  const online = await isOnline();
  if (!online) {
    console.log('📴 Offline - skipping sync (data remains safely in queue)');
    return { synced: 0, failed: 0, duplicates: 0 };
  }
  
  console.log(`🔄 Processing ${queue.length} items in sync queue...`);
  
  let syncedCount = 0;
  let failedCount = 0;
  let duplicateCount = 0;
  const itemsToKeep: SyncQueueItem[] = [];
  
  for (const item of queue) {
    try {
      const retryCount = item.retryCount || 0;
      console.log(`🔄 Syncing ${item.type} (attempt ${retryCount + 1}):`, item.data.id);
      
      if (item.type === 'survey') {
        const survey = item.data as Survey;
        
        // Only sync surveys from homeowners with phone numbers
        if (survey.category === 'renter') {
          console.log('⏭️ Skipping renter survey (not synced to Salesforce)');
          syncedCount++;
          continue;
        }
        
        // Check if survey has required contact information
        const hasPhone = survey.answers?.contact_info?.phone;
        if (!hasPhone) {
          console.log('⏭️ Skipping survey without phone number');
          syncedCount++;
          continue;
        }
        
        try {
          const result = await syncToSalesforce(survey);
          
          if (result.isDuplicate) {
            console.log('⚠️ Duplicate detected, adding to review queue:', survey.id);
            duplicateCount++;
            
            // Mark survey as duplicate in storage
            const surveys = await StorageService.getSurveys() || [];
            const surveyIndex = surveys.findIndex(s => s.id === survey.id);
            if (surveyIndex !== -1) {
              surveys[surveyIndex].isDuplicate = true;
              surveys[surveyIndex].syncedToSalesforce = true;
              surveys[surveyIndex].syncError = undefined; // Clear any previous errors
              await StorageService.saveSurveys(surveys);
            }
          } else {
            // Mark as synced and store Salesforce ID
            const surveys = await StorageService.getSurveys() || [];
            const surveyIndex = surveys.findIndex(s => s.id === survey.id);
            if (surveyIndex !== -1) {
              surveys[surveyIndex].syncedToSalesforce = true;
              surveys[surveyIndex].salesforceId = result.salesforceId; // Store the Salesforce record ID
              surveys[surveyIndex].syncError = undefined; // Clear any previous errors
              await StorageService.saveSurveys(surveys);
            }
          }
          
          console.log('✅ Survey synced to Salesforce');
          syncedCount++;
        } catch (error) {
          // Don't catch the error here - let it propagate to the outer catch block
          throw error;
        }
      } else if (item.type === 'appointment') {
        const { survey, appointment } = item.data;
        await sendToZapier({ survey, appointment });
        
        // Mark as synced
        const surveys = await StorageService.getSurveys() || [];
        const surveyIndex = surveys.findIndex(s => s.id === survey.id);
        if (surveyIndex !== -1) {
          surveys[surveyIndex].syncedToZapier = true;
          surveys[surveyIndex].syncError = undefined; // Clear any previous errors
          await StorageService.saveSurveys(surveys);
        }
        
        console.log('✅ Appointment sent to Zapier');
        syncedCount++;
      }
    } catch (error) {
      console.error(`❌ Sync failed for ${item.type}:`, item.data.id, error);
      
      const retryCount = (item.retryCount || 0) + 1;
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Save error to survey/appointment for UI display
      if (item.type === 'survey' || item.type === 'appointment') {
        const survey = item.type === 'survey' ? item.data : item.data.survey;
        const surveys = await StorageService.getSurveys() || [];
        const surveyIndex = surveys.findIndex(s => s.id === survey.id);
        if (surveyIndex !== -1) {
          surveys[surveyIndex].syncError = errorMessage;
          surveys[surveyIndex].syncedToSalesforce = false;
          if (item.type === 'appointment') {
            surveys[surveyIndex].syncedToZapier = false;
          }
          await StorageService.saveSurveys(surveys);
        }
      }
      
      if (retryCount < MAX_RETRIES) {
        // Keep in queue for retry
        itemsToKeep.push({ ...item, retryCount });
        console.log(`⏳ Will retry (${retryCount}/${MAX_RETRIES})`);
      } else {
        // Max retries reached
        console.error(`❌ Max retries reached for ${item.type}, removing from queue`);
        failedCount++;
        
        // Save to failed log
        await StorageService.addFailedSyncItem({
          ...item,
          failedAt: new Date().toISOString(),
          error: errorMessage,
        });
      }
    }
  }
  
  // Update sync queue with failed items
  await StorageService.saveData('sync_queue', itemsToKeep);
  
  // Save sync stats
  await StorageService.addSyncLog({
    timestamp: new Date().toISOString(),
    synced: syncedCount,
    failed: failedCount,
    duplicates: duplicateCount,
    queueSize: itemsToKeep.length,
  });
  
  console.log(`✅ Sync complete: ${syncedCount} synced, ${failedCount} failed permanently, ${duplicateCount} duplicates detected`);
  return { synced: syncedCount, failed: failedCount, duplicates: duplicateCount };
};

// ============================================================
// BACKGROUND SYNC
// ============================================================

let syncInterval: NodeJS.Timeout | null = null;

// Start background sync (every 5 minutes)
export const startBackgroundSync = async () => {
  if (syncInterval) {
    console.log('⚠️ Background sync already running');
    return;
  }
  
  console.log('🔄 Starting background sync (5 min intervals)');
  
  // Initial sync
  const queue = await StorageService.getSyncQueue();
  if (queue && queue.length > 0) {
    await processSyncQueue(queue);
  }
  
  // Set up interval
  syncInterval = setInterval(async () => {
    const online = await isOnline();
    if (!online) {
      console.log('📴 Offline - skipping background sync');
      return;
    }
    
    const currentQueue = await StorageService.getSyncQueue();
    if (currentQueue && currentQueue.length > 0) {
      console.log('🔄 Background sync triggered');
      await processSyncQueue(currentQueue);
    }
  }, 5 * 60 * 1000); // 5 minutes
};

// Stop background sync
export const stopBackgroundSync = () => {
  if (syncInterval) {
    clearInterval(syncInterval);
    syncInterval = null;
    console.log('⏹️ Background sync stopped');
  }
};

// Immediate sync (triggered after survey completion)
export const triggerImmediateSync = async () => {
  const online = await isOnline();
  if (!online) {
    console.log('📴 Offline - sync will happen when online');
    return { synced: 0, failed: 0, duplicates: 0 };
  }
  
  const queue = await StorageService.getSyncQueue();
  if (!queue || queue.length === 0) {
    console.log('✓ Sync queue empty');
    return { synced: 0, failed: 0, duplicates: 0 };
  }
  
  console.log('⚡ Immediate sync triggered');
  return await processSyncQueue(queue);
};

// Test webhook connectivity
export const testWebhookConnection = async () => {
  try {
    const testPayload = {
      test: true,
      timestamp: new Date().toISOString(),
      message: 'RainSoft Survey App - Connection Test',
    };
    
    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testPayload),
    });
    
    if (response.ok) {
      return { success: true, message: 'Webhook connection successful' };
    } else {
      return { success: false, message: `HTTP ${response.status}: ${response.statusText}` };
    }
  } catch (error) {
    return { success: false, message: String(error) };
  }
};

// Test Salesforce connection
export const testSalesforceConnection = async () => {
  try {
    const accessToken = await authenticateSalesforce();
    
    // Query to test connection
    const queryUrl = `${SALESFORCE_CONFIG.instanceUrl}/services/data/v57.0/query`;
    const query = 'SELECT Id FROM Lead LIMIT 1';
    
    const response = await fetch(
      `${queryUrl}?q=${encodeURIComponent(query)}`,
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      }
    );
    
    if (response.ok) {
      return { success: true, message: 'Salesforce connection successful' };
    } else {
      const errorText = await response.text();
      return { success: false, message: `HTTP ${response.status}: ${errorText}` };
    }
  } catch (error) {
    return { success: false, message: String(error) };
  }
};

// ============================================================
// ADP INTEGRATION (Deno Deploy Bridge)
// ============================================================

// ADP Deno Deploy bridge URL - Update this with your deployed Deno URL
export const ADP_BRIDGE_URL = 'YOUR_DENO_DEPLOY_URL_HERE'; // e.g., 'https://your-project.deno.dev'

// Test ADP connection via Deno bridge
export const testADPConnection = async () => {
  if (!ADP_BRIDGE_URL || ADP_BRIDGE_URL === 'YOUR_DENO_DEPLOY_URL_HERE') {
    return { 
      success: false, 
      message: 'ADP bridge URL not configured. Please update ADP_BRIDGE_URL in syncService.ts with your Deno Deploy URL' 
    };
  }

  try {
    const healthUrl = `${ADP_BRIDGE_URL}/health`;
    
    const response = await fetch(healthUrl, {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      return { 
        success: false, 
        message: `ADP bridge unreachable: ${response.status} - ${errorText}` 
      };
    }
    
    const healthData = await response.json();
    
    // Check if the bridge is properly configured
    if (healthData.status === 'healthy') {
      const config = healthData.configuration || {};
      const isReady = config.adp_credentials && config.ssl_certificates && config.supabase_config;
      
      if (isReady) {
        return { 
          success: true, 
          message: 'ADP bridge online and fully configured' 
        };
      } else {
        const missing = [];
        if (!config.adp_credentials) missing.push('ADP credentials');
        if (!config.ssl_certificates) missing.push('SSL certificates');
        if (!config.supabase_config) missing.push('Supabase config');
        
        return { 
          success: false, 
          message: `ADP bridge online but missing: ${missing.join(', ')}` 
        };
      }
    } else {
      return { 
        success: false, 
        message: `ADP bridge status: ${healthData.status || 'unknown'}` 
      };
    }
  } catch (error) {
    return { 
      success: false, 
      message: `Cannot connect to ADP bridge: ${String(error)}` 
    };
  }
};

// Manually trigger ADP sync for time entries
export const syncTimeEntriesToADP = async () => {
  if (!ADP_BRIDGE_URL || ADP_BRIDGE_URL === 'YOUR_DENO_DEPLOY_URL_HERE') {
    throw new Error('ADP bridge URL not configured');
  }

  const online = await isOnline();
  if (!online) {
    throw new Error('No internet connection');
  }

  try {
    const syncUrl = `${ADP_BRIDGE_URL}/sync/time-entries`;
    const syncSecret = await StorageService.getData('adp_sync_secret'); // Store this securely
    
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': syncSecret ? `Bearer ${syncSecret}` : '',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ADP sync failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('❌ ADP time entry sync error:', error);
    throw error;
  }
};

// Manually trigger ADP sync for employee onboarding
export const syncEmployeesToADP = async () => {
  if (!ADP_BRIDGE_URL || ADP_BRIDGE_URL === 'YOUR_DENO_DEPLOY_URL_HERE') {
    throw new Error('ADP bridge URL not configured');
  }

  const online = await isOnline();
  if (!online) {
    throw new Error('No internet connection');
  }

  try {
    const syncUrl = `${ADP_BRIDGE_URL}/sync/employees`;
    const syncSecret = await StorageService.getData('adp_sync_secret');
    
    const response = await fetch(syncUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': syncSecret ? `Bearer ${syncSecret}` : '',
      },
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`ADP sync failed: ${response.status} - ${errorText}`);
    }
    
    const result = await response.json();
    return result;
  } catch (error) {
    console.error('❌ ADP employee sync error:', error);
    throw error;
  }
};
