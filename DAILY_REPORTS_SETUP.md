# Daily Report System Setup Guide

Automated daily reports that email and text surveyor performance stats, hours worked, and inactivity data to managers.

## 🚀 Quick Start

### 1. Configure Report Settings

**Go to**: Admin Dashboard → Daily Report Settings

**Set up:**
1. ✅ Enable Daily Reports (toggle on)
2. 📧 Add Email Recipients (manager emails)
3. 📱 Add SMS Recipients (manager phone numbers)
4. ⏰ Set Send Time (e.g., 18:00 for 6 PM)
5. 📊 Choose Report Content:
   - Survey Statistics ✓
   - Time Clock Data ✓
   - Inactivity Logs ✓
6. 📅 Select Report Period:
   - Today (default)
   - Yesterday
   - Last 7 Days

**Save Settings** → **Send Test Report Now** to verify

---

## 📊 What's Included in Reports

### Email Report (HTML formatted)
**Team Summary:**
- Total surveys completed
- Total installs
- Total hours worked
- Total inactive hours

**Individual Employee Details:**
- **Survey Outcomes**: BCI, Dead, Still Contacting, Demo, Installs, Install Rate
- **Time Clock**: Total hours, shift count, clock in/out times by date
- **Inactivity**: Total inactive time, incident count, detailed breakdown

### SMS Report (Text summary)
**Condensed format:**
- Team totals
- Top 3 performers by install count
- Key metrics only

---

## ⚙️ Edge Function Details

**Function**: `daily-report`
**Location**: `supabase/functions/daily-report/index.ts`

**What it does:**
1. Queries employee_survey_stats table for survey outcomes
2. Queries time_entries table for hours worked
3. Queries inactivity_log table for inactive time
4. Generates HTML email and SMS text
5. Sends via send-email and send-sms functions

**Manual Invocation:**
```typescript
const { data, error } = await supabase.functions.invoke('daily-report', {
  body: {
    manual: true,
    reportPeriod: 'today',
    emailRecipients: ['admin@example.com'],
    smsRecipients: ['+15551234567'],
  },
});
```

---

## 🕐 Automated Scheduling (Optional)

To enable **automatic nightly reports**, set up a Supabase cron job:

### Method 1: Supabase Dashboard (Recommended)

**Coming Soon**: Supabase native cron jobs

For now, use Method 2 or Method 3.

### Method 2: GitHub Actions (Free)

**Create**: `.github/workflows/daily-report.yml`

```yaml
name: Daily Report

on:
  schedule:
    # Run at 6 PM EST (11 PM UTC) every day
    - cron: '0 23 * * *'
  workflow_dispatch: # Allow manual trigger

jobs:
  send-report:
    runs-on: ubuntu-latest
    steps:
      - name: Send Daily Report
        run: |
          curl -X POST \
            https://[YOUR_PROJECT_REF].supabase.co/functions/v1/daily-report \
            -H "Authorization: Bearer ${{ secrets.SUPABASE_SERVICE_ROLE_KEY }}" \
            -H "Content-Type: application/json" \
            -d '{"manual":false}'
```

**Setup:**
1. Go to GitHub repo → Settings → Secrets
2. Add secret: `SUPABASE_SERVICE_ROLE_KEY`
3. Commit workflow file
4. Reports will send automatically at scheduled time

### Method 3: Zapier (No-Code)

**Steps:**
1. Create Zap: **Schedule by Zapier** → **Webhooks by Zapier**
2. Schedule: Every day at 6:00 PM
3. Webhook: POST to Edge Function URL
4. Headers: `Authorization: Bearer [SERVICE_ROLE_KEY]`
5. Body: `{"manual": false}`

### Method 4: External Cron Service

Use services like:
- **cron-job.org** (free, reliable)
- **EasyCron** (free tier available)
- **Render Cron Jobs** (if hosting elsewhere)

**Configuration:**
- **URL**: `https://[PROJECT_REF].supabase.co/functions/v1/daily-report`
- **Method**: POST
- **Headers**: 
  - `Authorization: Bearer [SERVICE_ROLE_KEY]`
  - `Content-Type: application/json`
- **Body**: `{"manual": false}`
- **Schedule**: Daily at 18:00

---

## 📧 Email Configuration

**Requirements:**
- SendGrid account (free tier: 100 emails/day)
- Verified sender email in SendGrid

**Already configured if you have:**
- `SENDGRID_API_KEY` in Cloud Secrets
- `SENDGRID_FROM_EMAIL` (default: noreply@rainsoftse.com)

**Email features:**
- HTML formatted, mobile-responsive
- Color-coded stats (warnings for high inactivity)
- Tables for shift details
- Professional branding

---

## 📱 SMS Configuration

**Requirements:**
- Twilio account (pay-as-you-go, ~$0.0075/SMS)
- Verified phone number

**Already configured if you have:**
- `TWILIO_ACCOUNT_SID` in Cloud Secrets
- `TWILIO_AUTH_TOKEN` in Cloud Secrets
- `TWILIO_PHONE_NUMBER` in Cloud Secrets

