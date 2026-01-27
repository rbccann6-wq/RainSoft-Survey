# Backend Syncing Setup Guide

This guide will help you configure Salesforce, Zapier, and ADP integrations for the RainSoft Survey App.

## 📋 Table of Contents
1. [Salesforce Setup](#salesforce-setup)
2. [Zapier Setup](#zapier-setup)
3. [ADP Workforce Setup](#adp-workforce-setup)
4. [Configuration](#configuration)
5. [Testing](#testing)

---

## 🔵 Salesforce Setup

### Step 1: Create Custom Fields

Log into Salesforce and navigate to **Setup** → **Object Manager** → **Lead**

Create the following custom fields:

| Field Label | API Name | Field Type | Description |
|------------|----------|------------|-------------|
| Buys Bottled Water | `Buys_Bottled_Water__c` | Checkbox | Does customer buy bottled water |
| Is Homeowner | `Is_Homeowner__c` | Checkbox | Is customer a homeowner |
| Has Salt System | `Has_Salt_System__c` | Checkbox | Has salt-based water treatment |
| Water Quality | `Water_Quality__c` | Picklist | Good, Fair, Poor |
| Water Source | `Water_Source__c` | Picklist | City/County, Well |
| Current Treatment | `Current_Treatment__c` | Picklist | Whole House, Drinking/Fridge, None |
| Property Type | `Property_Type__c` | Picklist | House, Mobile Home, Apartment, Condo |
| Survey Store | `Survey_Store__c` | Text(50) | Lowes or Home Depot |
| Survey Date | `Survey_Date__c` | DateTime | When survey was completed |
| Survey Employee ID | `Survey_Employee_ID__c` | Text(50) | Employee who conducted survey |
| Survey ID | `Survey_ID__c` | Text(50) | Unique survey identifier |
| Has Signature | `Has_Signature__c` | Checkbox | Survey has customer signature |

### Step 2: Create Connected App

1. Go to **Setup** → **Apps** → **App Manager**
2. Click **New Connected App**
3. Fill in:
   - **Connected App Name**: RainSoft Survey Sync
   - **API Name**: RainSoft_Survey_Sync
   - **Contact Email**: your@email.com
4. Enable **OAuth Settings**:
   - Callback URL: `https://login.salesforce.com/services/oauth2/callback`
   - Selected OAuth Scopes:
     - Full access (full)
     - Perform requests on your behalf at any time (refresh_token, offline_access)
5. Click **Save**

### Step 3: Get Credentials

After saving, you'll see:
- **Consumer Key** (this is your Client ID)
- **Consumer Secret** (click to reveal)

Save these for configuration.

### Step 4: Get Security Token

1. Click your profile icon → **Settings**
2. In Quick Find, search **Reset My Security Token**
3. Click **Reset Security Token**
4. Check your email for the new token

---

## ⚡ Zapier Setup

### Step 1: Create Zap

1. Log into [Zapier](https://zapier.com)
2. Click **Create Zap**
3. **Trigger**: Choose **Webhooks by Zapier**
   - Event: **Catch Hook**
   - Copy the **Custom Webhook URL** (you'll need this)

### Step 2: Set Up Action

Choose your action app (examples below):

#### Option A: Google Calendar
- **Action**: Create Detailed Event
- **Map Fields**:
  - Summary: `{{appointment_date}} at {{appointment_time}} - {{first_name}} {{last_name}}`
  - Start Date & Time: `{{appointment_date}} {{appointment_time}}`
  - Description: Include all survey answers
  - Location: `{{address}}, {{city}}, {{state}} {{zip_code}}`

#### Option B: Google Sheets
- **Action**: Create Spreadsheet Row
- **Map Columns**:
  - Column A: `{{survey_id}}`
  - Column B: `{{first_name}}`
  - Column C: `{{last_name}}`
  - Column D: `{{phone}}`
  - Column E: `{{address}}`
  - Column F: `{{appointment_date}}`
  - Column G: `{{appointment_time}}`
  - Column H: `{{water_quality}}`
  - etc.

#### Option C: Slack
- **Action**: Send Channel Message
- **Message Text**:
```
🎯 New Appointment Scheduled!
Name: {{first_name}} {{last_name}}
Phone: {{phone}}
Address: {{address}}
Date: {{appointment_date}} at {{appointment_time}}
Store: {{store}}
Notes: {{appointment_notes}}
```

### Step 3: Test & Activate

1. Click **Test & Continue**
2. Send a test webhook
3. Verify the data appears correctly
4. Turn on your Zap

---

## 💼 ADP Workforce Setup

### Step 1: Register for API Access

1. Contact ADP to register for API access
2. Request access to **Time & Attendance API**
3. You'll receive:
   - Client ID
   - Client Secret
   - API Environment URL

### Step 2: Configure Employee IDs

Each employee needs an ADP Employee ID in their profile:

```typescript
{
  id: "employee-123",
  firstName: "John",
  lastName: "Doe",
  adpEmployeeId: "ADP123456", // Add this field
  // ... other fields
}
```

### Step 3: Location Codes

Set up location codes in ADP that match your stores:
- `LOWES` for Lowes locations
- `HOME_DEPOT` for Home Depot locations

---

## ⚙️ Configuration

Open `services/syncService.ts` and update the configuration:

```typescript
// Salesforce Configuration
const SALESFORCE_CONFIG = {
  instanceUrl: 'https://YOUR_INSTANCE.salesforce.com', // e.g., https://rainsoft.my.salesforce.com
  clientId: 'YOUR_CONSUMER_KEY_FROM_CONNECTED_APP',
  clientSecret: 'YOUR_CONSUMER_SECRET_FROM_CONNECTED_APP',
  username: 'your.salesforce@username.com',
  password: 'YourSalesforcePassword',
  securityToken: 'YOUR_SECURITY_TOKEN_FROM_EMAIL',
};

// Zapier Webhook Configuration
const ZAPIER_WEBHOOK_URL = 'https://hooks.zapier.com/hooks/catch/12345/abcde/';

// ADP Workforce Configuration  
const ADP_CONFIG = {
  apiUrl: 'https://api.adp.com', // or your sandbox URL
  clientId: 'YOUR_ADP_CLIENT_ID',
  clientSecret: 'YOUR_ADP_CLIENT_SECRET',
};
```

---

## 🧪 Testing

### Test Salesforce Sync

1. Complete a survey in the app
2. Check the sync queue in app storage
3. Go online and trigger sync
4. Verify Lead created in Salesforce:
   - Go to **Leads** tab
   - Check for new lead with survey data
   - Verify all custom fields populated

### Test Zapier Webhook

1. Complete a survey with appointment
2. Check your Zap history in Zapier dashboard
3. Verify webhook received all data
4. Check destination (Google Calendar/Sheets/Slack)

### Test ADP Sync

1. Clock in/out in the app
2. Check ADP Workforce:
   - Navigate to Time & Attendance
   - Find employee timecard
   - Verify punch times and locations

---

## 🔍 Troubleshooting

### Salesforce Issues

**401 Unauthorized**
- Check username/password/security token
- Reset security token if changed recently
- Verify Connected App is approved

**Field Not Found**
- Verify custom field API names match exactly
- Check field-level security permissions

**Duplicate Detection Not Working**
- Ensure phone number format is consistent
- Check duplicate rules in Salesforce

### Zapier Issues

**Webhook Not Receiving Data**
- Verify webhook URL is correct
- Check if Zap is turned ON
- Look at Zap History for errors

**Missing Fields**
- Check field mapping in Zapier
- Verify all fields are being sent from app

### ADP Issues

**Authentication Failed**
- Verify client credentials
- Check if API access is active
- Ensure using correct environment (prod/sandbox)

**Employee Not Found**
- Verify adpEmployeeId is correct
- Check employee exists in ADP system

---

## 📊 Monitoring

### Sync Queue Status

The app maintains a sync queue that:
- Stores all pending syncs locally
- Automatically retries failed syncs (max 3 attempts)
- Marks duplicates for review
- Preserves data even if sync fails

### View Sync Logs

Check console logs for:
```
✅ Salesforce authenticated successfully
🔄 Processing 5 items in sync queue...
✅ Survey synced to Salesforce
⚠️ Duplicate detected, adding to review queue
✅ Appointment sent to Zapier
❌ Sync failed for survey: [error details]
```

### Admin Dashboard

- **Surveys Tab**: View sync status of all surveys
- **Duplicates Tab**: Review and manage duplicates
- **Live Dashboard**: Monitor real-time employee activity

---

## 🔒 Security Notes

1. **Never commit credentials** to version control
2. Store credentials in environment variables:
   ```bash
   SALESFORCE_CLIENT_ID=xxx
   SALESFORCE_CLIENT_SECRET=xxx
   # etc.
   ```
3. Use OAuth refresh tokens for production
4. Implement IP whitelisting in Salesforce
5. Use webhook signature verification for Zapier
6. Rotate API credentials regularly

---

## 📞 Support

For issues with:
- **Salesforce**: [Salesforce Help](https://help.salesforce.com)
- **Zapier**: [Zapier Support](https://zapier.com/help)
- **ADP**: Contact your ADP representative

For app-specific issues, contact: contact@onspace.ai
