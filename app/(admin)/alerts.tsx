// Admin alerts management - Send urgent alerts to employees
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { MaterialIcons } from '@expo/vector-icons';
import { useApp } from '@/hooks/useApp';
import { useAlert } from '@/template';
import { Button } from '@/components/ui/Button';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import { Alert } from '@/types';
import * as StorageService from '@/services/storageService';
import { sendUrgentAlert } from '@/services/notificationService';

export default function AlertsManagementScreen() {
  const router = useRouter();
  const { currentUser, employees, loadData } = useApp();
  const { showAlert } = useAlert();
  
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [priority, setPriority] = useState<'low' | 'medium' | 'high' | 'urgent'>('medium');
  const [selectedRecipients, setSelectedRecipients] = useState<string[]>([]);
  const [selectAll, setSelectAll] = useState(false);
  const [expiryHours, setExpiryHours] = useState('24');

  const activeEmployees = employees.filter(e => 
    e.status === 'active' && e.id !== currentUser?.id
  );

  const handleToggleRecipient = (employeeId: string) => {
    if (selectedRecipients.includes(employeeId)) {
      setSelectedRecipients(selectedRecipients.filter(id => id !== employeeId));
      setSelectAll(false);
    } else {
      setSelectedRecipients([...selectedRecipients, employeeId]);
    }
  };

  const handleToggleAll = () => {
    if (selectAll) {
      setSelectedRecipients([]);
      setSelectAll(false);
    } else {
      setSelectedRecipients(activeEmployees.map(e => e.id));
      setSelectAll(true);
    }
  };

  const handleSendAlert = async () => {
    if (!title.trim() || !message.trim()) {
      showAlert('Required Fields', 'Please enter alert title and message');
      return;
    }

    if (selectedRecipients.length === 0 && !selectAll) {
      showAlert('No Recipients', 'Please select at least one recipient or "All Employees"');
      return;
    }

    const hours = parseInt(expiryHours) || 24;
    const expiresAt = new Date(Date.now() + hours * 60 * 60 * 1000).toISOString();

    // Validate current user exists
    if (!currentUser) {
      showAlert('Error', 'You must be logged in to send alerts');
      return;
    }

    const alert: Alert = {
      id: Date.now().toString(),
      senderId: currentUser.id,
      senderName: `${currentUser.firstName} ${currentUser.lastName}`,
      title: title.trim(),
      message: message.trim(),
      priority,
      recipientIds: selectAll ? [] : selectedRecipients,
      isGroupAlert: selectAll || selectedRecipients.length > 1,
      timestamp: new Date().toISOString(),
      readBy: [],
      dismissedBy: [],
      expiresAt,
    };

    try {
      // Save alert
      const alerts = await StorageService.getData<Alert[]>('alerts') || [];
      alerts.push(alert);
      await StorageService.saveData('alerts', alerts);

      // Send push notifications
      const recipients = selectAll ? activeEmployees : activeEmployees.filter(e => 
        selectedRecipients.includes(e.id)
      );
      
      if (recipients.length > 0) {
        await sendUrgentAlert(alert, recipients);
      } else {
        console.warn('No recipients found for alert');
      }

      showAlert(
        'Alert Sent',
        `Alert sent to ${selectAll ? 'all employees' : recipients.length + ' employee(s)'}`,
        [
          {
            text: 'Send Another',
            onPress: () => {
              setTitle('');
              setMessage('');
              setPriority('medium');
              setSelectedRecipients([]);
              setSelectAll(false);
              setExpiryHours('24');
            },
          },
          {
            text: 'View History',
            onPress: () => router.push('/(admin)/notifications'),
          },
        ]
      );
    } catch (error) {
      console.error('Failed to send alert:', error);
      showAlert('Error', 'Failed to send alert. Please try again.');
    }
  };

  const priorityOptions = [
    { value: 'low', label: 'Low', icon: 'info', color: '#2196F3' },
    { value: 'medium', label: 'Medium', icon: 'warning', color: '#FF9800' },
    { value: 'high', label: 'High', icon: 'error', color: '#F44336' },
    { value: 'urgent', label: 'Urgent', icon: 'priority-high', color: '#D32F2F' },
  ];

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} style={styles.backButton}>
          <MaterialIcons name="arrow-back" size={24} color={LOWES_THEME.primary} />
        </Pressable>
        <Text style={styles.headerTitle}>Send Alert</Text>
        <Pressable onPress={() => router.push('/(admin)/notifications')}>
          <MaterialIcons name="history" size={24} color={LOWES_THEME.primary} />
        </Pressable>
      </View>

      <ScrollView contentContainerStyle={styles.content}>
        {/* Alert Title */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Alert Title</Text>
          <TextInput
            style={styles.input}
            value={title}
            onChangeText={setTitle}
            placeholder="e.g., Store Closing Early Today"
            maxLength={100}
          />
        </View>

        {/* Alert Message */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Message</Text>
          <TextInput
            style={[styles.input, styles.textArea]}
            value={message}
            onChangeText={setMessage}
            placeholder="Enter detailed message for employees..."
            multiline
            numberOfLines={5}
            maxLength={500}
          />
          <Text style={styles.charCount}>{message.length}/500</Text>
        </View>

        {/* Priority */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Priority Level</Text>
          <View style={styles.priorityGrid}>
            {priorityOptions.map((option) => (
              <Pressable
                key={option.value}
                style={[
                  styles.priorityOption,
                  { borderColor: option.color },
                  priority === option.value && { 
                    backgroundColor: option.color,
                    borderWidth: 0,
                  },
                ]}
                onPress={() => setPriority(option.value as any)}
              >
                <MaterialIcons 
                  name={option.icon as any} 
                  size={24} 
                  color={priority === option.value ? '#FFFFFF' : option.color} 
                />
                <Text style={[
                  styles.priorityText,
                  { color: priority === option.value ? '#FFFFFF' : option.color },
                ]}>
                  {option.label}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>

        {/* Expiry */}
        <View style={styles.inputGroup}>
          <Text style={styles.label}>Alert Expires After (hours)</Text>
          <TextInput
            style={styles.input}
            value={expiryHours}
            onChangeText={setExpiryHours}
            placeholder="24"
            keyboardType="number-pad"
            maxLength={3}
          />
          <Text style={styles.helperText}>
            Alert will automatically expire after {expiryHours || '24'} hours
          </Text>
        </View>

        {/* Recipients */}
        <View style={styles.inputGroup}>
          <View style={styles.labelRow}>
            <Text style={styles.label}>Recipients</Text>
            <Pressable onPress={handleToggleAll} style={styles.selectAllButton}>
              <MaterialIcons 
                name={selectAll ? 'check-box' : 'check-box-outline-blank'} 
                size={20} 
                color={LOWES_THEME.primary} 
              />
              <Text style={styles.selectAllText}>All Employees</Text>
            </Pressable>
          </View>

          <View style={styles.recipientsList}>
            {activeEmployees.map((employee) => (
              <Pressable
                key={employee.id}
                style={[
                  styles.recipientCard,
                  (selectedRecipients.includes(employee.id) || selectAll) && styles.recipientSelected,
                ]}
                onPress={() => handleToggleRecipient(employee.id)}
                disabled={selectAll}
              >
                <View style={styles.recipientInfo}>
                  <MaterialIcons 
                    name={
                      selectedRecipients.includes(employee.id) || selectAll
                        ? 'check-circle'
                        : 'radio-button-unchecked'
                    }
                    size={24}
                    color={
                      selectedRecipients.includes(employee.id) || selectAll
                        ? LOWES_THEME.primary
                        : '#CCCCCC'
                    }
                  />
                  <View style={styles.recipientDetails}>
                    <Text style={styles.recipientName}>
                      {employee.firstName} {employee.lastName}
                    </Text>
                    <Text style={styles.recipientRole}>
                      {employee.role.charAt(0).toUpperCase() + employee.role.slice(1)}
                    </Text>
                  </View>
                </View>
              </Pressable>
            ))}
          </View>

          <Text style={styles.selectedCount}>
            {selectAll 
              ? `All ${activeEmployees.length} employees selected`
              : `${selectedRecipients.length} employee(s) selected`
            }
          </Text>
        </View>

        {/* Send Button */}
        <Button
          title="Send Alert"
          onPress={handleSendAlert}
          backgroundColor={
            priority === 'urgent' ? '#D32F2F' :
            priority === 'high' ? '#F44336' :
            priority === 'medium' ? '#FF9800' :
            LOWES_THEME.primary
          }
          size="large"
          fullWidth
          disabled={!title.trim() || !message.trim() || (selectedRecipients.length === 0 && !selectAll)}
        />

        <View style={styles.warningBox}>
          <MaterialIcons name="info" size={20} color={LOWES_THEME.warning} />
          <Text style={styles.warningText}>
            Push notifications will be sent immediately to all selected employees
          </Text>
        </View>
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
    backgroundColor: '#FFFFFF',
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
    gap: SPACING.lg,
  },
  inputGroup: {
    gap: SPACING.sm,
  },
  label: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
  },
  textArea: {
    minHeight: 120,
    textAlignVertical: 'top',
  },
  charCount: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    textAlign: 'right',
  },
  helperText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    fontStyle: 'italic',
  },
  priorityGrid: {
    flexDirection: 'row',
    gap: SPACING.md,
  },
  priorityOption: {
    flex: 1,
    flexDirection: 'column',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.md,
    borderRadius: 8,
    borderWidth: 2,
    backgroundColor: '#FFFFFF',
  },
  priorityText: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '600',
  },
  selectAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    paddingVertical: SPACING.xs,
    paddingHorizontal: SPACING.sm,
    borderRadius: 6,
    backgroundColor: '#F0F7FF',
  },
  selectAllText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.primary,
  },
  recipientsList: {
    gap: SPACING.sm,
    maxHeight: 300,
  },
  recipientCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: SPACING.md,
    borderWidth: 2,
    borderColor: LOWES_THEME.border,
  },
  recipientSelected: {
    borderColor: LOWES_THEME.primary,
    backgroundColor: '#F0F7FF',
  },
  recipientInfo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
  },
  recipientDetails: {
    flex: 1,
  },
  recipientName: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: LOWES_THEME.text,
  },
  recipientRole: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
  },
  selectedCount: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.primary,
    textAlign: 'center',
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    backgroundColor: '#FFF8E1',
    borderRadius: 8,
    borderLeftWidth: 4,
    borderLeftColor: LOWES_THEME.warning,
  },
  warningText: {
    flex: 1,
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
    lineHeight: 18,
  },
});
