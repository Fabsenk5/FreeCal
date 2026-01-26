# Cold Start Optimizations - Deployment Guide

This document outlines the steps to deploy and verify the cold start performance improvements.

---

## 🚀 Deployment Steps

### 1. Frontend Deployment (Vercel)

The frontend changes are automatically deployed when you push to your repository. No special configuration needed.

**Changed Files:**
- `src/lib/api.ts` - Timeout and retry logic
- `src/contexts/AuthContext.tsx` - Cold start detection
- `src/components/ColdStartLoader.tsx` - Loading UI
- `vite.config.ts` - PWA offline support

**Verification:**
```bash
# Build locally first to ensure no errors
npm run build

# If successful, push to trigger deployment
git add .
git commit -m "feat: implement cold start optimizations"
git push origin main
```

---

### 2. Backend Deployment (Render)

Your backend will automatically redeploy when you push to the GitHub repository (if auto-deploy is enabled in Render).

**Changed Files:**
- `backend/src/index.ts` - Enhanced health endpoint
- `backend/src/db/connectionPool.ts` - New connection pool (⚠️ **Note below**)

**⚠️ IMPORTANT: Connection Pool Migration**

The new `connectionPool.ts` uses the `pg` library directly. You need to verify that your current `backend/src/db/index.ts` (drizzle setup) is compatible.

**Action Required:**
1. Check if `backend/src/db/index.ts` exports a working drizzle instance
2. The connection pool is for health checks only - drizzle continues to use its own connection

**Deployment:**
```bash
# Build backend locally
cd backend
npm run build

# If successful, commit and push
git add .
git commit -m "feat: backend cold start optimizations"
git push origin main
```

**Monitor Deployment:**
1. Go to Render dashboard: https://dashboard.render.com
2. Check build logs for errors
3. Wait for deployment to complete (~3-5 min)
4. Verify health endpoint: `https://your-backend.onrender.com/health`

---

### 3. GitHub Actions Setup

**⚠️ For Private Repositories:**
GitHub Actions may be disabled or have limited minutes. You mentioned it stopped because the repo is private.

**Options:**

#### Option A: Make Repository Public (Recommended for this project)
```bash
# On GitHub:
# Settings → Change repository visibility → Make public
```
✅ **Pros**: Unlimited Actions, free keep-alive  
⚠️ **Cons**: Code is visible to everyone

#### Option B: Enable Actions for Private Repo
```bash
# On GitHub:
# Settings → Actions → General → Enable Actions
# Check your Actions quota: Settings → Billing → Actions
```
✅ **Pros**: Keep repo private  
⚠️ **Cons**: Limited free minutes (2000/month)

#### Option C: Disable GitHub Actions (Use UptimeRobot only)
If you prefer to keep the repo private and don't want to use Actions minutes, just rely on UptimeRobot.

**Verify Workflow:**
1. Go to: `https://github.com/YOUR_USERNAME/FreeCal/actions`
2. Check if `Server Keep-Alive` workflow appears
3. Wait for next scheduled run (every 10-30 min)
4. Verify it succeeds (green checkmark)

---

### 4. UptimeRobot Setup

**Follow the guide:** [`UPTIMEROBOT_SETUP.md`](./UPTIMEROBOT_SETUP.md)

**Quick Steps:**
1. Sign up at https://uptimerobot.com
2. Add New Monitor:
   - **URL**: `https://your-backend.onrender.com/health`
   - **Interval**: 5 minutes
   - **Friendly Name**: FreeCal Backend
3. Verify monitor shows "Up" within 5 minutes

**Add to GitHub Secrets (Optional):**
If you want GitHub Actions to use a custom backend URL:
```bash
# On GitHub:
# Settings → Secrets and variables → Actions → New repository secret
# Name: BACKEND_URL
# Value: https://your-backend.onrender.com
```

---

## ✅ Verification Checklist

### Immediate Verification (After Deployment)

- [ ] **Frontend Build**: `npm run build` succeeds locally
- [ ] **Backend Build**: `cd backend && npm run build` succeeds
- [ ] **Vercel Deployment**: Check https://vercel.com/dashboard for successful build
- [ ] **Render Deployment**: Check https://dashboard.render.com for successful deployment
- [ ] **Health Endpoint**: Visit `https://your-backend.onrender.com/health` - should return:
  ```json
  {
    "status": "ok",
    "database": "connected",
    "uptime": 123.45,
    "responseTime": "50ms",
    "timestamp": "2026-01-26T13:00:00.000Z"
  }
  ```
- [ ] **UptimeRobot**: Monitor shows "Up" (green)
- [ ] **GitHub Actions**: Workflow runs successfully (if enabled)

### Cold Start Test (After 2-3 Hours)

- [ ] **Wait Period**: Don't access the app for 3+ hours
- [ ] **Access App**: Open the app in browser
- [ ] **Observe Behavior**:
  - ✅ Should see `ColdStartLoader` with "Waking up server..." message
  - ✅ Progress bar animates
  - ✅ Retry attempts shown (if needed)
  - ✅ Eventually loads calendar (15-25 seconds)
  - ✅ **NO unexpected logout**
- [ ] **Check Console**: Open DevTools → Console
  - Look for: `[API] Retry attempt X/3 after Xms (possible cold start)`
  - Verify no unexpected errors
- [ ] **Verify Cached Data**: If you were logged in before, you should stay logged in

### Performance Baseline

Measure and document performance:

| Scenario | Before | After | Target |
|----------|--------|-------|--------|
| **Cold Start (3+ hrs idle)** | 30s + logout | ? | 15-20s, no logout |
| **Warm Backend (< 15 min)** | 2-5s | ? | 1-2s |
| **Regular Use** | 1-2s | ? | <1s |

