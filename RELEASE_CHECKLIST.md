# Pre-Release Checklist - RainSoft Survey App

✅ = **COMPLETED**  
⚠️ = **ACTION REQUIRED**  
📋 = **IN PROGRESS**

---

## 🔴 CRITICAL FIXES (Must Complete Before Publishing)

### 1. Security - Salesforce Credentials ✅ **FIXED**

**Status**: ✅ **COMPLETED**

**What was done**:
- ✅ Removed hardcoded Salesforce credentials from `services/syncService.ts`
- ✅ Moved all credentials to environment variables (`EXPO_PUBLIC_*`)
- ✅ Created `SALESFORCE_ENV_SETUP.md` with setup instructions
- ✅ Updated code to read from `process.env.*`

**Your action**:
1. Create `.env` file in project root (see `SALESFORCE_ENV_SETUP.md`)
2. Add your actual Salesforce credentials
3. Test Salesforce connection: Admin → Settings → Sync Dashboard → "Test Salesforce"

---

### 2. Compliance - Delete Account Feature ✅ **FIXED**

**Status**: ✅ **COMPLETED**

**What was done**:
- ✅ Added "Delete My Account" button in Profile → Account Management
- ✅ Implemented account deletion with Supabase Auth
- ✅ Added comprehensive warning dialog explaining what gets deleted
- ✅ Data retention compliance (payroll/tax docs retained per legal requirements)

**Your action**:
1. Test account deletion flow:
   - Create test employee account
   - Go to Kiosk → Profile → Account Management
   - Tap "Delete My Account"
   - Verify account is deleted and user is logged out

---

### 3. Privacy Policy ✅ **CREATED**

**Status**: ✅ **COMPLETED**

**What was done**:
- ✅ Created comprehensive privacy policy template (`PRIVACY_POLICY_TEMPLATE.md`)
- ✅ Documented all data collected (contact info, location, photos, work data, etc.)
- ✅ Listed all third-party services (Salesforce, Zapier, ADP, SendGrid, Twilio, Google)
- ✅ Included GDPR and CCPA compliance sections
- ✅ Created data collection summary table for App Store forms

**Your action**:
1. Open `PRIVACY_POLICY_TEMPLATE.md`
2. Replace all placeholders with your actual information:
   - `[Your Company Name]`
   - `[your-email@company.com]`
   - `[your-phone-number]`
   - `[Street Address, City, State, ZIP]`
3. **Have a lawyer review** the policy
4. Publish to your website
5. Add link to privacy policy in app (Settings screen)

---

## 🟡 RECOMMENDED FIXES (Before App Store Submission)

### 4. Google API Key Verification ⚠️ **ACTION REQUIRED**

**Status**: ⚠️ **NEEDS VERIFICATION**

**Location**: `app/kiosk/appointment.tsx:33`

**Current code**:
```typescript
key: 'AIzaSyBGKZ8vZ9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z9Z',  // Placeholder or real?
```

**Your action**:
1. Check if this is a real API key or placeholder
2. If placeholder, replace with actual Google Places API key
3. Move to environment variable:
   ```env
   EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=your_actual_key_here
   ```
4. Update code:
   ```typescript
   key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '',
   ```

---

### 5. Console.log Cleanup ⚠️ **OPTIONAL**

**Status**: 📋 **172+ instances found**

**Impact**: Non-blocking, but increases bundle size

**Your action** (optional):
1. Review `services/failsafeStorage.ts` and `services/storageService.ts`
2. Keep critical logs (errors, failsafe operations)
3. Remove verbose debug logs (✅ signs, "Loading..." messages)
4. Or add conditional logging:
   ```typescript
   if (__DEV__) console.log('Debug info');
   ```

**Recommendation**: Leave critical logs for production troubleshooting, remove only verbose ones.

---

## 📱 APP STORE REQUIREMENTS

### 6. Privacy Nutrition Label ⚠️ **ACTION REQUIRED**

**Status**: ⚠️ **READY TO FILL**

**Your action**:

When submitting to App Store Connect, fill out the privacy questionnaire using data from `PRIVACY_POLICY_TEMPLATE.md` Appendix:

