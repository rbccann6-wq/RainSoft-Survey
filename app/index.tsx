// App entry point - Auto-redirect based on login status
import { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { Redirect } from 'expo-router';
import { useApp } from '@/hooks/useApp';
import { LOWES_THEME } from '@/constants/theme';

export default function Index() {
  const { currentUser } = useApp();
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Wait for app context to initialize (reduced for web performance)
    const timeout = setTimeout(() => {
      setIsReady(true);
    }, 200);

    return () => clearTimeout(timeout);
  }, []);

  // Show loading while context initializes
  if (!isReady) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={LOWES_THEME.primary} />
      </View>
    );
  }

  // Redirect based on auth state
  if (currentUser) {
    if (currentUser.role === 'admin' || currentUser.role === 'manager') {
      return <Redirect href="/(admin)" />;
    }
    return <Redirect href="/kiosk" />;
  }

  return <Redirect href="/login" />;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
  },
});
