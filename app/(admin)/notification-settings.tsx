// Admin notification settings - Control push & SMS notifications
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Switch, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import * as StorageService from '@/services/storageService';

interface NotificationSettings {
  // Push Notification Settings
  pushEnabled: boolean;
  messages: {
    enabled: boolean;
    groupMessages: boolean;
    directMessages: boolean;
  };
  alerts: {
    enabled: boolean;
    lowPriority: boolean;
    mediumPriority: boolean;
    highPriority: boolean;
    urgentPriority: boolean;
  };
  clockEvents: {
    enabled: boolean;
    clockIn: boolean;
    clockOut: boolean;
    breakStart: boolean;
    breakReturn: boolean;
    showStats: boolean; // Show detailed stats in notifications
  };
  scheduleChanges: {
    enabled: boolean;
    created: boolean;
    updated: boolean;
    deleted: boolean;
  };
  
  // SMS Notification Settings
  smsEnabled: boolean;
  smsPhoneNumber: string;
  smsEvents: {
    clockIn: boolean;
    clockOut: boolean;
    lowQuota: boolean; // Alert when employee is below quota
    alerts: boolean; // Get SMS for urgent alerts
    timeOffRequests: boolean;
    lateEmployees: boolean; // Employee late for shift
    inactiveEmployees: boolean; // Employee inactive for 30+ min
  };
}

const defaultSettings: NotificationSettings = {
  pushEnabled: true,
  messages: {
    enabled: true,
    groupMessages: true,
    directMessages: true,
  },
  alerts: {
    enabled: true,
    lowPriority: false,
    mediumPriority: true,
    highPriority: true,
    urgentPriority: true,
  },
  clockEvents: {
    enabled: true,
    clockIn: true,
    clockOut: true,
    breakStart: false,
    breakReturn: false,
    showStats: true,
  },
  scheduleChanges: {
    enabled: true,
    created: true,
    updated: true,
    deleted: true,
  },
  smsEnabled: false,
  smsPhoneNumber: '',
  smsEvents: {
    clockIn: false,
    clockOut: true,
    lowQuota: true,
    alerts: true,
    timeOffRequests: true,
    lateEmployees: true,
    inactiveEmployees: true,
  },
};

