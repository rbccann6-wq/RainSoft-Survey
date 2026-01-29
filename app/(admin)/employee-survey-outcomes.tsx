// Admin page - View employee survey outcome statistics from Salesforce
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { useApp } from '@/hooks/useApp';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { DataTable, Column } from '@/components/web';

interface EmployeeOutcomeStats {
  employee_id: string;
  employee_name: string;
  total_bad_contact: number;
  total_dead: number;
  total_still_contacting: number;
  total_install: number;
  total_demo: number;
  total_surveys: number;
  install_rate: number;
  latest_sync: string | null;
}

const STAT_CATEGORIES = [
  { 
    key: 'bad_contact', 
    label: 'BCI', 
    color: '#9E9E9E', 
    icon: 'phone-disabled',
  },
  { 
    key: 'dead', 
    label: 'Dead', 
    color: '#F44336', 
    icon: 'cancel',
  },
  { 
    key: 'still_contacting', 
    label: 'Still Contacting', 
    color: '#FF9800', 
    icon: 'pending',
  },
  { 
    key: 'install', 
    label: 'Install', 
    color: '#4CAF50', 
    icon: 'check-circle',
  },
  { 
    key: 'demo', 
    label: 'Demo', 
    color: '#2196F3', 
    icon: 'play-circle-outline',
  },
];

export default function EmployeeSurveyOutcomesScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { employees } = useApp();
  const supabase = getSupabaseClient();
  
  const [loading, setLoading] = useState(true);
  const [employeeStats, setEmployeeStats] = useState<EmployeeOutcomeStats[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | '7d' | '30d' | 'all'>('30d');
  const [sortBy, setSortBy] = useState<'name' | 'install' | 'install_rate' | 'demo' | 'dead'>('install');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string | null>(null);

  useEffect(() => {
    loadEmployeeStats();
  }, [selectedPeriod]);

  useEffect(() => {
    // Re-sort when sort criteria changes
    sortEmployeeStats();
  }, [sortBy, sortOrder]);

  const loadEmployeeStats = async () => {
    setLoading(true);
    try {
      // Calculate date filter
      let dateFilter: Date | null = null;
      if (selectedPeriod === 'today') {
        dateFilter = new Date();
        dateFilter.setHours(0, 0, 0, 0);
      } else if (selectedPeriod === '7d') {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (selectedPeriod === '30d') {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 30);
      }

      // Load stats for all employees
      const employeeStatsPromises = employees.map(async (employee) => {
        let query = supabase
          .from('employee_survey_stats')
          .select('*')
          .eq('employee_id', employee.id);

        if (dateFilter) {
          query = query.gte('date', dateFilter.toISOString().split('T')[0]);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Aggregate stats for this employee
        const totals = (data || []).reduce((acc, curr) => ({
          total_bad_contact: acc.total_bad_contact + curr.bad_contact_count,
          total_dead: acc.total_dead + curr.dead_count,
          total_still_contacting: acc.total_still_contacting + curr.still_contacting_count,
          total_install: acc.total_install + curr.install_count,
          total_demo: acc.total_demo + (curr.demo_count || 0),
          total_surveys: acc.total_surveys + curr.total_surveys,
          latest_sync: acc.latest_sync || curr.last_synced_at,
        }), {
          total_bad_contact: 0,
          total_dead: 0,
          total_still_contacting: 0,
          total_install: 0,
          total_demo: 0,
          total_surveys: 0,
          latest_sync: null,
        });

        const installRate = totals.total_surveys > 0 
          ? (totals.total_install / totals.total_surveys) * 100 
          : 0;

        return {
          employee_id: employee.id,
          employee_name: `${employee.firstName} ${employee.lastName}`,
          ...totals,
          install_rate: installRate,
        };
      });

      const stats = await Promise.all(employeeStatsPromises);
      
      // Filter out employees with no surveys
      const filteredStats = stats.filter(s => s.total_surveys > 0);
      
      setEmployeeStats(filteredStats);
      sortEmployeeStats(filteredStats);
    } catch (error) {
      console.error('Error loading employee stats:', error);
      showAlert('Error', 'Failed to load employee statistics');
    } finally {
      setLoading(false);
    }
  };

  const sortEmployeeStats = (statsToSort?: EmployeeOutcomeStats[]) => {
    const stats = statsToSort || [...employeeStats];
    
    stats.sort((a, b) => {
      let compareValue = 0;
      
      switch (sortBy) {
        case 'name':
          compareValue = a.employee_name.localeCompare(b.employee_name);
          break;
        case 'install':
          compareValue = a.total_install - b.total_install;
          break;
        case 'install_rate':
          compareValue = a.install_rate - b.install_rate;
          break;
        case 'demo':
          compareValue = a.total_demo - b.total_demo;
          break;
        case 'dead':
          compareValue = a.total_dead - b.total_dead;
          break;
      }
      
      return sortOrder === 'asc' ? compareValue : -compareValue;
    });
    
    setEmployeeStats(stats);
  };

  const handleSort = (newSortBy: typeof sortBy) => {
    if (sortBy === newSortBy) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortBy(newSortBy);
      setSortOrder('desc');
    }
  };

  const getTotalStats = () => {
    const statsToAggregate = selectedEmployeeId 
      ? employeeStats.filter(s => s.employee_id === selectedEmployeeId)
      : employeeStats;
    
    return statsToAggregate.reduce((acc, curr) => ({
      total_bad_contact: acc.total_bad_contact + curr.total_bad_contact,
      total_dead: acc.total_dead + curr.total_dead,
      total_still_contacting: acc.total_still_contacting + curr.total_still_contacting,
      total_install: acc.total_install + curr.total_install,
      total_demo: acc.total_demo + curr.total_demo,
      total_surveys: acc.total_surveys + curr.total_surveys,
    }), {
      total_bad_contact: 0,
      total_dead: 0,
      total_still_contacting: 0,
      total_install: 0,
      total_demo: 0,
      total_surveys: 0,
    });
  };

  const totalStats = getTotalStats();
  const averageInstallRate = totalStats.total_surveys > 0 
    ? (totalStats.total_install / totalStats.total_surveys) * 100 
    : 0;

  const { width } = Dimensions.get('window');
  const isDesktop = width >= 1024;
  
  // Filter stats by selected employee
  const displayedStats = selectedEmployeeId
    ? employeeStats.filter(s => s.employee_id === selectedEmployeeId)
    : employeeStats;

  // Desktop view - use data table
  if (isDesktop && !loading) {
    const columns: Column<EmployeeOutcomeStats>[] = [
      {
        key: 'employee',
        label: 'Employee',
        width: 200,
        render: (item) => (
          <Text style={styles.tableName}>{item.employee_name}</Text>
        ),
      },
      {
        key: 'install',
        label: 'Install',
        width: 100,
        render: (item) => (
          <View style={styles.tableStatContainer}>
            <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
            <Text style={[styles.tableStatValue, { color: '#4CAF50' }]}>
              {item.total_install}
            </Text>
          </View>
        ),
      },
      {
        key: 'demo',
        label: 'Demo',
        width: 100,
        render: (item) => (
          <View style={styles.tableStatContainer}>
            <MaterialIcons name="play-circle-outline" size={16} color="#2196F3" />
            <Text style={[styles.tableStatValue, { color: '#2196F3' }]}>
              {item.total_demo}
            </Text>
          </View>
        ),
      },
      {
        key: 'contacting',
        label: 'Contacting',
        width: 100,
        render: (item) => (
          <View style={styles.tableStatContainer}>
            <MaterialIcons name="pending" size={16} color="#FF9800" />
            <Text style={[styles.tableStatValue, { color: '#FF9800' }]}>
              {item.total_still_contacting}
            </Text>
          </View>
        ),
      },
      {
        key: 'dead',
        label: 'Dead',
        width: 100,
        render: (item) => (
          <View style={styles.tableStatContainer}>
            <MaterialIcons name="cancel" size={16} color="#F44336" />
            <Text style={[styles.tableStatValue, { color: '#F44336' }]}>
              {item.total_dead}
            </Text>
          </View>
        ),
      },
      {
        key: 'bad_contact',
        label: 'BCI',
        width: 100,
        render: (item) => (
          <View style={styles.tableStatContainer}>
            <MaterialIcons name="phone-disabled" size={16} color="#9E9E9E" />
            <Text style={[styles.tableStatValue, { color: '#9E9E9E' }]}>
              {item.total_bad_contact}
            </Text>
          </View>
        ),
      },
      {
        key: 'total',
        label: 'Total',
        width: 100,
        render: (item) => (
          <Text style={styles.tableValue}>{item.total_surveys}</Text>
        ),
      },
      {
        key: 'rate',
        label: 'Install Rate',
        width: 120,
        render: (item) => (
          <View style={styles.tableRateContainer}>
            <Text style={[
              styles.tableRateValue, 
              { color: item.install_rate >= 10 ? '#4CAF50' : item.install_rate >= 5 ? '#FF9800' : '#F44336' }
            ]}>
              {item.install_rate.toFixed(1)}%
            </Text>
          </View>
        ),
      },
    ];

    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.desktopHeader}>
          <View>
            <Text style={styles.desktopTitle}>Employee Survey Outcomes</Text>
            <Text style={styles.desktopSubtitle}>
              {employeeStats.length} employees • {totalStats.total_surveys} total surveys tracked
            </Text>
          </View>
          
          <View style={styles.desktopActions}>
            {/* Employee Filter Dropdown */}
            <View style={styles.employeeFilter}>
              <MaterialIcons name="person" size={20} color="#FFFFFF" />
              <Pressable
                style={styles.employeeFilterButton}
                onPress={() => {
                  // Show employee picker
                  showAlert('Filter by Employee', 'Choose an employee to filter', [
                    { text: 'All Employees', onPress: () => setSelectedEmployeeId(null) },
                    ...employees.map(emp => ({
                      text: `${emp.firstName} ${emp.lastName}`,
                      onPress: () => setSelectedEmployeeId(emp.id)
                    }))
                  ]);
                }}
              >
                <Text style={styles.employeeFilterText}>
                  {selectedEmployeeId 
                    ? employees.find(e => e.id === selectedEmployeeId)?.firstName + ' ' + employees.find(e => e.id === selectedEmployeeId)?.lastName
                    : 'All Employees'}
                </Text>
                <MaterialIcons name="arrow-drop-down" size={20} color="#FFFFFF" />
              </Pressable>
            </View>
            
            <View style={styles.periodSelector}>
              {['today', '7d', '30d', 'all'].map((period) => (
                <Pressable
                  key={period}
                  onPress={() => setSelectedPeriod(period as any)}
                  style={[
                    styles.periodButtonDesktop,
                    selectedPeriod === period && styles.periodButtonActiveDesktop,
                  ]}
                >
                  <Text style={[
                    styles.periodButtonTextDesktop,
                    selectedPeriod === period && styles.periodButtonTextActiveDesktop,
                  ]}>
                    {period === 'today' ? 'Today' : period === '7d' ? '7 Days' : period === '30d' ? '30 Days' : 'All Time'}
                  </Text>
                </Pressable>
              ))}
            </View>
            
            <Pressable onPress={loadEmployeeStats} style={styles.desktopRefreshButton}>
              <MaterialIcons name="refresh" size={24} color="#FFFFFF" />
            </Pressable>
          </View>
        </View>

        {/* Summary Cards */}
        <View style={styles.desktopSummary}>
          <View style={styles.summaryCardDesktop}>
            <Text style={styles.summaryCardLabel}>BCI</Text>
            <Text style={[styles.summaryCardValue, { color: '#9E9E9E' }]}>
              {totalStats.total_bad_contact}
            </Text>
          </View>
          <View style={styles.summaryCardDesktop}>
            <Text style={styles.summaryCardLabel}>Dead</Text>
            <Text style={[styles.summaryCardValue, { color: '#F44336' }]}>
              {totalStats.total_dead}
            </Text>
          </View>
          <View style={styles.summaryCardDesktop}>
            <Text style={styles.summaryCardLabel}>Still Contacting</Text>
            <Text style={[styles.summaryCardValue, { color: '#FF9800' }]}>
              {totalStats.total_still_contacting}
            </Text>
          </View>
          <View style={styles.summaryCardDesktop}>
            <Text style={styles.summaryCardLabel}>Demo</Text>
            <Text style={[styles.summaryCardValue, { color: '#2196F3' }]}>
              {totalStats.total_demo}
            </Text>
          </View>
          <View style={styles.summaryCardDesktop}>
            <Text style={styles.summaryCardLabel}>Install</Text>
            <Text style={[styles.summaryCardValue, { color: '#4CAF50' }]}>
              {totalStats.total_install}
            </Text>
          </View>
          <View style={styles.summaryCardDesktop}>
            <Text style={styles.summaryCardLabel}>Avg Install Rate</Text>
            <Text style={[styles.summaryCardValue, { color: '#2196F3' }]}>
              {averageInstallRate.toFixed(1)}%
            </Text>
          </View>
          <View style={styles.summaryCardDesktop}>
            <Text style={styles.summaryCardLabel}>Total Surveys</Text>
            <Text style={[styles.summaryCardValue, { color: LOWES_THEME.primary }]}>
              {totalStats.total_surveys}
            </Text>
          </View>
        </View>

        <View style={styles.desktopContent}>
          <DataTable
            data={displayedStats}
            columns={columns}
            emptyMessage="No employee survey outcomes found for this period"
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
        <Text style={styles.headerTitle}>Survey Outcomes</Text>
        <Pressable onPress={loadEmployeeStats} style={styles.refreshButton}>
          <MaterialIcons name="refresh" size={24} color={LOWES_THEME.primary} />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator size="large" color={LOWES_THEME.primary} />
          <Text style={styles.loadingText}>Loading statistics...</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={styles.content}>
          {/* Info Banner */}
          <View style={styles.infoBanner}>
            <MaterialIcons name="info" size={24} color={LOWES_THEME.primary} />
            <View style={styles.infoBannerContent}>
              <Text style={styles.infoBannerTitle}>Salesforce Outcome Tracking</Text>
              <Text style={styles.infoBannerText}>
                View how employee surveys performed based on Salesforce Lead/Appointment statuses. Stats sync daily at midnight.
              </Text>
            </View>
          </View>

          {/* Employee Filter */}
          <View style={styles.employeeFilterMobile}>
            <Text style={styles.filterLabel}>Filter by Employee:</Text>
            <Pressable
              style={styles.employeeFilterButtonMobile}
              onPress={() => {
                showAlert('Filter by Employee', 'Choose an employee to filter', [
                  { text: 'All Employees', onPress: () => setSelectedEmployeeId(null) },
                  ...employees.map(emp => ({
                    text: `${emp.firstName} ${emp.lastName}`,
                    onPress: () => setSelectedEmployeeId(emp.id)
                  }))
                ]);
              }}
            >
              <MaterialIcons name="person" size={20} color={LOWES_THEME.primary} />
              <Text style={styles.employeeFilterTextMobile}>
                {selectedEmployeeId 
                  ? employees.find(e => e.id === selectedEmployeeId)?.firstName + ' ' + employees.find(e => e.id === selectedEmployeeId)?.lastName
                  : 'All Employees'}
              </Text>
              <MaterialIcons name="arrow-drop-down" size={20} color={LOWES_THEME.textSubtle} />
            </Pressable>
          </View>

          {/* Period Selector */}
          <View style={styles.periodSelector}>
            <Pressable
              onPress={() => setSelectedPeriod('today')}
              style={[
                styles.periodButton,
                selectedPeriod === 'today' && styles.periodButtonActive,
              ]}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === 'today' && styles.periodButtonTextActive,
              ]}>
                Today
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedPeriod('7d')}
              style={[
                styles.periodButton,
                selectedPeriod === '7d' && styles.periodButtonActive,
              ]}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === '7d' && styles.periodButtonTextActive,
              ]}>
                7 Days
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedPeriod('30d')}
              style={[
                styles.periodButton,
                selectedPeriod === '30d' && styles.periodButtonActive,
              ]}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === '30d' && styles.periodButtonTextActive,
              ]}>
                30 Days
              </Text>
            </Pressable>
            <Pressable
              onPress={() => setSelectedPeriod('all')}
              style={[
                styles.periodButton,
                selectedPeriod === 'all' && styles.periodButtonActive,
              ]}
            >
              <Text style={[
                styles.periodButtonText,
                selectedPeriod === 'all' && styles.periodButtonTextActive,
              ]}>
                All Time
              </Text>
            </Pressable>
          </View>

          {/* Summary Stats */}
          <View style={styles.summarySection}>
            <Text style={styles.summaryTitle}>Team Totals</Text>
            <View style={styles.summaryGrid}>
              <View style={styles.summaryCard}>
                <MaterialIcons name="phone-disabled" size={32} color="#9E9E9E" />
                <Text style={styles.summaryValue}>{totalStats.total_bad_contact}</Text>
                <Text style={styles.summaryLabel}>BCI</Text>
              </View>
              <View style={styles.summaryCard}>
                <MaterialIcons name="cancel" size={32} color="#F44336" />
                <Text style={styles.summaryValue}>{totalStats.total_dead}</Text>
                <Text style={styles.summaryLabel}>Dead</Text>
              </View>
              <View style={styles.summaryCard}>
                <MaterialIcons name="pending" size={32} color="#FF9800" />
                <Text style={styles.summaryValue}>{totalStats.total_still_contacting}</Text>
                <Text style={styles.summaryLabel}>Still Contacting</Text>
              </View>
              <View style={styles.summaryCard}>
                <MaterialIcons name="play-circle-outline" size={32} color="#2196F3" />
                <Text style={styles.summaryValue}>{totalStats.total_demo}</Text>
                <Text style={styles.summaryLabel}>Demo</Text>
              </View>
              <View style={styles.summaryCard}>
                <MaterialIcons name="check-circle" size={32} color="#4CAF50" />
                <Text style={styles.summaryValue}>{totalStats.total_install}</Text>
                <Text style={styles.summaryLabel}>Install</Text>
              </View>
              <View style={styles.summaryCard}>
                <MaterialIcons name="assessment" size={32} color="#2196F3" />
                <Text style={styles.summaryValue}>{averageInstallRate.toFixed(1)}%</Text>
                <Text style={styles.summaryLabel}>Avg Install Rate</Text>
              </View>
              <View style={styles.summaryCard}>
                <MaterialIcons name="assignment" size={32} color={LOWES_THEME.primary} />
                <Text style={styles.summaryValue}>{totalStats.total_surveys}</Text>
                <Text style={styles.summaryLabel}>Total Surveys</Text>
              </View>
            </View>
          </View>

          {/* Sort Controls */}
          <View style={styles.sortControls}>
            <Text style={styles.sortLabel}>Sort by:</Text>
            <View style={styles.sortButtons}>
              <Pressable
                onPress={() => handleSort('install')}
                style={[
                  styles.sortButton,
                  sortBy === 'install' && styles.sortButtonActive,
                ]}
              >
                <Text style={[
                  styles.sortButtonText,
                  sortBy === 'install' && styles.sortButtonTextActive,
                ]}>
                  Install {sortBy === 'install' && (sortOrder === 'desc' ? '↓' : '↑')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleSort('demo')}
                style={[
                  styles.sortButton,
                  sortBy === 'demo' && styles.sortButtonActive,
                ]}
              >
                <Text style={[
                  styles.sortButtonText,
                  sortBy === 'demo' && styles.sortButtonTextActive,
                ]}>
                  Demo {sortBy === 'demo' && (sortOrder === 'desc' ? '↓' : '↑')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleSort('dead')}
                style={[
                  styles.sortButton,
                  sortBy === 'dead' && styles.sortButtonActive,
                ]}
              >
                <Text style={[
                  styles.sortButtonText,
                  sortBy === 'dead' && styles.sortButtonTextActive,
                ]}>
                  Dead {sortBy === 'dead' && (sortOrder === 'desc' ? '↓' : '↑')}
                </Text>
              </Pressable>
              <Pressable
                onPress={() => handleSort('install_rate')}
                style={[
                  styles.sortButton,
                  sortBy === 'install_rate' && styles.sortButtonActive,
                ]}
              >
                <Text style={[
                  styles.sortButtonText,
                  sortBy === 'install_rate' && styles.sortButtonTextActive,
                ]}>
                  Rate {sortBy === 'install_rate' && (sortOrder === 'desc' ? '↓' : '↑')}
                </Text>
              </Pressable>
            </View>
          </View>

          {/* Employee List */}
          {displayedStats.length > 0 ? (
            <View style={styles.employeeList}>
              {displayedStats.map((emp, index) => (
                <View key={emp.employee_id} style={styles.employeeCard}>
                  <View style={styles.employeeHeader}>
                    <View style={styles.employeeRank}>
                      <Text style={styles.rankNumber}>#{index + 1}</Text>
                    </View>
                    <View style={styles.employeeNameSection}>
                      <Text style={styles.employeeName}>{emp.employee_name}</Text>
                      <View style={styles.employeeMetrics}>
                        <Text style={styles.metricText}>
                          {emp.total_surveys} surveys
                        </Text>
                        <Text style={styles.metricDivider}>•</Text>
                        <Text style={[
                          styles.metricText,
                          { color: emp.install_rate >= 10 ? '#4CAF50' : emp.install_rate >= 5 ? '#FF9800' : '#F44336' }
                        ]}>
                          {emp.install_rate.toFixed(1)}% Install Rate
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <View style={styles.statIcon}>
                        <MaterialIcons name="check-circle" size={20} color="#4CAF50" />
                      </View>
                      <View>
                        <Text style={styles.statValue}>{emp.total_install}</Text>
                        <Text style={styles.statLabel}>Install</Text>
                      </View>
                    </View>
                    <View style={styles.statBox}>
                      <View style={styles.statIcon}>
                        <MaterialIcons name="pending" size={20} color="#FF9800" />
                      </View>
                      <View>
                        <Text style={styles.statValue}>{emp.total_still_contacting}</Text>
                        <Text style={styles.statLabel}>Contacting</Text>
                      </View>
                    </View>
                    <View style={styles.statBox}>
                      <View style={styles.statIcon}>
                        <MaterialIcons name="play-circle-outline" size={20} color="#2196F3" />
                      </View>
                      <View>
                        <Text style={styles.statValue}>{emp.total_demo}</Text>
                        <Text style={styles.statLabel}>Demo</Text>
                      </View>
                    </View>
                  </View>
                  
                  <View style={styles.statsRow}>
                    <View style={styles.statBox}>
                      <View style={styles.statIcon}>
                        <MaterialIcons name="cancel" size={20} color="#F44336" />
                      </View>
                      <View>
                        <Text style={styles.statValue}>{emp.total_dead}</Text>
                        <Text style={styles.statLabel}>Dead</Text>
                      </View>
                    </View>
                    <View style={styles.statBox}>
                      <View style={styles.statIcon}>
                        <MaterialIcons name="phone-disabled" size={20} color="#9E9E9E" />
                      </View>
                      <View>
                        <Text style={styles.statValue}>{emp.total_bad_contact}</Text>
                        <Text style={styles.statLabel}>BCI</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.employeeFooter}>
                    <Text style={styles.totalText}>Total Surveys: {emp.total_surveys}</Text>
                    {emp.latest_sync && (
                      <Text style={styles.syncText}>
                        Synced: {new Date(emp.latest_sync).toLocaleDateString()}
                      </Text>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="bar-chart" size={64} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyTitle}>No Survey Outcomes</Text>
              <Text style={styles.emptyText}>
                No employee survey outcomes found for this period. Stats sync daily from Salesforce.
              </Text>
            </View>
          )}
        </ScrollView>
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
  refreshButton: {
    padding: SPACING.sm,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
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
    gap: SPACING.xs,
  },
  infoBannerTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  infoBannerText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  periodSelector: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  periodButton: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: LOWES_THEME.border,
    alignItems: 'center',
  },
  periodButtonActive: {
    backgroundColor: LOWES_THEME.primary,
    borderColor: LOWES_THEME.primary,
  },
  periodButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
  },
  periodButtonTextActive: {
    color: '#FFFFFF',
  },
  summarySection: {
    gap: SPACING.md,
  },
  summaryTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  summaryGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
  },
  summaryCard: {
    flex: 1,
    minWidth: 150,
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  summaryValue: {
    fontSize: 28,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  summaryLabel: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    textAlign: 'center',
  },
  sortControls: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  sortLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
  },
  sortButtons: {
    flexDirection: 'row',
    gap: SPACING.xs,
    flex: 1,
  },
  sortButton: {
    flex: 1,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
    alignItems: 'center',
  },
  sortButtonActive: {
    backgroundColor: LOWES_THEME.primary,
    borderColor: LOWES_THEME.primary,
  },
  sortButtonText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
  },
  sortButtonTextActive: {
    color: '#FFFFFF',
  },
  employeeList: {
    gap: SPACING.md,
  },
  employeeCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  employeeRank: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: LOWES_THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankNumber: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  employeeNameSection: {
    flex: 1,
  },
  employeeName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  employeeMetrics: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: 2,
  },
  metricText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  metricDivider: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  statsRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  statBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#F8F8F8',
    padding: SPACING.sm,
    borderRadius: 8,
  },
  statIcon: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  statLabel: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  employeeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  totalText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  syncText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl * 3,
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
    textAlign: 'center',
    lineHeight: 22,
    paddingHorizontal: SPACING.xl,
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
  desktopActions: {
    flexDirection: 'row',
    gap: SPACING.md,
    alignItems: 'center',
  },
  periodButtonDesktop: {
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  periodButtonActiveDesktop: {
    backgroundColor: '#FFFFFF',
  },
  periodButtonTextDesktop: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
  },
  periodButtonTextActiveDesktop: {
    color: LOWES_THEME.primary,
  },
  desktopRefreshButton: {
    padding: SPACING.md,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  desktopSummary: {
    flexDirection: 'row',
    gap: SPACING.lg,
    padding: SPACING.xl,
    backgroundColor: LOWES_THEME.surface,
  },
  summaryCardDesktop: {
    flex: 1,
    padding: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    alignItems: 'center',
  },
  summaryCardLabel: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    marginBottom: SPACING.xs,
  },
  summaryCardValue: {
    fontSize: 32,
    fontWeight: '700',
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
  tableStatContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  tableStatValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  tableValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  tableRateContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  tableRateValue: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
  },
  employeeFilter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 8,
  },
  employeeFilterButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  employeeFilterText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },
  employeeFilterMobile: {
    gap: SPACING.xs,
  },
  filterLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  employeeFilterButtonMobile: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
    borderRadius: 8,
    borderWidth: 2,
    borderColor: LOWES_THEME.border,
    backgroundColor: LOWES_THEME.surface,
  },
  employeeFilterTextMobile: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
});
