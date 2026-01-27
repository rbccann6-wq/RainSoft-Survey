// Team lead page - Manage team member assignments
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import * as StorageService from '@/services/storageService';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { Employee } from '@/types';

export default function ManageTeamScreen() {
  const router = useRouter();
  const { currentUser, employees, loadData } = useApp();
  const { showAlert } = useAlert();
  
  const [saving, setSaving] = useState(false);
  const [selectedMembers, setSelectedMembers] = useState<Set<string>>(new Set());

  // Filter out current user and get only active surveyors
  const availableEmployees = employees.filter(
    emp => emp.id !== currentUser?.id && 
           emp.status === 'active' && 
           emp.role === 'surveyor'
  );

  // Load current team members
  useEffect(() => {
    if (currentUser) {
      const currentTeam = employees.filter(
        emp => emp.teamLeadId === currentUser.id
      ).map(emp => emp.id);
      setSelectedMembers(new Set(currentTeam));
    }
  }, [currentUser, employees]);

  const toggleMember = (employeeId: string) => {
    const newSelected = new Set(selectedMembers);
    if (newSelected.has(employeeId)) {
      newSelected.delete(employeeId);
    } else {
      newSelected.add(employeeId);
    }
    setSelectedMembers(newSelected);
  };

  const handleSaveTeam = async () => {
    if (!currentUser) return;

    setSaving(true);
    try {
      // Update all employees - assign or unassign team lead
      for (const employee of availableEmployees) {
        const shouldBeInTeam = selectedMembers.has(employee.id);
        const currentlyInTeam = employee.teamLeadId === currentUser.id;

        if (shouldBeInTeam !== currentlyInTeam) {
          await StorageService.updateEmployee(employee.id, {
            teamLeadId: shouldBeInTeam ? currentUser.id : undefined,
          });
        }
      }

      await loadData();
      showAlert('Success', 'Team assignments updated');
      router.back();
    } catch (error) {
      console.error('Error saving team:', error);
      showAlert('Error', 'Failed to update team assignments');
    } finally {
      setSaving(false);
    }
  };

  if (!currentUser?.isTeamLead) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.errorContainer}>
          <MaterialIcons name="error" size={64} color={LOWES_THEME.error} />
          <Text style={styles.errorText}>
            You do not have team lead permissions
          </Text>
          <Button
            title="Go Back"
            onPress={() => router.back()}
            backgroundColor={LOWES_THEME.primary}
          />
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
        <Text style={styles.headerTitle}>Manage My Team</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Info Banner */}
        <View style={styles.infoBanner}>
          <MaterialIcons name="info" size={24} color={LOWES_THEME.primary} />
          <View style={styles.infoBannerContent}>
            <Text style={styles.infoBannerText}>
              Select team members to view their survey statistics in your team dashboard.
            </Text>
          </View>
        </View>

        {/* Current Team Count */}
        <View style={styles.countCard}>
          <Text style={styles.countLabel}>Selected Team Members</Text>
          <Text style={styles.countValue}>{selectedMembers.size}</Text>
        </View>

        {/* Available Employees List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Available Employees</Text>
          
          {availableEmployees.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="people-outline" size={64} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyText}>No employees available</Text>
            </View>
          ) : (
            <View style={styles.employeeList}>
              {availableEmployees.map((employee) => {
                const isSelected = selectedMembers.has(employee.id);
                const hasOtherTeamLead = employee.teamLeadId && employee.teamLeadId !== currentUser.id;

                return (
                  <Pressable
                    key={employee.id}
                    style={[
                      styles.employeeCard,
                      isSelected && styles.employeeCardSelected,
                      hasOtherTeamLead && styles.employeeCardDisabled,
                    ]}
                    onPress={() => !hasOtherTeamLead && toggleMember(employee.id)}
                    disabled={hasOtherTeamLead}
                  >
                    <View style={styles.employeeInfo}>
                      <View style={styles.avatar}>
                        <Text style={styles.avatarText}>
                          {employee.firstName[0]}{employee.lastName[0]}
                        </Text>
                      </View>
                      <View style={styles.employeeDetails}>
                        <Text style={styles.employeeName}>
                          {employee.firstName} {employee.lastName}
                        </Text>
                        <Text style={styles.employeeEmail}>{employee.email}</Text>
                        {hasOtherTeamLead && (
                          <Text style={styles.assignedText}>
                            Assigned to another team lead
                          </Text>
                        )}
                      </View>
                    </View>
                    
                    <View style={[
                      styles.checkbox,
                      isSelected && styles.checkboxSelected,
                      hasOtherTeamLead && styles.checkboxDisabled,
                    ]}>
                      {isSelected && (
                        <MaterialIcons name="check" size={20} color="#FFFFFF" />
                      )}
                    </View>
                  </Pressable>
                );
              })}
            </View>
          )}
        </View>

        {/* Save Button */}
        {availableEmployees.length > 0 && (
          <Button
            title="Save Team Assignments"
            onPress={handleSaveTeam}
            backgroundColor={LOWES_THEME.success}
            fullWidth
            disabled={saving}
          />
        )}
      </ScrollView>

      {saving && (
        <View style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color={LOWES_THEME.primary} />
          <Text style={styles.loadingText}>Saving...</Text>
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
  },
  infoBannerText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  countCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.xl,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: LOWES_THEME.primary,
  },
  countLabel: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
    marginBottom: SPACING.xs,
  },
  countValue: {
    fontSize: 48,
    fontWeight: '700',
    color: LOWES_THEME.primary,
  },
  section: {
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  employeeList: {
    gap: SPACING.sm,
  },
  employeeCard: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.md,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: LOWES_THEME.border,
  },
  employeeCardSelected: {
    borderColor: LOWES_THEME.primary,
    backgroundColor: '#E3F2FD',
  },
  employeeCardDisabled: {
    opacity: 0.5,
  },
  employeeInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    flex: 1,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: LOWES_THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  employeeDetails: {
    flex: 1,
    gap: 2,
  },
  employeeName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  employeeEmail: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  assignedText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.warning,
    fontStyle: 'italic',
  },
  checkbox: {
    width: 28,
    height: 28,
    borderRadius: 6,
    borderWidth: 2,
    borderColor: LOWES_THEME.border,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxSelected: {
    backgroundColor: LOWES_THEME.primary,
    borderColor: LOWES_THEME.primary,
  },
  checkboxDisabled: {
    backgroundColor: '#E0E0E0',
    borderColor: '#E0E0E0',
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
  errorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    gap: SPACING.lg,
  },
  errorText: {
    fontSize: FONTS.sizes.lg,
    color: LOWES_THEME.error,
    textAlign: 'center',
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
    gap: SPACING.md,
  },
  loadingText: {
    fontSize: FONTS.sizes.md,
    color: '#FFFFFF',
  },
});
