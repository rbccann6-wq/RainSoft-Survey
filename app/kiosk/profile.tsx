// Employee profile page - View and update personal info
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import * as StorageService from '@/services/storageService';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { TimePicker30 } from '@/components/ui/TimePicker30';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { formatTime12Hour } from '@/utils/timeFormat';

export default function ProfileScreen() {
  const router = useRouter();
  const { currentUser, loadData } = useApp();
  const { showAlert } = useAlert();
  
  const [isEditingContact, setIsEditingContact] = useState(false);
  const [phone, setPhone] = useState(currentUser?.phone || '');
  const [email, setEmail] = useState(currentUser?.email || '');
  
  const [isEditingAvailability, setIsEditingAvailability] = useState(false);
  const [availability, setAvailability] = useState(currentUser?.availability || {
    monday: { available: false },
    tuesday: { available: false },
    wednesday: { available: false },
    thursday: { available: false },
    friday: { available: false },
    saturday: { available: false },
    sunday: { available: false },
  });
  
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);

  const handleSaveContact = async () => {
    if (!currentUser) return;
    
    await StorageService.updateEmployee(currentUser.id, { phone, email });
    await loadData();
    setIsEditingContact(false);
    showAlert('Success', 'Contact information updated');
  };

  const handleSaveAvailability = async () => {
    if (!currentUser) return;
    
    await StorageService.updateEmployee(currentUser.id, { availability });
    await loadData();
    setIsEditingAvailability(false);
    showAlert('Success', 'Availability updated');
  };
  
  const handleUploadProfilePicture = async () => {
    try {
      // Request permission
      const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (status !== 'granted') {
        showAlert('Permission Denied', 'Camera roll permission is required to upload a profile picture');
        return;
      }
      
      // Launch image picker
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.7,
      });
      
      if (!result.canceled && result.assets[0]) {
        setIsUploadingPhoto(true);
        const imageUri = result.assets[0].uri;
        
        try {
          // Upload to Supabase Storage
          const publicUrl = await uploadProfilePicture(imageUri, currentUser!.id);
          
          // Update employee profile picture with public URL
          await StorageService.updateEmployee(currentUser!.id, { profilePictureUri: publicUrl });
          await loadData();
          
          setIsUploadingPhoto(false);
          showAlert('Success', 'Profile picture updated');
        } catch (uploadError) {
          console.error('Upload error:', uploadError);
          setIsUploadingPhoto(false);
          showAlert('Error', uploadError instanceof Error ? uploadError.message : 'Failed to upload profile picture');
        }
      }
    } catch (error) {
      console.error('Photo upload error:', error);
      setIsUploadingPhoto(false);
      showAlert('Error', 'Failed to upload profile picture');
    }
  };

  // Upload profile picture to Supabase Storage
  const uploadProfilePicture = async (imageUri: string, employeeId: string): Promise<string> => {
    const { getSupabaseClient } = require('@/template');
    const supabase = getSupabaseClient();
    
    // Convert image to base64
    const response = await fetch(imageUri);
    const blob = await response.blob();
    const arrayBuffer = await new Promise<ArrayBuffer>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result as ArrayBuffer);
      reader.readAsArrayBuffer(blob);
    });
    
    // Generate unique filename
    const fileExt = imageUri.split('.').pop() || 'jpg';
    const fileName = `${employeeId}/profile-${Date.now()}.${fileExt}`;
    
    // Upload to storage bucket
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('profile-pictures')
      .upload(fileName, arrayBuffer, {
        contentType: `image/${fileExt}`,
        upsert: true,
      });
    
    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw new Error(`Upload failed: ${uploadError.message}`);
    }
    
    // Get public URL
    const { data: urlData } = supabase.storage
      .from('profile-pictures')
      .getPublicUrl(fileName);
    
    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL');
    }
    
    return urlData.publicUrl;
  };

  const toggleDay = (day: keyof typeof availability) => {
    const currentDay = availability[day];
    setAvailability({ 
      ...availability, 
      [day]: { 
        ...currentDay,
        available: !currentDay.available,
        startTime: currentDay.available ? undefined : '09:00',
        endTime: currentDay.available ? undefined : '17:00',
      } 
    });
  };

  const updateDayTime = (day: keyof typeof availability, field: 'startTime' | 'endTime', time: string) => {
    setAvailability({ 
      ...availability, 
      [day]: { 
        ...availability[day],
        [field]: time,
      } 
    });
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>My Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Onboarding Banner */}
        {!currentUser?.onboardingComplete && (
          <Pressable 
            style={styles.onboardingBanner}
            onPress={() => showAlert('Complete Onboarding', 'Please complete your onboarding paperwork to activate your account. Contact your manager for the onboarding link.')}
          >
            <MaterialIcons name="warning" size={24} color="#FFFFFF" />
            <View style={styles.bannerContent}>
              <Text style={styles.bannerTitle}>Action Required</Text>
              <Text style={styles.bannerText}>
                Complete your onboarding to activate your account
              </Text>
            </View>
            <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
          </Pressable>
        )}
        {/* Profile Header */}
        <View style={styles.profileCard}>
          <Pressable onPress={handleUploadProfilePicture} style={styles.avatarContainer}>
            {currentUser?.profilePictureUri ? (
              <Image 
                source={{ uri: currentUser.profilePictureUri }} 
                style={styles.avatarImage}
              />
            ) : (
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>
                  {currentUser?.firstName[0]}{currentUser?.lastName[0]}
                </Text>
              </View>
            )}
            <View style={styles.cameraIcon}>
              <MaterialIcons name="camera-alt" size={20} color="#FFFFFF" />
            </View>
          </Pressable>
          
          {isUploadingPhoto && (
            <Text style={styles.uploadingText}>Uploading...</Text>
          )}
          
          <Text style={styles.name}>
            {currentUser?.firstName} {currentUser?.lastName}
          </Text>
          <Text style={styles.role}>{currentUser?.role}</Text>
          <Text style={styles.hireDate}>
            Hired: {new Date(currentUser?.hireDate || '').toLocaleDateString()}
          </Text>
        </View>

        {/* Contact Information */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Contact Information</Text>
            <Pressable onPress={() => setIsEditingContact(!isEditingContact)}>
              <MaterialIcons 
                name={isEditingContact ? 'close' : 'edit'} 
                size={20} 
                color={LOWES_THEME.primary} 
              />
            </Pressable>
          </View>

          <View style={styles.card}>
            {isEditingContact ? (
              <View style={styles.editForm}>
                <View>
                  <Text style={styles.label}>Email</Text>
                  <Input
                    value={email}
                    onChangeText={setEmail}
                    keyboardType="email-address"
                    autoCapitalize="none"
                  />
                </View>
                <View>
                  <Text style={styles.label}>Phone</Text>
                  <Input
                    value={phone}
                    onChangeText={setPhone}
                    keyboardType="phone-pad"
                  />
                </View>
                <Button
                  title="Save Changes"
                  onPress={handleSaveContact}
                  backgroundColor={LOWES_THEME.success}
                  fullWidth
                />
              </View>
            ) : (
              <View style={styles.infoGrid}>
                <View style={styles.infoRow}>
                  <MaterialIcons name="email" size={20} color={LOWES_THEME.primary} />
                  <View>
                    <Text style={styles.infoLabel}>Email</Text>
                    <Text style={styles.infoValue}>{currentUser?.email}</Text>
                  </View>
                </View>
                <View style={styles.infoRow}>
                  <MaterialIcons name="phone" size={20} color={LOWES_THEME.primary} />
                  <View>
                    <Text style={styles.infoLabel}>Phone</Text>
                    <Text style={styles.infoValue}>{currentUser?.phone}</Text>
                  </View>
                </View>
              </View>
            )}
          </View>
        </View>

        {/* Availability */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Availability</Text>
            <Pressable onPress={() => setIsEditingAvailability(!isEditingAvailability)}>
              <MaterialIcons 
                name={isEditingAvailability ? 'close' : 'edit'} 
                size={20} 
                color={LOWES_THEME.primary} 
              />
            </Pressable>
          </View>

          <View style={styles.card}>
            {isEditingAvailability ? (
              <View style={styles.editForm}>
                {Object.entries(availability).map(([day, dayData]) => (
                  <View key={day} style={styles.dayRow}>
                    <Pressable
                      style={[
                        styles.dayToggle,
                        dayData.available && styles.dayToggleActive,
                      ]}
                      onPress={() => toggleDay(day as keyof typeof availability)}
                    >
                      <Text style={[
                        styles.dayToggleText,
                        dayData.available && styles.dayToggleTextActive,
                      ]}>
                        {day.charAt(0).toUpperCase() + day.slice(1)}
                      </Text>
                    </Pressable>
                    
                    {dayData.available && (
                      <View style={styles.timeInputs}>
                        <View style={styles.timeInput}>
                          <TimePicker30
                            label="Start Time"
                            value={dayData.startTime || '09:00'}
                            onChange={(time) => updateDayTime(day as keyof typeof availability, 'startTime', time)}
                            primaryColor={LOWES_THEME.primary}
                            textColor={LOWES_THEME.text}
                          />
                        </View>
                        <View style={styles.timeInput}>
                          <TimePicker30
                            label="End Time"
                            value={dayData.endTime || '17:00'}
                            onChange={(time) => updateDayTime(day as keyof typeof availability, 'endTime', time)}
                            primaryColor={LOWES_THEME.primary}
                            textColor={LOWES_THEME.text}
                          />
                        </View>
                      </View>
                    )}
                  </View>
                ))}
                <Button
                  title="Save Availability"
                  onPress={handleSaveAvailability}
                  backgroundColor={LOWES_THEME.success}
                  fullWidth
                />
              </View>
            ) : (
              <View style={styles.availabilityList}>
                {Object.entries(availability).map(([day, dayData]) => (
                  <View key={day} style={styles.availabilityRow}>
                    <Text style={[
                      styles.availabilityDay,
                      !dayData.available && styles.unavailableDay,
                    ]}>
                      {day.charAt(0).toUpperCase() + day.slice(1)}
                    </Text>
                    {dayData.available ? (
                      <Text style={styles.availabilityTime}>
                        {formatTime12Hour(dayData.startTime || '09:00')} - {formatTime12Hour(dayData.endTime || '17:00')}
                      </Text>
                    ) : (
                      <Text style={styles.unavailableText}>Not Available</Text>
                    )}
                  </View>
                ))}
              </View>
            )}
          </View>
        </View>

        {/* Documents */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>My Documents</Text>
          
          <View style={styles.card}>
            {currentUser?.documents && currentUser.documents.length > 0 ? (
              currentUser.documents.map((doc) => (
                <Pressable key={doc.id} style={styles.documentRow}>
                  <MaterialIcons 
                    name="description" 
                    size={24} 
                    color={doc.status === 'completed' ? LOWES_THEME.success : LOWES_THEME.warning} 
                  />
                  <View style={styles.documentInfo}>
                    <Text style={styles.documentName}>{doc.type.toUpperCase()}</Text>
                    <Text style={styles.documentDate}>
                      {new Date(doc.uploadedAt).toLocaleDateString()}
                    </Text>
                  </View>
                  <MaterialIcons 
                    name={doc.status === 'completed' ? 'check-circle' : 'pending'} 
                    size={20} 
                    color={doc.status === 'completed' ? LOWES_THEME.success : LOWES_THEME.warning} 
                  />
                </Pressable>
              ))
            ) : (
              <View style={styles.emptyState}>
                <MaterialIcons name="folder-open" size={48} color={LOWES_THEME.textSubtle} />
                <Text style={styles.emptyText}>No documents uploaded</Text>
              </View>
            )}
          </View>
        </View>

        {/* Team Lead Information (if user is a team lead) */}
        {currentUser?.isTeamLead && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>My Team</Text>
            
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <MaterialIcons name="groups" size={20} color={LOWES_THEME.primary} />
                <View style={{ flex: 1 }}>
                  <Text style={styles.infoLabel}>Team Lead Role</Text>
                  <Text style={styles.infoValue}>
                    You can view your team's survey statistics in the Statistics tab. Team assignments are managed by administrators.
                  </Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Personal Info (if completed onboarding) */}
        {currentUser?.personalInfo && (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Personal Information</Text>
            
            <View style={styles.card}>
              <View style={styles.infoRow}>
                <MaterialIcons name="home" size={20} color={LOWES_THEME.primary} />
                <View>
                  <Text style={styles.infoLabel}>Address</Text>
                  <Text style={styles.infoValue}>
                    {currentUser.personalInfo.address}{'\n'}
                    {currentUser.personalInfo.city}, {currentUser.personalInfo.state} {currentUser.personalInfo.zipCode}
                  </Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <MaterialIcons name="cake" size={20} color={LOWES_THEME.primary} />
                <View>
                  <Text style={styles.infoLabel}>Date of Birth</Text>
                  <Text style={styles.infoValue}>
                    {new Date(currentUser.personalInfo.dateOfBirth).toLocaleDateString()}
                  </Text>
                </View>
              </View>
              
              <View style={styles.infoRow}>
                <MaterialIcons name="contact-phone" size={20} color={LOWES_THEME.primary} />
                <View>
                  <Text style={styles.infoLabel}>Emergency Contact</Text>
                  <Text style={styles.infoValue}>
                    {currentUser.personalInfo.emergencyContactName} ({currentUser.personalInfo.emergencyContactRelation}){'\n'}
                    {currentUser.personalInfo.emergencyContactPhone}
                  </Text>
                </View>
              </View>
            </View>
          </View>
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
  headerTitle: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  content: {
    padding: SPACING.lg,
    gap: SPACING.xl,
  },
  profileCard: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.xl,
    borderRadius: 16,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  avatarContainer: {
    position: 'relative',
  },
  avatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: LOWES_THEME.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarImage: {
    width: 100,
    height: 100,
    borderRadius: 50,
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    backgroundColor: LOWES_THEME.primary,
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: LOWES_THEME.surface,
  },
  avatarText: {
    color: '#FFFFFF',
    fontSize: 40,
    fontWeight: '700',
  },
  uploadingText: {
    color: LOWES_THEME.primary,
    fontSize: FONTS.sizes.sm,
    fontStyle: 'italic',
  },
  name: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
  },
  role: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.primary,
    textTransform: 'capitalize',
  },
  hireDate: {
    fontSize: FONTS.sizes.sm,
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
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  card: {
    backgroundColor: LOWES_THEME.surface,
    padding: SPACING.lg,
    borderRadius: 12,
    gap: SPACING.md,
  },
  editForm: {
    gap: SPACING.md,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
    marginBottom: SPACING.xs,
  },
  infoGrid: {
    gap: SPACING.lg,
  },
  infoRow: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  infoLabel: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    marginBottom: 2,
  },
  infoValue: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
    lineHeight: 20,
  },
  onboardingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    padding: SPACING.lg,
    backgroundColor: '#F44336',
    borderRadius: 12,
    marginBottom: SPACING.md,
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
    fontSize: FONTS.sizes.sm,
    lineHeight: 18,
  },
  dayRow: {
    gap: SPACING.sm,
  },
  dayToggle: {
    paddingVertical: SPACING.md,
    paddingHorizontal: SPACING.lg,
    borderRadius: 8,
    backgroundColor: '#E0E0E0',
  },
  dayToggleActive: {
    backgroundColor: LOWES_THEME.primary,
  },
  dayToggleText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.textSubtle,
  },
  dayToggleTextActive: {
    color: '#FFFFFF',
  },
  timeInputs: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: SPACING.md,
    paddingLeft: SPACING.lg,
    marginTop: SPACING.sm,
  },
  timeInput: {
    flex: 1,
  },
  availabilityList: {
    gap: SPACING.sm,
  },
  availabilityRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: SPACING.sm,
    paddingHorizontal: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  availabilityDay: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  availabilityTime: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.primary,
    fontWeight: '600',
  },
  unavailableDay: {
    color: LOWES_THEME.textSubtle,
  },
  unavailableText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    fontStyle: 'italic',
  },
  documentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    paddingVertical: SPACING.sm,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  documentInfo: {
    flex: 1,
  },
  documentName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  documentDate: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xl,
    gap: SPACING.sm,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
  },
});
