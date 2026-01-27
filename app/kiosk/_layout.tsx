// Kiosk section layout
import { Stack } from 'expo-router';

export default function KioskLayout() {
  return (
    <Stack screenOptions={{ headerShown: false }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="survey" />
      <Stack.Screen name="training" />
      <Stack.Screen name="schedule" />
      <Stack.Screen name="messages" />
    </Stack>
  );
}
