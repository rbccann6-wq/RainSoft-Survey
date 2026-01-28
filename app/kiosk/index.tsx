// Kiosk home - Store selection and clock in/out
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, ActivityIndicator, Image } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { StatsModal } from '@/components/ui/StatsModal';
import { SPACING, FONTS, LOWES_THEME, HOMEDEPOT_THEME, getTheme, isTablet } from '@/constants/theme';
import { Store } from '@/constants/theme';
import * as StorageService from '@/services/storageService';

export default function KioskHome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { currentUser, activeTimeEntry, isOnline, dailyCounts, logout, clockIn, clockOut, selectStore, setKioskActive, calculateDailyStats } = useApp();
  const { showAlert } = useAlert();
  const [selectedStoreOption, setSelectedStoreOption] = useState<Store | null>(null);
  const [isClockingIn, setIsClockingIn] = useState(false);
  const [showStatsModal, setShowStatsModal] = useState(false);
  const [statsData, setStatsData] = useState<any>(null);
  const [dailyStats, setDailyStats] = useState<any>(null);
  const [unreadAlertCount, setUnreadAlertCount] = useState(0);
  const [unreadMessageCount, setUnreadMessageCount] = useState(0);
  const [scheduleUpdateCount, setScheduleUpdateCount] = useState(0);

  // Load daily stats when user is clocked in
  React.useEffect(() => {
    if (isClockedIn && currentUser) {
      loadDailyStats().catch(console.error);
      const interval = setInterval(() => {
        loadDailyStats().catch(console.error);
      }, 60000); // Update every minute
      return () => clearInterval(interval);
    }
  }, [isClockedIn, currentUser]);

  // Track page view activity - not on survey kiosk mode
  React.useEffect(() => {
    if (currentUser && activeTimeEntry) {
      const ActivityService = require('@/services/activityService');
      
      // Log initial page view
      ActivityService.logActivity({
        employeeId: currentUser.id,
        timeEntryId: activeTimeEntry.id,
        eventType: 'page_view',
        pagePath: '/kiosk',
        isPageVisible: true,
        metadata: { page: 'kiosk_home' },
      });
      
      // Set up heartbeat interval (every 30 seconds while on this page)
      const heartbeatInterval = setInterval(() => {
        ActivityService.logActivity({
          employeeId: currentUser.id,
          timeEntryId: activeTimeEntry.id,
          eventType: 'app_heartbeat',
          pagePath: '/kiosk',
          isPageVisible: true,
          metadata: { page: 'kiosk_home', heartbeat: true },
        });
      }, 30000);
      
      return () => clearInterval(heartbeatInterval);
    }
  }, [currentUser, activeTimeEntry]);

  React.useEffect(() => {
    loadUnreadAlerts().catch(console.error);
    loadUnreadMessages().catch(console.error);
    loadScheduleUpdates().catch(console.error);
  }, []);

  const loadUnreadAlerts = async () => {
    const allAlerts = await StorageService.getData<any[]>('alerts') || [];
    const myAlerts = allAlerts.filter(alert => 
      (alert.isGroupAlert || alert.recipientIds.includes(currentUser!.id)) &&
      !alert.dismissedBy.includes(currentUser!.id) &&
      !alert.readBy.includes(currentUser!.id)
    );
    const now = new Date();
    const active = myAlerts.filter(alert => 
      !alert.expiresAt || new Date(alert.expiresAt) > now
    );
    setUnreadAlertCount(active.length);
  };

  const loadUnreadMessages = async () => {
    const allMessages = await StorageService.getMessages();
    if (!currentUser) return;
    
    const myMessages = allMessages.filter(msg => 
      msg.isGroupMessage || msg.recipientIds.includes(currentUser.id)
    );
    const unread = myMessages.filter(msg => !msg.readBy.includes(currentUser.id));
    setUnreadMessageCount(unread.length);
  };

  const loadScheduleUpdates = async () => {
    if (!currentUser) return;
    
    const allSchedules = await StorageService.getSchedules();
    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // Get schedules from today onwards
    const upcomingSchedules = allSchedules.filter(schedule => 
      schedule.employeeId === currentUser.id &&
      schedule.date >= today
    );
    
    // Check if there are new schedules added in the last 24 hours
    const lastCheckTime = await StorageService.getData<string>('last_schedule_check_' + currentUser.id);
    const lastCheck = lastCheckTime ? new Date(lastCheckTime) : new Date(0);
    
    // Count schedules created/updated after last check
    const newSchedules = upcomingSchedules.filter(schedule => {
      const scheduleDate = new Date(schedule.date);
      return scheduleDate > lastCheck;
    });
    
    setScheduleUpdateCount(newSchedules.length);
  };

  const loadDailyStats = async () => {
    const stats = await calculateDailyStats();
    setDailyStats(stats);
  };

  const isClockedIn = !!activeTimeEntry;
  const theme = activeTimeEntry?.store ? getTheme(activeTimeEntry.store) : LOWES_THEME;

  const requestPermissions = async () => {
    // Request location permission
    const { status: locationStatus } = await Location.requestForegroundPermissionsAsync();
    if (locationStatus !== 'granted') {
      showAlert('Permission Denied', 'Location permission is required to clock in');
      return false;
    }

    // Request camera permission
    const { status: cameraStatus } = await ImagePicker.requestCameraPermissionsAsync();
    if (cameraStatus !== 'granted') {
      showAlert('Permission Denied', 'Camera permission is required to clock in');
      return false;
    }

    return true;
  };

  const captureGPS = async () => {
    try {
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy || 0,
      };
    } catch (error) {
      console.error('Error getting location:', error);
      return undefined;
    }
  };

  const capturePhoto = async () => {
    try {
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        quality: 0.7,
        allowsEditing: false,
      });

      if (!result.canceled && result.assets[0]) {
        return result.assets[0].uri;
      }
      return undefined;
    } catch (error) {
      console.error('Error taking photo:', error);
      return undefined;
    }
  };

  const handleClockIn = async () => {
    if (!selectedStoreOption) {
      showAlert('Select Store', 'Please select a store before clocking in');
      return;
    }

    setIsClockingIn(true);

    try {
      // Request permissions
      const hasPermissions = await requestPermissions();
      if (!hasPermissions) {
        setIsClockingIn(false);
        return;
      }

      // Capture GPS (silent - shown via loading indicator)
      const gpsCoordinates = await captureGPS();
      
      if (!gpsCoordinates) {
        setIsClockingIn(false);
        showAlert('Location Error', 'Could not capture GPS location. Please try again.');
        return;
      }

      // Capture Photo (silent - camera opens automatically)
      const photoUri = await capturePhoto();
      
      if (!photoUri) {
        setIsClockingIn(false);
        showAlert('Photo Required', 'A photo is required to clock in. Please try again.');
        return;
      }

      // Clock in with GPS and photo
      await clockIn(selectedStoreOption, gpsCoordinates, photoUri);
      selectStore(selectedStoreOption);
      setIsClockingIn(false);
      
      // Immediately navigate to survey in kiosk mode
      router.replace('/kiosk/survey');
    } catch (error) {
      console.error('Clock in error:', error);
      setIsClockingIn(false);
      showAlert('Error', 'Failed to clock in. Please try again.');
    }
  };

  const handleClockOut = async () => {
    // Check if onboarding is incomplete and remind user
    if (currentUser && !currentUser.onboardingComplete) {
      showAlert(
        '📋 Reminder: Complete Your Onboarding',
        'Your onboarding paperwork is still incomplete. Please complete it as soon as possible to activate your account and start earning. Contact your manager for the onboarding link.',
        [
          {
            text: 'OK, Got It',
            onPress: async () => {
              await performClockOut();
            },
          },
        ]
      );
      return;
    }
    
    await performClockOut();
  };

  const performClockOut = async () => {
    setIsClockingIn(true);
    try {
      await clockOut(); // Includes forced sync and manager notification
      const stats = await calculateDailyStats();
      setIsClockingIn(false);
      
      // Prepare stats for modern modal
      const surveysPerHour = stats.surveysPerHour;
      const meetsQuota = surveysPerHour >= 5;
      
      setStatsData({
        title: 'Shift Complete',
        subtitle: 'Great work today!',
        stats: [
          {
            icon: 'access-time',
            label: 'Hours Worked',
            value: stats.hoursWorked.toFixed(2),
            color: '#2196F3',
          },
          {
            icon: 'assignment',
            label: 'Qualified Surveys',
            value: stats.qualifiedSurveys,
            color: '#4CAF50',
          },
          {
            icon: 'event',
            label: 'Appointments',
            value: stats.appointments,
            color: '#FF9800',
          },
          {
            icon: 'speed',
            label: 'Per Hour',
            value: surveysPerHour.toFixed(2),
            color: meetsQuota ? '#4CAF50' : '#F44336',
          },
        ],
        message: meetsQuota
          ? '🎉 Great job! You\'re exceeding quota. Keep up the excellent work!'
          : '💪 Keep pushing! You\'re close to quota. Focus on engaging customers and you\'ll hit 5 per hour!',
        messageType: meetsQuota ? 'success' : 'warning',
      });
      setShowStatsModal(true);
    } catch (error) {
      setIsClockingIn(false);
      showAlert('Clock Out Complete', 'You have been clocked out. Surveys are safely stored and will sync when online.');
    }
  };



  const handleStartSurvey = async () => {
    if (!activeTimeEntry) {
      showAlert('Clock In Required', 'Please clock in before starting surveys');
      return;
    }
    // Mark as active when entering survey mode
    await setKioskActive(true);
    router.replace('/kiosk/survey');
  };

  const handleLogout = () => {
    showAlert('Logout', 'Are you sure you want to logout?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Logout',
        style: 'destructive',
        onPress: async () => {
          await logout();
          router.replace('/login');
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      {/* Modern Header */}
      <View style={[styles.modernHeader, { backgroundColor: theme.primary }]}>
        {/* Top Row: Avatar, Name, Logout */}
        <View style={styles.headerTopRow}>
          <View style={styles.headerLeft}>
            <View style={styles.userInfo}>
              {currentUser?.profilePictureUri ? (
                <Image 
                  source={{ uri: currentUser.profilePictureUri }} 
                  style={styles.avatarSmall}
                />
              ) : (
                <View style={styles.avatarSmall}>
                  <Text style={styles.avatarSmallText}>
                    {currentUser?.firstName[0]}{currentUser?.lastName[0]}
                  </Text>
                </View>
              )}
              <View>
                <Text style={styles.headerGreeting}>Welcome back</Text>
                <Text style={styles.headerName}>
                  {currentUser?.firstName} {currentUser?.lastName}
                </Text>
              </View>
            </View>
          </View>
          
          <Pressable onPress={handleLogout} style={styles.headerLogoutButton}>
            <MaterialIcons name="logout" size={24} color="#FFFFFF" />
          </Pressable>
        </View>
        
        {/* Bottom Row: Status Badges */}
        <View style={styles.headerBottomRow}>
          {/* Clocked In Status */}
          {isClockedIn && (
            <View style={styles.headerClockedInBadge}>
              <MaterialIcons name="check-circle" size={16} color="#4CAF50" />
              <Text style={styles.headerClockedInText}>
                {activeTimeEntry.store === 'lowes' ? 'Lowes' : 'Home Depot'}
              </Text>
            </View>
          )}
          
          {/* Online Status */}
          <View style={[
            styles.headerStatusBadge,
            { backgroundColor: isOnline ? 'rgba(76, 175, 80, 0.2)' : 'rgba(244, 67, 54, 0.2)' }
          ]}>
            <MaterialIcons 
              name={isOnline ? 'cloud-done' : 'cloud-off'} 
              size={16} 
              color="#FFFFFF" 
            />
            <Text style={styles.headerStatusText}>
              {isOnline ? 'ONLINE' : 'OFFLINE'}
            </Text>
          </View>
        </View>
      </View>

      <View style={styles.content}>
        {/* Onboarding Banner */}
        {currentUser && !currentUser.onboardingComplete && (
          <Pressable 
            style={styles.onboardingBanner}
            onPress={() => showAlert('Complete Onboarding', 'Please complete your onboarding paperwork to activate your account and start earning. Contact your manager for the onboarding link.')}
          >
            <MaterialIcons name="assignment-late" size={32} color="#FFFFFF" />
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>⚠️ Complete Your Onboarding</Text>
              <Text style={styles.bannerText}>
                Tap here to learn how to complete your paperwork and activate your account
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
          </Pressable>
        )}

        {/* Store Selection (only if not clocked in) */}
        {!isClockedIn && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: theme.text }]}>
              Select Store
            </Text>
            <View style={styles.storeButtons}>
              <Pressable
                onPress={() => setSelectedStoreOption('lowes')}
                style={[
                  styles.storeCard,
                  { 
                    backgroundColor: LOWES_THEME.surface,
                    borderColor: selectedStoreOption === 'lowes' ? LOWES_THEME.primary : LOWES_THEME.border,
                    borderWidth: 3,
                  },
                ]}
              >
                <Text style={[styles.storeTitle, { color: LOWES_THEME.primary }]}>
                  Lowes
                </Text>
                <MaterialIcons name="store" size={48} color={LOWES_THEME.primary} />
              </Pressable>

              <Pressable
                onPress={() => setSelectedStoreOption('homedepot')}
                style={[
                  styles.storeCard,
                  { 
                    backgroundColor: HOMEDEPOT_THEME.surface,
                    borderColor: selectedStoreOption === 'homedepot' ? HOMEDEPOT_THEME.primary : HOMEDEPOT_THEME.border,
                    borderWidth: 3,
                  },
                ]}
              >
                <Text style={[styles.storeTitle, { color: HOMEDEPOT_THEME.primary }]}>
                  Home Depot
                </Text>
                <MaterialIcons name="store" size={48} color={HOMEDEPOT_THEME.primary} />
              </Pressable>
            </View>
          </View>
        )}

        {/* Clock In/Out - Modern Card */}
        <View style={[styles.clockCard, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
          {isClockedIn ? (
            <View style={styles.clockedInContainer}>
              <Button
                title="Clock Out"
                onPress={handleClockOut}
                variant="danger"
                icon="logout"
                fullWidth
              />
            </View>
          ) : (
            <View style={styles.clockOutContainer}>
              <View style={styles.requirementsBox}>
                <MaterialIcons name="info" size={20} color={theme.primary} />
                <View style={styles.requirementsList}>
                  <Text style={[styles.requirementText, { color: theme.text }]}>
                    • GPS location will be captured
                  </Text>
                  <Text style={[styles.requirementText, { color: theme.text }]}>
                    • Photo verification required
                  </Text>
                </View>
              </View>
              
              <Button
                title={isClockingIn ? "Processing..." : "Clock In"}
                onPress={handleClockIn}
                backgroundColor={theme.primary}
                fullWidth
                disabled={!selectedStoreOption || isClockingIn}
              />
              
              {isClockingIn && (
                <View style={styles.loadingContainer}>
                  <ActivityIndicator size="large" color={theme.primary} />
                  <Text style={[styles.loadingText, { color: theme.text }]}>
                    Capturing GPS and photo...
                  </Text>
                </View>
              )}
            </View>
          )}
        </View>

        {/* Start Survey */}
        {isClockedIn && (
          <View style={styles.section}>
            <Button
              title="Start Survey"
              onPress={handleStartSurvey}
              backgroundColor={theme.primary}
              size="large"
              fullWidth
            />
          </View>
        )}

        {/* Clock In Time Display */}
        {isClockedIn && activeTimeEntry && (
          <View style={[styles.clockInTimeCard, { backgroundColor: theme.surface, borderColor: theme.primary }]}>
            <View style={styles.clockInTimeRow}>
              <MaterialIcons name="access-time" size={24} color={theme.primary} />
              <View style={styles.clockInTimeInfo}>
                <Text style={[styles.clockInTimeLabel, { color: theme.textSubtle }]}>Clocked In At</Text>
                <Text style={[styles.clockInTimeValue, { color: theme.text }]}>
                  {formatDateTime12Hour(activeTimeEntry.clockIn)}
                </Text>
              </View>
            </View>
            {activeTimeEntry.gpsCoordinates && (
              <View style={styles.clockInLocation}>
                <MaterialIcons name="location-on" size={16} color={theme.textSubtle} />
                <Text style={[styles.clockInLocationText, { color: theme.textSubtle }]}>
                  {activeTimeEntry.gpsCoordinates.latitude.toFixed(4)}, {activeTimeEntry.gpsCoordinates.longitude.toFixed(4)}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Daily Stats - Only show when clocked in */}
        {isClockedIn && dailyStats && (
          <View style={[styles.statsCard, { backgroundColor: theme.surface }]}>
            <View style={styles.statsGrid}>
              <View style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: '#2196F3' }]}>
                  <MaterialIcons name="access-time" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {(() => {
                    const now = new Date();
                    const clockInTime = new Date(activeTimeEntry.clockIn);
                    const hours = (now.getTime() - clockInTime.getTime()) / (1000 * 60 * 60);
                    return hours.toFixed(1);
                  })()}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSubtle }]}>Hours</Text>
              </View>
              
              <View style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: '#9E9E9E' }]}>
                  <MaterialIcons name="home-work" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dailyCounts.renters}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSubtle }]}>Renters</Text>
              </View>
              
              <View style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: '#4CAF50' }]}>
                  <MaterialIcons name="assignment" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dailyStats.qualifiedSurveys}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSubtle }]}>Surveys</Text>
              </View>
              
              <View style={styles.statItem}>
                <View style={[styles.statIconCircle, { backgroundColor: '#FF9800' }]}>
                  <MaterialIcons name="event" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dailyStats.appointments}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSubtle }]}>Appointments</Text>
              </View>
              
              <View style={styles.statItem}>
                <View style={[
                  styles.statIconCircle, 
                  { backgroundColor: dailyStats.surveysPerHour >= 5 ? '#4CAF50' : '#F44336' }
                ]}>
                  <MaterialIcons name="speed" size={20} color="#FFFFFF" />
                </View>
                <Text style={[styles.statValue, { color: theme.text }]}>
                  {dailyStats.surveysPerHour.toFixed(1)}
                </Text>
                <Text style={[styles.statLabel, { color: theme.textSubtle }]}>Per Hour</Text>
              </View>
            </View>
            
            {/* Performance Message */}
            <View style={[
              styles.performanceMessage,
              { 
                backgroundColor: dailyStats.surveysPerHour >= 5 
                  ? 'rgba(76, 175, 80, 0.1)' 
                  : 'rgba(255, 152, 0, 0.1)'
              }
            ]}>
              <MaterialIcons 
                name={dailyStats.surveysPerHour >= 5 ? 'check-circle' : 'trending-up'} 
                size={18} 
                color={dailyStats.surveysPerHour >= 5 ? '#4CAF50' : '#FF9800'} 
              />
              <Text style={[
                styles.performanceText,
                { color: dailyStats.surveysPerHour >= 5 ? '#4CAF50' : '#FF9800' }
              ]}>
                {dailyStats.surveysPerHour >= 5
                  ? '🎯 Great job! You\'re exceeding quota!'
                  : '⚡ Keep going! Push to reach 5 surveys/hour!'}
              </Text>
            </View>
          </View>
        )}
      </View>

      {/* Modern Stats Modal */}
      {statsData && (
        <StatsModal
          visible={showStatsModal}
          onClose={() => {
            setShowStatsModal(false);
            setStatsData(null);
          }}
          title={statsData.title}
          subtitle={statsData.subtitle}
          stats={statsData.stats}
          message={statsData.message}
          messageType={statsData.messageType}
        />
      )}

      {/* Bottom Utility Bar */}
      <View style={[
        styles.utilityBar, 
        { 
          backgroundColor: theme.surface,
          paddingBottom: Math.max(insets.bottom, SPACING.md),
          paddingLeft: Math.max(insets.left + SPACING.md, SPACING.lg),
          paddingRight: Math.max(insets.right + SPACING.md, SPACING.lg),
        }
      ]}>
        {/* Quick Actions */}
        <View style={styles.utilityActions}>
          <Pressable 
            style={styles.utilityButton}
            onPress={() => router.push('/kiosk/profile')}
          >
            <MaterialIcons name="person" size={24} color={theme.primary} />
            <Text style={[styles.utilityButtonText, { color: theme.text }]}>Profile</Text>
          </Pressable>
          
          <Pressable 
            style={styles.utilityButton}
            onPress={() => router.push('/kiosk/training')}
          >
            <MaterialIcons name="school" size={24} color={theme.primary} />
            <Text style={[styles.utilityButtonText, { color: theme.text }]}>Training</Text>
          </Pressable>
          
          <Pressable 
            style={styles.utilityButton}
            onPress={async () => {
              // Mark schedule as checked
              if (currentUser) {
                await StorageService.saveData('last_schedule_check_' + currentUser.id, new Date().toISOString());
              }
              setScheduleUpdateCount(0);
              router.push('/kiosk/schedule');
            }}
          >
            <View>
              <MaterialIcons name="calendar-today" size={24} color={theme.primary} />
              {scheduleUpdateCount > 0 && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>{scheduleUpdateCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.utilityButtonText, { color: theme.text }]}>Schedule</Text>
          </Pressable>
          
          <Pressable 
            style={styles.utilityButton}
            onPress={async () => {
              await router.push('/kiosk/messages');
              loadUnreadMessages(); // Refresh after visiting messages
            }}
          >
            <View>
              <MaterialIcons name="message" size={24} color={theme.primary} />
              {unreadMessageCount > 0 && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>{unreadMessageCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.utilityButtonText, { color: theme.text }]}>Messages</Text>
          </Pressable>
          
          <Pressable 
            style={styles.utilityButton}
            onPress={() => router.push('/kiosk/statistics')}
          >
            <MaterialIcons name="bar-chart" size={24} color={theme.primary} />
            <Text style={[styles.utilityButtonText, { color: theme.text }]}>Stats</Text>
          </Pressable>
          
          <Pressable 
            style={styles.utilityButton}
            onPress={async () => {
              await router.push('/kiosk/alerts');
              loadUnreadAlerts();
            }}
          >
            <View>
              <MaterialIcons name="notifications" size={24} color={theme.primary} />
              {unreadAlertCount > 0 && (
                <View style={styles.alertBadge}>
                  <Text style={styles.alertBadgeText}>{unreadAlertCount}</Text>
                </View>
              )}
            </View>
            <Text style={[styles.utilityButtonText, { color: theme.text }]}>Alerts</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}

