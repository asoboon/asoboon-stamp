# ASOQUEST v7 QA

## Verified
- [x] Staging page HTTP 200
- [x] WebP base layer HTTP 200
- [x] 0/6 renders incomplete vehicle
- [x] WHEEL adds both wheels
- [x] HEADLIGHT aligns to both lamp apertures
- [x] GRILLE aligns to front opening
- [x] FIN aligns to rear quarter
- [x] ENGINE acquisition FX
- [x] KEY acquisition FX
- [x] 6/6 shows MACHINE READY / UNLOCKED
- [x] Complete FX remains readable over vehicle
- [x] 0/6 → ENGINE START shows「まだ足りない！ あと6こ あつめよう！」
- [x] 6/6 → ENGINE START shows IGNITION! / ASOQUEST CLEAR!
- [x] Progress is localStorage-only
- [x] Storage key is Japan-date scoped
- [x] Existing /asoquest/ remains untouched during v7 staging
- [x] Existing stamp rally / production home untouched
- [x] No manufacturer emblem / crest / logo added

## Before production promotion
- [ ] Review on actual iPhone inside LINE client
- [ ] Review on at least one Android device
- [ ] Verify NFC launches the same LINE browser/storage context used by QR
- [ ] Confirm seven physical station placements
- [ ] Replace staging path /asoquest-v7/ with final /asoquest/
- [ ] Burn final production NFC URLs only after final path is locked
