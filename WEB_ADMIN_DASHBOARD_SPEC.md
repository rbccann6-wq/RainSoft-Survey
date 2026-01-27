# Web Admin Dashboard Specification

## Overview
Web-based admin dashboard for managing the RainSoft survey kiosk system. Optimized for desktop browsers with responsive design for tablets.

## Backend Connection
The web dashboard will connect to the **same OnSpace Cloud backend** as the mobile app:
- **Backend URL**: `https://tdfjynmyrffnidnjtdfj.backend.onspace.ai`
- **Database**: All tables already exist and are shared with mobile app
- **Authentication**: Same user authentication system
- **Real-time Sync**: Changes made on web dashboard instantly reflect in mobile app

## Technology Stack Recommendation
- **Framework**: React (Next.js or Vite)
- **UI Library**: Material-UI or Ant Design
- **Data Grid**: AG-Grid or TanStack Table
- **Charts**: Recharts or Chart.js
- **Calendar**: FullCalendar
- **Backend Client**: `@supabase/supabase-js`

---

## Core Features

### 1. Dashboard Overview
**Route**: `/dashboard`

**Layout**:
- Top Stats Bar (4 metrics in row)
- Live Activity Feed (left 60%)
- Quick Actions Panel (right 40%)

**Components**:

#### Top Stats Cards
```typescript
interface DashboardStats {
  activeSurveyors: number; // Currently clocked in
  todaySurveys: number; // All surveys today
  todayAppointments: number; // Appointments set today
  avgSurveysPerHour: number; // Team average
}
```

#### Live Activity Feed
- Real-time employee clock in/out events
- Survey submissions
- Appointment creations
- Time-off requests
- Auto-refresh every 30 seconds

#### Quick Actions
- Clock Status: List of who's clocked in/out
- Late Alerts: Employees late for shifts
- Pending Reviews: Duplicates awaiting review
- Sync Status: Last sync times for Salesforce/Zapier/ADP

---

### 2. Survey Management
**Route**: `/surveys`

**Features**:
- Advanced filtering sidebar
  - Date range picker
  - Store filter (Lowes/Home Depot/specific locations)
  - Category filter (Renter/Survey/Appointment)
  - Employee filter
  - Sync status (synced/pending/failed)
  - Duplicate status
- Search bar (customer name, phone, address)
- Data table with columns:
  - ID
  - Employee Name
  - Store Location
  - Customer Name
  - Phone Number
  - Category
  - Timestamp
  - Sync Status (Salesforce/Zapier)
  - Actions (View/Delete/Re-sync)
- Bulk actions:
  - Select multiple surveys
  - Bulk delete
  - Bulk re-sync to Salesforce
  - Export to CSV/Excel
- Pagination (50 per page)
- Column sorting
- Column visibility toggle

**Survey Detail Modal**:
```typescript
interface SurveyDetail {
  // Survey Info
  id: string;
  timestamp: string;
  employee: Employee;
  store: StoreLocation;
  
  // Customer Info
  customerName: string;
  phone: string;
  email?: string;
  
  // All Survey Answers (11 questions)
  answers: Record<string, any>;
  
  // Appointment (if applicable)
  appointment?: {
    address: string;
    date: string;
    time: string;
    notes?: string;
  };
  
  // Signature
  signatureDataUrl: string;
  
  // Sync Status
  syncedToSalesforce: boolean;
  salesforceSyncedAt?: string;
  syncedToZapier: boolean;
  zapierSyncedAt?: string;
  
  // Duplicate Info
  isDuplicate: boolean;
  duplicateOf?: string; // Survey ID
}
```

**Actions**:
- View full survey details
- Download survey as PDF
- Re-sync to Salesforce (with retry logic)
- Mark as reviewed (for duplicates)
- Delete survey (with confirmation)

---

### 3. Employee Management
**Route**: `/employees`

**Layout**:
- Employee directory table
- Employee detail panel (slides in from right)

**Table Columns**:
- Photo
- Name
- Email
- Phone
- Role
- Status (Active/Terminated/Invited)
- Hire Date
- Onboarding Status
- Actions

