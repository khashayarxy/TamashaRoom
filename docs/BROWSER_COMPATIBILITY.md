# Browser Compatibility Matrix

| Feature | Chrome | Firefox | Safari | Edge | Mobile Chrome | Mobile Safari |
|---------|--------|---------|--------|------|---------------|---------------|
| Video Playback | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| WebSocket (Pusher) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Fullscreen API | ✅ | ✅ | ⚠️ (limited) | ✅ | ✅ | ⚠️ (limited) |
| Picture-in-Picture | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| File Upload (SRT) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| RTL Layout | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |

## Known Issues
- Safari/iOS: Fullscreen requires user gesture, PiP not supported
- Mitigation: Graceful fallback to inline playback

## Testing Protocol
Run `npx playwright test` before every deploy to verify all browsers pass.
