// Employee alerts inbox - View and manage alerts from managers
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { Alert } from '@/types';
import * as StorageService from '@/services/storageService';
import { formatDateTime12Hour } from '@/utils/timeFormat';

export default function EmployeeAlertsScreen() {
  const router = useRouter();
  const { currentUser } = useApp();
  
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [activeAlerts, setActiveAlerts] = useState<Alert[]>([]);
  const [dismissedAlerts, setDismissedAlerts] = useState<Alert[]>([]);

  useEffect(() => {
    loadAlerts();
  }, []);

  const loadAlerts = async () => {
    const allAlerts = await StorageService.getData<Alert[]>('alerts') || [];
    
    // Filter alerts relevant to current user
    const myAlerts = allAlerts.filter(alert => 
      alert.isGroupAlert || alert.recipientIds.includes(currentUser!.id)
    );

    // Sort by timestamp (newest first)
    const sorted = myAlerts.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    );

    // Separate active and dismissed
    const now = new Date();
    const active = sorted.filter(alert => {
      const isExpired = alert.expiresAt && new Date(alert.expiresAt) < now;
      const isDismissed = alert.dismissedBy.includes(currentUser!.id);
      return !isExpired && !isDismissed;
    });

    const dismissed = sorted.filter(alert => {
      const isDismissed = alert.dismissedBy.includes(currentUser!.id);
      const isExpired = alert.expiresAt && new Date(alert.expiresAt) < now;
      return isDismissed || isExpired;
    });

    setAlerts(sorted);
    setActiveAlerts(active);
    setDismissedAlerts(dismissed);
  };

  const handleMarkAsRead = async (alertId: string) => {
    const allAlerts = await StorageService.getData<Alert[]>('alerts') || [];
    const alertIndex = allAlerts.findIndex(a => a.id === alertId);
    
    if (alertIndex !== -1 && !allAlerts[alertIndex].readBy.includes(currentUser!.id)) {
      allAlerts[alertIndex].readBy.push(currentUser!.id);
      await StorageService.saveData('alerts', allAlerts);
      await loadAlerts();
    }
  };

  const handleDismiss = async (alertId: string) => {
    const allAlerts = await StorageService.getData<Alert[]>('alerts') || [];
    const alertIndex = allAlerts.findIndex(a => a.id === alertId);
    
    if (alertIndex !== -1 && !allAlerts[alertIndex].dismissedBy.includes(currentUser!.id)) {
      allAlerts[alertIndex].dismissedBy.push(currentUser!.id);
      await StorageService.saveData('alerts', allAlerts);
      await loadAlerts();
    }
  };

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case 'urgent': return '#D32F2F';
      case 'high': return '#F44336';
      case 'medium': return '#FF9800';
      case 'low': return '#2196F3';
      default: return LOWES_THEME.textSubtle;
    }
  };

  const getPriorityIcon = (priority: string) => {
    switch (priority) {
      case 'urgent': return 'priority-high';
      case 'high': return 'error';
      case 'medium': return 'warning';
      case 'low': return 'info';
      default: return 'notifications';
    }
  };

  const renderAlert = (alert: Alert, isDismissed: boolean = false) => {
    const isUnread = !alert.readBy.includes(currentUser!.id);
    
    return (
      <Pressable
        key={alert.id}
        style={[
          styles.alertCard,
          isUnread && !isDismissed && styles.alertUnread,
          isDismissed && styles.alertDismissed,
        ]}
        onPress={() => handleMarkAsRead(alert.id)}
      >
        <View style={styles.alertHeader}>
          <View style={[
            styles.priorityIcon,
            { backgroundColor: getPriorityColor(alert.priority) },
          ]}>
            <MaterialIcons 
              name={getPriorityIcon(alert.priority) as any} 
              size={24} 
              color="#FFFFFF" 
            />
          </View>

          <View style={styles.alertHeaderText}>
            <Text style={styles.alertTitle}>{alert.title}</Text>
            <Text style={styles.alertSender}>From: {alert.senderName}</Text>
          </View>

          {isUnread && !isDismissed && (
            <View style={styles.unreadBadge}>
              <View style={styles.unreadDot} />
            </View>
          )}
        </View>

        <Text style={styles.alertMessage}>{alert.message}</Text>

        <View style={styles.alertFooter}>
          <View style={styles.alertMeta}>
            <MaterialIcons name="schedule" size={14} color={LOWES_THEME.textSubtle} />
            <Text style={styles.metaText}>
              {formatDateTime12Hour(alert.timestamp)}
            </Text>
          </View>

          {!isDismissed && (
            <Pressable
              style={styles.dismissButton}
              onPress={(e) => {
                e.stopPropagation();
                handleDismiss(alert.id);
              }}
            >
              <MaterialIcons name="check" size={16} color={LOWES_THEME.success} />
              <Text style={styles.dismissButtonText}>Dismiss</Text>
            </Pressable>
          )}
        </View>
      </Pressable>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Alerts</Text>
        <View style={styles.badge}>
          <Text style={styles.badgeText}>{activeAlerts.length}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Active Alerts */}
        {activeAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Active Alerts</Text>
            <View style={styles.alertsList}>
              {activeAlerts.map(alert => renderAlert(alert, false))}
            </View>
          </View>
        )}

        {/* Dismissed/Expired Alerts */}
        {dismissedAlerts.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Dismissed & Expired</Text>
            <View style={styles.alertsList}>
              {dismissedAlerts.map(alert => renderAlert(alert, true))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {alerts.length === 0 && (
          <View style={styles.emptyState}>
            <MaterialIcons name="notifications-none" size={64} color={LOWES_THEME.textSubtle} />
            <Text style={styles.emptyText}>No alerts yet</Text>
            <Text style={styles.emptySubtext}>
              You'll be notified when managers send important updates
            </Text>
          </View>
        )}
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
    backgroundColor: '#FFFFFF',
  },
  backButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    flex: 1,
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  badge: {
    backgroundColor: LOWES_THEME.error,
    borderRadius: 12,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    minWidth: 24,
    alignItems: 'center',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  section: {
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  alertsList: {
    gap: SPACING.md,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  alertUnread: {
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.primary,
    backgroundColor: '#F0F7FF',
  },
  alertDismissed: {
    opacity: 0.6,
  },
  alertHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  priorityIcon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  alertHeaderText: {
    flex: 1,
    gap: 4,
  },
  alertTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  alertSender: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  unreadBadge: {
    padding: SPACING.xs,
  },
  unreadDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LOWES_THEME.primary,
  },
  alertMessage: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  alertFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
  },
  alertMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  metaText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  dismissButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 6,
    backgroundColor: '#E8F5E9',
  },
  dismissButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.success,
  },
  emptyState: {
    paddingVertical: SPACING.xxl * 2,
    alignItems: 'center',
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    textAlign: 'center',
    maxWidth: 250,
  },
});
