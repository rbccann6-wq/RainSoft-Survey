// Duplicate survey management with enhanced Salesforce integration
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, Linking, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import * as StorageService from '@/services/storageService';
import * as SyncService from '@/services/syncService';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME, HOME_DEPOT_THEME } from '@/constants/theme';
import { Survey } from '@/types';

export default function DuplicatesScreen() {
  const { surveys, loadData } = useApp();
  const { showAlert } = useAlert();
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const duplicateSurveys = surveys.filter(s => s.isDuplicate && !s.duplicateReviewed);
  const reviewedDuplicates = surveys.filter(s => s.isDuplicate && s.duplicateReviewed);

  const handleArchive = async (surveyId: string) => {
    showAlert('Archive Survey', 'Mark this duplicate as reviewed and archive it?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Archive',
        onPress: async () => {
          setLoading(true);
          const result = await SyncService.archiveDuplicateSurvey(surveyId);
          setLoading(false);
          
          if (result.success) {
            await loadData();
            setShowComparisonModal(false);
            showAlert('Archived', 'Duplicate survey has been archived');
          } else {
            showAlert('Error', result.error || 'Failed to archive survey');
          }
        },
      },
    ]);
  };

  const handleDeleteLeadAndResync = async (survey: Survey) => {
    if (!survey.duplicateInfo || survey.duplicateInfo.recordType !== 'Lead') {
      showAlert('Error', 'Can only delete Lead records. This is an Account.');
      return;
    }

    showAlert(
      'Delete Lead & Re-sync',
      `This will:\n1. Delete the existing Lead in Salesforce\n2. Create a new Lead with updated survey data\n\nAre you sure?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Delete & Re-sync',
          style: 'destructive',
          onPress: async () => {
            setLoading(true);
            
            // Step 1: Delete the Lead in Salesforce
            const deleteResult = await SyncService.deleteSalesforceRecord(
              survey.duplicateInfo!.salesforceId,
              'Lead'
            );
            
            if (!deleteResult.success) {
              setLoading(false);
              showAlert('Error', `Failed to delete Lead: ${deleteResult.error}`);
              return;
            }
            
            // Step 2: Re-sync the survey
            const resyncResult = await SyncService.resyncSurveyAfterDelete(survey.id);
            setLoading(false);
            
            if (resyncResult.success) {
              await loadData();
              setShowComparisonModal(false);
              showAlert('Success', 'Lead deleted and survey re-synced to Salesforce');
            } else {
              showAlert('Error', `Re-sync failed: ${resyncResult.error}`);
            }
          },
        },
      ]
    );
  };

  const handleViewInSalesforce = (survey: Survey) => {
    if (survey.duplicateInfo?.salesforceUrl) {
      Linking.openURL(survey.duplicateInfo.salesforceUrl).catch(() => {
        showAlert('Error', 'Could not open Salesforce. Please check your internet connection.');
      });
    }
  };

  const handleDelete = async (surveyId: string) => {
    showAlert('Delete Survey', 'Permanently delete this survey? This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await StorageService.deleteSurvey(surveyId);
          await loadData();
          setShowComparisonModal(false);
          showAlert('Deleted', 'Survey has been permanently deleted');
        },
      },
    ]);
  };

  const viewDetails = (survey: Survey) => {
    setSelectedSurvey(survey);
    setShowComparisonModal(true);
  };

  const theme = selectedSurvey?.store === 'lowes' ? LOWES_THEME : HOME_DEPOT_THEME;

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Duplicate Surveys</Text>
        <View style={styles.headerBadge}>
          <MaterialIcons name="warning" size={20} color={LOWES_THEME.warning} />
          <Text style={styles.badgeText}>{duplicateSurveys.length} pending</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Box */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={24} color={LOWES_THEME.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>What are duplicates?</Text>
            <Text style={styles.infoText}>
              Surveys flagged as duplicates already exist in Salesforce as Leads or Accounts with the same phone number. Review them to decide whether to delete the old Lead and re-sync, or archive the new survey.
            </Text>
          </View>
        </View>

        {/* Pending Review */}
        {duplicateSurveys.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Review ({duplicateSurveys.length})</Text>
            <View style={styles.surveyList}>
              {duplicateSurveys.map((survey) => (
                <View key={survey.id} style={styles.surveyCard}>
                  <View style={[
                    styles.storeIndicator,
                    { backgroundColor: survey.store === 'lowes' ? LOWES_THEME.primary : HOME_DEPOT_THEME.primary },
                  ]} />
                  
                  <View style={styles.surveyInfo}>
                    <View style={styles.surveyHeader}>
                      <Text style={styles.surveyName}>
                        {survey.answers.contact_info?.firstName} {survey.answers.contact_info?.lastName}
                      </Text>
                      <View style={styles.duplicateBadge}>
                        <MaterialIcons name="warning" size={16} color={LOWES_THEME.warning} />
                        <Text style={styles.duplicateBadgeText}>
                          {survey.duplicateInfo?.recordType || 'Duplicate'}
                        </Text>
                      </View>
                    </View>
                    
                    <Text style={styles.surveyPhone}>📞 {survey.answers.phone}</Text>
                    
                    {survey.duplicateInfo && (
                      <View style={styles.salesforceInfo}>
                        <MaterialIcons name="cloud" size={14} color={LOWES_THEME.textSubtle} />
                        <Text style={styles.salesforceText}>
                          {survey.duplicateInfo.recordName || 'Salesforce Record'}
                        </Text>
                      </View>
                    )}
                    
                    <Text style={styles.surveyDate}>
                      {new Date(survey.timestamp).toLocaleString()}
                    </Text>
                    
                    <View style={styles.storeBadge}>
                      <Text style={styles.storeText}>
                        {survey.store === 'lowes' ? 'Lowes' : 'Home Depot'}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.surveyActions}>
                    <Button
                      title="Review"
                      onPress={() => viewDetails(survey)}
                      backgroundColor={LOWES_THEME.primary}
                      size="small"
                    />
                  </View>
                </View>
              ))}
            </View>
          </View>
        ) : (
          <View style={styles.emptyState}>
            <MaterialIcons name="check-circle" size={64} color={LOWES_THEME.success} />
            <Text style={styles.emptyTitle}>All Clear!</Text>
            <Text style={styles.emptyText}>No duplicate surveys pending review</Text>
          </View>
        )}

        {/* Reviewed Archives */}
        {reviewedDuplicates.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Reviewed Archives ({reviewedDuplicates.length})</Text>
            <View style={styles.archiveList}>
              {reviewedDuplicates.slice(0, 10).map((survey) => (
                <View key={survey.id} style={styles.archiveCard}>
                  <MaterialIcons name="archive" size={20} color={LOWES_THEME.textSubtle} />
                  <View style={styles.archiveInfo}>
                    <Text style={styles.archiveName}>
                      {survey.answers.contact_info?.firstName} {survey.answers.contact_info?.lastName}
                    </Text>
                    <Text style={styles.archivePhone}>{survey.answers.phone}</Text>
                  </View>
                  <Text style={styles.archiveDate}>
                    {new Date(survey.timestamp).toLocaleDateString()}
                  </Text>
                </View>
              ))}
            </View>
          </View>
        )}
      </ScrollView>

      {/* Enhanced Review Modal */}
      <Modal
        visible={showComparisonModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowComparisonModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Review Duplicate</Text>
              <Pressable onPress={() => setShowComparisonModal(false)}>
                <MaterialIcons name="close" size={24} color={LOWES_THEME.text} />
              </Pressable>
            </View>

            {selectedSurvey && (
              <ScrollView style={styles.modalBody}>
                {/* Warning Banner */}
                <View style={styles.warningBanner}>
                  <MaterialIcons name="warning" size={24} color={LOWES_THEME.warning} />
                  <View style={styles.warningContent}>
                    <Text style={styles.warningTitle}>
                      {selectedSurvey.duplicateInfo?.recordType || 'Duplicate'} Detected
                    </Text>
                    <Text style={styles.warningText}>
                      A {selectedSurvey.duplicateInfo?.recordType?.toLowerCase() || 'record'} with phone number {selectedSurvey.answers.phone} already exists in Salesforce
                    </Text>
                  </View>
                </View>

                {/* Existing Salesforce Record */}
                {selectedSurvey.duplicateInfo && (
                  <View style={styles.salesforceCard}>
                    <View style={styles.salesforceHeader}>
                      <MaterialIcons name="cloud" size={24} color={LOWES_THEME.primary} />
                      <Text style={styles.salesforceHeaderTitle}>Existing Salesforce Record</Text>
                    </View>
                    
                    <View style={styles.salesforceDetails}>
                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Record Type</Text>
                        <View style={[
                          styles.recordTypeBadge,
                          { backgroundColor: selectedSurvey.duplicateInfo.recordType === 'Lead' ? '#E3F2FD' : '#F3E5F5' }
                        ]}>
                          <Text style={[
                            styles.recordTypeText,
                            { color: selectedSurvey.duplicateInfo.recordType === 'Lead' ? '#1976D2' : '#7B1FA2' }
                          ]}>
                            {selectedSurvey.duplicateInfo.recordType}
                          </Text>
                        </View>
                      </View>

                      {selectedSurvey.duplicateInfo.recordName && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Name</Text>
                          <Text style={styles.detailValue}>{selectedSurvey.duplicateInfo.recordName}</Text>
                        </View>
                      )}

                      {selectedSurvey.duplicateInfo.recordEmail && (
                        <View style={styles.detailRow}>
                          <Text style={styles.detailLabel}>Email</Text>
                          <Text style={styles.detailValue}>{selectedSurvey.duplicateInfo.recordEmail}</Text>
                        </View>
                      )}

                      <View style={styles.detailRow}>
                        <Text style={styles.detailLabel}>Phone</Text>
                        <Text style={styles.detailValue}>{selectedSurvey.duplicateInfo.matchedPhone}</Text>
                      </View>

                      <Button
                        title="View in Salesforce"
                        onPress={() => handleViewInSalesforce(selectedSurvey)}
                        backgroundColor={LOWES_THEME.primary}
                        icon={<MaterialIcons name="open-in-new" size={18} color="#FFF" />}
                        fullWidth
                      />
                    </View>
                  </View>
                )}

                {/* New Survey Details */}
                <View style={styles.detailsCard}>
                  <View style={styles.cardHeader}>
                    <MaterialIcons name="assignment" size={20} color={LOWES_THEME.text} />
                    <Text style={styles.cardHeaderTitle}>New Survey Details</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Customer</Text>
                    <Text style={styles.detailValue}>
                      {selectedSurvey.answers.contact_info?.firstName} {selectedSurvey.answers.contact_info?.lastName}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Phone</Text>
                    <Text style={styles.detailValue}>{selectedSurvey.answers.phone}</Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Store</Text>
                    <Text style={styles.detailValue}>
                      {selectedSurvey.store === 'lowes' ? 'Lowes' : 'Home Depot'}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Date</Text>
                    <Text style={styles.detailValue}>
                      {new Date(selectedSurvey.timestamp).toLocaleString()}
                    </Text>
                  </View>

                  <View style={styles.detailRow}>
                    <Text style={styles.detailLabel}>Address</Text>
                    <Text style={styles.detailValue}>
                      {selectedSurvey.answers.contact_info?.address}, {selectedSurvey.answers.contact_info?.city}, {selectedSurvey.answers.contact_info?.state} {selectedSurvey.answers.contact_info?.zipCode}
                    </Text>
                  </View>
                </View>

                {/* Survey Answers */}
                <View style={styles.answersCard}>
                  <Text style={styles.answersTitle}>Survey Responses</Text>
                  
                  <View style={styles.answerRow}>
                    <MaterialIcons 
                      name={selectedSurvey.answers.buys_bottled_water === 'yes' ? 'check-circle' : 'cancel'}
                      size={20}
                      color={selectedSurvey.answers.buys_bottled_water === 'yes' ? LOWES_THEME.success : LOWES_THEME.error}
                    />
                    <Text style={styles.answerText}>Buys bottled water</Text>
                  </View>

                  <View style={styles.answerRow}>
                    <MaterialIcons 
                      name={selectedSurvey.answers.is_homeowner === 'yes' ? 'check-circle' : 'cancel'}
                      size={20}
                      color={selectedSurvey.answers.is_homeowner === 'yes' ? LOWES_THEME.success : LOWES_THEME.error}
                    />
                    <Text style={styles.answerText}>Homeowner</Text>
                  </View>

                  <View style={styles.answerRow}>
                    <MaterialIcons name="water-drop" size={20} color={LOWES_THEME.primary} />
                    <Text style={styles.answerText}>Water quality: {selectedSurvey.answers.water_quality}</Text>
                  </View>

                  <View style={styles.answerRow}>
                    <MaterialIcons name="home" size={20} color={LOWES_THEME.primary} />
                    <Text style={styles.answerText}>Property: {selectedSurvey.answers.property_type}</Text>
                  </View>

                  <View style={styles.answerRow}>
                    <MaterialIcons name="location-on" size={20} color={LOWES_THEME.primary} />
                    <Text style={styles.answerText}>Water source: {selectedSurvey.answers.water_source}</Text>
                  </View>
                </View>

                {/* Actions */}
                <View style={styles.actionButtons}>
                  {selectedSurvey.duplicateInfo?.recordType === 'Lead' && (
                    <Button
                      title={loading ? 'Processing...' : 'Delete Lead & Re-sync Survey'}
                      onPress={() => handleDeleteLeadAndResync(selectedSurvey)}
                      backgroundColor="#D32F2F"
                      icon={loading ? <ActivityIndicator color="#FFF" size="small" /> : <MaterialIcons name="sync" size={20} color="#FFF" />}
                      fullWidth
                      disabled={loading}
                    />
                  )}
                  
                  {selectedSurvey.duplicateInfo?.recordType === 'Account' && (
                    <View style={styles.accountWarning}>
                      <MaterialIcons name="info" size={20} color={LOWES_THEME.primary} />
                      <Text style={styles.accountWarningText}>
                        This is an Account record. Accounts cannot be deleted automatically. Please review in Salesforce.
                      </Text>
                    </View>
                  )}
                  
                  <Button
                    title="Ignore & Archive"
                    onPress={() => handleArchive(selectedSurvey.id)}
                    backgroundColor={LOWES_THEME.success}
                    icon={<MaterialIcons name="archive" size={20} color="#FFF" />}
                    fullWidth
                    disabled={loading}
                  />
                  
                  <Button
                    title="Delete Survey"
                    onPress={() => handleDelete(selectedSurvey.id)}
                    variant="danger"
                    fullWidth
                    disabled={loading}
                  />
                </View>

                <View style={styles.helpBox}>
                  <MaterialIcons name="help-outline" size={20} color={LOWES_THEME.primary} />
                  <View style={styles.helpContent}>
                    <Text style={styles.helpTitle}>What should I do?</Text>
                    <Text style={styles.helpText}>
                      • <Text style={styles.helpBold}>Delete Lead & Re-sync:</Text> Removes old Lead, creates new one with updated data{'\n'}
                      • <Text style={styles.helpBold}>Ignore & Archive:</Text> Keeps existing record, archives this survey{'\n'}
                      • <Text style={styles.helpBold}>Delete Survey:</Text> Permanently removes this survey
                    </Text>
                  </View>
                </View>
              </ScrollView>
            )}
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
  headerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 12,
  },
  badgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: LOWES_THEME.warning,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
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
  section: {
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  surveyList: {
    gap: SPACING.md,
  },
  surveyCard: {
    flexDirection: 'row',
    backgroundColor: LOWES_THEME.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  storeIndicator: {
    width: 4,
  },
  surveyInfo: {
    flex: 1,
    padding: SPACING.lg,
    gap: SPACING.xs,
  },
  surveyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  surveyName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
    flex: 1,
  },
  duplicateBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#FFF3E0',
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
  },
  duplicateBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: LOWES_THEME.warning,
  },
  surveyPhone: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  salesforceInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  salesforceText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    fontStyle: 'italic',
  },
  surveyDate: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  storeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: '#F5F5F5',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
    marginTop: SPACING.xs,
  },
  storeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  surveyActions: {
    justifyContent: 'center',
    paddingRight: SPACING.md,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
    gap: SPACING.md,
  },
  emptyTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
  },
  archiveList: {
    gap: SPACING.sm,
  },
  archiveCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.md,
    borderRadius: 8,
  },
  archiveInfo: {
    flex: 1,
  },
  archiveName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: LOWES_THEME.text,
  },
  archivePhone: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  archiveDate: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: LOWES_THEME.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '90%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  modalTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  modalBody: {
    padding: SPACING.lg,
  },
  warningBanner: {
    flexDirection: 'row',
    gap: SPACING.md,
    backgroundColor: '#FFF3E0',
    padding: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.lg,
  },
  warningContent: {
    flex: 1,
    gap: 4,
  },
  warningTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.warning,
  },
  warningText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 18,
  },
  salesforceCard: {
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    padding: SPACING.lg,
    marginBottom: SPACING.lg,
    borderWidth: 1,
    borderColor: LOWES_THEME.primary,
  },
  salesforceHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  salesforceHeaderTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  salesforceDetails: {
    gap: SPACING.md,
  },
  recordTypeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    borderRadius: 8,
  },
  recordTypeText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  detailsCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginBottom: SPACING.sm,
  },
  cardHeaderTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  detailRow: {
    gap: 4,
  },
  detailLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  detailValue: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
  },
  answersCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  answersTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
    marginBottom: SPACING.sm,
  },
  answerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  answerText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
  },
  actionButtons: {
    gap: SPACING.md,
    marginBottom: SPACING.lg,
  },
  accountWarning: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: '#F0F7FF',
    padding: SPACING.md,
    borderRadius: 8,
  },
  accountWarningText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 18,
  },
  helpBox: {
    flexDirection: 'row',
    gap: SPACING.md,
    backgroundColor: '#F0F7FF',
    padding: SPACING.lg,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LOWES_THEME.primary,
  },
  helpContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  helpTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  helpText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  helpBold: {
    fontWeight: '700',
  },
});
