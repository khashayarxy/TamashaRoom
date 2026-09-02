# Production Smoke Test Checklist

Run after every deployment to tamasharoom.ir

## Automated Checks
- [ ] `curl https://tamasharoom.ir/api/health` returns 200 OK
- [ ] Sentry dashboard shows no new errors in last 5 minutes
- [ ] UptimeRobot shows green status

## Manual Checks (Browser)
- [ ] Landing page loads (< 3s)
- [ ] Can register new account
- [ ] Can create room
- [ ] Can join room via code
- [ ] Video plays without buffering
- [ ] Chat messages send/receive in real-time
- [ ] Subtitle upload works (SRT/VTT)
- [ ] Room lock toggle works
- [ ] Owner can delete other's messages
- [ ] Report message flow works
- [ ] Logout works

## Mobile Checks (Real Device)
- [ ] Site loads on Chrome Mobile
- [ ] Video fullscreen works (landscape lock)
- [ ] Chat input visible above keyboard
- [ ] Tap-to-play works on first load

## Performance Checks
- [ ] Lighthouse score > 90 (Performance)
- [ ] No console errors in DevTools
- [ ] Network tab shows no failed requests (except expected 404s)

## Post-Test
- If all pass: Mark deployment as successful
- If any fail: Execute ROLLBACK.md procedure immediately
