# Salesforce Integration - Simple Setup Guide

## Option 1: Quick Setup (5 Minutes) ⚡

This is the **simplest way** to connect to Salesforce without complex OAuth setup.

### Step 1: Create a Connected App (Required)

1. **Login to Salesforce** → Click the **gear icon** ⚙️ (top right) → **Setup**

2. In the **Quick Find** box (left sidebar), type: **App Manager**

3. Click **New Connected App** button (top right)

4. **Fill in ONLY these fields:**
   ```
   Connected App Name: RainSoft Survey App
   API Name: RainSoft_Survey_App (auto-fills)
   Contact Email: your-email@company.com
   ```

5. **Enable OAuth Settings:**
   - ✅ Check "Enable OAuth Settings"
   - **Callback URL**: `https://login.salesforce.com/services/oauth2/callback`
   - **Selected OAuth Scopes**: Move these to the right:
     - `Full access (full)`
     - `Perform requests on your behalf at any time (refresh_token, offline_access)`

6. Click **Save** → Click **Continue**

7. **Copy Your Credentials:**
   - Click **Manage Consumer Details** button
   - **COPY** the `Consumer Key` (this is your Client ID)
   - **COPY** the `Consumer Secret` (this is your Client Secret)

### Step 2: Get Your Security Token

1. In Salesforce, click your **profile picture** (top right) → **Settings**

2. On the left sidebar: **My Personal Information** → **Reset My Security Token**

3. Click **Reset Security Token** button

4. Check your email - you'll receive your new security token

### Step 3: Configure the App

Open `services/syncService.ts` and update lines 12-18:

```typescript
const SALESFORCE_CONFIG = {
  instanceUrl: 'https://YOUR-DOMAIN.my.salesforce.com',  // Your Salesforce domain
  clientId: 'PASTE_CONSUMER_KEY_HERE',                    // From Step 1
  clientSecret: 'PASTE_CONSUMER_SECRET_HERE',             // From Step 1
  username: 'your-salesforce-email@company.com',          // Your Salesforce login
  password: 'YourPassword',                                // Your Salesforce password
  securityToken: 'PASTE_TOKEN_FROM_EMAIL',                // From Step 2
};
```

**Example:**
```typescript
const SALESFORCE_CONFIG = {
  instanceUrl: 'https://rainsoft-dev-ed.my.salesforce.com',
  clientId: '3MVG9pRzvMkjMb6lZlt3YjDQNINm...',
  clientSecret: '1234567890123456789',
  username: 'admin@rainsoft.com',
  password: 'MyPass123',
  securityToken: 'abcXYZ123tokenHere',
};
```

### Step 4: Create Custom Fields in Salesforce

1. **Setup** → Quick Find: **Object Manager** → **Lead**

2. Click **Fields & Relationships** → **New**

3. Create these fields (one at a time):

| Field Label | API Name | Type | Length |
|------------|----------|------|--------|
| Buys Bottled Water | Buys_Bottled_Water__c | Checkbox | - |
| Is Homeowner | Is_Homeowner__c | Checkbox | - |
| Has Salt System | Has_Salt_System__c | Checkbox | - |
| Water Quality | Water_Quality__c | Text | 50 |
| Water Source | Water_Source__c | Text | 50 |
| Current Treatment | Current_Treatment__c | Text | 100 |
| Property Type | Property_Type__c | Text | 50 |
| Survey Store | Survey_Store__c | Picklist | Values: "Lowes", "Home Depot" |
| Survey Date | Survey_Date__c | Date/Time | - |
| Survey Employee ID | Survey_Employee_ID__c | Text | 50 |
| Survey ID | Survey_ID__c | Text | 50 |
| Has Signature | Has_Signature__c | Checkbox | - |

### Step 5: Test the Connection

1. Open the app → Login as admin

2. Go to **Admin Dashboard** → **Sync Status**

3. Click **Test Connections** button

4. You should see: **"Salesforce: ✓ Connected"**

---

## Option 2: Even Simpler - Use Zapier Only 🔌

**Don't want to deal with Salesforce setup at all?**

Send surveys to Zapier, and let Zapier send them to Salesforce:

1. **In Zapier:**
   - Create Zap: Webhook → Salesforce
   - Trigger: Catch Hook
   - Action: Create Lead in Salesforce
   - Map fields from webhook to Salesforce

2. **In the app:**
   - Only configure `ZAPIER_WEBHOOK_URL`
   - Zapier handles all Salesforce integration
   - No Salesforce coding needed!

---

## Troubleshooting

### "Authentication Failed"
- ✅ Check your password is correct
- ✅ Security token must be appended to password in config
- ✅ Username must be your Salesforce login email
- ✅ Instance URL must include `https://` and `.my.salesforce.com`

### "Invalid Client"
- ✅ Client ID and Secret must be from the Connected App
- ✅ Wait 2-10 minutes after creating Connected App (Salesforce needs time to activate)

### "IP Restricted"
- ✅ In Connected App settings, set "IP Relaxation" to "Relax IP restrictions"

### "API Not Enabled"
- ✅ Check your Salesforce edition includes API access (Professional, Enterprise, Unlimited)
- ✅ Contact your Salesforce admin to enable API access

---

## Next Steps

Once configured and tested:

1. ✅ Surveys will automatically sync to Salesforce when online
2. ✅ Duplicates will be detected and flagged for review
3. ✅ Background sync runs every 5 minutes
4. ✅ Failed syncs are logged and retried automatically

**All survey data is always saved locally first - nothing is ever lost!**
