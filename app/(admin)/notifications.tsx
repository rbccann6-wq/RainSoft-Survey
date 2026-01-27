// Admin notifications history - View all sent alerts and push notifications
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { Alert, PushNotification } from '@/types';
import * as StorageService from '@/services/storageService';
import { formatDateTime12Hour } from '@/utils/timeFormat';

type TabType = 'alerts' | 'notifications';

export default function NotificationsHistoryScreen() {
  const router = useRouter();
  const { employees } = useApp();
  
  const [activeTab, setActiveTab] = useState<TabType>('alerts');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [pushNotifications, setPushNotifications] = useState<PushNotification[]>([]);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const alertsData = await StorageService.getData<Alert[]>('alerts') || [];
    const notificationsData = await StorageService.getData<PushNotification[]>('push_notifications') || [];
    
    setAlerts(alertsData.sort((a, b) => 
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    ));
    
    setPushNotifications(notificationsData.sort((a, b) =>
      new Date(b.sentAt).getTime() - new Date(a.sentAt).getTime()
    ));
  };

  const getRecipientNames = (recipientIds: string[]) => {
    if (recipientIds.length === 0) return 'All Employees';
    
    const names = recipientIds.map(id => {
      const emp = employees.find(e => e.id === id);
      return emp ? `${emp.firstName} ${emp.lastName}` : 'Unknown';
    });
    
    if (names.length > 3) {
      return `${names.slice(0, 3).join(', ')} +${names.length - 3} more`;
    }
    
    return names.join(', ');
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

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'message': return 'message';
      case 'schedule': return 'event';
      case 'alert': return 'notification-important';
      case 'system': return 'info';
      default: return 'notifications';
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Notification History</Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <Pressable
          style={[styles.tab, activeTab === 'alerts' && styles.tabActive]}
          onPress={() => setActiveTab('alerts')}
        >
          <MaterialIcons 
            name="campaign" 
            size={20} 
            color={activeTab === 'alerts' ? LOWES_THEME.primary : LOWES_THEME.textSubtle} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'alerts' && styles.tabTextActive,
          ]}>
            Alerts ({alerts.length})
          </Text>
        </Pressable>

        <Pressable
          style={[styles.tab, activeTab === 'notifications' && styles.tabActive]}
          onPress={() => setActiveTab('notifications')}
        >
          <MaterialIcons 
            name="notifications" 
            size={20} 
            color={activeTab === 'notifications' ? LOWES_THEME.primary : LOWES_THEME.textSubtle} 
          />
          <Text style={[
            styles.tabText,
            activeTab === 'notifications' && styles.tabTextActive,
          ]}>
            Push Notifications ({pushNotifications.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'alerts' ? (
          // Alerts Tab
          alerts.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="campaign" size={64} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyText}>No alerts sent yet</Text>
              <Pressable
                style={styles.sendAlertButton}
                onPress={() => router.push('/(admin)/alerts')}
              >
                <MaterialIcons name="add" size={20} color="#FFFFFF" />
                <Text style={styles.sendAlertButtonText}>Send First Alert</Text>
              </Pressable>
            </View>
          ) : (
            <View style={styles.list}>
              {alerts.map((alert) => {
                const isExpired = alert.expiresAt && new Date(alert.expiresAt) < new Date();
                
                return (
                  <View 
                    key={alert.id} 
                    style={[
                      styles.alertCard,
                      isExpired && styles.alertExpired,
                    ]}
                  >
                    <View style={styles.alertHeader}>
                      <View style={styles.alertTitleRow}>
                        <View style={[
                          styles.priorityBadge,
                          { backgroundColor: getPriorityColor(alert.priority) },
                        ]}>
                          <Text style={styles.priorityText}>
                            {alert.priority.toUpperCase()}
                          </Text>
                        </View>
                        <Text style={styles.alertTitle}>{alert.title}</Text>
                      </View>
                      {isExpired && (
                        <View style={styles.expiredBadge}>
                          <Text style={styles.expiredText}>EXPIRED</Text>
                        </View>
                      )}
                    </View>

                    <Text style={styles.alertMessage}>{alert.message}</Text>

                    <View style={styles.alertMeta}>
                      <View style={styles.metaRow}>
                        <MaterialIcons name="person" size={16} color={LOWES_THEME.textSubtle} />
                        <Text style={styles.metaText}>
                          From: {alert.senderName}
                        </Text>
                      </View>

                      <View style={styles.metaRow}>
                        <MaterialIcons name="group" size={16} color={LOWES_THEME.textSubtle} />
                        <Text style={styles.metaText}>
                          To: {getRecipientNames(alert.recipientIds)}
                        </Text>
                      </View>

                      <View style={styles.metaRow}>
                        <MaterialIcons name="schedule" size={16} color={LOWES_THEME.textSubtle} />
                        <Text style={styles.metaText}>
                          {formatDateTime12Hour(alert.timestamp)}
                        </Text>
                      </View>

                      <View style={styles.metaRow}>
                        <MaterialIcons name="visibility" size={16} color={LOWES_THEME.textSubtle} />
                        <Text style={styles.metaText}>
                          Read by {alert.readBy.length} • Dismissed by {alert.dismissedBy.length}
                        </Text>
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>
          )
        ) : (
          // Push Notifications Tab
          pushNotifications.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="notifications-none" size={64} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyText}>No push notifications sent yet</Text>
            </View>
          ) : (
            <View style={styles.list}>
              {pushNotifications.map((notification) => (
                <View key={notification.id} style={styles.notificationCard}>
                  <View style={styles.notificationHeader}>
                    <View style={[
                      styles.typeBadge,
                      { backgroundColor: 
                        notification.type === 'alert' ? '#F44336' :
                        notification.type === 'message' ? '#2196F3' :
                        notification.type === 'schedule' ? '#4CAF50' :
                        '#9E9E9E'
                      },
                    ]}>
                      <MaterialIcons 
                        name={getTypeIcon(notification.type) as any} 
                        size={16} 
                        color="#FFFFFF" 
                      />
                      <Text style={styles.typeText}>
                        {notification.type.toUpperCase()}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.notificationTitle}>{notification.title}</Text>
                  <Text style={styles.notificationBody}>{notification.body}</Text>

                  <View style={styles.notificationMeta}>
                    <View style={styles.metaRow}>
                      <MaterialIcons name="group" size={16} color={LOWES_THEME.textSubtle} />
                      <Text style={styles.metaText}>
                        Sent to {notification.sentTo.length} employee(s)
                      </Text>
                    </View>

                    <View style={styles.metaRow}>
                      <MaterialIcons name="schedule" size={16} color={LOWES_THEME.textSubtle} />
                      <Text style={styles.metaText}>
                        {formatDateTime12Hour(notification.sentAt)}
                      </Text>
                    </View>
                  </View>
                </View>
              ))}
            </View>
          )
        )}
      </ScrollView>

      {/* FAB - Send New Alert */}
      <Pressable
        style={styles.fab}
        onPress={() => router.push('/(admin)/alerts')}
      >
        <MaterialIcons name="add" size={28} color="#FFFFFF" />
      </Pressable>
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
    justifyContent: 'space-between',
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
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
  },
  tabActive: {
    borderBottomColor: LOWES_THEME.primary,
  },
  tabText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
  },
  tabTextActive: {
    color: LOWES_THEME.primary,
  },
  content: {
    padding: SPACING.lg,
  },
  emptyState: {
    paddingVertical: SPACING.xxl * 2,
    alignItems: 'center',
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    color: LOWES_THEME.textSubtle,
  },
  sendAlertButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: LOWES_THEME.primary,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 24,
    marginTop: SPACING.md,
  },
  sendAlertButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  list: {
    gap: SPACING.md,
  },
  alertCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.lg,
    gap: SPACING.md,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.primary,
  },
  alertExpired: {
    opacity: 0.6,
    borderLeftColor: LOWES_THEME.textSubtle,
  },
  alertHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  alertTitleRow: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  priorityBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  priorityText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  alertTitle: {
    flex: 1,
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  expiredBadge: {
    backgroundColor: '#9E9E9E',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  expiredText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  alertMessage: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  alertMeta: {
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  metaText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  notificationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  notificationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  typeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 4,
  },
  typeText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  notificationTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  notificationBody: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 18,
  },
  notificationMeta: {
    gap: SPACING.xs,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
  },
  fab: {
    position: 'absolute',
    right: SPACING.lg,
    bottom: SPACING.lg,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: LOWES_THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
});
