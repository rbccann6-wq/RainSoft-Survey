# Google Places API Setup Guide

The appointment address autocomplete feature requires a Google Places API key.

## Quick Setup (5 minutes)

### 1. Get Your API Key

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. **Create a new project** (or select existing):
   - Click dropdown at top → "New Project"
   - Name it: "RainSoft Survey App"
   - Click "Create"

3. **Enable Places API**:
   - In the search bar, type "Places API"
   - Click "Places API" → "Enable"

4. **Create API Key**:
   - Go to "Credentials" (left sidebar)
   - Click "+ CREATE CREDENTIALS" → "API key"
   - Copy the API key (starts with `AIza...`)

### 2. Secure Your API Key (IMPORTANT)

⚠️ **Do this immediately to prevent unauthorized usage and charges**

1. Click "RESTRICT KEY" (or edit the key you just created)
2. Under **Application restrictions**:
   - Select "HTTP referrers (web sites)"
   - Add allowed referrers:
     ```
     localhost:8081/*
     *.exp.direct/*
     *.expo.dev/*
     ```
   
3. Under **API restrictions**:
   - Select "Restrict key"
   - Choose "Places API" from the dropdown
   
4. Click "Save"

### 3. Add to Your App

Open `.env` file in your project root and add:

```env
EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIzaSy...your-actual-key-here
```

### 4. Restart Development Server

```bash
# Stop current server (Ctrl+C)
npm start -- --clear
```

### 5. Test It

1. Open app
2. Clock in → Complete survey → Set Appointment
3. Start typing an address in the "Street Address" field
4. You should see autocomplete suggestions appear

---

## Pricing

**Google Places API Pricing** (as of 2024):

- **Autocomplete**: $2.83 per 1,000 requests
- **Free tier**: $200/month credit = ~70,000 autocomplete requests/month
- **Typical usage**: 5-10 appointments/day = ~$0.15/month

**You won't be charged** unless you exceed the free tier.

---

## Troubleshooting

### ❌ "This API key is not authorized"

**Cause**: Key restrictions too tight

**Fix**:
1. Go to Google Cloud Console → Credentials
2. Edit your API key
3. Under "Application restrictions" → Add `*` temporarily
4. Test if it works
5. Re-add proper restrictions after confirming

### ❌ No autocomplete suggestions appear

**Causes**:
1. API key not set in `.env`
2. Development server not restarted
3. Places API not enabled

**Fix**:
1. Check `.env` file has `EXPO_PUBLIC_GOOGLE_PLACES_API_KEY=AIza...`
2. Restart: `npm start -- --clear`
3. Verify Places API enabled in Google Cloud Console

### ❌ "Billing must be enabled"

**Cause**: Free tier requires credit card on file

**Fix**:
1. Go to Google Cloud Console → Billing
2. Add a payment method (you won't be charged within free tier)
3. Wait 5 minutes and try again

### ❌ Autocomplete works in dev but not in production

**Cause**: Key restrictions don't include production URLs

**Fix**:
1. Edit API key restrictions
2. Add your production domains:
   ```
   yourapp.com/*
   *.yourapp.com/*
   ```

---

## Alternative: Manual Address Entry

If you **don't want to use Google Places API**, you can disable autocomplete and use manual entry:

1. Open `app/kiosk/appointment.tsx`
2. Replace the `GooglePlacesAutocomplete` component with:

```tsx
<Input
  label="Street Address"
  value={address}
  onChangeText={setAddress}
  placeholder="123 Main St, City, State, Zip"
  borderColor={theme.primary}
/>
```

This removes the dependency on Google Places API but users will need to type addresses manually.

---

## Production Deployment

For production builds with EAS:

```bash
# Set as EAS secret (recommended)
eas secret:create --scope project --name GOOGLE_PLACES_API_KEY --value "AIza...your-key"
```

Or add to `eas.json`:

```json
{
  "build": {
    "production": {
      "env": {
        "EXPO_PUBLIC_GOOGLE_PLACES_API_KEY": "AIza...your-key"
      }
    }
  }
}
```

---

## Support

**Google Places API Documentation**:
- [Get Started Guide](https://developers.google.com/maps/documentation/places/web-service/get-api-key)
- [Autocomplete API](https://developers.google.com/maps/documentation/places/web-service/autocomplete)
- [Pricing Calculator](https://mapsplatform.google.com/pricing/)

**Need Help?**
- Check the [Troubleshooting](#troubleshooting) section above
- Review your Google Cloud Console logs
- Verify billing is enabled (required for free tier)
