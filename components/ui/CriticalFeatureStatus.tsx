// Visual indicator for critical features health status
import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';
import * as FailsafeStorage from '@/services/failsafeStorage';

interface Props {
  compact?: boolean;
}

/**
 * Shows health status of critical features
 * - Green: All systems operational
 * - Yellow: Some items pending sync (normal offline behavior)
 * - Red: Storage system degraded
 */
export function CriticalFeatureStatus({ compact = false }: Props) {
  const [health, setHealth] = useState({
    healthy: true,
    surveysStored: 0,
    timeEntriesStored: 0,
    queuedForSync: 0,
    lastBackup: null as string | null,
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    loadHealth();
    const interval = setInterval(loadHealth, 30000); // Check every 30s
    return () => clearInterval(interval);
  }, []);

  const loadHealth = async () => {
    const status = await FailsafeStorage.getCriticalStorageHealth();
    setHealth(status);
  };

  const getStatusColor = () => {
    if (!health.healthy) return LOWES_THEME.error;
    if (health.queuedForSync > 0) return '#FF9800'; // Warning yellow
    return LOWES_THEME.success;
  };

  const getStatusIcon = () => {
    if (!health.healthy) return 'error';
    if (health.queuedForSync > 0) return 'sync';
    return 'check-circle';
  };

  const getStatusText = () => {
    if (!health.healthy) return 'DEGRADED';
    if (health.queuedForSync > 0) return 'SYNCING';
    return 'OPERATIONAL';
  };

  if (compact) {
    return (
      <View style={[styles.compactBadge, { backgroundColor: getStatusColor() }]}>
        <MaterialIcons name={getStatusIcon()} size={14} color="#FFFFFF" />
        <Text style={styles.compactText}>{getStatusText()}</Text>
      </View>
    );
  }

  return (
    <Pressable 
      style={styles.container}
      onPress={() => setExpanded(!expanded)}
    >
      <View style={styles.header}>
        <View style={[styles.statusDot, { backgroundColor: getStatusColor() }]} />
        <Text style={styles.title}>Critical Systems</Text>
        <Text style={[styles.status, { color: getStatusColor() }]}>
          {getStatusText()}
        </Text>
        <MaterialIcons 
          name={expanded ? 'expand-less' : 'expand-more'} 
          size={20} 
          color={LOWES_THEME.textSubtle} 
        />
      </View>

      {expanded && (
        <View style={styles.details}>
          <View style={styles.detailRow}>
            <MaterialIcons name="assignment" size={16} color={LOWES_THEME.primary} />
            <Text style={styles.detailText}>
              {health.surveysStored} surveys stored
            </Text>
          </View>
          
          <View style={styles.detailRow}>
            <MaterialIcons name="schedule" size={16} color={LOWES_THEME.primary} />
            <Text style={styles.detailText}>
              {health.timeEntriesStored} time entries
            </Text>
          </View>
          
          {health.queuedForSync > 0 && (
            <View style={styles.detailRow}>
              <MaterialIcons name="cloud-upload" size={16} color="#FF9800" />
              <Text style={[styles.detailText, { color: '#FF9800' }]}>
                {health.queuedForSync} items queued for sync
              </Text>
            </View>
          )}
          
          {health.lastBackup && (
            <View style={styles.detailRow}>
              <MaterialIcons name="backup" size={16} color={LOWES_THEME.textSubtle} />
              <Text style={styles.detailSubtext}>
                Last backup: {new Date(health.lastBackup).toLocaleTimeString()}
              </Text>
            </View>
          )}
          
          <View style={styles.infoBox}>
            <MaterialIcons name="info" size={14} color={LOWES_THEME.primary} />
            <Text style={styles.infoText}>
              Survey submissions and clock in/out are always saved locally first, 
              then synced to cloud when online. Your data is safe.
            </Text>
          </View>
        </View>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: LOWES_THEME.surface,
    borderRadius: 12,
    padding: SPACING.md,
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  title: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '600',
    color: LOWES_THEME.text,
    flex: 1,
  },
  status: {
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  details: {
    marginTop: SPACING.md,
    paddingTop: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
    gap: SPACING.sm,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
  },
  detailText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
  },
  detailSubtext: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
  },
  infoBox: {
    flexDirection: 'row',
    gap: SPACING.xs,
    padding: SPACING.sm,
    backgroundColor: '#F0F7FF',
    borderRadius: 8,
    marginTop: SPACING.xs,
  },
  infoText: {
    flex: 1,
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.text,
    lineHeight: 16,
  },
  compactBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: SPACING.sm,
    borderRadius: 12,
  },
  compactText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.xs,
    fontWeight: '700',
    letterSpacing: 0.3,
  },
});
