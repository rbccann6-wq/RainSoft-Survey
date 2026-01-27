// Employee schedule view
import React from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { formatTime12Hour } from '@/utils/timeFormat';

export default function ScheduleScreen() {
  const router = useRouter();
  const { currentUser, schedules } = useApp();

  const mySchedules = schedules.filter(s => s.employeeId === currentUser?.id);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Schedule</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {mySchedules.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="event-busy" size={64} color={LOWES_THEME.textSubtle} />
            <Text style={styles.emptyText}>No scheduled shifts</Text>
          </View>
        ) : (
          <View style={styles.scheduleList}>
            {mySchedules.map((schedule) => (
              <View key={schedule.id} style={styles.scheduleCard}>
                <View style={styles.scheduleHeader}>
                  <Text style={styles.dateText}>{schedule.date}</Text>
                  <View style={[
                    styles.storeBadge,
                    { backgroundColor: schedule.store === 'lowes' ? LOWES_THEME.primary : '#F96302' },
                  ]}>
                    <Text style={styles.storeText}>
                      {schedule.store === 'lowes' ? 'Lowes' : 'Home Depot'}
                    </Text>
                  </View>
                </View>
                <Text style={styles.timeText}>
                  {formatTime12Hour(schedule.startTime)} - {formatTime12Hour(schedule.endTime)}
                </Text>
              </View>
            ))}
          </View>
        )}

        <Button
          title="Request Time Off"
          onPress={() => router.push('/kiosk/time-off-request')}
          backgroundColor={LOWES_THEME.primary}
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
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    color: LOWES_THEME.textSubtle,
  },
  scheduleList: {
    gap: SPACING.md,
  },
  scheduleCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.sm,
  },
  scheduleHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  dateText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  storeBadge: {
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 12,
  },
  storeText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  timeText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
  },
});