**SMS features:**
- Condensed summary format
- Top performers highlighted
- Character-optimized (<160 chars when possible)

---

## 🎯 Data Sources

### Survey Stats
**Source**: `employee_survey_stats` table
**Synced from**: Salesforce via stats-sync Edge Function
**Data**: BCI, Dead, Still Contacting, Demo, Install counts

### Time Clock
**Source**: `time_entries` table
**Logged by**: Kiosk clock in/out system
**Data**: Clock in/out times, total hours, store locations

### Inactivity
**Source**: `inactivity_log` table
**Logged by**: Activity Monitor auto-logging (>10 min inactive)
**Data**: Inactive duration, incident count, reasons

---

## 🧪 Testing the Report

### Manual Test (Immediate)

1. Go to **Admin Dashboard → Report Settings**
2. Add your email/phone to recipients
3. Click **"Send Test Report Now"**
4. Check inbox/SMS within 1 minute

### What You'll See

**Email:**
- Subject: "📊 Daily Surveyor Report - Today (2025-01-30)"
- Full HTML report with all employee data
- Team summary at top
- Individual employee cards with stats

**SMS:**
- Short text message (~100-200 chars)
- Team totals + top 3 performers
- Instant delivery

---

## 📈 Report Examples

### Email Report Preview

```
📊 Daily Surveyor Report
Today - 2025-01-30

Team Summary:
• 45 Total Surveys
• 12 Installs
• 38.5 Hours Worked
• 2.3 Inactive Hours

Employee Details:

John Doe (JoDoe)
📈 Survey Outcomes:
• BCI: 3
• Dead: 8
• Still Contacting: 15
• Demo: 4
• Installs: 5
• Install Rate: 22.7%
Total Surveys: 22

⏰ Time Clock:
Total Hours: 8.2 hrs | Shifts: 1
[Table with clock in/out times]

⏸️ Inactivity:
Total: 0.5 hrs (2 incidents)
[Table with incident details]
```

### SMS Report Preview

```
📊 Daily Report (Today)

Team Summary:
• 45 surveys
• 12 installs
• 38.5 hrs worked
• 2.3 hrs inactive

Top Performers:
1. John Doe: 5 installs (23%)
2. Jane Smith: 4 installs (20%)
3. Mike Johnson: 3 installs (18%)
```

---

## 🔧 Customization Options

### Modify Report Period

Change default period in settings:
- **Today**: Current day only (default)
- **Yesterday**: Previous day
- **Last 7 Days**: Weekly summary

### Customize Content

Toggle sections on/off:
- Survey Statistics
- Time Clock Data
- Inactivity Logs

### Adjust Send Time

Set preferred delivery time (24-hour format):
- `18:00` = 6:00 PM (after work)
- `08:00` = 8:00 AM (morning briefing)
- `12:00` = 12:00 PM (lunch update)

### Multiple Recipients

Add as many recipients as needed:
- **Emails**: Unlimited
- **SMS**: Limited by Twilio budget (~$0.0075 each)

---

## ❓ Troubleshooting

### Report Not Sending

**Check:**
1. ✅ Reports enabled in settings
2. ✅ Recipients added (email or SMS)
3. ✅ SendGrid/Twilio credentials configured
4. ✅ Edge Function deployed

**Test manually**: Use "Send Test Report Now" button

### Empty Report

**Possible causes:**
- No survey stats synced from Salesforce
- No time entries for selected period
- No inactivity logs recorded

**Solution**: Run Stats Sync, verify time clock data exists

### Email Not Received

**Check:**
1. Spam folder
2. SendGrid sender verification
3. Daily email limit (100 on free tier)
4. Edge Function logs for errors

### SMS Not Received

**Check:**
1. Phone number format (+1XXXXXXXXXX)
2. Twilio account balance
3. Twilio phone number verified
4. Edge Function logs for errors

---

## 💰 Cost Estimates

### SendGrid (Email)
- **Free Tier**: 100 emails/day
- **Cost**: $0 for typical usage
- **Paid**: $19.95/mo for 40k emails

### Twilio (SMS)
- **Cost**: ~$0.0075 per SMS
- **Example**: 5 recipients/day × 30 days = $1.13/month
- **Free Trial**: $15 credit

### Supabase Edge Functions
- **Free Tier**: 500k requests/month
- **Cost**: $0 for this use case

**Total**: ~$0-2/month depending on recipients

---

## 🚀 Next Steps

1. ✅ Configure report settings
2. ✅ Send test report
3. ✅ Verify email/SMS delivery
4. ⏰ Set up automated scheduling (optional)
5. 📊 Monitor daily reports

---

## 📞 Support

**Issues?**
- Check Edge Function logs: Cloud → Log tab
- Verify credentials: Cloud → Secrets tab
- Test connection: Report Settings → Send Test

**Questions?**
- Review this guide
- Check Salesforce sync status
- Verify time clock data exists

---

**Last Updated**: January 30, 2025
**Version**: 1.0