**Employee Detail Panel**:
```typescript
interface EmployeeDetail {
  // Basic Info
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: 'surveyor' | 'admin' | 'manager';
  status: 'active' | 'terminated' | 'invited';
  hireDate: string;
  profilePictureUri?: string;
  
  // Onboarding
  onboardingComplete: boolean;
  onboardingStep: number; // 0-6
  documents: Document[];
  
  // Performance
  totalSurveys: number;
  totalAppointments: number;
  avgSurveysPerHour: number;
  
  // Schedule & Time
  availability: WeeklyAvailability;
  upcomingShifts: Schedule[];
  totalHoursWorked: number;
  
  // Documents
  w4: DocumentStatus;
  i9: DocumentStatus;
  directDeposit: DocumentStatus;
  backgroundCheck: DocumentStatus;
  driversLicense: DocumentStatus;
}
```

**Actions**:
- Invite new employee (send email with onboarding link)
- View/download employee documents
- Edit employee info
- Change role/permissions
- View performance metrics
- View time tracking history
- **Terminate employee** (prominent red button):
  - Confirmation modal with checklist
  - Deletes future shifts
  - Marks as terminated
  - Preserves all historical data/documents
  - Removes access to app

**New Employee Workflow**:
1. Click "Invite Employee"
2. Enter email, first name, last name, role
3. System generates unique invite token
4. Sends email with onboarding link
5. Employee completes onboarding on mobile
6. Admin can track progress in real-time

---

### 4. Advanced Scheduling
**Route**: `/schedule`

**Layout**:
- Calendar view switcher (Day/Week/Month)
- Employee filter sidebar
- Store location filter
- Unscheduled employees panel

**Calendar Features**:
- Drag-and-drop shift creation
- Drag-and-drop shift reassignment
- Visual indicators:
  - Employee availability (green/yellow/red)
  - Time-off requests (gray striped)
  - Shift conflicts (red border)
  - Store assignment (Lowes blue/Home Depot orange)
- Click shift to edit:
  - Start/end time
  - Store location
  - Notes
- Right-click for quick actions:
  - Duplicate shift
  - Delete shift
  - Assign to another employee

**Multi-Day Scheduling**:
- Select employee
- Click "Create Recurring Shift"
- Modal:
  - Date range picker
  - Days of week checkboxes
  - Time range
  - Store selection
  - Preview list of all shifts to be created
- Batch create with one click

**Availability Overlay**:
- Toggle "Show Availability"
- Calendar cells show employee availability colors:
  - Dark green: Available and preferred
  - Light green: Available
  - Yellow: Partial availability
  - Red: Not available
  - Gray: Time-off requested/approved

**Conflict Detection**:
- Highlights scheduling conflicts:
  - Double-booked employees
  - Shifts during requested time-off
  - Shifts outside employee availability
- Shows warning icon on conflicting shifts
- Batch conflict report

**Export**:
- Export schedule to PDF (week/month view)
- Export to CSV
- Print schedule for posting

---

### 5. Team Messaging & Alerts
**Route**: `/messages`

**Layout**:
- Left sidebar: Conversation list
- Center: Message thread
- Right panel: Group/user info

**Conversation List**:
- Search conversations
- Filter: All/Group/Direct
- Unread badge counts
- Last message preview
- Timestamp

**Message Thread**:
- Message bubbles (admin vs. employee)
- Timestamp on each message
- Read receipts (checkmarks with count)
- Reaction bubbles (emoji counts)
- Typing indicators
- Send message box with:
  - Text input
  - Emoji picker
  - File attachment
  - Send button

**Group Messages**:
- Create group message modal:
  - Recipient selector (multi-select employees)
  - "Select All" option
  - Role filter (surveyors only, etc.)
  - Preview recipient count
- Group conversation shows:
  - List of participants
  - Who has read (expandable list)
  - Who has reacted

**Individual Messages**:
- Search employees
- Click to open 1-on-1 conversation
- Full message history

