// Daily Report Edge Function
// Generates and sends daily surveyor performance reports via email and SMS
// Includes: survey stats, hours worked, inactivity time

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3';
import { corsHeaders } from '../_shared/cors.ts';

interface DailyReportSettings {
  enabled: boolean;
  emailRecipients: string[]; // Admin emails
  smsRecipients: string[]; // Admin phone numbers
  sendTime: string; // HH:MM format (e.g., "18:00" for 6 PM)
  includeSurveyStats: boolean;
  includeTimeClockData: boolean;
  includeInactivity: boolean;
  reportPeriod: 'today' | 'yesterday' | 'last_7_days';
}

interface EmployeeReport {
  employeeId: string;
  employeeName: string;
  alias?: string;
  surveyStats?: {
    bciCount: number;
    deadCount: number;
    stillContactingCount: number;
    demoCount: number;
    installCount: number;
    totalSurveys: number;
    installRate: number;
  };
  timeClockData?: {
    totalHours: number;
    shiftsCount: number;
    clockIns: Array<{ date: string; clockIn: string; clockOut?: string; store: string }>;
  };
  inactivityData?: {
    totalInactiveMinutes: number;
    inactiveCount: number;
    incidents: Array<{ date: string; duration: number; reason: string }>;
  };
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const supabaseServiceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');