**How to Measure:**
1. Open DevTools → Network tab
2. Note time from page load to calendar visible
3. Check for any failed requests (should retry automatically)

---

## 🧪 Testing Scenarios

### Test 1: Normal Usage (Warm Server)
```bash
# Expected: Fast response (~1-2s), no loader
1. Access app
2. Login if needed
3. Navigate between pages
4. Observe immediate response
```

### Test 2: Cold Start Simulation
```bash
# Expected: ColdStartLoader appears, then success
1. Close all browser tabs
2. Wait 3 hours (or until next morning)
3. Access app
4. Should see ColdStartLoader
5. Wait 15-25 seconds
6. Calendar appears, still logged in
```

### Test 3: Network Timeout
```bash
# Expected: Retry logic kicks in
1. Open DevTools → Network tab
2. Set throttling to "Slow 3G"
3. Refresh page
4. Observe retry attempts in console
5. Eventually succeeds
```

### Test 4: Offline Mode (PWA)
```bash
# Expected: Cached data visible
1. Load app while online
2. Open DevTools → Application → Service Workers
3. Verify SW is active
4. Go offline (DevTools → Network → Offline)
5. Refresh page
6. Should see cached calendar data (if previously loaded)
```

---

## 🐛 Troubleshooting

### Issue: Build Fails with Import Error

**Error:**
```
Cannot find module 'pg' or corresponding type declarations
```

**Fix:**
```bash
cd backend
npm install @types/pg
npm run build
```

---

### Issue: Health Endpoint Returns 500

**Symptom:** `/health` returns error instead of status

**Check:**
1. Render logs: `https://dashboard.render.com/web/YOUR_SERVICE/logs`
2. Look for database connection errors
3. Verify `DATABASE_URL` environment variable is set

**Fix:**
- Check Neon database is active (not suspended)
- Verify connection string format: `postgresql://user:password@host/database`
- Check if database allows connections from Render IPs

---

### Issue: GitHub Actions Workflow Not Running

**Symptom:** No workflow runs visible

**Fixes:**
1. **Enable Actions**: Repo Settings → Actions → Allow all actions
2. **Check Schedule**: GitHub uses UTC time, not CET
   - Convert schedules: CET 8am = UTC 7am
3. **Manual Trigger**: Actions tab → Server Keep-Alive → Run workflow

---

### Issue: UptimeRobot Shows "Down"

**Symptom:** Monitor constantly shows red

**Checks:**
1. Verify URL is correct
2. Increase timeout to 60 seconds
3. Check Render service is running
4. Test endpoint manually: `curl https://your-backend.onrender.com/health`

**Fix:**
- If cold starts take >30s, increase UptimeRobot timeout
- Reduce monitoring interval (may trigger more cold starts initially but will stabilize)

---

### Issue: Still Getting Logged Out

**Symptom:** Cold start still causes logout

**Debug Steps:**
1. Open Console before cold start
2. Look for error messages
3. Check if error is 401 (auth failure) or timeout

**Possible Causes:**
- Token expired (check JWT expiry in backend)
- CORS issue (check backend CORS config)
- Database query failing (check backend logs)

**Fix:**
```typescript
// In AuthContext.tsx, add more logging:
console.log('Auth error:', error.response?.status, error.code);
```

---

## 📊 Monitoring

### Key Metrics to Watch

**UptimeRobot Dashboard:**
- **Uptime %**: Should be >98%
- **Avg Response Time**: 500ms-2s (warm), 15-20s (cold)
- **Down Events**: <1 per week

**Render Logs:**
```bash
# Look for:
[DATE] Performing DB keep-alive check...
[DATE] DB keep-alive check successful
```

**GitHub Actions:**
- Check "Actions" tab weekly
- Verify workflows running successfully
- Monitor for any failures

---

## 🎯 Success Criteria

Your implementation is successful when:

✅ **Cold starts complete in 15-20 seconds** (down from 30+)  
✅ **No unexpected logouts** during cold starts  
✅ **Users see friendly loading message** explaining delay  
✅ **UptimeRobot shows >95% uptime**  
✅ **GitHub Actions runs successfully** (if enabled)  
✅ **Offline mode works** (cached data visible)

---

## 📝 Post-Deployment Tasks

- [ ] Update README with cold start behavior documentation
- [ ] Share UptimeRobot status page with users (optional)
- [ ] Monitor for 1 week before considering stable
- [ ] Collect user feedback on loading experience
- [ ] Consider paid tier upgrades if performance still insufficient

---

## 💡 Future Improvements

If performance is still not meeting expectations:

1. **Upgrade Render to Paid Tier** ($7/mo)
   - Always-on instances, no spin-down
   - Faster cold starts

2. **Upgrade Neon to Pro** ($19/mo)
   - No auto-suspend, instant queries
   - Better connection pooling

3. **Implement Redis Caching**
   - Cache frequent queries
   - Reduce database load

4. **Move Auth to Vercel Edge Functions**
   - Ultra-fast auth responses
   - Independent of backend

5. **Hybrid Deployment**
   - Critical endpoints on Vercel Serverless
   - Heavy operations on Render

---

## 🆘 Need Help?

If issues persist:

1. Check Render logs: `https://dashboard.render.com/web/YOUR_SERVICE/logs`
2. Check GitHub Actions logs: `https://github.com/YOUR_REPO/actions`
3. Review UptimeRobot events: `https://uptimerobot.com/dashboard`
4. Test health endpoint: `curl -v https://your-backend.onrender.com/health`

Document any errors and review the troubleshooting section above.
