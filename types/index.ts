// Type definitions
import { Store } from '@/constants/theme';

export interface Employee {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  phone: string;
  role: 'surveyor' | 'admin' | 'manager';
  status: 'active' | 'terminated' | 'invited';
  hireDate: string;
  onboardingComplete: boolean;
  onboardingStep?: number; // 0-6 for onboarding progress
  documents: EmployeeDocument[];
  availability?: WeeklyAvailability;
  adpEmployeeId?: string;
  personalInfo?: PersonalInfo;
  inviteToken?: string;
  inviteSentAt?: string;
  profilePictureUri?: string; // Profile picture URI
  isTeamLead?: boolean; // True if this employee is a team lead
  teamLeadId?: string; // ID of the team lead managing this employee
}

export interface EmployeeDocument {
  id: string;
  type: 'w4' | 'i9' | 'directDeposit' | 'backgroundCheck' | 'hiringPacket' | 'driversLicense';
  fileName: string;
  uploadedAt: string;
  signatureData?: string;
  status: 'pending' | 'completed';
}

export interface TimeEntry {
  id: string;
  employeeId: string;
  clockIn: string;
  clockOut?: string;
  store?: Store; // Generic type: "Lowes" or "Home Depot"
  storeName?: string; // Specific store: "HOME DEPOT 0808", "LOWES 1234"
  storeNumber?: string; // Store number: "0808", "1234"
  storeAddress?: string; // Full address of verified store location
  syncedToADP: boolean;
  isActiveInKiosk: boolean;
  gpsCoordinates?: {
    latitude: number;
    longitude: number;
    accuracy: number;
  };
  photoUri?: string;
  locationVerified?: boolean; // True if GPS matched to a known store
  distanceFromStore?: number; // Distance in meters from matched store
}

export interface Survey {
  id: string;
  employeeId: string;
  employeeAlias?: string; // First 2 letters first name + first 2 letters last name
  store: Store; // Generic type: "Lowes" or "Home Depot"
  storeName?: string; // Specific store: "HOME DEPOT 0808", "LOWES 1234"
  storeNumber?: string; // Store number: "0808", "1234"
  storeAddress?: string; // Full address of verified store location
  timestamp: string;
  answers: Record<string, any>;
  signature: string;
  category: 'renter' | 'survey' | 'appointment';
  appointment?: Appointment;
  syncedToSalesforce: boolean;
  syncedToZapier: boolean;
  isDuplicate?: boolean;
  duplicateReviewed?: boolean;
  duplicateInfo?: {
    recordType: 'Lead' | 'Account';
    salesforceId: string;
    salesforceUrl: string;
    matchedPhone: string;
    recordName?: string;
    recordEmail?: string;
  };
  locationVerified?: boolean; // True if GPS matched to a known store
  syncError?: string; // Error message from last sync attempt
  salesforceId?: string; // Salesforce Lead/Contact record ID
  salesforceVerified?: boolean; // True if record existence was verified
  salesforceVerifiedAt?: string; // Last verification timestamp
}

export interface Appointment {
  address: string;
  email: string;
  date: string;
  time: string;
  notes?: string;
}

export interface Schedule {
  id: string;
  employeeId: string;
  date: string;
  startTime: string;
  endTime: string;
  store: Store;
  status: 'scheduled' | 'completed' | 'missed';
}

export interface TimeOffRequest {
  id: string;
  employeeId: string;
  startDate: string;
  endDate: string;
  reason: string;
  status: 'pending' | 'approved' | 'denied';
  requestedAt: string;
}

export interface Message {
  id: string;
  senderId: string;
  senderName: string;
  recipientIds: string[]; // Empty array = group message to all
  content: string;
  timestamp: string;
  readBy: string[];
  reactions: Record<string, string[]>; // emoji -> employeeIds
  isGroupMessage: boolean;
}

export interface DayAvailability {
  available: boolean;
  startTime?: string; // e.g., "09:00"
  endTime?: string; // e.g., "17:00"
}

export interface WeeklyAvailability {
  monday: DayAvailability;
  tuesday: DayAvailability;
  wednesday: DayAvailability;
  thursday: DayAvailability;
  friday: DayAvailability;
  saturday: DayAvailability;
  sunday: DayAvailability;
}

export interface DailySurveyCounts {
  renters: number;
  surveys: number;
  appointments: number;
}

export interface PersonalInfo {
  address: string;
  city: string;
  state: string;
  zipCode: string;
  dateOfBirth: string; // Format: YYYY-MM-DD
  ssn: string; // Full SSN (encrypted in storage)
  gender?: 'male' | 'female' | 'other' | 'prefer_not_to_say'; // Optional for ADP
  emergencyContactName: string;
  emergencyContactPhone: string;
  emergencyContactRelation: string;
}

export interface CompensationSettings {
  baseHourlyRate: number; // Default: $15
  surveyInstallBonus: number; // Default: $10
  appointmentInstallBonus: number; // Default: $25
  quota: number; // Default: 5 surveys/hour
}

export interface Alert {
  id: string;
  senderId: string;
  senderName: string;
  title: string;
  message: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recipientIds: string[]; // Empty = all employees
  isGroupAlert: boolean;
  timestamp: string;
  readBy: string[];
  dismissedBy: string[];
  expiresAt?: string; // Optional expiry time
}

export interface PushNotification {
  id: string;
  type: 'message' | 'schedule' | 'alert' | 'system';
  title: string;
  body: string;
  data?: any;
  sentTo: string[]; // Employee IDs
  sentAt: string;
  deliveryStatus: Record<string, 'pending' | 'delivered' | 'failed'>;
}

export interface OnboardingData {
  employeeId: string;
  step: number; // 0-6
  personalInfo?: PersonalInfo;
  w4Signature?: string;
  w4Data?: Record<string, any>;
  i9Signature?: string;
  i9Data?: Record<string, any>;
  driversLicenseUri?: string;
  directDepositData?: Record<string, any>;
  acknowledgments: {
    falsifiedSurveys: boolean;
    equipmentReturn: boolean;
    quotaRequirement: boolean;
  };
  completedAt?: string;
}
