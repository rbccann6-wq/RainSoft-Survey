// Sync status dashboard
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, RefreshControl, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import * as StorageService from '@/services/storageService';
import * as SyncService from '@/services/syncService';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { Survey } from '@/types';

interface SyncLogItem {
  type: 'survey' | 'appointment';
  id: string;
  name: string;
  salesforceId?: string;
  error?: string;
  status: 'success' | 'failed' | 'duplicate';
}

interface SyncLog {
  timestamp: string;
  synced: number;
  failed: number;
  duplicates: number;
  queueSize: number;
  items?: SyncLogItem[];
}

interface FailedSyncItem {
  type: string;
  data: any;
  timestamp: string;
  failedAt: string;
  error: string;
}

export default function SyncDashboardScreen() {
  const { isOnline } = useApp();
  const { showAlert } = useAlert();
  const [syncLogs, setSyncLogs] = useState<SyncLog[]>([]);
  const [failedItems, setFailedItems] = useState<FailedSyncItem[]>([]);
  const [queueSize, setQueueSize] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);
  const [testingConnections, setTestingConnections] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState({
    salesforce: null as boolean | null,
    zapier: null as boolean | null,
    adp: null as boolean | null,
    twilio: null as boolean | null,
    sendgrid: null as boolean | null,
  });
  const [refreshing, setRefreshing] = useState(false);
  const [creatingTestSurvey, setCreatingTestSurvey] = useState(false);
  const [selectedFailedItem, setSelectedFailedItem] = useState<FailedSyncItem | null>(null);
  const [showFailedItemModal, setShowFailedItemModal] = useState(false);

  React.useEffect(() => {
    loadSyncData();
  }, []);

  const loadSyncData = async () => {
    const logs = await StorageService.getSyncLogs();
    setSyncLogs(logs || []);
    
    const failed = await StorageService.getFailedSyncItems();
    setFailedItems(failed || []);
    
    const queue = await StorageService.getSyncQueue();
    setQueueSize(queue?.length || 0);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadSyncData();
    setRefreshing(false);
  };

  const handleManualSync = async () => {
    if (!isOnline) {
      showAlert('Offline', 'Cannot sync while offline. Connect to internet and try again.');
      return;
    }

    setIsSyncing(true);
    try {
      const result = await SyncService.triggerImmediateSync();
      await loadSyncData();
      
      showAlert(
        'Sync Complete ✓',
        `Synced: ${result.synced}\nFailed: ${result.failed}\nDuplicates: ${result.duplicates}`
      );
    } catch (error) {
      showAlert('Sync Error', `Failed to sync: ${error}`);
    } finally {
      setIsSyncing(false);
    }
  };

  const testConnections = async () => {
    if (!isOnline) {
      showAlert('Offline', 'Cannot test connections while offline.');
      return;
    }

    setTestingConnections(true);
    setConnectionStatus({ salesforce: null, zapier: null, adp: null, twilio: null, sendgrid: null });

    // Test all integrations in parallel
    const [sfResult, zapResult, adpResult, twilioResult, sendGridResult] = await Promise.all([
      SyncService.testSalesforceConnection(),
      SyncService.testWebhookConnection(),
      SyncService.testADPConnection(),
      SyncService.testTwilioConnection(),
      SyncService.testSendGridConnection(),
    ]);

    // Update connection status
    setConnectionStatus({
      salesforce: sfResult.success,
      zapier: zapResult.success,
      adp: adpResult.success,
      twilio: twilioResult.success,
      sendgrid: sendGridResult.success,
    });

    setTestingConnections(false);

    const allSuccess = sfResult.success && zapResult.success && adpResult.success && twilioResult.success && sendGridResult.success;
    const failedIntegrations = [
      !sfResult.success && `Salesforce: ${sfResult.message}`,
      !zapResult.success && `Zapier: ${zapResult.message}`,
      !adpResult.success && `ADP: ${adpResult.message}`,
      !twilioResult.success && `Twilio SMS: ${twilioResult.message}`,
      !sendGridResult.success && `SendGrid Email: ${sendGridResult.message}`,
    ].filter(Boolean);

    showAlert(
      allSuccess ? '✅ All Connections OK' : '⚠️ Connection Issues',
      allSuccess
        ? 'All integrations are connected and working properly:\n\n✓ Salesforce\n✓ Zapier\n✓ ADP\n✓ Twilio SMS\n✓ SendGrid Email'
        : `Some integrations failed:\n\n${failedIntegrations.join('\n\n')}`
    );
  };

  const clearFailedItems = async () => {
    showAlert('Clear Failed Items', 'This will permanently remove all failed sync records. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Clear',
        style: 'destructive',
        onPress: async () => {
          await StorageService.clearFailedSyncItems();
          await loadSyncData();
          showAlert('Cleared', 'Failed sync items cleared');
        },
      },
    ]);
  };

  const createTestSurvey = async () => {
    if (!isOnline) {
      showAlert('Offline', 'Need internet connection to test sync. Connect and try again.');
      return;
    }

    setCreatingTestSurvey(true);
    try {
      const employees = await StorageService.getEmployees();
      const currentEmployee = employees?.[0] || { id: 'test-employee', email: 'test@example.com' };

      const testPhone = `555-TEST-${Math.floor(Math.random() * 9000) + 1000}`;

      // Create realistic test survey
      const testSurvey: Survey = {
        id: `test-survey-${Date.now()}`,
        employeeId: currentEmployee.id,
        employeeAlias: currentEmployee.email?.split('@')[0] || 'Test Employee',
        timestamp: new Date().toISOString(),
        store: 'lowes', // Test with Lowes
        category: 'survey', // Changed from 'qualified' to 'survey'
        answers: {
          buys_bottled_water: 'Yes',
          is_homeowner: 'Yes', // Must be homeowner to sync
          has_salt_system: 'No',
          uses_filters: 'Yes',
          tastes_odors: 'Yes',
          water_quality: 'Fair',
          water_source: 'City',
          current_treatment: 'Pitcher Filter',
          property_type: 'Single Family',
          phone: testPhone, // This is required for sync
          contact_info: {
            firstName: 'Test',
            lastName: 'Survey',
            phone: testPhone,
            address: '123 Test Street',
            city: 'Charlotte',
            state: 'NC',
            zipCode: '28202',
          },
        },
        syncedToSalesforce: false,
        syncedToZapier: false,
        signature: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      };

      console.log('📝 Creating test survey:', testSurvey.id);
      console.log('   Phone:', testPhone);
      console.log('   Category:', testSurvey.category);
      console.log('   Homeowner:', testSurvey.answers.is_homeowner);

      // Save survey
      const existingSurveys = await StorageService.getSurveys() || [];
      existingSurveys.unshift(testSurvey);
      await StorageService.saveSurveys(existingSurveys);
      console.log('✓ Survey saved to storage');

      // Add to sync queue
      const queue = await StorageService.getSyncQueue() || [];
      queue.push({
        type: 'survey',
        data: testSurvey,
        timestamp: new Date().toISOString(),
      });
      await StorageService.saveData('sync_queue', queue);
      console.log('✓ Survey added to sync queue');

      // Trigger immediate sync
      console.log('🔄 Triggering sync...');
      const result = await SyncService.triggerImmediateSync();
      console.log('✓ Sync complete:', result);
      
      // Reload data to see the updated survey with sync status
      await loadSyncData();
      
      // Get the updated survey to check for errors
      const updatedSurveys = await StorageService.getSurveys() || [];
      const syncedSurvey = updatedSurveys.find(s => s.id === testSurvey.id);

      if (result.synced > 0) {
        const message = syncedSurvey?.salesforceId 
          ? `Successfully synced to Salesforce!\n\nSalesforce ID: ${syncedSurvey.salesforceId}\n\nDetails:\n- Name: Test Survey\n- Phone: ${testPhone}\n- Store: Lowes\n\nGo to Surveys tab and click "Verify" to confirm!`
          : `Successfully synced to Salesforce!\n\nDetails:\n- Name: Test Survey\n- Phone: ${testPhone}\n- Store: Lowes\n\nCheck your Salesforce Leads!`;
        showAlert('✅ Test Survey Synced!', message);
      } else if (result.duplicates > 0) {
        showAlert(
          '⚠️ Test Survey Created (Duplicate Detected)',
          `Survey created but marked as duplicate in Salesforce.\n\nCheck the Duplicates tab to review.`
        );
      } else if (result.failed > 0) {
        const errorMsg = syncedSurvey?.syncError || 'Unknown error';
        showAlert(
          '❌ Sync Failed',
          `Test survey created but sync failed.\n\nError: ${errorMsg}\n\nSynced: ${result.synced}\nFailed: ${result.failed}\n\nCheck the Failed Syncs section below for full details.`
        );
      } else {
        showAlert(
          '⚠️ Survey Skipped',
          `Test survey was created but not synced.\n\nPossible reasons:\n- No phone number\n- Renter category\n- Already synced\n\nCheck the Surveys tab to verify.`
        );
      }
    } catch (error) {
      console.error('❌ Test survey error:', error);
      showAlert('Error', `Failed to create test survey:\n\n${String(error)}`);
    } finally {
      setCreatingTestSurvey(false);
    }
  };

  // Calculate stats
  const totalSynced = syncLogs.reduce((sum, log) => sum + log.synced, 0);
  const totalFailed = syncLogs.reduce((sum, log) => sum + log.failed, 0);
  const totalDuplicates = syncLogs.reduce((sum, log) => sum + log.duplicates, 0);
  const successRate = totalSynced + totalFailed > 0
    ? ((totalSynced / (totalSynced + totalFailed)) * 100).toFixed(1)
    : '0';

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Sync Dashboard</Text>
        <View style={styles.headerActions}>
          {isOnline ? (
            <View style={styles.onlineBadge}>
              <MaterialIcons name="wifi" size={16} color="#FFFFFF" />
              <Text style={styles.badgeText}>Online</Text>
            </View>
          ) : (
            <View style={styles.offlineBadge}>
              <MaterialIcons name="wifi-off" size={16} color="#FFFFFF" />
              <Text style={styles.badgeText}>Offline</Text>
            </View>
          )}
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {/* Quick Stats */}
        <View style={styles.statsGrid}>
          <View style={styles.statCard}>
            <MaterialIcons name="check-circle" size={32} color={LOWES_THEME.success} />
            <Text style={styles.statValue}>{totalSynced}</Text>
            <Text style={styles.statLabel}>Total Synced</Text>
          </View>

          <View style={styles.statCard}>
            <MaterialIcons name="pending" size={32} color={LOWES_THEME.warning} />
            <Text style={styles.statValue}>{queueSize}</Text>
            <Text style={styles.statLabel}>In Queue</Text>
          </View>

          <View style={styles.statCard}>
            <MaterialIcons name="error" size={32} color={LOWES_THEME.error} />
            <Text style={styles.statValue}>{totalFailed}</Text>
            <Text style={styles.statLabel}>Failed</Text>
          </View>

          <View style={styles.statCard}>
            <MaterialIcons name="copy-all" size={32} color="#9C27B0" />
            <Text style={styles.statValue}>{totalDuplicates}</Text>
            <Text style={styles.statLabel}>Duplicates</Text>
          </View>
        </View>

        {/* Success Rate */}
        <View style={styles.successCard}>
          <View style={styles.successHeader}>
            <Text style={styles.successTitle}>Success Rate</Text>
            <Text style={styles.successRate}>{successRate}%</Text>
          </View>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${successRate}%` }]} />
          </View>
        </View>

        {/* Manual Sync Controls */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Sync Controls</Text>
          <View style={styles.controlsGrid}>
            <Button
              title={isSyncing ? 'Syncing...' : 'Sync Now'}
              onPress={handleManualSync}
              backgroundColor={LOWES_THEME.primary}
              disabled={!isOnline || isSyncing}
              icon={isSyncing ? undefined : 'sync'}
            />
            
            <Button
              title={testingConnections ? 'Testing...' : 'Test Connections'}
              onPress={testConnections}
              variant="outline"
              disabled={!isOnline || testingConnections}
              icon={testingConnections ? undefined : 'settings-ethernet'}
            />
          </View>

          {/* Test Survey Button */}
          <View style={styles.testSurveySection}>
            <View style={styles.testSurveyHeader}>
              <MaterialIcons name="science" size={20} color={LOWES_THEME.primary} />
              <Text style={styles.testSurveyTitle}>Test Salesforce Integration</Text>
            </View>
            <Text style={styles.testSurveyDescription}>
              Creates a realistic test survey and syncs it to Salesforce immediately to verify your integration is working.
            </Text>
            <Button
              title={creatingTestSurvey ? 'Creating & Syncing...' : 'Create Test Survey'}
              onPress={createTestSurvey}
              backgroundColor="#4CAF50"
              disabled={!isOnline || creatingTestSurvey}
              icon={creatingTestSurvey ? undefined : 'add-circle'}
            />
          </View>

          {isSyncing && (
            <View style={styles.syncProgress}>
              <ActivityIndicator size="small" color={LOWES_THEME.primary} />
              <Text style={styles.syncProgressText}>Syncing {queueSize} items...</Text>
            </View>
          )}
        </View>

        {/* Connection Status */}
        {(connectionStatus.salesforce !== null || connectionStatus.zapier !== null || connectionStatus.adp !== null || connectionStatus.twilio !== null || connectionStatus.sendgrid !== null) && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Integration Status</Text>
            <View style={styles.connectionList}>
              {connectionStatus.salesforce !== null && (
                <View style={styles.connectionItem}>
                  <MaterialIcons
                    name={connectionStatus.salesforce ? 'check-circle' : 'error'}
                    size={24}
                    color={connectionStatus.salesforce ? LOWES_THEME.success : LOWES_THEME.error}
                  />
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionName}>Salesforce</Text>
                    <Text style={styles.connectionDescription}>Lead/Contact sync</Text>
                  </View>
                  <Text style={[
                    styles.connectionStatus,
                    { color: connectionStatus.salesforce ? LOWES_THEME.success : LOWES_THEME.error },
                  ]}>
                    {connectionStatus.salesforce ? '✓ OK' : '✗ Failed'}
                  </Text>
                </View>
              )}

              {connectionStatus.zapier !== null && (
                <View style={styles.connectionItem}>
                  <MaterialIcons
                    name={connectionStatus.zapier ? 'check-circle' : 'error'}
                    size={24}
                    color={connectionStatus.zapier ? LOWES_THEME.success : LOWES_THEME.error}
                  />
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionName}>Zapier</Text>
                    <Text style={styles.connectionDescription}>Appointment webhook</Text>
                  </View>
                  <Text style={[
                    styles.connectionStatus,
                    { color: connectionStatus.zapier ? LOWES_THEME.success : LOWES_THEME.error },
                  ]}>
                    {connectionStatus.zapier ? '✓ OK' : '✗ Failed'}
                  </Text>
                </View>
              )}

              {connectionStatus.adp !== null && (
                <View style={styles.connectionItem}>
                  <MaterialIcons
                    name={connectionStatus.adp ? 'check-circle' : 'error'}
                    size={24}
                    color={connectionStatus.adp ? LOWES_THEME.success : LOWES_THEME.error}
                  />
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionName}>ADP Workforce</Text>
                    <Text style={styles.connectionDescription}>Time & employee sync</Text>
                  </View>
                  <Text style={[
                    styles.connectionStatus,
                    { color: connectionStatus.adp ? LOWES_THEME.success : LOWES_THEME.error },
                  ]}>
                    {connectionStatus.adp ? '✓ OK' : '✗ Failed'}
                  </Text>
                </View>
              )}

              {connectionStatus.twilio !== null && (
                <View style={styles.connectionItem}>
                  <MaterialIcons
                    name={connectionStatus.twilio ? 'check-circle' : 'error'}
                    size={24}
                    color={connectionStatus.twilio ? LOWES_THEME.success : LOWES_THEME.error}
                  />
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionName}>Twilio SMS</Text>
                    <Text style={styles.connectionDescription}>Text message notifications</Text>
                  </View>
                  <Text style={[
                    styles.connectionStatus,
                    { color: connectionStatus.twilio ? LOWES_THEME.success : LOWES_THEME.error },
                  ]}>
                    {connectionStatus.twilio ? '✓ OK' : '✗ Failed'}
                  </Text>
                </View>
              )}

              {connectionStatus.sendgrid !== null && (
                <View style={styles.connectionItem}>
                  <MaterialIcons
                    name={connectionStatus.sendgrid ? 'check-circle' : 'error'}
                    size={24}
                    color={connectionStatus.sendgrid ? LOWES_THEME.success : LOWES_THEME.error}
                  />
                  <View style={styles.connectionInfo}>
                    <Text style={styles.connectionName}>SendGrid Email</Text>
                    <Text style={styles.connectionDescription}>Employee invitations</Text>
                  </View>
                  <Text style={[
                    styles.connectionStatus,
                    { color: connectionStatus.sendgrid ? LOWES_THEME.success : LOWES_THEME.error },
                  ]}>
                    {connectionStatus.sendgrid ? '✓ OK' : '✗ Failed'}
                  </Text>
                </View>
              )}
            </View>
          </View>
        )}

        {/* Recent Sync History */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Recent Sync History</Text>
          {syncLogs.length > 0 ? (
            <View style={styles.logList}>
              {syncLogs.slice(0, 10).map((log, index) => (
                <View key={index} style={styles.logCard}>
                  <View style={styles.logHeader}>
                    <Text style={styles.logTime}>
                      {new Date(log.timestamp).toLocaleString()}
                    </Text>
                    {log.queueSize > 0 && (
                      <View style={styles.queueBadge}>
                        <Text style={styles.queueBadgeText}>{log.queueSize} queued</Text>
                      </View>
                    )}
                  </View>
                  <View style={styles.logStats}>
                    <View style={styles.logStat}>
                      <MaterialIcons name="check" size={16} color={LOWES_THEME.success} />
                      <Text style={styles.logStatText}>{log.synced}</Text>
                    </View>
                    <View style={styles.logStat}>
                      <MaterialIcons name="error" size={16} color={LOWES_THEME.error} />
                      <Text style={styles.logStatText}>{log.failed}</Text>
                    </View>
                    <View style={styles.logStat}>
                      <MaterialIcons name="content-copy" size={16} color="#9C27B0" />
                      <Text style={styles.logStatText}>{log.duplicates}</Text>
                    </View>
                  </View>
                  
                  {/* Detailed Items */}
                  {log.items && log.items.length > 0 && (
                    <View style={styles.logDetails}>
                      {log.items.map((item, idx) => (
                        <View key={idx} style={styles.logDetailItem}>
                          <MaterialIcons
                            name={
                              item.status === 'success' ? 'check-circle' :
                              item.status === 'duplicate' ? 'content-copy' :
                              'error'
                            }
                            size={14}
                            color={
                              item.status === 'success' ? LOWES_THEME.success :
                              item.status === 'duplicate' ? '#9C27B0' :
                              LOWES_THEME.error
                            }
                          />
                          <View style={styles.logDetailInfo}>
                            <Text style={styles.logDetailName} numberOfLines={1}>
                              {item.name}
                            </Text>
                            {item.salesforceId && (
                              <Text style={styles.logDetailSF} numberOfLines={1}>
                                SF: {item.salesforceId}
                              </Text>
                            )}
                            {item.error && (
                              <Text style={styles.logDetailError} numberOfLines={1}>
                                {item.error}
                              </Text>
                            )}
                          </View>
                          <View style={[
                            styles.logDetailBadge,
                            item.type === 'survey' ? styles.surveyBadge : styles.appointmentBadge
                          ]}>
                            <Text style={styles.logDetailBadgeText}>
                              {item.type === 'survey' ? 'Survey' : 'Appt'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="history" size={48} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyText}>No sync history yet</Text>
            </View>
          )}
        </View>

        {/* Failed Items */}
        {failedItems.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Failed Syncs ({failedItems.length})</Text>
              <Pressable onPress={clearFailedItems}>
                <Text style={styles.clearButton}>Clear All</Text>
              </Pressable>
            </View>
            <View style={styles.failedList}>
              {failedItems.slice(0, 5).map((item, index) => (
                <Pressable
                  key={index}
                  style={styles.failedCard}
                  onPress={() => {
                    setSelectedFailedItem(item);
                    setShowFailedItemModal(true);
                  }}
                >
                  <View style={styles.failedHeader}>
                    <MaterialIcons name="error" size={20} color={LOWES_THEME.error} />
                    <Text style={styles.failedType}>{item.type.toUpperCase()}</Text>
                    <Text style={styles.failedTime}>
                      {new Date(item.failedAt).toLocaleString()}
                    </Text>
                  </View>
                  
                  {/* Survey Preview */}
                  {item.type === 'survey' && item.data?.answers?.contact_info && (
                    <View style={styles.surveyPreview}>
                      <Text style={styles.surveyPreviewText}>
                        {item.data.answers.contact_info.firstName} {item.data.answers.contact_info.lastName} • {item.data.answers.contact_info.phone}
                      </Text>
                    </View>
                  )}
                  
                  {/* Error Message */}
                  <View style={styles.errorBox}>
                    <Text style={styles.errorLabel}>ERROR:</Text>
                    <Text style={styles.failedError} numberOfLines={3}>
                      {item.error}
                    </Text>
                  </View>
                  
                  <View style={styles.viewDetailsHint}>
                    <MaterialIcons name="visibility" size={16} color={LOWES_THEME.primary} />
                    <Text style={styles.viewDetailsText}>Tap to view full details</Text>
                  </View>
                </Pressable>
              ))}
            </View>
          </View>
        )}

        {/* Info Box */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={24} color={LOWES_THEME.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>Background Sync Active</Text>
            <Text style={styles.infoText}>
              • Auto-sync runs every 5 minutes when online{'\n'}
              • Surveys sync immediately after completion{'\n'}
              • Failed items retry up to 3 times{'\n'}
              • All data is safe in local storage
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Failed Item Details Modal */}
      <Modal
        visible={showFailedItemModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowFailedItemModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.detailsModal}>
            <View style={styles.detailsHeader}>
              <View style={styles.detailsHeaderTitle}>
                <MaterialIcons name="error" size={24} color={LOWES_THEME.error} />
                <Text style={styles.detailsTitle}>Failed Sync Details</Text>
              </View>
              <Pressable onPress={() => setShowFailedItemModal(false)}>
                <MaterialIcons name="close" size={24} color={LOWES_THEME.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.detailsContent}>
              {selectedFailedItem && (
                <>
                  {/* Error Details */}
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionTitle}>❌ Error Message</Text>
                    <View style={styles.detailsErrorBox}>
                      <Text style={styles.detailsErrorText}>{selectedFailedItem.error}</Text>
                    </View>
                  </View>

                  {/* Metadata */}
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionTitle}>📋 Sync Information</Text>
                    <View style={styles.detailsInfoBox}>
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Type:</Text>
                        <Text style={styles.detailsValue}>{selectedFailedItem.type.toUpperCase()}</Text>
                      </View>
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Failed At:</Text>
                        <Text style={styles.detailsValue}>{new Date(selectedFailedItem.failedAt).toLocaleString()}</Text>
                      </View>
                      <View style={styles.detailsRow}>
                        <Text style={styles.detailsLabel}>Original Timestamp:</Text>
                        <Text style={styles.detailsValue}>{new Date(selectedFailedItem.timestamp).toLocaleString()}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Survey Data */}
                  {selectedFailedItem.type === 'survey' && selectedFailedItem.data && (
                    <>
                      {/* Contact Information */}
                      {selectedFailedItem.data.answers?.contact_info && (
                        <View style={styles.detailsSection}>
                          <Text style={styles.detailsSectionTitle}>👤 Contact Information</Text>
                          <View style={styles.detailsInfoBox}>
                            <View style={styles.detailsRow}>
                              <Text style={styles.detailsLabel}>Name:</Text>
                              <Text style={styles.detailsValue}>
                                {selectedFailedItem.data.answers.contact_info.firstName} {selectedFailedItem.data.answers.contact_info.lastName}
                              </Text>
                            </View>
                            <View style={styles.detailsRow}>
                              <Text style={styles.detailsLabel}>Phone:</Text>
                              <Text style={styles.detailsValue}>{selectedFailedItem.data.answers.contact_info.phone}</Text>
                            </View>
                            <View style={styles.detailsRow}>
                              <Text style={styles.detailsLabel}>Address:</Text>
                              <Text style={styles.detailsValue}>{selectedFailedItem.data.answers.contact_info.address}</Text>
                            </View>
                            <View style={styles.detailsRow}>
                              <Text style={styles.detailsLabel}>City, State:</Text>
                              <Text style={styles.detailsValue}>
                                {selectedFailedItem.data.answers.contact_info.city}, {selectedFailedItem.data.answers.contact_info.state} {selectedFailedItem.data.answers.contact_info.zipCode}
                              </Text>
                            </View>
                          </View>
                        </View>
                      )}

                      {/* Survey Answers */}
                      <View style={styles.detailsSection}>
                        <Text style={styles.detailsSectionTitle}>📝 Survey Answers</Text>
                        <View style={styles.detailsInfoBox}>
                          <View style={styles.detailsRow}>
                            <Text style={styles.detailsLabel}>Store:</Text>
                            <Text style={[styles.detailsValue, styles.detailsStoreBadge, selectedFailedItem.data.store === 'lowes' ? styles.lowesStoreBadge : styles.hdStoreBadge]}>
                              {selectedFailedItem.data.store === 'lowes' ? 'Lowes' : 'Home Depot'}
                            </Text>
                          </View>
                          <View style={styles.detailsRow}>
                            <Text style={styles.detailsLabel}>Category:</Text>
                            <Text style={styles.detailsValue}>{selectedFailedItem.data.category || 'Unknown'}</Text>
                          </View>
                          <View style={styles.detailsRow}>
                            <Text style={styles.detailsLabel}>Employee:</Text>
                            <Text style={styles.detailsValue}>{selectedFailedItem.data.employeeAlias || selectedFailedItem.data.employeeId}</Text>
                          </View>
                          {selectedFailedItem.data.answers && Object.entries(selectedFailedItem.data.answers).map(([key, value]: [string, any]) => {
                            if (key === 'contact_info') return null; // Already shown above
                            return (
                              <View key={key} style={styles.detailsRow}>
                                <Text style={styles.detailsLabel}>{key.replace(/_/g, ' ')}:</Text>
                                <Text style={styles.detailsValue}>{typeof value === 'object' ? JSON.stringify(value) : String(value)}</Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>

                      {/* Sync Status */}
                      <View style={styles.detailsSection}>
                        <Text style={styles.detailsSectionTitle}>🔄 Sync Status</Text>
                        <View style={styles.detailsInfoBox}>
                          <View style={styles.detailsRow}>
                            <Text style={styles.detailsLabel}>Salesforce:</Text>
                            <Text style={[styles.detailsValue, selectedFailedItem.data.syncedToSalesforce ? styles.syncedBadge : styles.notSyncedBadge]}>
                              {selectedFailedItem.data.syncedToSalesforce ? '✓ Synced' : '✗ Not Synced'}
                            </Text>
                          </View>
                          <View style={styles.detailsRow}>
                            <Text style={styles.detailsLabel}>Zapier:</Text>
                            <Text style={[styles.detailsValue, selectedFailedItem.data.syncedToZapier ? styles.syncedBadge : styles.notSyncedBadge]}>
                              {selectedFailedItem.data.syncedToZapier ? '✓ Synced' : '✗ Not Synced'}
                            </Text>
                          </View>
                        </View>
                      </View>
                    </>
                  )}

                  {/* Raw Data (for debugging) */}
                  <View style={styles.detailsSection}>
                    <Text style={styles.detailsSectionTitle}>🔧 Raw Data (Debug)</Text>
                    <View style={styles.rawDataBox}>
                      <ScrollView horizontal>
                        <Text style={styles.rawDataText}>{JSON.stringify(selectedFailedItem.data, null, 2)}</Text>
                      </ScrollView>
                    </View>
                  </View>
                </>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
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
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  headerActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  onlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LOWES_THEME.success,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  offlineBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LOWES_THEME.error,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  statCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statValue: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    textAlign: 'center',
  },
  successCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  successHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  successTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  successRate: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.success,
  },
  progressBar: {
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: LOWES_THEME.success,
  },
  section: {
    gap: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  clearButton: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.error,
  },
  controlsGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  testSurveySection: {
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: '#F0FFF4',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#4CAF50',
    gap: SPACING.md,
  },
  testSurveyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  testSurveyTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  testSurveyDescription: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  syncProgress: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
  },
  syncProgressText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
  },
  connectionList: {
    gap: SPACING.sm,
  },
  connectionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.md,
    borderRadius: 8,
  },
  connectionInfo: {
    flex: 1,
  },
  connectionName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  connectionDescription: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    marginTop: 2,
  },
  connectionStatus: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  logList: {
    gap: SPACING.sm,
  },
  logCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.md,
    borderRadius: 8,
    gap: SPACING.sm,
  },
  logHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  logTime: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  queueBadge: {
    backgroundColor: '#FFF3E0',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  queueBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.warning,
    fontWeight: '600',
  },
  logStats: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  logStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  logStatText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  logDetails: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
    gap: SPACING.xs,
  },
  logDetailItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: 4,
  },
  logDetailInfo: {
    flex: 1,
    gap: 2,
  },
  logDetailName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  logDetailSF: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.primary,
    fontFamily: 'monospace',
  },
  logDetailError: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.error,
  },
  logDetailBadge: {
    paddingHorizontal: SPACING.xs,
    paddingVertical: 2,
    borderRadius: 4,
  },
  logDetailBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  surveyBadge: {
    backgroundColor: LOWES_THEME.primary,
  },
  appointmentBadge: {
    backgroundColor: '#FF6B35',
  },
  failedList: {
    gap: SPACING.sm,
  },
  failedCard: {
    backgroundColor: '#FFEBEE',
    padding: SPACING.md,
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.error,
    gap: SPACING.sm,
  },
  failedHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  failedType: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: LOWES_THEME.error,
  },
  failedTime: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  failedError: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.text,
    lineHeight: 16,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
  },
  infoBox: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LOWES_THEME.primary,
  },
  infoContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  infoTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  surveyPreview: {
    marginTop: SPACING.xs,
    padding: SPACING.sm,
    backgroundColor: '#F5F5F5',
    borderRadius: 6,
  },
  surveyPreviewText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  errorBox: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: '#FFF5F5',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: LOWES_THEME.error,
  },
  errorLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: LOWES_THEME.error,
    marginBottom: 4,
  },
  viewDetailsHint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: SPACING.sm,
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
  },
  viewDetailsText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.primary,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  detailsModal: {
    width: '100%',
    maxWidth: 600,
    maxHeight: '90%',
    backgroundColor: LOWES_THEME.background,
    borderRadius: 16,
    overflow: 'hidden',
  },
  detailsHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: LOWES_THEME.surface,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  detailsHeaderTitle: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  detailsTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  detailsContent: {
    flex: 1,
    padding: SPACING.lg,
  },
  detailsSection: {
    marginBottom: SPACING.xl,
  },
  detailsSectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
    marginBottom: SPACING.md,
  },
  detailsErrorBox: {
    padding: SPACING.lg,
    backgroundColor: '#FFEBEE',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.error,
  },
  detailsErrorText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
    lineHeight: 22,
    fontFamily: 'monospace',
  },
  detailsInfoBox: {
    padding: SPACING.lg,
    backgroundColor: LOWES_THEME.surface,
    borderRadius: 8,
    gap: SPACING.md,
  },
  detailsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: SPACING.md,
  },
  detailsLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
    textTransform: 'uppercase',
    minWidth: 120,
  },
  detailsValue: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
    textAlign: 'right',
  },
  detailsStoreBadge: {
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 6,
    overflow: 'hidden',
    fontWeight: '700',
    color: '#FFFFFF',
  },
  lowesStoreBadge: {
    backgroundColor: LOWES_THEME.primary,
  },
  hdStoreBadge: {
    backgroundColor: '#FF6B35',
  },
  syncedBadge: {
    color: LOWES_THEME.success,
    fontWeight: '700',
  },
  notSyncedBadge: {
    color: LOWES_THEME.error,
    fontWeight: '700',
  },
  rawDataBox: {
    padding: SPACING.md,
    backgroundColor: '#1E1E1E',
    borderRadius: 8,
  },
  rawDataText: {
    fontSize: FONTS.sizes.xs,
    color: '#00FF00',
    fontFamily: 'monospace',
    lineHeight: 18,
  },
});
