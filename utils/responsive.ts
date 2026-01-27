// Responsive utilities for web/mobile detection
import React from 'react';
import { Dimensions, Platform } from 'react-native';

export const getDeviceType = () => {
  const { width } = Dimensions.get('window');
  
  if (width >= 1024) return 'desktop';
  if (width >= 768) return 'tablet';
  return 'mobile';
};

export const isWeb = Platform.OS === 'web';
export const isMobile = Platform.OS === 'ios' || Platform.OS === 'android';

export const getResponsiveColumns = (width: number) => {
  if (width >= 1440) return 4; // Large desktop
  if (width >= 1024) return 3; // Desktop
  if (width >= 768) return 2;  // Tablet
  return 1; // Mobile
};

export const getResponsiveSpacing = (width: number) => {
  if (width >= 1024) return 32; // Desktop
  if (width >= 768) return 24;  // Tablet
  return 16; // Mobile
};

export const getResponsiveFontScale = (width: number) => {
  if (width >= 1024) return 1.1; // Larger text on desktop
  return 1;
};

// Hook to get current device dimensions and type
export const useResponsive = () => {
  const [dimensions, setDimensions] = React.useState(Dimensions.get('window'));
  
  React.useEffect(() => {
    const subscription = Dimensions.addEventListener('change', ({ window }) => {
      setDimensions(window);
    });
    
    return () => subscription?.remove();
  }, []);
  
  return {
    width: dimensions.width,
    height: dimensions.height,
    deviceType: getDeviceType(),
    isWeb,
    isMobile,
    columns: getResponsiveColumns(dimensions.width),
    spacing: getResponsiveSpacing(dimensions.width),
  };
};


