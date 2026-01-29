// Employee statistics dashboard - View survey outcome stats
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { getSupabaseClient } from '@/template';
import { useAlert } from '@/template';
import { useApp } from '@/hooks/useApp';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';

interface EmployeeStats {
  date: string;
  bad_contact_count: number;
  dead_count: number;
  still_contacting_count: number;
  install_count: number;
  demo_count: number;
  total_surveys: number;
  last_synced_at: string | null;
}

interface AggregatedStats {
  total_bad_contact: number;
  total_dead: number;
  total_still_contacting: number;
  total_install: number;
  total_demo: number;
  total_surveys: number;
  last_sync: string | null;
}

interface TeamMemberStats {
  employee_id: string;
  employee_name: string;
  total_bad_contact: number;
  total_dead: number;
  total_still_contacting: number;
  total_install: number;
  total_demo: number;
  total_surveys: number;
  qualified_count: number;
}

const STAT_CATEGORIES = [
  { 
    key: 'bad_contact', 
    label: 'BCI', 
    color: '#9E9E9E', 
    icon: 'phone-disabled',
    description: 'Bad Contact Info - wrong numbers, disconnected lines'
  },
  { 
    key: 'dead', 
    label: 'Dead', 
    color: '#F44336', 
    icon: 'cancel',
    description: 'Not interested, opted out, lost opportunities'
  },
  { 
    key: 'still_contacting', 
    label: 'Still Contacting', 
    color: '#FF9800', 
    icon: 'pending',
    description: 'In progress, follow-ups, nurturing leads'
  },
  { 
    key: 'install', 
    label: 'Install', 
    color: '#4CAF50', 
    icon: 'check-circle',
    description: 'Closed-won, completed installations, conversions'
  },
  { 
    key: 'demo', 
    label: 'Demo', 
    color: '#2196F3', 
    icon: 'play-circle-outline',
    description: 'Demo appointments scheduled, product demonstrations'
  },
];

