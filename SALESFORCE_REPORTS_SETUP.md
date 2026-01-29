# Salesforce Reports Setup for Survey Stats Sync

This guide helps you create the required Salesforce reports for efficient survey outcome tracking.

## Why Use Reports?

- **Performance**: Pre-aggregated data on Salesforce servers (no timeout issues)
- **Speed**: Much faster than querying thousands of individual records
- **Scalability**: Handles large datasets efficiently
- **Reliability**: Salesforce optimized for report execution

## Required Reports

You need to create **2 reports** in Salesforce:

### 1. Lead Status Report
Groups Leads by Status and Owner (Employee)

### 2. Appointment Status Report  
Groups Appointments by Status and Owner (Employee)

---

## Step-by-Step: Create Lead Status Report

### 1. Navigate to Reports
- Click **App Launcher** (9 dots) → Search "Reports" → Click **Reports**
- Click **New Report**

### 2. Select Report Type
- Choose **Leads** as the report type
- Click **Continue**

### 3. Configure Filters
- **Date Filter**: Set to "All Time" or "Last 90 Days" (whatever range you want to track)
- **Optional**: Add filter "Lead Owner: Active = True" to exclude inactive employees

### 4. Group Report Data
- **Group Rows by**: 
  1. First grouping: **Surveyor** field (drag "Surveyor" to Outline section)
  2. Second grouping: **Status** (drag "Status" to Outline section under Surveyor)

### 5. Add Summary Columns
- In the **Columns** section, add:
  - **Surveyor** (if not already there)
  - **Status** (if not already there)
  - **Record Count** (this counts the number of Leads in each status)

### 6. Remove Unnecessary Columns
- Remove detail columns like "Lead Name", "Email", etc.
- Keep only: Surveyor, Status, and aggregate count

### 7. Set Report Format
- Format: **Summary** (not Tabular or Matrix)
- This groups data by Surveyor → Status with counts

### 8. Name and Save
- **Report Name**: "Employee Survey Stats - Leads"
- **Report Description**: "Lead status counts by surveyor for survey outcome tracking"
- **Folder**: Choose "Private Reports" or create "Survey Stats" folder
- Click **Save**

### 9. Get Report ID
- After saving, look at the URL in your browser:
  ```
  https://yourinstance.lightning.force.com/lightning/r/Report/[REPORT_ID]/view
  ```
- **Copy the REPORT_ID** (e.g., `00O5f000004xYz2EAE`)
- You'll need this for OnSpace Cloud configuration

---

## Step-by-Step: Create Appointment Status Report

### 1. Navigate to Reports
- Click **App Launcher** → **Reports** → **New Report**

### 2. Select Report Type
- Choose **Appointments** (or your custom Appointment object)
- Click **Continue**

### 3. Configure Filters
- **Date Filter**: "All Time" or "Last 90 Days"
- **Optional**: Filter by active appointments only

### 4. Group Report Data
- **Group Rows by**:
  1. **Surveyor** field (first grouping)
  2. **Staus** field (note: might be "Status" in your org)

### 5. Add Summary Columns
- Add:
  - **Surveyor**
  - **Staus** (or Status)
  - **Record Count**

### 6. Set Report Format
- Format: **Summary**
- Group by Surveyor → Status

### 7. Name and Save
- **Report Name**: "Employee Survey Stats - Appointments"
- **Report Description**: "Appointment status counts by surveyor for survey outcome tracking"
- Click **Save**

### 8. Get Report ID
- Copy the **REPORT_ID** from the URL after saving

---

## Configure OnSpace Cloud

After creating both reports, you need to add the Report IDs to OnSpace Cloud:

### 1. Go to Cloud Dashboard
- Click **Cloud** button in top-right panel
- Navigate to **Secrets** tab

### 2. Add Report IDs
Click **Add Secret** and create these two entries:

**Lead Report:**
- **Key**: `SALESFORCE_LEAD_REPORT_ID`
- **Value**: `00ORl00000AgKarMAF` (your Lead report ID)

