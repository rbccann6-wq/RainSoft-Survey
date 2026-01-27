// Web-optimized data table component
import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Pressable, TextInput } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';

export interface Column<T> {
  key: keyof T | string;
  label: string;
  width?: number | string;
  render?: (item: T) => React.ReactNode;
  sortable?: boolean;
}

interface DataTableProps<T> {
  data: T[];
  columns: Column<T>[];
  onRowPress?: (item: T) => void;
  searchable?: boolean;
  searchKeys?: string[];
  emptyMessage?: string;
}

export function DataTable<T extends { id: string }>({
  data,
  columns,
  onRowPress,
  searchable = false,
  searchKeys = [],
  emptyMessage = 'No data available',
}: DataTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<'asc' | 'desc'>('asc');
  const [searchQuery, setSearchQuery] = useState('');

  // Filter data based on search
  let filteredData = data;
  if (searchable && searchQuery) {
    filteredData = data.filter((item) => {
      return searchKeys.some((key) => {
        const value = (item as any)[key];
        return value?.toString().toLowerCase().includes(searchQuery.toLowerCase());
      });
    });
  }

  // Sort data
  if (sortKey) {
    filteredData = [...filteredData].sort((a, b) => {
      const aVal = (a as any)[sortKey];
      const bVal = (b as any)[sortKey];
      
      if (aVal < bVal) return sortDirection === 'asc' ? -1 : 1;
      if (aVal > bVal) return sortDirection === 'asc' ? 1 : -1;
      return 0;
    });
  }

  const handleSort = (key: string) => {
    if (sortKey === key) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortDirection('asc');
    }
  };

  return (
    <View style={styles.container}>
      {searchable && (
        <View style={styles.searchContainer}>
          <MaterialIcons name="search" size={20} color={LOWES_THEME.textSubtle} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor={LOWES_THEME.textSubtle}
          />
          {searchQuery.length > 0 && (
            <Pressable onPress={() => setSearchQuery('')}>
              <MaterialIcons name="close" size={20} color={LOWES_THEME.textSubtle} />
            </Pressable>
          )}
        </View>
      )}

      <ScrollView horizontal showsHorizontalScrollIndicator={false}>
        <View style={styles.table}>
          {/* Header */}
          <View style={styles.headerRow}>
            {columns.map((column) => (
              <Pressable
                key={String(column.key)}
                style={[styles.headerCell, { width: column.width || 150 }]}
                onPress={() => column.sortable !== false && handleSort(String(column.key))}
              >
                <Text style={styles.headerText}>{column.label}</Text>
                {sortKey === column.key && (
                  <MaterialIcons
                    name={sortDirection === 'asc' ? 'arrow-upward' : 'arrow-downward'}
                    size={16}
                    color={LOWES_THEME.primary}
                  />
                )}
              </Pressable>
            ))}
          </View>

          {/* Data Rows */}
          <ScrollView style={styles.dataContainer}>
            {filteredData.length === 0 ? (
              <View style={styles.emptyState}>
                <MaterialIcons name="inbox" size={48} color={LOWES_THEME.textSubtle} />
                <Text style={styles.emptyText}>{emptyMessage}</Text>
              </View>
            ) : (
              filteredData.map((item, index) => (
                <Pressable
                  key={item.id}
                  style={[
                    styles.dataRow,
                    index % 2 === 1 && styles.dataRowAlt,
                    onRowPress && styles.dataRowClickable,
                  ]}
                  onPress={() => onRowPress?.(item)}
                >
                  {columns.map((column) => (
                    <View
                      key={String(column.key)}
                      style={[styles.dataCell, { width: column.width || 150 }]}
                    >
                      {column.render ? (
                        column.render(item)
                      ) : (
                        <Text style={styles.dataText} numberOfLines={2}>
                          {String((item as any)[column.key] || '-')}
                        </Text>
                      )}
                    </View>
                  ))}
                </Pressable>
              ))
            )}
          </ScrollView>
        </View>
      </ScrollView>

      {/* Results count */}
      {filteredData.length > 0 && (
        <View style={styles.footer}>
          <Text style={styles.footerText}>
            Showing {filteredData.length} of {data.length} {filteredData.length === 1 ? 'row' : 'rows'}
          </Text>
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: LOWES_THEME.surface,
    borderRadius: 12,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: LOWES_THEME.border,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    padding: SPACING.md,
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
    backgroundColor: LOWES_THEME.background,
  },
  searchInput: {
    flex: 1,
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.text,
    padding: 0,
  },
  table: {
    minWidth: '100%',
  },
  headerRow: {
    flexDirection: 'row',
    backgroundColor: LOWES_THEME.surfaceLight,
    borderBottomWidth: 2,
    borderBottomColor: LOWES_THEME.primary,
  },
  headerCell: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.xs,
    padding: SPACING.md,
    borderRightWidth: 1,
    borderRightColor: LOWES_THEME.border,
  },
  headerText: {
    fontSize: FONTS.sizes.sm,
    fontWeight: '700',
    color: LOWES_THEME.text,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  dataContainer: {
    maxHeight: 600,
  },
  dataRow: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: LOWES_THEME.border,
  },
  dataRowAlt: {
    backgroundColor: '#FAFBFC',
  },
  dataRowClickable: {
    cursor: 'pointer' as any,
  },
  dataCell: {
    padding: SPACING.md,
    borderRightWidth: 1,
    borderRightColor: LOWES_THEME.border,
    justifyContent: 'center',
  },
  dataText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.text,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: SPACING.xxl * 2,
    gap: SPACING.md,
  },
  emptyText: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
  },
  footer: {
    padding: SPACING.md,
    borderTopWidth: 1,
    borderTopColor: LOWES_THEME.border,
    backgroundColor: LOWES_THEME.background,
  },
  footerText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.textSubtle,
    textAlign: 'center',
  },
});
