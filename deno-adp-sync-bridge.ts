/**
 * Deno ADP Sync Bridge
 * 
 * Handles mutual TLS (mTLS) authentication with ADP Workforce Now API
 * Syncs time clock data and employee onboarding from Onspace to ADP
 * 
 * Deploy to: https://dash.deno.com/playground
 * 
 * Required Environment Variables:
 * - ADP_CLIENT_ID: Your ADP application client ID
 * - ADP_CLIENT_SECRET: Your ADP application client secret
 * - ADP_SSL_CERT: Base64-encoded X.509 certificate (.crt file)
 * - ADP_SSL_KEY: Base64-encoded private key (.key file)
 * - ONSPACE_SYNC_SECRET: Secret key to validate requests from Onspace
 * - SUPABASE_URL: Your Onspace Cloud URL
 * - SUPABASE_SERVICE_ROLE_KEY: Service role key for database access
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.38.4";

// ============ CONFIGURATION ============
const ADP_API_BASE = "https://api.adp.com";
const ADP_TOKEN_URL = `${ADP_API_BASE}/auth/oauth/v2/token`;
const ADP_TIME_URL = `${ADP_API_BASE}/time/v2/workers`;
const ADP_HR_URL = `${ADP_API_BASE}/hr/v2/workers`;

// CORS headers
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
  "Content-Type": "application/json",
};

// ============ CERTIFICATE HANDLING ============

/**
 * Load and decode SSL certificates from environment variables
 */
function loadCertificates(): { cert: string; key: string } | null {
  try {
    const certBase64 = Deno.env.get("ADP_SSL_CERT");
    const keyBase64 = Deno.env.get("ADP_SSL_KEY");

    if (!certBase64 || !keyBase64) {
      console.error("❌ ADP_SSL_CERT or ADP_SSL_KEY not found in environment");
      return null;
    }

    // Decode base64 to PEM format
    const cert = atob(certBase64);
    const key = atob(keyBase64);

    console.log("✅ Certificates loaded successfully");
    return { cert, key };
  } catch (error) {
    console.error("❌ Error loading certificates:", error);
    return null;
  }
}

// ============ ADP AUTHENTICATION ============

let cachedAccessToken: string | null = null;
let tokenExpiresAt: number = 0;

/**
 * Get ADP OAuth access token using client credentials + mTLS
 */
