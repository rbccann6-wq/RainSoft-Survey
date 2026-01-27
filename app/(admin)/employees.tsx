// Admin employee management
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import * as StorageService from '@/services/storageService';
import { sendEmployeeInvite } from '@/services/inviteService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { TimeEntry, Employee } from '@/types';
import { formatFullDateTime } from '@/utils/timeFormat';

export default function EmployeesScreen() {
  const { employees, loadData, timeOffRequests } = useApp();
  const { showAlert } = useAlert();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [showInviteModal, setShowInviteModal] = useState(false);
  const [inviteData, setInviteData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
  });
  const [showDocumentsModal, setShowDocumentsModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [showTeamAssignModal, setShowTeamAssignModal] = useState(false);
  const [assigningEmployee, setAssigningEmployee] = useState<Employee | null>(null);
  const [selectedTeamLead, setSelectedTeamLead] = useState<string>('');

  const activeEmployees = employees.filter(e => e.status === 'active');
  const invitedEmployees = employees.filter(e => e.status === 'invited');
  const pendingRequests = timeOffRequests.filter(r => r.status === 'pending');

  React.useEffect(() => {
    loadTimeEntries();
  }, []);

  const loadTimeEntries = async () => {
    const entries = await StorageService.getTimeEntries();
    setTimeEntries(entries || []);
  };

  const handleSendInvite = async () => {
    if (!inviteData.firstName || !inviteData.lastName || !inviteData.email || !inviteData.phone) {
      showAlert('Missing Information', 'Please fill in all fields');
      return;
    }

    const newEmployee: Employee = {
      id: Date.now().toString(),
      firstName: inviteData.firstName,
      lastName: inviteData.lastName,
      email: inviteData.email,
      phone: inviteData.phone,
      role: 'surveyor',
      status: 'invited',
      hireDate: new Date().toISOString(),
      onboardingComplete: false,
      onboardingStep: 0,
      documents: [],
      inviteToken: Math.random().toString(36).substring(2, 15),
      inviteSentAt: new Date().toISOString(),
    };

    await StorageService.addEmployee(newEmployee);
    await sendEmployeeInvite(
      newEmployee.firstName,
      newEmployee.lastName,
      newEmployee.email,
      newEmployee.phone,
      newEmployee.inviteToken!
    );

    await loadData();
    setShowInviteModal(false);
    setInviteData({ firstName: '', lastName: '', email: '', phone: '' });
    
    showAlert(
      'Invitation Sent ✓',
      `Onboarding invite sent to ${newEmployee.firstName} ${newEmployee.lastName} via SMS and email`
    );
  };

  const handleResendInvite = async (employee: Employee) => {
    await sendEmployeeInvite(
      employee.firstName,
      employee.lastName,
      employee.email,
      employee.phone,
      employee.inviteToken!
    );
    
    showAlert(
      'Invitation Resent ✓',
      `Onboarding invite resent to ${employee.firstName} ${employee.lastName} via SMS and email`
    );
  };

  const viewDocuments = (employee: Employee) => {
    setSelectedEmployee(employee);
    setShowDocumentsModal(true);
  };

  const openTeamAssignment = (employee: Employee) => {
    setAssigningEmployee(employee);
    setSelectedTeamLead(employee.teamLeadId || '');
    setShowTeamAssignModal(true);
  };

  const handleAssignTeamLead = async () => {
    if (!assigningEmployee) return;

    await StorageService.updateEmployee(assigningEmployee.id, {
      teamLeadId: selectedTeamLead || undefined,
    });

    await loadData();
    setShowTeamAssignModal(false);
    setAssigningEmployee(null);
    setSelectedTeamLead('');
    
    showAlert(
      'Team Assignment Updated',
      selectedTeamLead 
        ? `${assigningEmployee.firstName} assigned to team lead`
        : `${assigningEmployee.firstName} removed from team`
    );
  };

  const toggleTeamLeadRole = async (employee: Employee) => {
    const newStatus = !employee.isTeamLead;
    
    if (!newStatus) {
      // Removing team lead role - warn if they have team members
      const teamMembers = employees.filter(e => e.teamLeadId === employee.id);
      if (teamMembers.length > 0) {
        showAlert(
          'Confirm Removal',
          `${employee.firstName} has ${teamMembers.length} team member(s). Removing team lead role will unassign them. Continue?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Remove',
              style: 'destructive',
              onPress: async () => {
                // Remove team lead and unassign members
                await StorageService.updateEmployee(employee.id, { isTeamLead: false });
                for (const member of teamMembers) {
                  await StorageService.updateEmployee(member.id, { teamLeadId: undefined });
                }
                await loadData();
                showAlert('Team Lead Removed', 'All team members have been unassigned');
              },
            },
          ]
        );
        return;
      }
    }

    await StorageService.updateEmployee(employee.id, { isTeamLead: newStatus });
    await loadData();
    showAlert(
      newStatus ? 'Team Lead Assigned' : 'Team Lead Removed',
      `${employee.firstName} ${newStatus ? 'can now' : 'no longer'} manage a team`
    );
  };

  const handleTerminate = (employeeId: string, name: string) => {
    showAlert('Terminate Employee', `Are you sure you want to terminate ${name}? Future shifts will be removed but all records will be kept.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Terminate',
        style: 'destructive',
        onPress: async () => {
          await StorageService.terminateEmployee(employeeId);
          await loadData();
          showAlert('Employee Terminated', 'Employee has been terminated and future shifts removed');
        },
      },
    ]);
  };

  const viewEmployeeClockIns = (employeeId: string, name: string) => {
    const employeeEntries = timeEntries.filter(e => e.employeeId === employeeId);
    
    if (employeeEntries.length === 0) {
      showAlert('No Clock-Ins', `${name} has no clock-in records`);
      return;
    }

    const recent = employeeEntries.sort((a, b) => 
      new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime()
    )[0];

    let message = `Store: ${recent.store === 'lowes' ? 'Lowes' : 'Home Depot'}\n`;
    message += `Time: ${formatFullDateTime(recent.clockIn)}\n`;
    
    if (recent.gpsCoordinates) {
      message += `\nGPS Location:\nLat: ${recent.gpsCoordinates.latitude.toFixed(6)}\nLon: ${recent.gpsCoordinates.longitude.toFixed(6)}\nAccuracy: ${recent.gpsCoordinates.accuracy.toFixed(0)}m`;
    }
    
    if (recent.photoUri) {
      message += '\n\nPhoto: Captured ✓';
    }

    showAlert('Recent Clock-In', message);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Employees</Text>
        <Pressable
          style={styles.inviteButton}
          onPress={() => setShowInviteModal(true)}
        >
          <MaterialIcons name="person-add" size={24} color="#FFFFFF" />
          <Text style={styles.inviteButtonText}>Invite Employee</Text>
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Pending Invites */}
        {invitedEmployees.length > 0 && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Pending Invites</Text>
            <View style={styles.employeeList}>
              {invitedEmployees.map((employee) => (
                <View key={employee.id} style={[styles.employeeCard, styles.invitedCard]}>
                  <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>
                      {employee.firstName} {employee.lastName}
                    </Text>
                    <Text style={styles.employeeEmail}>{employee.email}</Text>
                    <View style={styles.statusRow}>
                      <MaterialIcons name="schedule" size={14} color={LOWES_THEME.warning} />
                      <Text style={styles.statusText}>
                        Invited {new Date(employee.inviteSentAt!).toLocaleDateString()}
                      </Text>
                    </View>
                    {employee.onboardingStep! > 0 && (
                      <View style={styles.progressBar}>
                        <View style={[styles.progressFill, { width: `${(employee.onboardingStep! / 6) * 100}%` }]} />
                      </View>
                    )}
                  </View>
                  <View style={styles.inviteActions}>
                    <Button
                      title="Resend Invite"
                      onPress={() => handleResendInvite(employee)}
                      backgroundColor={LOWES_THEME.primary}
                      size="small"
                    />
                    {employee.documents && employee.documents.length > 0 && (
                      <Button
                        title="View Docs"
                        onPress={() => viewDocuments(employee)}
                        variant="outline"
                        size="small"
                      />
                    )}
                  </View>
                </View>
              ))}
            </View>
          </View>
        )}

        {/* Active Employees */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Active Employees ({activeEmployees.length})</Text>
          <View style={styles.employeeList}>
            {activeEmployees.map((employee) => {
              const isActive = timeEntries.some(
                e => e.employeeId === employee.id && !e.clockOut
              );
              const todayEntries = timeEntries.filter(e => {
                const today = new Date().toISOString().split('T')[0];
                return e.employeeId === employee.id && e.clockIn.startsWith(today);
              });
              const teamMembers = employees.filter(e => e.teamLeadId === employee.id);
              const assignedTeamLead = employees.find(e => e.id === employee.teamLeadId);

              return (
                <View key={employee.id} style={styles.employeeCard}>
                  <View style={styles.employeeMain}>
                    <View style={styles.employeeInfo}>
                      <View style={styles.employeeHeader}>
                        <Text style={styles.employeeName}>
                          {employee.firstName} {employee.lastName}
                        </Text>
                        {isActive && (
                          <View style={styles.activeBadge}>
                            <View style={styles.activeDot} />
                            <Text style={styles.activeText}>Clocked In</Text>
                          </View>
                        )}
                      </View>
                      <Text style={styles.employeeEmail}>{employee.email}</Text>
                      <Text style={styles.employeeRole}>{employee.role}</Text>
                      
                      {employee.isTeamLead && (
                        <View style={styles.teamLeadBadge}>
                          <MaterialIcons name="groups" size={14} color="#FFFFFF" />
                          <Text style={styles.teamLeadText}>
                            Team Lead ({teamMembers.length} member{teamMembers.length !== 1 ? 's' : ''})
                          </Text>
                        </View>
                      )}
                      
                      {assignedTeamLead && (
                        <View style={styles.assignedRow}>
                          <MaterialIcons name="person" size={14} color={LOWES_THEME.textSubtle} />
                          <Text style={styles.assignedText}>
                            Team: {assignedTeamLead.firstName} {assignedTeamLead.lastName}
                          </Text>
                        </View>
                      )}
                      
                      {todayEntries.length > 0 && (
                        <View style={styles.statsRow}>
                          <MaterialIcons name="access-time" size={14} color={LOWES_THEME.textSubtle} />
                          <Text style={styles.statsText}>
                            {todayEntries.length} clock-in{todayEntries.length !== 1 ? 's' : ''} today
                          </Text>
                        </View>
                      )}
                    </View>
                    
                    <View style={styles.actionButtons}>
                      <Pressable
                        onPress={() => toggleTeamLeadRole(employee)}
                        style={[styles.iconButton, employee.isTeamLead && styles.iconButtonActive]}
                      >
                        <MaterialIcons 
                          name="groups" 
                          size={24} 
                          color={employee.isTeamLead ? '#FFFFFF' : LOWES_THEME.primary} 
                        />
                      </Pressable>
                      
                      <Pressable
                        onPress={() => openTeamAssignment(employee)}
                        style={styles.iconButton}
                      >
                        <MaterialIcons name="group-add" size={24} color={LOWES_THEME.success} />
                      </Pressable>
                      
                      <Pressable
                        onPress={() => viewEmployeeClockIns(employee.id, `${employee.firstName} ${employee.lastName}`)}
                        style={styles.iconButton}
                      >
                        <MaterialIcons name="location-on" size={24} color={LOWES_THEME.primary} />
                      </Pressable>
                      
                      {employee.documents && employee.documents.length > 0 && (
                        <Pressable
                          onPress={() => viewDocuments(employee)}
                          style={styles.iconButton}
                        >
                          <MaterialIcons name="folder" size={24} color={LOWES_THEME.warning} />
                        </Pressable>
                      )}
                      
                      <Button
                        title="Terminate"
                        onPress={() => handleTerminate(employee.id, `${employee.firstName} ${employee.lastName}`)}
                        variant="danger"
                        size="small"
                      />
                    </View>
                  </View>

                  {todayEntries.length > 0 && todayEntries[0].gpsCoordinates && (
                    <View style={styles.clockInDetails}>
                      <View style={styles.detailRow}>
                        <MaterialIcons name="location-on" size={16} color={LOWES_THEME.primary} />
                        <Text style={styles.detailText}>
                          {todayEntries[0].gpsCoordinates.latitude.toFixed(4)}, {todayEntries[0].gpsCoordinates.longitude.toFixed(4)}
                        </Text>
                      </View>
                      {todayEntries[0].photoUri && (
                        <View style={styles.detailRow}>
                          <MaterialIcons name="camera-alt" size={16} color={LOWES_THEME.success} />
                          <Text style={styles.detailText}>Photo verified</Text>
                        </View>
                      )}
                    </View>
                  )}
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      {/* Invite Modal */}
      <Modal
        visible={showInviteModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowInviteModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowInviteModal(false)}
        >
          <KeyboardAvoidingView 
            behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            style={styles.modalKeyboardView}
          >
            <Pressable 
              style={styles.modalContent}
              onPress={(e) => e.stopPropagation()}
            >
              <View style={styles.modalHeader}>
                <Text style={styles.modalTitle}>Invite New Employee</Text>
                <Pressable onPress={() => setShowInviteModal(false)}>
                  <MaterialIcons name="close" size={24} color={LOWES_THEME.text} />
                </Pressable>
              </View>

              <ScrollView 
                style={styles.modalBody}
                contentContainerStyle={styles.modalBodyContent}
                keyboardShouldPersistTaps="handled"
              >
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>First Name</Text>
                  <Input
                    value={inviteData.firstName}
                    onChangeText={(text) => setInviteData({ ...inviteData, firstName: text })}
                    placeholder="John"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Last Name</Text>
                  <Input
                    value={inviteData.lastName}
                    onChangeText={(text) => setInviteData({ ...inviteData, lastName: text })}
                    placeholder="Smith"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Email</Text>
                  <Input
                    value={inviteData.email}
                    onChangeText={(text) => setInviteData({ ...inviteData, email: text })}
                    placeholder="john.smith@email.com"
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>

                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>Phone</Text>
                  <Input
                    value={inviteData.phone}
                    onChangeText={(text) => setInviteData({ ...inviteData, phone: text })}
                    placeholder="555-123-4567"
                    keyboardType="phone-pad"
                  />
                </View>

                <View style={styles.infoBox}>
                  <MaterialIcons name="info" size={20} color={LOWES_THEME.primary} />
                  <Text style={styles.infoText}>
                    Employee will receive onboarding instructions via SMS and email
                  </Text>
                </View>

                <View style={styles.modalActions}>
                  <Button
                    title="Cancel"
                    onPress={() => setShowInviteModal(false)}
                    variant="outline"
                  />
                  <Button
                    title="Send Invite"
                    onPress={handleSendInvite}
                    backgroundColor={LOWES_THEME.success}
                  />
                </View>
              </ScrollView>
            </Pressable>
          </KeyboardAvoidingView>
        </Pressable>
      </Modal>

      {/* Team Assignment Modal */}
      <Modal
        visible={showTeamAssignModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowTeamAssignModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Assign Team Lead - {assigningEmployee?.firstName} {assigningEmployee?.lastName}
              </Text>
              <Pressable onPress={() => setShowTeamAssignModal(false)}>
                <MaterialIcons name="close" size={24} color={LOWES_THEME.text} />
              </Pressable>
            </View>

            <View style={styles.modalBody}>
              <View style={styles.infoBox}>
                <MaterialIcons name="info" size={20} color={LOWES_THEME.primary} />
                <Text style={styles.infoText}>
                  Assign this employee to a team lead who can view their survey statistics.
                </Text>
              </View>

              <View style={styles.teamLeadList}>
                <Pressable
                  onPress={() => setSelectedTeamLead('')}
                  style={[
                    styles.teamLeadOption,
                    !selectedTeamLead && styles.teamLeadOptionSelected,
                  ]}
                >
                  <View style={styles.teamLeadInfo}>
                    <MaterialIcons name="remove-circle" size={24} color={LOWES_THEME.textSubtle} />
                    <Text style={styles.teamLeadName}>No Team Lead</Text>
                  </View>
                  {!selectedTeamLead && (
                    <MaterialIcons name="check-circle" size={24} color={LOWES_THEME.success} />
                  )}
                </Pressable>

                {activeEmployees.filter(e => e.isTeamLead && e.id !== assigningEmployee?.id).map((teamLead) => {
                  const memberCount = employees.filter(e => e.teamLeadId === teamLead.id).length;
                  return (
                    <Pressable
                      key={teamLead.id}
                      onPress={() => setSelectedTeamLead(teamLead.id)}
                      style={[
                        styles.teamLeadOption,
                        selectedTeamLead === teamLead.id && styles.teamLeadOptionSelected,
                      ]}
                    >
                      <View style={styles.teamLeadInfo}>
                        <MaterialIcons name="groups" size={24} color={LOWES_THEME.primary} />
                        <View>
                          <Text style={styles.teamLeadName}>
                            {teamLead.firstName} {teamLead.lastName}
                          </Text>
                          <Text style={styles.teamLeadCount}>
                            {memberCount} current team member{memberCount !== 1 ? 's' : ''}
                          </Text>
                        </View>
                      </View>
                      {selectedTeamLead === teamLead.id && (
                        <MaterialIcons name="check-circle" size={24} color={LOWES_THEME.success} />
                      )}
                    </Pressable>
                  );
                })}
              </View>

              <View style={styles.modalActions}>
                <Button
                  title="Cancel"
                  onPress={() => setShowTeamAssignModal(false)}
                  variant="outline"
                />
                <Button
                  title="Save Assignment"
                  onPress={handleAssignTeamLead}
                  backgroundColor={LOWES_THEME.success}
                />
              </View>
            </View>
          </View>
        </View>
      </Modal>

      {/* Documents Modal */}
      <Modal
        visible={showDocumentsModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowDocumentsModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                {selectedEmployee?.firstName} {selectedEmployee?.lastName} - Documents
              </Text>
              <Pressable onPress={() => setShowDocumentsModal(false)}>
                <MaterialIcons name="close" size={24} color={LOWES_THEME.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedEmployee?.documents && selectedEmployee.documents.length > 0 ? (
                selectedEmployee.documents.map((doc) => (
                  <View key={doc.id} style={styles.docCard}>
                    <View style={styles.docHeader}>
                      <MaterialIcons 
                        name="description" 
                        size={32} 
                        color={doc.status === 'completed' ? LOWES_THEME.success : LOWES_THEME.warning} 
                      />
                      <View style={styles.docInfo}>
                        <Text style={styles.docType}>{doc.type.toUpperCase()}</Text>
                        <Text style={styles.docDate}>
                          Uploaded: {new Date(doc.uploadedAt).toLocaleDateString()}
                        </Text>
                        <View style={[
                          styles.docStatus,
                          { backgroundColor: doc.status === 'completed' ? '#E8F5E9' : '#FFF3E0' },
                        ]}>
                          <Text style={[
                            styles.docStatusText,
                            { color: doc.status === 'completed' ? LOWES_THEME.success : LOWES_THEME.warning },
                          ]}>
                            {doc.status}
                          </Text>
                        </View>
                      </View>
                    </View>
                    {doc.fileUrl && (
                      <Pressable 
                        style={styles.downloadButton}
                        onPress={() => showAlert('Download', `Would download: ${doc.fileUrl}`)}
                      >
                        <MaterialIcons name="download" size={20} color={LOWES_THEME.primary} />
                        <Text style={styles.downloadText}>Download</Text>
                      </Pressable>
                    )}
                  </View>
                ))
              ) : (
                <View style={styles.emptyDocs}>
                  <MaterialIcons name="folder-open" size={48} color={LOWES_THEME.textSubtle} />
                  <Text style={styles.emptyText}>No documents uploaded yet</Text>
                </View>
              )}
              
              {selectedEmployee?.personalInfo && (
                <View style={styles.personalInfoSection}>
                  <Text style={styles.sectionTitle}>Personal Information</Text>
                  <View style={styles.infoGrid}>
                    <Text style={styles.infoItem}>📍 {selectedEmployee.personalInfo.address}</Text>
                    <Text style={styles.infoItem}>🏙️ {selectedEmployee.personalInfo.city}, {selectedEmployee.personalInfo.state} {selectedEmployee.personalInfo.zipCode}</Text>
                    <Text style={styles.infoItem}>🎂 DOB: {new Date(selectedEmployee.personalInfo.dateOfBirth).toLocaleDateString()}</Text>
                    <Text style={styles.infoItem}>📞 Emergency: {selectedEmployee.personalInfo.emergencyContactName} ({selectedEmployee.personalInfo.emergencyContactPhone})</Text>
                  </View>
                </View>
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
  inviteButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: LOWES_THEME.success,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 24,
  },
  inviteButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.xl,
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
    gap: SPACING.md,
  },
  employeeCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  invitedCard: {
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.warning,
  },
  employeeMain: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  employeeInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    flexWrap: 'wrap',
  },
  employeeName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  activeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: '#E8F5E9',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  activeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: LOWES_THEME.success,
  },
  activeText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.success,
    fontWeight: '600',
  },
  employeeEmail: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  employeeRole: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.primary,
    textTransform: 'capitalize',
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  statusText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.warning,
    fontWeight: '600',
  },
  progressBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
    marginTop: SPACING.sm,
  },
  progressFill: {
    height: '100%',
    backgroundColor: LOWES_THEME.success,
  },
  statsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  statsText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  actionButtons: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconButton: {
    padding: SPACING.sm,
  },
  iconButtonActive: {
    backgroundColor: LOWES_THEME.primary,
    borderRadius: 8,
  },
  teamLeadBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: LOWES_THEME.primary,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  teamLeadText: {
    fontSize: FONTS.sizes.xs,
    color: '#FFFFFF',
    fontWeight: '600',
  },
  assignedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  assignedText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    fontStyle: 'italic',
  },
  teamLeadList: {
    gap: SPACING.sm,
  },
  teamLeadOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: LOWES_THEME.surface,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: LOWES_THEME.border,
  },
  teamLeadOptionSelected: {
    borderColor: LOWES_THEME.success,
    backgroundColor: '#E8F5E9',
  },
  teamLeadInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  teamLeadName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  teamLeadCount: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  clockInDetails: {
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
    gap: SPACING.xs,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalKeyboardView: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: LOWES_THEME.background,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    height: '85%',
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
    flex: 1,
  },
  modalBodyContent: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    paddingBottom: SPACING.xxl,
  },
  inputGroup: {
    gap: SPACING.xs,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  infoBox: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 18,
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'flex-end',
  },
  inviteActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  docCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    marginBottom: SPACING.md,
    gap: SPACING.md,
  },
  docHeader: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'flex-start',
  },
  docInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  docType: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  docDate: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  docStatus: {
    alignSelf: 'flex-start',
    paddingHorizontal: SPACING.sm,
    paddingVertical: 2,
    borderRadius: 8,
  },
  docStatusText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
  },
  downloadButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.sm,
    justifyContent: 'center',
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
  },
  downloadText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.primary,
  },
  emptyDocs: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
  },
  personalInfoSection: {
    marginTop: SPACING.lg,
    padding: SPACING.lg,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    gap: SPACING.md,
  },
  infoGrid: {
    gap: SPACING.sm,
  },
  infoItem: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
});
