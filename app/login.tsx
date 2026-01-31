// Login screen
import React, { useState } from 'react';
import { View, Text, StyleSheet, Image, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import * as StorageService from '@/services/storageService';

export default function LoginScreen() {
  const router = useRouter();
  const { login } = useApp();
  const { showAlert } = useAlert();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim()) {
      showAlert('Error', 'Please enter your email');
      return;
    }

    setLoading(true);
    
    try {
      const success = await login(email.trim());

      if (success) {
        router.replace('/');
      } else {
        showAlert(
          'Login Failed', 
          `Could not find an active employee with email:\n${email}\n\nPlease check:\n• Email spelling is correct\n• Account has been activated by admin\n\nDemo accounts:\nadmin@rainsoft.com\nsurveyor@rainsoft.com`
        );
      }
    } catch (error) {
      console.error('Login error:', error);
      showAlert('Error', `Login failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView 
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        style={styles.content}
      >
        <View style={styles.header}>
          <Text style={styles.title}>RainSoft Survey Kiosk</Text>
          <Text style={styles.subtitle}>Employee Login</Text>
        </View>

        <View style={styles.form}>
          <Input
            label="Email Address"
            value={email}
            onChangeText={setEmail}
            placeholder="your.email@rainsoft.com"
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            borderColor={LOWES_THEME.primary}
          />

          <Button
            title="Sign In"
            onPress={handleLogin}
            loading={loading}
            backgroundColor={LOWES_THEME.primary}
            size="large"
            fullWidth
          />

          {/* Demo accounts removed - using real accounts only */}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LOWES_THEME.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: SPACING.lg,
    justifyContent: 'center',
  },
  header: {
    alignItems: 'center',
    marginBottom: SPACING.xxl,
  },
  title: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: LOWES_THEME.primary,
    marginBottom: SPACING.sm,
  },
  subtitle: {
    fontSize: FONTS.sizes.lg,
    color: LOWES_THEME.textSubtle,
  },
  form: {
    gap: SPACING.lg,
  },
  demoInfo: {
    marginTop: SPACING.lg,
    padding: SPACING.md,
    backgroundColor: LOWES_THEME.surfaceLight,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  demoTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
    marginBottom: SPACING.xs,
  },
  demoText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
});
