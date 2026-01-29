// Time clock data export with filtering
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { DatePicker } from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { TimeEntry } from '@/types';
import * as StorageService from '@/services/storageService';
import * as ActivityService from '@/services/activityService';
import { exportTimeEntriesToCSV, downloadCSV, shareCSV } from '@/utils/exportData';
import { Platform } from 'react-native';
import { formatFullDateTime } from '@/utils/timeFormat';

export default function TimeClockExportScreen() {
  const { employees } = useApp();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [inactivityLogs, setInactivityLogs] = useState<any[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    const [entries, logs] = await Promise.all([
      StorageService.getTimeEntries(),
      ActivityService.getAllInactivityLogs(),
    ]);
    setTimeEntries(entries || []);
    setInactivityLogs(logs || []);
  };

  // Filter time entries
  const filteredEntries = useMemo(() => {
    return timeEntries.filter(entry => {
      // Date filter
      if (startDate || endDate) {
        const entryDate = new Date(entry.clockIn);
        if (startDate && entryDate < startDate) return false;
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (entryDate > endOfDay) return false;
        }
      }

      // Employee filter
      if (selectedEmployee && entry.employeeId !== selectedEmployee) return false;

      return true;
    });
  }, [timeEntries, startDate, endDate, selectedEmployee]);

  // Calculate stats including inactivity
  const stats = useMemo(() => {
    let totalHours = 0;
    let totalInactivityMinutes = 0;
    let completedShifts = 0;
    let activeShifts = 0;

    filteredEntries.forEach(entry => {
      if (entry.clockOut) {
        const clockIn = new Date(entry.clockIn);
        const clockOut = new Date(entry.clockOut);
        const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
        totalHours += hours;
        completedShifts++;
      } else {
        activeShifts++;
      }

      // Calculate inactivity for this time entry
      const entryInactivity = inactivityLogs.filter(log => 
        log.time_entry_id === entry.id
      );
      entryInactivity.forEach(log => {
        totalInactivityMinutes += log.inactive_duration_minutes || 0;
      });
    });

    return {
      totalEntries: filteredEntries.length,
      completedShifts,
      activeShifts,
      totalHours: totalHours.toFixed(1),
      totalInactivity: (totalInactivityMinutes / 60).toFixed(1),
    };
  }, [filteredEntries, inactivityLogs]);

  const handleExport = () => {
    const csv = exportTimeEntriesToCSV(filteredEntries, employees);
    const filename = `time_entries_export_${new Date().toISOString().split('T')[0]}.csv`;
    
    if (Platform.OS === 'web') {
      downloadCSV(csv, filename);
    } else {
      shareCSV(csv, filename);
    }
  };

  const clearFilters = () => {
    setStartDate(null);
    setEndDate(null);
    setSelectedEmployee(null);
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Time Clock Export</Text>
        <Button
          title="Export CSV"
          onPress={handleExport}
          icon="download"
          variant="outline"
          size="small"
        />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Filters */}
        <View style={styles.filtersSection}>
          <Text style={styles.sectionTitle}>Filters</Text>
          
          {/* Date Range */}
          <View style={styles.filterRow}>
            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>Start Date</Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker('start')}
              >
                <MaterialIcons name="calendar-today" size={18} color={LOWES_THEME.primary} />
                <Text style={styles.dateButtonText}>
                  {startDate ? startDate.toLocaleDateString() : 'Select date'}
                </Text>
              </Pressable>
            </View>

            <View style={{ flex: 1 }}>
              <Text style={styles.filterLabel}>End Date</Text>
              <Pressable
                style={styles.dateButton}
                onPress={() => setShowDatePicker('end')}
              >
                <MaterialIcons name="calendar-today" size={18} color={LOWES_THEME.primary} />
                <Text style={styles.dateButtonText}>
                  {endDate ? endDate.toLocaleDateString() : 'Select date'}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Employee Filter */}
          <View>
            <Text style={styles.filterLabel}>Employee</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={styles.chipRow}>
                <Pressable
                  style={[styles.chip, !selectedEmployee && styles.chipActive]}
                  onPress={() => setSelectedEmployee(null)}
                >
                  <Text style={[styles.chipText, !selectedEmployee && styles.chipTextActive]}>
                    All Employees
                  </Text>
                </Pressable>
                {employees.map(emp => (
                  <Pressable
                    key={emp.id}
                    style={[styles.chip, selectedEmployee === emp.id && styles.chipActive]}
                    onPress={() => setSelectedEmployee(emp.id)}
                  >
                    <Text style={[styles.chipText, selectedEmployee === emp.id && styles.chipTextActive]}>
                      {emp.firstName} {emp.lastName}
                    </Text>
                  </Pressable>
                ))}
              </View>
            </ScrollView>
          </View>

          {(startDate || endDate || selectedEmployee) && (
            <Button
              title="Clear Filters"
              onPress={clearFilters}
              variant="outline"
              size="small"
              icon="clear"
            />
          )}
        </View>

        {/* Stats */}
        <View style={styles.statsGrid}>
          <View style={[styles.statCard, { borderLeftColor: '#2196F3' }]}>
            <Text style={styles.statValue}>{stats.totalEntries}</Text>
            <Text style={styles.statLabel}>Total Entries</Text>
          </View>
          
          <View style={[styles.statCard, { borderLeftColor: '#4CAF50' }]}>
            <Text style={styles.statValue}>{stats.completedShifts}</Text>
            <Text style={styles.statLabel}>Completed</Text>
          </View>
          
          <View style={[styles.statCard, { borderLeftColor: '#FF9800' }]}>
            <Text style={styles.statValue}>{stats.activeShifts}</Text>
            <Text style={styles.statLabel}>Active</Text>
          </View>
          
          <View style={[styles.statCard, { borderLeftColor: '#9C27B0' }]}>
            <Text style={styles.statValue}>{stats.totalHours}</Text>
            <Text style={styles.statLabel}>Total Hours</Text>
          </View>
          
          <View style={[styles.statCard, { borderLeftColor: '#F44336' }]}>
            <Text style={styles.statValue}>{stats.totalInactivity}</Text>
            <Text style={styles.statLabel}>Inactivity (hrs)</Text>
          </View>
        </View>

        {/* Time Entries List */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>
            Time Entries ({filteredEntries.length})
          </Text>
          
          {filteredEntries.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="access-time" size={48} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyText}>No time entries for selected filters</Text>
            </View>
          ) : (
            <View style={styles.entriesList}>
              {filteredEntries.map((entry) => {
                const employee = employees.find(e => e.id === entry.employeeId);
                const clockIn = new Date(entry.clockIn);
                const clockOut = entry.clockOut ? new Date(entry.clockOut) : null;
                const hours = clockOut
                  ? ((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)).toFixed(2)
                  : 'Active';

                // Get inactivity logs for this time entry
                const entryInactivityLogs = inactivityLogs.filter(log => 
                  log.time_entry_id === entry.id
                );
                const totalInactivityMinutes = entryInactivityLogs.reduce((sum, log) => 
                  sum + (log.inactive_duration_minutes || 0), 0
                );

                return (
                  <View key={entry.id} style={styles.entryCard}>
                    <View style={styles.entryHeader}>
                      <View style={styles.employeeInfo}>
                        <Text style={styles.employeeName}>
                          {employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown'}
                        </Text>
                        <View style={[
                          styles.storeBadge,
                          { backgroundColor: entry.store === 'lowes' ? '#E3F2FD' : '#FFF3E0' }
                        ]}>
                          <MaterialIcons
                            name="store"
                            size={12}
                            color={entry.store === 'lowes' ? '#004990' : '#FF6200'}
                          />
                          <Text style={[
                            styles.storeText,
                            { color: entry.store === 'lowes' ? '#004990' : '#FF6200' }
                          ]}>
                            {entry.store === 'lowes' ? 'Lowes' : 'Home Depot'}
                          </Text>
                        </View>
                      </View>
                      
                      <Text style={[
                        styles.hoursText,
                        !clockOut && { color: LOWES_THEME.success }
                      ]}>
                        {hours} {clockOut ? 'hrs' : ''}
                      </Text>
                    </View>

                    <View style={styles.entryDetails}>
                      <View style={styles.timeRow}>
                        <MaterialIcons name="login" size={16} color={LOWES_THEME.success} />
                        <Text style={styles.timeLabel}>Clock In:</Text>
                        <Text style={styles.timeValue}>{formatFullDateTime(entry.clockIn)}</Text>
                      </View>

                      {entry.clockOut && (
                        <View style={styles.timeRow}>
                          <MaterialIcons name="logout" size={16} color={LOWES_THEME.error} />
                          <Text style={styles.timeLabel}>Clock Out:</Text>
                          <Text style={styles.timeValue}>{formatFullDateTime(entry.clockOut)}</Text>
                        </View>
                      )}

                      {entry.storeName && (
                        <View style={styles.timeRow}>
                          <MaterialIcons name="location-on" size={16} color={LOWES_THEME.textSubtle} />
                          <Text style={styles.timeLabel}>Location:</Text>
                          <Text style={styles.timeValue}>{entry.storeName}</Text>
                        </View>
                      )}
                    </View>

                    {/* Inactivity Section */}
                    {totalInactivityMinutes > 0 && (
                      <View style={styles.inactivitySection}>
                        <View style={styles.inactivityHeader}>
                          <MaterialIcons name="pause-circle-outline" size={20} color="#F44336" />
                          <Text style={styles.inactivityTitle}>
                            Inactive Periods ({(totalInactivityMinutes / 60).toFixed(1)} hrs total)
                          </Text>
                        </View>
                        <View style={styles.inactivityList}>
                          {entryInactivityLogs.map((log, index) => {
                            const detectedDate = new Date(log.detected_at);
                            const lastActivity = new Date(log.last_activity_at);
                            const endTime = new Date(lastActivity.getTime() + log.inactive_duration_minutes * 60 * 1000);
                            
                            return (
                              <View key={log.id || index} style={styles.inactivityItem}>
                                <Text style={styles.inactivityDate}>
                                  {detectedDate.toLocaleDateString()}
                                </Text>
                                <Text style={styles.inactivityTime}>
                                  {lastActivity.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                  {' - '}
                                  {endTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                                </Text>
                                <Text style={styles.inactivityDuration}>
                                  {log.inactive_duration_minutes} min
                                </Text>
                              </View>
                            );
                          })}
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          )}
        </View>
      </ScrollView>

      {/* Date Picker Modal */}
      {showDatePicker && (
        <DatePicker
          value={showDatePicker === 'start' ? startDate : endDate}
          onChange={(date) => {
            if (showDatePicker === 'start') {
              setStartDate(date);
            } else {
              setEndDate(date);
            }
            setShowDatePicker(null);
          }}
          onClose={() => setShowDatePicker(null)}
        />
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
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.xl,
  },
  filtersSection: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  section: {
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  filterRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  filterLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
    marginBottom: SPACING.xs,
  },
  dateButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: LOWES_THEME.background,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  dateButtonText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
  },
  chipRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  chip: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    backgroundColor: LOWES_THEME.background,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  chipActive: {
    backgroundColor: LOWES_THEME.primary,
    borderColor: LOWES_THEME.primary,
  },
  chipText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  chipTextActive: {
    color: '#FFFFFF',
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
    borderLeftWidth: 4,
    gap: SPACING.xs,
  },
  statValue: {
    fontSize: 32,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  statLabel: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  entriesList: {
    gap: SPACING.sm,
  },
  entryCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  entryHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  employeeInfo: {
    gap: SPACING.xs,
  },
  employeeName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
    alignSelf: 'flex-start',
  },
  storeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  hoursText: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  entryDetails: {
    gap: SPACING.sm,
  },
  timeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  timeLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
    width: 80,
  },
  timeValue: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    flex: 1,
  },
  emptyState: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.xxl,
    borderRadius: 12,
    alignItems: 'center',
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
  },
  inactivitySection: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
    gap: SPACING.sm,
  },
  inactivityHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  inactivityTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: '#F44336',
  },
  inactivityList: {
    gap: SPACING.xs,
  },
  inactivityItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    backgroundColor: '#FFEBEE',
    borderRadius: 6,
  },
  inactivityDate: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    width: 80,
  },
  inactivityTime: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.text,
    flex: 1,
  },
  inactivityDuration: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: '#F44336',
  },
});