    if (!supabaseUrl || !supabaseServiceKey) {
      throw new Error('Missing Supabase configuration');
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Get report settings from database or request body
    const requestBody = await req.json().catch(() => ({}));
    const manualRun = requestBody.manual === true;
    
    let settings: DailyReportSettings;
    
    if (manualRun && requestBody.settings) {
      // Manual run with custom settings
      settings = requestBody.settings;
    } else {
      // Load settings from database
      const { data: settingsData, error: settingsError } = await supabase
        .from('employees')
        .select('id')
        .limit(1)
        .single();
      
      // For now, use default settings (will be configurable via admin UI)
      settings = {
        enabled: true,
        emailRecipients: requestBody.emailRecipients || [],
        smsRecipients: requestBody.smsRecipients || [],
        sendTime: '18:00',
        includeSurveyStats: true,
        includeTimeClockData: true,
        includeInactivity: true,
        reportPeriod: requestBody.reportPeriod || 'today',
      };
    }

    if (!settings.enabled && !manualRun) {
      console.log('Daily reports disabled in settings');
      return new Response(
        JSON.stringify({ success: true, message: 'Reports disabled' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`📊 Generating daily report (Period: ${settings.reportPeriod})`);

    // Determine date range
    const now = new Date();
    let startDate: Date;
    let endDate: Date;

    switch (settings.reportPeriod) {
      case 'yesterday':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 1);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(startDate);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'last_7_days':
        startDate = new Date(now);
        startDate.setDate(now.getDate() - 7);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
        break;
      case 'today':
      default:
        startDate = new Date(now);
        startDate.setHours(0, 0, 0, 0);
        endDate = new Date(now);
        endDate.setHours(23, 59, 59, 999);
    }

    const startDateStr = startDate.toISOString().split('T')[0];
    const endDateStr = endDate.toISOString().split('T')[0];

    console.log(`  Date range: ${startDateStr} to ${endDateStr}`);

    // Get all active employees
    const { data: employees, error: employeesError } = await supabase
      .from('employees')
      .select('id, first_name, last_name, alias, status')
      .eq('status', 'active');

    if (employeesError) {
      throw new Error(`Failed to load employees: ${employeesError.message}`);
    }

    if (!employees || employees.length === 0) {
      console.log('No active employees found');
      return new Response(
        JSON.stringify({ success: true, message: 'No employees to report on' }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`  Processing ${employees.length} employees`);

    // Generate reports for each employee
    const employeeReports: EmployeeReport[] = [];

    for (const emp of employees) {
      const report: EmployeeReport = {
        employeeId: emp.id,
        employeeName: `${emp.first_name} ${emp.last_name}`,
        alias: emp.alias,
      };

      // 1. Survey Stats (from employee_survey_stats table)
      if (settings.includeSurveyStats) {
        const { data: statsData } = await supabase
          .from('employee_survey_stats')
          .select('*')
          .eq('employee_id', emp.id)
          .gte('date', startDateStr)
          .lte('date', endDateStr);

        if (statsData && statsData.length > 0) {
          // Aggregate stats across date range
          const totals = statsData.reduce(
            (acc, stat) => ({
              bciCount: acc.bciCount + (stat.bad_contact_count || 0),
              deadCount: acc.deadCount + (stat.dead_count || 0),
              stillContactingCount: acc.stillContactingCount + (stat.still_contacting_count || 0),
              demoCount: acc.demoCount + (stat.demo_count || 0),
              installCount: acc.installCount + (stat.install_count || 0),
              totalSurveys: acc.totalSurveys + (stat.total_surveys || 0),
            }),
            { bciCount: 0, deadCount: 0, stillContactingCount: 0, demoCount: 0, installCount: 0, totalSurveys: 0 }
          );

          report.surveyStats = {
            ...totals,
            installRate: totals.totalSurveys > 0 ? (totals.installCount / totals.totalSurveys) * 100 : 0,
          };
        }
      }

      // 2. Time Clock Data
      if (settings.includeTimeClockData) {
        const { data: timeEntries } = await supabase
          .from('time_entries')
          .select('id, clock_in, clock_out, store, store_name')
          .eq('employee_id', emp.id)
          .gte('clock_in', startDate.toISOString())
          .lte('clock_in', endDate.toISOString())
          .order('clock_in', { ascending: false });

        if (timeEntries && timeEntries.length > 0) {
          let totalHours = 0;
          const clockIns: Array<{ date: string; clockIn: string; clockOut?: string; store: string }> = [];

          for (const entry of timeEntries) {
            const clockIn = new Date(entry.clock_in);
            const clockOut = entry.clock_out ? new Date(entry.clock_out) : null;

            if (clockOut) {
              const hours = (clockOut.getTime() - clockIn.getTime()) / (1000 * 60 * 60);
              totalHours += hours;
            }

            clockIns.push({
              date: clockIn.toLocaleDateString(),
              clockIn: clockIn.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              clockOut: clockOut?.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
              store: entry.store_name || (entry.store === 'lowes' ? 'Lowes' : 'Home Depot'),
            });
          }

          report.timeClockData = {
            totalHours: Math.round(totalHours * 100) / 100,
            shiftsCount: timeEntries.length,
            clockIns,
          };
        }
      }

      // 3. Inactivity Data
      if (settings.includeInactivity) {
        const { data: inactivityLogs } = await supabase
          .from('inactivity_log')
          .select('detected_at, inactive_duration_minutes, current_page, notes')
          .eq('employee_id', emp.id)
          .gte('detected_at', startDate.toISOString())
          .lte('detected_at', endDate.toISOString())
          .order('detected_at', { ascending: false });

        if (inactivityLogs && inactivityLogs.length > 0) {
          const totalInactiveMinutes = inactivityLogs.reduce(
            (sum, log) => sum + (log.inactive_duration_minutes || 0),
            0
          );

          const incidents = inactivityLogs.map((log) => ({
            date: new Date(log.detected_at).toLocaleString(),
            duration: log.inactive_duration_minutes || 0,
            reason: log.notes || log.current_page || 'Unknown',
          }));

          report.inactivityData = {
            totalInactiveMinutes,
            inactiveCount: inactivityLogs.length,
            incidents,
          };
        }
      }

      // Only include employees with data
      if (report.surveyStats || report.timeClockData || report.inactivityData) {
        employeeReports.push(report);
      }
    }

    console.log(`  Generated ${employeeReports.length} employee reports`);

    // Generate email and SMS content
    const { emailBody, emailSubject } = generateEmailReport(employeeReports, settings.reportPeriod, startDateStr, endDateStr);
    const smsBody = generateSMSReport(employeeReports, settings.reportPeriod);

    // Send emails
    let emailsSent = 0;
    if (settings.emailRecipients.length > 0) {
      console.log(`📧 Sending emails to ${settings.emailRecipients.length} recipients`);
      
      for (const email of settings.emailRecipients) {
        try {
          const emailResponse = await fetch(`${supabaseUrl}/functions/v1/send-email`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: email,
              subject: emailSubject,
              body: emailBody,
              isHtml: true,
            }),
          });

          const emailResult = await emailResponse.json();
          if (emailResult.success) {
            emailsSent++;
            console.log(`  ✅ Email sent to ${email}`);
          } else {
            console.error(`  ❌ Failed to send email to ${email}:`, emailResult.error);
          }
        } catch (error) {
          console.error(`  ❌ Error sending email to ${email}:`, error);
        }
      }
    }

    // Send SMS
    let smsSent = 0;
    if (settings.smsRecipients.length > 0 && smsBody) {
      console.log(`📱 Sending SMS to ${settings.smsRecipients.length} recipients`);
      
      for (const phone of settings.smsRecipients) {
        try {
          const smsResponse = await fetch(`${supabaseUrl}/functions/v1/send-sms`, {
            method: 'POST',
            headers: {
              'Authorization': `Bearer ${supabaseServiceKey}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              to: phone,
              message: smsBody,
            }),
          });

          const smsResult = await smsResponse.json();
          if (smsResult.success) {
            smsSent++;
            console.log(`  ✅ SMS sent to ${phone}`);
          } else {
            console.error(`  ❌ Failed to send SMS to ${phone}:`, smsResult.error);
          }
        } catch (error) {
          console.error(`  ❌ Error sending SMS to ${phone}:`, error);
        }
      }
    }

    console.log(`✅ Daily report completed: ${emailsSent} emails, ${smsSent} SMS sent`);

    return new Response(
      JSON.stringify({
        success: true,
        employeeReportsGenerated: employeeReports.length,
        emailsSent,
        smsSent,
        reportPeriod: settings.reportPeriod,
        dateRange: { start: startDateStr, end: endDateStr },
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('❌ Daily report failed:', error);
    return new Response(
      JSON.stringify({
        success: false,
        error: String(error),
      }),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 500 }
    );
  }
});

// Generate HTML email report
function generateEmailReport(
  reports: EmployeeReport[],
  period: string,
  startDate: string,
  endDate: string
): { emailSubject: string; emailBody: string } {
  const periodLabel = period === 'today' ? 'Today' : period === 'yesterday' ? 'Yesterday' : 'Last 7 Days';
  const dateRange = startDate === endDate ? startDate : `${startDate} to ${endDate}`;

  const emailSubject = `📊 Daily Surveyor Report - ${periodLabel} (${dateRange})`;

  // Calculate totals
  const totals = reports.reduce(
    (acc, r) => ({
      surveys: acc.surveys + (r.surveyStats?.totalSurveys || 0),
      installs: acc.installs + (r.surveyStats?.installCount || 0),
      hours: acc.hours + (r.timeClockData?.totalHours || 0),
      inactiveHours: acc.inactiveHours + ((r.inactivityData?.totalInactiveMinutes || 0) / 60),
    }),
    { surveys: 0, installs: 0, hours: 0, inactiveHours: 0 }
  );

  let emailBody = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .header { background: #004990; color: white; padding: 20px; text-align: center; }
    .summary { background: #f5f5f5; padding: 15px; margin: 20px 0; border-radius: 8px; }
    .summary-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 15px; }
    .summary-item { text-align: center; }
    .summary-value { font-size: 28px; font-weight: bold; color: #004990; }
    .summary-label { font-size: 12px; color: #666; text-transform: uppercase; }
    .employee-card { background: white; border: 1px solid #ddd; border-radius: 8px; padding: 15px; margin: 15px 0; }
    .employee-name { font-size: 18px; font-weight: bold; color: #004990; margin-bottom: 10px; }
    .stats-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 10px; margin: 10px 0; }
    .stat-item { background: #f9f9f9; padding: 10px; border-radius: 4px; }
    .stat-label { font-size: 11px; color: #666; text-transform: uppercase; }
    .stat-value { font-size: 20px; font-weight: bold; color: #333; }
    .warning { color: #F44336; }
    .success { color: #4CAF50; }
    .footer { text-align: center; padding: 20px; color: #999; font-size: 12px; }
    table { width: 100%; border-collapse: collapse; margin: 10px 0; }
    th, td { padding: 8px; text-align: left; border-bottom: 1px solid #ddd; }
    th { background: #f5f5f5; font-weight: bold; font-size: 12px; }
    td { font-size: 13px; }
  </style>
</head>
<body>
  <div class="header">
    <h1>📊 Daily Surveyor Report</h1>
    <p>${periodLabel} - ${dateRange}</p>
  </div>

  <div class="summary">
    <h2 style="margin-top: 0;">Team Summary</h2>
    <div class="summary-grid">
      <div class="summary-item">
        <div class="summary-value">${totals.surveys}</div>
        <div class="summary-label">Total Surveys</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${totals.installs}</div>
        <div class="summary-label">Installs</div>
      </div>
      <div class="summary-item">
        <div class="summary-value">${totals.hours.toFixed(1)}</div>
        <div class="summary-label">Hours Worked</div>
      </div>
      <div class="summary-item">
        <div class="summary-value ${totals.inactiveHours > 5 ? 'warning' : ''}">${totals.inactiveHours.toFixed(1)}</div>
        <div class="summary-label">Inactive Hours</div>
      </div>
    </div>
  </div>

  <h2>Employee Details (${reports.length})</h2>
`;

  // Sort by install count descending
  const sortedReports = [...reports].sort(
    (a, b) => (b.surveyStats?.installCount || 0) - (a.surveyStats?.installCount || 0)
  );

  for (const emp of sortedReports) {
    emailBody += `
  <div class="employee-card">
    <div class="employee-name">${emp.employeeName}${emp.alias ? ` (${emp.alias})` : ''}</div>
`;

    // Survey Stats
    if (emp.surveyStats) {
      const stats = emp.surveyStats;
      emailBody += `
    <h3 style="margin: 10px 0;">📈 Survey Outcomes</h3>
    <div class="stats-grid">
      <div class="stat-item">
        <div class="stat-label">BCI</div>
        <div class="stat-value">${stats.bciCount}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Dead</div>
        <div class="stat-value">${stats.deadCount}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Still Contacting</div>
        <div class="stat-value">${stats.stillContactingCount}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Demo</div>
        <div class="stat-value">${stats.demoCount}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label success">Installs</div>
        <div class="stat-value success">${stats.installCount}</div>
      </div>
      <div class="stat-item">
        <div class="stat-label">Install Rate</div>
        <div class="stat-value">${stats.installRate.toFixed(1)}%</div>
      </div>
    </div>
    <p><strong>Total Surveys:</strong> ${stats.totalSurveys}</p>
`;
    }

    // Time Clock Data
    if (emp.timeClockData) {
      const tc = emp.timeClockData;
      emailBody += `
    <h3 style="margin: 10px 0;">⏰ Time Clock</h3>
    <p><strong>Total Hours:</strong> ${tc.totalHours} hrs | <strong>Shifts:</strong> ${tc.shiftsCount}</p>
`;
      
      if (tc.clockIns.length > 0) {
        emailBody += `
    <table>
      <thead>
        <tr>
          <th>Date</th>
          <th>Clock In</th>
          <th>Clock Out</th>
          <th>Store</th>
        </tr>
      </thead>
      <tbody>
`;
        for (const shift of tc.clockIns) {
          emailBody += `
        <tr>
          <td>${shift.date}</td>
          <td>${shift.clockIn}</td>
          <td>${shift.clockOut || '<span class="warning">Active</span>'}</td>
          <td>${shift.store}</td>
        </tr>
`;
        }
        emailBody += `
      </tbody>
    </table>
`;
      }
    }

    // Inactivity Data
    if (emp.inactivityData) {
      const ia = emp.inactivityData;
      const inactiveHours = (ia.totalInactiveMinutes / 60).toFixed(1);
      emailBody += `
    <h3 style="margin: 10px 0;">⏸️ Inactivity</h3>
    <p class="${ia.totalInactiveMinutes > 120 ? 'warning' : ''}">
      <strong>Total Inactive Time:</strong> ${inactiveHours} hrs (${ia.inactiveCount} incidents)
    </p>
`;
      
      if (ia.incidents.length > 0 && ia.incidents.length <= 5) {
        emailBody += `
    <table>
      <thead>
        <tr>
          <th>Date/Time</th>
          <th>Duration</th>
          <th>Reason</th>
        </tr>
      </thead>
      <tbody>
`;
        for (const incident of ia.incidents) {
          emailBody += `
        <tr>
          <td>${incident.date}</td>
          <td>${incident.duration} min</td>
          <td>${incident.reason}</td>
        </tr>
`;
        }
        emailBody += `
      </tbody>
    </table>
`;
      }
    }

    emailBody += `
  </div>
`;
  }

  emailBody += `
  <div class="footer">
    <p>This is an automated daily report from RainSoft Survey System</p>
    <p>Report generated at ${new Date().toLocaleString()}</p>
  </div>
</body>
</html>
`;

  return { emailSubject, emailBody };
}

// Generate SMS summary report
function generateSMSReport(reports: EmployeeReport[], period: string): string {
  const periodLabel = period === 'today' ? 'Today' : period === 'yesterday' ? 'Yesterday' : 'Last 7 Days';

  // Calculate totals
  const totals = reports.reduce(
    (acc, r) => ({
      surveys: acc.surveys + (r.surveyStats?.totalSurveys || 0),
      installs: acc.installs + (r.surveyStats?.installCount || 0),
      hours: acc.hours + (r.timeClockData?.totalHours || 0),
      inactiveHours: acc.inactiveHours + ((r.inactivityData?.totalInactiveMinutes || 0) / 60),
    }),
    { surveys: 0, installs: 0, hours: 0, inactiveHours: 0 }
  );

  let sms = `📊 Daily Report (${periodLabel})\n\n`;
  sms += `Team Summary:\n`;
  sms += `• ${totals.surveys} surveys\n`;
  sms += `• ${totals.installs} installs\n`;
  sms += `• ${totals.hours.toFixed(1)} hrs worked\n`;
  sms += `• ${totals.inactiveHours.toFixed(1)} hrs inactive\n\n`;

  // Top performers (max 3)
  const topPerformers = [...reports]
    .filter((r) => r.surveyStats && r.surveyStats.installCount > 0)
    .sort((a, b) => (b.surveyStats?.installCount || 0) - (a.surveyStats?.installCount || 0))
    .slice(0, 3);

  if (topPerformers.length > 0) {
    sms += `Top Performers:\n`;
    topPerformers.forEach((emp, i) => {
      sms += `${i + 1}. ${emp.employeeName}: ${emp.surveyStats?.installCount} installs (${emp.surveyStats?.installRate.toFixed(0)}%)\n`;
    });
  }

  return sms;
}
