// Comprehensive analytics dashboard with metrics and charts
import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { DatePicker } from '@/components/ui/DatePicker';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { Survey, Employee, TimeEntry } from '@/types';
import * as StorageService from '@/services/storageService';
import { exportSurveysToCSV, downloadCSV, shareCSV } from '@/utils/exportData';
import { Platform } from 'react-native';

type FilterType = 'all' | 'lowes' | 'homedepot';

export default function AnalyticsScreen() {
  const { surveys, employees } = useApp();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);
  const [startDate, setStartDate] = useState<Date | null>(null);
  const [endDate, setEndDate] = useState<Date | null>(null);
  const [selectedEmployee, setSelectedEmployee] = useState<string | null>(null);
  const [storeFilter, setStoreFilter] = useState<FilterType>('all');
  const [showDatePicker, setShowDatePicker] = useState<'start' | 'end' | null>(null);

  useEffect(() => {
    loadTimeEntries();
  }, []);

  const loadTimeEntries = async () => {
    const entries = await StorageService.getTimeEntries();
    setTimeEntries(entries || []);
  };

  // Filter surveys based on selected criteria
  const filteredSurveys = useMemo(() => {
    return surveys.filter(survey => {
      // Date filter
      if (startDate || endDate) {
        const surveyDate = new Date(survey.timestamp);
        if (startDate && surveyDate < startDate) return false;
        if (endDate) {
          const endOfDay = new Date(endDate);
          endOfDay.setHours(23, 59, 59, 999);
          if (surveyDate > endOfDay) return false;
        }
      }

      // Employee filter
      if (selectedEmployee && survey.employeeId !== selectedEmployee) return false;

      // Store filter
      if (storeFilter !== 'all') {
        const storeMatch = storeFilter === 'lowes' ? 'lowes' : 'homedepot';
        if (survey.store !== storeMatch) return false;
      }

      return true;
    });
  }, [surveys, startDate, endDate, selectedEmployee, storeFilter]);

  // Calculate analytics
  const analytics = useMemo(() => {
    const total = filteredSurveys.length;
    const renters = filteredSurveys.filter(s => s.category === 'renter').length;
    const surveysOnly = filteredSurveys.filter(s => s.category === 'survey').length;
    const appointments = filteredSurveys.filter(s => s.category === 'appointment').length;
    
    // Conversion rate: appointments / (surveys + appointments)
    const qualified = surveysOnly + appointments;
    const conversionRate = qualified > 0 ? ((appointments / qualified) * 100).toFixed(1) : '0';

    // Store breakdown
    const lowes = filteredSurveys.filter(s => s.store === 'lowes').length;
    const homeDepot = filteredSurveys.filter(s => s.store === 'homedepot').length;

    // Water issues breakdown
    const waterIssues = {
      tastesOdors: filteredSurveys.filter(s => s.answers.tastes_odors === 'Yes').length,
      hardWater: filteredSurveys.filter(s => s.answers.has_salt_system === 'Yes').length,
      filters: filteredSurveys.filter(s => s.answers.uses_filters === 'Yes').length,
      bottledWater: filteredSurveys.filter(s => s.answers.buys_bottled_water === 'Yes').length,
    };

    // Water source breakdown
    const waterSources = {
      city: filteredSurveys.filter(s => s.answers.water_source === 'City').length,
      well: filteredSurveys.filter(s => s.answers.water_source === 'Well').length,
    };

    // Water quality rating
    const qualityRatings = {
      excellent: filteredSurveys.filter(s => s.answers.water_quality === 'Excellent').length,
      good: filteredSurveys.filter(s => s.answers.water_quality === 'Good').length,
      fair: filteredSurveys.filter(s => s.answers.water_quality === 'Fair').length,
      poor: filteredSurveys.filter(s => s.answers.water_quality === 'Poor').length,
    };

    // Employee performance
    const employeeStats = employees.map(emp => {
      const empSurveys = filteredSurveys.filter(s => s.employeeId === emp.id);
      const empAppointments = empSurveys.filter(s => s.category === 'appointment').length;
      const empQualified = empSurveys.filter(s => s.category === 'survey' || s.category === 'appointment').length;
      const empConversion = empQualified > 0 ? ((empAppointments / empQualified) * 100).toFixed(1) : '0';

      // Calculate hours worked
      const empTimeEntries = timeEntries.filter(te => te.employeeId === emp.id);
      let totalMinutes = 0;
      empTimeEntries.forEach(entry => {
        if (startDate || endDate) {
          const entryDate = new Date(entry.clockIn);
          if (startDate && entryDate < startDate) return;
          if (endDate) {
            const endOfDay = new Date(endDate);
            endOfDay.setHours(23, 59, 59, 999);
            if (entryDate > endOfDay) return;
          }
        }

        const clockIn = new Date(entry.clockIn);
        const clockOut = entry.clockOut ? new Date(entry.clockOut) : new Date();
        const minutes = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60);
        totalMinutes += minutes;
      });
      const hoursWorked = totalMinutes / 60;
      const surveysPerHour = hoursWorked > 0 ? (empQualified / hoursWorked).toFixed(1) : '0';

      return {
        employee: emp,
        totalSurveys: empSurveys.length,
        appointments: empAppointments,
        qualified: empQualified,
        conversionRate: empConversion,
        hoursWorked: hoursWorked.toFixed(1),
        surveysPerHour,
      };
    }).filter(stat => stat.totalSurveys > 0)
      .sort((a, b) => b.qualified - a.qualified);

    return {
      total,
      renters,
      surveysOnly,
      appointments,
      conversionRate,
      lowes,
      homeDepot,
      waterIssues,
      waterSources,
      qualityRatings,
      employeeStats,
    };
  }, [filteredSurveys, employees, timeEntries, startDate, endDate]);

  const handleExport = () => {
    const csv = exportSurveysToCSV(filteredSurveys);
    const filename = `surveys_export_${new Date().toISOString().split('T')[0]}.csv`;
    
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
    setStoreFilter('all');
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Analytics Dashboard</Text>
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

          {/* Store Filter */}
          <View>
            <Text style={styles.filterLabel}>Store</Text>
            <View style={styles.chipRow}>
              <Pressable
                style={[styles.chip, storeFilter === 'all' && styles.chipActive]}
                onPress={() => setStoreFilter('all')}
              >
                <Text style={[styles.chipText, storeFilter === 'all' && styles.chipTextActive]}>
                  All Stores
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, storeFilter === 'lowes' && styles.chipActive]}
                onPress={() => setStoreFilter('lowes')}
              >
                <Text style={[styles.chipText, storeFilter === 'lowes' && styles.chipTextActive]}>
                  Lowes
                </Text>
              </Pressable>
              <Pressable
                style={[styles.chip, storeFilter === 'homedepot' && styles.chipActive]}
                onPress={() => setStoreFilter('homedepot')}
              >
                <Text style={[styles.chipText, storeFilter === 'homedepot' && styles.chipTextActive]}>
                  Home Depot
                </Text>
              </Pressable>
            </View>
          </View>

          {(startDate || endDate || selectedEmployee || storeFilter !== 'all') && (
            <Button
              title="Clear Filters"
              onPress={clearFilters}
              variant="outline"
              size="small"
              icon="clear"
            />
          )}
        </View>

        {/* Key Metrics */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Survey Performance</Text>
          <View style={styles.metricsGrid}>
            <View style={[styles.metricCard, { borderLeftColor: '#2196F3' }]}>
              <Text style={styles.metricValue}>{analytics.total}</Text>
              <Text style={styles.metricLabel}>Total Surveys</Text>
            </View>
            
            <View style={[styles.metricCard, { borderLeftColor: '#FF9800' }]}>
              <Text style={styles.metricValue}>{analytics.appointments}</Text>
              <Text style={styles.metricLabel}>Appointments</Text>
            </View>
            
            <View style={[styles.metricCard, { borderLeftColor: '#4CAF50' }]}>
              <Text style={styles.metricValue}>{analytics.conversionRate}%</Text>
              <Text style={styles.metricLabel}>Conversion Rate</Text>
            </View>
            
            <View style={[styles.metricCard, { borderLeftColor: '#9C27B0' }]}>
              <Text style={styles.metricValue}>{analytics.renters}</Text>
              <Text style={styles.metricLabel}>Renters</Text>
            </View>
          </View>
        </View>

        {/* Store Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Store Breakdown</Text>
          <View style={styles.storeCards}>
            <View style={styles.storeCard}>
              <View style={[styles.storeIcon, { backgroundColor: '#E3F2FD' }]}>
                <MaterialIcons name="store" size={32} color="#004990" />
              </View>
              <Text style={styles.storeName}>Lowes</Text>
              <Text style={styles.storeValue}>{analytics.lowes}</Text>
              <Text style={styles.storePercent}>
                {analytics.total > 0 ? ((analytics.lowes / analytics.total) * 100).toFixed(0) : 0}%
              </Text>
            </View>

            <View style={styles.storeCard}>
              <View style={[styles.storeIcon, { backgroundColor: '#FFF3E0' }]}>
                <MaterialIcons name="store" size={32} color="#FF6200" />
              </View>
              <Text style={styles.storeName}>Home Depot</Text>
              <Text style={styles.storeValue}>{analytics.homeDepot}</Text>
              <Text style={styles.storePercent}>
                {analytics.total > 0 ? ((analytics.homeDepot / analytics.total) * 100).toFixed(0) : 0}%
              </Text>
            </View>
          </View>
        </View>

        {/* Water Issues Analysis */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Common Water Issues</Text>
          <View style={styles.issuesGrid}>
            <View style={styles.issueCard}>
              <MaterialIcons name="water-drop" size={24} color="#03A9F4" />
              <Text style={styles.issueName}>Tastes/Odors</Text>
              <Text style={styles.issueValue}>{analytics.waterIssues.tastesOdors}</Text>
              <Text style={styles.issuePercent}>
                {analytics.total > 0 ? ((analytics.waterIssues.tastesOdors / analytics.total) * 100).toFixed(0) : 0}%
              </Text>
            </View>

            <View style={styles.issueCard}>
              <MaterialIcons name="opacity" size={24} color="#9C27B0" />
              <Text style={styles.issueName}>Uses Filters</Text>
              <Text style={styles.issueValue}>{analytics.waterIssues.filters}</Text>
              <Text style={styles.issuePercent}>
                {analytics.total > 0 ? ((analytics.waterIssues.filters / analytics.total) * 100).toFixed(0) : 0}%
              </Text>
            </View>

            <View style={styles.issueCard}>
              <MaterialIcons name="local-drink" size={24} color="#FF9800" />
              <Text style={styles.issueName}>Bottled Water</Text>
              <Text style={styles.issueValue}>{analytics.waterIssues.bottledWater}</Text>
              <Text style={styles.issuePercent}>
                {analytics.total > 0 ? ((analytics.waterIssues.bottledWater / analytics.total) * 100).toFixed(0) : 0}%
              </Text>
            </View>

            <View style={styles.issueCard}>
              <MaterialIcons name="filter-alt" size={24} color="#4CAF50" />
              <Text style={styles.issueName}>Salt System</Text>
              <Text style={styles.issueValue}>{analytics.waterIssues.hardWater}</Text>
              <Text style={styles.issuePercent}>
                {analytics.total > 0 ? ((analytics.waterIssues.hardWater / analytics.total) * 100).toFixed(0) : 0}%
              </Text>
            </View>
          </View>
        </View>

        {/* Water Quality Ratings */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Water Quality Ratings</Text>
          <View style={styles.qualityBars}>
            {Object.entries(analytics.qualityRatings).map(([rating, count]) => {
              const percentage = analytics.total > 0 ? (count / analytics.total) * 100 : 0;
              const colors: any = {
                excellent: '#4CAF50',
                good: '#8BC34A',
                fair: '#FF9800',
                poor: '#F44336',
              };
              
              return (
                <View key={rating} style={styles.qualityRow}>
                  <Text style={styles.qualityLabel}>{rating.charAt(0).toUpperCase() + rating.slice(1)}</Text>
                  <View style={styles.qualityBarContainer}>
                    <View 
                      style={[
                        styles.qualityBar, 
                        { width: `${percentage}%`, backgroundColor: colors[rating] }
                      ]} 
                    />
                  </View>
                  <Text style={styles.qualityValue}>{count}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* Employee Performance */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Employee Performance</Text>
          {analytics.employeeStats.length === 0 ? (
            <View style={styles.emptyState}>
              <MaterialIcons name="people" size={48} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyText}>No employee data for selected filters</Text>
            </View>
          ) : (
            <View style={styles.employeeList}>
              {analytics.employeeStats.map((stat, index) => (
                <View key={stat.employee.id} style={styles.employeeCard}>
                  <View style={styles.employeeRank}>
                    <Text style={styles.rankNumber}>#{index + 1}</Text>
                  </View>
                  
                  <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>
                      {stat.employee.firstName} {stat.employee.lastName}
                    </Text>
                    
                    <View style={styles.employeeMetrics}>
                      <View style={styles.employeeMetric}>
                        <Text style={styles.employeeMetricValue}>{stat.qualified}</Text>
                        <Text style={styles.employeeMetricLabel}>Qualified</Text>
                      </View>
                      
                      <View style={styles.employeeMetric}>
                        <Text style={styles.employeeMetricValue}>{stat.appointments}</Text>
                        <Text style={styles.employeeMetricLabel}>Appointments</Text>
                      </View>
                      
                      <View style={styles.employeeMetric}>
                        <Text style={[styles.employeeMetricValue, { color: LOWES_THEME.success }]}>
                          {stat.conversionRate}%
                        </Text>
                        <Text style={styles.employeeMetricLabel}>Conversion</Text>
                      </View>
                      
                      <View style={styles.employeeMetric}>
                        <Text style={styles.employeeMetricValue}>{stat.surveysPerHour}</Text>
                        <Text style={styles.employeeMetricLabel}>Per Hour</Text>
                      </View>
                    </View>
                  </View>
                </View>
              ))}
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
  section: {
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  filtersSection: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
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
    flexWrap: 'wrap',
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
  metricsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  metricCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    borderLeftWidth: 4,
    gap: SPACING.xs,
  },
  metricValue: {
    fontSize: 32,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  metricLabel: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  storeCards: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  storeCard: {
    flex: 1,
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  storeIcon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  storeName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  storeValue: {
    fontSize: 28,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  storePercent: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  issuesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  issueCard: {
    flex: 1,
    minWidth: '45%',
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  issueName: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
    textAlign: 'center',
  },
  issueValue: {
    fontSize: 24,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  issuePercent: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  qualityBars: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  qualityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  qualityLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
    width: 80,
  },
  qualityBarContainer: {
    flex: 1,
    height: 24,
    backgroundColor: LOWES_THEME.background,
    borderRadius: 12,
    overflow: 'hidden',
  },
  qualityBar: {
    height: '100%',
    borderRadius: 12,
  },
  qualityValue: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: LOWES_THEME.text,
    width: 40,
    textAlign: 'right',
  },
  employeeList: {
    gap: SPACING.sm,
  },
  employeeCard: {
    flexDirection: 'row',
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.md,
    borderRadius: 12,
    gap: SPACING.md,
    alignItems: 'center',
  },
  employeeRank: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: LOWES_THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  employeeInfo: {
    flex: 1,
    gap: SPACING.sm,
  },
  employeeName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  employeeMetrics: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  employeeMetric: {
    alignItems: 'center',
  },
  employeeMetricValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  employeeMetricLabel: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
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
});
