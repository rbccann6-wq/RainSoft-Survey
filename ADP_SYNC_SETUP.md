# ADP Workforce Now Sync Setup Guide

Complete guide to sync Onspace time clock and employee onboarding data to ADP using Deno Deploy with mTLS authentication.

---

## Prerequisites

### 1. ADP Workforce Now Account
- Active ADP Workforce Now subscription
- API access enabled
- Developer portal access: https://developers.adp.com

### 2. ADP API Credentials
You need to obtain from ADP:
- **Client ID** (`ADP_CLIENT_ID`)
- **Client Secret** (`ADP_CLIENT_SECRET`)
- **SSL Certificate** (`.crt` file) - X.509 certificate for mTLS
- **SSL Private Key** (`.key` file) - Private key for certificate

### 3. Onspace Cloud Access
- Backend URL (`SUPABASE_URL`)
- Service Role Key (`SUPABASE_SERVICE_ROLE_KEY`)

---

## Step 1: Prepare SSL Certificates

ADP requires mutual TLS (mTLS) authentication. You need to convert your certificate files to base64.

### On macOS/Linux:
```bash
# Convert certificate to base64 (single line)
base64 -i your-adp-cert.crt | tr -d '\n' > cert.base64.txt

# Convert private key to base64 (single line)
base64 -i your-adp-key.key | tr -d '\n' > key.base64.txt
```

### On Windows PowerShell:
```powershell
# Convert certificate to base64
[Convert]::ToBase64String([IO.File]::ReadAllBytes("your-adp-cert.crt")) | Out-File cert.base64.txt

# Convert private key to base64
[Convert]::ToBase64String([IO.File]::ReadAllBytes("your-adp-key.key")) | Out-File key.base64.txt
```

Keep these base64 strings safe - you'll use them as environment variables.

---

## Step 2: Deploy to Deno Playground

### Option A: Deno Deploy (Recommended for Production)

1. **Sign up for Deno Deploy:**
   - Go to https://dash.deno.com
   - Sign in with GitHub

2. **Create New Project:**
   - Click "New Project"
   - Choose "Playground" mode
   - Name: `onspace-adp-sync`

3. **Copy Code:**
   - Copy entire content of `deno-adp-sync-bridge.ts`
   - Paste into the Deno Deploy editor
   - Click "Save & Deploy"

4. **Configure Environment Variables:**
   - Go to Project Settings → Environment Variables
   - Add the following secrets:

```
ADP_CLIENT_ID=your_adp_client_id
ADP_CLIENT_SECRET=your_adp_client_secret
ADP_SSL_CERT=<paste base64 certificate from cert.base64.txt>
ADP_SSL_KEY=<paste base64 private key from key.base64.txt>
ONSPACE_SYNC_SECRET=<generate random secure string, e.g., openssl rand -hex 32>
SUPABASE_URL=https://xxxxx.backend.onspace.ai
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

5. **Get Deployment URL:**
   - Copy your deployment URL (e.g., `https://onspace-adp-sync.deno.dev`)
   - Save this - you'll use it to configure webhooks

### Option B: Deno Playground (Testing Only)

1. Go to https://dash.deno.com/playground
2. Paste the code from `deno-adp-sync-bridge.ts`
3. Run - you'll get a temporary URL
4. **Note:** Playground URLs are temporary and reset on each deployment

---

## Step 3: Test the Connection

### 1. Health Check
```bash
curl https://your-deployment-url.deno.dev/health
```

Expected response:
```json
{
  "status": "healthy",
  "configuration": {
    "adp_credentials": true,
    "ssl_certificates": true,
    "supabase_config": true
  },
  "ready_for_sync": true
}
```

### 2. Test OAuth Token
```bash
curl https://your-deployment-url.deno.dev/test/token
```

Expected response:
```json
{
  "success": true,
  "token_preview": "eyJhbGciOiJSUzI1NiIs...",
  "timestamp": "2024-01-27T..."
}
```

If `success: false`, check:
- ADP credentials are correct
- SSL certificates are valid
- Certificates match your ADP application

---

