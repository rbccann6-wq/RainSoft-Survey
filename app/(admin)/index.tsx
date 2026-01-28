// Modern admin dashboard with menu navigation and live metrics
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import * as StorageService from '@/services/storageService';
import { TimeEntry } from '@/types';

interface MenuSection {
  title: string;
  items: MenuItem[];
}

interface MenuItem {
  icon: keyof typeof MaterialIcons.glyphMap;
  label: string;
  route: string;
  color: string;
  description: string;
}

export default function AdminDashboard() {
  const router = useRouter();
  const { currentUser, employees, surveys, isOnline, logout } = useApp();
  const [timeEntries, setTimeEntries] = useState<TimeEntry[]>([]);

  useEffect(() => {
    loadTimeEntries();
    const interval = setInterval(loadTimeEntries, 30000); // Refresh every 30 seconds
    return () => clearInterval(interval);
  }, []);

  const loadTimeEntries = async () => {
    const entries = await StorageService.getTimeEntries();
    setTimeEntries(entries || []);
  };

  // Calculate metrics
  const activeEmployees = employees.filter(e => e.status === 'active');
  const clockedInEmployees = activeEmployees.filter(emp => 
    timeEntries.some(te => te.employeeId === emp.id && !te.clockOut)
  );
  
  // Check for inactive employees (no activity in last 30 minutes)
  const now = Date.now();
  const inactiveThreshold = 30 * 60 * 1000; // 30 minutes
  
  const employeeStatus = clockedInEmployees.map(emp => {
    const latestEntry = timeEntries
      .filter(te => te.employeeId === emp.id && !te.clockOut)
      .sort((a, b) => new Date(b.clockIn).getTime() - new Date(a.clockIn).getTime())[0];
    
    const lastActivity = latestEntry ? new Date(latestEntry.clockIn).getTime() : 0;
    const isInactive = now - lastActivity > inactiveThreshold;
    
    return {
      ...emp,
      isInactive,
      lastActivity: latestEntry?.clockIn,
      store: latestEntry?.store,
    };
  });

  const todaySurveys = surveys.filter(s => {
    const today = new Date().toISOString().split('T')[0];
    return s.timestamp.startsWith(today);
  });
  
  const totalAppointments = surveys.filter(s => s.category === 'appointment').length;
  const todayAppointments = todaySurveys.filter(s => s.category === 'appointment').length;

  const menuSections: MenuSection[] = [
    {
      title: 'Team Management',
      items: [
        {
          icon: 'dashboard',
          label: 'Live Dashboard',
          route: '/(admin)/live-dashboard',
          color: '#2196F3',
          description: 'Real-time team activity',
        },
        {
          icon: 'people',
          label: 'Employees',
          route: '/(admin)/employees',
          color: '#4CAF50',
          description: 'Manage team members',
        },
        {
          icon: 'calendar-today',
          label: 'Schedule',
          route: '/(admin)/schedule',
          color: '#FF9800',
          description: 'Team scheduling',
        },
        {
          icon: 'message',
          label: 'Messages',
          route: '/(admin)/messages',
          color: '#9C27B0',
          description: 'Team communication',
        },
      ],
    },
    {
      title: 'Survey & Data',
      items: [
        {
          icon: 'analytics',
          label: 'Analytics Dashboard',
          route: '/(admin)/analytics',
          color: '#673AB7',
          description: 'Metrics & insights',
        },
        {
          icon: 'assessment',
          label: 'Surveys',
          route: '/(admin)/surveys',
          color: '#00BCD4',
          description: 'View all surveys',
        },
        {
          icon: 'timeline',
          label: 'Survey Stats',
          route: '/(admin)/survey-stats-config',
          color: '#8BC34A',
          description: 'Configure statistics',
        },
        {
          icon: 'content-copy',
          label: 'Duplicates',
          route: '/(admin)/duplicates',
          color: '#FF5722',
          description: 'Manage duplicates',
        },
        {
          icon: 'swap-horiz',
          label: 'Field Mapping',
          route: '/(admin)/field-mapping',
          color: '#795548',
          description: 'Salesforce mapping',
        },
      ],
    },
    {
      title: 'System',
      items: [
        {
          icon: 'file-download',
          label: 'Time Clock Export',
          route: '/(admin)/time-clock-export',
          color: '#00BCD4',
          description: 'Export payroll data',
        },
        {
          icon: 'sync',
          label: 'Sync Status',
          route: '/(admin)/sync-dashboard',
          color: '#009688',
          description: 'Salesforce sync',
        },
        {
          icon: 'school',
          label: 'Onboarding',
          route: '/(admin)/onboarding-manager',
          color: '#3F51B5',
          description: 'New hire setup',
        },
        {
          icon: 'campaign',
          label: 'Alerts',
          route: '/(admin)/alerts',
          color: '#F44336',
          description: 'Push notifications',
        },
        {
          icon: 'visibility',
          label: 'Activity Monitor',
          route: '/(admin)/activity-monitor',
          color: '#FF9800',
          description: 'Track employee activity',
        },
        {
          icon: 'settings',
          label: 'Settings',
          route: '/(admin)/settings',
          color: '#607D8B',
          description: 'App configuration',
        },
      ],
    },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.welcomeText}>Admin Dashboard</Text>
            <Text style={styles.nameText}>{currentUser?.firstName} {currentUser?.lastName}</Text>
          </View>
          
          <View style={styles.headerActions}>
            <View style={[styles.statusBadge, { backgroundColor: isOnline ? LOWES_THEME.success : LOWES_THEME.error }]}>
              <MaterialIcons name={isOnline ? 'wifi' : 'wifi-off'} size={14} color="#FFFFFF" />
              <Text style={styles.statusText}>{isOnline ? 'Online' : 'Offline'}</Text>
            </View>
            
            <Pressable 
              onPress={() => {
                logout();
                router.replace('/login');
              }}
              style={styles.logoutButton}
            >
              <MaterialIcons name="logout" size={24} color={LOWES_THEME.primary} />
            </Pressable>
          </View>
        </View>

        {/* Key Metrics */}
        <View style={styles.metricsSection}>
          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <MaterialIcons name="assessment" size={24} color="#2196F3" />
              <Text style={styles.metricTitle}>Today's Surveys</Text>
            </View>
            <Text style={styles.metricValue}>{todaySurveys.length}</Text>
            <Text style={styles.metricSubtext}>
              Total: {surveys.length} surveys
            </Text>
          </View>

          <View style={styles.metricCard}>
            <View style={styles.metricHeader}>
              <MaterialIcons name="event" size={24} color="#FF9800" />
              <Text style={styles.metricTitle}>Appointments</Text>
            </View>
            <Text style={styles.metricValue}>{todayAppointments}</Text>
            <Text style={styles.metricSubtext}>
              Total: {totalAppointments} appointments
            </Text>
          </View>
        </View>

        {/* Active Employees */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Clocked In Employees</Text>
            <View style={styles.employeeCount}>
              <Text style={styles.employeeCountText}>{clockedInEmployees.length}/{activeEmployees.length}</Text>
            </View>
          </View>

          {clockedInEmployees.length > 0 ? (
            <View style={styles.employeeList}>
              {employeeStatus.map((emp) => (
                <View 
                  key={emp.id} 
                  style={[
                    styles.employeeCard,
                    emp.isInactive && styles.inactiveEmployeeCard,
                  ]}
                >
                  <View style={styles.employeeInfo}>
                    <View style={styles.employeeHeader}>
                      <View style={[
                        styles.statusDot,
                        { backgroundColor: emp.isInactive ? '#F44336' : '#4CAF50' },
                      ]} />
                      <Text style={[
                        styles.employeeName,
                        emp.isInactive && styles.inactiveText,
                      ]}>
                        {emp.firstName} {emp.lastName}
                      </Text>
                    </View>
                    
                    <View style={styles.employeeMeta}>
                      <View style={styles.storeTag}>
                        <MaterialIcons 
                          name="store" 
                          size={12} 
                          color={emp.store === 'lowes' ? '#004990' : '#FF6200'} 
                        />
                        <Text style={[
                          styles.storeText,
                          { color: emp.store === 'lowes' ? '#004990' : '#FF6200' },
                        ]}>
                          {emp.store === 'lowes' ? 'Lowes' : 'Home Depot'}
                        </Text>
                      </View>
                      
                      <Text style={styles.timeText}>
                        {emp.lastActivity ? new Date(emp.lastActivity).toLocaleTimeString([], { 
                          hour: '2-digit', 
                          minute: '2-digit' 
                        }) : 'N/A'}
                      </Text>
                    </View>
                    
                    {emp.isInactive && (
                      <View style={styles.inactiveBadge}>
                        <MaterialIcons name="warning" size={12} color="#F44336" />
                        <Text style={styles.inactiveBadgeText}>Inactive 30+ min</Text>
                      </View>
                    )}
                  </View>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.emptyState}>
              <MaterialIcons name="person-off" size={48} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyText}>No employees clocked in</Text>
            </View>
          )}
        </View>

        {/* Menu Sections */}
        {menuSections.map((section) => (
          <View key={section.title} style={styles.section}>
            <Text style={styles.sectionTitle}>{section.title}</Text>
            
            <View style={styles.menuGrid}>
              {section.items.map((item) => (
                <Pressable
                  key={item.route}
                  style={({ pressed }) => [
                    styles.menuCard,
                    pressed && styles.menuCardPressed,
                  ]}
                  onPress={() => router.push(item.route as any)}
                >
                  <View style={[styles.menuIcon, { backgroundColor: item.color + '15' }]}>
                    <MaterialIcons name={item.icon} size={28} color={item.color} />
                  </View>
                  <View style={styles.menuContent}>
                    <Text style={styles.menuLabel}>{item.label}</Text>
                    <Text style={styles.menuDescription}>{item.description}</Text>
                  </View>
                  <MaterialIcons name="chevron-right" size={20} color={LOWES_THEME.textSubtle} />
                </Pressable>
              ))}
            </View>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: LOWES_THEME.background,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  welcomeText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  nameText: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: LOWES_THEME.text,
    marginTop: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
  },
  statusText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  logoutButton: {
    padding: SPACING.sm,
  },
  metricsSection: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  metricCard: {
    flex: 1,
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 16,
    gap: SPACING.sm,
    borderLeftWidth: 4,
    borderLeftColor: '#2196F3',
  },
  metricHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  metricTitle: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
  },
  metricValue: {
    fontSize: 36,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  metricSubtext: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  section: {
    gap: SPACING.md,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  employeeCount: {
    backgroundColor: LOWES_THEME.primary,
    paddingVertical: 4,
    paddingHorizontal: SPACING.md,
    borderRadius: 12,
  },
  employeeCountText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  employeeList: {
    gap: SPACING.sm,
  },
  employeeCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.md,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: '#4CAF50',
  },
  inactiveEmployeeCard: {
    borderLeftColor: '#F44336',
    backgroundColor: '#FFEBEE',
  },
  employeeInfo: {
    gap: SPACING.xs,
  },
  employeeHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  employeeName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  inactiveText: {
    color: '#F44336',
  },
  employeeMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: 2,
  },
  storeTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
  },
  storeText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  timeText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  inactiveBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    alignSelf: 'flex-start',
    paddingVertical: 2,
    paddingHorizontal: SPACING.sm,
    backgroundColor: '#FFCDD2',
    borderRadius: 8,
  },
  inactiveBadgeText: {
    fontSize: FONTS.sizes.xs,
    color: '#F44336',
    fontWeight: '600',
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
  menuGrid: {
    gap: SPACING.sm,
  },
  menuCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  menuCardPressed: {
    opacity: 0.7,
    transform: [{ scale: 0.98 }],
  },
  menuIcon: {
    width: 56,
    height: 56,
    borderRadius: 12,
    justifyContent: 'center',
    alignItems: 'center',
  },
  menuContent: {
    flex: 1,
    gap: 2,
  },
  menuLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  menuDescription: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
});
