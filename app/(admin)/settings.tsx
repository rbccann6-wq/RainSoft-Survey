// Admin settings - Compensation rates
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAlert } from '@/template';
import * as StorageService from '@/services/storageService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';

export default function SettingsScreen() {
  const { showAlert } = useAlert();
  const [baseRate, setBaseRate] = useState('15.00');
  const [surveyBonus, setSurveyBonus] = useState('10.00');
  const [appointmentBonus, setAppointmentBonus] = useState('25.00');
  const [quota, setQuota] = useState('5');

  React.useEffect(() => {
    loadSettings();
  }, []);

  const loadSettings = async () => {
    const settings = await StorageService.getCompensationSettings();
    if (settings) {
      setBaseRate(settings.baseHourlyRate.toString());
      setSurveyBonus(settings.surveyInstallBonus.toString());
      setAppointmentBonus(settings.appointmentInstallBonus.toString());
      setQuota(settings.quota.toString());
    }
  };

  const handleSave = async () => {
    const settings = {
      baseHourlyRate: parseFloat(baseRate),
      surveyInstallBonus: parseFloat(surveyBonus),
      appointmentInstallBonus: parseFloat(appointmentBonus),
      quota: parseInt(quota),
    };

    await StorageService.saveCompensationSettings(settings);
    showAlert('Settings Saved', 'Compensation settings have been updated successfully');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Compensation Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="attach-money" size={24} color={LOWES_THEME.primary} />
            <Text style={styles.sectionTitle}>Compensation Rates</Text>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.label}>Base Hourly Rate</Text>
            <View style={styles.inputRow}>
              <Text style={styles.dollarSign}>$</Text>
              <Input
                value={baseRate}
                onChangeText={setBaseRate}
                keyboardType="decimal-pad"
                placeholder="15.00"
              />
            </View>
            <Text style={styles.helper}>Paid when meeting quota requirements</Text>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.label}>Survey Install Bonus</Text>
            <View style={styles.inputRow}>
              <Text style={styles.dollarSign}>$</Text>
              <Input
                value={surveyBonus}
                onChangeText={setSurveyBonus}
                keyboardType="decimal-pad"
                placeholder="10.00"
              />
            </View>
            <Text style={styles.helper}>Bonus per completed survey that results in install</Text>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.label}>Appointment Install Bonus</Text>
            <View style={styles.inputRow}>
              <Text style={styles.dollarSign}>$</Text>
              <Input
                value={appointmentBonus}
                onChangeText={setAppointmentBonus}
                keyboardType="decimal-pad"
                placeholder="25.00"
              />
            </View>
            <Text style={styles.helper}>Bonus per appointment that results in install</Text>
          </View>

          <View style={styles.settingCard}>
            <Text style={styles.label}>Survey Quota (per hour)</Text>
            <Input
              value={quota}
              onChangeText={setQuota}
              keyboardType="number-pad"
              placeholder="5"
            />
            <Text style={styles.helper}>Required qualified surveys per hour to earn full rate</Text>
          </View>

          <Button
            title="Save Settings"
            onPress={handleSave}
            backgroundColor={LOWES_THEME.success}
            fullWidth
          />
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={20} color={LOWES_THEME.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Important Notice</Text>
            <Text style={styles.infoText}>
              • Changes apply to all future pay calculations{'\n'}
              • Employees will see updated rates in their onboarding{'\n'}
              • Not meeting quota may result in minimum wage pay{'\n'}
              • All rates are subject to state and federal laws
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.xl,
  },
  section: {
    gap: SPACING.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  settingCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  label: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  dollarSign: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.success,
  },
  helper: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    lineHeight: 18,
  },
  infoBox: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
  },
  infoContent: {
    flex: 1,
    gap: SPACING.sm,
  },
  infoTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
});
