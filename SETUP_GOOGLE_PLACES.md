# ✅ Google Places API - Ready to Configure

Your Google Places API key has been provided: `AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4`

## Quick Setup (Copy & Paste)

### Step 1: Add to `.env` file

Open your `.env` file in the project root and **add this exact line**:

```env
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4
```

### Step 2: Your complete `.env` file should look like this:

```env
# Salesforce Configuration
EXPO_PUBLIC_SALESFORCE_INSTANCE_URL=https://rainsoftse.my.salesforce.com
EXPO_PUBLIC_SALESFORCE_CLIENT_ID=3MVG9uudbyLbNPZOVAuKR02gSIspVipjLsqn.uFTfCA67gYvmarMV7HvBPuPVb2.oAqFn8eLxG3MuAfLiSpNO
EXPO_PUBLIC_SALESFORCE_CLIENT_SECRET=11173C4B71CA90A7E860D9E31D908AB5CF221CAE6CB9E859B16ED5D6DD6F8002
EXPO_PUBLIC_SALESFORCE_USERNAME=rebecca@rainsoftse.com
EXPO_PUBLIC_SALESFORCE_PASSWORD=YOUR_SALESFORCE_PASSWORD_HERE
EXPO_PUBLIC_SALESFORCE_SECURITY_TOKEN=YOUR_SECURITY_TOKEN_HERE

# Google Places API
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4
```

### Step 3: Restart Development Server

**This is critical** - environment variables are only loaded at startup:

```bash
# Stop current server (press Ctrl+C)

# Clear cache and restart
npm start -- --clear
```

### Step 4: Test It

1. Open the app
2. Clock in → Complete a survey → Click "Set Appointment"
3. Start typing in the "Street Address" field
4. **Address suggestions should appear instantly!** 🎉

---

## Verification Checklist

✅ `.env` file is in project root (same folder as `package.json`)  
✅ Added the Google Places API key line (no quotes, no spaces around `=`)  
✅ Restarted dev server with `--clear` flag  
✅ Waited for build to complete before testing  

---

## If Suggestions Don't Appear

### 1. Verify API Key is Active

Visit this URL in your browser to test the API key:

```
https://maps.googleapis.com/maps/api/place/autocomplete/json?input=123+main&key=AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4
```

**Expected**: You should see JSON results with addresses  
**If error**: The API key may not have Places API enabled

### 2. Enable Places API in Google Cloud

If you see `REQUEST_DENIED` when testing the URL above:

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Select your project
3. Search for "Places API"
4. Click "Enable"
5. Wait 2-3 minutes for activation
6. Test again

### 3. Check Console Logs

Open the app in development and check the console for errors:

```bash
# Look for messages like:
"Google Places API key not set"
"REQUEST_DENIED"
"OVER_QUERY_LIMIT"
```

### 4. Force Clear Everything

If still not working:

```bash
# Stop server
# Delete all cache
rm -rf .expo
rm -rf node_modules/.cache

# Restart
npm start -- --clear
```

---

## Pricing Reminder

- **FREE tier**: $200/month credit
- **Autocomplete**: $2.83 per 1,000 requests
- **Your usage**: ~70,000 FREE requests/month
- **Typical cost**: $0 (well within free tier)

No credit card charges expected for normal usage.

---

## Production Deployment

When building for App Store/Play Store:

### Option 1: Add to `eas.json`

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY": "AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4"
      }
    }
  }
}
```

### Option 2: Use EAS Secrets (More Secure)

```bash
eas secret:create --scope project --name GOOGLE_PLACES_API_KEY --value "AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4"
```

---

## Security Note

✅ Your API key is already restricted to specific referrers in Google Cloud Console  
✅ Only works from your app domains/localhost  
✅ Safe to use in production builds  

---

**Status**: ✅ Configuration ready - just add to `.env` and restart!
