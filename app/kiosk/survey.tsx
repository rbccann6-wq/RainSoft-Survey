// Survey questionnaire - one question per page
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Dimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import SignatureScreen from 'react-native-signature-canvas';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SPACING, FONTS, getTheme, isTablet } from '@/constants/theme';
import { SURVEY_QUESTIONS } from '@/constants/surveyQuestions';
import { Survey } from '@/types';
import { lookupZipCode, formatAddress } from '@/services/zipLookupService';
import * as ActivityService from '@/services/activityService';

export default function SurveyScreen() {
  const router = useRouter();
  const { currentUser, selectedStore, submitSurvey, dailyCounts, isOnline, setKioskActive, updateLastActivity } = useApp();
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
  const [isPageVisible, setIsPageVisible] = useState(true);
  const heartbeatIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [activeTimeEntryId, setActiveTimeEntryId] = useState<string | null>(null);
  const lastQuestionChangeRef = useRef<Date>(new Date());
  const inactivityTimerRef = useRef<NodeJS.Timeout | null>(null);
  const [numberValue, setNumberValue] = useState('');

  // Get active time entry ID
  React.useEffect(() => {
    const loadActiveEntry = async () => {
      if (!currentUser) return;
      const { getTimeEntries } = require('@/services/storageService');
      const timeEntries = await getTimeEntries() || [];
      const activeEntry = timeEntries.find((e: any) => e.employeeId === currentUser.id && !e.clockOut);
      if (activeEntry) {
        setActiveTimeEntryId(activeEntry.id);
      }
    };
    loadActiveEntry();
  }, [currentUser]);

  // Heartbeat tracking - Send heartbeats every 30 seconds while on survey page
  React.useEffect(() => {
    if (!currentUser || !activeTimeEntryId) {
      return;
    }
    
    // Set up heartbeat interval (every 30 seconds)
    const heartbeatInterval = setInterval(() => {
      if (isPageVisible) {
        ActivityService.logActivity({
          employeeId: currentUser.id,
          timeEntryId: activeTimeEntryId,
          eventType: 'app_heartbeat',
          pagePath: '/kiosk/survey',
          isPageVisible: true,
          metadata: {
            currentQuestion: currentQuestionIndex + 1,
            hasAnswers: Object.keys(answers).length > 0,
            heartbeat: true,
          },
        });
      }
    }, 30000); // 30 seconds
    
    return () => clearInterval(heartbeatInterval);
  }, [currentUser, activeTimeEntryId, isPageVisible, currentQuestionIndex, answers]);

  // Inactivity detection - mark inactive if no survey progress in 5 minutes
  React.useEffect(() => {
    if (!currentUser || !activeTimeEntryId) {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
      return;
    }

    // Clear existing timer
    if (inactivityTimerRef.current) {
      clearTimeout(inactivityTimerRef.current);
    }

    // Set 5-minute inactivity timer
    inactivityTimerRef.current = setTimeout(async () => {
      // User has been on same question for 5+ minutes without progressing
      await ActivityService.logActivity({
        employeeId: currentUser.id,
        timeEntryId: activeTimeEntryId,
        eventType: 'survey_inactivity_detected',
        pagePath: '/kiosk/survey',
        isPageVisible: isPageVisible,
        metadata: {
          currentQuestion: currentQuestionIndex + 1,
          inactiveDuration: 5,
          reason: 'No survey progress for 5 minutes',
        },
      });

      // Update time entry to mark as inactive in kiosk
      const { getSupabaseClient } = require('@/template');
      const supabase = getSupabaseClient();
      await supabase
        .from('time_entries')
        .update({ is_active_in_kiosk: false })
        .eq('id', activeTimeEntryId);

      console.log('⚠️ Employee marked inactive - no survey progress in 5 minutes');
    }, 5 * 60 * 1000); // 5 minutes

    return () => {
      if (inactivityTimerRef.current) {
        clearTimeout(inactivityTimerRef.current);
        inactivityTimerRef.current = null;
      }
    };
  }, [currentQuestionIndex, currentUser, activeTimeEntryId, isPageVisible]);

  // Log survey started event
  React.useEffect(() => {
    if (currentUser && activeTimeEntryId && currentQuestionIndex === 0) {
      ActivityService.logActivity({
        employeeId: currentUser.id,
        timeEntryId: activeTimeEntryId,
        eventType: 'survey_started',
        pagePath: '/kiosk/survey',
        isPageVisible: isPageVisible,
        metadata: { store: selectedStore },
      });
    }
  }, []);

  // Format phone number as user types: (334) 499-4646
  const handlePhoneChange = (text: string) => {
    const digits = text.replace(/\D/g, '');
    const limitedDigits = digits.slice(0, 10);
    
    let formatted = '';
    if (limitedDigits.length === 0) {
      formatted = '';
    } else if (limitedDigits.length <= 3) {
      formatted = `(${limitedDigits}`;
    } else if (limitedDigits.length <= 6) {
      formatted = `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3)}`;
    } else {
      formatted = `(${limitedDigits.slice(0, 3)}) ${limitedDigits.slice(3, 6)}-${limitedDigits.slice(6)}`;
    }
    
    setPhone(formatted);
  };
  
  const theme = selectedStore ? getTheme(selectedStore) : getTheme('lowes');
  const currentQuestion = SURVEY_QUESTIONS[currentQuestionIndex];
  const progress = ((currentQuestionIndex + 1) / SURVEY_QUESTIONS.length) * 100;

  // Prevent back navigation - force kiosk mode
  React.useEffect(() => {
    const backHandler = () => {
      showAlert('Kiosk Mode Active', 'Please complete the survey or use Exit Kiosk button.');
      return true;
    };
  }, []);

  const handleExitKiosk = () => {
    showAlert(
      'Exit Kiosk Mode',
      'Are you sure you want to exit survey mode? You will remain clocked in but marked as inactive.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Exit Kiosk',
          style: 'destructive',
          onPress: async () => {
            // Log kiosk exit event
            if (currentUser && activeTimeEntryId) {
              await ActivityService.logActivity({
                employeeId: currentUser.id,
                timeEntryId: activeTimeEntryId,
                eventType: 'kiosk_exited',
                pagePath: '/kiosk/survey',
                isPageVisible: isPageVisible,
                metadata: { reason: 'user_exit' },
              });
            }
            await setKioskActive(false);
            router.replace('/kiosk');
          },
        },
      ]
    );
  };

  const handleAnswer = (answer: any) => {
    // Track activity for inactivity detection
    updateLastActivity();
    
    // Reset inactivity timer - user is making progress
    lastQuestionChangeRef.current = new Date();
    
    // Log survey page change with progress indicator
    if (currentUser && activeTimeEntryId) {
      ActivityService.logActivity({
        employeeId: currentUser.id,
        timeEntryId: activeTimeEntryId,
        eventType: 'survey_page_changed',
        pagePath: '/kiosk/survey',
        isPageVisible: isPageVisible,
        metadata: {
          fromQuestion: currentQuestionIndex + 1,
          toQuestion: currentQuestionIndex + 2,
          answer: answer,
          questionId: currentQuestion.id,
          surveyProgress: true, // Indicates actual progress
        },
      });
    }
    
    // Transform tastes_odors answer: Yes → "Tastes;Odors", No → "No Problems"
    let transformedAnswer = answer;
    if (currentQuestion.id === 'tastes_odors') {
      transformedAnswer = answer === 'Yes' ? 'Tastes;Odors' : 'No Problems';
    }
    
    const newAnswers = { ...answers, [currentQuestion.id]: transformedAnswer };
    setAnswers(newAnswers);

    // Check if survey should end early
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
    
    // Only lookup if we have 5 digits
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
    // Track activity and reset inactivity timer
    updateLastActivity();
    lastQuestionChangeRef.current = new Date();
    
    if (!firstName.trim() || !lastName.trim() || !phone.trim() || !zipCode.trim()) {
      showAlert('Required Fields', 'Please enter first name, last name, phone number, and zip code');
      return;
    }
    
    if (zipCode.length !== 5) {
      showAlert('Invalid Zip Code', 'Please enter a valid 5-digit zip code');
      return;
    }
    
    const phoneDigits = phone.replace(/\D/g, '');
    if (phoneDigits.length !== 10) {
      showAlert('Invalid Phone', 'Please enter a valid 10-digit phone number');
      return;
    }
    
    // Warn if city/state could not be determined
    if (!city || !state) {
      showAlert(
        'Address Incomplete',
        'City and state could not be determined from zip code. Survey will be saved with zip code only.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Continue Anyway',
            onPress: () => {
              // Save contact info with whatever we have
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
    
    // Save complete contact info to answers
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

  const endSurveyEarly = async (category: 'renter', currentAnswers: Record<string, any>) => {
    const employeeAlias = currentUser ? 
      (currentUser.firstName.substring(0, 2) + currentUser.lastName.substring(0, 2)).toUpperCase() : 
      '';

    // Get GPS-matched store location from active time entry
    const { getTimeEntries } = require('@/services/storageService');
    const timeEntries = await getTimeEntries() || [];
    const activeEntry = timeEntries.find((e: any) => e.employeeId === currentUser!.id && !e.clockOut);

    const survey: Survey = {
      id: Date.now().toString(),
      employeeId: currentUser!.id,
      employeeAlias,
      store: selectedStore!,
      storeName: activeEntry?.storeName, // Specific store like "HOME DEPOT 0808"
      storeNumber: activeEntry?.storeNumber, // Store number like "0808"
      storeAddress: activeEntry?.storeAddress, // Full verified address
      timestamp: new Date().toISOString(),
      answers: currentAnswers,
      signature: '',
      category,
      syncedToSalesforce: false,
      syncedToZapier: false,
      locationVerified: activeEntry?.locationVerified || false,
    };

    await submitSurvey(survey);
    
    showAlert('Survey Complete', 'Thank you! This survey has been recorded as a renter contact.', [
      {
        text: 'Start Next Survey',
        onPress: () => {
          // Reset survey state and start new one
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
          setNumberValue('');
        },
      },
    ]);
  };

  const handleSignatureEnd = () => {
    // Track activity and auto-save when user lifts finger
    updateLastActivity();
    lastQuestionChangeRef.current = new Date();
    signatureRef.current?.readSignature();
  };

  const handleSignature = (sig: string) => {
    setSignature(sig);
  };

  const handleComplete = async () => {
    // Track activity and reset inactivity timer
    updateLastActivity();
    lastQuestionChangeRef.current = new Date();
    
    // Log survey submitted event
    if (currentUser && activeTimeEntryId) {
      ActivityService.logActivity({
        employeeId: currentUser.id,
        timeEntryId: activeTimeEntryId,
        eventType: 'survey_submitted',
        pagePath: '/kiosk/survey',
        isPageVisible: isPageVisible,
        metadata: {
          category: 'survey',
          hasSignature: !!signature,
        },
      });
    }
    
    if (!signature) {
      showAlert('Signature Required', 'Please capture customer signature to complete');
      return;
    }

    // Determine category based on answers
    const isHomeowner = answers.is_homeowner === 'Yes';
    const hasPhone = !!answers.contact_info?.phone;

    // Generate employee alias (first 2 letters first name + first 2 letters last name)
    const employeeAlias = currentUser ? 
      (currentUser.firstName.substring(0, 2) + currentUser.lastName.substring(0, 2)).toUpperCase() : 
      '';

    // Get GPS-matched store location from active time entry
    const { getTimeEntries } = require('@/services/storageService');
    const timeEntries = await getTimeEntries() || [];
    const activeEntry = timeEntries.find((e: any) => e.employeeId === currentUser!.id && !e.clockOut);

    const surveyToSubmit: Survey = {
      id: Date.now().toString(),
      employeeId: currentUser!.id,
      employeeAlias,
      store: selectedStore!,
      storeName: activeEntry?.storeName, // Specific store like "HOME DEPOT 0808"
      storeNumber: activeEntry?.storeNumber, // Store number like "0808"
      storeAddress: activeEntry?.storeAddress, // Full verified address
      timestamp: new Date().toISOString(),
      answers,
      signature,
      category: 'survey', // Will be updated if appointment is set
      syncedToSalesforce: false, // Will be marked true after successful sync
      syncedToZapier: false,
      locationVerified: activeEntry?.locationVerified || false,
    };

    // Ask if customer wants to set appointment
    showAlert('Survey Complete', 'Would the customer like to set an appointment for a free in-home water analysis?', [
      {
        text: 'Set Appointment',
        onPress: () => {
          router.replace({
            pathname: '/kiosk/appointment',
            params: { surveyData: JSON.stringify(surveyToSubmit) },
          });
        },
      },
      {
        text: 'No Appointment',
        onPress: async () => {
          // Submit survey and wait for confirmation
          try {
            await submitSurvey(surveyToSubmit);
            console.log('✅ Survey submitted successfully');
            
            // Reset UI for next survey
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
            setNumberValue('');
          } catch (err) {
            console.error('❌ Survey submission error:', err);
            showAlert('Error', 'Failed to save survey. Please try again.');
          }
        },
      },
    ]);
  };

  const handleAbandonSurvey = () => {
    // Check if phone number has been entered
    const hasPhone = !!answers.contact_info?.phone;

    // Always require confirmation before abandoning
    if (hasPhone) {
      // Phone number entered - sync as survey
      showAlert(
        'Abandon Survey?',
        'Phone number detected. This survey will be saved and synced to Salesforce.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Save & Start New',
            onPress: async () => {
              const employeeAlias = currentUser ? 
                (currentUser.firstName.substring(0, 2) + currentUser.lastName.substring(0, 2)).toUpperCase() : 
                '';

              // Get GPS-matched store location from active time entry
              const { getTimeEntries } = require('@/services/storageService');
              const timeEntries = await getTimeEntries() || [];
              const activeEntry = timeEntries.find((e: any) => e.employeeId === currentUser!.id && !e.clockOut);

              const partialSurvey: Survey = {
                id: Date.now().toString(),
                employeeId: currentUser!.id,
                employeeAlias,
                store: selectedStore!,
                storeName: activeEntry?.storeName,
                storeNumber: activeEntry?.storeNumber,
                storeAddress: activeEntry?.storeAddress,
                timestamp: new Date().toISOString(),
                answers,
                signature: '', // No signature yet
                category: 'survey',
                syncedToSalesforce: false, // Will be marked true after successful sync
                syncedToZapier: false,
                locationVerified: activeEntry?.locationVerified || false,
              };

              await submitSurvey(partialSurvey);
              
              // Reset for next survey
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
              setNumberValue('');
            },
          },
        ]
      );
    } else {
      // No phone number - discard survey
      showAlert(
        'Abandon Survey?',
        'No phone number entered. This survey will be discarded without saving.',
        [
          { text: 'Cancel', style: 'cancel' },
          {
            text: 'Discard & Start New',
            style: 'destructive',
            onPress: () => {
              // Reset for next survey
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
              setNumberValue('');
            },
          },
        ]
      );
    }
  };

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

      case 'number':
        return (
          <View style={styles.inputContainer}>
            <Input
              value={numberValue}
              onChangeText={(text) => {
                // Only allow numbers
                const numericValue = text.replace(/[^0-9]/g, '');
                setNumberValue(numericValue);
              }}
              placeholder={currentQuestion.placeholder || 'Enter number'}
              keyboardType="number-pad"
              borderColor={theme.primary}
            />
            <Button
              title="Continue"
              onPress={() => {
                if (numberValue && parseInt(numberValue) > 0) {
                  handleAnswer(parseInt(numberValue));
                  setNumberValue(''); // Reset after answering
                } else {
                  showAlert('Invalid Input', 'Please enter a valid number');
                }
              }}
              backgroundColor={theme.primary}
              size="large"
              fullWidth
              disabled={!numberValue || parseInt(numberValue) <= 0}
            />
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
                onChangeText={handlePhoneChange}
                placeholder="(334) 499-4646"
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
              disabled={!firstName.trim() || !lastName.trim() || !phone.trim() || phone.replace(/\D/g, '').length !== 10 || !zipCode.trim() || zipCode.length !== 5 || isLookingUpZip}
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
      {/* Header with counts and progress */}
      <View style={[styles.header, { backgroundColor: theme.primary }]}>
        <View style={styles.headerTop}>
          <View style={styles.leftSection}>
            <View style={styles.storeBadge}>
              <MaterialIcons name="store" size={20} color="#FFFFFF" />
              <Text style={styles.storeText}>
                {selectedStore === 'lowes' ? 'Lowes' : 'Home Depot'}
              </Text>
            </View>
          </View>
          
          <View style={styles.countsContainer}>
            <View style={styles.countBadge}>
              <Text style={styles.countLabel}>Renters</Text>
              <Text style={styles.countValue}>{dailyCounts.renters}</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countLabel}>Surveys</Text>
              <Text style={styles.countValue}>{dailyCounts.surveys}</Text>
            </View>
            <View style={styles.countBadge}>
              <Text style={styles.countLabel}>Appointments</Text>
              <Text style={styles.countValue}>{dailyCounts.appointments}</Text>
            </View>
          </View>
        </View>

        {/* Progress bar */}
        <View style={styles.progressContainer}>
          <View style={styles.progressBar}>
            <View style={[styles.progressFill, { width: `${progress}%` }]} />
          </View>
          <Text style={styles.progressText}>
            Question {currentQuestionIndex + 1} of {SURVEY_QUESTIONS.length}
          </Text>
        </View>
      </View>

      {/* Question */}
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

        {/* Back button (except on first question) */}
        {currentQuestionIndex > 0 && currentQuestion.type !== 'signature' && (
          <Button
            title="Previous Question"
            onPress={() => setCurrentQuestionIndex(currentQuestionIndex - 1)}
            variant="outline"
            fullWidth
          />
        )}

        {/* Abandon Survey Button - Small at bottom */}
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

      {/* Online Status Badge - Bottom Left */}
      <View style={[
        styles.onlineStatusBadge,
        { backgroundColor: isOnline ? 'rgba(76, 175, 80, 0.95)' : 'rgba(244, 67, 54, 0.95)' }
      ]}>
        <MaterialIcons 
          name={isOnline ? 'cloud-done' : 'cloud-off'} 
          size={16} 
          color="#FFFFFF" 
        />
        <Text style={styles.onlineStatusText}>
          {isOnline ? 'ONLINE' : 'OFFLINE'}
        </Text>
      </View>

      {/* Exit Kiosk Button */}
      <Pressable 
        onPress={handleExitKiosk}
        style={styles.exitButton}
      >
        <MaterialIcons name="exit-to-app" size={20} color="#FFFFFF" />
        <Text style={styles.exitButtonText}>Exit Kiosk</Text>
      </Pressable>

      {/* Connection warning overlay */}
      {!isOnline && (
        <View style={styles.offlineWarning}>
          <MaterialIcons name="warning" size={24} color="#FFF" />
          <View style={styles.offlineWarningContent}>
            <Text style={styles.offlineWarningTitle}>OFFLINE MODE</Text>
            <Text style={styles.offlineWarningText}>
              Surveys will be saved locally and synced when connection is restored
            </Text>
          </View>
        </View>
      )}
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
  onlineStatusBadge: {
    position: 'absolute',
    bottom: SPACING.lg,
    left: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
    zIndex: 10,
  },
  onlineStatusText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
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
  offlineWarning: {
    position: 'absolute',
    top: 100,
    left: SPACING.lg,
    right: SPACING.lg,
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: '#FF6B00',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderRadius: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 3 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
    elevation: 10,
  },
  offlineWarningContent: {
    flex: 1,
  },
  offlineWarningTitle: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    marginBottom: 2,
  },
  offlineWarningText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    lineHeight: 16,
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
});
