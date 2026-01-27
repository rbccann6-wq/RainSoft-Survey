// Demo survey for training - EXACT COPY OF REAL SURVEY but no data saved
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import SignatureScreen from 'react-native-signature-canvas';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SPACING, FONTS, LOWES_THEME, isTablet } from '@/constants/theme';
import { SURVEY_QUESTIONS, getAvailableTimes } from '@/constants/surveyQuestions';
import { lookupZipCode, formatAddress } from '@/services/zipLookupService';

export default function DemoSurveyScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const signatureRef = useRef<any>();
  
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [answers, setAnswers] = useState<Record<string, any>>({});
  const [signature, setSignature] = useState('');
  
  // Contact info state
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [isLookingUpZip, setIsLookingUpZip] = useState(false);
  const [zipLookupError, setZipLookupError] = useState('');
  
  // Appointment state
  const [showAppointment, setShowAppointment] = useState(false);
  const [appointmentAddress, setAppointmentAddress] = useState('');
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [currentWeekStart, setCurrentWeekStart] = useState(getStartOfWeek(new Date()));
  const [selectedTime, setSelectedTime] = useState('');
  const [appointmentNotes, setAppointmentNotes] = useState('');
  
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
  
  const theme = LOWES_THEME; // Demo always uses Lowes theme
  const currentQuestion = SURVEY_QUESTIONS[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / SURVEY_QUESTIONS.length) * 100;

  // Demo counts (static for training)
  const demoCounts = {
    renters: 3,
    surveys: 12,
    appointments: 5,
  };

  const handleAnswer = (answer: any) => {
    const newAnswers = { ...answers, [currentQuestion.id]: answer };
    setAnswers(newAnswers);

    // Check if survey should end early (renter)
    if (currentQuestion.id === 'is_homeowner' && answer === 'No') {
      endSurveyEarly('renter', newAnswers);
      return;
    }

    // Move to next question
    if (currentQuestionIndex < SURVEY_QUESTIONS.length - 1) {
      setCurrentQuestionIndex(currentQuestionIndex + 1);
    }
  };

  // Auto-lookup city/state when zip code is entered
  const handleZipCodeChange = async (newZipCode: string) => {
    setZipCode(newZipCode);
    setZipLookupError('');
    
    if (newZipCode.length === 5 && /^\d{5}$/.test(newZipCode)) {
      setIsLookingUpZip(true);
      const result = await lookupZipCode(newZipCode);
      setIsLookingUpZip(false);
      
      if (result.success && result.city && result.stateAbbr) {
        setCity(result.city);
        setState(result.stateAbbr);
      } else {
        setCity('');
        setState('');
        if (result.error) {
          setZipLookupError(result.error);
        }
      }
    } else {
      setCity('');
      setState('');
    }
  };

  const handleContactInfoContinue = () => {
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !zipCode.trim()) {
      showAlert('Required Fields', 'Please enter first name, last name, phone number, and zip code');
      return;
    }
    
    if (zipCode.length !== 5) {
      showAlert('Invalid Zip Code', 'Please enter a valid 5-digit zip code');
      return;
    }
    
    if (phone.trim().length < 10) {
      showAlert('Invalid Phone', 'Please enter a valid phone number');
      return;
    }
    
    if (!city || !state) {
      showAlert(
        'Address Incomplete',
        'City and state could not be determined from zip code. Survey will be saved with zip code only.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue Anyway',
            onPress: () => {
              const contactData = {
                firstName: firstName.trim(),
                lastName: lastName.trim(),
                phone: phone.trim(),
                zipCode: zipCode.trim(),
                city: city.trim(),
                state: state.trim(),
              };
              
              setAnswers({ ...answers, contact_info: contactData });
              setCurrentQuestionIndex(currentQuestionIndex + 1);
            },
          },
        ]
      );
      return;
    }
    
    const contactData = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      phone: phone.trim(),
      zipCode: zipCode.trim(),
      city: city.trim(),
      state: state.trim(),
    };
    
    setAnswers({ ...answers, contact_info: contactData });
    setCurrentQuestionIndex(currentQuestionIndex + 1);
  };

  const endSurveyEarly = (category: 'renter', currentAnswers: Record<string, any>) => {
    showAlert(
      '🎓 Training Complete',
      'Survey recorded as renter contact. In real mode, this would be saved.\n\nGreat job practicing!',
      [
        {
          text: 'Restart Demo',
          onPress: resetDemo,
        },
        {
          text: 'Exit Training',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const handleSignatureEnd = () => {
    signatureRef.current?.readSignature();
  };

  const handleSignature = (sig: string) => {
    setSignature(sig);
  };

  const handleComplete = () => {
    if (!signature) {
      showAlert('Signature Required', 'Please capture customer signature to complete');
      return;
    }

    showAlert('Survey Complete', 'Would the customer like to set an appointment for a free in-home water analysis?', [
      {
        text: 'Set Appointment',
        onPress: () => setShowAppointment(true),
      },
      {
        text: 'Skip Appointment',
        onPress: () => handleSkipAppointment(),
      },
    ]);
  };

  const handleAppointmentComplete = () => {
    if (!appointmentAddress || !selectedDate || !selectedTime) {
      showAlert('Required Fields', 'Please fill in address, date, and time');
      return;
    }

    showAlert(
      '🎓 Training Complete',
      'Perfect! In real mode, this appointment would sync to Zapier.\n\nYou practiced:\n✓ Full survey flow\n✓ Contact capture\n✓ Signature collection\n✓ Appointment booking\n\nYou\'re ready for real surveys!',
      [
        {
          text: 'Restart Demo',
          onPress: resetDemo,
        },
        {
          text: 'Exit Training',
          onPress: () => router.back(),
        },
      ]
    );
  };

  const handleAbandonSurvey = () => {
    const hasPhone = !!answers.contact_info?.phone;

    if (hasPhone) {
      showAlert(
        'Abandon Survey?',
        'Phone number detected. In real mode, this survey would be saved and synced to Salesforce.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save & Start New',
            onPress: () => {
              showAlert(
                '🎓 Demo Reset',
                'In real mode, the partial survey would be saved.\n\nStarting new demo survey...',
                [{ text: 'OK', onPress: resetDemo }]
              );
            },
          },
        ]
      );
    } else {
      showAlert(
        'Abandon Survey?',
        'No phone number entered. This survey will be discarded without saving.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard & Start New',
            style: 'destructive',
            onPress: resetDemo,
          },
        ]
      );
    }
  };

  const handleSkipAppointment = () => {
    showAlert(
      'Skip Appointment?',
      'This will complete the survey without scheduling an appointment.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Skip',
          onPress: () => {
            showAlert(
              '🎓 Training Complete',
              'Great job! In real mode, this survey would sync to Salesforce.\n\nYou practiced the full survey flow!',
              [
                { text: 'Restart Demo', onPress: resetDemo },
                { text: 'Exit Training', onPress: () => router.back() },
              ]
            );
          },
        },
      ]
    );
  };

  const resetDemo = () => {
    setCurrentQuestionIndex(0);
    setAnswers({});
    setSignature('');
    setFirstName('');
    setLastName('');
    setPhone('');
    setZipCode('');
    setCity('');
    setState('');
    setZipLookupError('');
    setShowAppointment(false);
    setAppointmentAddress('');
    setSelectedDate(null);
    setCurrentWeekStart(getStartOfWeek(new Date()));
    setSelectedTime('');
    setAppointmentNotes('');
  };

  const handleExit = () => {
    showAlert(
      'Exit Training',
      'Are you sure you want to exit practice mode?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit',
          onPress: () => router.back(),
        },
      ]
    );
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
    setSelectedTime('');
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

  // Show appointment screen if that's active
  if (showAppointment) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
        <View style={styles.trainingBanner}>
          <MaterialIcons name="school" size={20} color="#FFFFFF" />
          <Text style={styles.trainingBannerText}>🎓 TRAINING MODE - NO DATA SAVED</Text>
        </View>

        <View style={[styles.header, { backgroundColor: theme.primary }]}>
          <MaterialIcons name="event" size={32} color="#FFFFFF" />
          <Text style={styles.headerTitle}>Set Appointment (Demo)</Text>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <Input
            label="Street Address"
            value={appointmentAddress}
            onChangeText={setAppointmentAddress}
            placeholder="123 Main St, City, State, Zip"
            borderColor={theme.primary}
          />

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
                    <ScrollView style={styles.timesScrollView}>
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
                    Select a date from the calendar
                  </Text>
                </View>
              )}
            </View>
          </View>

          <Input
            label="Notes (Optional)"
            value={appointmentNotes}
            onChangeText={setAppointmentNotes}
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
            title="Confirm Appointment (Demo)"
            onPress={handleAppointmentComplete}
            backgroundColor={theme.primary}
            size="large"
            fullWidth
            disabled={!appointmentAddress || !selectedDate || !selectedTime}
          />

          <Pressable
            style={styles.skipButton}
            onPress={handleSkipAppointment}
          >
            <MaterialIcons name="skip-next" size={12} color="#999" />
            <Text style={styles.skipButtonText}>Skip Appointment</Text>
          </Pressable>
        </ScrollView>

        <Pressable onPress={handleExit} style={styles.exitButton}>
          <MaterialIcons name="close" size={20} color="#FFFFFF" />
          <Text style={styles.exitButtonText}>Exit Training</Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  // Main survey flow
  const renderQuestion = () => {
    const answer = answers[currentQuestion.id];

    switch (currentQuestion.type) {
      case 'yesno':
        return (
          <View style={styles.optionsContainer}>
            <Button
              title="Yes"
              onPress={() => handleAnswer('Yes')}
              backgroundColor={theme.success}
              size="large"
              fullWidth
            />
            <Button
              title="No"
              onPress={() => handleAnswer('No')}
              backgroundColor={theme.error}
              size="large"
              fullWidth
            />
          </View>
        );

      case 'choice':
        return (
          <View style={styles.optionsContainer}>
            {currentQuestion.options?.map((option) => (
              <Button
                key={option}
                title={option}
                onPress={() => handleAnswer(option)}
                variant={answer === option ? 'primary' : 'outline'}
                backgroundColor={answer === option ? theme.primary : 'transparent'}
                textColor={answer === option ? '#FFFFFF' : theme.primary}
                size="large"
                fullWidth
              />
            ))}
            {currentQuestion.allowNext && (
              <Button
                title="Continue"
                onPress={() => setCurrentQuestionIndex(currentQuestionIndex + 1)}
                backgroundColor={theme.primary}
                size="large"
                fullWidth
              />
            )}
          </View>
        );

      case 'contact':
        return (
          <View style={styles.inputContainer}>
            <View style={styles.nameRow}>
              <View style={styles.nameInput}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>First Name</Text>
                <Input
                  value={firstName}
                  onChangeText={setFirstName}
                  placeholder="John"
                  borderColor={theme.primary}
                />
              </View>
              <View style={styles.nameInput}>
                <Text style={[styles.inputLabel, { color: theme.text }]}>Last Name</Text>
                <Input
                  value={lastName}
                  onChangeText={setLastName}
                  placeholder="Smith"
                  borderColor={theme.primary}
                />
              </View>
            </View>
            
            <View>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Phone Number</Text>
              <Input
                value={phone}
                onChangeText={setPhone}
                placeholder="(555) 123-4567"
                keyboardType="phone-pad"
                borderColor={theme.primary}
              />
            </View>
            
            <View>
              <Text style={[styles.inputLabel, { color: theme.text }]}>Zip Code</Text>
              <Input
                value={zipCode}
                onChangeText={handleZipCodeChange}
                placeholder="12345"
                keyboardType="number-pad"
                maxLength={5}
                borderColor={zipLookupError ? theme.error : theme.primary}
              />
              {isLookingUpZip && (
                <View style={styles.lookupIndicator}>
                  <MaterialIcons name="search" size={16} color={theme.primary} />
                  <Text style={[styles.helperText, { color: theme.primary }]}>
                    Looking up address...
                  </Text>
                </View>
              )}
              {zipLookupError && (
                <View style={styles.errorIndicator}>
                  <MaterialIcons 
                    name={zipLookupError.includes('Offline') ? 'info' : 'error'} 
                    size={16} 
                    color={zipLookupError.includes('Offline') ? theme.primary : theme.error} 
                  />
                  <Text style={[styles.helperText, { 
                    color: zipLookupError.includes('Offline') ? theme.primary : theme.error 
                  }]}>
                    {zipLookupError}
                  </Text>
                </View>
              )}
              {city && state && !isLookingUpZip && (
                <View style={styles.successIndicator}>
                  <MaterialIcons name="check-circle" size={16} color={theme.success} />
                  <Text style={[styles.helperText, { color: theme.success }]}>
                    {formatAddress(zipCode, city, state)}
                  </Text>
                </View>
              )}
            </View>
            
            <Button
              title="Continue"
              onPress={handleContactInfoContinue}
              backgroundColor={theme.primary}
              size="large"
              fullWidth
              disabled={!firstName.trim() || !lastName.trim() || !phone.trim() || !zipCode.trim() || zipCode.length !== 5 || isLookingUpZip}
            />
          </View>
        );

      case 'signature':
        return (
          <View style={styles.signatureContainer}>
            <View style={styles.signatureBox}>
              <SignatureScreen
                ref={signatureRef}
                onOK={handleSignature}
                onEmpty={() => console.log('Signature is empty')}
                onClear={() => setSignature('')}
                onBegin={() => console.log('Signature started')}
                onEnd={handleSignatureEnd}
                descriptionText="Sign above (auto-saves when you lift finger)"
                clearText="Clear"
                confirmText="Save"
                webStyle={`
                  .m-signature-pad {
                    box-shadow: none;
                    border: 3px solid ${theme.primary};
                    border-radius: 8px;
                  }
                  .m-signature-pad--body {
                    border: none;
                  }
                  .m-signature-pad--footer {
                    display: none;
                  }
                  body,html {
                    width: 100%;
                    height: 100%;
                  }
                `}
              />
            </View>
            <View style={styles.signatureInfo}>
              <MaterialIcons name="info" size={16} color={theme.primary} />
              <Text style={[styles.signatureInfoText, { color: theme.textSubtle }]}>
                {signature ? 'Signature captured ✓' : 'Draw signature above'}
              </Text>
            </View>
            <Button
              title="Clear Signature"
              onPress={() => {
                signatureRef.current?.clearSignature();
                setSignature('');
              }}
              variant="outline"
              fullWidth
            />
            <Button
              title="Complete Survey"
              onPress={handleComplete}
              backgroundColor={theme.success}
              size="large"
              fullWidth
              disabled={!signature}
            />
          </View>
        );

      default:
        return null;
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.trainingBanner}>
        <MaterialIcons name="school" size={20} color="#FFFFFF" />
        <Text style={styles.trainingBannerText}>🎓 TRAINING MODE - NO DATA SAVED</Text>
      </View>

      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <View style={styles.headerTop}>
          <View style={styles.leftSection}>
            <View style={styles.storeBadge}>
              <MaterialIcons name="store" size={20} color="#FFFFFF" />
              <Text style={styles.storeText}>Lowes (Demo)</Text>
            </View>
          </View>
          
          <View style={styles.countsContainer}>
            <View style={styles.countBadge}>
              <Text style={styles.countLabel}>Renters</Text>
              <Text style={styles.countValue}>{demoCounts.renters}</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countLabel}>Surveys</Text>
              <Text style={styles.countValue}>{demoCounts.surveys}</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countLabel}>Appointments</Text>
              <Text style={styles.countValue}>{demoCounts.appointments}</Text>
            </View>
          </View>
        </View>

        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {SURVEY_QUESTIONS.length}
          </Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.questionCard}>
          <Text style={[styles.questionNumber, { color: theme.textSubtle }]}>
            Question {currentQuestionIndex + 1}
          </Text>
          <Text style={[styles.questionText, { color: theme.text }]}>
            {currentQuestion.question}
          </Text>
        </View>

        {renderQuestion()}

        {currentQuestionIndex > 0 && currentQuestion.type !== 'signature' && (
          <Button
            title="Previous Question"
            onPress={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
            variant="outline"
            fullWidth
          />
        )}

        {currentQuestionIndex > 0 && (
          <Pressable
            style={styles.abandonButton}
            onPress={handleAbandonSurvey}
          >
            <MaterialIcons name="cancel" size={10} color="#999" />
            <Text style={styles.abandonButtonText}>
              Abandon Survey
            </Text>
          </Pressable>
        )}
      </ScrollView>

      <Pressable onPress={handleExit} style={styles.exitButton}>
        <MaterialIcons name="close" size={20} color="#FFFFFF" />
        <Text style={styles.exitButtonText}>Exit Training</Text>
      </Pressable>
    </SafeAreaView>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const isTabletDevice = isTablet();
const contentMaxWidth = isTabletDevice ? 800 : undefined;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: isTabletDevice ? 'center' : 'stretch',
  },
  trainingBanner: {
    backgroundColor: '#FF9800',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 2,
    borderBottomColor: '#F57C00',
  },
  trainingBannerText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  header: {
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.lg,
    gap: SPACING.md,
  },
  headerTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  leftSection: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  storeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.sm,
    borderRadius: 20,
  },
  storeText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  countsContainer: {
    flexDirection: 'row',
    gap: SPACING.sm,
  },
  countBadge: {
    backgroundColor: 'rgba(255,255,255,0.2)',
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.xs,
    borderRadius: 8,
    alignItems: 'center',
    minWidth: 60,
  },
  countLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: FONTS.sizes.xs,
  },
  countValue: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
  },
  progressContainer: {
    gap: SPACING.xs,
  },
  progressBar: {
    height: 8,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 4,
  },
  progressText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    textAlign: 'center',
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.lg,
    width: '100%',
    maxWidth: contentMaxWidth,
    alignSelf: 'center',
    paddingBottom: 80,
  },
  questionCard: {
    backgroundColor: '#FFFFFF',
    padding: isTabletDevice ? SPACING.xl : SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  questionNumber: {
    fontSize: FONTS.sizes.sm,
    textTransform: 'uppercase',
    fontWeight: '600',
  },
  questionText: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '600',
    lineHeight: 28,
  },
  optionsContainer: {
    gap: SPACING.md,
    flexDirection: isTabletDevice ? 'row' : 'column',
    flexWrap: 'wrap',
  },
  inputContainer: {
    gap: SPACING.md,
  },
  nameRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  nameInput: {
    flex: 1,
  },
  inputLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  helperText: {
    fontSize: FONTS.sizes.xs,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
  lookupIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  errorIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  successIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.xs,
  },
  signatureContainer: {
    gap: SPACING.md,
  },
  signatureBox: {
    height: 300,
    borderRadius: 12,
    overflow: 'hidden',
    backgroundColor: '#FFFFFF',
  },
  signatureInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
  },
  signatureInfoText: {
    fontSize: FONTS.sizes.sm,
  },
  exitButton: {
    position: 'absolute',
    bottom: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    backgroundColor: '#D32F2F',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 8,
    zIndex: 10,
  },
  exitButtonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: '#FFFFFF',
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
  abandonButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'center',
    marginTop: SPACING.sm,
  },
  abandonButtonText: {
    fontSize: FONTS.sizes.xs,
    color: '#999',
    textDecorationLine: 'underline',
  },
  skipButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 3,
    paddingVertical: 4,
    paddingHorizontal: 8,
    alignSelf: 'center',
    marginTop: -SPACING.sm,
  },
  skipButtonText: {
    fontSize: FONTS.sizes.xs,
    color: '#999',
    textDecorationLine: 'underline',
  },
});
