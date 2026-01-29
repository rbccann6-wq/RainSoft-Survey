# Quick Setup: Stats Sync is Ready! 🚀

Your Salesforce reports are created and the system is configured. Here's what to do next:

## ✅ Reports Created

- **Lead Report ID**: `00ORl00000AgKarMAF`
- **Appointment Report ID**: `00ORl00000AgL0fMAF`
- **Grouped by**: Surveyor field (employee names)
- **Status field**: Tracks Lead/Appointment statuses

---

## 📝 Next Steps

### 1. Add Report IDs to Cloud Secrets

**Go to**: Cloud Dashboard → Secrets tab → Add Secret

Add these two secrets:

```
Key: SALESFORCE_LEAD_REPORT_ID
Value: 00ORl00000AgKarMAF
```

```
Key: SALESFORCE_APPOINTMENT_REPORT_ID
Value: 00ORl00000AgL0fMAF
```

### 2. Set Employee Aliases (Important!)

**Go to**: Admin Dashboard → Employees

**For each employee:**
1. Click on employee name to edit
2. Set **Alias** field to match Salesforce Surveyor value exactly
   - Example: If Salesforce shows "JDoe", enter "JDoe"
   - If Salesforce shows "John D.", enter "John D."
   - Case-insensitive ("jdoe" = "JDoe")
3. Click **Save**

**Why?** The Salesforce Surveyor field might use nicknames, initials, or codes. The alias ensures perfect matching.

### 3. Configure Status Mappings

**Go to**: Admin Dashboard → Survey Stats Config

Map your Salesforce statuses to categories:

**Categories available**:
- **BCI** (Bad Contact Info) - Wrong numbers, disconnected
- **Dead** - Not interested, opted out
- **Still Contacting** - In progress, follow-ups
- **Install** - Closed-won, completed
- **Demo** - Demo appointments scheduled

**Example mappings**:
- Lead Status "Working - Contacted" → Still Contacting
- Lead Status "Closed - Converted" → Install
- Lead Status "Closed - Not Converted" → Dead
- Appointment Staus "Demo Scheduled" → Demo
- Appointment Staus "Installed" → Install

### 4. Test the Sync

**Go to**: Admin Dashboard → Stats Sync → Click "Run Stats Sync Now"

Expected result:
```
✓ Lead report returned X rows
✓ Appointment report returned Y rows
✓ Matched Z employee stat records
✅ Saved Z employee stat records
```

### 5. View Results

**Go to**: Admin Dashboard → Survey Outcomes

You should see employee stats broken down by:
- BCI count
- Dead count  
- Still Contacting count
- Demo count
- Install count
- Install rate %

---

## 🔍 How Employee Matching Works

The sync matches Salesforce "Surveyor" field to your employees:

### Priority 1: Alias Field (Recommended ⭐)
**Best practice**: Set the `alias` field for each employee to match their Salesforce Surveyor value exactly.

- Go to **Admin → Employees** → Edit employee
- Set **Alias** field (e.g., "JDoe", "John D", "Surveyor 5")
- **Case-insensitive** matching ("jdoe" = "JDoe" = "JDOE")

### Priority 2: Name Fallback (Automatic)
If no alias is set, the system tries:
1. **Full name**: "John Doe"
2. **Reverse name**: "Doe, John"  
3. **First name**: "John"
4. **Last name**: "Doe"
5. **Email prefix**: "john.doe" (from john.doe@example.com)

### ⚠️ Troubleshooting Unmatched Surveyors

If you see `"No employee found for Surveyor: 'XYZ'"` in logs:

**Best Solution - Set Alias (Recommended):**
- Go to Admin → Employees
- Edit employee record
- Set **Alias** field to match Salesforce Surveyor value exactly
- Save and re-run sync

**Alternative - Update Salesforce:**
- Ensure Surveyor field uses employee's full name
- Format: "First Last" or "Last, First"

---

## 📊 What Happens Next?

### Daily Automatic Sync (Future)
Stats will sync automatically at midnight daily (when scheduled job is enabled)

### Manual Sync
You can trigger sync anytime via: Admin Dashboard → Stats Sync

### Viewing Stats

**Employees see their own stats**:
- Kiosk → Statistics → Survey outcomes breakdown

**Team Leads see team stats**:
- Kiosk → Statistics → Team Stats tab

**Admins see all employee stats**:
- Admin Dashboard → Survey Outcomes
- Filter by employee, period (today/7d/30d/all time)
- Sort by install rate, install count, etc.

---

## 🎯 What Gets Synced?

### From Salesforce Reports:
- **Leads**: Grouped by Surveyor → Status → Count
- **Appointments**: Grouped by Surveyor → Staus → Count

### Stored in Database:
- Daily aggregated counts per employee
- Categories: BCI, Dead, Still Contacting, Install, Demo
- Total surveys tracked
- Last sync timestamp

### Displayed in UI:
- Individual category counts
- Total surveys
- Install rate (installs ÷ total surveys × 100)
- Team rankings and comparisons

---

## ❓ Need Help?

1. **Check sync logs**: Admin Dashboard → Stats Sync → View last sync result
2. **Verify status mappings**: Admin Dashboard → Survey Stats Config
3. **Review documentation**: See `SALESFORCE_REPORTS_SETUP.md` for detailed guide
4. **Test connection**: Admin Dashboard → Field Mapping → Test Connection

---

## ✨ You're All Set!

The stats sync system is now ready to track your survey outcomes from Salesforce. Just add the Report IDs to Cloud Secrets and configure your status mappings, then run your first sync!