## Step 4: Configure Onspace Employee ADP IDs

Employees need to have their ADP employee ID stored in the database.

### Manual Update (for existing employees):
```sql
-- Update employee with their ADP worker ID
UPDATE employees 
SET adp_employee_id = 'G3F7HK9P2L' 
WHERE email = 'employee@example.com';
```

### For New Employees:
- When you run `/sync/employees` endpoint, it will automatically create workers in ADP
- The returned ADP worker ID will be saved to the `employees.adp_employee_id` field

---

## Step 5: Configure Automatic Sync

### Option A: Onspace Edge Function (Recommended)

Create an Edge Function that triggers sync after clock-out:

**File:** `supabase/functions/adp-sync-trigger/index.ts`

```typescript
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";

const ADP_SYNC_URL = "https://your-deployment-url.deno.dev/sync/all";
const ADP_SYNC_SECRET = Deno.env.get("ONSPACE_SYNC_SECRET");

serve(async (req) => {
  try {
    // Trigger ADP sync
    const response = await fetch(ADP_SYNC_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${ADP_SYNC_SECRET}`,
        "Content-Type": "application/json",
      },
    });

    const result = await response.json();
    
    return new Response(JSON.stringify(result), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
```

Add secret to Edge Functions:
```bash
# In OnSpace Cloud Dashboard → Secrets
ONSPACE_SYNC_SECRET=your_sync_secret_here
```

### Option B: Database Trigger (Advanced)

Create a PostgreSQL trigger that calls the Edge Function:

```sql
-- Create trigger function
CREATE OR REPLACE FUNCTION trigger_adp_sync()
RETURNS TRIGGER AS $$
BEGIN
  -- Call Edge Function to trigger sync
  PERFORM net.http_post(
    url := 'https://xxxxx.functions.backend.onspace.ai/v1/adp-sync-trigger',
    headers := jsonb_build_object(
      'Authorization', 'Bearer ' || current_setting('app.supabase_anon_key')
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Trigger on clock out
CREATE TRIGGER adp_sync_on_clock_out
AFTER UPDATE OF clock_out ON time_entries
FOR EACH ROW
WHEN (NEW.clock_out IS NOT NULL AND OLD.clock_out IS NULL)
EXECUTE FUNCTION trigger_adp_sync();

-- Trigger on onboarding completion
CREATE TRIGGER adp_sync_on_onboarding
AFTER UPDATE OF onboarding_complete ON employees
FOR EACH ROW
WHEN (NEW.onboarding_complete = true AND OLD.onboarding_complete = false)
EXECUTE FUNCTION trigger_adp_sync();
```

### Option C: Manual/Scheduled Sync

Run sync manually or via cron:

```bash
# Sync everything
curl -X POST \
  -H "Authorization: Bearer YOUR_SYNC_SECRET" \
  https://your-deployment-url.deno.dev/sync/all

# Sync only time entries
curl -X POST \
  -H "Authorization: Bearer YOUR_SYNC_SECRET" \
  https://your-deployment-url.deno.dev/sync/time-entries

# Sync only employees
curl -X POST \
  -H "Authorization: Bearer YOUR_SYNC_SECRET" \
  https://your-deployment-url.deno.dev/sync/employees
```

---

## Step 6: Monitor Sync Status

### Check Sync Logs in Deno Deploy:
1. Go to your project in Deno Deploy
2. Click "Logs" tab
3. Watch for sync events:
   - ✅ Success: "Synced time entry for..."
   - ⚠️ Warning: "Employee has no ADP ID - skipping"
   - ❌ Error: "Failed to sync..."

### Database Sync Status:
```sql
-- Check time entries pending sync
SELECT COUNT(*) FROM time_entries 
WHERE synced_to_adp = false 
AND clock_out IS NOT NULL;

-- Check employees without ADP IDs
SELECT first_name, last_name, email 
FROM employees 
WHERE onboarding_complete = true 
AND adp_employee_id IS NULL;
```

---

## Data Mapping

### Time Entries → ADP Time Cards

| Onspace Field | ADP Field | Notes |
|--------------|-----------|-------|
| `clock_in` | `timeIn` | ISO 8601 timestamp |
| `clock_out` | `timeOut` | ISO 8601 timestamp |
| `store_name` | `comment` | Stored in comments |
| `gps_latitude` | `comment` | GPS coordinates in comments |
| `gps_longitude` | `comment` | GPS coordinates in comments |

### Employees → ADP Workers

| Onspace Field | ADP Field | Source Table |
|--------------|-----------|--------------|
| `first_name` | `person.legalName.givenName` | `employees` |
| `last_name` | `person.legalName.familyName1` | `employees` |
| `email` | `person.communication.emails` | `employees` |
| `hire_date` | `workAssignment.hireDate` | `employees` |
| `personal_info.dob` | `person.birthDate` | `onboarding_data` |
| `personal_info.street_address` | `person.legalAddress.lineOne` | `onboarding_data` |
| `w4_data.filing_status` | `taxWithholdings.federalTaxWithholding.filingStatusCode` | `onboarding_data` |
| `i9_data.document_type` | `workEligibility.i9Verification.documentTypeCode` | `onboarding_data` |
| `direct_deposit_data.account_number` | `payrollDeductions.bankAccount.accountNumber` | `onboarding_data` |

---

## Troubleshooting

### ❌ "Failed to obtain ADP access token"
**Cause:** Invalid credentials or SSL certificate issues

**Fix:**
1. Verify `ADP_CLIENT_ID` and `ADP_CLIENT_SECRET` are correct
2. Check certificate base64 encoding is correct (no line breaks)
3. Ensure certificates match your ADP application
4. Contact ADP support to verify API access is enabled

### ❌ "No ADP employee ID configured"
**Cause:** Employee not yet synced to ADP

**Fix:**
1. Run `/sync/employees` endpoint to create workers in ADP
2. Or manually set `adp_employee_id` field for existing employees

### ❌ "ADP API error: 403 Forbidden"
**Cause:** SSL certificate not trusted by ADP

**Fix:**
1. Verify certificates are for the correct ADP environment (production vs. sandbox)
2. Ensure certificates haven't expired
3. Contact ADP to verify certificate registration

### ⚠️ "No time entries to sync"
**Cause:** All time entries already synced or none have `clock_out`

**Check:**
```sql
SELECT * FROM time_entries 
WHERE synced_to_adp = false 
AND clock_out IS NULL;
```

This shows employees currently clocked in (will sync when they clock out).

---

## Production Considerations

### Security
- ✅ Store all secrets in Deno Deploy environment variables (not in code)
- ✅ Use strong `ONSPACE_SYNC_SECRET` (32+ characters)
- ✅ Rotate SSL certificates before expiration
- ✅ Enable HTTPS-only communication

### Performance
- ✅ Sync runs in batches (50 time entries, 20 employees per run)
- ✅ OAuth tokens are cached (reduce API calls)
- ✅ Failed syncs don't block future attempts

### Monitoring
- ✅ Check Deno Deploy logs daily
- ✅ Set up alerts for repeated sync failures
- ✅ Monitor `synced_to_adp` field for accumulating unsynced records

### Compliance
- ✅ All employee data encrypted in transit (TLS/mTLS)
- ✅ GPS data included in time card comments for audit trail
- ✅ Onboarding signatures stored in Onspace (not sent to ADP)

---

## Support Resources

- **ADP Developer Portal:** https://developers.adp.com
- **ADP Support:** Contact your ADP account manager
- **Deno Deploy Docs:** https://deno.com/deploy/docs
- **OnSpace Cloud Dashboard:** Access via app's Cloud button

---

## Next Steps

1. ✅ Deploy Deno script to Deno Deploy
2. ✅ Configure environment variables
3. ✅ Test connection with `/health` endpoint
4. ✅ Run initial employee sync: `/sync/employees`
5. ✅ Set up automatic sync (Edge Function or trigger)
6. ✅ Monitor logs for first few syncs
7. ✅ Train HR team on ADP ID management

**Your Onspace app is now fully integrated with ADP Workforce Now! 🎉**
