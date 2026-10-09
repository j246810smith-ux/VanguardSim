# Card Implementation Tracker
## VG-BT01 through VG-BT17

Claude must maintain a machine-readable card completion state for every card.

Minimum states:
- discovered
- imported
- officially_verified
- effect_implemented
- image_verified
- tested
- complete
- needs_review

A card cannot be `complete` unless official verification, effect implementation, image handling and tests are complete.

Recommended machine-readable fields:

```json
{
  "cardId": "BT01-001",
  "set": "VG-BT01",
  "data": true,
  "officialVerified": true,
  "effectImplemented": true,
  "imageVerified": true,
  "testsPassed": true,
  "complete": true,
  "needsReview": false
}
```

Claude should generate reports for:
- total cards
- verified cards
- implemented cards
- tested cards
- image-complete cards
- incomplete cards
- unresolved source conflicts

Suggested commands:
- `npm run cards:validate`
- `npm run cards:report`
- `npm run cards:missing`
- `npm run cards:unverified`
- `npm run cards:tests`

Adapt commands to the actual project.
