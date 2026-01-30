// Daily Report Settings - Configure automated reporting
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Switch, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { getSupabaseClient } from '@/template';
import * as StorageService from '@/services/storageService';

const supabase = getSupabaseClient();

interface ReportSettings {
  enabled: boolean;
  emailRecipients: string[];
  smsRecipients: string[];
  sendTime: string;
  includeSurveyStats: boolean;
  includeTimeClockData: boolean;
  includeInactivity: boolean;
  reportPeriod: 'today' | 'yesterday' | 'last_7_days';
}

export default function ReportSettingsScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [testingSend, setTestingSend] = useState(false);
  
  const [settings, setSettings] = useState<ReportSettings>({
    enabled: false,
    emailRecipients: [],
    smsRecipients: [],
    sendTime: '18:00',
    includeSurveyStats: true,
    includeTimeClockData: true,
    includeInactivity: true,
    reportPeriod: 'today',
  });

  const [newEmail, setNewEmail] = useState('');
  const [newPhone, setNewPhone] = useState('');

  useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    try {
      setLoading(true);
      const savedSettings = await StorageService.getData<ReportSettings>('daily_report_settings');
      if (savedSettings) {
        setSettings(savedSettings);
      }
    } catch (error) {
      console.error('Error loading report settings:', error);
      showAlert('Error', 'Failed to load report settings');
    } finally {
      setLoading(false);
    }
  };

  const saveSettings = async () => {
    try {
      setSaving(true);
      await StorageService.saveData('daily_report_settings', settings);
      showAlert('Success', 'Report settings saved successfully');
    } catch (error) {
      console.error('Error saving report settings:', error);
      showAlert('Error', 'Failed to save report settings');
    } finally {
      setSaving(false);
    }
  };

  const addEmailRecipient = () => {
    const email = newEmail.trim();
    if (!email) return;

    // Basic email validation
    if (!email.includes('@') || !email.includes('.')) {
      showAlert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (settings.emailRecipients.includes(email)) {
      showAlert('Duplicate', 'This email is already in the list');
      return;
    }

    setSettings((prev) => ({
      ...prev,
      emailRecipients: [...prev.emailRecipients, email],
    }));
    setNewEmail('');
  };

  const removeEmailRecipient = (email: string) => {
    setSettings((prev) => ({
      ...prev,
      emailRecipients: prev.emailRecipients.filter((e) => e !== email),
    }));
  };

  const addPhoneRecipient = () => {
    const phone = newPhone.trim().replace(/\D/g, '');
    if (!phone) return;

    if (phone.length !== 10) {
      showAlert('Invalid Phone', 'Please enter a 10-digit phone number');
      return;
    }

    const formatted = `+1${phone}`;
    if (settings.smsRecipients.includes(formatted)) {
      showAlert('Duplicate', 'This phone number is already in the list');
      return;
    }

    setSettings((prev) => ({
      ...prev,
      smsRecipients: [...prev.smsRecipients, formatted],
    }));
    setNewPhone('');
  };

  const removePhoneRecipient = (phone: string) => {
    setSettings((prev) => ({
      ...prev,
      smsRecipients: prev.smsRecipients.filter((p) => p !== phone),
    }));
  };

  const sendTestReport = async () => {
    if (settings.emailRecipients.length === 0 && settings.smsRecipients.length === 0) {
      showAlert('No Recipients', 'Please add at least one email or phone number to send a test report');
      return;
    }

    try {
      setTestingSend(true);

      const { data, error } = await supabase.functions.invoke('daily-report', {
        body: {
          manual: true,
          settings: settings,
          reportPeriod: 'today',
          emailRecipients: settings.emailRecipients,
          smsRecipients: settings.smsRecipients,
        },
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        showAlert(
          'Test Report Sent',
          `Successfully sent ${data.emailsSent} email(s) and ${data.smsSent} SMS message(s)`
        );
      } else {
        showAlert('Error', data.error || 'Failed to send test report');
      }
    } catch (error) {
      console.error('Error sending test report:', error);
      showAlert('Error', 'Failed to send test report');
    } finally {
      setTestingSend(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator size="large" color={LOWES_THEME.primary} />
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
        <Text style={styles.headerTitle}>Daily Report Settings</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={styles.content}>
        {/* Enable/Disable */}
        <View style={styles.section}>
          <View style={styles.switchRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.switchLabel}>Enable Daily Reports</Text>
              <Text style={styles.switchSubtext}>Automatically send reports every night</Text>
            </View>
            <Switch
              value={settings.enabled}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, enabled: value }))}
              trackColor={{ false: '#ccc', true: LOWES_THEME.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Report Period */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Period</Text>
          <View style={styles.chipRow}>
            {[
              { value: 'today', label: 'Today' },
              { value: 'yesterday', label: 'Yesterday' },
              { value: 'last_7_days', label: 'Last 7 Days' },
            ].map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.chip,
                  settings.reportPeriod === option.value && styles.chipActive,
                ]}
                onPress={() => setSettings((prev) => ({ ...prev, reportPeriod: option.value as any }))}
              >
                <Text
                  style={[
                    styles.chipText,
                    settings.reportPeriod === option.value && styles.chipTextActive,
                  ]}
                >
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Send Time */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Send Time</Text>
          <TextInput
            style={styles.input}
            value={settings.sendTime}
            onChangeText={(value) => setSettings((prev) => ({ ...prev, sendTime: value }))}
            placeholder="18:00"
            placeholderTextColor="#999"
          />
          <Text style={styles.helpText}>
            24-hour format (e.g., 18:00 for 6:00 PM). Note: Automatic scheduling requires Supabase cron job setup.
          </Text>
        </View>

        {/* Report Content */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Report Content</Text>
          
          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Survey Statistics</Text>
            <Switch
              value={settings.includeSurveyStats}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, includeSurveyStats: value }))}
              trackColor={{ false: '#ccc', true: LOWES_THEME.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Time Clock Data</Text>
            <Switch
              value={settings.includeTimeClockData}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, includeTimeClockData: value }))}
              trackColor={{ false: '#ccc', true: LOWES_THEME.primary }}
              thumbColor="#FFFFFF"
            />
          </View>

          <View style={styles.switchRow}>
            <Text style={styles.switchLabel}>Inactivity Logs</Text>
            <Switch
              value={settings.includeInactivity}
              onValueChange={(value) => setSettings((prev) => ({ ...prev, includeInactivity: value }))}
              trackColor={{ false: '#ccc', true: LOWES_THEME.primary }}
              thumbColor="#FFFFFF"
            />
          </View>
        </View>

        {/* Email Recipients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Email Recipients</Text>
          
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={newEmail}
              onChangeText={setNewEmail}
              placeholder="admin@example.com"
              placeholderTextColor="#999"
              keyboardType="email-address"
              autoCapitalize="none"
            />
            <Button
              title="Add"
              onPress={addEmailRecipient}
              icon="add"
              size="small"
            />
          </View>

          {settings.emailRecipients.length > 0 && (
            <View style={styles.recipientsList}>
              {settings.emailRecipients.map((email) => (
                <View key={email} style={styles.recipientItem}>
                  <MaterialIcons name="email" size={18} color={LOWES_THEME.primary} />
                  <Text style={styles.recipientText}>{email}</Text>
                  <Pressable onPress={() => removeEmailRecipient(email)}>
                    <MaterialIcons name="close" size={20} color="#F44336" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* SMS Recipients */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>SMS Recipients</Text>
          
          <View style={styles.inputRow}>
            <TextInput
              style={[styles.input, { flex: 1 }]}
              value={newPhone}
              onChangeText={setNewPhone}
              placeholder="(555) 123-4567"
              placeholderTextColor="#999"
              keyboardType="phone-pad"
            />
            <Button
              title="Add"
              onPress={addPhoneRecipient}
              icon="add"
              size="small"
            />
          </View>

          {settings.smsRecipients.length > 0 && (
            <View style={styles.recipientsList}>
              {settings.smsRecipients.map((phone) => (
                <View key={phone} style={styles.recipientItem}>
                  <MaterialIcons name="sms" size={18} color={LOWES_THEME.primary} />
                  <Text style={styles.recipientText}>{phone}</Text>
                  <Pressable onPress={() => removePhoneRecipient(phone)}>
                    <MaterialIcons name="close" size={20} color="#F44336" />
                  </Pressable>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* Actions */}
        <View style={styles.section}>
          <Button
            title={saving ? 'Saving...' : 'Save Settings'}
            onPress={saveSettings}
            disabled={saving}
            icon="save"
          />
          
          <Button
            title={testingSend ? 'Sending...' : 'Send Test Report Now'}
            onPress={sendTestReport}
            disabled={testingSend}
            variant="outline"
            icon="send"
          />
        </View>

        {/* Info */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={24} color={LOWES_THEME.primary} />
          <View style={{ flex: 1 }}>
            <Text style={styles.infoTitle}>Automated Scheduling</Text>
            <Text style={styles.infoText}>
              To enable automatic nightly reports, you need to set up a Supabase cron job that calls the daily-report Edge Function at your specified time.
            </Text>
            <Text style={styles.infoText}>
              Use the "Send Test Report Now" button to preview the report format and verify delivery.
            </Text>
          </View>
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
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
    textAlign: 'center',
  },
  content: {
    flex: 1,
    padding: SPACING.lg,
  },
  section: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.lg,
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  switchRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
  },
  switchLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  switchSubtext: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    marginTop: 2,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  chip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: LOWES_THEME.primary,
    backgroundColor: '#FFFFFF',
  },
  chipActive: {
    backgroundColor: LOWES_THEME.primary,
  },
  chipText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.primary,
  },
  chipTextActive: {
    color: '#FFFFFF',
  },
  input: {
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
    borderRadius: 8,
    padding: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
    backgroundColor: '#FFFFFF',
  },
  helpText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    fontStyle: 'italic',
  },
  inputRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
  },
  recipientsList: {
    gap: SPACING.xs,
  },
  recipientItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  recipientText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
  },
  infoBox: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.primary,
    marginBottom: SPACING.xl,
  },
  infoTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
    marginBottom: SPACING.xs,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
});
