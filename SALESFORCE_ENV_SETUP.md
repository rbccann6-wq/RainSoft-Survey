# Salesforce Environment Variables Setup

## ⚠️ CRITICAL SECURITY FIX

Salesforce credentials have been removed from the codebase and moved to environment variables to prevent security breaches.

## Setup Instructions

### 1. Create `.env` file in project root

Create a file named `.env` in the root of your project (same level as `package.json`):

```env
# Salesforce Configuration
EXPO_PUBLIC_SALESFORCE_INSTANCE_URL=https://rainsoftse.my.salesforce.com
EXPO_PUBLIC_SALESFORCE_CLIENT_ID=3MVG9uudbyLbNPZOVAuKR02gSIspVipjLsqn.uFTfCA67gYvmarMV7HvBPuPVb2.oAqFn8eLxG3MuAfLiSpNO
EXPO_PUBLIC_SALESFORCE_CLIENT_SECRET=11173C4B71CA90A7E860D9E31D908AB5CF221CAE6CB9E859B16ED5D6DD6F8002
EXPO_PUBLIC_SALESFORCE_USERNAME=rebecca@rainsoftse.com
EXPO_PUBLIC_SALESFORCE_PASSWORD=YOUR_SALESFORCE_PASSWORD_HERE
EXPO_PUBLIC_SALESFORCE_SECURITY_TOKEN=YOUR_SECURITY_TOKEN_HERE
```

### 2. Update Your Credentials

Replace the placeholder values with your actual Salesforce credentials:

- **Instance URL**: Your Salesforce domain (e.g., `https://yourcompany.my.salesforce.com`)
- **Client ID**: From your Connected App in Salesforce
- **Client Secret**: From your Connected App in Salesforce
- **Username**: Your Salesforce login email
- **Password**: Your Salesforce login password
- **Security Token**: Your Salesforce security token (if IP restrictions are enabled)

### 3. Secure the `.env` File

**IMPORTANT**: The `.env` file is already in `.gitignore`, so it will NOT be committed to Git. This keeps your credentials safe.

```bash
# Verify .env is ignored
git status

# You should NOT see .env in the list of files to commit
```

### 4. Restart Development Server

After creating/updating `.env`, restart your Expo development server:

```bash
# Stop the current server (Ctrl+C)

# Clear cache and restart
npm start -- --clear
```

### 5. Verify Configuration

Test your Salesforce connection in the app:

1. Open the app
2. Go to Admin → Settings → Sync Dashboard
3. Click "Test Salesforce Connection"
4. You should see "✅ Salesforce connection successful"

## Finding Your Salesforce Credentials

### Connected App Credentials

1. Log in to Salesforce
2. Go to **Setup** → **Apps** → **App Manager**
3. Find your connected app (or create a new one)
4. Click **View** → **Manage Consumer Details**
5. Copy **Consumer Key** (Client ID) and **Consumer Secret** (Client Secret)

### Security Token

If you need a security token:

1. Go to **Setup** → **Personal Settings** → **Reset Security Token**
2. Click **Reset Security Token**
3. Check your email for the new token

**Note**: If IP Relaxation is enabled in your Connected App, you may not need a security token (leave it empty).

## Environment Variables in Production

### For Expo EAS Build

When building with EAS, add environment variables to `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_SALESFORCE_INSTANCE_URL": "https://rainsoftse.my.salesforce.com",
        "EXPO_PUBLIC_SALESFORCE_CLIENT_ID": "your_client_id",
        "EXPO_PUBLIC_SALESFORCE_CLIENT_SECRET": "your_client_secret",
        "EXPO_PUBLIC_SALESFORCE_USERNAME": "your_username",
        "EXPO_PUBLIC_SALESFORCE_PASSWORD": "your_password",
        "EXPO_PUBLIC_SALESFORCE_SECURITY_TOKEN": "your_token"
      }
    }
  }
}
```

**Or** use EAS Secrets (recommended):

```bash
eas secret:create --scope project --name SALESFORCE_PASSWORD --value "your_password"
eas secret:create --scope project --name SALESFORCE_SECURITY_TOKEN --value "your_token"
```

## Troubleshooting

### Error: "SALESFORCE_CONFIG values are empty"

**Cause**: Environment variables not loaded

**Fix**:
1. Verify `.env` file exists in project root
2. Restart development server: `npm start -- --clear`
3. Check that variable names start with `EXPO_PUBLIC_`

### Error: "Salesforce authentication failed"

**Cause**: Incorrect credentials

**Fix**:
1. Double-check all credentials in `.env`
2. Verify username/password work in Salesforce web login
3. If using security token, ensure it's current (reset if needed)
4. Check Connected App is enabled and has correct OAuth scopes

### Error: "Access denied" or "Invalid grant"

**Cause**: IP restrictions or OAuth settings

**Fix**:
1. In Connected App → Edit Policies
2. Enable **IP Relaxation** → "Relax IP restrictions"
3. Or add your IP addresses to **Trusted IP Ranges**

## Security Best Practices

✅ **DO**:
- Keep `.env` in `.gitignore`
- Use EAS Secrets for production builds
- Rotate credentials regularly
- Use separate credentials for dev/prod

❌ **DON'T**:
- Commit `.env` to Git
- Share credentials in chat/email
- Use production credentials in development
- Hard-code credentials in source files

## Support

If you encounter issues:

1. Check the Troubleshooting section above
2. Verify credentials in Salesforce Setup
3. Test connection in app (Sync Dashboard → Test Salesforce)
4. Review console logs for detailed error messages

---

**Remember**: Your Salesforce credentials are now safely stored in environment variables instead of being hard-coded in your source files. This is a critical security improvement that prevents unauthorized access to your production Salesforce data.
