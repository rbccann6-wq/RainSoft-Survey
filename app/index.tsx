// App entry point - Auto-redirect based on login status
import { useEffect } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '@/hooks/useApp';
import { LOWES_THEME } from '@/constants/theme';

export default function Index() {
  const router = useRouter();
  const { currentUser } = useApp();

  useEffect(() => {
    // Small delay to allow context to initialize
    const timeout = setTimeout(() => {
      if (currentUser) {
        if (currentUser.role === 'admin' || currentUser.role === 'manager') {
          router.replace('/(admin)');
        } else {
          router.replace('/kiosk');
        }
      } else {
        router.replace('/login');
      }
    }, 500);

    return () => clearTimeout(timeout);
  }, [currentUser]);

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={LOWES_THEME.primary} />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
