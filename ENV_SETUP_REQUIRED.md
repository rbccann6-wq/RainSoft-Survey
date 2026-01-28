# ⚠️ ADDRESS AUTOCOMPLETE NOT WORKING - ACTION REQUIRED

## The Problem

The address autocomplete requires a Google Places API key to be set in your `.env` file.

## Quick Fix (2 steps)

### Step 1: Add API Key to `.env`

Open the `.env` file in your project root and add this line:

```env
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4
```

**Your complete `.env` file should look like this:**

```env
# Salesforce Configuration
EXPO_PUBLIC_SALESFORCE_INSTANCE_URL=https://rainsoftse.my.salesforce.com
EXPO_PUBLIC_SALESFORCE_CLIENT_ID=3MVG9uudbyLbNPZOVAuKR02gSIspVipjLsqn.uFTfCA67gYvmarMV7HvBPuPVb2.oAqFn8eLxG3MuAfLiSpNO
EXPO_PUBLIC_SALESFORCE_CLIENT_SECRET=11173C4B71CA90A7E860D9E31D908AB5CF221CAE6CB9E859B16ED5D6DD6F8002
EXPO_PUBLIC_SALESFORCE_USERNAME=rebecca@rainsoftse.com
EXPO_PUBLIC_SALESFORCE_PASSWORD=YOUR_SALESFORCE_PASSWORD_HERE
EXPO_PUBLIC_SALESFORCE_SECURITY_TOKEN=YOUR_SECURITY_TOKEN_HERE

# Google Places API (ADD THIS LINE)
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4
```

### Step 2: Restart Dev Server

After adding the API key, you MUST restart the Expo server:

```bash
# Stop current server (press Ctrl+C in terminal)

# Clear cache and restart
npm start -- --clear
```

## How to Test

1. Open the app after restart
2. Clock in → Complete a survey → Set Appointment
3. Start typing in the "Street Address" field
4. **You should now see Google autocomplete suggestions!**

## If Still Not Working

### Check 1: Verify `.env` File Location

The `.env` file must be in the **root of your project** (same folder as `package.json`).

```
your-project/
  ├── .env          ← HERE (not in any subfolder)
  ├── package.json
  ├── app/
  ├── services/
  └── ...
```

### Check 2: Verify API Key Format

Open `.env` and make sure the line looks **exactly** like this (no quotes, no spaces):

```
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4
```

❌ **WRONG**:
```
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY = "AIzaSy..."  ← No quotes, no spaces
GOOGLE_PLACES_API_KEY=AIzaSy...                   ← Must start with EXPO_PUBLIC_
```

### Check 3: Clear Cache Completely

Sometimes Expo caches old environment variables. Force clear:

```bash
# Stop server
# Delete cache folders
rm -rf .expo
rm -rf node_modules/.cache

# Restart
npm start -- --clear
```

### Check 4: Test API Key Directly

Visit this URL in your browser to test if the API key works:

```
https://maps.googleapis.com/maps/api/place/autocomplete/json?input=123+main&key=AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4
```

If you see JSON results → API key is valid ✅  
If you see `REQUEST_DENIED` → API key is invalid or not enabled ❌

## Common Issues

| Error | Cause | Fix |
|-------|-------|-----|
| No suggestions appear | API key not loaded | Restart dev server with `--clear` flag |
| `REQUEST_DENIED` | API key not enabled | Enable Places API in Google Cloud Console |
| `API_KEY_INVALID` | Wrong API key format | Double-check key in `.env` (no typos) |
| `OVER_QUERY_LIMIT` | Free tier exceeded | Check Google Cloud billing |

## Need Help?

If autocomplete still doesn't work after following all steps:

1. Stop dev server
2. Delete `.expo` folder
3. Add the API key line to `.env` (verify no typos)
4. Restart: `npm start -- --clear`
5. Wait for build to complete
6. Test in app

---

**Your API Key**: `AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4`

**Copy this exact line into `.env`**:
```
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4
```
