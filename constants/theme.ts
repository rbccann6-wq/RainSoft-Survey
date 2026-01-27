// Theme configuration for dual-store branding
import { Dimensions } from 'react-native';

// Responsive breakpoints
const { width: screenWidth } = Dimensions.get('window');
export const BREAKPOINTS = {
  phone: 600,
  tablet: 1024,
};

export const isTablet = () => screenWidth >= BREAKPOINTS.phone;
export const isLargeTablet = () => screenWidth >= BREAKPOINTS.tablet;

// Responsive font scaling
export const scaleFont = (size: number) => {
  if (screenWidth >= BREAKPOINTS.tablet) return size * 1.3;
  if (screenWidth >= BREAKPOINTS.phone) return size * 1.15;
  return size;
};

export const SPACING = {
  xs: 4,
  sm: 8,
  md: 16,
  lg: 24,
  xl: 32,
  xxl: 48,
};

export const FONTS = {
  regular: 'System',
  medium: 'System',
  bold: 'System',
  sizes: {
    xs: scaleFont(12),
    sm: scaleFont(14),
    md: scaleFont(16),
    lg: scaleFont(18),
    xl: scaleFont(22),
    xxl: scaleFont(28),
  },
};

export const LOWES_THEME = {
  primary: '#004990',
  primaryDark: '#003366',
  secondary: '#00529B',
  background: '#F5F8FA',
  surface: '#FFFFFF',
  surfaceLight: '#EBF2F7',
  text: '#1A1A1A',
  textSubtle: '#666666',
  border: '#D1DDE6',
  success: '#2E7D32',
  error: '#D32F2F',
  warning: '#F57C00',
  white: '#FFFFFF',
  overlay: 'rgba(0, 73, 144, 0.1)',
};

export const HOMEDEPOT_THEME = {
  primary: '#F96302',
  primaryDark: '#D65002',
  secondary: '#FF8C42',
  background: '#FFF8F0',
  surface: '#FFFFFF',
  surfaceLight: '#FFEDE0',
  text: '#1A1A1A',
  textSubtle: '#666666',
  border: '#FFD4B3',
  success: '#2E7D32',
  error: '#D32F2F',
  warning: '#F57C00',
  white: '#FFFFFF',
  overlay: 'rgba(249, 99, 2, 0.1)',
};

export const COMMON = {
  borderRadius: {
    sm: 8,
    md: 12,
    lg: 16,
    xl: 24,
  },
  shadow: {
    sm: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 2 },
      shadowOpacity: 0.1,
      shadowRadius: 4,
      elevation: 2,
    },
    md: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.15,
      shadowRadius: 8,
      elevation: 4,
    },
    lg: {
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.2,
      shadowRadius: 16,
      elevation: 8,
    },
  },
};

export type Store = 'lowes' | 'homedepot';
export type Theme = typeof LOWES_THEME;

export const getTheme = (store: Store): Theme => {
  return store === 'lowes' ? LOWES_THEME : HOMEDEPOT_THEME;
};
