// Appointment booking screen with week-based calendar + times list
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SPACING, FONTS, getTheme, isTablet } from '@/constants/theme';
import { Survey, Appointment } from '@/types';
import { getAvailableTimes } from '@/constants/surveyQuestions';

export default function AppointmentScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { currentUser, selectedStore, submitSurvey } = useApp();
  const { showAlert } = useAlert();
  
  const surveyData: Survey = params.surveyData 
    ? JSON.parse(params.surveyData as string) 
    : null;
  
  const theme = selectedStore ? getTheme(selectedStore) : getTheme('lowes');
  const addressInputRef = useRef<any>();
  
  const [address, setAddress] = useState('');
  const [email, setEmail] = useState('');
  const [spouseName, setSpouseName] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Helper to get start of week (Sunday)
  function getStartOfWeek(date: Date): Date {
    const d = new Date(date);
    const day = d.getDay();
    const diff = d.getDate() - day;
    return new Date(d.setDate(diff));
  }

  // Generate 7 days for current week
  function getWeekDays(startDate: Date): Date[] {
    const days: Date[] = [];
    for (let i = 0; i < 7; i++) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + i);
      days.push(date);
    }
    return days;
  }

  const handleSubmit = async () => {
    if (!address || !email || !selectedDate || !selectedTime) {
      showAlert('Required Fields', 'Please fill in address, email, date, and time');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      showAlert('Invalid Email', 'Please enter a valid email address');
      return;
    }

    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      const appointment: Appointment = {
        address,
        date: selectedDate.toISOString().split('T')[0],
        time: selectedTime,
        notes,
        email,
        spouseName: spouseName.trim() || undefined,
      };

      const completeSurvey: Survey = {
        ...surveyData,
        category: 'appointment',
        appointment,
      };

      await submitSurvey(completeSurvey);
      
      showAlert('Appointment Set', 'The appointment has been scheduled and will sync to the system', [
        {
          text: 'Start Next Survey',
          onPress: () => router.replace('/kiosk/survey'),
        },
      ]);
    } catch (error) {
      console.error('Appointment submission error:', error);
      showAlert('Error', 'Failed to save appointment. Please try again.');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkipAppointment = async () => {
    if (isSubmitting) return;
    setIsSubmitting(true);
    
    try {
      await submitSurvey(surveyData);
      router.replace('/kiosk/survey');
    } catch (error) {
      console.error('Survey submission error:', error);
      showAlert('Error', 'Failed to save survey. Please try again.');
      setIsSubmitting(false);
    }
  };

  // Week navigation
  const handlePrevWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() - 7);
    setCurrentWeekStart(newStart);
  };

  const handleNextWeek = () => {
    const newStart = new Date(currentWeekStart);
    newStart.setDate(newStart.getDate() + 7);
    setCurrentWeekStart(newStart);
  };

  const isDateSelected = (date: Date) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === date.getDate() &&
      selectedDate.getMonth() === date.getMonth() &&
      selectedDate.getFullYear() === date.getFullYear()
    );
  };

  const handleDateSelect = (date: Date) => {
    setSelectedDate(date);
    setSelectedTime(''); // Reset time selection when date changes
  };

  const isToday = (date: Date) => {
    const today = new Date();
    return (
      date.getDate() === today.getDate() &&
      date.getMonth() === today.getMonth() &&
      date.getFullYear() === today.getFullYear()
    );
  };

  const monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  const weekDays = getWeekDays(currentWeekStart);
  const availableTimes = selectedDate ? getAvailableTimes(selectedDate) : [];

  // Get week range text
  const getWeekRangeText = () => {
    const firstDay = weekDays[0];
    const lastDay = weekDays[6];
    const firstMonth = monthNames[firstDay.getMonth()];
    const lastMonth = monthNames[lastDay.getMonth()];
    
    if (firstMonth === lastMonth) {
      return `${firstMonth} ${firstDay.getDate()} - ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
    }
    return `${firstMonth} ${firstDay.getDate()} - ${lastMonth} ${lastDay.getDate()}, ${firstDay.getFullYear()}`;
  };

  const getFormattedDate = () => {
    if (!selectedDate) return '';
    const dayName = dayNames[selectedDate.getDay()];
    const day = selectedDate.getDate();
    const month = monthNames[selectedDate.getMonth()];
    return `${dayName} ${day}${getDaySuffix(day)} ${month}`;
  };

  const getDaySuffix = (day: number) => {
    if (day > 3 && day < 21) return 'th';
    switch (day % 10) {
      case 1: return 'st';
      case 2: return 'nd';
      case 3: return 'rd';
      default: return 'th';
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <MaterialIcons name="event" size={32} color="#FFFFFF" />
        <Text style={styles.headerTitle}>Set Appointment</Text>
      </View>

      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        {/* Google Places Autocomplete */}
        <View style={styles.inputGroup}>
          <Text style={[styles.inputLabel, { color: theme.text }]}>Street Address *</Text>
          <GooglePlacesAutocomplete
            ref={addressInputRef}
            placeholder="123 Main St, City, State, Zip"
            onPress={(data, details = null) => {
              setAddress(data.description);
            }}
            query={{
              key: process.env.EXPO_PUBLIC_GOOGLE_PLACES_API_KEY || '',
              language: 'en',
              components: 'country:us',
            }}
            fetchDetails={true}
            enablePoweredByContainer={false}
            styles={{
              container: {
                flex: 0,
              },
              textInputContainer: {
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                borderWidth: 2,
                borderColor: theme.primary,
                paddingHorizontal: 0,
              },
              textInput: {
                height: 48,
                fontSize: FONTS.sizes.md,
                color: theme.text,
                paddingHorizontal: SPACING.md,
              },
              listView: {
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                marginTop: 4,
                borderWidth: 1,
                borderColor: theme.border,
              },
              row: {
                backgroundColor: '#FFFFFF',
                padding: SPACING.md,
              },
              description: {
                fontSize: FONTS.sizes.sm,
                color: theme.text,
              },
            }}
            textInputProps={{
              value: address,
              onChangeText: setAddress,
            }}
          />
        </View>

        {/* Email Input */}
        <View style={styles.inputGroup}>
          <Input
            label="Email Address *"
            value={email}
            onChangeText={setEmail}
            placeholder="customer@example.com"
            keyboardType="email-address"
            autoCapitalize="none"
            borderColor={theme.primary}
          />
        </View>

        {/* Spouse First Name (Optional) */}
        <View style={styles.inputGroup}>
          <Input
            label="Spouse First Name (Optional)"
            value={spouseName}
            onChangeText={setSpouseName}
            placeholder="Spouse's first name"
            autoCapitalize="words"
            borderColor={theme.primary}
          />
        </View>

        {/* Week View + Times Layout */}
        <View style={styles.dateTimeContainer}>
          {/* Week Navigation Header */}
          <View style={styles.weekHeader}>
            <Pressable onPress={handlePrevWeek} style={styles.weekNavButton}>
              <MaterialIcons name="chevron-left" size={28} color={theme.text} />
            </Pressable>
            <Text style={[styles.weekRangeText, { color: theme.text }]}>
              {getWeekRangeText()}
            </Text>
            <Pressable onPress={handleNextWeek} style={styles.weekNavButton}>
              <MaterialIcons name="chevron-right" size={28} color={theme.text} />
            </Pressable>
          </View>

          {/* Horizontal Week View */}
          <View style={styles.weekContainer}>
            {weekDays.map((date, index) => {
              const selected = isDateSelected(date);
              const today = isToday(date);
              
              return (
                <Pressable
                  key={index}
                  style={[
                    styles.dayCard,
                    selected && [styles.dayCardSelected, { backgroundColor: theme.primary }],
                    today && !selected && styles.dayCardToday,
                  ]}
                  onPress={() => handleDateSelect(date)}
                >
                  <Text style={[
                    styles.dayLabel,
                    { color: selected ? '#FFFFFF' : theme.textSubtle },
                  ]}>
                    {dayNames[date.getDay()]}
                  </Text>
                  <Text style={[
                    styles.dateNumber,
                    { color: selected ? '#FFFFFF' : theme.text },
                  ]}>
                    {date.getDate()}
                  </Text>
                  <Text style={[
                    styles.monthLabel,
                    { color: selected ? '#FFFFFF' : theme.textSubtle },
                  ]}>
                    {monthNames[date.getMonth()].substring(0, 3)}
                  </Text>
                  {today && !selected && (
                    <View style={[styles.todayDot, { backgroundColor: theme.primary }]} />
                  )}
                </Pressable>
              );
            })}
          </View>

          {/* Time Slots Below */}
          <View style={styles.timesContainer}>
            {selectedDate && (
              <>
                <Text style={[styles.selectedDateText, { color: theme.text }]}>
                  {getFormattedDate()}
                </Text>

                {availableTimes.length > 0 ? (
                  <ScrollView style={styles.timesScrollView} nestedScrollEnabled>
                    {availableTimes.map((time) => (
                      <Pressable
                        key={time}
                        style={[
                          styles.timeSlot,
                          {
                            borderColor: selectedTime === time ? theme.primary : theme.border,
                            backgroundColor: selectedTime === time ? theme.primary : '#FFFFFF',
                          },
                        ]}
                        onPress={() => setSelectedTime(time)}
                      >
                        <Text
                          style={[
                            styles.timeSlotText,
                            { color: selectedTime === time ? '#FFFFFF' : theme.text },
                          ]}
                        >
                          {time}
                        </Text>
                      </Pressable>
                    ))}
                  </ScrollView>
                ) : (
                  <View style={styles.noTimesContainer}>
                    <MaterialIcons name="event-busy" size={40} color={theme.textSubtle} />
                    <Text style={[styles.noTimesText, { color: theme.textSubtle }]}>
                      No times available
                    </Text>
                  </View>
                )}
              </>
            )}

            {!selectedDate && (
              <View style={styles.selectDatePrompt}>
                <MaterialIcons name="event" size={48} color={theme.textSubtle} />
                <Text style={[styles.selectDateText, { color: theme.textSubtle }]}>
                  Select a date from above
                </Text>
              </View>
            )}
          </View>
        </View>

        <Input
          label="Notes (Optional)"
          value={notes}
          onChangeText={setNotes}
          placeholder="Any additional information..."
          multiline
          numberOfLines={4}
          borderColor={theme.primary}
        />

        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={20} color={theme.primary} />
          <Text style={[styles.infoText, { color: theme.textSubtle }]}>
            Available times: Mon-Fri 10AM, 1PM, 4PM, 7PM | Sat 10AM, 1PM
          </Text>
        </View>

        <Button
          title={isSubmitting ? "Saving..." : "Confirm Appointment"}
          onPress={handleSubmit}
          backgroundColor={theme.primary}
          size="large"
          fullWidth
          disabled={!address || !email || !selectedDate || !selectedTime || isSubmitting}
        />

        {/* Small Skip Button */}
        <Pressable
          style={styles.skipButton}
          onPress={handleSkipAppointment}
          disabled={isSubmitting}
        >
          <MaterialIcons name="skip-next" size={12} color="#999" />
          <Text style={styles.skipButtonText}>Skip Appointment</Text>
        </Pressable>
      </ScrollView>
    </SafeAreaView>
  );
}

const isTabletDevice = isTablet();

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.lg,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    maxWidth: isTabletDevice ? 1000 : undefined,
    alignSelf: 'center',
    width: '100%',
  },
  inputGroup: {
    gap: SPACING.xs,
  },
  inputLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  dateTimeContainer: {
    gap: SPACING.lg,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: SPACING.lg,
  },
  weekHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: SPACING.md,
  },
  weekNavButton: {
    padding: SPACING.sm,
  },
  weekRangeText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    textAlign: 'center',
    flex: 1,
  },
  weekContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
    marginBottom: SPACING.lg,
  },
  dayCard: {
    flex: 1,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.xs,
    borderRadius: 12,
    alignItems: 'center',
    gap: 4,
    borderWidth: 2,
    borderColor: '#E0E0E0',
    backgroundColor: '#FFFFFF',
    minHeight: 80,
  },
  dayCardSelected: {
    borderWidth: 0,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.2,
    shadowRadius: 5,
    elevation: 4,
  },
  dayCardToday: {
    borderColor: '#2196F3',
    borderWidth: 2,
  },
  dayLabel: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  dateNumber: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
  },
  monthLabel: {
    fontSize: FONTS.sizes.xs,
  },
  todayDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    marginTop: 2,
  },
  timesContainer: {
    minHeight: 200,
  },
  selectedDateText: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    marginBottom: SPACING.md,
    textAlign: 'center',
  },
  timesScrollView: {
    maxHeight: 300,
  },
  timeSlot: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
    borderWidth: 2,
    marginBottom: SPACING.sm,
    alignItems: 'center',
  },
  timeSlotText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  noTimesContainer: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  noTimesText: {
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
  },
  selectDatePrompt: {
    paddingVertical: SPACING.xxl,
    alignItems: 'center',
    gap: SPACING.md,
  },
  selectDateText: {
    fontSize: FONTS.sizes.md,
    textAlign: 'center',
  },
  infoBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#F0F0F0',
    borderRadius: 8,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    lineHeight: 20,
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    alignSelf: 'center',
    marginTop: -SPACING.sm,
  },
  skipButtonText: {
    fontSize: FONTS.sizes.xs,
    color: '#999',
    textDecorationLine: 'underline',
  },
});