**Data Types Collected**:
- ✅ Contact Information (email, phone, name, address)
- ✅ Precise Location (GPS for clock in/out)
- ✅ Photos (profile pictures, clock in photos)
- ✅ Identifiers (user ID, device ID)
- ✅ Usage Data (app interactions, performance)
- ✅ Work Information (employment status, schedule, performance)
- ✅ Financial Info (direct deposit, tax withholding)
- ✅ Sensitive Info (government ID - driver's license)

**Third-Party Data Sharing**:
- ✅ Salesforce (survey data)
- ✅ Zapier (appointment data)
- ✅ ADP Workforce (time tracking, payroll)
- ✅ SendGrid (email notifications)
- ✅ Twilio (SMS notifications)
- ✅ Google Places (address autocomplete)

**Data Usage**:
- ✅ App Functionality
- ✅ Analytics
- ✅ Product Personalization
- ❌ NOT used for Third-Party Advertising

---

### 7. App Permissions Audit ✅ **CLEAN**

**Status**: ✅ **NO UNUSED PERMISSIONS**

**Verified in `app.json`**:
- ✅ No excessive permissions requested
- ✅ All permissions are actively used:
  - Camera (clock in photos, profile pictures)
  - Location (clock in/out verification)
  - Notifications (schedule alerts, messages)

**No action needed** ✅

---

### 8. Privacy Policy Link in App ⚠️ **ACTION REQUIRED**

**Status**: ⚠️ **NEEDS IMPLEMENTATION**

**Your action**:
1. Publish privacy policy to your website (e.g., `https://yourcompany.com/privacy`)
2. Add link in app Settings screen
3. Add link to App Store listing description

---

## 🔧 TECHNICAL SETUP

### 9. Environment Variables Configuration ⚠️ **ACTION REQUIRED**

**Status**: ⚠️ **NEEDS YOUR CREDENTIALS**

**Files to create/update**:

#### Development (`.env` file):
```env
# Salesforce
EXPO_PUBLIC_SALESFORCE_INSTANCE_URL=https://rainsoftse.my.salesforce.com
EXPO_PUBLIC_SALESFORCE_CLIENT_ID=YOUR_CLIENT_ID
EXPO_PUBLIC_SALESFORCE_CLIENT_SECRET=YOUR_CLIENT_SECRET
EXPO_PUBLIC_SALESFORCE_USERNAME=YOUR_USERNAME
EXPO_PUBLIC_SALESFORCE_PASSWORD=YOUR_PASSWORD
EXPO_PUBLIC_SALESFORCE_SECURITY_TOKEN=YOUR_TOKEN_IF_NEEDED

# Google Places API (if needed)
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=YOUR_GOOGLE_API_KEY
```

#### Production (EAS Secrets):
```bash
# Run these commands to set production secrets
eas secret:create --scope project --name SALESFORCE_PASSWORD --value "your_password"
eas secret:create --scope project --name SALESFORCE_SECURITY_TOKEN --value "your_token"
eas secret:create --scope project --name SALESFORCE_CLIENT_SECRET --value "your_secret"
eas secret:create --scope project --name GOOGLE_PLACES_API_KEY --value "your_key"
```

**See**: `SALESFORCE_ENV_SETUP.md` for detailed instructions

---

## 🧪 TESTING CHECKLIST

### 10. Pre-Launch Testing ⚠️ **ACTION REQUIRED**

**Before submitting to App Store, test**:

- [ ] **Delete Account Flow**
  - Create test employee account
  - Complete onboarding
  - Submit test surveys
  - Delete account from Profile
  - Verify account is gone (cannot log in)

- [ ] **Salesforce Sync**
  - Submit survey with phone number
  - Verify it syncs to Salesforce
  - Check duplicate detection
  - Test field mapping (Admin → Field Mapping)

- [ ] **Offline Mode**
  - Turn off WiFi/cellular
  - Submit surveys (should save locally)
  - Turn on network
  - Verify automatic sync

- [ ] **Clock In/Out**
  - Clock in with location services enabled
  - Verify GPS coordinates captured
  - Clock out
  - Check time entry in database

- [ ] **Privacy Compliance**
  - Delete account and verify data deletion
  - Export data (GDPR test)
  - Review what data is retained (payroll/tax docs)

---

## 📋 DOCUMENTATION UPDATES

### 11. Update App Description ⚠️ **ACTION REQUIRED**

**For App Store/Google Play listing**:

Add privacy policy link and data collection disclosure:

```
RainSoft Survey App - Employee survey kiosk for water treatment sales.

FEATURES:
• Clock in/out with GPS verification
• Customer survey questionnaire
• Appointment scheduling
• Employee scheduling & messaging
• Offline-first (works without internet)

PRIVACY:
We collect location data for clock in/out verification, survey responses for CRM, and employee work data for payroll.

Full privacy policy: [your-website.com/privacy]

REQUIREMENTS:
• Active employee account
• Location services (for clock in/out)
• Camera (for profile pictures)
```

---

## 🚀 DEPLOYMENT CHECKLIST

### 12. Pre-Deployment Steps

Before building production app:

- [ ] ✅ All critical fixes completed (Security, Compliance, Privacy)
- [ ] ⚠️ Environment variables configured (`.env` for dev, EAS secrets for prod)
- [ ] ⚠️ Privacy policy published to website
- [ ] ⚠️ Privacy policy link added to app
- [ ] ⚠️ Google API key verified/replaced
- [ ] ⚠️ All testing checklist items passed
- [ ] ⚠️ App Store description updated
- [ ] ⚠️ Privacy nutrition label ready

### 13. Build Commands

**Development build**:
```bash
npm start
```

**Production build (EAS)**:
```bash
# iOS
eas build --platform ios --profile production

# Android
eas build --platform android --profile production
```

**Submit to stores**:
```bash
# iOS App Store
eas submit --platform ios

# Google Play Store  
eas submit --platform android
```

---

## 📧 SUPPORT & CONTACT

If you encounter issues during release:

1. **Security/credentials issues**: See `SALESFORCE_ENV_SETUP.md`
2. **Privacy policy questions**: Consult with your lawyer
3. **Technical errors**: Check console logs and error messages
4. **App Store rejection**: Address specific reviewer feedback

---

## ✅ SUMMARY

**Completed**:
- ✅ Removed hardcoded Salesforce credentials (security fix)
- ✅ Implemented Delete Account feature (App Store requirement)
- ✅ Created comprehensive privacy policy template
- ✅ Documented all data collection for privacy forms
- ✅ Verified no unused permissions

**Your Action Items**:
1. ⚠️ Set up environment variables (`.env` file + EAS secrets)
2. ⚠️ Verify/replace Google API key
3. ⚠️ Customize and publish privacy policy
4. ⚠️ Add privacy policy link to app
5. ⚠️ Complete testing checklist
6. ⚠️ Fill out App Store privacy forms
7. ⚠️ Build and submit to App Store/Google Play

---

**Once all ⚠️ items are complete, you're ready to publish!** 🚀
