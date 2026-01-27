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

// Store locations database - Add your actual store locations here
// This is a sample database - replace with your actual store locations
export const STORE_LOCATIONS: StoreLocation[] = [
  // Home Depot Stores
  {
    id: 'hd-0808',
    storeName: 'HOME DEPOT 0808',
    storeNumber: '0808',
    storeType: 'Home Depot',
    address: '1234 Main St',
    city: 'Atlanta',
    state: 'GA',
    zipCode: '30303',
    coordinates: {
      latitude: 33.7490,
      longitude: -84.3880,
    },
  },
  {
    id: 'hd-0809',
    storeName: 'HOME DEPOT 0809',
    storeNumber: '0809',
    storeType: 'Home Depot',
    address: '5678 Oak Ave',
    city: 'Atlanta',
    state: 'GA',
    zipCode: '30305',
    coordinates: {
      latitude: 33.7890,
      longitude: -84.3680,
    },
  },
  // Lowes Stores
  {
    id: 'lowes-1234',
    storeName: 'LOWES 1234',
    storeNumber: '1234',
    storeType: 'Lowes',
    address: '9012 Peachtree Rd',
    city: 'Atlanta',
    state: 'GA',
    zipCode: '30308',
    coordinates: {
      latitude: 33.7690,
      longitude: -84.3780,
    },
  },
  {
    id: 'lowes-1235',
    storeName: 'LOWES 1235',
    storeNumber: '1235',
    storeType: 'Lowes',
    address: '3456 Pine St',
    city: 'Atlanta',
    state: 'GA',
    zipCode: '30310',
    coordinates: {
      latitude: 33.7290,
      longitude: -84.4080,
    },
  },
  // Add more store locations as needed
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
