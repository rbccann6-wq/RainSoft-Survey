// Duplicate survey management
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import * as StorageService from '@/services/storageService';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME, HOME_DEPOT_THEME } from '@/constants/theme';
import { Survey } from '@/types';

export default function DuplicatesScreen() {
  const { surveys, loadData } = useApp();
  const { showAlert } = useAlert();
  const [selectedSurvey, setSelectedSurvey] = useState<Survey | null>(null);
  const [showComparisonModal, setShowComparisonModal] = useState(false);

  const duplicateSurveys = surveys.filter(s => s.isDuplicate && !s.duplicateReviewed);
  const reviewedDuplicates = surveys.filter(s => s.isDuplicate && s.duplicateReviewed);

  const handleMarkAsReviewed = async (surveyId: string) => {
    await StorageService.markSurveyAsReviewed(surveyId);
    await loadData();
    setShowComparisonModal(false);
    showAlert('Marked as Reviewed', 'Duplicate has been reviewed and archived');
  };

  const handleDelete = async (surveyId: string) => {
    showAlert('Delete Survey', 'Are you sure you want to delete this duplicate survey?', [
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
              Surveys flagged as duplicates already exist in Salesforce with the same phone number. Review them to decide whether to keep or delete.
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
                      <MaterialIcons name="warning" size={20} color={LOWES_THEME.warning} />
                    </View>
                    
                    <Text style={styles.surveyPhone}>📞 {survey.answers.phone}</Text>
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

      {/* Comparison Modal */}
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
                    <Text style={styles.warningTitle}>Duplicate Detected</Text>
                    <Text style={styles.warningText}>
                      A lead with phone number {selectedSurvey.answers.phone} already exists in Salesforce
                    </Text>
                  </View>
                </View>

                {/* Survey Details */}
                <View style={styles.detailsCard}>
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
                  <Button
                    title="Mark as Reviewed"
                    onPress={() => handleMarkAsReviewed(selectedSurvey.id)}
                    backgroundColor={LOWES_THEME.success}
                    fullWidth
                  />
                  
                  <Button
                    title="Delete Survey"
                    onPress={() => handleDelete(selectedSurvey.id)}
                    variant="danger"
                    fullWidth
                  />
                </View>

                <View style={styles.infoBox}>
                  <MaterialIcons name="lightbulb" size={20} color={LOWES_THEME.primary} />
                  <Text style={styles.infoBoxText}>
                    "Mark as Reviewed" keeps the survey in archives. "Delete" removes it permanently.
                  </Text>
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
  },
  surveyPhone: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
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
  detailsCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
    marginBottom: SPACING.lg,
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
  infoBoxText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 18,
  },
});
