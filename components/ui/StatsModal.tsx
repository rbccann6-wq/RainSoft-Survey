// Modern visual stats modal component
import React from 'react';
import { View, Text, StyleSheet, Modal, Pressable, Dimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { SPACING, FONTS } from '@/constants/theme';

interface StatsModalProps {
  visible: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  stats: {
    icon: string;
    label: string;
    value: string | number;
    color: string;
  }[];
  message?: string;
  messageType?: 'success' | 'warning' | 'info';
}

const { width } = Dimensions.get('window');

export function StatsModal({
  visible,
  onClose,
  title,
  subtitle,
  stats,
  message,
  messageType = 'info',
}: StatsModalProps) {
  const messageColors = {
    success: ['#4CAF50', '#45a049'],
    warning: ['#FF9800', '#f57c00'],
    info: ['#2196F3', '#1976d2'],
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <View style={styles.overlay}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        
        <View style={styles.modalContainer}>
          {/* Header */}
          <LinearGradient
            colors={['#1976D2', '#1565C0']}
            style={styles.header}
          >
            <View>
              <Text style={styles.title}>{title}</Text>
              {subtitle && <Text style={styles.subtitle}>{subtitle}</Text>}
            </View>
            <Pressable onPress={onClose} style={styles.closeButton}>
              <MaterialIcons name="close" size={24} color="#FFFFFF" />
            </Pressable>
          </LinearGradient>

          {/* Stats Grid */}
          <View style={styles.statsContainer}>
            {stats.map((stat, index) => (
              <View key={index} style={styles.statBox}>
                <View style={[styles.iconCircle, { backgroundColor: stat.color }]}>
                  <MaterialIcons 
                    name={stat.icon as any} 
                    size={32} 
                    color="#FFFFFF" 
                  />
                </View>
                <Text style={styles.statValue}>{stat.value}</Text>
                <Text style={styles.statLabel}>{stat.label}</Text>
              </View>
            ))}
          </View>

          {/* Message */}
          {message && (
            <LinearGradient
              colors={messageColors[messageType]}
              style={styles.messageContainer}
            >
              <MaterialIcons 
                name={
                  messageType === 'success' ? 'check-circle' :
                  messageType === 'warning' ? 'warning' :
                  'info'
                } 
                size={24} 
                color="#FFFFFF" 
              />
              <Text style={styles.message}>{message}</Text>
            </LinearGradient>
          )}

          {/* Action Button */}
          <Pressable onPress={onClose} style={styles.actionButton}>
            <Text style={styles.actionButtonText}>Got it!</Text>
          </Pressable>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
  },
  backdrop: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  modalContainer: {
    width: width * 0.9,
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 20,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: SPACING.lg,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  subtitle: {
    fontSize: FONTS.sizes.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    marginTop: 4,
  },
  closeButton: {
    padding: SPACING.xs,
  },
  statsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: SPACING.lg,
    gap: SPACING.md,
  },
  statBox: {
    width: '47%',
    backgroundColor: '#F8F9FA',
    borderRadius: 16,
    padding: SPACING.lg,
    alignItems: 'center',
    gap: SPACING.sm,
  },
  iconCircle: {
    width: 64,
    height: 64,
    borderRadius: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  statValue: {
    fontSize: 28,
    fontWeight: '700',
    color: '#1A1A1A',
  },
  statLabel: {
    fontSize: FONTS.sizes.sm,
    color: '#666',
    textAlign: 'center',
  },
  messageContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.md,
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: 12,
  },
  message: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
    color: '#FFFFFF',
    lineHeight: 22,
  },
  actionButton: {
    backgroundColor: '#1976D2',
    marginHorizontal: SPACING.lg,
    marginBottom: SPACING.lg,
    padding: SPACING.lg,
    borderRadius: 12,
    alignItems: 'center',
  },
  actionButtonText: {
    fontSize: FONTS.sizes.md,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
