// Salesforce Field Metadata Service - Fetches real fields from Salesforce API via Edge Function

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
 * Fetch all Lead object fields from Salesforce API via Edge Function
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

    console.log('🔄 Fetching Lead fields from Salesforce via Edge Function...');
    
    // Call Edge Function to fetch fields
    const { getSupabaseClient } = require('@/template');
    const supabase = getSupabaseClient();
    const { FunctionsHttpError } = require('@supabase/supabase-js');
    
    const { data, error } = await supabase.functions.invoke('salesforce-sync', {
      body: { action: 'fetch_lead_fields' },
    });
    
    if (error) {
      let errorMessage = error.message || String(error);
      if (error instanceof FunctionsHttpError) {
        try {
          const statusCode = error.context?.status ?? 500;
          const textContent = await error.context?.text();
          errorMessage = `[Code: ${statusCode}] ${textContent || error.message || 'Unknown error'}`;
        } catch {}
      }
      throw new Error(errorMessage);
    }
    
    if (!data.success || !data.fields) {
      throw new Error('Failed to fetch fields from Salesforce');
    }
    
    const fields: SalesforceField[] = data.fields;
    
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
