// Modern admin scheduling with visual availability
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import * as StorageService from '@/services/storageService';
import { Button } from '@/components/ui/Button';
import { TimePicker30 } from '@/components/ui/TimePicker30';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { Employee, Schedule, TimeOffRequest } from '@/types';
import { formatTime12Hour } from '@/utils/timeFormat';

const DAYS_OF_WEEK = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
const STORES = [
  { value: 'lowes', label: 'Lowes', color: '#004990' },
  { value: 'homedepot', label: 'Home Depot', color: '#FF6200' },
];

export default function ScheduleScreen() {
  const { schedules, employees, timeOffRequests, loadData } = useApp();
  const { showAlert } = useAlert();

  const [selectedWeekOffset, setSelectedWeekOffset] = useState(0);
  const [showScheduleModal, setShowScheduleModal] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);
  const [selectedDay, setSelectedDay] = useState<string>('');
  const [selectedStore, setSelectedStore] = useState<'lowes' | 'homedepot'>('lowes');
  const [scheduleStartTime, setScheduleStartTime] = useState<string>('09:00');
  const [scheduleEndTime, setScheduleEndTime] = useState<string>('17:00');

  const activeEmployees = employees.filter(e => e.status === 'active');
  const pendingRequests = timeOffRequests.filter(r => r.status === 'pending');

  // Get current week dates
  const getWeekDates = (offset: number) => {
    const today = new Date();
    const currentDay = today.getDay(); // 0 = Sunday, 1 = Monday, etc.
    const monday = new Date(today);
    monday.setDate(today.getDate() - (currentDay === 0 ? 6 : currentDay - 1) + (offset * 7));

    const dates = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      dates.push(date);
    }
    return dates;
  };

  const weekDates = getWeekDates(selectedWeekOffset);

  const getDateString = (date: Date) => {
    return date.toISOString().split('T')[0];
  };

  // Check if employee has time off on this date
  const hasTimeOff = (employeeId: string, date: Date): TimeOffRequest | null => {
    const dateStr = getDateString(date);
    const request = timeOffRequests.find(
      r => r.employeeId === employeeId && 
           r.status === 'approved' &&
           dateStr >= r.startDate && 
           dateStr <= r.endDate
    );
    return request || null;
  };

  // Check if employee is available on this day
  const getAvailability = (employee: Employee, date: Date) => {
    const dayName = DAYS_OF_WEEK[date.getDay() === 0 ? 6 : date.getDay() - 1].toLowerCase();
    const dayAvailability = employee.availability?.[dayName as keyof typeof employee.availability];
    return dayAvailability;
  };

  // Get schedule for employee on this date
  const getSchedule = (employeeId: string, date: Date): Schedule | null => {
    const dateStr = getDateString(date);
    return schedules.find(
      s => s.employeeId === employeeId && s.date === dateStr
    ) || null;
  };

  const handleQuickSchedule = (employee: Employee, date: Date) => {
    const timeOff = hasTimeOff(employee.id, date);
    if (timeOff) {
      showAlert('Time Off Approved', `${employee.firstName} has approved time off on this date. Do you want to override?`, [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Override',
          onPress: () => {
            setScheduleStartTime('09:00');
            setScheduleEndTime('17:00');
            setSelectedEmployee(employee);
            setSelectedDay(getDateString(date));
            setShowScheduleModal(true);
          },
        },
      ]);
      return;
    }

    const availability = getAvailability(employee, date);
    
    // Pre-fill times from employee's availability or use defaults
    setScheduleStartTime(availability?.startTime || '09:00');
    setScheduleEndTime(availability?.endTime || '17:00');
    setSelectedEmployee(employee);
    setSelectedDay(getDateString(date));
    setShowScheduleModal(true);
  };

  const handleCreateSchedule = async () => {
    if (!selectedEmployee || !selectedDay) return;

    const newSchedule: Schedule = {
      id: Date.now().toString(),
      employeeId: selectedEmployee.id,
      date: selectedDay,
      startTime: scheduleStartTime,
      endTime: scheduleEndTime,
      store: selectedStore,
      status: 'scheduled',
    };

    await StorageService.addSchedule(newSchedule);
    await loadData();
    
    setShowScheduleModal(false);
    setSelectedEmployee(null);
    setSelectedDay('');
    
    showAlert(
      'Scheduled ✓', 
      `${selectedEmployee.firstName} scheduled for ${new Date(selectedDay).toLocaleDateString()}`
    );
  };

  const handleDeleteSchedule = (scheduleId: string, employeeName: string, date: string) => {
    showAlert('Delete Schedule', `Remove ${employeeName} from ${new Date(date).toLocaleDateString()}?`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          await StorageService.deleteSchedule(scheduleId);
          await loadData();
          showAlert('Deleted', 'Schedule removed');
        },
      },
    ]);
  };

  const handleApproveTimeOff = async (requestId: string, approved: boolean) => {
    await StorageService.updateTimeOffRequest(requestId, { 
      status: approved ? 'approved' : 'denied' 
    });
    await loadData();
    showAlert(
      approved ? 'Approved' : 'Denied',
      `Time off request ${approved ? 'approved' : 'denied'}`
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Team Schedule</Text>
          <Text style={styles.headerSubtitle}>
            {weekDates[0].toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - {weekDates[6].toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </Text>
        </View>
        
        <View style={styles.weekNav}>
          <Pressable 
            onPress={() => setSelectedWeekOffset(selectedWeekOffset - 1)}
            style={styles.weekButton}
          >
            <MaterialIcons name="chevron-left" size={24} color={LOWES_THEME.primary} />
          </Pressable>
          
          {selectedWeekOffset !== 0 && (
            <Pressable 
              onPress={() => setSelectedWeekOffset(0)}
              style={styles.todayButton}
            >
              <Text style={styles.todayButtonText}>This Week</Text>
            </Pressable>
          )}
          
          <Pressable 
            onPress={() => setSelectedWeekOffset(selectedWeekOffset + 1)}
            style={styles.weekButton}
          >
            <MaterialIcons name="chevron-right" size={24} color={LOWES_THEME.primary} />
          </Pressable>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* How to Use Banner */}
        <View style={styles.helpBanner}>
          <MaterialIcons name="touch-app" size={24} color={LOWES_THEME.primary} />
          <View style={styles.helpBannerContent}>
            <Text style={styles.helpBannerTitle}>How to Create Shifts</Text>
            <Text style={styles.helpBannerText}>
              Click any calendar cell to create a shift:{"\n"}
              • Green = Employee available (quick schedule){"\n"}
              • Gray = Not available (override){"\n"}
              • Orange = Already scheduled (edit/delete)
            </Text>
          </View>
        </View>

        {/* Pending Time Off Requests */}
        {pendingRequests.length > 0 && (
          <View style={styles.requestsSection}>
            <Text style={styles.sectionTitle}>
              Pending Time Off Requests ({pendingRequests.length})
            </Text>
            
            {pendingRequests.map((request) => {
              const employee = employees.find(e => e.id === request.employeeId);
              if (!employee) return null;

              return (
                <View key={request.id} style={styles.requestCard}>
                  <View style={styles.requestHeader}>
                    <View style={styles.requestInfo}>
                      <Text style={styles.requestName}>
                        {employee.firstName} {employee.lastName}
                      </Text>
                      <Text style={styles.requestDates}>
                        {new Date(request.startDate).toLocaleDateString()} - {new Date(request.endDate).toLocaleDateString()}
                      </Text>
                      {request.reason && (
                        <Text style={styles.requestReason}>{request.reason}</Text>
                      )}
                    </View>
                    
                    <View style={styles.requestActions}>
                      <Pressable
                        onPress={() => handleApproveTimeOff(request.id, true)}
                        style={[styles.requestButton, styles.approveButton]}
                      >
                        <MaterialIcons name="check" size={20} color="#FFFFFF" />
                      </Pressable>
                      <Pressable
                        onPress={() => handleApproveTimeOff(request.id, false)}
                        style={[styles.requestButton, styles.denyButton]}
                      >
                        <MaterialIcons name="close" size={20} color="#FFFFFF" />
                      </Pressable>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {/* Legend */}
        <View style={styles.legendCard}>
          <Text style={styles.legendTitle}>Visual Guide</Text>
          <View style={styles.legendGrid}>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: '#E8F5E9' }]} />
              <Text style={styles.legendText}>Available</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: '#FFF3E0' }]} />
              <Text style={styles.legendText}>Scheduled</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: '#FFEBEE' }]} />
              <Text style={styles.legendText}>Time Off</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendBox, { backgroundColor: '#F5F5F5' }]} />
              <Text style={styles.legendText}>Not Available</Text>
            </View>
          </View>
        </View>

        {/* Schedule Grid - Horizontal Scroll */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.scheduleGrid}>
          <View>
            {/* Header Row - Days */}
            <View style={styles.gridHeader}>
              <View style={styles.employeeColumn}>
                <Text style={styles.columnHeaderText}>Employee</Text>
              </View>
              {weekDates.map((date, index) => {
                const isToday = getDateString(date) === getDateString(new Date());
                return (
                  <View key={index} style={[styles.dayColumn, isToday && styles.todayColumn]}>
                    <Text style={[styles.dayName, isToday && styles.todayText]}>
                      {DAYS_OF_WEEK[date.getDay() === 0 ? 6 : date.getDay() - 1].slice(0, 3)}
                    </Text>
                    <Text style={[styles.dayDate, isToday && styles.todayText]}>
                      {date.getDate()}
                    </Text>
                  </View>
                );
              })}
            </View>

            {/* Employee Rows */}
            {activeEmployees.map((employee) => (
              <View key={employee.id} style={styles.gridRow}>
                <View style={styles.employeeColumn}>
                  <Text style={styles.employeeName}>
                    {employee.firstName} {employee.lastName}
                  </Text>
                </View>

                {weekDates.map((date, index) => {
                  const timeOff = hasTimeOff(employee.id, date);
                  const availability = getAvailability(employee, date);
                  const schedule = getSchedule(employee.id, date);
                  const dateStr = getDateString(date);
                  const isPast = dateStr < getDateString(new Date());

                  let cellStyle = styles.unavailableCell;
                  let content = null;

                  if (timeOff) {
                    cellStyle = styles.timeOffCell;
                    content = (
                      <View style={styles.cellContent}>
                        <MaterialIcons name="event-busy" size={16} color="#F44336" />
                        <Text style={styles.timeOffText}>Off</Text>
                      </View>
                    );
                  } else if (schedule) {
                    const store = STORES.find(s => s.value === schedule.store);
                    cellStyle = styles.scheduledCell;
                    content = (
                      <Pressable 
                        style={styles.cellContent}
                        onPress={() => handleDeleteSchedule(
                          schedule.id, 
                          `${employee.firstName} ${employee.lastName}`,
                          schedule.date
                        )}
                        disabled={isPast}
                      >
                        <View style={[styles.storeBadge, { backgroundColor: store?.color }]}>
                          <Text style={styles.storeInitial}>
                            {store?.label[0]}
                          </Text>
                        </View>
                        <Text style={styles.timeText}>
                          {formatTime12Hour(schedule.startTime)}-{formatTime12Hour(schedule.endTime)}
                        </Text>
                      </Pressable>
                    );
                  } else if (availability && availability.available) {
                    cellStyle = styles.availableCell;
                    content = (
                      <Pressable 
                        style={styles.cellContent}
                        onPress={() => handleQuickSchedule(employee, date)}
                        disabled={isPast}
                      >
                        <MaterialIcons name="add-circle-outline" size={20} color="#4CAF50" />
                        <Text style={styles.availableTimeText}>
                          {formatTime12Hour(availability.startTime || '09:00')}-{formatTime12Hour(availability.endTime || '17:00')}
                        </Text>
                      </Pressable>
                    );
                  } else {
                    cellStyle = styles.unavailableCell;
                    content = (
                      <Pressable 
                        style={styles.cellContent}
                        onPress={() => handleQuickSchedule(employee, date)}
                        disabled={isPast}
                      >
                        <MaterialIcons name="event-available" size={16} color={LOWES_THEME.textSubtle} />
                        <Text style={styles.clickToScheduleText}>Tap</Text>
                      </Pressable>
                    );
                  }

                  return (
                    <View key={index} style={[styles.dayColumn, cellStyle, isPast && styles.pastCell]}>
                      {content}
                    </View>
                  );
                })}
              </View>
            ))}
          </View>
        </ScrollView>
      </ScrollView>

      {/* Quick Schedule Modal */}
      <Modal
        visible={showScheduleModal}
        transparent
        animationType="slide"
        onRequestClose={() => setShowScheduleModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Schedule Employee</Text>
              <Pressable onPress={() => setShowScheduleModal(false)}>
                <MaterialIcons name="close" size={24} color={LOWES_THEME.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {selectedEmployee && selectedDay && (
                <>
                  <View style={styles.scheduleInfo}>
                    <MaterialIcons name="person" size={24} color={LOWES_THEME.primary} />
                    <View style={styles.scheduleInfoText}>
                      <Text style={styles.infoLabel}>Employee</Text>
                      <Text style={styles.infoValue}>
                        {selectedEmployee.firstName} {selectedEmployee.lastName}
                      </Text>
                    </View>
                  </View>

                  <View style={styles.scheduleInfo}>
                    <MaterialIcons name="event" size={24} color={LOWES_THEME.primary} />
                    <View style={styles.scheduleInfoText}>
                      <Text style={styles.infoLabel}>Date</Text>
                      <Text style={styles.infoValue}>
                        {new Date(selectedDay).toLocaleDateString('en-US', { 
                          weekday: 'long', 
                          month: 'long', 
                          day: 'numeric',
                          year: 'numeric'
                        })}
                      </Text>
                    </View>
                  </View>

                  {/* Availability Warning */}
                  {(() => {
                    const dayOfWeek = new Date(selectedDay).getDay();
                    const dayName = DAYS_OF_WEEK[dayOfWeek === 0 ? 6 : dayOfWeek - 1].toLowerCase();
                    const dayAvailability = selectedEmployee.availability?.[dayName as keyof typeof selectedEmployee.availability];
                    const isUnavailable = !dayAvailability || !dayAvailability.available;
                    
                    if (isUnavailable) {
                      return (
                        <View style={styles.warningBanner}>
                          <MaterialIcons name="warning" size={20} color="#FF9800" />
                          <Text style={styles.warningText}>
                            Employee marked as unavailable on this day - scheduling override
                          </Text>
                        </View>
                      );
                    }
                    return null;
                  })()}

                  <View style={styles.timeSelection}>
                    <Text style={styles.selectionLabel}>Schedule Times</Text>
                    <View style={styles.timeInputs}>
                      <View style={styles.timeInput}>
                        <TimePicker30
                          label="Start Time"
                          value={scheduleStartTime}
                          onChange={setScheduleStartTime}
                          primaryColor={LOWES_THEME.primary}
                          textColor={LOWES_THEME.text}
                        />
                      </View>
                      <View style={styles.timeInput}>
                        <TimePicker30
                          label="End Time"
                          value={scheduleEndTime}
                          onChange={setScheduleEndTime}
                          primaryColor={LOWES_THEME.primary}
                          textColor={LOWES_THEME.text}
                        />
                      </View>
                    </View>
                  </View>

                  <View style={styles.storeSelection}>
                    <Text style={styles.selectionLabel}>Select Store</Text>
                    <View style={styles.storeButtons}>
                      {STORES.map((store) => (
                        <Pressable
                          key={store.value}
                          onPress={() => setSelectedStore(store.value as any)}
                          style={[
                            styles.storeButton,
                            selectedStore === store.value && { 
                              backgroundColor: store.color,
                              borderColor: store.color,
                            },
                          ]}
                        >
                          <Text style={[
                            styles.storeButtonText,
                            selectedStore === store.value && styles.storeButtonTextActive,
                          ]}>
                            {store.label}
                          </Text>
                        </Pressable>
                      ))}
                    </View>
                  </View>

                  <View style={styles.modalActions}>
                    <Button
                      title="Cancel"
                      onPress={() => setShowScheduleModal(false)}
                      variant="outline"
                    />
                    <Button
                      title="Create Schedule"
                      onPress={handleCreateSchedule}
                      backgroundColor={LOWES_THEME.success}
                    />
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
    backgroundColor: LOWES_THEME.surface,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    marginTop: 2,
  },
  weekNav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  weekButton: {
    padding: SPACING.sm,
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
  },
  todayButton: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: LOWES_THEME.primary,
    borderRadius: 8,
  },
  todayButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  requestsSection: {
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  requestCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.warning,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  requestInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  requestName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  requestDates: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.primary,
    fontWeight: '600',
  },
  requestReason: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    fontStyle: 'italic',
  },
  requestActions: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  requestButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  approveButton: {
    backgroundColor: LOWES_THEME.success,
  },
  denyButton: {
    backgroundColor: LOWES_THEME.error,
  },
  legendCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.md,
    borderRadius: 12,
  },
  legendTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: LOWES_THEME.text,
    marginBottom: SPACING.sm,
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
  },
  legendBox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  legendText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  scheduleGrid: {
    backgroundColor: LOWES_THEME.surface,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  gridHeader: {
    flexDirection: 'row',
    backgroundColor: '#F8F8F8',
    borderBottomWidth: 2,
    borderBottomColor: LOWES_THEME.border,
  },
  gridRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  employeeColumn: {
    width: 140,
    padding: SPACING.md,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: LOWES_THEME.border,
  },
  columnHeaderText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: LOWES_THEME.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  employeeName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  dayColumn: {
    width: 100,
    padding: SPACING.sm,
    alignItems: 'center',
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#F0F0F0',
  },
  todayColumn: {
    backgroundColor: '#E3F2FD',
  },
  dayName: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: LOWES_THEME.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dayDate: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
    marginTop: 2,
  },
  todayText: {
    color: LOWES_THEME.primary,
  },
  availableCell: {
    backgroundColor: '#E8F5E9',
  },
  scheduledCell: {
    backgroundColor: '#FFF3E0',
  },
  timeOffCell: {
    backgroundColor: '#FFEBEE',
  },
  unavailableCell: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderStyle: 'dashed',
  },
  clickToScheduleText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    fontWeight: '500',
  },
  helpBanner: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: '#E8F5E9',
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.success,
  },
  helpBannerContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  helpBannerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  helpBannerText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  pastCell: {
    opacity: 0.5,
  },
  cellContent: {
    alignItems: 'center',
    gap: 2,
  },
  timeOffText: {
    fontSize: FONTS.sizes.xs,
    color: '#F44336',
    fontWeight: '600',
  },
  storeBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  storeInitial: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  timeText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.text,
    fontWeight: '600',
  },
  availableTimeText: {
    fontSize: FONTS.sizes.xs,
    color: '#4CAF50',
    fontWeight: '500',
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
    maxHeight: '80%',
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
  scheduleInfo: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    backgroundColor: LOWES_THEME.surface,
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  scheduleInfoText: {
    flex: 1,
    gap: 2,
  },
  infoLabel: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  infoValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  timeSelection: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  selectionLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  timeInputs: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  timeInput: {
    flex: 1,
  },
  storeSelection: {
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  storeButtons: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  storeButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: LOWES_THEME.border,
    alignItems: 'center',
  },
  storeButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  storeButtonTextActive: {
    color: '#FFFFFF',
  },
  modalActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    justifyContent: 'flex-end',
    paddingTop: SPACING.md,
  },
  warningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#FFF3E0',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: '#FF9800',
  },
  warningText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: '#E65100',
    lineHeight: 18,
  },
});
