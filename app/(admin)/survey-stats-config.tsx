// Admin page - Configure Salesforce status mappings to survey outcome categories
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';

interface StatusMapping {
  id: string;
  salesforce_status: string;
  category: 'bad_contact' | 'dead' | 'still_contacting' | 'install';
  object_type: 'lead' | 'appointment';
}

const CATEGORIES = [
  { value: 'bad_contact', label: 'Bad Contact', color: '#9E9E9E', icon: 'phone-disabled' },
  { value: 'dead', label: 'Dead', color: '#F44336', icon: 'cancel' },
  { value: 'still_contacting', label: 'Still Contacting', color: '#FF9800', icon: 'pending' },
  { value: 'install', label: 'Install', color: '#4CAF50', icon: 'check-circle' },
];

export default function SurveyStatsConfigScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const supabase = getSupabaseClient();
  
  const [mappings, setMappings] = useState<StatusMapping[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  
  const [newStatus, setNewStatus] = useState('');
  const [newCategory, setNewCategory] = useState<string>('bad_contact');
  const [newObjectType, setNewObjectType] = useState<'lead' | 'appointment'>('lead');
  const [showAddForm, setShowAddForm] = useState(false);

  useEffect(() => {
    loadMappings();
  }, []);

  const loadMappings = async () => {
    try {
      const { data, error } = await supabase
        .from('lead_status_mappings')
        .select('*')
        .order('object_type', { ascending: true })
        .order('salesforce_status', { ascending: true });

      if (error) throw error;
      setMappings(data || []);
    } catch (error) {
      console.error('Error loading mappings:', error);
      showAlert('Error', 'Failed to load status mappings');
    } finally {
      setLoading(false);
    }
  };

  const handleAddMapping = async () => {
    if (!newStatus.trim()) {
      showAlert('Required', 'Please enter a Salesforce status');
      return;
    }

    setSaving(true);
    try {
      const { error } = await supabase
        .from('lead_status_mappings')
        .insert({
          salesforce_status: newStatus.trim(),
          category: newCategory,
          object_type: newObjectType,
        });

      if (error) {
        if (error.code === '23505') {
          showAlert('Duplicate', 'This Salesforce status already exists');
        } else {
          throw error;
        }
      } else {
        showAlert('Success', 'Status mapping added');
        setNewStatus('');
        setShowAddForm(false);
        await loadMappings();
      }
    } catch (error) {
      console.error('Error adding mapping:', error);
      showAlert('Error', 'Failed to add status mapping');
    } finally {
      setSaving(false);
    }
  };

  const handleUpdateMapping = async (id: string, category: string) => {
    setSaving(true);
    try {
      const { error } = await supabase
        .from('lead_status_mappings')
        .update({ category, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;
      showAlert('Success', 'Mapping updated');
      await loadMappings();
    } catch (error) {
      console.error('Error updating mapping:', error);
      showAlert('Error', 'Failed to update mapping');
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteMapping = async (id: string, status: string) => {
    showAlert('Delete Mapping', `Remove "${status}"?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setSaving(true);
          try {
            const { error } = await supabase
              .from('lead_status_mappings')
              .delete()
              .eq('id', id);

            if (error) throw error;
            showAlert('Success', 'Mapping deleted');
            await loadMappings();
          } catch (error) {
            console.error('Error deleting mapping:', error);
            showAlert('Error', 'Failed to delete mapping');
          } finally {
            setSaving(false);
          }
        },
      },
    ]);
  };

  const getCategoryColor = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.color || '#9E9E9E';
  };

  const getCategoryLabel = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.label || category;
  };

  const getCategoryIcon = (category: string) => {
    return CATEGORIES.find(c => c.value === category)?.icon || 'help';
  };

  const leadMappings = mappings.filter(m => m.object_type === 'lead');
  const appointmentMappings = mappings.filter(m => m.object_type === 'appointment');

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={LOWES_THEME.primary} />
          <Text style={styles.loadingText}>Loading mappings...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Survey Stats Config</Text>
        <Pressable onPress={() => setShowAddForm(!showAddForm)} style={styles.addButton}>
          <MaterialIcons 
            name={showAddForm ? "close" : "add"} 
            size={24} 
            color={LOWES_THEME.primary} 
          />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <MaterialIcons name="info" size={24} color={LOWES_THEME.primary} />
          <Text style={styles.infoBannerText}>
            Map Salesforce statuses to tracking categories:
            {"\n"}• Leads: Pull from "Status" field
            {"\n"}• Appointments: Pull from "Staus" field
            {"\n"}{"\n"}Employee stats will categorize outcomes using these mappings.
          </Text>
        </View>

        {/* Add New Mapping Form */}
        {showAddForm && (
          <View style={styles.addForm}>
            <Text style={styles.formTitle}>Add New Status Mapping</Text>
            
            <View style={styles.formField}>
              <Text style={styles.label}>Salesforce Status</Text>
              <Text style={styles.fieldHint}>
                {newObjectType === 'lead' 
                  ? 'Enter exact value from Lead "Status" field' 
                  : 'Enter exact value from Appointment "Staus" field'}
              </Text>
              <Input
                value={newStatus}
                onChangeText={setNewStatus}
                placeholder="e.g., Working - Contacted"
              />
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Object Type</Text>
              <View style={styles.objectTypeButtons}>
                <Pressable
                  onPress={() => setNewObjectType('lead')}
                  style={[
                    styles.objectTypeButton,
                    newObjectType === 'lead' && styles.objectTypeButtonActive,
                  ]}
                >
                  <Text style={[
                    styles.objectTypeButtonText,
                    newObjectType === 'lead' && styles.objectTypeButtonTextActive,
                  ]}>
                    Lead
                  </Text>
                </Pressable>
                <Pressable
                  onPress={() => setNewObjectType('appointment')}
                  style={[
                    styles.objectTypeButton,
                    newObjectType === 'appointment' && styles.objectTypeButtonActive,
                  ]}
                >
                  <Text style={[
                    styles.objectTypeButtonText,
                    newObjectType === 'appointment' && styles.objectTypeButtonTextActive,
                  ]}>
                    Appointment
                  </Text>
                </Pressable>
              </View>
            </View>

            <View style={styles.formField}>
              <Text style={styles.label}>Category</Text>
              <View style={styles.categoryButtons}>
                {CATEGORIES.map((cat) => (
                  <Pressable
                    key={cat.value}
                    onPress={() => setNewCategory(cat.value)}
                    style={[
                      styles.categoryButton,
                      newCategory === cat.value && { 
                        backgroundColor: cat.color,
                        borderColor: cat.color,
                      },
                    ]}
                  >
                    <MaterialIcons 
                      name={cat.icon as any} 
                      size={20} 
                      color={newCategory === cat.value ? '#FFFFFF' : cat.color} 
                    />
                    <Text style={[
                      styles.categoryButtonText,
                      newCategory === cat.value && styles.categoryButtonTextActive,
                    ]}>
                      {cat.label}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </View>

            <Button
              title="Add Mapping"
              onPress={handleAddMapping}
              backgroundColor={LOWES_THEME.success}
              fullWidth
              disabled={saving || !newStatus.trim()}
            />
          </View>
        )}

        {/* Category Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Categories</Text>
          <View style={styles.legendGrid}>
            {CATEGORIES.map((cat) => (
              <View key={cat.value} style={styles.legendItem}>
                <View style={[styles.legendDot, { backgroundColor: cat.color }]} />
                <Text style={styles.legendLabel}>{cat.label}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Lead Mappings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="people" size={24} color={LOWES_THEME.primary} />
            <Text style={styles.sectionTitle}>Lead Statuses ({leadMappings.length})</Text>
          </View>
          
          <View style={styles.mappingsList}>
            {leadMappings.map((mapping) => (
              <View key={mapping.id} style={styles.mappingCard}>
                <View style={styles.mappingInfo}>
                  <Text style={styles.mappingStatus}>{mapping.salesforce_status}</Text>
                  <View style={styles.mappingCategoryRow}>
                    <View 
                      style={[
                        styles.categoryBadge, 
                        { backgroundColor: getCategoryColor(mapping.category) }
                      ]}
                    >
                      <MaterialIcons 
                        name={getCategoryIcon(mapping.category) as any} 
                        size={14} 
                        color="#FFFFFF" 
                      />
                      <Text style={styles.categoryBadgeText}>
                        {getCategoryLabel(mapping.category)}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.mappingActions}>
                  <Pressable
                    onPress={() => {
                      const currentIndex = CATEGORIES.findIndex(c => c.value === mapping.category);
                      const nextCategory = CATEGORIES[(currentIndex + 1) % CATEGORIES.length];
                      handleUpdateMapping(mapping.id, nextCategory.value);
                    }}
                    style={styles.actionButton}
                  >
                    <MaterialIcons name="swap-horiz" size={20} color={LOWES_THEME.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteMapping(mapping.id, mapping.salesforce_status)}
                    style={styles.actionButton}
                  >
                    <MaterialIcons name="delete" size={20} color={LOWES_THEME.error} />
                  </Pressable>
                </View>
              </View>
            ))}
            {leadMappings.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialIcons name="info" size={48} color={LOWES_THEME.textSubtle} />
                <Text style={styles.emptyText}>No lead status mappings yet</Text>
              </View>
            )}
          </View>
        </View>

        {/* Appointment Mappings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <MaterialIcons name="event" size={24} color={LOWES_THEME.primary} />
            <Text style={styles.sectionTitle}>Appointment Statuses ({appointmentMappings.length})</Text>
          </View>
          
          <View style={styles.mappingsList}>
            {appointmentMappings.map((mapping) => (
              <View key={mapping.id} style={styles.mappingCard}>
                <View style={styles.mappingInfo}>
                  <Text style={styles.mappingStatus}>{mapping.salesforce_status}</Text>
                  <View style={styles.mappingCategoryRow}>
                    <View 
                      style={[
                        styles.categoryBadge, 
                        { backgroundColor: getCategoryColor(mapping.category) }
                      ]}
                    >
                      <MaterialIcons 
                        name={getCategoryIcon(mapping.category) as any} 
                        size={14} 
                        color="#FFFFFF" 
                      />
                      <Text style={styles.categoryBadgeText}>
                        {getCategoryLabel(mapping.category)}
                      </Text>
                    </View>
                  </View>
                </View>
                
                <View style={styles.mappingActions}>
                  <Pressable
                    onPress={() => {
                      const currentIndex = CATEGORIES.findIndex(c => c.value === mapping.category);
                      const nextCategory = CATEGORIES[(currentIndex + 1) % CATEGORIES.length];
                      handleUpdateMapping(mapping.id, nextCategory.value);
                    }}
                    style={styles.actionButton}
                  >
                    <MaterialIcons name="swap-horiz" size={20} color={LOWES_THEME.primary} />
                  </Pressable>
                  <Pressable
                    onPress={() => handleDeleteMapping(mapping.id, mapping.salesforce_status)}
                    style={styles.actionButton}
                  >
                    <MaterialIcons name="delete" size={20} color={LOWES_THEME.error} />
                  </Pressable>
                </View>
              </View>
            ))}
            {appointmentMappings.length === 0 && (
              <View style={styles.emptyState}>
                <MaterialIcons name="info" size={48} color={LOWES_THEME.textSubtle} />
                <Text style={styles.emptyText}>No appointment status mappings yet</Text>
              </View>
            )}
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
    paddingVertical: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  backButton: {
    padding: SPACING.sm,
  },
  addButton: {
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
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
  infoBannerText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  addForm: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
    borderWidth: 2,
    borderColor: LOWES_THEME.primary,
  },
  formTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
    marginBottom: SPACING.sm,
  },
  formField: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  fieldHint: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    fontStyle: 'italic',
  },
  objectTypeButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  objectTypeButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: LOWES_THEME.border,
    alignItems: 'center',
  },
  objectTypeButtonActive: {
    backgroundColor: LOWES_THEME.primary,
    borderColor: LOWES_THEME.primary,
  },
  objectTypeButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
  },
  objectTypeButtonTextActive: {
    color: '#FFFFFF',
  },
  categoryButtons: {
    gap: SPACING.sm,
  },
  categoryButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: LOWES_THEME.border,
  },
  categoryButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  categoryButtonTextActive: {
    color: '#FFFFFF',
  },
  legendCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
  },
  legendTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
    marginBottom: SPACING.md,
  },
  legendGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  legendItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    width: '48%',
  },
  legendDot: {
    width: 12,
    height: 12,
    borderRadius: 6,
  },
  legendLabel: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
  },
  section: {
    gap: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  mappingsList: {
    gap: SPACING.sm,
  },
  mappingCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  mappingInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  mappingStatus: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  mappingCategoryRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  categoryBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
  },
  categoryBadgeText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  mappingActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  actionButton: {
    padding: SPACING.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 2,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
  },
});
