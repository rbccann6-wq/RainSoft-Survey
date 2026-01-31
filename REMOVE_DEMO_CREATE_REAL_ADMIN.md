# Remove Demo Accounts & Create Real Admin

## Current Status

This app currently uses **demo accounts** for quick testing:
- **admin@rainsoft.com** - Demo admin account
- **surveyor@rainsoft.com** - Demo employee account

## 🚀 Steps to Create Your Real Admin Account

### Option 1: Create Admin via SQL (Recommended)

Run this SQL in **Cloud → Data → SQL Editor**:

```sql
-- Create your real admin account
INSERT INTO employees (
  email,
  first_name,
  last_name,
  phone,
  role,
  status,
  hire_date,
  onboarding_complete,
  onboarding_step,
  availability
) VALUES (
  'your.email@company.com',  -- ⚠️ CHANGE THIS to your real email
  'Your',                     -- ⚠️ CHANGE THIS to your first name
  'Name',                     -- ⚠️ CHANGE THIS to your last name
  '555-0100',                 -- ⚠️ CHANGE THIS to your phone
  'admin',                    -- Role: admin (do not change)
  'active',                   -- Status: active
  CURRENT_DATE,               -- Today's date
  true,                       -- Onboarding complete
  6,                          -- All onboarding steps done
  '{
    "monday": {"available": true, "startTime": "08:00", "endTime": "17:00"},
    "tuesday": {"available": true, "startTime": "08:00", "endTime": "17:00"},
    "wednesday": {"available": true, "startTime": "08:00", "endTime": "17:00"},
    "thursday": {"available": true, "startTime": "08:00", "endTime": "17:00"},
    "friday": {"available": true, "startTime": "08:00", "endTime": "17:00"},
    "saturday": {"available": false},
    "sunday": {"available": false}
  }'::jsonb
);
```

### Option 2: Use Admin Dashboard

1. Login with **admin@rainsoft.com** (demo account)
2. Go to **Admin → Employees**
3. Click **"+ Add Employee"**
4. Fill in your real details:
   - Email: your.email@company.com
   - First Name: Your name
   - Last Name: Your last name
   - Role: **Admin**
   - Status: **Active**
5. Save
6. Test login with your new email

---

## 🗑️ Remove Demo Accounts

**⚠️ IMPORTANT: Only do this AFTER creating your real admin account and verifying you can login!**

Run this SQL to remove demo accounts:

```sql
-- Remove demo admin account
DELETE FROM employees WHERE email = 'admin@rainsoft.com';

-- Remove demo surveyor account
DELETE FROM employees WHERE email = 'surveyor@rainsoft.com';

-- Verify demo accounts are gone
SELECT email, first_name, last_name, role 
FROM employees 
ORDER BY created_at DESC;
```

---

## 🔧 Disable Demo Data Auto-Creation

The app automatically creates demo accounts on first launch. To disable this:

### Step 1: Update `services/storageService.ts`

Find the `initializeDemoData` function (around line 1076) and replace it with:

```typescript
export const initializeDemoData = async (): Promise<void> => {
  // Demo data creation disabled - using real accounts only
  console.log('✅ Demo data creation is disabled');
  return;
};
```

### Step 2: Update `contexts/AppContext.tsx`

Remove or comment out the demo data initialization calls:

```typescript
// In initializeApp() function - remove this line:
// await StorageService.initializeDemoData();

// In login() function - remove this line:
// await StorageService.initializeDemoData();
```

---

## 📋 Checklist

- [ ] Create your real admin account (Option 1 or 2)
- [ ] Test login with your new admin email
- [ ] Verify you can access admin dashboard
- [ ] Delete demo accounts (SQL command above)
- [ ] Disable auto-creation of demo data (optional but recommended)
- [ ] Update login screen if it shows demo credentials

---

## 🔐 Login Flow After Changes

1. **Web/Mobile**: Navigate to login screen
2. **Email**: Enter your real admin email
3. **No password required** - this is email-based authentication
4. **Redirects to**: Admin dashboard

---

## ❓ Troubleshooting

**Issue**: "Cannot login with new email"

**Solution**: 
1. Check the employee exists: `SELECT * FROM employees WHERE email = 'your.email@company.com'`
2. Verify status is 'active': `UPDATE employees SET status = 'active' WHERE email = 'your.email@company.com'`
3. Clear browser cache and try again

**Issue**: "Demo accounts still appear"

**Solution**:
1. Refresh the employee list: Go to Admin → Employees
2. If they persist, run the DELETE SQL commands again
3. Check local cache - may need to logout and login again

---

**Last Updated**: January 31, 2026
