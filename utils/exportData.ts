// Data export utility for CSV generation
import { Survey, TimeEntry, Employee } from '@/types';
import { formatFullDateTime } from './timeFormat';

// Convert data to CSV format
export const convertToCSV = (data: any[], headers: string[]): string => {
  const csvRows: string[] = [];
  
  // Add header row
  csvRows.push(headers.join(','));
  
  // Add data rows
  data.forEach(row => {
    const values = headers.map(header => {
      const value = row[header];
      
      // Handle special cases
      if (value === null || value === undefined) return '';
      if (typeof value === 'object') return JSON.stringify(value).replace(/"/g, '""');
      
      // Escape quotes and wrap in quotes if contains comma
      const escaped = String(value).replace(/"/g, '""');
      return escaped.includes(',') ? `"${escaped}"` : escaped;
    });
    csvRows.push(values.join(','));
  });
  
  return csvRows.join('\n');
};

// Export surveys to CSV
export const exportSurveysToCSV = (surveys: Survey[]): string => {
  const data = surveys.map(survey => ({
    id: survey.id,
    employee_alias: survey.employeeAlias || 'N/A',
    timestamp: formatFullDateTime(survey.timestamp),
    store: survey.store === 'lowes' ? 'Lowes' : 'Home Depot',
    store_name: survey.storeName || 'N/A',
    store_number: survey.storeNumber || 'N/A',
    category: survey.category,
    
    // Contact info
    first_name: survey.answers.contact_info?.firstName || '',
    last_name: survey.answers.contact_info?.lastName || '',
    phone: survey.answers.contact_info?.phone || '',
    address: survey.answers.contact_info?.address || '',
    city: survey.answers.contact_info?.city || '',
    state: survey.answers.contact_info?.state || '',
    zip: survey.answers.contact_info?.zipCode || '',
    
    // Survey answers
    buys_bottled_water: survey.answers.buys_bottled_water || '',
    is_homeowner: survey.answers.is_homeowner || '',
    has_salt_system: survey.answers.has_salt_system || '',
    uses_filters: survey.answers.uses_filters || '',
    tastes_odors: survey.answers.tastes_odors || '',
    water_quality: survey.answers.water_quality || '',
    water_source: survey.answers.water_source || '',
    current_treatment: survey.answers.current_treatment || '',
    property_type: survey.answers.property_type || '',
    
    // Appointment info
    appointment_date: survey.appointment?.date || '',
    appointment_time: survey.appointment?.time || '',
    appointment_notes: survey.appointment?.notes || '',
    
    // Sync status
    synced_to_salesforce: survey.syncedToSalesforce ? 'Yes' : 'No',
    synced_to_zapier: survey.syncedToZapier ? 'Yes' : 'No',
    salesforce_id: survey.salesforceId || '',
    is_duplicate: survey.isDuplicate ? 'Yes' : 'No',
    location_verified: survey.locationVerified ? 'Yes' : 'No',
  }));
  
  const headers = [
    'id', 'employee_alias', 'timestamp', 'store', 'store_name', 'store_number', 'category',
    'first_name', 'last_name', 'phone', 'address', 'city', 'state', 'zip',
    'buys_bottled_water', 'is_homeowner', 'has_salt_system', 'uses_filters', 
    'tastes_odors', 'water_quality', 'water_source', 'current_treatment', 'property_type',
    'appointment_date', 'appointment_time', 'appointment_notes',
    'synced_to_salesforce', 'synced_to_zapier', 'salesforce_id', 'is_duplicate', 'location_verified',
  ];
  
  return convertToCSV(data, headers);
};

// Export time entries to CSV
export const exportTimeEntriesToCSV = (timeEntries: TimeEntry[], employees: Employee[]): string => {
  const data = timeEntries.map(entry => {
    const employee = employees.find(e => e.id === entry.employeeId);
    const clockIn = new Date(entry.clockIn);
    const clockOut = entry.clockOut ? new Date(entry.clockOut) : null;
    const hoursWorked = clockOut 
      ? ((clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60)).toFixed(2)
      : 'N/A';
    
    return {
      id: entry.id,
      employee_name: employee ? `${employee.firstName} ${employee.lastName}` : 'Unknown',
      employee_email: employee?.email || 'N/A',
      clock_in: formatFullDateTime(entry.clockIn),
      clock_out: entry.clockOut ? formatFullDateTime(entry.clockOut) : 'Still clocked in',
      hours_worked: hoursWorked,
      store: entry.store === 'lowes' ? 'Lowes' : 'Home Depot',
      store_name: entry.storeName || 'N/A',
      store_number: entry.storeNumber || 'N/A',
      store_address: entry.storeAddress || 'N/A',
      synced_to_adp: entry.syncedToADP ? 'Yes' : 'No',
      location_verified: entry.locationVerified ? 'Yes' : 'No',
      distance_from_store: entry.distanceFromStore ? `${entry.distanceFromStore}m` : 'N/A',
    };
  });
  
  const headers = [
    'id', 'employee_name', 'employee_email', 'clock_in', 'clock_out', 'hours_worked',
    'store', 'store_name', 'store_number', 'store_address',
    'synced_to_adp', 'location_verified', 'distance_from_store',
  ];
  
  return convertToCSV(data, headers);
};

// Download CSV file (web only)
export const downloadCSV = (csvContent: string, filename: string) => {
  if (typeof window === 'undefined') {
    console.warn('Download only available on web');
    return;
  }
  
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Share CSV file (mobile)
export const shareCSV = async (csvContent: string, filename: string) => {
  try {
    const { Share } = await import('react-native');
    await Share.share({
      message: csvContent,
      title: filename,
    });
  } catch (error) {
    console.error('Error sharing CSV:', error);
  }
};