**Push Notifications**:
- Send notification with message checkbox
- Notification preview before sending

---

### 6. Alert Broadcast System
**Route**: `/alerts`

**Create Alert Modal**:
```typescript
interface Alert {
  title: string; // Max 50 chars
  message: string; // Max 500 chars
  priority: 'low' | 'medium' | 'high' | 'urgent';
  recipients: 'all' | 'role' | 'custom';
  customRecipients?: string[]; // Employee IDs
  expiresAt?: string; // Optional expiry
  pushNotification: boolean; // Send push to phones
}
```

**Priority Levels**:
- **Low**: Blue, no special styling
- **Medium**: Yellow, bold title
- **High**: Orange, bold + exclamation icon
- **Urgent**: Red, flashing border + sound notification

**Alert Dashboard**:
- Active alerts list
- Expired alerts (archived)
- Alert analytics:
  - Delivery status per employee
  - Read status per employee
  - Dismissed status per employee
- Resend alert option
- Delete alert option

---

### 7. Duplicate Management
**Route**: `/duplicates`

**Layout**:
- Queue of duplicate surveys (left list)
- Side-by-side comparison panel (right)

**Duplicate Queue**:
- Filters:
  - Date range
  - Employee
  - Store
  - Review status (pending/reviewed)
- Sort by:
  - Most recent
  - Customer name
  - Phone number

**Comparison Panel**:
```typescript
interface DuplicateComparison {
  newSurvey: Survey; // Just submitted
  existingSurvey: Survey; // Found in Salesforce
  
  differences: {
    field: string;
    newValue: any;
    existingValue: any;
  }[];
  
  matchScore: number; // 0-100
  matchReasons: string[]; // "Same phone", "Same address", etc.
}
```

**Review Actions**:
1. **Accept New Survey**:
   - Marks existing as outdated
   - Syncs new survey to Salesforce
   - Updates existing record
2. **Reject New Survey**:
   - Marks as duplicate
   - Does not sync
   - Archives new survey
3. **Keep Both**:
   - Creates separate Salesforce records
   - Marks as reviewed
4. **View Full Details**:
   - Opens both surveys in detail modals
   - Shows all fields side-by-side

**Batch Review**:
- Select multiple duplicates
- Apply same action to all selected

---

### 8. Sync Dashboard
**Route**: `/sync`

**Layout**:
- Service status cards (Salesforce, Zapier, ADP)
- Recent sync logs table
- Manual sync triggers

**Service Status Cards**:
```typescript
interface ServiceStatus {
  name: 'Salesforce' | 'Zapier' | 'ADP';
  status: 'connected' | 'error' | 'syncing';
  lastSyncAt: string;
  pendingItems: number;
  failedItems: number;
  syncFrequency: string; // "Every 5 minutes"
}
```

**Sync Logs Table**:
- Columns:
  - Timestamp
  - Service
  - Item Type (Survey/Appointment/Time Entry)
  - Status (Success/Failed)
  - Error Message
  - Retry Count
- Filter by:
  - Service
  - Status
  - Date range
- Search by error message

**Manual Sync**:
- "Sync Now" buttons for each service
- Batch retry failed items
- Force re-sync all pending
- Clear sync queue

**Sync Configuration** (if needed):
- Salesforce field mappings (existing page)
- Zapier webhook URL
- ADP credentials
- Sync frequency settings

---

### 9. Field Mapping Configuration
**Route**: `/settings/field-mapping`

**Purpose**: Map app survey fields to Salesforce/Zapier fields

**Layout**:
- Two-column mapping table
  - Left: App Field Name
  - Right: Salesforce Field Name (editable)
- Object type tabs (Lead, Appointment)
- Save/Reset buttons

**Example Mappings**:
```typescript
interface FieldMapping {
  appField: string; // "answers.homeowner"
  salesforceField: string; // "Homeowner__c"
  objectType: 'lead' | 'appointment';
  dataType: 'text' | 'number' | 'boolean' | 'date';
}
```

