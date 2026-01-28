// Store locations database and GPS matching service
import { Store } from '@/constants/theme';

export interface StoreLocation {
  id: string;
  storeName: string; // e.g., "HOME DEPOT 0808" or "LOWES 1234"
  storeNumber: string; // e.g., "0808", "1234"
  storeType: Store; // "Lowes" | "Home Depot"
  address: string;
  city: string;
  state: string;
  zipCode: string;
  coordinates: {
    latitude: number;
    longitude: number;
  };
}

// Store locations database - RainSoft survey coverage area
export const STORE_LOCATIONS: StoreLocation[] = [
  // ==================== LOWES STORES ====================
  
  // Alabama
  {
    id: 'lowes-0281',
    storeName: 'LOWES 0281',
    storeNumber: '0281',
    storeType: 'Lowes',
    address: '1301 Boll Weevil Cir',
    city: 'Enterprise',
    state: 'AL',
    zipCode: '',
    coordinates: {
      latitude: 31.3323,
      longitude: -85.8608,
    },
  },
  
  // Florida - Panhandle Region
  {
    id: 'lowes-1782',
    storeName: 'LOWES 1782',
    storeNumber: '1782',
    storeType: 'Lowes',
    address: '298 Rasberry Rd',
    city: 'Crestview',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.7275,
      longitude: -86.5744,
    },
  },
  {
    id: 'lowes-2886',
    storeName: 'LOWES 2886',
    storeNumber: '2886',
    storeType: 'Lowes',
    address: '135 Business Park Rd',
    city: 'DeFuniak Springs',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.6200,
      longitude: -86.1470,
    },
  },
  {
    id: 'lowes-0448',
    storeName: 'LOWES 0448',
    storeNumber: '0448',
    storeType: 'Lowes',
    address: '300 E 23rd St',
    city: 'Panama City',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.1879,
      longitude: -85.6553,
    },
  },
  {
    id: 'lowes-2367',
    storeName: 'LOWES 2367',
    storeNumber: '2367',
    storeType: 'Lowes',
    address: '11751 Panama City Beach Pkwy',
    city: 'Panama City Beach',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.1983,
      longitude: -85.8203,
    },
  },
  {
    id: 'lowes-3166',
    storeName: 'LOWES 3166',
    storeNumber: '3166',
    storeType: 'Lowes',
    address: '4405 Legendary Dr',
    city: 'Destin',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.3918,
      longitude: -86.4199,
    },
  },
  
  // Pensacola Metro Area
  {
    id: 'lowes-0438',
    storeName: 'LOWES 0438',
    storeNumber: '0438',
    storeType: 'Lowes',
    address: '1201 Airport Blvd',
    city: 'Pensacola',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.48,
      longitude: -87.21,
    },
  },
  {
    id: 'lowes-2788',
    storeName: 'LOWES 2788',
    storeNumber: '2788',
    storeType: 'Lowes',
    address: '777 W Nine Mile Rd',
    city: 'Pensacola',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.531,
      longitude: -87.285,
    },
  },
  {
    id: 'lowes-1142',
    storeName: 'LOWES 1142',
    storeNumber: '1142',
    storeType: 'Lowes',
    address: '4301 W Fairfield Dr',
    city: 'Pensacola',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.4345,
      longitude: -87.2791,
    },
  },
  
  // ==================== HOME DEPOT STORES ====================
  
  // Alabama
  {
    id: 'hd-0808',
    storeName: 'HOME DEPOT 0808',
    storeNumber: '0808',
    storeType: 'Home Depot',
    address: '3489 Ross Clark Cir',
    city: 'Dothan',
    state: 'AL',
    zipCode: '',
    coordinates: {
      latitude: 31.2474,
      longitude: -85.4292,
    },
  },
  
  // Florida - Panhandle Region
  {
    id: 'hd-6303',
    storeName: 'HOME DEPOT 6303',
    storeNumber: '6303',
    storeType: 'Home Depot',
    address: '409 E 23rd St',
    city: 'Panama City',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.1913,
      longitude: -85.6543,
    },
  },
  {
    id: 'hd-8446',
    storeName: 'HOME DEPOT 8446',
    storeNumber: '8446',
    storeType: 'Home Depot',
    address: '11500 Panama City Beach Pkwy',
    city: 'Panama City Beach',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.1985,
      longitude: -85.8125,
    },
  },
  {
    id: 'hd-6377',
    storeName: 'HOME DEPOT 6377',
    storeNumber: '6377',
    storeType: 'Home Depot',
    address: '4385 Commons Dr W',
    city: 'Destin',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.3889,
      longitude: -86.4410,
    },
  },
  {
    id: 'hd-6301',
    storeName: 'HOME DEPOT 6301',
    storeNumber: '6301',
    storeType: 'Home Depot',
    address: '414B Mary Esther Blvd NW',
    city: 'Fort Walton Beach',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.4236,
      longitude: -86.6422,
    },
  },
  
  // Pensacola Metro Area
  {
    id: 'hd-8472',
    storeName: 'HOME DEPOT 8472',
    storeNumber: '8472',
    storeType: 'Home Depot',
    address: '541 W Nine Mile Rd',
    city: 'Pensacola',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.5300,
      longitude: -87.2850,
    },
  },
  {
    id: 'hd-6853',
    storeName: 'HOME DEPOT 6853',
    storeNumber: '6853',
    storeType: 'Home Depot',
    address: '5309 N Davis Hwy',
    city: 'Pensacola',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.4753,
      longitude: -87.2280,
    },
  },
  {
    id: 'hd-6932',
    storeName: 'HOME DEPOT 6932',
    storeNumber: '6932',
    storeType: 'Home Depot',
    address: '4525 Mobile Hwy',
    city: 'Pensacola',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.4345,
      longitude: -87.2791,
    },
  },
  {
    id: 'hd-6368',
    storeName: 'HOME DEPOT 6368',
    storeNumber: '6368',
    storeType: 'Home Depot',
    address: '4829 US-90',
    city: 'Pace',
    state: 'FL',
    zipCode: '',
    coordinates: {
      latitude: 30.6015,
      longitude: -87.1226,
    },
  },
];

