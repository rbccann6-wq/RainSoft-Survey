// Admin activity monitor - Track inactive clocked-in employees
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import * as ActivityService from '@/services/activityService';

export default function ActivityMonitorScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  const { showAlert } = useAlert();
  const [inactiveUsers, setInactiveUsers] = useState<ActivityService.InactiveUser[]>([]);
  const [inactivityLogs, setInactivityLogs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedThreshold, setSelectedThreshold] = useState(5); // Default 5 minutes

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, [selectedThreshold]);

  const loadData = async () => {
    try {
      setLoading(true);
      const [inactive, logs] = await Promise.all([
        ActivityService.checkInactiveUsers(selectedThreshold),
        ActivityService.getInactivityLogs(20),
      ]);
      setInactiveUsers(inactive);
      setInactivityLogs(logs);
    } catch (error) {
      console.error('Error loading activity data:', error);
      showAlert('Error', 'Failed to load activity monitor data');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const handleRefresh = () => {
    setRefreshing(true);
    loadData();
  };

  const handleForceClockOut = (user: ActivityService.InactiveUser) => {
    showAlert(
      'Force Clock Out',
      `Force clock out ${user.employeeName}? They have been inactive for ${user.inactiveDurationMinutes} minutes.`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clock Out',
          style: 'destructive',
          onPress: async () => {
            const success = await ActivityService.forceClockOut(
              user.timeEntryId,
              currentUser!.id,
              `Inactive for ${user.inactiveDurationMinutes} minutes - forced clock out by admin`
            );

            if (success) {
              showAlert('Success', `${user.employeeName} has been clocked out`);
              loadData();
            } else {
              showAlert('Error', 'Failed to force clock out');
            }
          },
        },
      ]
    );
  };

  const handleLogInactivity = (user: ActivityService.InactiveUser) => {
    showAlert(
      'Log Inactivity',
      `Log inactivity for ${user.employeeName}?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Log',
          onPress: async () => {
            await ActivityService.logInactivity(
              user.employeeId,
              user.timeEntryId,
              user.lastActivityAt,
              user.inactiveDurationMinutes,
              user.currentPage,
              'notified',
              currentUser!.id,
              'Admin notified employee via other channels'
            );
            showAlert('Success', 'Inactivity logged');
            loadData();
          },
        },
      ]
    );
  };

  const formatDuration = (minutes: number): string => {
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    if (hours > 0) {
      return `${hours}h ${mins}m`;
    }
    return `${mins}m`;
  };

  const formatTimestamp = (timestamp: string): string => {
    const date = new Date(timestamp);
    const now = new Date();
    const diffMs = now.getTime() - date.getTime();
    const diffMins = Math.floor(diffMs / (1000 * 60));

    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins}m ago`;
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours < 24) return `${diffHours}h ago`;
    return date.toLocaleDateString();
  };

  if (currentUser?.role !== 'admin' && currentUser?.role !== 'manager') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.unauthorized}>
          <MaterialIcons name="block" size={64} color="#999" />
          <Text style={styles.unauthorizedText}>Admin Access Required</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Activity Monitor</Text>
        <Pressable onPress={handleRefresh} style={styles.refreshButton}>
          <MaterialIcons name="refresh" size={24} color="#FFFFFF" />
        </Pressable>
      </View>

      <ScrollView
        style={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Threshold Selector */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Inactivity Threshold</Text>
          <View style={styles.thresholdButtons}>
            {[3, 5, 10, 15].map((minutes) => (
              <Pressable
                key={minutes}
                onPress={() => setSelectedThreshold(minutes)}
                style={[
                  styles.thresholdButton,
                  selectedThreshold === minutes && styles.thresholdButtonActive,
                ]}
              >
                <Text
                  style={[
                    styles.thresholdButtonText,
                    selectedThreshold === minutes && styles.thresholdButtonTextActive,
                  ]}
                >
                  {minutes} min
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Inactive Users */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="warning" size={24} color={LOWES_THEME.error} />
            <Text style={styles.sectionTitle}>
              Inactive Users ({inactiveUsers.length})
            </Text>
          </View>

          {loading && !refreshing ? (
            <ActivityIndicator size="large" color={LOWES_THEME.primary} />
          ) : inactiveUsers.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="check-circle" size={48} color={LOWES_THEME.success} />
              <Text style={styles.emptyStateText}>All employees are active!</Text>
            </View>
          ) : (
            <View style={styles.usersList}>
              {inactiveUsers.map((user) => (
                <View key={user.employeeId} style={styles.inactiveUserCard}>
                  <View style={styles.userHeader}>
                    <View style={styles.userInfo}>
                      <Text style={styles.userName}>{user.employeeName}</Text>
                      <Text style={styles.userStore}>
                        {user.store === 'lowes' ? 'Lowes' : 'Home Depot'}
                      </Text>
                    </View>
                    <View style={styles.inactiveBadge}>
                      <MaterialIcons name="alarm-off" size={20} color="#FFFFFF" />
                      <Text style={styles.inactiveDuration}>
                        {formatDuration(user.inactiveDurationMinutes)}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.userDetails}>
                    <View style={styles.detailRow}>
                      <MaterialIcons name="schedule" size={16} color="#666" />
                      <Text style={styles.detailText}>
                        Last activity: {formatTimestamp(user.lastActivityAt)}
                      </Text>
                    </View>
                    {user.currentPage && (
                      <View style={styles.detailRow}>
                        <MaterialIcons name="location-on" size={16} color="#666" />
                        <Text style={styles.detailText}>{user.currentPage}</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.userActions}>
                    <Button
                      title="Log"
                      onPress={() => handleLogInactivity(user)}
                      variant="outline"
                      icon="event-note"
                    />
                    <Button
                      title="Force Clock Out"
                      onPress={() => handleForceClockOut(user)}
                      variant="danger"
                      icon="logout"
                    />
                  </View>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Recent Inactivity Logs */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="history" size={24} color={LOWES_THEME.primary} />
            <Text style={styles.sectionTitle}>Recent Logs</Text>
          </View>

          {inactivityLogs.length === 0 ? (
            <Text style={styles.emptyText}>No logs yet</Text>
          ) : (
            <View style={styles.logsList}>
              {inactivityLogs.map((log) => (
                <View key={log.id} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logEmployeeName}>
                      {log.employees?.first_name} {log.employees?.last_name}
                    </Text>
                    <Text style={styles.logTimestamp}>
                      {formatTimestamp(log.detected_at)}
                    </Text>
                  </View>
                  <View style={styles.logDetails}>
                    <Text style={styles.logText}>
                      Inactive for {formatDuration(log.inactive_duration_minutes)}
                    </Text>
                    <View style={[
                      styles.logAction,
                      {
                        backgroundColor:
                          log.action_taken === 'force_clocked_out'
                            ? '#FFE5E5'
                            : log.action_taken === 'notified'
                            ? '#FFF4E5'
                            : '#E8F5E9',
                      },
                    ]}>
                      <Text
                        style={[
                          styles.logActionText,
                          {
                            color:
                              log.action_taken === 'force_clocked_out'
                                ? LOWES_THEME.error
                                : log.action_taken === 'notified'
                                ? '#FF9800'
                                : LOWES_THEME.success,
                          },
                        ]}
                      >
                        {log.action_taken?.replace('_', ' ').toUpperCase()}
                      </Text>
                    </View>
                  </View>
                  {log.notes && (
                    <Text style={styles.logNotes}>{log.notes}</Text>
                  )}
                  {log.admins && (
                    <Text style={styles.logAdmin}>
                      By: {log.admins.first_name} {log.admins.last_name}
                    </Text>
                  )}
                </View>
              ))}
            </View>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: LOWES_THEME.primary,
  },
  backButton: {
    padding: SPACING.sm,
  },
  refreshButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
  },
  section: {
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: '#333',
  },
  thresholdButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  thresholdButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LOWES_THEME.primary,
    backgroundColor: '#FFFFFF',
  },
  thresholdButtonActive: {
    backgroundColor: LOWES_THEME.primary,
  },
  thresholdButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.primary,
  },
  thresholdButtonTextActive: {
    color: '#FFFFFF',
  },
  emptyState: {
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.md,
  },
  emptyStateText: {
    fontSize: FONTS.sizes.md,
    color: '#666',
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: '#999',
    textAlign: 'center',
    paddingVertical: SPACING.lg,
  },
  usersList: {
    gap: SPACING.md,
  },
  inactiveUserCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.error,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  userHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  userInfo: {
    flex: 1,
  },
  userName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: '#333',
  },
  userStore: {
    fontSize: FONTS.sizes.sm,
    color: '#666',
  },
  inactiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LOWES_THEME.error,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
  },
  inactiveDuration: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  userDetails: {
    gap: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: FONTS.sizes.sm,
    color: '#666',
  },
  userActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  logsList: {
    gap: SPACING.sm,
  },
  logCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logEmployeeName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: '#333',
  },
  logTimestamp: {
    fontSize: FONTS.sizes.xs,
    color: '#999',
  },
  logDetails: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 4,
  },
  logText: {
    fontSize: FONTS.sizes.sm,
    color: '#666',
  },
  logAction: {
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: 4,
  },
  logActionText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  logNotes: {
    fontSize: FONTS.sizes.xs,
    color: '#666',
    fontStyle: 'italic',
    marginTop: 4,
  },
  logAdmin: {
    fontSize: FONTS.sizes.xs,
    color: '#999',
    marginTop: 2,
  },
  unauthorized: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  unauthorizedText: {
    fontSize: FONTS.sizes.lg,
    color: '#999',
  },
});