export default function StatisticsScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const { currentUser, employees } = useApp();
  const supabase = getSupabaseClient();
  
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<EmployeeStats[]>([]);
  const [aggregated, setAggregated] = useState<AggregatedStats>({
    total_bad_contact: 0,
    total_dead: 0,
    total_still_contacting: 0,
    total_install: 0,
    total_demo: 0,
    total_surveys: 0,
    last_sync: null,
  });
  const [selectedPeriod, setSelectedPeriod] = useState<'today' | '7d' | '30d' | 'all'>('today');
  const [viewMode, setViewMode] = useState<'personal' | 'team'>('personal');
  const [teamStats, setTeamStats] = useState<TeamMemberStats[]>([]);

  useEffect(() => {
    if (currentUser) {
      loadStats();
      if (currentUser.isTeamLead) {
        loadTeamStats();
      }
    }
  }, [currentUser, selectedPeriod, viewMode]);

  const loadStats = async () => {
    if (!currentUser) return;

    setLoading(true);
    try {
      // Calculate date filter
      let dateFilter: Date | null = null;
      if (selectedPeriod === 'today') {
        dateFilter = new Date();
        dateFilter.setHours(0, 0, 0, 0); // Start of today
      } else if (selectedPeriod === '7d') {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (selectedPeriod === '30d') {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 30);
      }

      // Build query
      let query = supabase
        .from('employee_survey_stats')
        .select('*')
        .eq('employee_id', currentUser.id)
        .order('date', { ascending: false });

      if (dateFilter) {
        query = query.gte('date', dateFilter.toISOString().split('T')[0]);
      }

      const { data, error } = await query;

      if (error) throw error;

      setStats(data || []);

      // Calculate aggregated totals
      if (data && data.length > 0) {
        const totals = data.reduce((acc, curr) => ({
          total_bad_contact: acc.total_bad_contact + curr.bad_contact_count,
          total_dead: acc.total_dead + curr.dead_count,
          total_still_contacting: acc.total_still_contacting + curr.still_contacting_count,
          total_install: acc.total_install + curr.install_count,
          total_demo: acc.total_demo + (curr.demo_count || 0),
          total_surveys: acc.total_surveys + curr.total_surveys,
          last_sync: acc.last_sync || curr.last_synced_at,
        }), {
          total_bad_contact: 0,
          total_dead: 0,
          total_still_contacting: 0,
          total_install: 0,
          total_demo: 0,
          total_surveys: 0,
          last_sync: null,
        });
        setAggregated(totals);
      } else {
        setAggregated({
          total_bad_contact: 0,
          total_dead: 0,
          total_still_contacting: 0,
          total_install: 0,
          total_demo: 0,
          total_surveys: 0,
          last_sync: null,
        });
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      showAlert('Error', 'Failed to load statistics');
    } finally {
      setLoading(false);
    }
  };

  const loadTeamStats = async () => {
    if (!currentUser?.isTeamLead) return;

    try {
      // Get team members
      const teamMembers = employees.filter(emp => emp.teamLeadId === currentUser.id);

      if (teamMembers.length === 0) {
        setTeamStats([]);
        return;
      }

      // Calculate date filter
      let dateFilter: Date | null = null;
      if (selectedPeriod === 'today') {
        dateFilter = new Date();
        dateFilter.setHours(0, 0, 0, 0); // Start of today
      } else if (selectedPeriod === '7d') {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 7);
      } else if (selectedPeriod === '30d') {
        dateFilter = new Date();
        dateFilter.setDate(dateFilter.getDate() - 30);
      }

      // Load stats for each team member
      const memberStatsPromises = teamMembers.map(async (member) => {
        let query = supabase
          .from('employee_survey_stats')
          .select('*')
          .eq('employee_id', member.id);

        if (dateFilter) {
          query = query.gte('date', dateFilter.toISOString().split('T')[0]);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Aggregate stats for this member
        const totals = (data || []).reduce((acc, curr) => ({
          total_bad_contact: acc.total_bad_contact + curr.bad_contact_count,
          total_dead: acc.total_dead + curr.dead_count,
          total_still_contacting: acc.total_still_contacting + curr.still_contacting_count,
          total_install: acc.total_install + curr.install_count,
          total_demo: acc.total_demo + (curr.demo_count || 0),
          total_surveys: acc.total_surveys + curr.total_surveys,
        }), {
          total_bad_contact: 0,
          total_dead: 0,
          total_still_contacting: 0,
          total_install: 0,
          total_demo: 0,
          total_surveys: 0,
        });

        const qualified = totals.total_install + totals.total_still_contacting;

        return {
          employee_id: member.id,
          employee_name: `${member.firstName} ${member.lastName}`,
          ...totals,
          qualified_count: qualified,
        };
      });

      const memberStats = await Promise.all(memberStatsPromises);
      setTeamStats(memberStats.sort((a, b) => b.qualified_count - a.qualified_count));
    } catch (error) {
      console.error('Error loading team stats:', error);
      showAlert('Error', 'Failed to load team statistics');
    }
  };

  const getPercentage = (value: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  const { width } = Dimensions.get('window');
  const isTablet = width >= 768;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Survey Statistics</Text>
        <Pressable onPress={loadStats} style={styles.refreshButton}>
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
              <Text style={styles.infoBannerTitle}>What happens to my surveys?</Text>
              <Text style={styles.infoBannerText}>
                Track the outcomes of your surveys and appointments based on Salesforce status updates. Stats sync daily at midnight.
              </Text>
              {aggregated.last_sync && (
                <Text style={styles.lastSyncText}>
                  Last synced: {new Date(aggregated.last_sync).toLocaleString()}
                </Text>
              )}
            </View>
          </View>

          {/* View Mode Toggle (for team leads) */}
          {currentUser?.isTeamLead && (
            <View style={styles.viewModeToggle}>
              <Pressable
                onPress={() => setViewMode('personal')}
                style={[
                  styles.viewModeButton,
                  viewMode === 'personal' && styles.viewModeButtonActive,
                ]}
              >
                <MaterialIcons 
                  name="person" 
                  size={20} 
                  color={viewMode === 'personal' ? '#FFFFFF' : LOWES_THEME.textSubtle} 
                />
                <Text style={[
                  styles.viewModeButtonText,
                  viewMode === 'personal' && styles.viewModeButtonTextActive,
                ]}>
                  My Stats
                </Text>
              </Pressable>
              <Pressable
                onPress={() => setViewMode('team')}
                style={[
                  styles.viewModeButton,
                  viewMode === 'team' && styles.viewModeButtonActive,
                ]}
              >
                <MaterialIcons 
                  name="groups" 
                  size={20} 
                  color={viewMode === 'team' ? '#FFFFFF' : LOWES_THEME.textSubtle} 
                />
                <Text style={[
                  styles.viewModeButtonText,
                  viewMode === 'team' && styles.viewModeButtonTextActive,
                ]}>
                  Team Stats
                </Text>
              </Pressable>
            </View>
          )}

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

          {/* Personal Stats View */}
          {viewMode === 'personal' && aggregated.total_surveys > 0 && (
            <>
              <View style={styles.summaryCard}>
                <Text style={styles.summaryTitle}>Total Surveys Tracked</Text>
                <Text style={styles.summaryValue}>{aggregated.total_surveys}</Text>
              </View>

              {/* Category Stats Grid */}
              <View style={styles.statsGrid}>
                {STAT_CATEGORIES.map((category) => {
                  const count = aggregated[`total_${category.key}` as keyof AggregatedStats] as number;
                  const percentage = getPercentage(count, aggregated.total_surveys);

                  return (
                    <View key={category.key} style={styles.statCard}>
                      <View style={[styles.statIcon, { backgroundColor: category.color }]}>
                        <MaterialIcons name={category.icon as any} size={28} color="#FFFFFF" />
                      </View>
                      <Text style={styles.statLabel}>{category.label}</Text>
                      <Text style={styles.statCount}>{count}</Text>
                      <View style={styles.progressBarContainer}>
                        <View 
                          style={[
                            styles.progressBar, 
                            { width: `${percentage}%`, backgroundColor: category.color }
                          ]} 
                        />
                      </View>
                      <Text style={styles.statPercentage}>{percentage}%</Text>
                      <Text style={styles.statDescription}>{category.description}</Text>
                    </View>
                  );
                })}
              </View>

              {/* Daily Breakdown */}
              {stats.length > 0 && (
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Daily Breakdown</Text>
                  <View style={styles.dailyList}>
                    {stats.map((dayStat) => {
                      const date = new Date(dayStat.date);
                      const dateStr = date.toLocaleDateString('en-US', { 
                        month: 'short', 
                        day: 'numeric',
                        year: 'numeric'
                      });

                      return (
                        <View key={dayStat.date} style={styles.dailyCard}>
                          <Text style={styles.dailyDate}>{dateStr}</Text>
                          <View style={styles.dailyStatsRow}>
                            <View style={styles.dailyStat}>
                              <View style={[styles.dailyDot, { backgroundColor: '#9E9E9E' }]} />
                              <Text style={styles.dailyStatText}>{dayStat.bad_contact_count}</Text>
                            </View>
                            <View style={styles.dailyStat}>
                              <View style={[styles.dailyDot, { backgroundColor: '#F44336' }]} />
                              <Text style={styles.dailyStatText}>{dayStat.dead_count}</Text>
                            </View>
                            <View style={styles.dailyStat}>
                              <View style={[styles.dailyDot, { backgroundColor: '#FF9800' }]} />
                              <Text style={styles.dailyStatText}>{dayStat.still_contacting_count}</Text>
                            </View>
                            <View style={styles.dailyStat}>
                              <View style={[styles.dailyDot, { backgroundColor: '#4CAF50' }]} />
                              <Text style={styles.dailyStatText}>{dayStat.install_count}</Text>
                            </View>
                            <View style={styles.dailyStat}>
                              <View style={[styles.dailyDot, { backgroundColor: '#2196F3' }]} />
                              <Text style={styles.dailyStatText}>{dayStat.demo_count || 0}</Text>
                            </View>
                          </View>
                          <Text style={styles.dailyTotal}>Total: {dayStat.total_surveys}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
            </>
          )}

          {/* Team Stats View */}
          {viewMode === 'team' && teamStats.length > 0 && (
            <>
              <View style={styles.teamHeader}>
                <MaterialIcons name="groups" size={24} color={LOWES_THEME.primary} />
                <Text style={styles.teamHeaderText}>Team Performance</Text>
              </View>

              <View style={styles.teamList}>
                {teamStats.map((member, index) => (
                  <View key={member.employee_id} style={styles.teamMemberCard}>
                    <View style={styles.teamMemberHeader}>
                      <View style={styles.teamMemberRank}>
                        <Text style={styles.rankNumber}>#{index + 1}</Text>
                      </View>
                      <Text style={styles.teamMemberName}>{member.employee_name}</Text>
                    </View>

                    <View style={styles.teamMemberStats}>
                      <View style={styles.teamStatBox}>
                        <Text style={styles.teamStatLabel}>Qualified</Text>
                        <Text style={[styles.teamStatValue, { color: '#4CAF50' }]}>
                          {member.qualified_count}
                        </Text>
                      </View>
                      <View style={styles.teamStatBox}>
                        <Text style={styles.teamStatLabel}>Install</Text>
                        <Text style={[styles.teamStatValue, { color: '#4CAF50' }]}>
                          {member.total_install}
                        </Text>
                      </View>
                      <View style={styles.teamStatBox}>
                        <Text style={styles.teamStatLabel}>Demo</Text>
                        <Text style={[styles.teamStatValue, { color: '#2196F3' }]}>
                          {member.total_demo}
                        </Text>
                      </View>
                      <View style={styles.teamStatBox}>
                        <Text style={styles.teamStatLabel}>Contacting</Text>
                        <Text style={[styles.teamStatValue, { color: '#FF9800' }]}>
                          {member.total_still_contacting}
                        </Text>
                      </View>
                      <View style={styles.teamStatBox}>
                        <Text style={styles.teamStatLabel}>Dead</Text>
                        <Text style={[styles.teamStatValue, { color: '#F44336' }]}>
                          {member.total_dead}
                        </Text>
                      </View>
                      <View style={styles.teamStatBox}>
                        <Text style={styles.teamStatLabel}>BCI</Text>
                        <Text style={[styles.teamStatValue, { color: '#9E9E9E' }]}>
                          {member.total_bad_contact}
                        </Text>
                      </View>
                    </View>

                    <View style={styles.teamMemberTotal}>
                      <Text style={styles.teamTotalLabel}>Total Surveys</Text>
                      <Text style={styles.teamTotalValue}>{member.total_surveys}</Text>
                    </View>
                  </View>
                ))}
              </View>
            </>
          )}

          {/* Empty State for Team View */}
          {viewMode === 'team' && teamStats.length === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="groups" size={64} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyTitle}>No Team Members</Text>
              <Text style={styles.emptyText}>
                Add team members in your profile to view their statistics here.
              </Text>
            </View>
          )}

          {/* Empty State for Personal View */}
          {viewMode === 'personal' && aggregated.total_surveys === 0 && (
            <View style={styles.emptyState}>
              <MaterialIcons name="bar-chart" size={64} color={LOWES_THEME.textSubtle} />
              <Text style={styles.emptyTitle}>No Statistics Yet</Text>
              <Text style={styles.emptyText}>
                Survey outcome statistics will appear here once your surveys are synced from Salesforce. Stats update daily at midnight.
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
  lastSyncText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    fontStyle: 'italic',
  },
  viewModeToggle: {
    flexDirection: 'row',
    gap: SPACING.sm,
    backgroundColor: LOWES_THEME.surface,
    padding: 4,
    borderRadius: 12,
  },
  viewModeButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.sm,
    borderRadius: 8,
  },
  viewModeButtonActive: {
    backgroundColor: LOWES_THEME.primary,
  },
  viewModeButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
  },
  viewModeButtonTextActive: {
    color: '#FFFFFF',
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
  summaryCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.xl,
    borderRadius: 12,
    alignItems: 'center',
    borderWidth: 2,
    borderColor: LOWES_THEME.primary,
  },
  summaryTitle: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
    marginBottom: SPACING.xs,
  },
  summaryValue: {
    fontSize: 48,
    fontWeight: '700',
    color: LOWES_THEME.primary,
  },
  statsGrid: {
    gap: SPACING.md,
  },
  statCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
    gap: SPACING.xs,
  },
  statIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: SPACING.xs,
  },
  statLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  statCount: {
    fontSize: 32,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  progressBarContainer: {
    width: '100%',
    height: 8,
    backgroundColor: '#E0E0E0',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    borderRadius: 4,
  },
  statPercentage: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
  },
  statDescription: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    textAlign: 'center',
    lineHeight: 16,
  },
  section: {
    gap: SPACING.md,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  dailyList: {
    gap: SPACING.sm,
  },
  dailyCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.md,
    borderRadius: 8,
    gap: SPACING.xs,
  },
  dailyDate: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  dailyStatsRow: {
    flexDirection: 'row',
    gap: SPACING.lg,
  },
  dailyStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  dailyDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  dailyStatText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  dailyTotal: {
    fontSize: FONTS.sizes.sm,
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
  teamHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.md,
  },
  teamHeaderText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  teamList: {
    gap: SPACING.md,
  },
  teamMemberCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  teamMemberHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  teamMemberRank: {
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
  teamMemberName: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  teamMemberStats: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  teamStatBox: {
    flex: 1,
    alignItems: 'center',
    padding: SPACING.sm,
    backgroundColor: '#F8F8F8',
    borderRadius: 8,
  },
  teamStatLabel: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    marginBottom: 2,
  },
  teamStatValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  teamMemberTotal: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: SPACING.sm,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
  },
  teamTotalLabel: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  teamTotalValue: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.primary,
  },
});
