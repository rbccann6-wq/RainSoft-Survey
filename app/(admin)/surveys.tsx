// Admin surveys view with tabs: Surveys, Appointments, Renters, Duplicates
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import * as StorageService from '@/services/storageService';
import * as SyncService from '@/services/syncService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { formatFullDateTime } from '@/utils/timeFormat';
import { verifySalesforceRecord, isOnline } from '@/services/syncService';
import { Survey } from '@/types';

export default function SurveysScreen() {
  const { surveys, loadData } = useApp();
  const { showAlert } = useAlert();
  const [activeTab, setActiveTab] = useState<'surveys' | 'appointments' | 'renters' | 'duplicates'>('surveys');
  const [searchQuery, setSearchQuery] = useState('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);
  const [editingSurvey, setEditingSurvey] = useState<Survey | null>(null);
  const [showEditModal, setShowEditModal] = useState(false);
  const [syncingId, setSyncingId] = useState<string | null>(null);

  // Filter surveys by category and search
  const filterSurveysBySearch = (surveyList: Survey[]) => {
    if (!searchQuery.trim()) return surveyList;
    
    const query = searchQuery.toLowerCase();
    return surveyList.filter(s => {
      const firstName = s.answers.contact_info?.firstName?.toLowerCase() || '';
      const lastName = s.answers.contact_info?.lastName?.toLowerCase() || '';
      const fullName = `${firstName} ${lastName}`.trim();
      const phone = s.answers.contact_info?.phone?.replace(/\D/g, '') || '';
      const searchPhone = query.replace(/\D/g, '');
      
      return fullName.includes(query) || phone.includes(searchPhone);
    });
  };
  
  const duplicates = surveys.filter(s => s.isDuplicate && !s.duplicateReviewed);
  const surveysOnly = filterSurveysBySearch(surveys.filter(s => s.category === 'survey' && (!s.isDuplicate || s.duplicateReviewed)));
  const appointmentsOnly = filterSurveysBySearch(surveys.filter(s => s.category === 'appointment' && (!s.isDuplicate || s.duplicateReviewed)));
  const rentersOnly = filterSurveysBySearch(surveys.filter(s => s.category === 'renter' && (!s.isDuplicate || s.duplicateReviewed)));

  const handleDeleteDuplicate = (surveyId: string) => {
    showAlert('Delete Survey', 'Are you sure you want to delete this duplicate?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await StorageService.deleteSurvey(surveyId);
          await loadData();
        },
      },
    ]);
  };

  const handleReupload = async (surveyId: string) => {
    await StorageService.markSurveyAsReviewed(surveyId);
    await loadData();
    showAlert('Survey Uploaded', 'Survey has been marked for re-upload');
  };

  // Format phone number to (999) 999-9999
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return '';
    const digits = phone.replace(/\D/g, '');
    if (digits.length !== 10) return phone;
    return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
  };

  const handleEditSurvey = (survey: Survey) => {
    const surveyCopy = JSON.parse(JSON.stringify(survey));
    if (surveyCopy.answers.contact_info?.phone) {
      const formatted = formatPhoneNumber(surveyCopy.answers.contact_info.phone);
      surveyCopy.answers.contact_info.phone = formatted;
      surveyCopy.answers.phone = formatted;
    }
    setEditingSurvey(surveyCopy);
    setShowEditModal(true);
  };

  const handleSaveEdit = async () => {
    if (!editingSurvey) return;

    const allSurveys = await StorageService.getSurveys() || [];
    const surveyIndex = allSurveys.findIndex(s => s.id === editingSurvey.id);
    
    if (surveyIndex !== -1) {
      allSurveys[surveyIndex] = {
        ...editingSurvey,
        syncError: undefined,
        syncedToSalesforce: false,
        syncedToZapier: editingSurvey.category === 'appointment' ? false : allSurveys[surveyIndex].syncedToZapier,
      };
      await StorageService.saveSurveys(allSurveys);
      await loadData();
      setShowEditModal(false);
      setEditingSurvey(null);
      showAlert('Saved', 'Survey updated successfully. Use "Retry Sync" to sync the corrected data.');
    }
  };

  const handleRetrySync = async (survey: Survey) => {
    const online = await isOnline();
    if (!online) {
      showAlert('Offline', 'Cannot sync while offline. Connect to internet and try again.');
      return;
    }

    setSyncingId(survey.id);
    try {
      const queue = await StorageService.getSyncQueue() || [];
      
      // Remove any existing queue items for this survey
      const filteredQueue = queue.filter(item => 
        item.data.id !== survey.id && 
        (item.type !== 'appointment' || item.data.survey?.id !== survey.id)
      );
      
      // For appointments: sync to both Salesforce (survey) AND Zapier (appointment)
      if (survey.category === 'appointment' && survey.appointment) {
        if (survey.syncedToSalesforce === false) {
          filteredQueue.push({
            type: 'survey',
            data: survey,
            timestamp: new Date().toISOString(),
          });
        }
        if (survey.syncedToZapier === false) {
          filteredQueue.push({
            type: 'appointment',
            data: { survey, appointment: survey.appointment },
            timestamp: new Date().toISOString(),
          });
        }
      } else {
        // Regular surveys only sync to Salesforce
        filteredQueue.push({
          type: 'survey',
          data: survey,
          timestamp: new Date().toISOString(),
        });
      }
      
      await StorageService.saveData('sync_queue', filteredQueue);
      const result = await SyncService.triggerImmediateSync();
      await loadData();
      
      if (result.synced > 0) {
        const syncType = survey.category === 'appointment' ? 'Salesforce and Zapier' : 'Salesforce';
        showAlert('Sync Successful ✓', `Survey synced to ${syncType} successfully!`);
      } else if (result.failed > 0) {
        const updatedSurveys = await StorageService.getSurveys() || [];
        const syncedSurvey = updatedSurveys.find(s => s.id === survey.id);
        const errorMsg = syncedSurvey?.syncError || 'Unknown error';
        showAlert('Sync Failed', `Failed to sync survey:\n\n${errorMsg}`);
      } else if (result.duplicates > 0) {
        showAlert('Duplicate Detected', 'This survey already exists in Salesforce.');
      }
    } catch (error) {
      showAlert('Error', `Failed to retry sync: ${String(error)}`);
    } finally {
      setSyncingId(null);
    }
  };

  const handleVerifySalesforce = async (survey: Survey) => {
    const online = await isOnline();
    if (!online) {
      showAlert('Offline', 'Cannot verify Salesforce records while offline.');
      return;
    }

    if (!survey.salesforceId) {
      showAlert(
        'No Record ID Stored',
        'This survey was synced before the update that captures Salesforce IDs.\n\nTo verify, you would need to manually search Salesforce by phone number: ' + 
        (survey.answers.contact_info?.phone || 'N/A')
      );
      return;
    }

    setVerifyingId(survey.id);
    const result = await verifySalesforceRecord(survey.salesforceId);
    setVerifyingId(null);

    if (result.exists) {
      const allSurveys = await StorageService.getSurveys() || [];
      const surveyIndex = allSurveys.findIndex(s => s.id === survey.id);
      if (surveyIndex !== -1) {
        allSurveys[surveyIndex].salesforceVerified = true;
        allSurveys[surveyIndex].salesforceVerifiedAt = new Date().toISOString();
        await StorageService.saveSurveys(allSurveys);
        await loadData();
      }

      showAlert(
        'Record Verified ✓',
        `Salesforce record ${survey.salesforceId} exists and is accessible.\n\nView in Salesforce:\n${result.recordUrl}`,
        [{ text: 'OK' }]
      );
    } else {
      showAlert(
        'Verification Failed',
        `${result.error || 'Record not found'}\n\nRecord ID: ${survey.salesforceId}\n\nThis survey may not have actually synced to Salesforce.`
      );
    }
  };

  // Render survey card
  const renderSurveyCard = (survey: Survey) => {
    const getSyncBadgeStyle = (synced: boolean | undefined) => {
      if (synced === true) return { bg: '#E8F5E9', color: '#4CAF50', icon: 'check-circle' as const };
      if (synced === false) return { bg: '#FFEBEE', color: '#F44336', icon: 'error' as const };
      return { bg: '#FFF3E0', color: '#FF9800', icon: 'pending' as const };
    };

    const salesforceBadge = getSyncBadgeStyle(survey.syncedToSalesforce);
    const zapierBadge = getSyncBadgeStyle(survey.syncedToZapier);

    const customerName = survey.answers.contact_info 
      ? `${survey.answers.contact_info.firstName || ''} ${survey.answers.contact_info.lastName || ''}`.trim() 
      : 'Unknown';
    const customerPhone = survey.answers.contact_info?.phone || 'No phone';
    const employeeAlias = survey.employeeAlias || 'N/A';

    return (
      <View key={survey.id} style={styles.surveyCard}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.surveyName}>{customerName}</Text>
            <View style={styles.aliasBadge}>
              <MaterialIcons name="person" size={12} color={LOWES_THEME.primary} />
              <Text style={styles.aliasText}>{employeeAlias}</Text>
            </View>
          </View>
          <View style={[
            styles.categoryBadge,
            { backgroundColor: survey.category === 'appointment' ? LOWES_THEME.success : LOWES_THEME.primary },
          ]}>
            <Text style={styles.categoryText}>{survey.category}</Text>
          </View>
        </View>
        
        <View style={styles.contactRow}>
          <MaterialIcons name="phone" size={16} color={LOWES_THEME.textSubtle} />
          <Text style={styles.surveyPhone}>{customerPhone}</Text>
        </View>
        
        <View style={styles.contactRow}>
          <MaterialIcons name="schedule" size={16} color={LOWES_THEME.textSubtle} />
          <Text style={styles.surveyDate}>{formatFullDateTime(survey.timestamp)}</Text>
        </View>

        <View style={styles.syncStatusSection}>
          <Text style={styles.syncStatusLabel}>Sync Status:</Text>
          <View style={styles.syncBadges}>
            <View style={[styles.syncBadge, { backgroundColor: salesforceBadge.bg }]}>
              <MaterialIcons name={salesforceBadge.icon} size={14} color={salesforceBadge.color} />
              <Text style={[styles.syncBadgeText, { color: salesforceBadge.color }]}>
                SF: {survey.syncedToSalesforce === true ? 'Synced' : survey.syncedToSalesforce === false ? 'Failed' : 'Pending'}
              </Text>
            </View>

            <View style={[styles.syncBadge, { backgroundColor: zapierBadge.bg }]}>
              <MaterialIcons name={zapierBadge.icon} size={14} color={zapierBadge.color} />
              <Text style={[styles.syncBadgeText, { color: zapierBadge.color }]}>
                Zapier: {survey.syncedToZapier === true ? 'Synced' : survey.syncedToZapier === false ? 'Failed' : 'Pending'}
              </Text>
            </View>
          </View>
        </View>

        {survey.syncedToSalesforce && (
          <View style={styles.salesforceIdSection}>
            <View style={styles.salesforceIdRow}>
              <View style={styles.salesforceIdInfo}>
                {survey.salesforceId ? (
                  <>
                    <Text style={styles.salesforceIdLabel}>Salesforce ID:</Text>
                    <Text style={styles.salesforceIdValue}>{survey.salesforceId}</Text>
                    {survey.salesforceVerified && (
                      <View style={styles.verifiedBadge}>
                        <MaterialIcons name="verified" size={12} color="#4CAF50" />
                        <Text style={styles.verifiedText}>Verified</Text>
                      </View>
                    )}
                  </>
                ) : (
                  <>
                    <Text style={styles.salesforceIdLabel}>Salesforce ID:</Text>
                    <Text style={styles.noIdText}>No ID stored (old sync)</Text>
                    <Text style={styles.phoneHint}>Phone: {survey.answers.contact_info?.phone || 'N/A'}</Text>
                  </>
                )}
              </View>
              <Pressable
                onPress={() => handleVerifySalesforce(survey)}
                disabled={verifyingId === survey.id}
                style={[styles.verifyButton, verifyingId === survey.id && styles.verifyButtonDisabled]}
              >
                <MaterialIcons 
                  name={verifyingId === survey.id ? "hourglass-empty" : "search"} 
                  size={16} 
                  color={verifyingId === survey.id ? "#999" : LOWES_THEME.primary} 
                />
                <Text style={[styles.verifyButtonText, verifyingId === survey.id && styles.verifyButtonTextDisabled]}>
                  {verifyingId === survey.id ? 'Checking...' : 'Verify'}
                </Text>
              </Pressable>
            </View>
          </View>
        )}

        {(survey.syncError || survey.syncedToSalesforce === false || survey.syncedToZapier === false) && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="warning" size={16} color="#F44336" />
            <Text style={styles.errorText}>
              {survey.syncError || 'Sync failed - tap Retry Sync to try again'}
            </Text>
          </View>
        )}

        <View style={styles.surveyActions}>
          <Pressable onPress={() => handleEditSurvey(survey)} style={styles.actionButton}>
            <MaterialIcons name="edit" size={18} color={LOWES_THEME.primary} />
            <Text style={styles.actionButtonText}>Edit</Text>
          </Pressable>
          
          {(survey.syncedToSalesforce === false || survey.syncedToZapier === false) && (
            <Pressable
              onPress={() => handleRetrySync(survey)}
              disabled={syncingId === survey.id}
              style={[styles.actionButton, syncingId === survey.id && styles.actionButtonDisabled]}
            >
              {syncingId === survey.id ? (
                <ActivityIndicator size="small" color={LOWES_THEME.success} />
              ) : (
                <MaterialIcons name="sync" size={18} color={LOWES_THEME.success} />
              )}
              <Text style={[styles.actionButtonText, { color: LOWES_THEME.success }]}>
                {syncingId === survey.id ? 'Syncing...' : 'Retry Sync'}
              </Text>
            </Pressable>
          )}
        </View>
      </View>
    );
  };

  // Render duplicate card
  const renderDuplicateCard = (survey: Survey) => {
    const customerName = survey.answers.contact_info 
      ? `${survey.answers.contact_info.firstName || ''} ${survey.answers.contact_info.lastName || ''}`.trim() 
      : 'Unknown';
    const customerPhone = survey.answers.contact_info?.phone || 'No phone';
    const employeeAlias = survey.employeeAlias || 'N/A';

    return (
      <View key={survey.id} style={[styles.surveyCard, styles.duplicateCard]}>
        <View style={styles.cardHeader}>
          <View style={styles.cardHeaderLeft}>
            <Text style={styles.surveyName}>{customerName}</Text>
            <View style={styles.aliasBadge}>
              <MaterialIcons name="person" size={12} color={LOWES_THEME.primary} />
              <Text style={styles.aliasText}>{employeeAlias}</Text>
            </View>
          </View>
          <MaterialIcons name="warning" size={24} color={LOWES_THEME.warning} />
        </View>
        <View style={styles.contactRow}>
          <MaterialIcons name="phone" size={16} color={LOWES_THEME.textSubtle} />
          <Text style={styles.surveyPhone}>{customerPhone}</Text>
        </View>
        
        {survey.syncError && (
          <View style={styles.errorBanner}>
            <MaterialIcons name="warning" size={16} color="#F44336" />
            <Text style={styles.errorText}>{survey.syncError}</Text>
          </View>
        )}
        
        <View style={styles.duplicateActions}>
          <Button
            title="Delete"
            onPress={() => handleDeleteDuplicate(survey.id)}
            variant="danger"
            size="small"
          />
          <Button
            title="Re-upload"
            onPress={() => handleReupload(survey.id)}
            backgroundColor={LOWES_THEME.primary}
            size="small"
          />
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Surveys</Text>
        {duplicates.length > 0 && (
          <View style={styles.duplicateBadge}>
            <Text style={styles.duplicateText}>{duplicates.length}</Text>
          </View>
        )}
      </View>

      <View style={styles.searchContainer}>
        <MaterialIcons name="search" size={20} color={LOWES_THEME.textSubtle} />
        <TextInput
          style={styles.searchInput}
          placeholder="Search by name or phone..."
          placeholderTextColor={LOWES_THEME.textSubtle}
          value={searchQuery}
          onChangeText={setSearchQuery}
        />
        {searchQuery.length > 0 && (
          <Pressable onPress={() => setSearchQuery('')}>
            <MaterialIcons name="close" size={20} color={LOWES_THEME.textSubtle} />
          </Pressable>
        )}
      </View>

      <View style={styles.tabs}>
        <Pressable onPress={() => setActiveTab('surveys')} style={[styles.tab, activeTab === 'surveys' && styles.activeTab]}>
          <Text style={[styles.tabText, activeTab === 'surveys' && styles.activeTabText]}>
            Surveys ({surveysOnly.length})
          </Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('appointments')} style={[styles.tab, activeTab === 'appointments' && styles.activeTab]}>
          <Text style={[styles.tabText, activeTab === 'appointments' && styles.activeTabText]}>
            Appointments ({appointmentsOnly.length})
          </Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('renters')} style={[styles.tab, activeTab === 'renters' && styles.activeTab]}>
          <Text style={[styles.tabText, activeTab === 'renters' && styles.activeTabText]}>
            Renters ({rentersOnly.length})
          </Text>
        </Pressable>
        <Pressable onPress={() => setActiveTab('duplicates')} style={[styles.tab, activeTab === 'duplicates' && styles.activeTab]}>
          <Text style={[styles.tabText, activeTab === 'duplicates' && styles.activeTabText]}>
            Duplicates ({duplicates.length})
          </Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {activeTab === 'surveys' ? (
          surveysOnly.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="assignment" size={64} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyText}>{searchQuery ? 'No surveys match your search' : 'No surveys yet'}</Text>
            </View>
          ) : (
            <View style={styles.surveyList}>{surveysOnly.map(renderSurveyCard)}</View>
          )
        ) : activeTab === 'appointments' ? (
          appointmentsOnly.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="event" size={64} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyText}>{searchQuery ? 'No appointments match your search' : 'No appointments yet'}</Text>
            </View>
          ) : (
            <View style={styles.surveyList}>{appointmentsOnly.map(renderSurveyCard)}</View>
          )
        ) : activeTab === 'renters' ? (
          rentersOnly.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="home" size={64} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyText}>{searchQuery ? 'No renters match your search' : 'No renter surveys yet'}</Text>
            </View>
          ) : (
            <View style={styles.surveyList}>{rentersOnly.map(renderSurveyCard)}</View>
          )
        ) : (
          duplicates.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="check-circle" size={64} color={LOWES_THEME.success} />
              <Text style={styles.emptyText}>No duplicates to review</Text>
            </View>
          ) : (
            <View style={styles.surveyList}>{duplicates.map(renderDuplicateCard)}</View>
          )
        )}
      </ScrollView>

      <Modal visible={showEditModal} transparent animationType="slide" onRequestClose={() => setShowEditModal(false)}>
        <View style={styles.modalOverlay}>
          <View style={styles.editModal}>
            <View style={styles.editModalHeader}>
              <Text style={styles.editModalTitle}>Edit Survey</Text>
              <Pressable onPress={() => setShowEditModal(false)}>
                <MaterialIcons name="close" size={24} color={LOWES_THEME.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.editModalContent}>
              {editingSurvey && (
                <>
                  <View style={styles.editSection}>
                    <Text style={styles.editSectionTitle}>Contact Information</Text>
                    
                    <Input
                      label="First Name"
                      value={editingSurvey.answers.contact_info?.firstName || ''}
                      onChangeText={(text) => setEditingSurvey({
                        ...editingSurvey,
                        answers: {
                          ...editingSurvey.answers,
                          contact_info: { ...editingSurvey.answers.contact_info, firstName: text },
                        },
                      })}
                    />

                    <Input
                      label="Last Name"
                      value={editingSurvey.answers.contact_info?.lastName || ''}
                      onChangeText={(text) => setEditingSurvey({
                        ...editingSurvey,
                        answers: {
                          ...editingSurvey.answers,
                          contact_info: { ...editingSurvey.answers.contact_info, lastName: text },
                        },
                      })}
                    />

                    <Input
                      label="Phone"
                      value={editingSurvey.answers.contact_info?.phone || ''}
                      onChangeText={(text) => {
                        const formatted = formatPhoneNumber(text);
                        setEditingSurvey({
                          ...editingSurvey,
                          answers: {
                            ...editingSurvey.answers,
                            phone: formatted,
                            contact_info: { ...editingSurvey.answers.contact_info, phone: formatted },
                          },
                        });
                      }}
                      keyboardType="phone-pad"
                    />

                    <Input
                      label="Address"
                      value={editingSurvey.answers.contact_info?.address || ''}
                      onChangeText={(text) => setEditingSurvey({
                        ...editingSurvey,
                        answers: {
                          ...editingSurvey.answers,
                          contact_info: { ...editingSurvey.answers.contact_info, address: text },
                        },
                      })}
                    />

                    <View style={styles.editRow}>
                      <View style={{ flex: 2 }}>
                        <Input
                          label="City"
                          value={editingSurvey.answers.contact_info?.city || ''}
                          onChangeText={(text) => setEditingSurvey({
                            ...editingSurvey,
                            answers: {
                              ...editingSurvey.answers,
                              contact_info: { ...editingSurvey.answers.contact_info, city: text },
                            },
                          })}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Input
                          label="State"
                          value={editingSurvey.answers.contact_info?.state || ''}
                          onChangeText={(text) => setEditingSurvey({
                            ...editingSurvey,
                            answers: {
                              ...editingSurvey.answers,
                              contact_info: { ...editingSurvey.answers.contact_info, state: text },
                            },
                          })}
                        />
                      </View>
                    </View>

                    <Input
                      label="Zip Code"
                      value={editingSurvey.answers.contact_info?.zipCode || ''}
                      onChangeText={(text) => setEditingSurvey({
                        ...editingSurvey,
                        answers: {
                          ...editingSurvey.answers,
                          contact_info: { ...editingSurvey.answers.contact_info, zipCode: text },
                        },
                      })}
                      keyboardType="numeric"
                    />
                  </View>

                  <View style={styles.editSection}>
                    <Text style={styles.editSectionTitle}>Survey Answers</Text>
                    {Object.entries(editingSurvey.answers).map(([key, value]) => {
                      if (key === 'contact_info') return null;
                      return (
                        <View key={key} style={styles.editFieldRow}>
                          <Text style={styles.editFieldLabel}>{key.replace(/_/g, ' ')}:</Text>
                          <TextInput
                            style={styles.editFieldInput}
                            value={typeof value === 'object' ? JSON.stringify(value) : String(value)}
                            onChangeText={(text) => setEditingSurvey({
                              ...editingSurvey,
                              answers: { ...editingSurvey.answers, [key]: text },
                            })}
                          />
                        </View>
                      );
                    })}
                  </View>

                  {editingSurvey.appointment && (
                    <View style={styles.editSection}>
                      <Text style={styles.editSectionTitle}>Appointment Details</Text>
                      
                      <Input label="Address" value={editingSurvey.appointment.address} onChangeText={(text) => setEditingSurvey({ ...editingSurvey, appointment: { ...editingSurvey.appointment!, address: text }})} />
                      <Input label="Date" value={editingSurvey.appointment.date} onChangeText={(text) => setEditingSurvey({ ...editingSurvey, appointment: { ...editingSurvey.appointment!, date: text }})} />
                      <Input label="Time" value={editingSurvey.appointment.time} onChangeText={(text) => setEditingSurvey({ ...editingSurvey, appointment: { ...editingSurvey.appointment!, time: text }})} />
                      <Input label="Notes" value={editingSurvey.appointment.notes || ''} onChangeText={(text) => setEditingSurvey({ ...editingSurvey, appointment: { ...editingSurvey.appointment!, notes: text }})} multiline />
                    </View>
                  )}
                </>
              )}
            </ScrollView>

            <View style={styles.editModalFooter}>
              <Button title="Cancel" onPress={() => setShowEditModal(false)} variant="outline" />
              <Button title="Save Changes" onPress={handleSaveEdit} backgroundColor={LOWES_THEME.primary} />
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: LOWES_THEME.background },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: SPACING.lg, paddingVertical: SPACING.lg },
  headerTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: LOWES_THEME.text },
  duplicateBadge: { backgroundColor: LOWES_THEME.error, borderRadius: 12, paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs },
  duplicateText: { color: '#FFFFFF', fontSize: FONTS.sizes.sm, fontWeight: '700' },
  searchContainer: { flexDirection: 'row', alignItems: 'center', gap: SPACING.sm, marginHorizontal: SPACING.lg, marginBottom: SPACING.md, paddingHorizontal: SPACING.md, paddingVertical: SPACING.sm, backgroundColor: LOWES_THEME.surface, borderRadius: 12, borderWidth: 1, borderColor: LOWES_THEME.border },
  searchInput: { flex: 1, fontSize: FONTS.sizes.md, color: LOWES_THEME.text, paddingVertical: SPACING.xs },
  tabs: { flexDirection: 'row', borderBottomWidth: 2, borderBottomColor: LOWES_THEME.border },
  tab: { flex: 1, paddingVertical: SPACING.md, alignItems: 'center' },
  activeTab: { borderBottomWidth: 3, borderBottomColor: LOWES_THEME.primary },
  tabText: { fontSize: FONTS.sizes.sm, color: LOWES_THEME.textSubtle, fontWeight: '500' },
  activeTabText: { color: LOWES_THEME.primary, fontWeight: '600' },
  content: { padding: SPACING.lg },
  emptyState: { alignItems: 'center', paddingVertical: SPACING.xxl * 2, gap: SPACING.md },
  emptyText: { fontSize: FONTS.sizes.lg, color: LOWES_THEME.textSubtle },
  surveyList: { gap: SPACING.md },
  surveyCard: { backgroundColor: LOWES_THEME.surface, padding: SPACING.lg, borderRadius: 12, gap: SPACING.sm },
  duplicateCard: { borderLeftWidth: 4, borderLeftColor: LOWES_THEME.warning },
  cardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: SPACING.xs },
  cardHeaderLeft: { flex: 1, gap: SPACING.xs },
  surveyName: { fontSize: FONTS.sizes.lg, fontWeight: '600', color: LOWES_THEME.text },
  aliasBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#E3F2FD', paddingHorizontal: SPACING.sm, paddingVertical: 2, borderRadius: 8, alignSelf: 'flex-start' },
  aliasText: { fontSize: FONTS.sizes.xs, fontWeight: '600', color: LOWES_THEME.primary },
  contactRow: { flexDirection: 'row', alignItems: 'center', gap: SPACING.xs },
  categoryBadge: { paddingHorizontal: SPACING.md, paddingVertical: SPACING.xs, borderRadius: 12 },
  categoryText: { color: '#FFFFFF', fontSize: FONTS.sizes.xs, fontWeight: '600', textTransform: 'uppercase' },
  surveyPhone: { fontSize: FONTS.sizes.md, color: LOWES_THEME.text, fontWeight: '500' },
  surveyDate: { fontSize: FONTS.sizes.sm, color: LOWES_THEME.textSubtle },
  syncStatusSection: { marginTop: SPACING.md, gap: SPACING.xs, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: LOWES_THEME.border },
  syncStatusLabel: { fontSize: FONTS.sizes.xs, fontWeight: '600', color: LOWES_THEME.textSubtle, textTransform: 'uppercase', letterSpacing: 0.5 },
  syncBadges: { flexDirection: 'row', gap: SPACING.sm, flexWrap: 'wrap' },
  syncBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: 4, paddingHorizontal: SPACING.sm, borderRadius: 8 },
  syncBadgeText: { fontSize: FONTS.sizes.xs, fontWeight: '600' },
  errorBanner: { flexDirection: 'row', alignItems: 'flex-start', gap: SPACING.xs, marginTop: SPACING.sm, padding: SPACING.sm, backgroundColor: '#FFEBEE', borderRadius: 8, borderLeftWidth: 3, borderLeftColor: '#F44336' },
  errorText: { flex: 1, fontSize: FONTS.sizes.xs, color: '#C62828', lineHeight: 16 },
  salesforceIdSection: { marginTop: SPACING.sm, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: LOWES_THEME.border },
  salesforceIdRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: SPACING.sm },
  salesforceIdInfo: { flex: 1, gap: 2 },
  salesforceIdLabel: { fontSize: FONTS.sizes.xs, color: LOWES_THEME.textSubtle, fontWeight: '600' },
  salesforceIdValue: { fontSize: FONTS.sizes.sm, color: LOWES_THEME.text, fontFamily: 'monospace', fontWeight: '500' },
  verifiedBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  verifiedText: { fontSize: FONTS.sizes.xs, color: '#4CAF50', fontWeight: '600' },
  verifyButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: SPACING.xs, paddingHorizontal: SPACING.sm, borderRadius: 6, borderWidth: 1, borderColor: LOWES_THEME.primary, backgroundColor: '#F0F7FF' },
  verifyButtonDisabled: { borderColor: '#DDD', backgroundColor: '#F5F5F5' },
  verifyButtonText: { fontSize: FONTS.sizes.xs, color: LOWES_THEME.primary, fontWeight: '600' },
  verifyButtonTextDisabled: { color: '#999' },
  noIdText: { fontSize: FONTS.sizes.sm, color: '#FF9800', fontStyle: 'italic', fontWeight: '500' },
  phoneHint: { fontSize: FONTS.sizes.xs, color: LOWES_THEME.textSubtle, marginTop: 2 },
  duplicateActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.sm },
  surveyActions: { flexDirection: 'row', gap: SPACING.sm, marginTop: SPACING.md, paddingTop: SPACING.sm, borderTopWidth: 1, borderTopColor: LOWES_THEME.border },
  actionButton: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingVertical: SPACING.sm, paddingHorizontal: SPACING.md, borderRadius: 8, borderWidth: 1, borderColor: LOWES_THEME.border, backgroundColor: LOWES_THEME.background },
  actionButtonDisabled: { opacity: 0.5 },
  actionButtonText: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: LOWES_THEME.primary },
  modalOverlay: { flex: 1, backgroundColor: 'rgba(0, 0, 0, 0.9)' },
  editModal: { flex: 1, backgroundColor: LOWES_THEME.background },
  editModalHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: SPACING.lg, backgroundColor: LOWES_THEME.surface, borderBottomWidth: 1, borderBottomColor: LOWES_THEME.border },
  editModalTitle: { fontSize: FONTS.sizes.xl, fontWeight: '700', color: LOWES_THEME.text },
  editModalContent: { flex: 1, padding: SPACING.lg },
  editSection: { marginBottom: SPACING.xl, gap: SPACING.md },
  editSectionTitle: { fontSize: FONTS.sizes.lg, fontWeight: '700', color: LOWES_THEME.text, marginBottom: SPACING.sm },
  editRow: { flexDirection: 'row', gap: SPACING.md },
  editFieldRow: { marginBottom: SPACING.md },
  editFieldLabel: { fontSize: FONTS.sizes.sm, fontWeight: '600', color: LOWES_THEME.textSubtle, marginBottom: 4, textTransform: 'capitalize' },
  editFieldInput: { borderWidth: 1, borderColor: LOWES_THEME.border, borderRadius: 8, padding: SPACING.md, fontSize: FONTS.sizes.md, color: LOWES_THEME.text, backgroundColor: LOWES_THEME.surface },
  editModalFooter: { flexDirection: 'row', gap: SPACING.md, padding: SPACING.lg, backgroundColor: LOWES_THEME.surface, borderTopWidth: 1, borderTopColor: LOWES_THEME.border },
});
