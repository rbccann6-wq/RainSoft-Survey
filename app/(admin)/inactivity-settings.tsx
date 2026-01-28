// Admin inactivity alert settings
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Switch, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import * as ActivityService from '@/services/activityService';

export default function InactivitySettingsScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [settings, setSettings] = useState<ActivityService.InactivitySettings>({
    pushNotificationThreshold: 15,
    smsEscalationThreshold: 30,
    enabled: true,
  });

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      const currentSettings = await ActivityService.getInactivitySettings();
      setSettings(currentSettings);
    } catch (error) {
      console.error('Error loading settings:', error);
      showAlert('Error', 'Failed to load settings');
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    // Validate settings
    if (settings.pushNotificationThreshold <= 0) {
      showAlert('Invalid Value', 'Push notification threshold must be greater than 0');
      return;
    }
    
    if (settings.smsEscalationThreshold <= settings.pushNotificationThreshold) {
      showAlert('Invalid Value', 'SMS escalation threshold must be greater than push notification threshold');
      return;
    }

    setSaving(true);
    try {
      await ActivityService.saveInactivitySettings(settings);
      
      // Restart alerts with new settings
      if (settings.enabled) {
        ActivityService.stopInactivityAlerts();
        await ActivityService.startInactivityAlerts();
      } else {
        ActivityService.stopInactivityAlerts();
      }
      
      showAlert('Settings Saved', 'Inactivity alert settings have been updated successfully');
      router.back();
    } catch (error) {
      console.error('Error saving settings:', error);
      showAlert('Error', 'Failed to save settings');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
        </Pressable>
        <Text style={styles.headerTitle}>Inactivity Alert Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <MaterialIcons name="info" size={24} color={LOWES_THEME.primary} />
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerTitle}>Automatic Inactivity Monitoring</Text>
            <Text style={styles.infoBannerText}>
              The system checks every 60 seconds for employee activity. If no heartbeat is detected for 5 consecutive checks (5 minutes), the employee is marked as inactive.
            </Text>
          </View>
        </View>

        {/* Enable/Disable Toggle */}
        <View style={styles.section}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Enable Automatic Alerts</Text>
              <Text style={styles.settingDescription}>
                Send automatic push notifications and SMS when employees are inactive
              </Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={(value) => setSettings({ ...settings, enabled: value })}
              trackColor={{ false: '#ccc', true: LOWES_THEME.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {settings.enabled && (
          <>
            {/* Push Notification Threshold */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Push Notification Alert</Text>
              <Text style={styles.sectionDescription}>
                Send push notifications to admins when employees are inactive
              </Text>
              
              <View style={styles.thresholdCard}>
                <View style={styles.thresholdHeader}>
                  <MaterialIcons name="notifications" size={24} color={LOWES_THEME.primary} />
                  <Text style={styles.thresholdLabel}>Alert Threshold (Minutes)</Text>
                </View>
                
                <View style={styles.thresholdInputContainer}>
                  <TextInput
                    style={styles.thresholdInput}
                    value={String(settings.pushNotificationThreshold)}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      setSettings({ ...settings, pushNotificationThreshold: value });
                    }}
                    keyboardType="number-pad"
                    placeholder="15"
                  />
                  <Text style={styles.thresholdUnit}>minutes</Text>
                </View>
                
                <View style={styles.exampleBox}>
                  <MaterialIcons name="info-outline" size={16} color="#666" />
                  <Text style={styles.exampleText}>
                    Example: Push notification sent after {settings.pushNotificationThreshold} minutes of inactivity
                  </Text>
                </View>
              </View>

              {/* Suggested Values */}
              <View style={styles.suggestedValues}>
                <Text style={styles.suggestedLabel}>Suggested values:</Text>
                <View style={styles.suggestedButtons}>
                  {[10, 15, 20, 30].map(value => (
                    <Pressable
                      key={value}
                      style={[
                        styles.suggestedButton,
                        settings.pushNotificationThreshold === value && styles.suggestedButtonActive
                      ]}
                      onPress={() => setSettings({ ...settings, pushNotificationThreshold: value })}
                    >
                      <Text style={[
                        styles.suggestedButtonText,
                        settings.pushNotificationThreshold === value && styles.suggestedButtonTextActive
                      ]}>
                        {value}min
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* SMS Escalation Threshold */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>SMS Escalation Alert</Text>
              <Text style={styles.sectionDescription}>
                Escalate to SMS for prolonged inactivity (must be greater than push threshold)
              </Text>
              
              <View style={[styles.thresholdCard, styles.smsCard]}>
                <View style={styles.thresholdHeader}>
                  <MaterialIcons name="sms" size={24} color="#F44336" />
                  <Text style={styles.thresholdLabel}>Escalation Threshold (Minutes)</Text>
                </View>
                
                <View style={styles.thresholdInputContainer}>
                  <TextInput
                    style={styles.thresholdInput}
                    value={String(settings.smsEscalationThreshold)}
                    onChangeText={(text) => {
                      const value = parseInt(text) || 0;
                      setSettings({ ...settings, smsEscalationThreshold: value });
                    }}
                    keyboardType="number-pad"
                    placeholder="30"
                  />
                  <Text style={styles.thresholdUnit}>minutes</Text>
                </View>
                
                <View style={styles.exampleBox}>
                  <MaterialIcons name="warning" size={16} color="#F44336" />
                  <Text style={styles.exampleText}>
                    URGENT: SMS sent after {settings.smsEscalationThreshold} minutes of continuous inactivity
                  </Text>
                </View>
              </View>

              {/* Suggested Values */}
              <View style={styles.suggestedValues}>
                <Text style={styles.suggestedLabel}>Suggested values:</Text>
                <View style={styles.suggestedButtons}>
                  {[20, 30, 45, 60].map(value => (
                    <Pressable
                      key={value}
                      style={[
                        styles.suggestedButton,
                        settings.smsEscalationThreshold === value && styles.suggestedButtonActive
                      ]}
                      onPress={() => setSettings({ ...settings, smsEscalationThreshold: value })}
                    >
                      <Text style={[
                        styles.suggestedButtonText,
                        settings.smsEscalationThreshold === value && styles.suggestedButtonTextActive
                      ]}>
                        {value}min
                      </Text>
                    </Pressable>
                  ))}
                </View>
              </View>
            </View>

            {/* How It Works */}
            <View style={styles.howItWorksCard}>
              <View style={styles.howItWorksHeader}>
                <MaterialIcons name="help-outline" size={24} color={LOWES_THEME.primary} />
                <Text style={styles.howItWorksTitle}>How Automatic Alerts Work</Text>
              </View>
              
              <View style={styles.timeline}>
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTime}>Every 60 seconds</Text>
                    <Text style={styles.timelineText}>
                      System checks for employee heartbeat activity
                    </Text>
                  </View>
                </View>
                
                <View style={styles.timelineItem}>
                  <View style={styles.timelineDot} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTime}>5 consecutive misses (5 min)</Text>
                    <Text style={styles.timelineText}>
                      Employee marked as inactive
                    </Text>
                  </View>
                </View>
                
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: LOWES_THEME.primary }]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTime}>{settings.pushNotificationThreshold} minutes</Text>
                    <Text style={styles.timelineText}>
                      📱 Push notification sent to all admins
                    </Text>
                  </View>
                </View>
                
                <View style={styles.timelineItem}>
                  <View style={[styles.timelineDot, { backgroundColor: '#F44336' }]} />
                  <View style={styles.timelineContent}>
                    <Text style={styles.timelineTime}>{settings.smsEscalationThreshold} minutes</Text>
                    <Text style={styles.timelineText}>
                      🚨 URGENT SMS escalation sent to admins
                    </Text>
                  </View>
                </View>
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Save Button */}
      <View style={styles.footer}>
        <Button
          title={saving ? 'Saving...' : 'Save Settings'}
          onPress={handleSave}
          backgroundColor={LOWES_THEME.primary}
          fullWidth
          disabled={saving || loading}
        />
      </View>
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
  headerTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  infoBanner: {
    flexDirection: 'row',
    gap: SPACING.md,
    backgroundColor: '#E3F2FD',
    padding: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.lg,
  },
  infoBannerContent: {
    flex: 1,
  },
  infoBannerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
    marginBottom: 4,
  },
  infoBannerText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  section: {
    marginBottom: SPACING.xl,
  },
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: SPACING.lg,
    borderRadius: 12,
  },
  settingInfo: {
    flex: 1,
    marginRight: SPACING.md,
  },
  settingLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
    marginBottom: 4,
  },
  settingDescription: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    lineHeight: 18,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
    marginBottom: SPACING.xs,
  },
  sectionDescription: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    marginBottom: SPACING.md,
    lineHeight: 18,
  },
  thresholdCard: {
    backgroundColor: '#FFFFFF',
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
    borderWidth: 2,
    borderColor: LOWES_THEME.primary,
  },
  smsCard: {
    borderColor: '#F44336',
  },
  thresholdHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  thresholdLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  thresholdInputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#F5F5F5',
    padding: SPACING.md,
    borderRadius: 8,
  },
  thresholdInput: {
    fontSize: 32,
    fontWeight: '700',
    color: LOWES_THEME.text,
    minWidth: 80,
    textAlign: 'center',
  },
  thresholdUnit: {
    fontSize: FONTS.sizes.lg,
    color: LOWES_THEME.textSubtle,
    fontWeight: '600',
  },
  exampleBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#F5F5F5',
    padding: SPACING.sm,
    borderRadius: 6,
  },
  exampleText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: '#666',
    lineHeight: 18,
  },
  suggestedValues: {
    marginTop: SPACING.md,
  },
  suggestedLabel: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    marginBottom: SPACING.xs,
  },
  suggestedButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  suggestedButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LOWES_THEME.primary,
    backgroundColor: '#FFFFFF',
  },
  suggestedButtonActive: {
    backgroundColor: LOWES_THEME.primary,
  },
  suggestedButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.primary,
  },
  suggestedButtonTextActive: {
    color: '#FFFFFF',
  },
  howItWorksCard: {
    backgroundColor: '#FFFFFF',
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  howItWorksHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  howItWorksTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  timeline: {
    gap: SPACING.md,
  },
  timelineItem: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  timelineDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#E0E0E0',
    marginTop: 4,
  },
  timelineContent: {
    flex: 1,
  },
  timelineTime: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: LOWES_THEME.text,
    marginBottom: 2,
  },
  timelineText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    lineHeight: 18,
  },
  footer: {
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
});