const isTabletDevice = isTablet();

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  modernHeader: {
    paddingTop: SPACING.lg,
    paddingBottom: SPACING.md,
    paddingHorizontal: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 8,
    elevation: 8,
    gap: SPACING.md,
  },
  headerTopRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  headerBottomRow: {
    flexDirection: 'row',
    gap: SPACING.sm,
    alignItems: 'center',
    flexWrap: 'wrap',
  },
  headerLeft: {
    flex: 1,
  },
  userInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  avatarSmall: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  avatarSmallText: {
    color: '#FFFFFF',
    fontSize: 18,
    fontWeight: '700',
  },
  headerGreeting: {
    color: 'rgba(255, 255, 255, 0.9)',
    fontSize: FONTS.sizes.sm,
    fontWeight: '500',
  },
  headerName: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },

  headerStatusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  headerStatusText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  headerLogoutButton: {
    padding: SPACING.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
  },
  content: {
    flex: 1,
    padding: SPACING.md,
    gap: SPACING.md,
    maxWidth: isTabletDevice ? 900 : undefined,
    alignSelf: 'center',
    width: '100%',
    paddingBottom: 90, // Space for utility bar
  },
  utilityBar: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: '#E0E0E0',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -3 },
    shadowOpacity: 0.1,
    shadowRadius: 5,
    elevation: 10,
    zIndex: 10,
  },
  utilityActions: {
    flexDirection: 'row',
    gap: isTabletDevice ? SPACING.md : SPACING.xs,
    justifyContent: 'space-evenly',
    width: '100%',
    maxWidth: isTabletDevice ? 900 : undefined,
  },
  utilityButton: {
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: isTabletDevice ? SPACING.sm : 2,
    minWidth: isTabletDevice ? 70 : 55,
  },
  utilityButtonText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  alertBadge: {
    position: 'absolute',
    top: -4,
    right: -4,
    backgroundColor: LOWES_THEME.error,
    borderRadius: 10,
    paddingHorizontal: 6,
    paddingVertical: 2,
    minWidth: 20,
    alignItems: 'center',
  },
  alertBadgeText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  section: {
    gap: SPACING.sm,
  },
  sectionTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  headerClockedInBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 6,
    paddingHorizontal: SPACING.sm,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.95)',
  },
  headerClockedInText: {
    color: '#4CAF50',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
  },
  clockCard: {
    borderRadius: 16,
    borderWidth: 3,
    padding: SPACING.lg,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 6,
  },
  clockedInContainer: {
    gap: SPACING.md,
  },
  clockOutContainer: {
    gap: SPACING.md,
  },
  storeButtons: {
    flexDirection: 'row',
    gap: SPACING.md,
    maxWidth: isTabletDevice ? 600 : undefined,
    alignSelf: 'center',
  },
  storeCard: {
    flex: 1,
    padding: isTabletDevice ? SPACING.xl : SPACING.lg,
    borderRadius: 16,
    alignItems: 'center',
    gap: SPACING.md,
    minHeight: isTabletDevice ? 180 : 120,
  },
  storeTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },

  requirementsBox: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.md,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    marginBottom: SPACING.md,
  },
  requirementsList: {
    flex: 1,
    gap: SPACING.xs,
  },
  requirementText: {
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  loadingContainer: {
    alignItems: 'center',
    paddingVertical: SPACING.md,
    gap: SPACING.xs,
  },
  loadingText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
  },

  clockedInActions: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  statsCard: {
    borderRadius: 12,
    padding: SPACING.md,
    gap: SPACING.sm,
  },
  statsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: SPACING.md,
    justifyContent: isTabletDevice ? 'space-around' : 'flex-start',
  },
  statItem: {
    width: isTabletDevice ? '18%' : '47%',
    alignItems: 'center',
    gap: 4,
    minWidth: isTabletDevice ? 100 : 80,
  },
  statIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 22,
    fontWeight: '700',
  },
  statLabel: {
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
  },
  performanceMessage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    borderRadius: 8,
  },
  performanceText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
  clockInTimeCard: {
    borderRadius: 12,
    borderWidth: 2,
    padding: SPACING.md,
    gap: SPACING.xs,
  },
  clockInTimeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  clockInTimeInfo: {
    flex: 1,
    gap: 2,
  },
  clockInTimeLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  clockInTimeValue: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  clockInLocation: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingTop: SPACING.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: '#E0E0E0',
  },
  clockInLocationText: {
    fontSize: FONTS.sizes.xs,
  },
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#FF9800',
    borderRadius: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 4,
  },
  bannerContent: {
    flex: 1,
  },
  bannerTitle: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  bannerText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    lineHeight: 16,
  },
});