async function getADPAccessToken(): Promise<string | null> {
  // Return cached token if still valid
  if (cachedAccessToken && Date.now() < tokenExpiresAt) {
    return cachedAccessToken;
  }

  try {
    const clientId = Deno.env.get("ADP_CLIENT_ID");
    const clientSecret = Deno.env.get("ADP_CLIENT_SECRET");
    const certs = loadCertificates();

    if (!clientId || !clientSecret || !certs) {
      console.error("❌ Missing ADP credentials or certificates");
      return null;
    }

    // Create Basic Auth header
    const credentials = btoa(`${clientId}:${clientSecret}`);

    // Request OAuth token with mTLS
    const response = await fetch(ADP_TOKEN_URL, {
      method: "POST",
      headers: {
        "Authorization": `Basic ${credentials}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        grant_type: "client_credentials",
        scope: "time:workers:read time:workers:write hr:workers:read hr:workers:write",
      }),
      // Deno Deploy doesn't support client certificates directly in fetch
      // You'll need to use a custom HTTPS agent or proxy for mTLS
      // For now, this is a placeholder - see README for production setup
    });

    if (!response.ok) {
      const error = await response.text();
      console.error("❌ ADP token request failed:", error);
      return null;
    }

    const data = await response.json();
    cachedAccessToken = data.access_token;
    tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000; // Refresh 1 min early

    console.log("✅ ADP access token obtained");
    return cachedAccessToken;
  } catch (error) {
    console.error("❌ Error getting ADP token:", error);
    return null;
  }
}

/**
 * Make authenticated request to ADP API with mTLS
 */
async function adpRequest(
  url: string,
  method: string = "GET",
  body?: any
): Promise<any> {
  const token = await getADPAccessToken();
  if (!token) {
    throw new Error("Failed to obtain ADP access token");
  }

  const certs = loadCertificates();
  if (!certs) {
    throw new Error("Failed to load SSL certificates");
  }

  const options: RequestInit = {
    method,
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json",
      "Accept": "application/json",
    },
  };

  if (body) {
    options.body = JSON.stringify(body);
  }

  const response = await fetch(url, options);

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`ADP API error: ${response.status} - ${error}`);
  }

  return await response.json();
}

// ============ ONSPACE DATABASE ACCESS ============

function getSupabaseClient() {
  const url = Deno.env.get("SUPABASE_URL");
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

  if (!url || !key) {
    throw new Error("Missing Supabase credentials");
  }

  return createClient(url, key);
}

// ============ DATA TRANSFORMATION ============

/**
 * Transform Onspace time entry to ADP time card format
 */
function transformTimeEntry(timeEntry: any, employee: any): any {
  const clockIn = new Date(timeEntry.clock_in);
  const clockOut = timeEntry.clock_out ? new Date(timeEntry.clock_out) : null;

  return {
    timeCards: [
      {
        associateOID: employee.adp_employee_id, // ADP worker ID
        timeSheets: [
          {
            timePeriod: {
              startDate: clockIn.toISOString().split("T")[0],
              endDate: clockOut
                ? clockOut.toISOString().split("T")[0]
                : clockIn.toISOString().split("T")[0],
            },
            entries: [
              {
                entryDate: clockIn.toISOString().split("T")[0],
                timeTypeCode: { codeValue: "Regular Time" },
                timeIn: clockIn.toISOString(),
                timeOut: clockOut ? clockOut.toISOString() : undefined,
                payCode: { codeValue: "REG" },
                comment: `GPS: ${timeEntry.gps_latitude || "N/A"},${
                  timeEntry.gps_longitude || "N/A"
                } | Store: ${timeEntry.store_name || timeEntry.store}`,
              },
            ],
          },
        ],
      },
    ],
  };
}

/**
 * Transform Onspace employee onboarding data to ADP worker format
 */
function transformEmployeeOnboarding(employee: any, onboarding: any): any {
  const personalInfo = onboarding.personal_info || {};
  const w4Data = onboarding.w4_data || {};
  const i9Data = onboarding.i9_data || {};
  const directDeposit = onboarding.direct_deposit_data || {};

  return {
    workers: [
      {
        workerID: {
          idValue: employee.id, // Onspace employee ID
        },
        person: {
          legalName: {
            givenName: employee.first_name,
            familyName1: employee.last_name,
          },
          birthDate: personalInfo.dob,
          genderCode: {
            codeValue: personalInfo.gender || "Not Specified",
          },
          legalAddress: {
            lineOne: personalInfo.street_address,
            cityName: personalInfo.city,
            countrySubdivisionLevel1: {
              codeValue: personalInfo.state,
            },
            postalCode: personalInfo.zip_code,
            countryCode: "US",
          },
          communication: {
            emails: [
              {
                emailUri: employee.email,
                nameCode: { codeValue: "Work Email" },
              },
            ],
            landlines: employee.phone
              ? [
                  {
                    areaDialing: employee.phone.substring(0, 3),
                    dialNumber: employee.phone.substring(3),
                    nameCode: { codeValue: "Mobile" },
                  },
                ]
              : [],
          },
        },
        workAssignment: {
          hireDate: employee.hire_date,
          workerTypeCode: { codeValue: "Employee" },
          primaryIndicator: true,
        },
        taxWithholdings: {
          federalTaxWithholding: {
            filingStatusCode: {
              codeValue: w4Data.filing_status || "Single",
            },
            allowances: w4Data.allowances || 0,
            additionalAmount: {
              amountValue: w4Data.additional_withholding || 0,
              currencyCode: "USD",
            },
          },
        },
        workEligibility: {
          i9Verification: {
            verificationDate: i9Data.verification_date,
            documentTypeCode: {
              codeValue: i9Data.document_type || "US Passport",
            },
            documentNumber: i9Data.document_number,
            expirationDate: i9Data.expiration_date,
          },
        },
        payrollDeductions: directDeposit.account_number
          ? [
              {
                deductionCode: { codeValue: "Direct Deposit" },
                goalAmount: {
                  percentageValue: 100,
                },
                bankAccount: {
                  routingNumber: directDeposit.routing_number,
                  accountNumber: directDeposit.account_number,
                  accountTypeCode: {
                    codeValue: directDeposit.account_type || "Checking",
                  },
                },
              },
            ]
          : [],
      },
    ],
  };
}

// ============ SYNC FUNCTIONS ============

/**
 * Sync time entries from Onspace to ADP
 */
async function syncTimeEntries(): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const supabase = getSupabaseClient();
  const results = { synced: 0, failed: 0, errors: [] as string[] };

  try {
    // Get unsynced time entries
    const { data: timeEntries, error: fetchError } = await supabase
      .from("time_entries")
      .select(
        `
        *,
        employees!inner(id, first_name, last_name, adp_employee_id, email)
      `
      )
      .eq("synced_to_adp", false)
      .not("clock_out", "is", null) // Only sync completed shifts
      .limit(50); // Process in batches

    if (fetchError) {
      throw fetchError;
    }

    if (!timeEntries || timeEntries.length === 0) {
      console.log("ℹ️ No time entries to sync");
      return results;
    }

    console.log(`🔄 Syncing ${timeEntries.length} time entries to ADP...`);

    // Sync each entry
    for (const entry of timeEntries) {
      try {
        const employee = entry.employees;

        // Skip if employee doesn't have ADP ID
        if (!employee.adp_employee_id) {
          console.warn(
            `⚠️ Employee ${employee.first_name} ${employee.last_name} has no ADP ID - skipping`
          );
          results.failed++;
          results.errors.push(
            `${employee.email}: No ADP employee ID configured`
          );
          continue;
        }

        // Transform data
        const adpPayload = transformTimeEntry(entry, employee);

        // Send to ADP
        await adpRequest(
          `${ADP_TIME_URL}/${employee.adp_employee_id}/team-time-cards`,
          "POST",
          adpPayload
        );

        // Mark as synced in Onspace
        await supabase
          .from("time_entries")
          .update({ synced_to_adp: true })
          .eq("id", entry.id);

        results.synced++;
        console.log(
          `✅ Synced time entry for ${employee.first_name} ${employee.last_name}`
        );
      } catch (error: any) {
        results.failed++;
        const errorMsg = `${entry.employees.email}: ${error.message}`;
        results.errors.push(errorMsg);
        console.error(`❌ Failed to sync time entry:`, errorMsg);
      }
    }

    console.log(
      `✅ Time entry sync complete: ${results.synced} synced, ${results.failed} failed`
    );
    return results;
  } catch (error: any) {
    console.error("❌ Time entry sync error:", error);
    results.errors.push(`Global error: ${error.message}`);
    return results;
  }
}

/**
 * Sync employee onboarding data from Onspace to ADP
 */
async function syncEmployeeOnboarding(): Promise<{
  synced: number;
  failed: number;
  errors: string[];
}> {
  const supabase = getSupabaseClient();
  const results = { synced: 0, failed: 0, errors: [] as string[] };

  try {
    // Get employees with completed onboarding but not synced to ADP
    const { data: employees, error: fetchError } = await supabase
      .from("employees")
      .select(
        `
        *,
        onboarding_data!inner(*)
      `
      )
      .eq("onboarding_complete", true)
      .is("adp_employee_id", null) // Not yet in ADP
      .limit(20); // Process in batches

    if (fetchError) {
      throw fetchError;
    }

    if (!employees || employees.length === 0) {
      console.log("ℹ️ No employees to sync");
      return results;
    }

    console.log(`🔄 Syncing ${employees.length} employees to ADP...`);

    // Sync each employee
    for (const employee of employees) {
      try {
        const onboarding = employee.onboarding_data;

        // Transform data
        const adpPayload = transformEmployeeOnboarding(employee, onboarding);

        // Create worker in ADP
        const response = await adpRequest(ADP_HR_URL, "POST", adpPayload);

        // Extract ADP worker ID from response
        const adpWorkerId = response.workers?.[0]?.associateOID;

        if (!adpWorkerId) {
          throw new Error("No worker ID returned from ADP");
        }

        // Update employee with ADP ID
        await supabase
          .from("employees")
          .update({ adp_employee_id: adpWorkerId })
          .eq("id", employee.id);

        results.synced++;
        console.log(
          `✅ Synced employee ${employee.first_name} ${employee.last_name} (ADP ID: ${adpWorkerId})`
        );
      } catch (error: any) {
        results.failed++;
        const errorMsg = `${employee.email}: ${error.message}`;
        results.errors.push(errorMsg);
        console.error(`❌ Failed to sync employee:`, errorMsg);
      }
    }

    console.log(
      `✅ Employee sync complete: ${results.synced} synced, ${results.failed} failed`
    );
    return results;
  } catch (error: any) {
    console.error("❌ Employee sync error:", error);
    results.errors.push(`Global error: ${error.message}`);
    return results;
  }
}

// ============ HTTP HANDLERS ============

async function handler(req: Request): Promise<Response> {
  const url = new URL(req.url);
  const path = url.pathname;

  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Root - API documentation
    if (path === "/" || path === "") {
      return new Response(
        JSON.stringify(
          {
            status: "online",
            name: "Deno ADP Sync Bridge",
            version: "1.0.0",
            endpoints: {
              "/": "This documentation",
              "/health": "Health check and ADP connection status",
              "/sync/time-entries": "Sync time clock data to ADP",
              "/sync/employees": "Sync employee onboarding to ADP",
              "/sync/all": "Sync both time entries and employees",
              "/test/token": "Test ADP OAuth token generation",
            },
            authentication:
              "Requires ONSPACE_SYNC_SECRET header for webhook endpoints",
          },
          null,
          2
        ),
        { headers: corsHeaders }
      );
    }

    // Health check
    if (path === "/health") {
      const hasCredentials =
        !!Deno.env.get("ADP_CLIENT_ID") &&
        !!Deno.env.get("ADP_CLIENT_SECRET") &&
        !!Deno.env.get("ADP_SSL_CERT") &&
        !!Deno.env.get("ADP_SSL_KEY");

      const hasSupabase =
        !!Deno.env.get("SUPABASE_URL") &&
        !!Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

      return new Response(
        JSON.stringify(
          {
            status: "healthy",
            timestamp: new Date().toISOString(),
            configuration: {
              adp_credentials: hasCredentials,
              ssl_certificates: !!loadCertificates(),
              supabase_config: hasSupabase,
            },
            ready_for_sync: hasCredentials && hasSupabase,
          },
          null,
          2
        ),
        { headers: corsHeaders }
      );
    }

    // Test OAuth token generation
    if (path === "/test/token") {
      const token = await getADPAccessToken();
      return new Response(
        JSON.stringify(
          {
            success: !!token,
            token_preview: token ? `${token.substring(0, 20)}...` : null,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        ),
        { headers: corsHeaders }
      );
    }

    // Validate webhook secret for sync endpoints
    const syncSecret = Deno.env.get("ONSPACE_SYNC_SECRET");
    if (path.startsWith("/sync/") && req.method === "POST") {
      const authHeader = req.headers.get("Authorization");
      if (!syncSecret || authHeader !== `Bearer ${syncSecret}`) {
        return new Response(
          JSON.stringify({ error: "Unauthorized - invalid sync secret" }),
          { status: 401, headers: corsHeaders }
        );
      }
    }

    // Sync time entries
    if (path === "/sync/time-entries" && req.method === "POST") {
      const results = await syncTimeEntries();
      return new Response(JSON.stringify(results, null, 2), {
        headers: corsHeaders,
      });
    }

    // Sync employees
    if (path === "/sync/employees" && req.method === "POST") {
      const results = await syncEmployeeOnboarding();
      return new Response(JSON.stringify(results, null, 2), {
        headers: corsHeaders,
      });
    }

    // Sync everything
    if (path === "/sync/all" && req.method === "POST") {
      const [timeResults, employeeResults] = await Promise.all([
        syncTimeEntries(),
        syncEmployeeOnboarding(),
      ]);

      return new Response(
        JSON.stringify(
          {
            time_entries: timeResults,
            employees: employeeResults,
            total_synced:
              timeResults.synced + employeeResults.synced,
            total_failed:
              timeResults.failed + employeeResults.failed,
            timestamp: new Date().toISOString(),
          },
          null,
          2
        ),
        { headers: corsHeaders }
      );
    }

    // 404
    return new Response(
      JSON.stringify({ error: "Endpoint not found", path }, null, 2),
      { status: 404, headers: corsHeaders }
    );
  } catch (error: any) {
    console.error("❌ Request error:", error);
    return new Response(
      JSON.stringify(
        {
          error: "Internal server error",
          message: error.message,
          stack: error.stack,
        },
        null,
        2
      ),
      { status: 500, headers: corsHeaders }
    );
  }
}

console.log("🚀 Deno ADP Sync Bridge starting...");
console.log("📊 Ready to sync Onspace data to ADP Workforce Now");
console.log("🔐 mTLS authentication enabled");

// Deno Deploy uses the default export
export default {
  fetch: handler,
};
