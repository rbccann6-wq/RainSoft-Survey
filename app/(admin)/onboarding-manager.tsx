// Onboarding manager - View and customize onboarding process
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import * as StorageService from '@/services/storageService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';

export default function OnboardingManagerScreen() {
  const { loadData } = useApp();
  const { showAlert } = useAlert();
  const [compensationSettings, setCompensationSettings] = useState({
    baseHourlyRate: 15,
    surveyInstallBonus: 10,
    appointmentInstallBonus: 25,
    quota: 5,
  });
  const [isEditingCompensation, setIsEditingCompensation] = useState(false);
  const [previewStep, setPreviewStep] = useState<number | null>(null);

  React.useEffect(() => {
    loadCompensation();
  }, []);

  const loadCompensation = async () => {
    const settings = await StorageService.getCompensationSettings();
    setCompensationSettings(settings);
  };

  const saveCompensation = async () => {
    await StorageService.saveCompensationSettings(compensationSettings);
    await loadData();
    setIsEditingCompensation(false);
    showAlert('Settings Updated', 'Compensation settings have been saved');
  };

  const onboardingSteps = [
    {
      step: 1,
      title: 'Basic Information',
      description: 'Employee provides address, DOB, SSN, emergency contact',
      icon: 'person',
      color: LOWES_THEME.primary,
    },
    {
      step: 2,
      title: 'Compensation Overview',
      description: `$${compensationSettings.baseHourlyRate}/hr + $${compensationSettings.surveyInstallBonus} per survey + $${compensationSettings.appointmentInstallBonus} per appointment`,
      icon: 'attach-money',
      color: '#4CAF50',
    },
    {
      step: 3,
      title: 'W-4 Form',
      description: 'Tax withholding form with signature',
      icon: 'assignment',
      color: '#FF9800',
    },
    {
      step: 4,
      title: 'I-9 Form',
      description: 'Employment eligibility verification + driver license upload',
      icon: 'badge',
      color: '#9C27B0',
    },
    {
      step: 5,
      title: 'Direct Deposit',
      description: 'Banking information for payroll',
      icon: 'account-balance',
      color: '#2196F3',
    },
    {
      step: 6,
      title: 'Hiring Packet',
      description: 'Employment agreement and acknowledgments',
      icon: 'description',
      color: '#F44336',
    },
  ];

  const hiringPacketContent = [
    { title: 'Falsified Survey Policy', content: 'Any falsified surveys will result in immediate termination and minimum wage pay for all hours worked.' },
    { title: 'iPad Return Policy', content: 'If iPad is not returned, charges will be filed and any unpaid wages will be forfeited to cover replacement costs.' },
    { title: 'Performance Quota', content: 'Employees must maintain 5 qualified surveys per hour. Failure to meet quota may result in minimum wage pay.' },
    { title: 'Training Period', content: 'Up to 25 hours of paid training at $15/hr provided expectations are met.' },
    { title: 'Employment Classification', content: 'Independent contractor (1099). Responsible for own taxes.' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Onboarding Manager</Text>
        <MaterialIcons name="school" size={24} color={LOWES_THEME.primary} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Compensation Settings */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Compensation Settings</Text>
            <Pressable onPress={() => setIsEditingCompensation(!isEditingCompensation)}>
              <MaterialIcons 
                name={isEditingCompensation ? 'close' : 'edit'} 
                size={20} 
                color={LOWES_THEME.primary} 
              />
            </Pressable>
          </View>

          <View style={styles.card}>
            {isEditingCompensation ? (
              <View style={styles.editForm}>
                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Base Hourly Rate</Text>
                  <Input
                    value={compensationSettings.baseHourlyRate.toString()}
                    onChangeText={(text) => setCompensationSettings({
                      ...compensationSettings,
                      baseHourlyRate: parseFloat(text) || 0,
                    })}
                    keyboardType="numeric"
                    placeholder="15"
                  />
                </View>

                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Survey/Install Bonus</Text>
                  <Input
                    value={compensationSettings.surveyInstallBonus.toString()}
                    onChangeText={(text) => setCompensationSettings({
                      ...compensationSettings,
                      surveyInstallBonus: parseFloat(text) || 0,
                    })}
                    keyboardType="numeric"
                    placeholder="10"
                  />
                </View>

                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Appointment/Install Bonus</Text>
                  <Input
                    value={compensationSettings.appointmentInstallBonus.toString()}
                    onChangeText={(text) => setCompensationSettings({
                      ...compensationSettings,
                      appointmentInstallBonus: parseFloat(text) || 0,
                    })}
                    keyboardType="numeric"
                    placeholder="25"
                  />
                </View>

                <View style={styles.inputRow}>
                  <Text style={styles.inputLabel}>Hourly Quota (surveys/hr)</Text>
                  <Input
                    value={compensationSettings.quota.toString()}
                    onChangeText={(text) => setCompensationSettings({
                      ...compensationSettings,
                      quota: parseFloat(text) || 0,
                    })}
                    keyboardType="numeric"
                    placeholder="5"
                  />
                </View>

                <Button
                  title="Save Settings"
                  onPress={saveCompensation}
                  backgroundColor={LOWES_THEME.success}
                  fullWidth
                />
              </View>
            ) : (
              <View style={styles.compensationDisplay}>
                <View style={styles.compensationRow}>
                  <MaterialIcons name="attach-money" size={20} color={LOWES_THEME.primary} />
                  <Text style={styles.compensationText}>
                    ${compensationSettings.baseHourlyRate}/hour base rate
                  </Text>
                </View>
                <View style={styles.compensationRow}>
                  <MaterialIcons name="add-circle" size={20} color={LOWES_THEME.success} />
                  <Text style={styles.compensationText}>
                    ${compensationSettings.surveyInstallBonus} per survey install
                  </Text>
                </View>
                <View style={styles.compensationRow}>
                  <MaterialIcons name="event" size={20} color={LOWES_THEME.warning} />
                  <Text style={styles.compensationText}>
                    ${compensationSettings.appointmentInstallBonus} per appointment install
                  </Text>
                </View>
                <View style={styles.compensationRow}>
                  <MaterialIcons name="speed" size={20} color="#9C27B0" />
                  <Text style={styles.compensationText}>
                    {compensationSettings.quota} surveys/hour quota
                  </Text>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Onboarding Steps */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Onboarding Flow (6 Steps)</Text>
          <Text style={styles.sectionDescription}>
            This is the process employees go through when they receive an onboarding invite
          </Text>
          
          <View style={styles.stepsContainer}>
            {onboardingSteps.map((step) => (
              <View key={step.step} style={styles.stepCard}>
                <View style={[styles.stepIcon, { backgroundColor: step.color }]}>
                  <MaterialIcons name={step.icon as any} size={28} color="#FFFFFF" />
                </View>
                <View style={styles.stepContent}>
                  <View style={styles.stepHeader}>
                    <Text style={styles.stepNumber}>Step {step.step}</Text>
                    <Text style={styles.stepTitle}>{step.title}</Text>
                  </View>
                  <Text style={styles.stepDescription}>{step.description}</Text>
                  <Pressable
                    style={styles.previewButton}
                    onPress={() => setPreviewStep(step.step)}
                  >
                    <MaterialIcons name="visibility" size={16} color={LOWES_THEME.primary} />
                    <Text style={styles.previewButtonText}>Preview Step</Text>
                  </Pressable>
                </View>
              </View>
            ))}
          </View>
        </View>

        {/* Hiring Packet Content */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Hiring Packet Acknowledgments</Text>
          <Text style={styles.sectionDescription}>
            Employees must read and acknowledge these policies in Step 6
          </Text>
          
          <View style={styles.policiesContainer}>
            {hiringPacketContent.map((policy, index) => (
              <View key={index} style={styles.policyCard}>
                <View style={styles.policyHeader}>
                  <MaterialIcons name="warning" size={20} color={LOWES_THEME.error} />
                  <Text style={styles.policyTitle}>{policy.title}</Text>
                </View>
                <Text style={styles.policyContent}>{policy.content}</Text>
              </View>
            ))}
          </View>
        </View>

        {/* Info Box */}
        <View style={styles.infoBox}>
          <MaterialIcons name="info" size={24} color={LOWES_THEME.primary} />
          <View style={styles.infoContent}>
            <Text style={styles.infoTitle}>How to Use Onboarding</Text>
            <Text style={styles.infoText}>
              1. Invite employees from the Employees tab{'\n'}
              2. They receive SMS and email with onboarding link{'\n'}
              3. Employees complete all 6 steps in order{'\n'}
              4. View their documents in the Employees section{'\n'}
              5. Update compensation settings here anytime
            </Text>
          </View>
        </View>
      </ScrollView>

      {/* Preview Modal */}
      <Modal
        visible={previewStep !== null}
        transparent
        animationType="slide"
        onRequestClose={() => setPreviewStep(null)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>
                Step {previewStep}: {onboardingSteps.find(s => s.step === previewStep)?.title}
              </Text>
              <Pressable onPress={() => setPreviewStep(null)}>
                <MaterialIcons name="close" size={24} color={LOWES_THEME.text} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalBody}>
              {previewStep === 1 && (
                <View style={styles.previewForm}>
                  <Text style={styles.previewTitle}>Basic Information</Text>
                  <Text style={styles.previewSubtitle}>Please provide your personal details</Text>
                  
                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Street Address</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>123 Main Street</Text>
                    </View>
                  </View>

                  <View style={styles.formRow}>
                    <View style={styles.formField}>
                      <Text style={styles.fieldLabel}>City</Text>
                      <View style={styles.mockInput}>
                        <Text style={styles.mockInputText}>Dothan</Text>
                      </View>
                    </View>
                    <View style={styles.formFieldSmall}>
                      <Text style={styles.fieldLabel}>State</Text>
                      <View style={styles.mockInput}>
                        <Text style={styles.mockInputText}>AL</Text>
                      </View>
                    </View>
                    <View style={styles.formFieldSmall}>
                      <Text style={styles.fieldLabel}>ZIP</Text>
                      <View style={styles.mockInput}>
                        <Text style={styles.mockInputText}>36301</Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Date of Birth</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>01/15/1990</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Social Security Number</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>***-**-****</Text>
                    </View>
                  </View>

                  <View style={styles.sectionDivider} />

                  <Text style={styles.sectionTitle}>Emergency Contact</Text>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Name</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>Jane Doe</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Relationship</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>Spouse</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Phone Number</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>(555) 123-4567</Text>
                    </View>
                  </View>
                </View>
              )}

              {previewStep === 2 && (
                <View style={styles.previewForm}>
                  <Text style={styles.previewTitle}>Your Compensation</Text>
                  <Text style={styles.previewSubtitle}>Here is how you will be paid</Text>

                  <View style={styles.compensationPreviewCard}>
                    <MaterialIcons name="attach-money" size={48} color={LOWES_THEME.success} />
                    <Text style={styles.compensationAmount}>${compensationSettings.baseHourlyRate}/hour</Text>
                    <Text style={styles.compensationLabel}>Base Hourly Rate</Text>
                  </View>

                  <Text style={styles.bonusHeader}>Performance Bonuses</Text>

                  <View style={styles.bonusCard}>
                    <MaterialIcons name="add-circle" size={32} color="#4CAF50" />
                    <View style={styles.bonusInfo}>
                      <Text style={styles.bonusAmount}>${compensationSettings.surveyInstallBonus}</Text>
                      <Text style={styles.bonusLabel}>Per Survey Install</Text>
                    </View>
                  </View>

                  <View style={styles.bonusCard}>
                    <MaterialIcons name="event" size={32} color="#FF9800" />
                    <View style={styles.bonusInfo}>
                      <Text style={styles.bonusAmount}>${compensationSettings.appointmentInstallBonus}</Text>
                      <Text style={styles.bonusLabel}>Per Appointment Install</Text>
                    </View>
                  </View>

                  <View style={styles.quotaCard}>
                    <MaterialIcons name="speed" size={24} color="#9C27B0" />
                    <Text style={styles.quotaText}>
                      Maintain <Text style={styles.quotaBold}>{compensationSettings.quota} surveys per hour</Text> to earn full base rate
                    </Text>
                  </View>
                </View>
              )}

              {previewStep === 3 && (
                <View style={styles.previewForm}>
                  <Text style={styles.previewTitle}>W-4 Tax Form</Text>
                  <Text style={styles.previewSubtitle}>Federal tax withholding information</Text>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Filing Status</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>Single</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Multiple Jobs or Spouse Works</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>No</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Number of Dependents</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>0</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Additional Withholding (optional)</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>$0.00</Text>
                    </View>
                  </View>

                  <View style={styles.sectionDivider} />

                  <Text style={styles.signatureLabel}>Your Signature</Text>
                  <View style={styles.signatureBox}>
                    <Text style={styles.signaturePlaceholder}>Sign here</Text>
                  </View>
                </View>
              )}

              {previewStep === 4 && (
                <View style={styles.previewForm}>
                  <Text style={styles.previewTitle}>I-9 Employment Verification</Text>
                  <Text style={styles.previewSubtitle}>Verify your eligibility to work in the United States</Text>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Citizenship Status</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>U.S. Citizen</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Alien Registration Number (if applicable)</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>N/A</Text>
                    </View>
                  </View>

                  <View style={styles.sectionDivider} />

                  <Text style={styles.sectionTitle}>Identity Document</Text>
                  <Text style={styles.uploadLabel}>Upload Driver License or State ID</Text>
                  
                  <View style={styles.uploadBox}>
                    <MaterialIcons name="cloud-upload" size={48} color="#CCCCCC" />
                    <Text style={styles.uploadText}>Tap to upload photo of ID</Text>
                  </View>

                  <View style={styles.sectionDivider} />

                  <Text style={styles.signatureLabel}>Your Signature</Text>
                  <View style={styles.signatureBox}>
                    <Text style={styles.signaturePlaceholder}>Sign here</Text>
                  </View>
                </View>
              )}

              {previewStep === 5 && (
                <View style={styles.previewForm}>
                  <Text style={styles.previewTitle}>Direct Deposit</Text>
                  <Text style={styles.previewSubtitle}>Set up direct deposit for payroll</Text>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Bank Name</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>First National Bank</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Account Type</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>Checking</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Routing Number</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>123456789</Text>
                    </View>
                  </View>

                  <View style={styles.formField}>
                    <Text style={styles.fieldLabel}>Account Number</Text>
                    <View style={styles.mockInput}>
                      <Text style={styles.mockInputText}>••••••••1234</Text>
                    </View>
                  </View>

                  <View style={styles.infoBox}>
                    <MaterialIcons name="info" size={20} color={LOWES_THEME.primary} />
                    <Text style={styles.infoBoxText}>
                      Your routing and account numbers can be found at the bottom of your checks
                    </Text>
                  </View>
                </View>
              )}

              {previewStep === 6 && (
                <View style={styles.previewForm}>
                  <Text style={styles.previewTitle}>RainSoft of the Wiregrass{"\n"}In-Store Surveyor Employment Packet</Text>
                  
                  {/* Welcome Section */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Welcome</Text>
                    <Text style={styles.packetText}>
                      We are excited about your interest in joining RainSoft of the Wiregrass as an In-Store Surveyor. This packet is designed to clearly explain the role, training process, compensation, and expectations so you feel confident and supported from day one.
                    </Text>
                    <Text style={styles.packetText}>
                      Our goal is to create a professional, respectful, and positive experience for our team members, our customers, and our partners at The Home Depot and Lowe's.
                    </Text>
                  </View>

                  {/* Position Overview */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Position Overview</Text>
                    <Text style={styles.packetText}>
                      As an In-Store Surveyor, you represent both RainSoft of the Wiregrass and The Home Depot and Lowe's. You are often the first point of contact for potential customers, making professionalism, courtesy, and accuracy essential.
                    </Text>
                    <Text style={styles.packetText}>
                      Your primary responsibility is to engage customers in a friendly manner and invite them to participate in a brief Water Awareness Survey.
                    </Text>
                  </View>

                  {/* Training Program */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Training Program</Text>
                    <Text style={styles.packetText}>
                      All new Surveyors begin with a paid training program, designed to ensure you are fully prepared and confident in your role.
                    </Text>
                    <Text style={styles.packetBullet}>• Training lasts up to 25 hours</Text>
                    <Text style={styles.packetBullet}>• Training pay is $15.00 per hour, provided expectations are met</Text>
                    <Text style={styles.packetBullet}>• Training includes: Customer engagement techniques, Approved scripts and responses, Survey completion standards, Store conduct and professionalism</Text>
                  </View>

                  {/* Employment Classification */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Employment Classification</Text>
                    <Text style={styles.packetBullet}>• During training, you are compensated for qualifying hours worked</Text>
                    <Text style={styles.packetBullet}>• You will receive a 1099 for applicable earnings and are responsible for your own tax obligations</Text>
                    <Text style={styles.packetBullet}>• Employment with RainSoft of the Wiregrass is at-will, meaning either party may end the working relationship at any time</Text>
                  </View>

                  {/* Compensation & Incentives */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Compensation & Incentives</Text>
                    <Text style={styles.packetSubheading}>Training Pay</Text>
                    <Text style={styles.packetText}>$15/hour for up to 25 training hours IF MINIMUM REQUIREMENT MET</Text>
                    
                    <Text style={styles.packetSubheading}>Standard Pay (After Training)</Text>
                    <Text style={styles.packetText}>$15/hour for meeting quota (5 qualified surveys per hour)</Text>
                    
                    <Text style={styles.packetSubheading}>Bonuses & Raises</Text>
                    <Text style={styles.packetBullet}>• $100 performance bonus after 30-day evaluation (attendance & survey quality)</Text>
                    <Text style={styles.packetBullet}>• $0.50/hour raise after each additional 30-day evaluation, up to $18/hour</Text>
                    <Text style={styles.packetBullet}>• $10 bonus for each completed install resulting from your survey</Text>
                    <Text style={styles.packetBullet}>• $25 for every Appointment set that installs</Text>
                  </View>

                  {/* Survey Qualification Standards */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Survey Qualification Standards</Text>
                    <Text style={styles.packetText}>A survey is considered qualified when it meets all of the following:</Text>
                    <Text style={styles.packetBullet}>1. Customer is a homeowner or in the process of purchasing a home</Text>
                    <Text style={styles.packetBullet}>2. Customer does not currently use a salt-based water treatment system</Text>
                    <Text style={styles.packetBullet}>3. All survey questions are completed</Text>
                    <Text style={styles.packetBullet}>4. Customer provides a full name and valid phone number</Text>
                    <Text style={styles.packetBullet}>5. Survey is signed or digitally completed</Text>
                    <Text style={styles.packetWarning}>Accuracy and honesty are critical. Surveys are verified by the RainSoft home office.</Text>
                  </View>

                  {/* Performance Expectations */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Performance Expectations</Text>
                    <Text style={styles.packetText}>Surveyors are expected to:</Text>
                    <Text style={styles.packetBullet}>• Maintain an average of 5 qualified surveys per hour</Text>
                    <Text style={styles.packetBullet}>• Actively engage customers while on paid time</Text>
                    <Text style={styles.packetBullet}>• Follow approved scripts and survey procedures</Text>
                    <Text style={styles.packetBullet}>• Maintain a professional and respectful demeanor at all times</Text>
                    <Text style={styles.packetWarning}>If performance falls below expectations, coaching may be provided. Continued performance challenges may result in reassignment or separation from the program.</Text>
                  </View>

                  {/* Professional Conduct */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Professional Conduct & Store Guidelines</Text>
                    <Text style={styles.packetText}>While working in The Home Depot/Lowe's, you must:</Text>
                    <Text style={styles.packetBullet}>• Follow all store rules and policies</Text>
                    <Text style={styles.packetBullet}>• Treat customers and staff with respect</Text>
                    <Text style={styles.packetBullet}>• Never argue or pressure customers</Text>
                  </View>

                  {/* Attire & Appearance */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Attire & Appearance</Text>
                    <Text style={styles.packetBullet}>• Company-issued RainSoft/Home Depot/Lowe's apron and badge must be worn at all times</Text>
                    <Text style={styles.packetBullet}>• Acceptable clothing: jeans, khakis, slacks, collared shirts, polos, or approved company shirts</Text>
                    <Text style={styles.packetBullet}>• Closed-toe shoes required</Text>
                    <Text style={styles.packetBullet}>• No flip-flops, open-toe shoes, or inappropriate graphics</Text>
                    <Text style={styles.packetWarning}>Uniform items are company property and must be returned upon separation.</Text>
                  </View>

                  {/* Time & Attendance */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Time & Attendance Policy</Text>
                    <Text style={styles.packetBullet}>• Arrive on time and work scheduled shifts</Text>
                    <Text style={styles.packetBullet}>• Request time off at least 7 days in advance</Text>
                    <Text style={styles.packetBullet}>• Clock in and out according to your assigned schedule</Text>
                    <Text style={styles.packetWarning}>Time worked outside scheduled hours must be approved by a manager to be paid</Text>
                  </View>

                  {/* Equipment & Tablet Policy */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Equipment & Tablet Policy</Text>
                    <Text style={styles.packetText}>Tablets are provided as a required work tool. Employees agree to:</Text>
                    <Text style={styles.packetBullet}>• Use the tablet only for company business</Text>
                    <Text style={styles.packetBullet}>• Protect equipment from damage or loss</Text>
                    <Text style={styles.packetBullet}>• Keep tracking and security settings enabled</Text>
                    <Text style={styles.packetBullet}>• Return all equipment upon separation</Text>
                  </View>

                  {/* Customer Information & Confidentiality */}
                  <View style={styles.packetSection}>
                    <Text style={styles.packetSectionTitle}>Customer Information & Confidentiality</Text>
                    <Text style={styles.packetText}>
                      All customer and prospect information obtained during employment or training is confidential and the property of RainSoft of the Wiregrass and The Home Depot/Lowe's.
                    </Text>
                    <Text style={styles.packetText}>Employees agree not to:</Text>
                    <Text style={styles.packetBullet}>• Contact customers for non-company purposes</Text>
                    <Text style={styles.packetBullet}>• Share customer information with third parties</Text>
                    <Text style={styles.packetWarning}>These obligations continue after employment ends.</Text>
                  </View>

                  <View style={styles.sectionDivider} />

                  {/* Critical Acknowledgments */}
                  <Text style={styles.previewSubtitle}>Required Acknowledgments</Text>

                  <View style={styles.policyCard}>
                    <View style={styles.policyHeader}>
                      <MaterialIcons name="warning" size={20} color={LOWES_THEME.error} />
                      <Text style={styles.policyTitle}>Falsified Survey Policy</Text>
                    </View>
                    <Text style={styles.policyContent}>
                      Any falsified surveys will result in immediate termination and minimum wage pay for all hours worked.
                    </Text>
                    <View style={styles.checkboxRow}>
                      <View style={styles.checkbox}>
                        <MaterialIcons name="check" size={16} color="#FFFFFF" />
                      </View>
                      <Text style={styles.checkboxLabel}>I understand and acknowledge</Text>
                    </View>
                  </View>

                  <View style={styles.policyCard}>
                    <View style={styles.policyHeader}>
                      <MaterialIcons name="warning" size={20} color={LOWES_THEME.error} />
                      <Text style={styles.policyTitle}>iPad Return Policy</Text>
                    </View>
                    <Text style={styles.policyContent}>
                      If iPad is not returned, charges will be filed and any unpaid wages will be forfeited to cover replacement costs.
                    </Text>
                    <View style={styles.checkboxRow}>
                      <View style={styles.checkbox}>
                        <MaterialIcons name="check" size={16} color="#FFFFFF" />
                      </View>
                      <Text style={styles.checkboxLabel}>I understand and acknowledge</Text>
                    </View>
                  </View>

                  <View style={styles.policyCard}>
                    <View style={styles.policyHeader}>
                      <MaterialIcons name="warning" size={20} color={LOWES_THEME.error} />
                      <Text style={styles.policyTitle}>Performance Quota</Text>
                    </View>
                    <Text style={styles.policyContent}>
                      Employees must maintain {compensationSettings.quota} qualified surveys per hour. Failure to meet quota may result in minimum wage pay.
                    </Text>
                    <View style={styles.checkboxRow}>
                      <View style={styles.checkbox}>
                        <MaterialIcons name="check" size={16} color="#FFFFFF" />
                      </View>
                      <Text style={styles.checkboxLabel}>I understand and acknowledge</Text>
                    </View>
                  </View>

                  <View style={styles.sectionDivider} />

                  <Text style={styles.signatureLabel}>Final Signature</Text>
                  <Text style={styles.signatureNote}>
                    By signing below, you acknowledge that you have read and understand this employment packet in its entirety and agree to all policies and expectations outlined above.
                  </Text>
                  <View style={styles.signatureBox}>
                    <Text style={styles.signaturePlaceholder}>Sign here</Text>
                  </View>
                </View>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Text style={styles.footerNote}>This is a preview of what employees will see</Text>
            </View>
          </View>
        </View>
      </Modal>
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
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  sectionDescription: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    lineHeight: 18,
  },
  card: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
  },
  editForm: {
    gap: SPACING.md,
  },
  inputRow: {
    gap: SPACING.xs,
  },
  inputLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  compensationDisplay: {
    gap: SPACING.md,
  },
  compensationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  compensationText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
  },
  stepsContainer: {
    gap: SPACING.md,
  },
  stepCard: {
    flexDirection: 'row',
    gap: SPACING.md,
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
  },
  stepIcon: {
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  stepHeader: {
    gap: 2,
  },
  stepNumber: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    color: LOWES_THEME.primary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  stepTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  stepDescription: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    lineHeight: 18,
  },
  policiesContainer: {
    gap: SPACING.md,
  },
  policyCard: {
    backgroundColor: '#FFF3E0',
    padding: SPACING.md,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.error,
    gap: SPACING.sm,
  },
  policyHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  policyTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  policyContent: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  infoBox: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: '#F0F7FF',
    borderRadius: 12,
    borderWidth: 1,
    borderColor: LOWES_THEME.primary,
  },
  infoContent: {
    flex: 1,
    gap: SPACING.xs,
  },
  infoTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  previewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    marginTop: SPACING.sm,
  },
  previewButtonText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.primary,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: LOWES_THEME.background,
    borderRadius: 16,
    width: '90%',
    maxHeight: '85%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
    flex: 1,
  },
  modalBody: {
    flex: 1,
    padding: SPACING.lg,
  },
  modalFooter: {
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
    alignItems: 'center',
  },
  footerNote: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    fontStyle: 'italic',
  },
  previewForm: {
    gap: SPACING.lg,
  },
  previewTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: LOWES_THEME.text,
    textAlign: 'center',
  },
  previewSubtitle: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  formField: {
    gap: SPACING.xs,
  },
  formRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  formFieldSmall: {
    flex: 1,
    gap: SPACING.xs,
  },
  fieldLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  mockInput: {
    backgroundColor: '#F8F8F8',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 8,
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.md,
  },
  mockInputText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
  },
  sectionDivider: {
    height: 1,
    backgroundColor: LOWES_THEME.border,
    marginVertical: SPACING.md,
  },
  signatureLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  signatureNote: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    marginTop: 4,
  },
  signatureBox: {
    height: 120,
    borderWidth: 2,
    borderColor: LOWES_THEME.primary,
    borderRadius: 8,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
  },
  signaturePlaceholder: {
    fontSize: FONTS.sizes.md,
    color: '#CCCCCC',
    fontStyle: 'italic',
  },
  uploadBox: {
    height: 150,
    borderWidth: 2,
    borderColor: '#CCCCCC',
    borderRadius: 8,
    borderStyle: 'dashed',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#F8F8F8',
    gap: SPACING.sm,
  },
  uploadText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  uploadLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  compensationPreviewCard: {
    backgroundColor: '#E8F5E9',
    padding: SPACING.xl,
    borderRadius: 16,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  compensationAmount: {
    fontSize: 36,
    fontWeight: '700',
    color: LOWES_THEME.success,
  },
  compensationLabel: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
    fontWeight: '600',
  },
  bonusHeader: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
    marginTop: SPACING.md,
  },
  bonusCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
  },
  bonusInfo: {
    flex: 1,
  },
  bonusAmount: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  bonusLabel: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  quotaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    backgroundColor: '#F3E5F5',
    padding: SPACING.lg,
    borderRadius: 12,
    marginTop: SPACING.md,
  },
  quotaText: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  quotaBold: {
    fontWeight: '700',
    color: '#9C27B0',
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.md,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    backgroundColor: LOWES_THEME.success,
    justifyContent: 'center',
    alignItems: 'center',
  },
  checkboxLabel: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    fontWeight: '600',
  },
  infoBox: {
    flexDirection: 'row',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
  },
  infoBoxText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 18,
  },
  packetSection: {
    gap: SPACING.sm,
    marginBottom: SPACING.md,
  },
  packetSectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '700',
    color: LOWES_THEME.text,
    marginTop: SPACING.sm,
  },
  packetSubheading: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
    marginTop: SPACING.sm,
  },
  packetText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
    marginBottom: SPACING.xs,
  },
  packetBullet: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
    marginLeft: SPACING.md,
    marginBottom: SPACING.xs,
  },
  packetWarning: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.error,
    fontWeight: '600',
    lineHeight: 20,
    marginTop: SPACING.xs,
    fontStyle: 'italic',
  },
});
