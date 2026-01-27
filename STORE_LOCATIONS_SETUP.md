# Store Locations Setup Guide

## Overview

Your RainSoft survey app now uses GPS-based store location matching to automatically detect which specific Home Depot or Lowes store employees are working at. This provides accurate location verification and better data for Salesforce/Zapier syncing.

## How It Works

1. **Clock In**: When employees clock in, the app captures GPS coordinates
2. **Store Matching**: GPS coordinates are matched to the nearest store in your database (within 500 meters)
3. **Store Verification**: If a match is found, the specific store name (e.g., "HOME DEPOT 0808") is recorded
4. **Survey Sync**: All surveys include the verified store location for Salesforce/Zapier

## Adding Your Store Locations

Edit `services/storeLocationsService.ts` and add your actual store locations to the `STORE_LOCATIONS` array:

```typescript
export const STORE_LOCATIONS: StoreLocation[] = [
  {
    id: 'hd-0808',                    // Unique ID
    storeName: 'HOME DEPOT 0808',     // Display name (what syncs to Salesforce)
    storeNumber: '0808',              // Store number only
    storeType: 'Home Depot',          // Must be 'Home Depot' or 'Lowes'
    address: '3489 Ross Clark Cir',          // Street address
    city: 'Dothan',
    state: 'AL',
    zipCode: '36303',
    coordinates: {
      latitude: 31.24679,              // GPS latitude
      longitude: -85.42955,            // GPS longitude
    },
  },
  // Add more stores...
];
```

## Getting GPS Coordinates for Stores

### Method 1: Google Maps (Recommended)
1. Go to https://maps.google.com
2. Search for the store address
3. Right-click on the store location
4. Click "What's here?"
5. Copy the coordinates (e.g., `33.7490, -84.3880`)

### Method 2: From Your Surveyor's App
1. Have your surveyor clock in at the store
2. Check the admin dashboard under "Time Entries"
3. Copy the GPS coordinates shown
4. Add to the STORE_LOCATIONS array

## Data Synced to Salesforce/Zapier

Each survey now includes these fields:

- **store**: Generic type ("Lowes" or "Home Depot")
- **storeName**: Specific location ("HOME DEPOT 0808")
- **storeNumber**: Store number only ("0808")
- **storeAddress**: Full verified address
- **locationVerified**: true/false (whether GPS matched)

## Field Mapping Recommendations

### Salesforce
- Map `storeName` to a custom field: **RainSoft_Store_Location__c**
- Map `storeNumber` to: **Store_Number__c**
- Map `storeAddress` to: **Store_Address__c**

### Zapier
- Use `storeName` in your webhook payload
- Filter/route based on `storeNumber`
- Include `locationVerified` to flag unverified surveys

## Configuration Options

Edit `services/storeLocationsService.ts` to adjust:

### Maximum Distance
```typescript
// Default: 500 meters
const nearestStore = findNearestStore(lat, lng, 500);

// Increase to 1000 meters (1km) for rural areas
const nearestStore = findNearestStore(lat, lng, 1000);
```

### Location Validation
Currently, employees can clock in even if GPS doesn't match any store. To require verification:

```typescript
// In services/storageService.ts - clockIn function
if (gpsCoordinates) {
  const matchedStore = findNearestStore(...);
  
  if (!matchedStore) {
    // Uncomment to reject clock-ins without store match:
    // throw new Error('Not near any store location');
  }
}
```

## Troubleshooting

### GPS Not Matching
**Issue**: Employees are at the correct store but GPS doesn't match

**Solutions**:
1. Verify coordinates in STORE_LOCATIONS are correct
2. Increase maxDistanceMeters (stores have large parking lots)
3. Check GPS accuracy - should be < 50 meters

### Wrong Store Detected
**Issue**: GPS matches wrong store

**Solutions**:
1. Ensure store coordinates are precise
2. Decrease maxDistanceMeters
3. Verify no duplicate coordinates

### No GPS Coordinates
**Issue**: Surveys missing GPS data

**Solutions**:
1. Ensure location permissions granted
2. Check that clock-in process captured GPS
3. Verify device has GPS enabled

## Sample Store Locations (Atlanta Area)

```typescript
// Replace these with your actual store locations
export const STORE_LOCATIONS: StoreLocation[] = [
  // Home Depot - Buckhead
  {
    id: 'hd-0808',
    storeName: 'HOME DEPOT 0808',
    storeNumber: '0808',
    storeType: 'Home Depot',
    address: '3535 Piedmont Rd NE',
    city: 'Atlanta',
    state: 'GA',
    zipCode: '30305',
    coordinates: { latitude: 33.8490, longitude: -84.3680 },
  },
  
  // Home Depot - Midtown
  {
    id: 'hd-0809',
    storeName: 'HOME DEPOT 0809',
    storeNumber: '0809',
    storeType: 'Home Depot',
    address: '1245 Huff Rd NW',
    city: 'Atlanta',
    state: 'GA',
    zipCode: '30318',
    coordinates: { latitude: 33.7890, longitude: -84.4280 },
  },
  
  // Lowes - Perimeter
  {
    id: 'lowes-1234',
    storeName: 'LOWES 1234',
    storeNumber: '1234',
    storeType: 'Lowes',
    address: '1225 Caroline St NE',
    city: 'Atlanta',
    state: 'GA',
    zipCode: '30307',
    coordinates: { latitude: 33.7690, longitude: -84.3480 },
  },
  
  // Lowes - West Paces
  {
    id: 'lowes-1235',
    storeName: 'LOWES 1235',
    storeNumber: '1235',
    storeType: 'Lowes',
    address: '2855 Piedmont Rd NE',
    city: 'Atlanta',
    state: 'GA',
    zipCode: '30305',
    coordinates: { latitude: 33.8290, longitude: -84.3580 },
  },
];
```

## Testing

1. **Add Test Stores**: Add your real store locations to `STORE_LOCATIONS`
2. **Clock In**: Have surveyor clock in at a store
3. **Verify Match**: Check admin dashboard → Time Entries
   - Should show "Verified at HOME DEPOT 0808" or similar
   - Distance should be shown in meters
4. **Submit Survey**: Complete a survey
5. **Check Data**: Admin dashboard → Surveys
   - storeName should show specific location
   - locationVerified should be true

## Next Steps

1. **Collect Store Data**: Get GPS coordinates for all your locations
2. **Update Database**: Add all stores to `STORE_LOCATIONS`
3. **Test Verification**: Clock in at each store to verify matching works
4. **Configure Salesforce**: Map new fields in Salesforce
5. **Update Zapier**: Include store fields in webhook payload

## Support

If you need help:
1. Verify GPS coordinates are correct (use Google Maps)
2. Check console logs for matching results
3. Adjust maxDistanceMeters if needed
4. Test with physical device (GPS more accurate than simulator)