**Pre-configured Defaults**:
- Customer Name → Full_Name__c
- Phone → Phone
- Email → Email
- Homeowner → Homeowner__c
- Store → Store_Location__c
- Surveyor → Surveyor__c (employee alias)
- etc.

**Validation**:
- Check field exists in Salesforce
- Warn on data type mismatches
- Preview sync before saving

---

### 10. Survey Outcome Statistics
**Route**: `/statistics`

**Features**:
- Employee performance leaderboard
- Survey outcome breakdowns (Bad Contact, Dead, Still Contacting, Install)
- Date range filters
- Export to Excel

**Data Table**:
```typescript
interface EmployeeStatsRow {
  employeeId: string;
  employeeName: string;
  totalSurveys: number;
  badContact: number;
  dead: number;
  stillContacting: number;
  install: number;
  conversionRate: number; // Install / Total
  period: string; // "Last 7 days", "Last 30 days", etc.
}
```

**Charts**:
- Stacked bar chart: Outcomes by employee
- Pie chart: Overall outcome distribution
- Line chart: Trend over time
- Conversion funnel: Survey → Still Contacting → Install

**Filters**:
- Date range
- Employee
- Store location
- Period preset (7 days, 30 days, all time)

---

### 11. Onboarding Manager
**Route**: `/onboarding`

**Features**:
- Track onboarding progress for all invited employees
- View submitted documents
- Review and approve documents
- Send reminders to incomplete employees

**Table Columns**:
- Employee Name
- Invite Sent Date
- Progress (0-100%)
- Current Step
- Documents Status
- Actions

**Document Review Panel**:
- View uploaded documents (W4, I9, etc.)
- View signatures
- Approve/Reject
- Download PDFs
- Request corrections

**Reminders**:
- Auto-reminder after 48 hours no progress
- Manual reminder button
- Reminder history log

---

### 12. Analytics & Reporting
**Route**: `/analytics`

**Report Types**:

1. **Employee Performance Report**:
   - Surveys per hour by employee
   - Appointment conversion rates
   - Time worked vs. surveys completed
   - Quota achievement trends

2. **Store Performance Report**:
   - Compare Lowes vs. Home Depot
   - Best performing locations
   - Peak survey times

3. **Compensation Report**:
   - Total hours worked
   - Base pay calculations
   - Bonus calculations (surveys + appointments)
   - Pay period summaries

4. **Sync Health Report**:
   - Success/failure rates by service
   - Average sync time
   - Error frequency analysis

**Export Options**:
- PDF (formatted report)
- Excel (raw data)
- CSV (for external processing)

---

### 13. Settings & Configuration
**Route**: `/settings`

**Tabs**:

#### General Settings
- Company name
- Logo upload
- Timezone
- Date/time format

#### Store Locations
- Add/edit/delete store locations
- Store GPS coordinates
- Store hours
- Store contact info

#### Compensation Settings
```typescript
interface CompensationSettings {
  baseHourlyRate: number;
  surveyInstallBonus: number;
  appointmentInstallBonus: number;
  quota: number; // Surveys per hour target
}
```

#### Survey Questions
- View current survey questions
- (Future: Edit questions, add/remove, reorder)

#### User Management
- Admin user list
- Add/remove admin access
- Role permissions

#### Integrations
- Salesforce: Connection status, credentials
- Zapier: Webhook URL, test connection
- ADP: API credentials, sync settings
- Google Maps: API key for address lookup

#### Notifications
- Email notification preferences
- Push notification settings
- SMS settings (if implemented)

---

## Responsive Design Requirements

### Desktop (≥1024px)
- Full multi-column layouts
- Sidebar navigation
- Data tables with all columns
- Side panels for details
- Keyboard shortcuts

### Tablet (768px - 1023px)
- Collapsible sidebar
- 2-column layouts
- Horizontal scrolling on tables
- Modals for detail views
- Touch-optimized controls

### Mobile (< 768px)
- Bottom navigation
- Single column layouts
- Card-based lists instead of tables
- Full-screen modals
- Hamburger menu

