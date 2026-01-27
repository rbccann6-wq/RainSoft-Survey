// Simple time picker with 30-minute increments for employee availability
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Modal, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SPACING, FONTS } from '@/constants/theme';

interface TimePicker30Props {
  label: string;
  value: string; // 24-hour format "HH:MM"
  onChange: (time: string) => void;
  primaryColor?: string;
  textColor?: string;
  disabled?: boolean;
}

// Generate time slots in 30-minute increments from 6:00 AM to 11:30 PM
const generateTimeSlots = (): Array<{ value: string; label: string }> => {
  const slots = [];
  for (let hour = 6; hour < 24; hour++) {
    for (let minute = 0; minute < 60; minute += 30) {
      const hour24 = hour;
      const hourStr = hour24.toString().padStart(2, '0');
      const minuteStr = minute.toString().padStart(2, '0');
      const value = `${hourStr}:${minuteStr}`;
      
      // Format to 12-hour with AM/PM
      const isPM = hour24 >= 12;
      const hour12 = hour24 === 0 ? 12 : hour24 > 12 ? hour24 - 12 : hour24;
      const label = `${hour12}:${minuteStr} ${isPM ? 'PM' : 'AM'}`;
      
      slots.push({ value, label });
    }
  }
  return slots;
};

const TIME_SLOTS = generateTimeSlots();

export function TimePicker30({
  label,
  value,
  onChange,
  primaryColor = '#2196F3',
  textColor = '#1a1a1a',
  disabled = false,
}: TimePicker30Props) {
  const [showModal, setShowModal] = useState(false);

  const formatDisplayValue = (time24: string): string => {
    if (!time24) return 'Select time';
    
    const slot = TIME_SLOTS.find(s => s.value === time24);
    return slot ? slot.label : time24;
  };

  const handleSelect = (time: string) => {
    onChange(time);
    setShowModal(false);
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      
      <Pressable
        onPress={() => !disabled && setShowModal(true)}
        style={[
          styles.button,
          {
            borderColor: primaryColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        disabled={disabled}
      >
        <MaterialIcons name="access-time" size={24} color={primaryColor} />
        <Text
          style={[
            styles.buttonText,
            {
              color: value ? textColor : '#999',
            },
          ]}
        >
          {formatDisplayValue(value)}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={24} color={primaryColor} />
      </Pressable>

      <Modal
        visible={showModal}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setShowModal(false)}
      >
        <Pressable 
          style={styles.modalOverlay}
          onPress={() => setShowModal(false)}
        >
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Select {label}</Text>
              <Pressable onPress={() => setShowModal(false)}>
                <MaterialIcons name="close" size={24} color="#666" />
              </Pressable>
            </View>
            
            <ScrollView style={styles.timeList}>
              {TIME_SLOTS.map((slot) => (
                <Pressable
                  key={slot.value}
                  onPress={() => handleSelect(slot.value)}
                  style={[
                    styles.timeOption,
                    value === slot.value && { backgroundColor: primaryColor },
                  ]}
                >
                  <Text
                    style={[
                      styles.timeOptionText,
                      value === slot.value && styles.timeOptionTextSelected,
                    ]}
                  >
                    {slot.label}
                  </Text>
                  {value === slot.value && (
                    <MaterialIcons name="check" size={20} color="#FFFFFF" />
                  )}
                </Pressable>
              ))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    borderWidth: 2,
    borderRadius: 8,
    backgroundColor: '#FFFFFF',
  },
  buttonText: {
    fontSize: FONTS.sizes.md,
    flex: 1,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    maxHeight: '70%',
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  modalTitle: {
    fontSize: FONTS.sizes.lg,
    fontWeight: '600',
    color: '#1a1a1a',
  },
  timeList: {
    maxHeight: 400,
  },
  timeOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
  },
  timeOptionText: {
    fontSize: FONTS.sizes.md,
    color: '#1a1a1a',
  },
  timeOptionTextSelected: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
});
