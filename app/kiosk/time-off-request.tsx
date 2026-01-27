// Time off request form
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { DatePicker } from '@/components/ui/DatePicker';
import * as StorageService from '@/services/storageService';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { TimeOffRequest } from '@/types';

export default function TimeOffRequestScreen() {
  const router = useRouter();
  const { currentUser, loadData } = useApp();
  const { showAlert } = useAlert();

  const handleStartDateChange = (date: Date | null) => {
    setStartDate(date);
    // Reset end date if it's before start date
    if (date && endDate && date > endDate) {
      setEndDate(null);
    }
  };

  const handleEndDateChange = (date: Date | null) => {
    setEndDate(date);
  };
  
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [reason, setReason] = useState('');

  const handleSubmit = async () => {
    if (!startDate || !endDate || !reason) {
      showAlert('Required Fields', 'Please fill in all fields');
      return;
    }

    const request: TimeOffRequest = {
      id: Date.now().toString(),
      employeeId: currentUser!.id,
      startDate: startDate ? startDate.toISOString().split('T')[0] : '',
      endDate: endDate ? endDate.toISOString().split('T')[0] : '',
      reason,
      status: 'pending',
      requestedAt: new Date().toISOString(),
    };

    await StorageService.addTimeOffRequest(request);
    await loadData();

    showAlert('Request Submitted', 'Your time off request has been submitted for approval', [
      {
        text: 'OK',
        onPress: () => router.back(),
      },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Request Time Off</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <DatePicker
          label="Start Date"
          value={startDate}
          onChange={handleStartDateChange}
          mode="date"
          minimumDate={new Date()}
          placeholder="Select Start Date"
          primaryColor={LOWES_THEME.primary}
          textColor={LOWES_THEME.text}
        />

        <DatePicker
          label="End Date"
          value={endDate}
          onChange={handleEndDateChange}
          mode="date"
          minimumDate={startDate || new Date()}
          placeholder="Select End Date"
          primaryColor={LOWES_THEME.primary}
          textColor={LOWES_THEME.text}
        />

        <Input
          label="Reason"
          value={reason}
          onChangeText={setReason}
          placeholder="Vacation, sick, personal, etc."
          multiline
          numberOfLines={4}
          borderColor={LOWES_THEME.primary}
        />

        <Button
          title="Submit Request"
          onPress={handleSubmit}
          backgroundColor={LOWES_THEME.primary}
          size="large"
          fullWidth
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LOWES_THEME.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },

});
