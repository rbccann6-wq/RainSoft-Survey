// Employee Survey Stats Sync Edge Function
// Syncs survey outcome statistics from Salesforce Reports to employee_survey_stats table
// Designed to run nightly via scheduled job

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface ReportRow {
  dataCells: Array<{ label: string; value: any }>;
}

interface SalesforceReportResults {
  reportMetadata: {
    name: string;
    detailColumns: string[];
  };
  factMap: {
    T?: {
      rows: ReportRow[];
    };
  };
  groupingsDown?: {
    groupings: Array<{
      label: string;
      value: string;
    }>;
  };
}

interface StatusMapping {
  salesforce_status: string;
  category: 'bad_contact' | 'dead' | 'still_contacting' | 'install' | 'demo';
  object_type: 'lead' | 'appointment';
}

interface EmployeeStats {
  employee_id: string;
  date: string;
  bad_contact_count: number;
  dead_count: number;
  still_contacting_count: number;
  install_count: number;
  demo_count: number;
  total_surveys: number;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    // Create Supabase admin client
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const syncStartTime = new Date().toISOString();
    console.log(`🔄 Starting stats sync at ${syncStartTime}`);

    // Create sync log entry
    const { data: syncLog, error: syncLogError } = await supabase
      .from('stats_sync_log')
      .insert({
        sync_started_at: syncStartTime,
        status: 'running',
      })
      .select()
      .single();

    if (syncLogError) {
      console.error('Failed to create sync log:', syncLogError);
    }

    const syncLogId = syncLog?.id;