export default function NotificationSettingsScreen() {
  const { currentUser } = useApp();
  const { showAlert } = useAlert();
  const [settings, setSettings] = useState<NotificationSettings>(defaultSettings);
  const [phoneNumber, setPhoneNumber] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const saved = await StorageService.getData<NotificationSettings>(`notification_settings_${currentUser?.id}`);
    if (saved) {
      setSettings(saved);
      setPhoneNumber(saved.smsPhoneNumber || '');
    }
  };

  const saveSettings = async () => {
    const finalSettings = {
      ...settings,
      smsPhoneNumber: phoneNumber,
    };
    await StorageService.saveData(`notification_settings_${currentUser?.id}`, finalSettings);
    showAlert('Settings Saved', 'Your notification preferences have been updated');
  };

  const updateSetting = (path: string[], value: boolean | string) => {
    setSettings(prev => {
      const updated = { ...prev };
      let current: any = updated;
      
      for (let i = 0; i < path.length - 1; i++) {
        current[path[i]] = { ...current[path[i]] };
        current = current[path[i]];
      }
      
      current[path[path.length - 1]] = value;
      return updated;
    });
  };

  const formatPhoneNumber = (text: string) => {
    const digits = text.replace(/\D/g, '');
    if (digits.length <= 3) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 3)}) ${digits.slice(3)}`;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 10)}`;
  };

  const handlePhoneChange = (text: string) => {
    const formatted = formatPhoneNumber(text);
    setPhoneNumber(formatted);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Notification Settings</Text>
        <Button
          title="Save"
          onPress={saveSettings}
          backgroundColor={LOWES_THEME.primary}
          size="small"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Push Notifications Master Toggle */}
        <View style={styles.section}>
          <View style={styles.masterToggle}>
            <View style={styles.toggleHeader}>
              <MaterialIcons name="notifications" size={28} color={LOWES_THEME.primary} />
              <View style={styles.toggleInfo}>
                <Text style={styles.sectionTitle}>Push Notifications</Text>
                <Text style={styles.sectionDescription}>
                  Get real-time updates in the app
                </Text>
              </View>
            </View>
            <Switch
              value={settings.pushEnabled}
              onValueChange={(value) => updateSetting(['pushEnabled'], value)}
              trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
            />
          </View>
        </View>

        {settings.pushEnabled && (
          <>
            {/* Messages */}
            <View style={styles.section}>
              <Text style={styles.categoryTitle}>💬 Messages</Text>
              <View style={styles.settingsList}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Enable Message Notifications</Text>
                    <Text style={styles.settingDescription}>
                      Get notified when you receive new messages
                    </Text>
                  </View>
                  <Switch
                    value={settings.messages.enabled}
                    onValueChange={(value) => updateSetting(['messages', 'enabled'], value)}
                    trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                  />
                </View>

                {settings.messages.enabled && (
                  <>
                    <View style={styles.subSettingRow}>
                      <Text style={styles.subSettingLabel}>Group Messages</Text>
                      <Switch
                        value={settings.messages.groupMessages}
                        onValueChange={(value) => updateSetting(['messages', 'groupMessages'], value)}
                        trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                      />
                    </View>
                    <View style={styles.subSettingRow}>
                      <Text style={styles.subSettingLabel}>Direct Messages</Text>
                      <Switch
                        value={settings.messages.directMessages}
                        onValueChange={(value) => updateSetting(['messages', 'directMessages'], value)}
                        trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                      />
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Alerts */}
            <View style={styles.section}>
              <Text style={styles.categoryTitle}>🔔 Alerts</Text>
              <View style={styles.settingsList}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Enable Alert Notifications</Text>
                    <Text style={styles.settingDescription}>
                      Get notified when managers send alerts
                    </Text>
                  </View>
                  <Switch
                    value={settings.alerts.enabled}
                    onValueChange={(value) => updateSetting(['alerts', 'enabled'], value)}
                    trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                  />
                </View>

                {settings.alerts.enabled && (
                  <>
                    <View style={styles.subSettingRow}>
                      <View style={styles.priorityLabel}>
                        <MaterialIcons name="info" size={16} color="#2196F3" />
                        <Text style={styles.subSettingLabel}>Low Priority</Text>
                      </View>
                      <Switch
                        value={settings.alerts.lowPriority}
                        onValueChange={(value) => updateSetting(['alerts', 'lowPriority'], value)}
                        trackColor={{ false: '#CCCCCC', true: '#2196F3' }}
                      />
                    </View>
                    <View style={styles.subSettingRow}>
                      <View style={styles.priorityLabel}>
                        <MaterialIcons name="warning" size={16} color="#FF9800" />
                        <Text style={styles.subSettingLabel}>Medium Priority</Text>
                      </View>
                      <Switch
                        value={settings.alerts.mediumPriority}
                        onValueChange={(value) => updateSetting(['alerts', 'mediumPriority'], value)}
                        trackColor={{ false: '#CCCCCC', true: '#FF9800' }}
                      />
                    </View>
                    <View style={styles.subSettingRow}>
                      <View style={styles.priorityLabel}>
                        <MaterialIcons name="error" size={16} color="#F44336" />
                        <Text style={styles.subSettingLabel}>High Priority</Text>
                      </View>
                      <Switch
                        value={settings.alerts.highPriority}
                        onValueChange={(value) => updateSetting(['alerts', 'highPriority'], value)}
                        trackColor={{ false: '#CCCCCC', true: '#F44336' }}
                      />
                    </View>
                    <View style={styles.subSettingRow}>
                      <View style={styles.priorityLabel}>
                        <MaterialIcons name="priority-high" size={16} color="#D32F2F" />
                        <Text style={styles.subSettingLabel}>Urgent Priority</Text>
                      </View>
                      <Switch
                        value={settings.alerts.urgentPriority}
                        onValueChange={(value) => updateSetting(['alerts', 'urgentPriority'], value)}
                        trackColor={{ false: '#CCCCCC', true: '#D32F2F' }}
                      />
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Clock Events */}
            <View style={styles.section}>
              <Text style={styles.categoryTitle}>⏰ Clock In/Out Events</Text>
              <View style={styles.settingsList}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Enable Clock Event Notifications</Text>
                    <Text style={styles.settingDescription}>
                      Get notified when employees clock in/out
                    </Text>
                  </View>
                  <Switch
                    value={settings.clockEvents.enabled}
                    onValueChange={(value) => updateSetting(['clockEvents', 'enabled'], value)}
                    trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                  />
                </View>

                {settings.clockEvents.enabled && (
                  <>
                    <View style={styles.subSettingRow}>
                      <Text style={styles.subSettingLabel}>Clock In</Text>
                      <Switch
                        value={settings.clockEvents.clockIn}
                        onValueChange={(value) => updateSetting(['clockEvents', 'clockIn'], value)}
                        trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                      />
                    </View>
                    <View style={styles.subSettingRow}>
                      <Text style={styles.subSettingLabel}>Clock Out (with stats)</Text>
                      <Switch
                        value={settings.clockEvents.clockOut}
                        onValueChange={(value) => updateSetting(['clockEvents', 'clockOut'], value)}
                        trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                      />
                    </View>
                    <View style={styles.subSettingRow}>
                      <Text style={styles.subSettingLabel}>Break Start</Text>
                      <Switch
                        value={settings.clockEvents.breakStart}
                        onValueChange={(value) => updateSetting(['clockEvents', 'breakStart'], value)}
                        trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                      />
                    </View>
                    <View style={styles.subSettingRow}>
                      <Text style={styles.subSettingLabel}>Break Return</Text>
                      <Switch
                        value={settings.clockEvents.breakReturn}
                        onValueChange={(value) => updateSetting(['clockEvents', 'breakReturn'], value)}
                        trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                      />
                    </View>
                    
                    <View style={styles.highlightedSetting}>
                      <View style={styles.settingInfo}>
                        <Text style={styles.settingLabel}>📊 Show Detailed Stats</Text>
                        <Text style={styles.settingDescription}>
                          Include hours worked, surveys, appointments, and per-hour average
                        </Text>
                      </View>
                      <Switch
                        value={settings.clockEvents.showStats}
                        onValueChange={(value) => updateSetting(['clockEvents', 'showStats'], value)}
                        trackColor={{ false: '#CCCCCC', true: '#4CAF50' }}
                      />
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Schedule Changes */}
            <View style={styles.section}>
              <Text style={styles.categoryTitle}>📅 Schedule Changes</Text>
              <View style={styles.settingsList}>
                <View style={styles.settingRow}>
                  <View style={styles.settingInfo}>
                    <Text style={styles.settingLabel}>Enable Schedule Notifications</Text>
                    <Text style={styles.settingDescription}>
                      Get notified about schedule changes
                    </Text>
                  </View>
                  <Switch
                    value={settings.scheduleChanges.enabled}
                    onValueChange={(value) => updateSetting(['scheduleChanges', 'enabled'], value)}
                    trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                  />
                </View>

                {settings.scheduleChanges.enabled && (
                  <>
                    <View style={styles.subSettingRow}>
                      <Text style={styles.subSettingLabel}>New Schedules</Text>
                      <Switch
                        value={settings.scheduleChanges.created}
                        onValueChange={(value) => updateSetting(['scheduleChanges', 'created'], value)}
                        trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                      />
                    </View>
                    <View style={styles.subSettingRow}>
                      <Text style={styles.subSettingLabel}>Updated Schedules</Text>
                      <Switch
                        value={settings.scheduleChanges.updated}
                        onValueChange={(value) => updateSetting(['scheduleChanges', 'updated'], value)}
                        trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                      />
                    </View>
                    <View style={styles.subSettingRow}>
                      <Text style={styles.subSettingLabel}>Deleted Schedules</Text>
                      <Switch
                        value={settings.scheduleChanges.deleted}
                        onValueChange={(value) => updateSetting(['scheduleChanges', 'deleted'], value)}
                        trackColor={{ false: '#CCCCCC', true: LOWES_THEME.primary }}
                      />
                    </View>
                  </>
                )}
              </View>
            </View>
          </>
        )}

        {/* SMS Notifications */}
        <View style={styles.section}>
          <View style={styles.masterToggle}>
            <View style={styles.toggleHeader}>
              <MaterialIcons name="sms" size={28} color="#4CAF50" />
              <View style={styles.toggleInfo}>
                <Text style={styles.sectionTitle}>SMS Notifications</Text>
                <Text style={styles.sectionDescription}>
                  Get critical updates via text message
                </Text>
              </View>
            </View>
            <Switch
              value={settings.smsEnabled}
              onValueChange={(value) => updateSetting(['smsEnabled'], value)}
              trackColor={{ false: '#CCCCCC', true: '#4CAF50' }}
            />
          </View>

          {settings.smsEnabled && (
            <View style={styles.phoneInputContainer}>
              <Text style={styles.inputLabel}>Your Phone Number</Text>
              <View style={styles.phoneInputWrapper}>
                <MaterialIcons name="phone" size={20} color={LOWES_THEME.textSubtle} />
                <Text
                  style={styles.phoneInput}
                  onPress={() => {
                    showAlert(
                      'Update Phone Number',
                      'Please update your phone number in your profile settings to receive SMS notifications.',
                      [
                        { text: 'OK' }
                      ]
                    );
                  }}
                >
                  {currentUser?.phone || 'Not set - Tap to update in Profile'}
                </Text>
              </View>
              <Text style={styles.helperText}>
                Standard messaging rates may apply
              </Text>
            </View>
          )}
        </View>

        {settings.smsEnabled && (
          <View style={styles.section}>
            <Text style={styles.categoryTitle}>📱 SMS Events</Text>
            <View style={styles.settingsList}>
              <View style={styles.subSettingRow}>
                <View style={styles.smsEventInfo}>
                  <Text style={styles.subSettingLabel}>Clock In</Text>
                  <Text style={styles.smsEventDescription}>
                    When employees clock in
                  </Text>
                </View>
                <Switch
                  value={settings.smsEvents.clockIn}
                  onValueChange={(value) => updateSetting(['smsEvents', 'clockIn'], value)}
                  trackColor={{ false: '#CCCCCC', true: '#4CAF50' }}
                />
              </View>

              <View style={styles.highlightedSetting}>
                <View style={styles.smsEventInfo}>
                  <Text style={styles.settingLabel}>Clock Out</Text>
                  <Text style={styles.smsEventDescription}>
                    With hours worked, surveys, appointments, and per-hour stats
                  </Text>
                </View>
                <Switch
                  value={settings.smsEvents.clockOut}
                  onValueChange={(value) => updateSetting(['smsEvents', 'clockOut'], value)}
                  trackColor={{ false: '#CCCCCC', true: '#4CAF50' }}
                />
              </View>

              <View style={styles.subSettingRow}>
                <View style={styles.smsEventInfo}>
                  <Text style={styles.subSettingLabel}>Low Quota Alert</Text>
                  <Text style={styles.smsEventDescription}>
                    When employee is below 5 surveys/hour
                  </Text>
                </View>
                <Switch
                  value={settings.smsEvents.lowQuota}
                  onValueChange={(value) => updateSetting(['smsEvents', 'lowQuota'], value)}
                  trackColor={{ false: '#CCCCCC', true: '#FF9800' }}
                />
              </View>

              <View style={styles.subSettingRow}>
                <View style={styles.smsEventInfo}>
                  <Text style={styles.subSettingLabel}>Urgent Alerts</Text>
                  <Text style={styles.smsEventDescription}>
                    When you send urgent priority alerts
                  </Text>
                </View>
                <Switch
                  value={settings.smsEvents.alerts}
                  onValueChange={(value) => updateSetting(['smsEvents', 'alerts'], value)}
                  trackColor={{ false: '#CCCCCC', true: '#F44336' }}
                />
              </View>

              <View style={styles.subSettingRow}>
                <View style={styles.smsEventInfo}>
                  <Text style={styles.subSettingLabel}>Time Off Requests</Text>
                  <Text style={styles.smsEventDescription}>
                    When employees request time off
                  </Text>
                </View>
                <Switch
                  value={settings.smsEvents.timeOffRequests}
                  onValueChange={(value) => updateSetting(['smsEvents', 'timeOffRequests'], value)}
                  trackColor={{ false: '#CCCCCC', true: '#4CAF50' }}
                />
              </View>

              <View style={styles.subSettingRow}>
                <View style={styles.smsEventInfo}>
                  <Text style={styles.subSettingLabel}>Late Employees</Text>
                  <Text style={styles.smsEventDescription}>
                    When employee is late for scheduled shift
                  </Text>
                </View>
                <Switch
                  value={settings.smsEvents.lateEmployees}
                  onValueChange={(value) => updateSetting(['smsEvents', 'lateEmployees'], value)}
                  trackColor={{ false: '#CCCCCC', true: '#FF9800' }}
                />
              </View>

              <View style={styles.subSettingRow}>
                <View style={styles.smsEventInfo}>
                  <Text style={styles.subSettingLabel}>Inactive Employees</Text>
                  <Text style={styles.smsEventDescription}>
                    When employee is inactive for 30+ minutes
                  </Text>
                </View>
                <Switch
                  value={settings.smsEvents.inactiveEmployees}
                  onValueChange={(value) => updateSetting(['smsEvents', 'inactiveEmployees'], value)}
                  trackColor={{ false: '#CCCCCC', true: '#F44336' }}
                />
              </View>
            </View>
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={20} color={LOWES_THEME.primary} />
          <Text style={styles.infoText}>
            These settings only apply to you. Each admin can customize their own notification preferences.
          </Text>
        </View>
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
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
    backgroundColor: '#FFFFFF',
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
  section: {
    backgroundColor: LOWES_THEME.surface,
    borderRadius: 12,
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  masterToggle: {
    gap: SPACING.md,
  },
  toggleHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  toggleInfo: {
    flex: 1,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  sectionDescription: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    marginTop: 2,
  },
  categoryTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  settingsList: {
    gap: SPACING.sm,
  },
  settingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  settingInfo: {
    flex: 1,
  },
  settingLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  settingDescription: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    marginTop: 2,
    lineHeight: 16,
  },
  subSettingRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingLeft: SPACING.lg,
    gap: SPACING.md,
  },
  subSettingLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
    color: LOWES_THEME.text,
  },
  priorityLabel: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    flex: 1,
  },
  highlightedSetting: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.primary,
    gap: SPACING.md,
  },
  phoneInputContainer: {
    marginTop: SPACING.md,
    gap: SPACING.sm,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  phoneInputWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
  },
  phoneInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
  },
  helperText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    fontStyle: 'italic',
  },
  smsEventInfo: {
    flex: 1,
  },
  smsEventDescription: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    marginTop: 2,
  },
  infoBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LOWES_THEME.primary,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 18,
  },
});
