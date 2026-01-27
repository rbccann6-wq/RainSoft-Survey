// Salesforce Field Metadata Service - Fetches real fields from Salesforce API
import { authenticateSalesforce, SALESFORCE_CONFIG } from './syncService';

export interface SalesforceField {
  name: string;
  label: string;
  type: string;
  custom: boolean;
  length?: number;
  picklistValues?: string[];
  referenceTo?: string[];
  required: boolean;
}

let cachedLeadFields: SalesforceField[] | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 30 * 60 * 1000; // 30 minutes

/**
 * Fetch all Lead object fields from Salesforce API
 */
export const fetchSalesforceLeadFields = async (): Promise<{
  success: boolean;
  fields?: SalesforceField[];
  error?: string;
}> => {
  try {
    // Check cache first
    if (cachedLeadFields && Date.now() - cacheTimestamp < CACHE_DURATION) {
      console.log('✓ Using cached Salesforce Lead fields');
      return { success: true, fields: cachedLeadFields };
    }

    console.log('🔄 Fetching Lead fields from Salesforce...');
    
    // Authenticate with Salesforce
    const accessToken = await authenticateSalesforce();
    
    // Describe Lead object to get all fields
    const describeUrl = `${SALESFORCE_CONFIG.instanceUrl}/services/data/v57.0/sobjects/Lead/describe`;
    
    const response = await fetch(describeUrl, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Salesforce API error: ${response.status} - ${errorText}`);
    }

    const metadata = await response.json();
    
    // Extract and format field information
    const fields: SalesforceField[] = metadata.fields.map((field: any) => ({
      name: field.name,
      label: field.label,
      type: mapSalesforceType(field.type),
      custom: field.custom,
      length: field.length,
      picklistValues: field.picklistValues?.map((pv: any) => pv.value) || [],
      referenceTo: field.referenceTo || [],
      required: !field.nillable && !field.defaultedOnCreate,
    }));

    // Sort: Standard fields first, then custom fields, alphabetically within each group
    fields.sort((a, b) => {
      if (a.custom === b.custom) {
        return a.label.localeCompare(b.label);
      }
      return a.custom ? 1 : -1;
    });

    // Cache the results
    cachedLeadFields = fields;
    cacheTimestamp = Date.now();

    console.log(`✅ Fetched ${fields.length} Lead fields from Salesforce`);
    console.log(`   - Standard fields: ${fields.filter(f => !f.custom).length}`);
    console.log(`   - Custom fields: ${fields.filter(f => f.custom).length}`);
    
    return { success: true, fields };
  } catch (error) {
    console.error('❌ Failed to fetch Salesforce fields:', error);
    return { 
      success: false, 
      error: error instanceof Error ? error.message : String(error),
    };
  }
};

/**
 * Map Salesforce field types to our simplified types
 */
function mapSalesforceType(sfType: string): string {
  const typeMap: Record<string, string> = {
    'string': 'text',
    'textarea': 'text',
    'email': 'text',
    'phone': 'text',
    'url': 'text',
    'picklist': 'picklist',
    'multipicklist': 'picklist',
    'boolean': 'boolean',
    'checkbox': 'boolean',
    'date': 'date',
    'datetime': 'datetime',
    'int': 'number',
    'double': 'number',
    'currency': 'number',
    'percent': 'number',
    'reference': 'reference',
    'id': 'text',
  };
  
  return typeMap[sfType.toLowerCase()] || 'text';
}

/**
 * Clear the cache (useful for testing or force refresh)
 */
export const clearFieldCache = () => {
  cachedLeadFields = null;
  cacheTimestamp = 0;
  console.log('✓ Salesforce field cache cleared');
};

/**
 * Test Salesforce connection and field access
 */
export const testSalesforceFieldAccess = async (): Promise<{
  success: boolean;
  message: string;
  fieldCount?: number;
}> => {
  const result = await fetchSalesforceLeadFields();
  
  if (result.success && result.fields) {
    return {
      success: true,
      message: `Connected to Salesforce successfully. Found ${result.fields.length} Lead fields.`,
      fieldCount: result.fields.length,
    };
  } else {
    return {
      success: false,
      message: result.error || 'Failed to connect to Salesforce',
    };
  }
};
