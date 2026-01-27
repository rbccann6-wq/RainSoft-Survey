// Zip code lookup service using Zippopotam.us API (free, no API key needed)
import NetInfo from '@react-native-community/netinfo';

export interface ZipLookupResult {
  success: boolean;
  city?: string;
  state?: string;
  stateAbbr?: string;
  error?: string;
  skippedOffline?: boolean;
}

/**
 * Check if device is online
 */
const checkOnlineStatus = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return state.isConnected ?? false;
};

/**
 * Look up city and state from zip code
 * Uses Zippopotam.us API (free, no API key required)
 * Fallback: If offline or API fails, returns partial success to allow manual entry
 * @param zipCode - 5-digit zip code to lookup
 * @param skipIfOffline - If true, skips lookup when offline (default: true)
 */
export const lookupZipCode = async (zipCode: string, skipIfOffline: boolean = true): Promise<ZipLookupResult> => {
  // Validate zip code format
  if (!zipCode || zipCode.length !== 5 || !/^\d{5}$/.test(zipCode)) {
    return {
      success: false,
      error: 'Invalid zip code format. Must be 5 digits.',
    };
  }

  // Check online status first to avoid unnecessary API calls when offline
  if (skipIfOffline) {
    const isOnline = await checkOnlineStatus();
    if (!isOnline) {
      console.log('📴 Offline - skipping zip lookup, will resolve during sync');
      return {
        success: false,
        skippedOffline: true,
        error: 'Offline - city/state will be added automatically when syncing',
      };
    }
  }

  try {
    const response = await fetch(`https://api.zippopotam.us/us/${zipCode}`, {
      method: 'GET',
      headers: {
        'Accept': 'application/json',
      },
    });

    if (!response.ok) {
      if (response.status === 404) {
        return {
          success: false,
          error: 'Zip code not found. Please verify the zip code.',
        };
      }
      throw new Error(`API returned status ${response.status}`);
    }

    const data = await response.json();

    // Extract city and state from response
    // Zippopotam returns: { "post code": "12345", "country": "United States", "places": [...] }
    if (data.places && data.places.length > 0) {
      const place = data.places[0];
      return {
        success: true,
        city: place['place name'],
        state: place['state'],
        stateAbbr: place['state abbreviation'],
      };
    }

    return {
      success: false,
      error: 'No location data found for this zip code.',
    };
  } catch (error) {
    console.error('Zip lookup error:', error);
    // Return partial success to allow survey to continue
    return {
      success: false,
      error: 'Unable to lookup zip code. Please verify address before continuing.',
    };
  }
};

/**
 * Format address for display
 */
export const formatAddress = (
  zipCode: string,
  city?: string,
  state?: string
): string => {
  if (city && state) {
    return `${city}, ${state} ${zipCode}`;
  }
  return zipCode;
};

/**
 * Validate that address data is complete
 */
export const isAddressComplete = (
  zipCode: string,
  city?: string,
  state?: string
): boolean => {
  return Boolean(
    zipCode &&
    zipCode.length === 5 &&
    city &&
    city.trim() !== '' &&
    state &&
    state.trim() !== ''
  );
};