---

## Authentication & Permissions

### Login
- Same credentials as mobile app
- Email + password
- "Remember me" checkbox
- Password reset flow

### Roles & Permissions
```typescript
type Permission = 
  | 'view_all_surveys'
  | 'delete_surveys'
  | 'manage_employees'
  | 'terminate_employees'
  | 'manage_schedule'
  | 'send_messages'
  | 'send_alerts'
  | 'view_analytics'
  | 'manage_settings'
  | 'review_duplicates'
  | 'manage_integrations';

const RolePermissions: Record<Role, Permission[]> = {
  admin: ['all permissions'],
  manager: [
    'view_all_surveys',
    'manage_schedule',
    'send_messages',
    'send_alerts',
    'view_analytics',
    'review_duplicates',
  ],
  surveyor: [], // Mobile app only, no web access
};
```

---

## API Integration Guide

### Setup
```javascript
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://tdfjynmyrffnidnjtdfj.backend.onspace.ai',
  'SUPABASE_ANON_KEY' // Same key from mobile app
);
```

### Common Queries

**Get all surveys with employee info:**
```javascript
const { data: surveys } = await supabase
  .from('surveys')
  .select(`
    *,
    employee:employees(firstName, lastName, email)
  `)
  .order('timestamp', { ascending: false })
  .limit(100);
```

**Get employee with stats:**
```javascript
const { data: employee } = await supabase
  .from('employees')
  .select(`
    *,
    surveys(count),
    time_entries(clockIn, clockOut)
  `)
  .eq('id', employeeId)
  .single();
```

**Real-time subscription:**
```javascript
const subscription = supabase
  .channel('surveys')
  .on('postgres_changes', 
    { event: 'INSERT', schema: 'public', table: 'surveys' },
    (payload) => {
      // New survey submitted
      console.log('New survey:', payload.new);
    }
  )
  .subscribe();
```

---

## Performance Optimization

### Data Loading
- Paginate large lists (100 items per page)
- Virtual scrolling for 1000+ rows
- Lazy load detail panels
- Cache frequently accessed data

### Real-time Updates
- Debounce real-time subscriptions
- Batch updates to UI
- Use optimistic updates for user actions
- Background sync every 30 seconds

### Bundle Size
- Code split by route
- Lazy load charts/heavy components
- Tree-shake unused libraries
- Compress images/assets

---

## Deployment Checklist

1. **Environment Variables**:
   - `VITE_SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY` or `NEXT_PUBLIC_SUPABASE_ANON_KEY`

2. **Build Settings**:
   - Node version: 18+
   - Build command: `npm run build`
   - Output directory: `dist` or `build` or `.next`

3. **OnSpace Deployment**:
   - One-click deploy from dashboard
   - Custom domain support
   - Automatic HTTPS
   - CDN caching

4. **Testing**:
   - Test with same backend as mobile app
   - Verify data sync between web and mobile
   - Test all CRUD operations
   - Test real-time subscriptions

---

## Next Steps

1. **Create Web Project**:
   - Go to OnSpace homepage
   - Click "WEBSITE" tab
   - Select "React" stack
   - Name: "RainSoft Admin Dashboard"

2. **Copy Environment Variables**:
   - Use same `SUPABASE_URL` and `SUPABASE_ANON_KEY`
   - Add any additional API keys (Google Maps, etc.)

3. **Start Building**:
   - Begin with authentication + dashboard overview
   - Then build feature by feature following this spec
   - Test each feature with real data from mobile app

4. **Coordinate Development**:
   - Both projects share same database
   - Changes to database schema affect both
   - Keep mobile and web features in sync

---

## Support & Resources

- **Database Schema**: Already created in mobile app
- **API Documentation**: Supabase auto-generated docs
- **Component Examples**: Material-UI or Ant Design docs
- **Real-time Guide**: Supabase Realtime documentation

**Questions? Need Help?**
- All database tables, RLS policies, and Edge Functions are ready
- Backend is fully configured and tested
- Mobile app provides reference implementation for all data operations
