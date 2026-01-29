// Manual trigger for stats sync - Admin testing page
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';

interface SyncResult {
  success: boolean;
  recordsProcessed?: number;
  syncStartTime?: string;
  syncEndTime?: string;
  leadReportProcessed?: boolean;
  appointmentReportProcessed?: boolean;
  error?: string;
}

export default function SyncStatsScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  
  const [syncing, setSyncing] = useState(false);
  const [lastResult, setLastResult] = useState<SyncResult | null>(null);

  const handleSync = async () => {
    setSyncing(true);
    setLastResult(null);

    try {
      console.log('🔄 Triggering stats sync...');

      const { data, error } = await supabase.functions.invoke('stats-sync', {
        body: {},
      });

      if (error) {
        throw error;
      }

      setLastResult(data as SyncResult);

      if (data.success) {
        showAlert('Success', `Stats sync completed! Processed ${data.recordsProcessed} records.`);
      } else {
        showAlert('Sync Failed', data.error || 'Unknown error occurred');
      }
    } catch (error) {
      console.error('❌ Sync failed:', error);
      const errorMessage = error instanceof Error ? error.message : String(error);
      setLastResult({ success: false, error: errorMessage });
      showAlert('Error', errorMessage);
    } finally {
      setSyncing(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Stats Sync</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <MaterialIcons name="info" size={24} color={LOWES_THEME.primary} />
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerTitle}>Survey Outcome Stats Sync</Text>
            <Text style={styles.infoBannerText}>
              This syncs employee survey statistics from Salesforce Reports to the local database. Normally runs automatically at midnight.
            </Text>
          </View>
        </View>

        {/* Setup Instructions */}
        <View style={styles.setupCard}>
          <Text style={styles.setupTitle}>📋 Required Setup</Text>
          <Text style={styles.setupText}>
            Before running sync, ensure:
          </Text>
          <View style={styles.checklistItem}>
            <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.checklistText}>
              Created Salesforce reports (see SALESFORCE_REPORTS_SETUP.md)
            </Text>
          </View>
          <View style={styles.checklistItem}>
            <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.checklistText}>
              Added Report IDs to Cloud → Secrets
            </Text>
          </View>
          <View style={styles.checklistItem}>
            <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
            <Text style={styles.checklistText}>
              Configured status mappings in Survey Stats Config
            </Text>
          </View>
        </View>

        {/* Sync Button */}
        <Button
          title={syncing ? 'Syncing...' : 'Run Stats Sync Now'}
          onPress={handleSync}
          disabled={syncing}
          icon={syncing ? undefined : 'sync'}
          backgroundColor={LOWES_THEME.primary}
          fullWidth
        />

        {/* Last Sync Result */}
        {lastResult && (
          <View style={[
            styles.resultCard,
            lastResult.success ? styles.successCard : styles.errorCard,
          ]}>
            <View style={styles.resultHeader}>
              <MaterialIcons
                name={lastResult.success ? 'check-circle' : 'error'}
                size={32}
                color={lastResult.success ? '#4CAF50' : '#F44336'}
              />
              <Text style={[
                styles.resultTitle,
                { color: lastResult.success ? '#4CAF50' : '#F44336' }
              ]}>
                {lastResult.success ? 'Sync Successful' : 'Sync Failed'}
              </Text>
            </View>

            {lastResult.success && (
              <View style={styles.resultDetails}>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Records Processed:</Text>
                  <Text style={styles.resultValue}>{lastResult.recordsProcessed}</Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Lead Report:</Text>
                  <Text style={styles.resultValue}>
                    {lastResult.leadReportProcessed ? '✓ Processed' : '✗ Skipped'}
                  </Text>
                </View>
                <View style={styles.resultRow}>
                  <Text style={styles.resultLabel}>Appointment Report:</Text>
                  <Text style={styles.resultValue}>
                    {lastResult.appointmentReportProcessed ? '✓ Processed' : '✗ Skipped'}
                  </Text>
                </View>
                {lastResult.syncStartTime && lastResult.syncEndTime && (
                  <View style={styles.resultRow}>
                    <Text style={styles.resultLabel}>Duration:</Text>
                    <Text style={styles.resultValue}>
                      {Math.round(
                        (new Date(lastResult.syncEndTime).getTime() - 
                         new Date(lastResult.syncStartTime).getTime()) / 1000
                      )}s
                    </Text>
                  </View>
                )}
              </View>
            )}

            {lastResult.error && (
              <View style={styles.errorDetails}>
                <Text style={styles.errorText}>{lastResult.error}</Text>
              </View>
            )}
          </View>
        )}

        {/* Help Section */}
        <View style={styles.helpCard}>
          <Text style={styles.helpTitle}>📖 Documentation</Text>
          <Text style={styles.helpText}>
            For detailed setup instructions, see:
          </Text>
          <Text style={styles.helpFile}>SALESFORCE_REPORTS_SETUP.md</Text>
          
          <View style={styles.helpLinks}>
            <Pressable 
              style={styles.helpButton}
              onPress={() => router.push('/(admin)/survey-stats-config' as any)}
            >
              <MaterialIcons name="timeline" size={20} color={LOWES_THEME.primary} />
              <Text style={styles.helpButtonText}>Configure Status Mappings</Text>
            </Pressable>
            
            <Pressable 
              style={styles.helpButton}
              onPress={() => router.push('/(admin)/employee-survey-outcomes' as any)}
            >
              <MaterialIcons name="bar-chart" size={20} color={LOWES_THEME.primary} />
              <Text style={styles.helpButtonText}>View Employee Stats</Text>
            </Pressable>
          </View>
        </View>
      </ScrollView>

      {/* Loading Overlay */}
      {syncing && (
        <View style={styles.loadingOverlay}>
          <View style={styles.loadingCard}>
            <ActivityIndicator size="large" color={LOWES_THEME.primary} />
            <Text style={styles.loadingText}>Syncing stats from Salesforce...</Text>
            <Text style={styles.loadingSubtext}>This may take a few moments</Text>
          </View>
        </View>
      )}
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
    gap: SPACING.xl,
  },
  infoBanner: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    backgroundColor: '#E3F2FD',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.primary,
  },
  infoBannerContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  infoBannerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  infoBannerText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  setupCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  setupTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  setupText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  checklistItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  checklistText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    flex: 1,
  },
  resultCard: {
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  successCard: {
    backgroundColor: '#E8F5E9',
    borderWidth: 2,
    borderColor: '#4CAF50',
  },
  errorCard: {
    backgroundColor: '#FFEBEE',
    borderWidth: 2,
    borderColor: '#F44336',
  },
  resultHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  resultTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  resultDetails: {
    gap: SPACING.sm,
  },
  resultRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  resultLabel: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  resultValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  errorDetails: {
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    color: '#F44336',
    lineHeight: 20,
  },
  helpCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  helpTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  helpText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  helpFile: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.primary,
    fontFamily: 'monospace',
  },
  helpLinks: {
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  helpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  helpButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.primary,
  },
  loadingOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingCard: {
    backgroundColor: '#FFFFFF',
    padding: SPACING.xl,
    borderRadius: 12,
    alignItems: 'center',
    gap: SPACING.md,
    minWidth: 200,
  },
  loadingText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  loadingSubtext: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
});
