# UptimeRobot Setup Guide

UptimeRobot is a free service that can ping your backend server to prevent cold starts. This complements the GitHub Actions workflow.

## Why Both?

- **GitHub Actions**: Scheduled pings (every 10-30 min), but requires manual reactivation for private repos
- **UptimeRobot**: Independent monitoring service, works 24/7 regardless of repo visibility

Together, they provide redundancy and better uptime.

---

## Setup Instructions

### 1. Create UptimeRobot Account

1. Go to [uptimerobot.com](https://uptimerobot.com)
2. Click "Register" (free account)
3. Verify your email

### 2. Add Monitor for Backend

1. Click "+ Add New Monitor"
2. Configure settings:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: `FreeCal Backend`
   - **URL**: `https://freecal-backend.onrender.com/health`
     *(Replace with your actual Render backend URL)*
   - **Monitoring Interval**: `5 minutes` (free tier)
   - **Monitor Timeout**: `30 seconds`
   - **HTTP Method**: `GET (HEAD)`

3. Click "Create Monitor"

### 3. Optional: Add Alert Contacts

1. Go to "My Settings" → "Alert Contacts"
2. Add your email for downtime notifications
3. Configure alert threshold (e.g., notify after 2 failures)

### 4. Verify Monitor is Working

1. Dashboard should show monitor as "Up" (green)
2. Check "Events" tab for recent pings
3. Verify Response Time is <5 seconds

---

## Expected Behavior

### Normal Operation
- **Response Time**: 500ms - 2s (warm server)
- **Uptime**: 99%+ 
- **Status**: Green checkmark

### Cold Start Detection
- **Response Time**: 15-20s (first ping after inactivity)
- **Status**: May briefly show "Down" if timeout is too low
- **Recovery**: Next ping should be fast (~1s)

### Troubleshooting

#### Monitor Shows "Down"
- Check if backend URL is correct
- Verify Render service is running (check Render dashboard)
- Increase timeout to 60 seconds if cold starts are frequent

#### High Response Times (>10s consistently)
- Possible database issue (check Neon dashboard)
- Backend may need restart (check Render logs)
- Consider upgrading to paid tier

---

## Alternative Configuration (Advanced)

If you want more frequent pings to prevent ANY cold starts:

### Free Tier Workaround
Create multiple monitors with staggered intervals:

1. **Monitor 1**: Ping at `:00` (every hour)
2. **Monitor 2**: Ping at `:05` (every hour)  
3. **Monitor 3**: Ping at `:10` (every hour)
4. **Monitor 4**: Ping at `:15` (every hour)
5. **Monitor 5**: Ping at `:20` (every hour)

This gives you a ping every 5 minutes using 5 monitors (free tier allows 50).

---

## Integration with GitHub Actions

- **Daytime (8am-10pm)**: Both GitHub Actions + UptimeRobot ping
- **Nighttime (10pm-8am)**: Primarily UptimeRobot (GitHub Actions every 30 min)

This ensures:
- Render never spins down (15 min limit)
- Neon stays warm (5 min activity required)

---

## Cost Comparison

| Service | Free Tier | Paid Tier | Recommendation |
|---------|-----------|-----------|----------------|
| **UptimeRobot** | 5 min interval, 50 monitors | $7/mo for 1 min interval | Free tier sufficient |
| **GitHub Actions** | Unlimited (public repos), Limited (private) | Part of GitHub pricing | Enable for public repos |
| **Render** | Spins down after 15 min | $7/mo always-on | Consider for production |
| **Neon** | Suspends after 5 min | $19/mo never suspend | Consider if budget allows |

---

## Monitoring Dashboard Access

Share this with your team for visibility:

**UptimeRobot Public Status Page** (optional):
1. Go to "My Settings" → "Status Pages"
2. Create public status page
3. Share URL with team: `https://stats.uptimerobot.com/YOUR_PAGE`

Example: Shows real-time uptime and response times

---

## Next Steps After Setup

1. ✅ Verify monitor shows "Up" within 5 minutes
2. ✅ Check GitHub Actions workflow is running (if repo is public)
3. ✅ Wait 2-3 hours without accessing app
4. ✅ Access app and verify cold start is faster (<20s)
5. ✅ Monitor UptimeRobot for any downtime alerts

---

## Support

- **UptimeRobot Help**: https://uptimerobot.com/help/
- **GitHub Actions Docs**: https://docs.github.com/en/actions
- **Render Docs**: https://render.com/docs
