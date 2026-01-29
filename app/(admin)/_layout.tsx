// Admin Layout - Stack Navigation for all admin screens
import React from 'react';
import { Stack } from 'expo-router';

/**
 * AdminLayout Component
 * Provides navigation structure for all admin screens
 */
export default function AdminLayout() {
  const screenOptions = {
    headerShown: false,
  };

  return (
    <Stack screenOptions={screenOptions}>
      <Stack.Screen name="index" />
      <Stack.Screen name="employees" />
      <Stack.Screen name="surveys" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="messages" />
      <Stack.Screen name="live-dashboard" />
      <Stack.Screen name="settings" />
      <Stack.Screen name="sync-dashboard" />
      <Stack.Screen name="duplicates" />
      <Stack.Screen name="onboarding-manager" />
      <Stack.Screen name="onboarding-test" />
      <Stack.Screen name="field-mapping" />
      <Stack.Screen name="alerts" />
      <Stack.Screen name="notifications" />
    </Stack>
  );
}