    try {
      // Step 1: Load status mappings from database
      console.log('📋 Loading status mappings...');
      const { data: mappings, error: mappingsError } = await supabase
        .from('lead_status_mappings')
        .select('*');

      if (mappingsError) {
        throw new Error(`Failed to load status mappings: ${mappingsError.message}`);
      }

      if (!mappings || mappings.length === 0) {
        throw new Error('No status mappings configured. Please configure mappings in Admin → Survey Stats Config');
      }

      console.log(`✓ Loaded ${mappings.length} status mappings`);

      const statusMappings = mappings as StatusMapping[];
      const leadMappings = statusMappings.filter(m => m.object_type === 'lead');
      const appointmentMappings = statusMappings.filter(m => m.object_type === 'appointment');

      // Step 2: Get report IDs from environment (or use hardcoded IDs)
      const leadReportId = Deno.env.get('SALESFORCE_LEAD_REPORT_ID');
      const appointmentReportId = Deno.env.get('SALESFORCE_APPOINTMENT_REPORT_ID');

      if (!leadReportId && !appointmentReportId) {
        throw new Error(
          'Missing Salesforce Report IDs. Please set SALESFORCE_LEAD_REPORT_ID and/or SALESFORCE_APPOINTMENT_REPORT_ID in Cloud Secrets.\n\n' +
          'To find Report IDs:\n' +
          '1. Open your report in Salesforce\n' +
          '2. Copy the ID from URL: /lightning/r/Report/[REPORT_ID]/view\n' +
          '3. Add to Cloud → Secrets tab'
        );
      }

      const employeeStatsMap = new Map<string, EmployeeStats>();
      const today = new Date().toISOString().split('T')[0];

      // Step 3: Process Lead Report (if configured)
      if (leadReportId) {
        console.log(`📊 Fetching Lead report: ${leadReportId}`);
        
        const leadResponse = await fetch(`${supabaseUrl}/functions/v1/salesforce-sync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'run_report',
            data: { reportId: leadReportId },
          }),
        });

        if (!leadResponse.ok) {
          const errorText = await leadResponse.text();
          throw new Error(`Lead report fetch failed: ${leadResponse.status} - ${errorText}`);
        }

        const leadData = await leadResponse.json();
        const leadResults: SalesforceReportResults = leadData.results;

        console.log(`✓ Lead report returned ${leadResults.factMap?.T?.rows?.length || 0} rows`);

        // Process lead report rows
        // Expected columns: Surveyor, Status, Record Count
        if (leadResults.factMap?.T?.rows) {
          for (const row of leadResults.factMap.T.rows) {
            // Extract data from row (structure depends on your report)
            // dataCells[0] = Surveyor name, dataCells[1] = Status, dataCells[2] = Count
            const cells = row.dataCells;
            
            if (cells.length >= 3) {
              const surveyorName = String(cells[0].value || '').trim();
              const status = String(cells[1].value || '').trim();
              const count = parseInt(String(cells[2].value || '0'), 10);

              if (!surveyorName || !status || count === 0) continue;

              // Find category mapping
              const mapping = leadMappings.find(m => m.salesforce_status === status);
              if (!mapping) {
                console.log(`⚠️  Unmapped Lead status: "${status}" - skipping`);
                continue;
              }

              // Get or create employee stats entry (using surveyor name as key for now)
              const key = `${surveyorName}_${today}`;
              if (!employeeStatsMap.has(key)) {
                employeeStatsMap.set(key, {
                  employee_id: surveyorName, // Temporary: will be replaced with actual employee_id later
                  date: today,
                  bad_contact_count: 0,
                  dead_count: 0,
                  still_contacting_count: 0,
                  install_count: 0,
                  demo_count: 0,
                  total_surveys: 0,
                });
              }

              const stats = employeeStatsMap.get(key)!;
              stats[`${mapping.category}_count`] += count;
              stats.total_surveys += count;
            }
          }
        }
      }

      // Step 4: Process Appointment Report (if configured)
      if (appointmentReportId) {
        console.log(`📊 Fetching Appointment report: ${appointmentReportId}`);
        
        const appointmentResponse = await fetch(`${supabaseUrl}/functions/v1/salesforce-sync`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${supabaseServiceKey}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            action: 'run_report',
            data: { reportId: appointmentReportId },
          }),
        });

        if (!appointmentResponse.ok) {
          const errorText = await appointmentResponse.text();
          throw new Error(`Appointment report fetch failed: ${appointmentResponse.status} - ${errorText}`);
        }

        const appointmentData = await appointmentResponse.json();
        const appointmentResults: SalesforceReportResults = appointmentData.results;

        console.log(`✓ Appointment report returned ${appointmentResults.factMap?.T?.rows?.length || 0} rows`);

        // Process appointment report rows
        if (appointmentResults.factMap?.T?.rows) {
          for (const row of appointmentResults.factMap.T.rows) {
            const cells = row.dataCells;
            
            if (cells.length >= 3) {
              const surveyorName = String(cells[0].value || '').trim();
              const status = String(cells[1].value || '').trim();
              const count = parseInt(String(cells[2].value || '0'), 10);

              if (!surveyorName || !status || count === 0) continue;

              // Find category mapping
              const mapping = appointmentMappings.find(m => m.salesforce_status === status);
              if (!mapping) {
                console.log(`⚠️  Unmapped Appointment status: "${status}" - skipping`);
                continue;
              }

              // Get or create employee stats entry (using surveyor name as key for now)
              const key = `${surveyorName}_${today}`;
              if (!employeeStatsMap.has(key)) {
                employeeStatsMap.set(key, {
                  employee_id: surveyorName, // Temporary: will be replaced with actual employee_id later
                  date: today,
                  bad_contact_count: 0,
                  dead_count: 0,
                  still_contacting_count: 0,
                  install_count: 0,
                  demo_count: 0,
                  total_surveys: 0,
                });
              }

              const stats = employeeStatsMap.get(key)!;
              stats[`${mapping.category}_count`] += count;
              stats.total_surveys += count;
            }
          }
        }
      }

      // Step 5: Match Salesforce Surveyor field to employee IDs using alias
      console.log('🔍 Matching Salesforce Surveyor field to employees...');
      
      // Get all employees with alias field
      const { data: employees, error: employeesError } = await supabase
        .from('employees')
        .select('id, alias, first_name, last_name, email');

      if (employeesError) {
        throw new Error(`Failed to load employees: ${employeesError.message}`);
      }

      // Create mapping: Surveyor value → Employee ID
      // Priority:
      // 1. Exact alias match (case-insensitive)
      // 2. Fallback to name variations for backwards compatibility
      const surveyorMap = new Map<string, string>();
      for (const emp of employees || []) {
        const alias = emp.alias?.trim() || '';
        const firstName = emp.first_name?.trim() || '';
        const lastName = emp.last_name?.trim() || '';
        const fullName = `${firstName} ${lastName}`.trim();
        const reverseName = `${lastName}, ${firstName}`.trim();
        const emailPrefix = emp.email?.split('@')[0]?.trim() || '';
        
        // PRIORITY 1: Alias (exact match, case-insensitive)
        if (alias) {
          surveyorMap.set(alias, emp.id);
          surveyorMap.set(alias.toLowerCase(), emp.id);
        }
        
        // PRIORITY 2: Name variations (fallback for employees without alias set)
        if (fullName) surveyorMap.set(fullName, emp.id);
        if (reverseName) surveyorMap.set(reverseName, emp.id);
        if (firstName) surveyorMap.set(firstName, emp.id);
        if (lastName) surveyorMap.set(lastName, emp.id);
        if (emailPrefix) surveyorMap.set(emailPrefix, emp.id);
        
        // Also try lowercase versions for case-insensitive matching
        if (fullName) surveyorMap.set(fullName.toLowerCase(), emp.id);
        if (reverseName) surveyorMap.set(reverseName.toLowerCase(), emp.id);
        if (firstName) surveyorMap.set(firstName.toLowerCase(), emp.id);
        if (lastName) surveyorMap.set(lastName.toLowerCase(), emp.id);
      }

      // Update employee stats with correct employee IDs
      const finalStats: EmployeeStats[] = [];
      const unmatchedSurveyors = new Set<string>();
      const matchedByAlias: string[] = [];
      const matchedByName: string[] = [];
      
      for (const [key, stats] of employeeStatsMap.entries()) {
        const surveyorValue = stats.employee_id;
        
        // Try to find employee ID (case-sensitive first, then case-insensitive)
        let employeeId = surveyorMap.get(surveyorValue) || surveyorMap.get(surveyorValue.toLowerCase());
        
        if (!employeeId) {
          unmatchedSurveyors.add(surveyorValue);
          console.log(`⚠️  No employee found for Surveyor: "${surveyorValue}" - skipping`);
          continue;
        }

        // Track how the match was made for logging
        const matchedEmployee = (employees || []).find(e => e.id === employeeId);
        if (matchedEmployee?.alias?.toLowerCase() === surveyorValue.toLowerCase()) {
          matchedByAlias.push(surveyorValue);
        } else {
          matchedByName.push(surveyorValue);
        }

        finalStats.push({
          ...stats,
          employee_id: employeeId,
        });
      }

      console.log(`✓ Matched ${finalStats.length} employee stat records`);
      console.log(`   - Matched by alias: ${matchedByAlias.length}`);
      console.log(`   - Matched by name: ${matchedByName.length}`);
      
      if (unmatchedSurveyors.size > 0) {
        console.log(`⚠️  Unmatched surveyors (${unmatchedSurveyors.size}): ${Array.from(unmatchedSurveyors).join(', ')}`);
        console.log(`   TIP: Set the 'alias' field in employee records to match the Salesforce Surveyor field exactly`);
      }

      // Step 6: Upsert to employee_survey_stats table
      if (finalStats.length > 0) {
        console.log('💾 Saving stats to database...');
        
        for (const stat of finalStats) {
          const { error: upsertError } = await supabase
            .from('employee_survey_stats')
            .upsert({
              employee_id: stat.employee_id,
              date: stat.date,
              bad_contact_count: stat.bad_contact_count,
              dead_count: stat.dead_count,
              still_contacting_count: stat.still_contacting_count,
              install_count: stat.install_count,
              demo_count: stat.demo_count,
              total_surveys: stat.total_surveys,
              last_synced_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            }, {
              onConflict: 'employee_id,date',
            });

          if (upsertError) {
            console.error(`Failed to upsert stats for employee ${stat.employee_id}:`, upsertError);
          }
        }

        console.log(`✅ Saved ${finalStats.length} employee stat records`);
      }

      // Step 7: Update sync log with success
      if (syncLogId) {
        await supabase
          .from('stats_sync_log')
          .update({
            sync_completed_at: new Date().toISOString(),
            status: 'completed',
            records_processed: finalStats.length,
          })
          .eq('id', syncLogId);
      }

      const summary = {
        success: true,
        recordsProcessed: finalStats.length,
        syncStartTime,
        syncEndTime: new Date().toISOString(),
        leadReportProcessed: !!leadReportId,
        appointmentReportProcessed: !!appointmentReportId,
      };

      console.log('✅ Stats sync completed successfully');
      console.log(JSON.stringify(summary, null, 2));

      return new Response(
        JSON.stringify(summary),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } catch (error) {
      // Update sync log with error
      if (syncLogId) {
        await supabase
          .from('stats_sync_log')
          .update({
            sync_completed_at: new Date().toISOString(),
            status: 'failed',
            error_message: String(error),
          })
          .eq('id', syncLogId);
      }

      throw error;
    }

  } catch (error) {
    console.error('❌ Stats sync failed:', error);
    return new Response(
      JSON.stringify({ 
        success: false,
        error: String(error),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});