/**
 * Calculate distance between two GPS coordinates using Haversine formula
 * Returns distance in meters
 */
export function calculateDistance(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371000; // Earth's radius in meters
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;

  const a =
    Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
}

/**
 * Find nearest store location based on GPS coordinates
 * Returns null if no store is within 500 meters
 */
export function findNearestStore(
  latitude: number,
  longitude: number,
  maxDistanceMeters: number = 500
): StoreLocation | null {
  let nearestStore: StoreLocation | null = null;
  let minDistance = Infinity;

  for (const store of STORE_LOCATIONS) {
    const distance = calculateDistance(
      latitude,
      longitude,
      store.coordinates.latitude,
      store.coordinates.longitude
    );

    if (distance < minDistance && distance <= maxDistanceMeters) {
      minDistance = distance;
      nearestStore = store;
    }
  }

  if (nearestStore) {
    console.log(`📍 Matched store: ${nearestStore.storeName} (${Math.round(minDistance)}m away)`);
  } else {
    console.log(`⚠️ No store found within ${maxDistanceMeters}m`);
  }

  return nearestStore;
}

/**
 * Get store location by store name
 */
export function getStoreByName(storeName: string): StoreLocation | undefined {
  return STORE_LOCATIONS.find(s => s.storeName === storeName);
}

/**
 * Get all stores of a specific type
 */
export function getStoresByType(storeType: Store): StoreLocation[] {
  return STORE_LOCATIONS.filter(s => s.storeType === storeType);
}

/**
 * Get store location by ID
 */
export function getStoreById(id: string): StoreLocation | undefined {
  return STORE_LOCATIONS.find(s => s.id === id);
}

/**
 * Format store name for display
 */
export function formatStoreName(storeName: string): string {
  return storeName.toUpperCase();
}

/**
 * Get store type from store name
 */
export function getStoreType(storeName: string): Store | null {
  const store = STORE_LOCATIONS.find(s => s.storeName === storeName);
  return store ? store.storeType : null;
}

/**
 * Validate if a location is within acceptable range of any store
 */
export function isValidStoreLocation(
  latitude: number,
  longitude: number,
  maxDistanceMeters: number = 500
): boolean {
  return findNearestStore(latitude, longitude, maxDistanceMeters) !== null;
}
