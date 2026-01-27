// Reusable iOS-style DateTimePicker component
import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, Platform } from 'react-native';
import DateTimePicker, { DateTimePickerEvent } from '@react-native-community/datetimepicker';
import { MaterialIcons } from '@expo/vector-icons';
import { Button } from './Button';
import { SPACING, FONTS } from '@/constants/theme';

interface DatePickerProps {
  label: string;
  value: Date | null;
  onChange: (date: Date | null) => void;
  mode?: 'date' | 'time' | 'datetime';
  minimumDate?: Date;
  maximumDate?: Date;
  placeholder?: string;
  primaryColor?: string;
  textColor?: string;
  disabled?: boolean;
}

export function DatePicker({
  label,
  value,
  onChange,
  mode = 'date',
  minimumDate,
  maximumDate,
  placeholder = 'Select',
  primaryColor = '#2196F3',
  textColor = '#1a1a1a',
  disabled = false,
}: DatePickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleChange = (event: DateTimePickerEvent, selectedDate?: Date) => {
    setShowPicker(false);
    
    if (event.type === 'set' && selectedDate) {
      onChange(selectedDate);
    }
  };

  const formatValue = (date: Date | null) => {
    if (!date) return placeholder;
    
    switch (mode) {
      case 'time':
        return date.toLocaleTimeString('en-US', {
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      case 'datetime':
        return date.toLocaleString('en-US', {
          weekday: 'short',
          month: 'short',
          day: 'numeric',
          hour: 'numeric',
          minute: '2-digit',
          hour12: true,
        });
      case 'date':
      default:
        return date.toLocaleDateString('en-US', {
          weekday: 'short',
          year: 'numeric',
          month: 'short',
          day: 'numeric',
        });
    }
  };

  const getIcon = () => {
    switch (mode) {
      case 'time':
        return 'access-time';
      case 'datetime':
        return 'event-available';
      case 'date':
      default:
        return 'event';
    }
  };

  return (
    <View style={styles.container}>
      <Text style={[styles.label, { color: textColor }]}>{label}</Text>
      
      <Pressable
        onPress={() => !disabled && setShowPicker(true)}
        style={[
          styles.button,
          {
            borderColor: primaryColor,
            opacity: disabled ? 0.5 : 1,
          },
        ]}
        disabled={disabled}
      >
        <MaterialIcons name={getIcon()} size={24} color={primaryColor} />
        <Text
          style={[
            styles.buttonText,
            {
              color: value ? textColor : '#999',
            },
          ]}
        >
          {formatValue(value)}
        </Text>
        <MaterialIcons name="arrow-drop-down" size={24} color={primaryColor} />
      </Pressable>

      {showPicker && (
        <DateTimePicker
          value={value || new Date()}
          mode={mode}
          display={Platform.OS === 'ios' ? 'default' : 'default'}
          onChange={handleChange}
          minimumDate={minimumDate}
          maximumDate={maximumDate}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: SPACING.xs,
  },
  label: {
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    marginBottom: SPACING.xs,
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
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
});
