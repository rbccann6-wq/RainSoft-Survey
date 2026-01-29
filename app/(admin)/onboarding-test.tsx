// Onboarding Test Screen - Walk through onboarding step by step for surveyor@rainsoft.com
import React, { useState, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAlert } from '@/template';
import SignatureScreen from 'react-native-signature-canvas';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import * as StorageService from '@/services/storageService';

export default function OnboardingTestScreen() {
  const router = useRouter();
  const { showAlert } = useAlert();
  const signatureRef = useRef<any>();
  
  const [currentStep, setCurrentStep] = useState(1);
  const [compensationSettings, setCompensationSettings] = useState({
    baseHourlyRate: 15,
    surveyInstallBonus: 10,
    appointmentInstallBonus: 25,
    quota: 5,
  });
  
  // Step 1: Basic Information
  const [address, setAddress] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [zipCode, setZipCode] = useState('');
  const [dob, setDob] = useState('');
  const [ssn, setSsn] = useState('');
  const [emergencyName, setEmergencyName] = useState('');
  const [emergencyRelationship, setEmergencyRelationship] = useState('');
  const [emergencyPhone, setEmergencyPhone] = useState('');
  
  // Step 3: W-4
  const [filingStatus, setFilingStatus] = useState('');
  const [multipleJobs, setMultipleJobs] = useState('');
  const [dependents, setDependents] = useState('');
  const [additionalWithholding, setAdditionalWithholding] = useState('');
  const [w4Signature, setW4Signature] = useState('');
  
  // Step 4: I-9
  const [citizenship, setCitizenship] = useState('');
  const [alienNumber, setAlienNumber] = useState('');
  const [driversLicenseUri, setDriversLicenseUri] = useState('');
  const [i9Signature, setI9Signature] = useState('');
  
  // Step 5: Direct Deposit
  const [bankName, setBankName] = useState('');
  const [accountType, setAccountType] = useState('');
  const [routingNumber, setRoutingNumber] = useState('');
  const [accountNumber, setAccountNumber] = useState('');
  
  // Step 6: Acknowledgments
  const [ackFalsified, setAckFalsified] = useState(false);
  const [ackIpad, setAckIpad] = useState(false);
  const [ackQuota, setAckQuota] = useState(false);
  const [finalSignature, setFinalSignature] = useState('');

  React.useEffect(() => {
    loadCompensation();
  }, []);

  const loadCompensation = async () => {
    const settings = await StorageService.getCompensationSettings();
    setCompensationSettings(settings);
  };

  const canProgressFromStep1 = () => {
    return address && city && state && zipCode && dob && ssn && emergencyName && emergencyRelationship && emergencyPhone;
  };

  const canProgressFromStep3 = () => {
    return filingStatus && multipleJobs && dependents !== '';
  };

  const canProgressFromStep4 = () => {
    return citizenship;
  };

  const canProgressFromStep5 = () => {
    return bankName && accountType && routingNumber && accountNumber;
  };

  const canProgressFromStep6 = () => {
    return ackFalsified && ackIpad && ackQuota;
  };

  const handleNextStep = async () => {
    if (currentStep === 1 && !canProgressFromStep1()) {
      showAlert('Incomplete Form', 'Please fill in all required fields');
      return;
    }
    if (currentStep === 3 && !canProgressFromStep3()) {
      showAlert('Incomplete Form', 'Please complete W-4 form');
      return;
    }
    if (currentStep === 4 && !canProgressFromStep4()) {
      showAlert('Incomplete Form', 'Please complete I-9 form');
      return;
    }
    if (currentStep === 5 && !canProgressFromStep5()) {
      showAlert('Incomplete Form', 'Please fill in all banking information');
      return;
    }
    if (currentStep === 6) {
      if (!canProgressFromStep6()) {
        showAlert('Incomplete', 'Please acknowledge all policies');
        return;
      }
      
      // Auto-capture final signature before completing
      if (signatureRef.current) {
        signatureRef.current.readSignature();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
      
      // Complete onboarding
      showAlert('Onboarding Complete!', 'Test walkthrough finished. Employee data saved successfully.', [
        {
          text: 'Back to Admin',
          onPress: () => router.back(),
        },
      ]);
      return;
    }
    
    // Auto-capture signature before moving to next step (W-4 and I-9)
    if (currentStep === 3 || currentStep === 4) {
      if (signatureRef.current) {
        signatureRef.current.readSignature();
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setCurrentStep(currentStep + 1);
  };

  const handlePrevStep = () => {
    if (currentStep > 1) {
      setCurrentStep(currentStep - 1);
    }
  };

  const renderStepIndicator = () => {
    const steps = [
      { num: 1, label: 'Basic Info', icon: 'person' },
      { num: 2, label: 'Compensation', icon: 'attach-money' },
      { num: 3, label: 'W-4', icon: 'assignment' },
      { num: 4, label: 'I-9', icon: 'badge' },
      { num: 5, label: 'Banking', icon: 'account-balance' },
      { num: 6, label: 'Agreement', icon: 'description' },
    ];
    
    return (
      <View style={styles.stepIndicator}>
        {steps.map((step) => (
          <View key={step.num} style={styles.stepItem}>
            <View style={[
              styles.stepCircle,
              currentStep === step.num && styles.stepCircleActive,
              currentStep > step.num && styles.stepCircleComplete,
            ]}>
              {currentStep > step.num ? (
                <MaterialIcons name="check" size={16} color="#FFFFFF" />
              ) : (
                <Text style={[
                  styles.stepNumber,
                  currentStep === step.num && styles.stepNumberActive,
                ]}>
                  {step.num}
                </Text>
              )}
            </View>
            <Text style={styles.stepLabel}>{step.label}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderStep1 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Step 1: Basic Information</Text>
      <Text style={styles.stepSubtitle}>Please provide your personal details</Text>

      <View style={styles.formSection}>
        <Text style={styles.formSectionTitle}>Home Address</Text>
        <Text style={styles.fieldLabel}>Street Address</Text>
        
        {/* Google Places Autocomplete */}
        <View style={styles.googlePlacesContainer}>
          <GooglePlacesAutocomplete
            placeholder="Start typing your address..."
            onPress={(data, details = null) => {
              setAddress(data.description);
              
              // Extract city, state, zip if available
              if (details?.address_components) {
                const components = details.address_components;
                const cityComponent = components.find(c => c.types.includes('locality'));
                const stateComponent = components.find(c => c.types.includes('administrative_area_level_1'));
                const zipComponent = components.find(c => c.types.includes('postal_code'));
                
                if (cityComponent) setCity(cityComponent.long_name);
                if (stateComponent) setState(stateComponent.short_name);
                if (zipComponent) setZipCode(zipComponent.long_name);
              }
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
                backgroundColor: LOWES_THEME.surface,
                borderWidth: 1,
                borderColor: LOWES_THEME.border,
                borderRadius: 8,
                paddingHorizontal: 0,
              },
              textInput: {
                height: 48,
                fontSize: FONTS.sizes.md,
                color: LOWES_THEME.text,
                backgroundColor: LOWES_THEME.surface,
              },
              predefinedPlacesDescription: {
                color: LOWES_THEME.primary,
              },
              listView: {
                backgroundColor: '#FFFFFF',
                borderRadius: 8,
                elevation: 3,
                shadowColor: '#000',
                shadowOffset: { width: 0, height: 2 },
                shadowOpacity: 0.15,
                shadowRadius: 2,
                marginTop: SPACING.xs,
                maxHeight: 150,
              },
              row: {
                padding: SPACING.md,
                borderBottomWidth: 1,
                borderBottomColor: LOWES_THEME.border,
              },
              description: {
                fontSize: FONTS.sizes.md,
                color: LOWES_THEME.text,
              },
            }}
            textInputProps={{
              value: address,
              onChangeText: setAddress,
              placeholderTextColor: '#999',
            }}
          />
        </View>
        
        <View style={styles.formRow}>
          <View style={styles.formFieldLarge}>
            <Input
              value={city}
              onChangeText={setCity}
              placeholder="Dothan"
              label="City"
            />
          </View>
          <View style={styles.formFieldSmall}>
            <Input
              value={state}
              onChangeText={setState}
              placeholder="AL"
              label="State"
              maxLength={2}
            />
          </View>
          <View style={styles.formFieldSmall}>
            <Input
              value={zipCode}
              onChangeText={setZipCode}
              placeholder="36301"
              label="ZIP"
              keyboardType="number-pad"
              maxLength={5}
            />
          </View>
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formSectionTitle}>Personal Information</Text>
        <Input
          value={dob}
          onChangeText={setDob}
          placeholder="01/15/1990"
          label="Date of Birth (MM/DD/YYYY)"
        />
        <Input
          value={ssn}
          onChangeText={(text) => {
            const cleaned = text.replace(/\D/g, '');
            let formatted = cleaned;
            if (cleaned.length >= 4) {
              formatted = cleaned.slice(0, 3) + '-' + cleaned.slice(3);
            }
            if (cleaned.length >= 6) {
              formatted = cleaned.slice(0, 3) + '-' + cleaned.slice(3, 5) + '-' + cleaned.slice(5, 9);
            }
            setSsn(formatted);
          }}
          placeholder="***-**-****"
          label="Social Security Number"
          keyboardType="number-pad"
          maxLength={11}
        />
      </View>

      <View style={styles.formSection}>
        <Text style={styles.formSectionTitle}>Emergency Contact</Text>
        <Input
          value={emergencyName}
          onChangeText={setEmergencyName}
          placeholder="Jane Doe"
          label="Full Name"
        />
        <Input
          value={emergencyRelationship}
          onChangeText={setEmergencyRelationship}
          placeholder="Spouse"
          label="Relationship"
        />
        <Input
          value={emergencyPhone}
          onChangeText={(text) => {
            const cleaned = text.replace(/\D/g, '');
            let formatted = '';
            if (cleaned.length > 0) {
              formatted = '(' + cleaned.slice(0, 3);
            }
            if (cleaned.length >= 4) {
              formatted += ') ' + cleaned.slice(3, 6);
            }
            if (cleaned.length >= 7) {
              formatted += '-' + cleaned.slice(6, 10);
            }
            setEmergencyPhone(formatted);
          }}
          placeholder="(555) 123-4567"
          label="Phone Number"
          keyboardType="phone-pad"
          maxLength={14}
        />
      </View>
    </View>
  );

  const renderStep2 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Step 2: Your Compensation</Text>
      <Text style={styles.stepSubtitle}>Here is how you will be paid</Text>

      <View style={styles.compensationCard}>
        <MaterialIcons name="attach-money" size={48} color={LOWES_THEME.success} />
        <Text style={styles.compensationAmount}>${compensationSettings.baseHourlyRate}/hour</Text>
        <Text style={styles.compensationLabel}>Base Hourly Rate</Text>
        <Text style={styles.compensationNote}>For meeting quota ({compensationSettings.quota} surveys/hour)</Text>
      </View>

      <Text style={styles.bonusHeader}>Performance Bonuses</Text>

      <View style={styles.bonusCard}>
        <MaterialIcons name="add-circle" size={32} color="#4CAF50" />
        <View style={styles.bonusInfo}>
          <Text style={styles.bonusAmount}>${compensationSettings.surveyInstallBonus}</Text>
          <Text style={styles.bonusLabel}>Per Survey Install</Text>
          <Text style={styles.bonusDescription}>Earn this bonus when a survey leads to a completed installation</Text>
        </View>
      </View>

      <View style={styles.bonusCard}>
        <MaterialIcons name="event" size={32} color="#FF9800" />
        <View style={styles.bonusInfo}>
          <Text style={styles.bonusAmount}>${compensationSettings.appointmentInstallBonus}</Text>
          <Text style={styles.bonusLabel}>Per Appointment Install</Text>
          <Text style={styles.bonusDescription}>Earn this bonus when an appointment you set leads to installation</Text>
        </View>
      </View>

      <View style={styles.infoCard}>
        <MaterialIcons name="info" size={24} color={LOWES_THEME.primary} />
        <View style={styles.infoContent}>
          <Text style={styles.infoTitle}>Important Notes</Text>
          <Text style={styles.infoText}>
            • Training: Up to 25 hours at $15/hr{'\n'}
            • Quota: Maintain {compensationSettings.quota} qualified surveys per hour{'\n'}
            • Raises: $0.50/hour every 30 days (up to $18/hr){'\n'}
            • $100 bonus after 30-day evaluation
          </Text>
        </View>
      </View>
    </View>
  );

  const renderStep3 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Step 3: W-4 Tax Form</Text>
      <Text style={styles.stepSubtitle}>Federal tax withholding information</Text>

      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>Filing Status</Text>
        <View style={styles.radioGroup}>
          {['Single', 'Married Filing Jointly', 'Married Filing Separately', 'Head of Household'].map((option) => (
            <Pressable
              key={option}
              style={styles.radioOption}
              onPress={() => setFilingStatus(option)}
            >
              <View style={styles.radio}>
                {filingStatus === option && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>Multiple Jobs or Spouse Works</Text>
        <View style={styles.radioGroup}>
          {['Yes', 'No'].map((option) => (
            <Pressable
              key={option}
              style={styles.radioOption}
              onPress={() => setMultipleJobs(option)}
            >
              <View style={styles.radio}>
                {multipleJobs === option && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Input
        value={dependents}
        onChangeText={setDependents}
        placeholder="0"
        label="Number of Dependents"
        keyboardType="number-pad"
      />

      <Input
        value={additionalWithholding}
        onChangeText={setAdditionalWithholding}
        placeholder="$0.00"
        label="Additional Withholding (optional)"
        keyboardType="numeric"
      />

      <View style={styles.signatureSection}>
        <Text style={styles.signatureLabel}>Your Signature</Text>
        <Text style={styles.signatureNote}>Draw your signature below (auto-saves when you click Next)</Text>
        <View style={styles.signatureBox}>
          <SignatureScreen
            ref={signatureRef}
            onOK={(signature) => setW4Signature(signature)}
            onEmpty={() => console.log('Signature is empty')}
            onClear={() => setW4Signature('')}
            descriptionText=""
            clearText="Clear"
            confirmText="Save"
            webStyle={`
              .m-signature-pad { box-shadow: none; border: none; }
              .m-signature-pad--body { border: none; }
              .m-signature-pad--footer { display: none; }
            `}
          />
        </View>
        {w4Signature && (
          <View style={styles.signatureCaptured}>
            <MaterialIcons name="check-circle" size={20} color={LOWES_THEME.success} />
            <Text style={styles.signatureCapturedText}>Signature captured</Text>
          </View>
        )}
        <Button
          title="Clear Signature"
          onPress={() => {
            signatureRef.current?.clearSignature();
            setW4Signature('');
          }}
          variant="outline"
          size="small"
        />
      </View>
    </View>
  );

  const renderStep4 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Step 4: I-9 Employment Verification</Text>
      <Text style={styles.stepSubtitle}>Verify your eligibility to work in the United States</Text>

      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>Citizenship Status</Text>
        <View style={styles.radioGroup}>
          {['U.S. Citizen', 'Non-citizen national of the U.S.', 'Lawful permanent resident', 'Alien authorized to work'].map((option) => (
            <Pressable
              key={option}
              style={styles.radioOption}
              onPress={() => setCitizenship(option)}
            >
              <View style={styles.radio}>
                {citizenship === option && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      {citizenship && citizenship !== 'U.S. Citizen' && (
        <Input
          value={alienNumber}
          onChangeText={setAlienNumber}
          placeholder="A-123456789"
          label="Alien Registration Number (if applicable)"
        />
      )}

      <View style={styles.uploadSection}>
        <Text style={styles.fieldLabel}>Driver's License or State ID</Text>
        <Text style={styles.uploadNote}>Take a clear photo of your ID</Text>
        <Pressable
          style={styles.uploadBox}
          onPress={() => {
            // Simulate file upload
            setDriversLicenseUri('mock://license.jpg');
            showAlert('Upload Simulated', 'In production, this would open the camera/photo picker');
          }}
        >
          {driversLicenseUri ? (
            <>
              <MaterialIcons name="check-circle" size={48} color={LOWES_THEME.success} />
              <Text style={styles.uploadTextSuccess}>✓ ID Uploaded</Text>
            </>
          ) : (
            <>
              <MaterialIcons name="cloud-upload" size={48} color="#CCCCCC" />
              <Text style={styles.uploadText}>Tap to Upload ID Photo</Text>
            </>
          )}
        </Pressable>
      </View>

      <View style={styles.signatureSection}>
        <Text style={styles.signatureLabel}>Your Signature</Text>
        <Text style={styles.signatureNote}>Draw your signature below (auto-saves when you click Next)</Text>
        <View style={styles.signatureBox}>
          <SignatureScreen
            ref={signatureRef}
            onOK={(signature) => setI9Signature(signature)}
            onEmpty={() => console.log('Signature is empty')}
            onClear={() => setI9Signature('')}
            descriptionText=""
            clearText="Clear"
            confirmText="Save"
            webStyle={`
              .m-signature-pad { box-shadow: none; border: none; }
              .m-signature-pad--body { border: none; }
              .m-signature-pad--footer { display: none; }
            `}
          />
        </View>
        {i9Signature && (
          <View style={styles.signatureCaptured}>
            <MaterialIcons name="check-circle" size={20} color={LOWES_THEME.success} />
            <Text style={styles.signatureCapturedText}>Signature captured</Text>
          </View>
        )}
        <Button
          title="Clear Signature"
          onPress={() => {
            signatureRef.current?.clearSignature();
            setI9Signature('');
          }}
          variant="outline"
          size="small"
        />
      </View>
    </View>
  );

  const renderStep5 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Step 5: Direct Deposit</Text>
      <Text style={styles.stepSubtitle}>Set up direct deposit for payroll</Text>

      <Input
        value={bankName}
        onChangeText={setBankName}
        placeholder="First National Bank"
        label="Bank Name"
      />

      <View style={styles.formSection}>
        <Text style={styles.fieldLabel}>Account Type</Text>
        <View style={styles.radioGroup}>
          {['Checking', 'Savings'].map((option) => (
            <Pressable
              key={option}
              style={styles.radioOption}
              onPress={() => setAccountType(option)}
            >
              <View style={styles.radio}>
                {accountType === option && <View style={styles.radioInner} />}
              </View>
              <Text style={styles.radioLabel}>{option}</Text>
            </Pressable>
          ))}
        </View>
      </View>

      <Input
        value={routingNumber}
        onChangeText={setRoutingNumber}
        placeholder="123456789"
        label="Routing Number (9 digits)"
        keyboardType="number-pad"
        maxLength={9}
      />

      <Input
        value={accountNumber}
        onChangeText={setAccountNumber}
        placeholder="1234567890"
        label="Account Number"
        keyboardType="number-pad"
      />

      <View style={styles.infoCard}>
        <MaterialIcons name="info" size={20} color={LOWES_THEME.primary} />
        <Text style={styles.infoCardText}>
          Your routing and account numbers can be found at the bottom of your checks
        </Text>
      </View>
    </View>
  );

  const renderStep6 = () => (
    <View style={styles.stepContent}>
      <Text style={styles.stepTitle}>Step 6: Hiring Packet & Acknowledgments</Text>
      <Text style={styles.stepSubtitle}>Please read and acknowledge all policies</Text>

      <View style={styles.policyCard}>
        <View style={styles.policyHeader}>
          <MaterialIcons name="warning" size={24} color={LOWES_THEME.error} />
          <Text style={styles.policyTitle}>Falsified Survey Policy</Text>
        </View>
        <Text style={styles.policyContent}>
          Any falsified surveys will result in immediate termination and minimum wage pay for all hours worked. All surveys are verified by RainSoft home office.
        </Text>
        <Pressable
          style={styles.checkboxRow}
          onPress={() => setAckFalsified(!ackFalsified)}
        >
          <View style={[styles.checkbox, ackFalsified && styles.checkboxChecked]}>
            {ackFalsified && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>I understand and acknowledge</Text>
        </Pressable>
      </View>

      <View style={styles.policyCard}>
        <View style={styles.policyHeader}>
          <MaterialIcons name="warning" size={24} color={LOWES_THEME.error} />
          <Text style={styles.policyTitle}>iPad/Equipment Return Policy</Text>
        </View>
        <Text style={styles.policyContent}>
          If iPad or other company equipment is not returned upon separation, criminal charges will be filed and any unpaid wages will be forfeited to cover replacement costs.
        </Text>
        <Pressable
          style={styles.checkboxRow}
          onPress={() => setAckIpad(!ackIpad)}
        >
          <View style={[styles.checkbox, ackIpad && styles.checkboxChecked]}>
            {ackIpad && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>I understand and acknowledge</Text>
        </Pressable>
      </View>

      <View style={styles.policyCard}>
        <View style={styles.policyHeader}>
          <MaterialIcons name="warning" size={24} color={LOWES_THEME.error} />
          <Text style={styles.policyTitle}>Performance Quota Requirement</Text>
        </View>
        <Text style={styles.policyContent}>
          Employees must maintain an average of {compensationSettings.quota} qualified surveys per hour. Failure to meet this quota may result in minimum wage pay or separation from the program.
        </Text>
        <Pressable
          style={styles.checkboxRow}
          onPress={() => setAckQuota(!ackQuota)}
        >
          <View style={[styles.checkbox, ackQuota && styles.checkboxChecked]}>
            {ackQuota && <MaterialIcons name="check" size={16} color="#FFFFFF" />}
          </View>
          <Text style={styles.checkboxLabel}>I understand and acknowledge</Text>
        </Pressable>
      </View>

      <View style={styles.signatureSection}>
        <Text style={styles.signatureLabel}>Final Signature</Text>
        <Text style={styles.signatureNote}>
          By signing below, you acknowledge that you have read and understand this employment packet in its entirety and agree to all policies and expectations outlined above.
        </Text>
        <View style={styles.signatureBox}>
          <SignatureScreen
            ref={signatureRef}
            onOK={(signature) => setFinalSignature(signature)}
            onEmpty={() => console.log('Signature is empty')}
            onClear={() => setFinalSignature('')}
            descriptionText=""
            clearText="Clear"
            confirmText="Save"
            webStyle={`
              .m-signature-pad { box-shadow: none; border: none; }
              .m-signature-pad--body { border: none; }
              .m-signature-pad--footer { display: none; }
            `}
          />
        </View>
        {finalSignature && (
          <View style={styles.signatureCaptured}>
            <MaterialIcons name="check-circle" size={20} color={LOWES_THEME.success} />
            <Text style={styles.signatureCapturedText}>Signature captured</Text>
          </View>
        )}
        <Button
          title="Clear Signature"
          onPress={() => {
            signatureRef.current?.clearSignature();
            setFinalSignature('');
          }}
          variant="outline"
          size="small"
        />
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Demo Mode Banner */}
      <View style={styles.demoBanner}>
        <MaterialIcons name="info" size={20} color="#FFFFFF" />
        <Text style={styles.demoBannerText}>
          DEMO MODE: This is a walkthrough of the onboarding process. No data will be saved to the database.
        </Text>
      </View>

      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.text} />
        </Pressable>
        <View style={styles.headerContent}>
          <Text style={styles.headerTitle}>Onboarding Test</Text>
          <Text style={styles.headerSubtitle}>surveyor@rainsoft.com</Text>
        </View>
      </View>

      {/* Step Indicator */}
      {renderStepIndicator()}

      {/* Step Content */}
      <ScrollView 
        contentContainerStyle={styles.scrollContent}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        automaticallyAdjustKeyboardInsets={true}
      >
        {currentStep === 1 && renderStep1()}
        {currentStep === 2 && renderStep2()}
        {currentStep === 3 && renderStep3()}
        {currentStep === 4 && renderStep4()}
        {currentStep === 5 && renderStep5()}
        {currentStep === 6 && renderStep6()}
      </ScrollView>

      {/* Navigation Buttons */}
      <View style={styles.navigation}>
        {currentStep > 1 && (
          <Button
            title="Previous"
            onPress={handlePrevStep}
            variant="outline"
            icon="arrow-back"
          />
        )}
        <View style={{ flex: 1 }} />
        <Button
          title={currentStep === 6 ? "Complete Onboarding" : "Next Step"}
          onPress={handleNextStep}
          backgroundColor={LOWES_THEME.primary}
          icon={currentStep === 6 ? "check" : "arrow-forward"}
        />
      </View>
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
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  backButton: {
    padding: SPACING.sm,
    marginRight: SPACING.md,
  },
  headerContent: {
    flex: 1,
  },
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  headerSubtitle: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  stepIndicator: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    paddingVertical: SPACING.lg,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
    backgroundColor: LOWES_THEME.surface,
  },
  stepItem: {
    alignItems: 'center',
    gap: SPACING.xs,
  },
  stepCircle: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#E0E0E0',
    justifyContent: 'center',
    alignItems: 'center',
  },
  stepCircleActive: {
    backgroundColor: LOWES_THEME.primary,
  },
  stepCircleComplete: {
    backgroundColor: LOWES_THEME.success,
  },
  stepNumber: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: '#666',
  },
  stepNumberActive: {
    color: '#FFFFFF',
  },
  stepLabel: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  scrollContent: {
    padding: SPACING.lg,
    paddingBottom: 100, // Space for navigation buttons
  },
  stepContent: {
    gap: SPACING.lg,
  },
  stepTitle: {
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  stepSubtitle: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
    marginTop: -SPACING.sm,
  },
  formSection: {
    gap: SPACING.md,
    marginBottom: SPACING.md,
  },
  formSectionTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  formRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  formFieldLarge: {
    flex: 2,
  },
  formFieldSmall: {
    flex: 1,
  },
  fieldLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
    marginBottom: SPACING.xs,
  },
  googlePlacesContainer: {
    minHeight: 50,
    marginBottom: SPACING.sm,
  },
  radioGroup: {
    gap: SPACING.sm,
  },
  radioOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingVertical: SPACING.sm,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: LOWES_THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: LOWES_THEME.primary,
  },
  radioLabel: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
  },
  compensationCard: {
    backgroundColor: '#E8F5E9',
    padding: SPACING.xl,
    borderRadius: 16,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  compensationAmount: {
    fontSize: 42,
    fontWeight: '700',
    color: LOWES_THEME.success,
  },
  compensationLabel: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  compensationNote: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    textAlign: 'center',
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
    fontSize: FONTS.sizes.xxl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  bonusLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  bonusDescription: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    marginTop: SPACING.xs,
  },
  infoCard: {
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
  },
  infoTitle: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: LOWES_THEME.text,
    marginBottom: SPACING.xs,
  },
  infoText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  infoCardText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 18,
  },
  signatureSection: {
    gap: SPACING.sm,
  },
  signatureLabel: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  signatureNote: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  signatureBox: {
    height: 150,
    borderWidth: 2,
    borderColor: LOWES_THEME.primary,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
  },
  uploadSection: {
    gap: SPACING.sm,
  },
  uploadNote: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
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
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
  },
  uploadTextSuccess: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.success,
    fontWeight: '600',
  },
  policyCard: {
    backgroundColor: '#FFF3E0',
    padding: SPACING.lg,
    borderRadius: 12,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.error,
    gap: SPACING.md,
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
    flex: 1,
  },
  policyContent: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    marginTop: SPACING.sm,
  },
  checkbox: {
    width: 24,
    height: 24,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: LOWES_THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxChecked: {
    backgroundColor: LOWES_THEME.success,
    borderColor: LOWES_THEME.success,
  },
  checkboxLabel: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  signatureCaptured: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.sm,
    backgroundColor: '#E8F5E9',
    borderRadius: 8,
  },
  signatureCapturedText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.success,
    fontWeight: '600',
  },
  navigation: {
    flexDirection: 'row',
    gap: SPACING.md,
    padding: SPACING.lg,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
    backgroundColor: LOWES_THEME.surface,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 3,
    elevation: 5,
  },
  demoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: '#2196F3',
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
  },
  demoBannerText: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    lineHeight: 18,
  },
});
