# ⚠️ SALESFORCE CONNECTION FAILED - CREDENTIALS MISSING

## The Problem

Your Salesforce test connection is failing because the password and security token are not set in the `.env` file.

## Current Configuration

Your `.env` file currently has:

```env
EXPO_PUBLIC_SALESFORCE_INSTANCE_URL=https://rainsoftse.my.salesforce.com
EXPO_PUBLIC_SALESFORCE_CLIENT_ID=3MVG9uudbyLbNPZOVAuKR02gSIspVipjLsqn.uFTfCA67gYvmarMV7HvBPuPVb2.oAqFn8eLxG3MuAfLiSpNO
EXPO_PUBLIC_SALESFORCE_CLIENT_SECRET=11173C4B71CA90A7E860D9E31D908AB5CF221CAE6CB9E859B16ED5D6DD6F8002
EXPO_PUBLIC_SALESFORCE_USERNAME=rebecca@rainsoftse.com
EXPO_PUBLIC_SALESFORCE_PASSWORD=YOUR_SALESFORCE_PASSWORD_HERE     ← NEEDS REAL PASSWORD
EXPO_PUBLIC_SALESFORCE_SECURITY_TOKEN=YOUR_SECURITY_TOKEN_HERE     ← NEEDS REAL TOKEN
```

## ✅ Required Actions

### Step 1: Get Your Salesforce Security Token

1. Log in to Salesforce: https://rainsoftse.my.salesforce.com
2. Click your profile icon (top right) → Settings
3. In Quick Find, search for "Reset My Security Token"
4. Click "Reset Security Token"
5. **Check your email** - Salesforce will send the token to `rebecca@rainsoftse.com`

### Step 2: Update `.env` File

Open your `.env` file and replace the placeholder values with your actual credentials:

```env
# Salesforce Configuration
EXPO_PUBLIC_SALESFORCE_INSTANCE_URL=https://rainsoftse.my.salesforce.com
EXPO_PUBLIC_SALESFORCE_CLIENT_ID=3MVG9uudbyLbNPZOVAuKR02gSIspVipjLsqn.uFTfCA67gYvmarMV7HvBPuPVb2.oAqFn8eLxG3MuAfLiSpNO
EXPO_PUBLIC_SALESFORCE_CLIENT_SECRET=11173C4B71CA90A7E860D9E31D908AB5CF221CAE6CB9E859B16ED5D6DD6F8002
EXPO_PUBLIC_SALESFORCE_USERNAME=rebecca@rainsoftse.com
EXPO_PUBLIC_SALESFORCE_PASSWORD=YourActualPassword123        ← Your Salesforce password
EXPO_PUBLIC_SALESFORCE_SECURITY_TOKEN=AbCdEfGh1234567890      ← Token from email

# Google Places API
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSyBDRqxbLn0afzA3c0SutwcTpf3US-ll4j4
```

### Step 3: Restart Development Server

**Critical** - Environment variables only load at startup:

```bash
# Stop server (Ctrl+C)
npm start -- --clear
```

### Step 4: Test Connection

1. Open app → Go to Admin Dashboard
2. Navigate to Sync Dashboard
3. Click "Test Connections"
4. **Salesforce should now show ✓ OK**

---

## Security Token Format

Your security token should look like: `AbCdEfGh1234567890` (a random alphanumeric string)

**Example of correct `.env` entry:**
```env
EXPO_PUBLIC_SALESFORCE_PASSWORD=MyPassword123
EXPO_PUBLIC_SALESFORCE_SECURITY_TOKEN=Xj7kP2mN9qRs4tYw
```

---

## Troubleshooting

### "Invalid username, password, security token; or user locked out"

**Cause**: Wrong password or token  
**Fix**: 
1. Try logging into Salesforce directly with the password
2. If login fails, reset your password first
3. Then reset security token
4. Update both in `.env`

### "REQUEST_DENIED" or "INVALID_LOGIN"

**Cause**: Token expired or IP restrictions  
**Fix**:
1. Reset security token again (tokens expire if not used)
2. Check Salesforce → Setup → Login IP Ranges
3. Add your IP address to allowed ranges

### Connection still fails after updating

**Try this**:
```bash
# Stop server
# Delete all cache
rm -rf .expo
rm -rf node_modules/.cache

# Update .env with real credentials
# Restart fresh
npm start -- --clear
```

---

## Where to Find Each Value

| Variable | Where to Find |
|----------|---------------|
| Instance URL | Already correct: `https://rainsoftse.my.salesforce.com` |
| Client ID | Already correct (OAuth Connected App) |
| Client Secret | Already correct (OAuth Connected App) |
| Username | Already correct: `rebecca@rainsoftse.com` |
| **Password** | Your Salesforce login password |
| **Security Token** | Email after resetting (Settings → Reset Security Token) |

---

## After Setup

Once credentials are configured:
- ✅ Salesforce test connection will succeed
- ✅ Surveys will sync automatically
- ✅ Duplicate detection will work
- ✅ Lead records will be created in Salesforce

---

**Next Step**: Add your real Salesforce password and security token to `.env`, then restart the server.