**Appointment Report:**
- **Key**: `SALESFORCE_APPOINTMENT_REPORT_ID`  
- **Value**: `00ORl00000AgL0fMAF` (your Appointment report ID)

### 3. Save
- Click **Save** for each secret

---

## Test the Sync

### Manual Test (via Admin Dashboard)

1. Go to **Admin Dashboard** → **Sync Status**
2. Click **Test Stats Sync** (or trigger manually)
3. Check the sync log for:
   - ✅ "Lead report returned X rows"
   - ✅ "Appointment report returned Y rows"
   - ✅ "Saved Z employee stat records"

### Expected Output
```
🔄 Starting stats sync at 2025-01-29T10:00:00Z
📋 Loading status mappings...
✓ Loaded 8 status mappings
📊 Fetching Lead report: 00O5f000004xYz2EAE
✓ Lead report returned 45 rows
📊 Fetching Appointment report: 00O5f000004xYz3FAE
✓ Appointment report returned 23 rows
🔍 Matching Salesforce Owner IDs to employees...
✓ Matched 12 employee stat records
💾 Saving stats to database...
✅ Saved 12 employee stat records
✅ Stats sync completed successfully
```

---

## Common Report Issues

### Issue: "No data returned from report"
**Solution**: Check report filters - ensure date range includes recent data

### Issue: "Unmapped status" warnings
**Solution**: Go to **Admin → Survey Stats Config** and add mappings for those statuses

### Issue: "No employee found for Surveyor"
**Solution**: 
1. Check the exact format of Surveyor names in Salesforce (e.g., "John Doe" vs "Doe, John")
2. Ensure employee names in OnSpace match exactly (first name + last name)
3. The system tries multiple formats:
   - "First Last"
   - "Last, First"
   - First name only
   - Last name only
   - Email prefix (before @)
4. Check employee records have correct first_name and last_name fields populated

### Issue: Report ID not working
**Solution**: 
1. Verify the Report ID is correct (18-character Salesforce ID)
2. Ensure report is saved and accessible
3. Check Salesforce user has permission to run the report

---

## Report Permissions

Make sure the Salesforce user (whose credentials are in OnSpace Cloud) has:
- **Read access** to Lead and Appointment objects
- **Run Reports** permission
- Access to the folder where reports are saved

---

## Schedule Nightly Sync (Future Enhancement)

Currently, sync runs manually. To schedule nightly:

**Option 1: Supabase Cron (Recommended)**
- Use Supabase's built-in cron jobs
- Schedule: `0 0 * * *` (midnight daily)
- Target: `stats-sync` Edge Function

**Option 2: External Scheduler**
- Use external service (GitHub Actions, Zapier, etc.)
- Send POST request to Edge Function URL daily

**Option 3: Salesforce Outbound Message**
- Configure Salesforce to ping Edge Function on schedule

---

## Report Customization

### Filter by Date Range
To track only recent surveys, add date filter:
- **Lead: Created Date** = Last 90 Days
- **Appointment: Created Date** = Last 90 Days

### Additional Groupings
You can add more groupings for deeper insights:
- Group by Store (if you have a Store field)
- Group by Month (for trending analysis)

### Scheduled Reports
Enable "Subscribe" in Salesforce to email report results daily (backup monitoring)

---

## Troubleshooting

### Check Sync Logs
- **Admin Dashboard** → **Sync Status** → View sync history
- Look for errors in `stats_sync_log` table

### Verify Report Structure
Your report must have:
1. **Grouping 1**: Surveyor field
2. **Grouping 2**: Status  
3. **Summary**: Record Count

### Test Reports Manually
- Open report in Salesforce
- Click **Run Report**
- Verify data appears correctly grouped

---

## Need Help?

If you encounter issues:
1. Check the sync logs in Admin Dashboard
2. Verify report IDs in Cloud → Secrets
3. Ensure status mappings exist in Survey Stats Config
4. Test Salesforce connection in Field Mapping page

