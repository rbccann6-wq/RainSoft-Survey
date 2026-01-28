// Live manager dashboard - Monitor clocked-in employees
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { Employee, TimeEntry } from '@/types';
import { formatDateTime12Hour } from '@/utils/timeFormat';
import { DataTable, Column } from '@/components/web';

interface EmployeeStatus {
  employee: Employee;
  timeEntry: TimeEntry;
  todayStats: {
    surveys: number;
    appointments: number;
  };
  isInactive: boolean;
  inactiveMinutes: number;
  notInApp?: boolean;
}

export default function LiveDashboard() {
  const { getClockedInEmployees, surveys } = useApp();
  const [clockedInEmployees, setClockedInEmployees] = useState<EmployeeStatus[]>([]);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    loadClockedInEmployees();
    
    // Auto-refresh every 30 seconds
    const interval = setInterval(loadClockedInEmployees, 30000);
    return () => clearInterval(interval);
  }, []);

  const loadClockedInEmployees = async () => {
    const employees = await getClockedInEmployees();
    
    // Enhanced: Check for actual inactivity based on last survey/activity + "Not in app" detection
    const now = Date.now();
    const inactivityThreshold = 15 * 60 * 1000; // 15 minutes
    
    const enhancedEmployees = employees.map(emp => {
      // Find employee's surveys today
      const today = new Date().toISOString().split('T')[0];
      const employeeSurveysToday = surveys.filter(s => 
        s.employeeId === emp.employee.id && 
        s.timestamp.startsWith(today)
      );
      
      // Get last activity time
      let lastActivityTime: number;
      let activitySource = 'clock_in';
      let notInApp = false;
      
      if (employeeSurveysToday.length > 0) {
        // Use last survey time as last activity
        const lastSurvey = employeeSurveysToday.sort((a, b) => 
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        )[0];
        lastActivityTime = new Date(lastSurvey.timestamp).getTime();
        activitySource = 'survey';
        // Check if last survey was more than 60s ago (heartbeat timeout)
        notInApp = (now - lastActivityTime) > 60 * 1000;
      } else {
        // No surveys today = definitely not in app
        lastActivityTime = new Date(emp.timeEntry.clockIn).getTime();
        activitySource = 'clock_in';
        notInApp = true;
      }
      
      const inactiveMinutes = Math.floor((now - lastActivityTime) / (1000 * 60));
      const isInactive = (now - lastActivityTime) > inactivityThreshold;
      
      return {
        ...emp,
        isInactive,
        notInApp,
        inactiveMinutes,
      };
    });
    
    setClockedInEmployees(enhancedEmployees);
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await loadClockedInEmployees();
    setRefreshing(false);
  };

  const getHoursWorked = (clockIn: string) => {
    const start = new Date(clockIn);
    const now = new Date();
    const hours = (now.getTime() - start.getTime()) / (1000 * 60 * 60);
    return hours.toFixed(1);
  };

  const getSurveysPerHour = (stats: { surveys: number; appointments: number }, clockIn: string) => {
    const hours = parseFloat(getHoursWorked(clockIn));
    if (hours === 0) return '0.0';
    const qualified = stats.surveys + stats.appointments;
    return (qualified / hours).toFixed(1);
  };

  const getPerformanceColor = (surveysPerHour: string) => {
    const rate = parseFloat(surveysPerHour);
    if (rate >= 5) return '#4CAF50'; // Green - meeting quota
    if (rate >= 3) return '#FF9800'; // Orange - needs improvement
    return '#F44336'; // Red - below expectations
  };

  const { width } = Dimensions.get('window');
  const isDesktop = width >= 1024;

  // Desktop view - use data table
  if (isDesktop) {
    const columns: Column<EmployeeStatus>[] = [
      {
        key: 'employee',
        label: 'Employee',
        width: 200,
        render: (item) => (
          <View>
            <Text style={styles.tableName}>
              {item.employee.firstName} {item.employee.lastName}
            </Text>
            <Text style={styles.tableSubtext}>
              {item.timeEntry.store === 'lowes' ? 'Lowes' : 'Home Depot'}
            </Text>
          </View>
        ),
      },
      {
        key: 'status',
        label: 'Status',
        width: 180,
        render: (item) => (
          <View style={styles.tableBadgeContainer}>
            {item.notInApp ? (
              <View style={[styles.tableStatusBadge, { backgroundColor: '#F44336' }]}>
                <MaterialIcons name="phonelink-off" size={14} color="#FFFFFF" />
                <Text style={styles.tableStatusText}>NOT IN APP</Text>
              </View>
            ) : item.isInactive ? (
              <View style={[styles.tableStatusBadge, { backgroundColor: '#FF9800' }]}>
                <MaterialIcons name="pause-circle-outline" size={14} color="#FFFFFF" />
                <Text style={styles.tableStatusText}>INACTIVE {item.inactiveMinutes}m</Text>
              </View>
            ) : (
              <View style={[styles.tableStatusBadge, { backgroundColor: '#4CAF50' }]}>
                <MaterialIcons name="check-circle" size={14} color="#FFFFFF" />
                <Text style={styles.tableStatusText}>ACTIVE</Text>
              </View>
            )}
          </View>
        ),
      },
      {
        key: 'hours',
        label: 'Hours',
        width: 100,
        render: (item) => (
          <Text style={styles.tableValue}>{getHoursWorked(item.timeEntry.clockIn)}</Text>
        ),
      },
      {
        key: 'surveys',
        label: 'Qualified',
        width: 100,
        render: (item) => (
          <Text style={styles.tableValue}>
            {item.todayStats.surveys + item.todayStats.appointments}
          </Text>
        ),
      },
      {
        key: 'appointments',
        label: 'Appointments',
        width: 120,
        render: (item) => (
          <Text style={styles.tableValue}>{item.todayStats.appointments}</Text>
        ),
      },
      {
        key: 'rate',
        label: 'Per Hour',
        width: 120,
        render: (item) => {
          const rate = getSurveysPerHour(item.todayStats, item.timeEntry.clockIn);
          const color = getPerformanceColor(rate);
          return (
            <View style={styles.tableRateContainer}>
              <Text style={[styles.tableRateValue, { color }]}>{rate}</Text>
              <MaterialIcons
                name={parseFloat(rate) >= 5 ? 'check-circle' : 'warning'}
                size={16}
                color={color}
              />
            </View>
          );
        },
      },
      {
        key: 'clockIn',
        label: 'Clocked In',
        width: 180,
        render: (item) => (
          <Text style={styles.tableSubtext}>
            {formatDateTime12Hour(item.timeEntry.clockIn)}
          </Text>
        ),
      },
    ];

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.desktopHeader}>
          <View>
            <Text style={styles.desktopTitle}>Live Dashboard</Text>
            <Text style={styles.desktopSubtitle}>
              {clockedInEmployees.length} employee{clockedInEmployees.length !== 1 ? 's' : ''} clocked in • Auto-refreshes every 30s
            </Text>
          </View>
          <Pressable onPress={handleRefresh} style={styles.desktopRefreshButton}>
            <MaterialIcons name="refresh" size={24} color="#FFFFFF" />
            <Text style={styles.desktopRefreshText}>Refresh</Text>
          </Pressable>
        </View>

        <View style={styles.desktopContent}>
          <DataTable
            data={clockedInEmployees}
            columns={columns}
            emptyMessage="No employees currently clocked in"
          />
        </View>
      </SafeAreaView>
    );
  }

  // Mobile/Tablet view - original card layout
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Live Dashboard</Text>
          <Text style={styles.headerSubtitle}>
            {clockedInEmployees.length} employee{clockedInEmployees.length !== 1 ? 's' : ''} clocked in
          </Text>
        </View>
        <Pressable onPress={handleRefresh} style={styles.refreshButton}>
          <MaterialIcons name="refresh" size={24} color="#0066CC" />
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={handleRefresh} />
        }
      >
        {clockedInEmployees.length === 0 ? (
          <View style={styles.emptyState}>
            <MaterialIcons name="people-outline" size={64} color="#CCCCCC" />
            <Text style={styles.emptyText}>No employees clocked in</Text>
            <Text style={styles.emptySubtext}>
              Employees will appear here when they clock in
            </Text>
          </View>
        ) : (
          clockedInEmployees.map(({ employee, timeEntry, todayStats, isInactive, inactiveMinutes, notInApp }) => {
            const surveysPerHour = getSurveysPerHour(todayStats, timeEntry.clockIn);
            const performanceColor = getPerformanceColor(surveysPerHour);
            const qualifiedSurveys = todayStats.surveys + todayStats.appointments;

            return (
              <View key={employee.id} style={styles.employeeCard}>
                {/* Header Row */}
                <View style={styles.cardHeader}>
                  <View style={styles.employeeInfo}>
                    <Text style={styles.employeeName}>
                      {employee.firstName} {employee.lastName}
                    </Text>
                    <View style={styles.storeRow}>
                      <MaterialIcons name="store" size={14} color="#666" />
                      <Text style={styles.storeText}>
                        {timeEntry.store === 'lowes' ? 'Lowes' : 'Home Depot'}
                      </Text>
                    </View>
                  </View>

                  {/* Status Badges - Show separately for clarity */}
                  <View style={styles.statusBadgeContainer}>
                    {notInApp && (
                      <View style={[styles.statusBadge, { backgroundColor: '#F44336' }]}>
                        <MaterialIcons name="phonelink-off" size={16} color="#FFFFFF" />
                        <Text style={styles.statusText}>NOT IN APP</Text>
                      </View>
                    )}
                    {!notInApp && isInactive && (
                      <View style={[styles.statusBadge, { backgroundColor: '#FF9800' }]}>
                        <MaterialIcons name="pause-circle-outline" size={16} color="#FFFFFF" />
                        <Text style={styles.statusText}>INACTIVE {inactiveMinutes}m</Text>
                      </View>
                    )}
                    {!notInApp && !isInactive && (
                      <View style={[styles.statusBadge, { backgroundColor: '#4CAF50' }]}>
                        <MaterialIcons name="check-circle" size={16} color="#FFFFFF" />
                        <Text style={styles.statusText}>ACTIVE</Text>
                      </View>
                    )}
                  </View>
                </View>

                {/* Stats Grid */}
                <View style={styles.statsGrid}>
                  {/* Hours Worked */}
                  <View style={styles.statBox}>
                    <MaterialIcons name="access-time" size={20} color="#666" />
                    <Text style={styles.statValue}>{getHoursWorked(timeEntry.clockIn)}</Text>
                    <Text style={styles.statLabel}>Hours</Text>
                  </View>

                  {/* Qualified Surveys */}
                  <View style={styles.statBox}>
                    <MaterialIcons name="assignment" size={20} color="#666" />
                    <Text style={styles.statValue}>{qualifiedSurveys}</Text>
                    <Text style={styles.statLabel}>Qualified</Text>
                  </View>

                  {/* Appointments */}
                  <View style={styles.statBox}>
                    <MaterialIcons name="event" size={20} color="#666" />
                    <Text style={styles.statValue}>{todayStats.appointments}</Text>
                    <Text style={styles.statLabel}>Appointments</Text>
                  </View>

                  {/* Performance Rate */}
                  <View style={[styles.statBox, styles.performanceBox]}>
                    <MaterialIcons name="speed" size={20} color={performanceColor} />
                    <Text style={[styles.statValue, { color: performanceColor }]}>
                      {surveysPerHour}
                    </Text>
                    <Text style={styles.statLabel}>Per Hour</Text>
                  </View>
                </View>

                {/* Performance Indicator */}
                <View style={styles.performanceBar}>
                  <View
                    style={[
                      styles.performanceFill,
                      {
                        width: `${Math.min((parseFloat(surveysPerHour) / 5) * 100, 100)}%`,
                        backgroundColor: performanceColor,
                      },
                    ]}
                  />
                </View>
                <Text style={[styles.performanceText, { color: performanceColor }]}>
                  {parseFloat(surveysPerHour) >= 5
                    ? '✓ Meeting Quota (5/hr)'
                    : `Need ${(5 - parseFloat(surveysPerHour)).toFixed(1)} more per hour for quota`}
                </Text>

                {/* Clock In Details */}
                <View style={styles.detailsRow}>
                  <MaterialIcons name="schedule" size={14} color="#999" />
                  <Text style={styles.detailText}>
                    Clocked in at {formatDateTime12Hour(timeEntry.clockIn)}
                  </Text>
                </View>

                {timeEntry.gpsCoordinates && (
                  <View style={styles.detailsRow}>
                    <MaterialIcons name="location-on" size={14} color="#999" />
                    <Text style={styles.detailText}>
                      {timeEntry.gpsCoordinates.latitude.toFixed(4)}, {timeEntry.gpsCoordinates.longitude.toFixed(4)}
                    </Text>
                  </View>
                )}
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LOWES_THEME.background,
  },
  // Desktop styles
  desktopHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: LOWES_THEME.primary,
  },
  desktopTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  desktopSubtitle: {
    fontSize: FONTS.sizes.md,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: SPACING.xs,
  },
  desktopRefreshButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  desktopRefreshText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  desktopContent: {
    flex: 1,
    padding: SPACING.xl,
  },
  tableName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  tableSubtext: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    marginTop: 2,
  },
  tableBadgeContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
  },
  tableStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.sm,
    paddingVertical: 6,
    borderRadius: 12,
    alignSelf: 'flex-start',
  },
  tableStatusText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  tableValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  tableRateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  tableRateValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: '#666',
    marginTop: 2,
  },
  refreshButton: {
    padding: SPACING.sm,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: SPACING.xl * 2,
  },
  emptyText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: '#999',
    marginTop: SPACING.md,
  },
  emptySubtext: {
    fontSize: FONTS.sizes.sm,
    color: '#CCCCCC',
    marginTop: SPACING.xs,
  },
  employeeCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: SPACING.lg,
    gap: SPACING.md,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  cardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  employeeInfo: {
    flex: 1,
    gap: SPACING.xs,
  },
  employeeName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  storeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  storeText: {
    fontSize: FONTS.sizes.sm,
    color: '#666',
  },
  statusBadgeContainer: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flexWrap: 'wrap',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: SPACING.md,
    paddingVertical: 6,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  statsGrid: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statBox: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.md,
    backgroundColor: '#F8F8F8',
    borderRadius: 12,
    gap: SPACING.xs,
  },
  performanceBox: {
    backgroundColor: '#FFF8F0',
  },
  statValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: '#666',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  performanceBar: {
    height: 6,
    backgroundColor: '#E0E0E0',
    borderRadius: 3,
    overflow: 'hidden',
  },
  performanceFill: {
    height: '100%',
    borderRadius: 3,
  },
  performanceText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    textAlign: 'center',
  },
  detailsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  detailText: {
    fontSize: FONTS.sizes.xs,
    color: '#999',
  },
});
