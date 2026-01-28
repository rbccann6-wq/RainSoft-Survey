// Error Boundary Component - Catches errors and prevents app crashes
import React, { Component, ReactNode } from 'react';
import { View, Text, StyleSheet, Pressable } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SPACING, FONTS, LOWES_THEME } from '@/constants/theme';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
  feature?: string; // Name of the feature for error reporting
  onError?: (error: Error, errorInfo: React.ErrorInfo) => void;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: React.ErrorInfo | null;
}

/**
 * Error Boundary - Isolates feature crashes
 * 
 * Usage:
 * <ErrorBoundary feature="Messages">
 *   <MessagesFeature />
 * </ErrorBoundary>
 * 
 * If MessagesFeature crashes, only that feature is affected,
 * core features (survey, clock in/out) continue to work.
 */
export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false,
      error: null,
      errorInfo: null,
    };
  }

  static getDerivedStateFromError(error: Error): Partial<State> {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error(`🔥 Error in ${this.props.feature || 'component'}:`, error);
    console.error('Error info:', errorInfo);
    
    // Log to error tracking service if available
    if (this.props.onError) {
      this.props.onError(error, errorInfo);
    }
    
    this.setState({ error, errorInfo });
  }

  handleReset = () => {
    this.setState({
      hasError: false,
      error: null,
      errorInfo: null,
    });
  };

  render() {
    if (this.state.hasError) {
      // Use custom fallback if provided
      if (this.props.fallback) {
        return this.props.fallback;
      }
      
      // Default error UI
      return (
        <View style={styles.container}>
          <View style={styles.iconContainer}>
            <MaterialIcons name="error-outline" size={64} color={LOWES_THEME.error} />
          </View>
          
          <Text style={styles.title}>
            {this.props.feature ? `${this.props.feature} Error` : 'Something went wrong'}
          </Text>
          
          <Text style={styles.message}>
            {this.props.feature 
              ? `The ${this.props.feature} feature encountered an error. Other features are still working normally.`
              : 'This feature encountered an error but the rest of the app is still working.'}
          </Text>
          
          {__DEV__ && this.state.error && (
            <View style={styles.errorDetails}>
              <Text style={styles.errorText}>{this.state.error.toString()}</Text>
            </View>
          )}
          
          <Pressable style={styles.button} onPress={this.handleReset}>
            <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
            <Text style={styles.buttonText}>Try Again</Text>
          </Pressable>
          
          <Text style={styles.helpText}>
            If this keeps happening, please contact support
          </Text>
        </View>
      );
    }

    return this.props.children;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: SPACING.xl,
    backgroundColor: LOWES_THEME.background,
  },
  iconContainer: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: FONTS.sizes.xl,
    fontWeight: '700',
    color: LOWES_THEME.text,
    textAlign: 'center',
    marginBottom: SPACING.md,
  },
  message: {
    fontSize: FONTS.sizes.md,
    color: LOWES_THEME.textSubtle,
    textAlign: 'center',
    lineHeight: 22,
    marginBottom: SPACING.lg,
  },
  errorDetails: {
    backgroundColor: '#FFEBEE',
    padding: SPACING.md,
    borderRadius: 8,
    marginBottom: SPACING.lg,
    width: '100%',
  },
  errorText: {
    fontSize: FONTS.sizes.xs,
    color: LOWES_THEME.error,
    fontFamily: 'monospace',
  },
  button: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: SPACING.sm,
    backgroundColor: LOWES_THEME.primary,
    paddingHorizontal: SPACING.xl,
    paddingVertical: SPACING.md,
    borderRadius: 24,
    marginBottom: SPACING.md,
  },
  buttonText: {
    color: '#FFFFFF',
    fontSize: FONTS.sizes.md,
    fontWeight: '600',
  },
  helpText: {
    fontSize: FONTS.sizes.sm,
    color: LOWES_THEME.textSubtle,
    textAlign: 'center',
  },
});
