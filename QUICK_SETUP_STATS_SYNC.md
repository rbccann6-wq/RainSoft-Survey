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

### 2. Employee Aliases (Auto-Generated ✨)

**No manual setup required!** Employee aliases are automatically generated when employees are added:

**Alias Format:** First 2 letters of first name + Full last name

**Examples:**
- John Doe → `JoDoe`
- Jane Smith → `JaSmith`
- Michael Johnson → `MiJohnson`

**This same alias is used when:**
- ✅ Syncing surveys to Salesforce (Surveyor field)
- ✅ Syncing appointments to Salesforce (Surveyor field)
- ✅ Matching stats back from Salesforce reports

**Result:** Perfect automatic matching with zero configuration needed!

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

The sync uses **auto-generated aliases** to match Salesforce "Surveyor" field to employees:

### Alias Format (Automatic)
**First 2 letters of first name + Full last name**

**Examples:**
- John Doe → `JoDoe`
- Jane Smith → `JaSmith`
- Michael Johnson → `MiJohnson`
- Sarah Williams → `SaWilliams`

### How It Works
1. **Employee Created** → Alias auto-generated (e.g., John Doe → JoDoe)
2. **Survey Submitted** → Synced to Salesforce with Surveyor = "JoDoe"
3. **Salesforce Processing** → Lead/Appointment status updated
4. **Stats Sync** → Reads Salesforce report: Surveyor = "JoDoe"
5. **Automatic Match** → "JoDoe" → John Doe's stats updated

### ✅ Key Benefits
- **Zero configuration** - Aliases generated automatically
- **100% consistent** - Same alias everywhere (surveys, appointments, stats)
- **Case-insensitive** - "JoDoe" = "jodoe" = "JODOE"
- **Self-correcting** - If name changes, alias updates automatically

### ⚠️ Troubleshooting Unmatched Surveyors

If you see `"No employee found for Surveyor: 'XYZ'"` in logs:

**Likely Causes:**
1. **Old survey data** with different alias format
2. **Manually edited** Surveyor field in Salesforce
3. **Employee deleted** from system

**Solution:**
- Check employee name matches Salesforce Surveyor format
- Verify employee exists in system
- Re-sync surveys to update Surveyor field format

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
