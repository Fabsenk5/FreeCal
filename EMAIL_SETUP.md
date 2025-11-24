# 📧 EMAIL NOTIFICATIONS SETUP GUIDE

## 🎯 Current Status: Browser Notifications ACTIVE

Your app currently uses **browser notifications** which work immediately without server setup!

### ✅ What Works Now:
- Browser push notifications
- Toast messages (orange/blue notifications in app)
- Welcome dialog for new users
- Helpful descriptions on all actions

---

## 📱 **EASIEST OPTION: Browser Notifications** (Already Setup!)

### How It Works:
1. User opens FreeCal for first time
2. Welcome dialog appears with app tour
3. Last step asks: "Enable notifications?"
4. User clicks "Yes" → Gets browser notifications

### What Users Get Notified About:
- ✅ Relationship requests received
- ✅ Event invitations
- ✅ Account approved
- ✅ Event updates

### Pros:
- ✅ Works immediately
- ✅ No server setup needed
- ✅ Free forever
- ✅ Works on iOS when added to home screen

### Cons:
- ⚠️ Only works when app is open
- ⚠️ No email backup

---

## 📧 **UPGRADE OPTION: Real Email Notifications**

If you want actual emails (recommended for admin notifications), here are 3 options:

### **Option 1: Supabase Built-in (Easiest)** ⭐
**Setup Time**: 10 minutes  
**Cost**: Free (included in Supabase)

**What You Get**:
- ✅ Account creation emails (already working)
- ✅ Password reset emails
- ❌ Custom event notifications (needs Edge Functions)

**How to Enable Custom Emails**:
1. Go to Supabase Dashboard → Authentication → Email Templates
2. Customize existing templates
3. Add custom SMTP server (optional, uses Supabase default)

**Limitations**: Can't send relationship request emails without Edge Functions

---

### **Option 2: Supabase Edge Functions** ⭐⭐ (Recommended)
**Setup Time**: 30 minutes  
**Cost**: Free up to 500K invocations/month

**What You Get**:
- ✅ All notifications via email
- ✅ Custom email templates
- ✅ Admin notifications on new signups
- ✅ Relationship request emails

**Setup Steps**:
```bash
# 1. Install Supabase CLI
npm install -g supabase

# 2. Create Edge Function
supabase functions new send-email

# 3. Deploy
supabase functions deploy send-email
```

**Code Already Prepared**: Check `src/lib/notifications.ts`

---

### **Option 3: External Email Service** ⭐⭐⭐ (Most Reliable)
**Setup Time**: 20 minutes  
**Cost**: Free tier available

**Services**:
- **SendGrid**: 100 emails/day free
- **Resend**: 3,000 emails/month free (recommended!)
- **Mailgun**: 5,000 emails/month free

**Resend Setup** (Easiest):
```bash
# 1. Sign up at resend.com
# 2. Get API key
# 3. Add to .env:
RESEND_API_KEY=re_xxxxx

# 4. Install package
npm install resend

# 5. Create API route to send emails
```

**Code Example**:
```typescript
import { Resend } from 'resend';

const resend = new Resend('your_api_key');

await resend.emails.send({
  from: 'FreeCal <noreply@freecal.app>',
  to: user.email,
  subject: 'New Relationship Request',
  html: '<p>Someone wants to connect!</p>'
});
```

---

## 🎯 **RECOMMENDED FOR YOU** (Family of 4-10 people)

### **Week 1**: Use Browser Notifications (Already Working!) ✅
- No setup needed
- Test with family
- See if it's enough

### **Week 2**: Add Resend for Admin Emails
- Sign up for Resend (free)
- Get notified when new users sign up
- Estimated time: 20 minutes
- Cost: $0/month

### **Later** (Optional): Full Email System
- Add Edge Function for all notifications
- Fully automated email system
- Only if family wants email notifications

---

## 🚀 **QUICK START: Enable Admin Email Notifications**

### Using Resend (Recommended):

**1. Sign up** (2 min):
- Go to https://resend.com
- Sign up with your email
- Verify email

**2. Get API Key** (1 min):
- Dashboard → API Keys
- Create new key
- Copy key

**3. Add to Supabase** (5 min):
- Supabase Dashboard → Edge Functions → Secrets
- Add: `RESEND_API_KEY = your_key`

**4. Deploy Function** (10 min):
```bash
# Install CLI
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref eeaf921a-3e9

# Deploy
supabase functions deploy send-email
```

**5. Test** (2 min):
- Have someone sign up
- You should get an email!

---

## 📋 **EMAIL NOTIFICATION TYPES**

### Currently Implemented (Browser Only):
- [x] Welcome dialog for new users
- [x] Toast notifications for all actions
- [x] Helpful descriptions on success/error

### Ready to Enable (Email):
- [ ] Admin: New user signup
- [ ] User: Account approved
- [ ] User: Relationship request received
- [ ] User: Event invitation

### Future (Optional):
- [ ] Weekly calendar summary
- [ ] Upcoming events reminder
- [ ] Free time suggestions

---

## ❓ **FAQ**

**Q: Do I need email notifications?**  
A: No! Browser notifications work great for 4-10 people. Add emails later if needed.

**Q: Will users get spammed?**  
A: No. Notifications are minimal and helpful (relationship requests, approvals).

**Q: What about privacy?**  
A: All emails sent through Resend/Supabase are private. No tracking, no ads.

**Q: How much does it cost?**  
A: Browser notifications: FREE forever  
   Resend emails: FREE up to 3,000/month (plenty for 10 people)

**Q: Can users opt out?**  
A: Yes! They can disable browser notifications in settings.

---

## 🎉 **SUMMARY**

✅ **Browser notifications**: Already working! (Free, no setup)  
✅ **Toast messages**: Beautiful orange/blue notifications (Working!)  
✅ **Welcome dialog**: Guides new users (Working!)  

📧 **Email notifications**: Optional upgrade (20 min setup)  
   - Recommended for admin notifications  
   - Use Resend (free tier)  
   - Full code ready in `src/lib/notifications.ts`

**Bottom Line**: You're good to go! Add emails later if you want them.
