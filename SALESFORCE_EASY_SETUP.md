# ✅ Salesforce Simple Setup (No .env File Needed!)

## Overview

Your Salesforce integration now uses an **Edge Function** that handles all API calls server-side. You only need to configure **2-3 credentials** in OnSpace Cloud Secrets (no `.env` file editing needed).

---

## Step 1: Add Credentials to OnSpace Cloud

1. **Open your OnSpace project**
2. **Click "Cloud" button** (top-right navigation)
3. **Go to "Secrets" tab**
4. **Add these secrets:**

| Secret Name | Value | Where to Get It |
|-------------|-------|-----------------|
| `SALESFORCE_INSTANCE_URL` | `https://rainsoftse.my.salesforce.com` | Already correct |
| `SALESFORCE_CLIENT_ID` | `3MVG9uudbyLbNPZOVAuKR02gSIspVipjLsqn.uFTfCA67gYvmarMV7HvBPuPVb2.oAqFn8eLxG3MuAfLiSpNO` | Already correct (OAuth App) |
| `SALESFORCE_CLIENT_SECRET` | `11173C4B71CA90A7E860D9E31D908AB5CF221CAE6CB9E859B16ED5D6DD6F8002` | Already correct (OAuth App) |
| `SALESFORCE_USERNAME` | `rebecca@rainsoftse.com` | Your Salesforce login email |
| `SALESFORCE_PASSWORD` | **(See below)** | Your Salesforce password (+ security token) |

---

## Step 2: Prepare Your Password

### Option A: Password Only (If IP Whitelisting is Enabled)

If OnSpace backend IP is whitelisted in Salesforce:
```
SALESFORCE_PASSWORD = YourPassword123
```

### Option B: Password + Security Token (Default - Recommended)

1. **Get your security token:**
   - Log into Salesforce → Profile Icon → Settings
   - Search "Reset My Security Token"
   - Click "Reset Security Token"
   - **Check your email** for the token (looks like `AbCdEfGh1234567890`)

2. **Combine password + token** (NO SPACE):
   ```
   SALESFORCE_PASSWORD = YourPassword123AbCdEfGh1234567890
   ```
   Example: If password is `MyPass456` and token is `XyZ789Abc`, enter:
   ```
   MyPass456XyZ789Abc
   ```

---

## Step 3: Save & Deploy

1. **Click "Save" in Secrets tab**
2. **Wait 30 seconds** for Edge Function to reload
3. Done! No server restart needed

---

## Step 4: Test Connection

1. Open app → Admin Dashboard
2. Go to **Sync Dashboard**
3. Click **"Test Connections"** button
4. **Salesforce should show ✓ OK**

---

## Troubleshooting

### "Authentication Failed"

**Cause:** Wrong password or token  
**Fix:**
1. Try logging into Salesforce directly with your password
2. If that fails, reset your Salesforce password first
3. Then reset security token (Settings → Reset Security Token)
4. Combine new password + new token
5. Update `SALESFORCE_PASSWORD` secret in Cloud → Secrets

### "Invalid Grant"

**Cause:** Security token expired or missing  
**Fix:**
1. Reset security token (Salesforce → Settings → Reset Security Token)
2. Check email for new token
3. Combine password + new token (no spaces!)
4. Update secret

### Still Failing?

**Check IP Whitelisting:**
1. Salesforce → Setup → Security → Network Access
2. Add OnSpace backend IP range if needed
3. OR use Password + Security Token approach (no whitelisting needed)

---

## Benefits of This Approach

✅ **No `.env` file editing** - all config in Cloud dashboard  
✅ **No app restart** - Edge Functions reload automatically  
✅ **More secure** - credentials never exposed to client  
✅ **Easier management** - change credentials anytime in Cloud UI  
✅ **Better debugging** - Edge Function logs show detailed errors

---

## What Changed?

**Before:** Client-side Salesforce calls with 5 credentials in `.env`  
**After:** Server-side Edge Function with 5 credentials in Cloud Secrets

**Your React Native code stays the same** - it now calls the Edge Function instead of Salesforce directly.

---

## Next Steps

After Salesforce connection shows ✓ OK:
1. Try a test survey sync (go to Surveys page → Retry Sync)
2. Check Edge Function logs if sync fails (Cloud → Log tab)
3. All your survey data will start syncing automatically!

---

**Need help?** Check the Edge Function logs in Cloud → Log → select `salesforce-sync`
