// Reusable input component
import React from 'react';
import { View, Text, TextInput, StyleSheet, TextInputProps } from 'react-native';
import { SPACING, FONTS, COMMON } from '@/constants/theme';

interface InputProps extends TextInputProps {
  label?: string;
  error?: string;
  borderColor?: string;
}

export function Input({ label, error, borderColor, style, ...props }: InputProps) {
  return (
    <View style={styles.container}>
      {label && <Text style={styles.label}>{label}</Text>}
      <TextInput
        style={[
          styles.input,
          borderColor && { borderColor },
          error && styles.inputError,
          style,
        ]}
        placeholderTextColor="#999999"
        {...props}
      />
      {error && <Text style={styles.errorText}>{error}</Text>}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    width: '100%',
  },
  label: {
    fontSize: FONTS.sizes.md,
    fontWeight: '500',
    color: '#1A1A1A',
    marginBottom: SPACING.sm,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 2,
    borderColor: '#D1DDE6',
    borderRadius: COMMON.borderRadius.md,
    paddingHorizontal: SPACING.md,
    paddingVertical: SPACING.md,
    fontSize: FONTS.sizes.md,
    color: '#1A1A1A',
    minHeight: 48,
  },
  inputError: {
    borderColor: '#D32F2F',
  },
  errorText: {
    fontSize: FONTS.sizes.sm,
    color: '#D32F2F',
    marginTop: SPACING.xs,
  },
});
