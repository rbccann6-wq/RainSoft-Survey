// Salesforce Field Mapping Configuration - Live API Integration
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useAlert } from '@/template';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import * as StorageService from '@/services/storageService';
import { fetchSalesforceLeadFields, testSalesforceFieldAccess, SalesforceField } from '@/services/salesforceFieldsService';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';

interface FieldMapping {
  surveyField: string;
  salesforceField: string;
  fieldType: 'text' | 'boolean' | 'date' | 'number' | 'picklist';
  label: string;
}

// Survey fields available for mapping
const SURVEY_FIELDS = [
  // Contact Info
  { path: 'contact_info.firstName', label: 'First Name', type: 'text' as const },
  { path: 'contact_info.lastName', label: 'Last Name', type: 'text' as const },
  { path: 'contact_info.phone', label: 'Phone Number', type: 'text' as const },
  { path: 'contact_info.address', label: 'Street Address', type: 'text' as const },
  { path: 'contact_info.zipCode', label: 'Zip Code', type: 'text' as const },
  { path: 'contact_info.city', label: '🔄 City (Auto-filled from Zip)', type: 'text' as const, autoFilled: true },
  { path: 'contact_info.state', label: '🔄 State (Auto-filled from Zip)', type: 'text' as const, autoFilled: true },
  
  // Survey Questions
  { path: 'buys_bottled_water', label: 'Buys Bottled Water?', type: 'boolean' as const },
  { path: 'is_homeowner', label: 'Is Homeowner?', type: 'boolean' as const },
  { path: 'has_salt_system', label: 'Has Salt System?', type: 'boolean' as const },
  { path: 'uses_filters', label: 'Uses Any Filters?', type: 'boolean' as const },
  { path: 'tastes_odors', label: 'Water Taste/Odor Issues', type: 'text' as const },
  { path: 'water_quality', label: 'Water Quality Rating', type: 'text' as const },
  { path: 'water_source', label: 'Water Source', type: 'text' as const },
  { path: 'current_treatment', label: 'Current Water Treatment', type: 'text' as const },
  { path: 'property_type', label: 'Property Type', type: 'text' as const },
  
  // Metadata
  { path: '_store', label: '📍 Store Location (Lowes/Home Depot)', type: 'text' as const },
  { path: '_timestamp', label: '📅 Survey Date/Time', type: 'date' as const },
  { path: '_employeeId', label: '👤 Employee ID', type: 'text' as const },
  { path: '_employeeAlias', label: '👤 Employee Name', type: 'text' as const },
  { path: '_surveyId', label: '🔢 Survey ID', type: 'text' as const },
  { path: '_hasSignature', label: '✍️ Has Signature?', type: 'boolean' as const },
];

const DEFAULT_MAPPINGS: FieldMapping[] = [
  { surveyField: 'contact_info.firstName', salesforceField: 'FirstName', fieldType: 'text', label: 'First Name' },
  { surveyField: 'contact_info.lastName', salesforceField: 'LastName', fieldType: 'text', label: 'Last Name' },
  { surveyField: 'contact_info.phone', salesforceField: 'Phone', fieldType: 'text', label: 'Phone Number' },
  { surveyField: 'contact_info.address', salesforceField: 'Street', fieldType: 'text', label: 'Street Address' },
  { surveyField: 'contact_info.city', salesforceField: 'City', fieldType: 'text', label: 'City' },
  { surveyField: 'contact_info.state', salesforceField: 'State', fieldType: 'text', label: 'State' },
  { surveyField: 'contact_info.zipCode', salesforceField: 'PostalCode', fieldType: 'text', label: 'Zip Code' },
  { surveyField: 'buys_bottled_water', salesforceField: 'Buys_Bottled_Water__c', fieldType: 'boolean', label: 'Buys Bottled Water' },
  { surveyField: 'is_homeowner', salesforceField: 'Is_Homeowner__c', fieldType: 'boolean', label: 'Is Homeowner' },
  { surveyField: 'water_quality', salesforceField: 'Water_Quality__c', fieldType: 'text', label: 'Water Quality' },
  { surveyField: '_store', salesforceField: 'Survey_Store__c', fieldType: 'text', label: 'Store Location' },
  { surveyField: '_timestamp', salesforceField: 'Survey_Date__c', fieldType: 'date', label: 'Survey Date' },
];

export default function FieldMappingScreen() {
  const { showAlert } = useAlert();
  const [mappings, setMappings] = useState<FieldMapping[]>(DEFAULT_MAPPINGS);
  const [salesforceFields, setSalesforceFields] = useState<SalesforceField[]>([]);
  const [isLoadingFields, setIsLoadingFields] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<'unknown' | 'connected' | 'error'>('unknown');
  const [isSaving, setIsSaving] = useState(false);
  
  // Picker modals
  const [showSurveyPicker, setShowSurveyPicker] = useState(false);
  const [showSalesforcePicker, setShowSalesforcePicker] = useState(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    loadMappings();
    loadSalesforceFields();
  }, []);

  const loadMappings = async () => {
    const saved = await StorageService.getData('salesforce_field_mapping');
    if (saved) {
      setMappings(saved);
    }
  };

  const loadSalesforceFields = async () => {
    setIsLoadingFields(true);
    const result = await fetchSalesforceLeadFields();
    
    if (result.success && result.fields) {
      setSalesforceFields(result.fields);
      setConnectionStatus('connected');
      console.log(`✅ Loaded ${result.fields.length} Salesforce Lead fields`);
    } else {
      setConnectionStatus('error');
      showAlert('Salesforce Connection Error', result.error || 'Failed to load fields. Check your credentials in syncService.ts');
    }
    
    setIsLoadingFields(false);
  };

  const testConnection = async () => {
    setIsLoadingFields(true);
    const result = await testSalesforceFieldAccess();
    
    if (result.success) {
      showAlert('✅ Connection Successful', result.message);
      setConnectionStatus('connected');
      await loadSalesforceFields();
    } else {
      showAlert('❌ Connection Failed', result.message);
      setConnectionStatus('error');
    }
    
    setIsLoadingFields(false);
  };

  const handleSave = async () => {
    setIsSaving(true);
    try {
      await StorageService.saveData('salesforce_field_mapping', mappings);
      showAlert('Saved ✓', 'Field mappings saved. New surveys will use these mappings when syncing to Salesforce.');
    } catch (error) {
      showAlert('Error', `Failed to save: ${error}`);
    } finally {
      setIsSaving(false);
    }
  };

  const handleReset = () => {
    showAlert('Reset to Defaults?', 'This will reset all mappings. Continue?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Reset',
        style: 'destructive',
        onPress: () => {
          setMappings(DEFAULT_MAPPINGS);
          showAlert('Reset Complete', 'Click Save to apply changes.');
        },
      },
    ]);
  };

  const addMapping = () => {
    setMappings([
      ...mappings,
      { surveyField: '', salesforceField: '', fieldType: 'text', label: 'New Mapping' },
    ]);
  };

  const removeMapping = (index: number) => {
    setMappings(mappings.filter((_, i) => i !== index));
  };

  const openSurveyPicker = (index: number) => {
    setEditingIndex(index);
    setSearchQuery('');
    setShowSurveyPicker(true);
  };

  const openSalesforcePicker = (index: number) => {
    setEditingIndex(index);
    setSearchQuery('');
    setShowSalesforcePicker(true);
  };

  const selectSurveyField = (field: typeof SURVEY_FIELDS[0]) => {
    if (editingIndex !== null) {
      const updated = [...mappings];
      updated[editingIndex] = {
        ...updated[editingIndex],
        surveyField: field.path,
        label: field.label,
        fieldType: field.type,
      };
      setMappings(updated);
      setShowSurveyPicker(false);
      setEditingIndex(null);
    }
  };

  const selectSalesforceField = (field: SalesforceField) => {
    if (editingIndex !== null) {
      const updated = [...mappings];
      updated[editingIndex] = {
        ...updated[editingIndex],
        salesforceField: field.name,
        fieldType: field.type as any,
      };
      setMappings(updated);
      setShowSalesforcePicker(false);
      setEditingIndex(null);
    }
  };

  const filteredSurveyFields = SURVEY_FIELDS.filter(f =>
    f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.path.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const filteredSalesforceFields = salesforceFields.filter(f =>
    f.label.toLowerCase().includes(searchQuery.toLowerCase()) ||
    f.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const standardFields = filteredSalesforceFields.filter(f => !f.custom);
  const customFields = filteredSalesforceFields.filter(f => f.custom);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Salesforce Field Mapping</Text>
        {isLoadingFields && <ActivityIndicator color={LOWES_THEME.primary} />}
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Connection Status */}
        <View style={[
          styles.statusCard,
          connectionStatus === 'connected' && styles.statusCardSuccess,
          connectionStatus === 'error' && styles.statusCardError,
        ]}>
          <View style={styles.statusHeader}>
            <MaterialIcons
              name={connectionStatus === 'connected' ? 'check-circle' : connectionStatus === 'error' ? 'error' : 'cloud'}
              size={24}
              color={connectionStatus === 'connected' ? LOWES_THEME.success : connectionStatus === 'error' ? LOWES_THEME.error : LOWES_THEME.textSubtle}
            />
            <View style={styles.statusInfo}>
              <Text style={styles.statusTitle}>
                {connectionStatus === 'connected' && `✅ Connected - ${salesforceFields.length} Lead Fields Available`}
                {connectionStatus === 'error' && '❌ Connection Error'}
                {connectionStatus === 'unknown' && '🔄 Loading...'}
              </Text>
              {connectionStatus === 'connected' && (
                <Text style={styles.statusSubtitle}>
                  Standard: {standardFields.length} | Custom: {customFields.length}
                </Text>
              )}
            </View>
            <Button
              title="Test"
              onPress={testConnection}
              variant="outline"
              size="small"
            />
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={24} color={LOWES_THEME.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>How Field Mapping Works</Text>
            <Text style={styles.infoText}>
              Map survey data (source) → Salesforce Lead fields (destination). The arrow shows the direction: survey field values will be sent to the corresponding Salesforce field. Click any field to select from picklists.
            </Text>
            <View style={styles.exampleMapping}>
              <Text style={styles.exampleText}>Example: contact_info.firstName → FirstName</Text>
              <Text style={styles.exampleSubtext}>Survey's first name will sync to Salesforce's FirstName field</Text>
            </View>
          </View>
        </View>

        {/* Mappings List */}
        <View style={styles.mappingsList}>
          <View style={styles.mappingsHeader}>
            <Text style={styles.mappingsTitle}>Field Mappings ({mappings.length})</Text>
            <Pressable onPress={addMapping} style={styles.addButton}>
              <MaterialIcons name="add-circle" size={24} color={LOWES_THEME.primary} />
            </Pressable>
          </View>

          {mappings.map((mapping, index) => (
            <View key={index} style={styles.mappingCard}>
              <View style={styles.mappingRow}>
                <Pressable
                  style={styles.fieldPicker}
                  onPress={() => openSurveyPicker(index)}
                >
                  <View style={styles.fieldPickerContent}>
                    <Text style={styles.fieldPickerLabel}>📱 Survey Field (Source)</Text>
                    <Text style={[styles.fieldPickerValue, !mapping.surveyField && styles.fieldPickerPlaceholder]}>
                      {mapping.surveyField || 'Select survey field...'}
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-drop-down" size={24} color={LOWES_THEME.textSubtle} />
                </Pressable>

                <View style={styles.arrowContainer}>
                  <MaterialIcons name="arrow-forward" size={28} color={LOWES_THEME.primary} />
                  <Text style={styles.arrowLabel}>maps to</Text>
                </View>

                <Pressable
                  style={styles.fieldPicker}
                  onPress={() => openSalesforcePicker(index)}
                >
                  <View style={styles.fieldPickerContent}>
                    <Text style={styles.fieldPickerLabel}>☁️ Salesforce Field (Destination)</Text>
                    <Text style={[styles.fieldPickerValue, !mapping.salesforceField && styles.fieldPickerPlaceholder]}>
                      {mapping.salesforceField || 'Select SF field...'}
                    </Text>
                  </View>
                  <MaterialIcons name="arrow-drop-down" size={24} color={LOWES_THEME.textSubtle} />
                </Pressable>

                <Pressable onPress={() => removeMapping(index)} style={styles.deleteButton}>
                  <MaterialIcons name="delete" size={24} color={LOWES_THEME.error} />
                </Pressable>
              </View>

              <View style={styles.typeBadge}>
                <Text style={styles.typeBadgeText}>{mapping.fieldType}</Text>
              </View>
            </View>
          ))}
        </View>

        {/* Actions */}
        <View style={styles.actions}>
          <Button title="Reset" onPress={handleReset} variant="outline" />
          <Button
            title={isSaving ? 'Saving...' : 'Save Mappings'}
            onPress={handleSave}
            backgroundColor={LOWES_THEME.primary}
            disabled={isSaving}
            icon="save"
          />
        </View>
      </ScrollView>

      {/* Survey Field Picker Modal */}
      <Modal
        visible={showSurveyPicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSurveyPicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Survey Field</Text>
              <Pressable onPress={() => setShowSurveyPicker(false)}>
                <MaterialIcons name="close" size={24} color={LOWES_THEME.text} />
              </Pressable>
            </View>

            <View style={styles.searchBar}>
              <MaterialIcons name="search" size={20} color={LOWES_THEME.textSubtle} />
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search survey fields..."
                style={styles.searchInput}
              />
            </View>

            <ScrollView style={styles.pickerList}>
              {/* Auto-filled fields first */}
              {filteredSurveyFields.filter((f: any) => f.autoFilled).length > 0 && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldGroupTitle}>🔄 Auto-Populated Fields</Text>
                  {filteredSurveyFields.filter((f: any) => f.autoFilled).map((field, idx) => (
                    <Pressable
                      key={idx}
                      style={[styles.pickerOption, styles.pickerOptionAutoFilled]}
                      onPress={() => selectSurveyField(field)}
                    >
                      <View style={styles.pickerOptionContent}>
                        <Text style={styles.pickerOptionLabel}>{field.label}</Text>
                        <Text style={styles.pickerOptionPath}>{field.path}</Text>
                        <Text style={styles.autoFilledNote}>Automatically filled from zip code lookup</Text>
                      </View>
                      <View style={[styles.pickerTypeBadge, { backgroundColor: getTypeColor(field.type) }]}>
                        <Text style={styles.pickerTypeText}>{field.type}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
              
              {/* Regular fields */}
              <View style={styles.fieldGroup}>
                <Text style={styles.fieldGroupTitle}>Survey Fields</Text>
                {filteredSurveyFields.filter((f: any) => !f.autoFilled).map((field, idx) => (
                  <Pressable
                    key={idx}
                    style={styles.pickerOption}
                    onPress={() => selectSurveyField(field)}
                  >
                    <View style={styles.pickerOptionContent}>
                      <Text style={styles.pickerOptionLabel}>{field.label}</Text>
                      <Text style={styles.pickerOptionPath}>{field.path}</Text>
                    </View>
                    <View style={[styles.pickerTypeBadge, { backgroundColor: getTypeColor(field.type) }]}>
                      <Text style={styles.pickerTypeText}>{field.type}</Text>
                    </View>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* Salesforce Field Picker Modal */}
      <Modal
        visible={showSalesforcePicker}
        transparent
        animationType="slide"
        onRequestClose={() => setShowSalesforcePicker(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select Salesforce Lead Field</Text>
              <Pressable onPress={() => setShowSalesforcePicker(false)}>
                <MaterialIcons name="close" size={24} color={LOWES_THEME.text} />
              </Pressable>
            </View>

            <View style={styles.searchBar}>
              <MaterialIcons name="search" size={20} color={LOWES_THEME.textSubtle} />
              <Input
                value={searchQuery}
                onChangeText={setSearchQuery}
                placeholder="Search Salesforce fields..."
                style={styles.searchInput}
              />
            </View>

            <ScrollView style={styles.pickerList}>
              {standardFields.length > 0 && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldGroupTitle}>Standard Fields ({standardFields.length})</Text>
                  {standardFields.map((field, idx) => (
                    <Pressable
                      key={idx}
                      style={styles.pickerOption}
                      onPress={() => selectSalesforceField(field)}
                    >
                      <View style={styles.pickerOptionContent}>
                        <Text style={styles.pickerOptionLabel}>{field.label}</Text>
                        <Text style={styles.pickerOptionPath}>{field.name}</Text>
                      </View>
                      <View style={[styles.pickerTypeBadge, { backgroundColor: getTypeColor(field.type) }]}>
                        <Text style={styles.pickerTypeText}>{field.type}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}

              {customFields.length > 0 && (
                <View style={styles.fieldGroup}>
                  <Text style={styles.fieldGroupTitle}>Custom Fields ({customFields.length})</Text>
                  {customFields.map((field, idx) => (
                    <Pressable
                      key={idx}
                      style={styles.pickerOption}
                      onPress={() => selectSalesforceField(field)}
                    >
                      <View style={styles.pickerOptionContent}>
                        <Text style={styles.pickerOptionLabel}>{field.label}</Text>
                        <Text style={styles.pickerOptionPath}>{field.name}</Text>
                      </View>
                      <View style={[styles.pickerTypeBadge, { backgroundColor: getTypeColor(field.type) }]}>
                        <Text style={styles.pickerTypeText}>{field.type}</Text>
                      </View>
                    </Pressable>
                  ))}
                </View>
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function getTypeColor(type: string): string {
  switch (type) {
    case 'text': return '#2196F3';
    case 'boolean': return '#4CAF50';
    case 'date': return '#FF9800';
    case 'datetime': return '#FF5722';
    case 'number': return '#9C27B0';
    case 'picklist': return '#00BCD4';
    case 'reference': return '#607D8B';
    default: return '#757575';
  }
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
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  statusCard: {
    padding: SPACING.lg,
    backgroundColor: '#F5F5F5',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.textSubtle,
  },
  statusCardSuccess: {
    backgroundColor: '#E8F5E9',
    borderLeftColor: LOWES_THEME.success,
  },
  statusCardError: {
    backgroundColor: '#FFEBEE',
    borderLeftColor: LOWES_THEME.error,
  },
  statusHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statusInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  statusTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  statusSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
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
  exampleMapping: {
    marginTop: SPACING.sm,
    padding: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 6,
    borderLeftWidth: 3,
    borderLeftColor: LOWES_THEME.primary,
  },
  exampleText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: LOWES_THEME.text,
    fontFamily: 'monospace',
  },
  exampleSubtext: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    marginTop: 2,
  },
  mappingsList: {
    gap: SPACING.md,
  },
  mappingsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  mappingsTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  addButton: {
    padding: SPACING.xs,
  },
  mappingCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.sm,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  mappingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  fieldPicker: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#FFFFFF',
    padding: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
    minHeight: 64,
  },
  fieldPickerContent: {
    flex: 1,
    gap: 4,
  },
  fieldPickerLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
    textTransform: 'uppercase',
  },
  fieldPickerValue: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    fontFamily: 'monospace',
  },
  fieldPickerPlaceholder: {
    color: LOWES_THEME.textSubtle,
    fontStyle: 'italic',
  },
  arrowContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    marginHorizontal: SPACING.sm,
    gap: 2,
  },
  arrowLabel: {
    fontSize: FONTS.sizes.xxs,
    color: LOWES_THEME.primary,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  deleteButton: {
    padding: SPACING.xs,
  },
  typeBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 4,
    backgroundColor: '#E3F2FD',
    borderRadius: 6,
  },
  typeBadgeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: LOWES_THEME.primary,
    textTransform: 'uppercase',
  },
  actions: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'flex-end',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    flex: 1,
    backgroundColor: LOWES_THEME.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
    marginTop: 80,
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
  searchBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    backgroundColor: '#F5F5F5',
  },
  searchInput: {
    flex: 1,
    margin: 0,
  },
  pickerList: {
    flex: 1,
    paddingBottom: SPACING.xl,
  },
  fieldGroup: {
    padding: SPACING.lg,
    gap: SPACING.sm,
  },
  fieldGroupTitle: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: LOWES_THEME.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginBottom: SPACING.xs,
  },
  pickerOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: LOWES_THEME.surface,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
    marginBottom: SPACING.xs,
  },
  pickerOptionContent: {
    flex: 1,
    gap: 4,
  },
  pickerOptionLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  pickerOptionPath: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    fontFamily: 'monospace',
  },
  pickerTypeBadge: {
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: 6,
  },
  pickerTypeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: '#FFFFFF',
    textTransform: 'uppercase',
  },
  pickerOptionAutoFilled: {
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
    backgroundColor: '#FFF8E1',
  },
  autoFilledNote: {
    fontSize: FONTS.sizes.xs,
    color: '#F57C00',
    fontStyle: 'italic',
    marginTop: 2,
  },
});
