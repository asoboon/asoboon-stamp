# Board source mapping notes

## Runtime mapping

- Character source: the 40 named files in the POMPON/CHIRU manifest map to `pompon-chiru-atlas-v2.webp` through `board-character-assets.js`.
- Approved source effects: movement, impact, success, aftermath, alert, dodge, question, reaction, and anger meanings map to `pompon-chiru-effects-atlas-v2.webp`. `board-source-effects.js` may use only context-matched effects.
- Fourth wall: cracks, break frames, shards, impacts, POMPON poses, and duo poses map respectively to `fw-cracks`, `fw-frames`, `fw-shards`, `fw-impacts`, `fw-pompon`, and `fw-duo` WebP atlases.
- `source-assets-db.json` is the semantic authority. Asset filenames alone do not authorize random use.

## Event roles

- Source FX provides short neutral movement or sparkle beats and carries the largest share of idle rotation.
- POMPON cameo/story events provide understandable setup and comic failure.
- CHIRU events are reaction or correction beats; contextual poses such as watch, retort, and exasperated must follow a visible cause.
- Duo stories provide longer setup/payoff sequences and are rate-limited.
- Fourth-wall events are rare foreground stories. Their temporary nodes must stay outside ticket DOM and be canceled immediately on real data changes.

## Visibility and pacing rules

- Real status change always cancels idle entertainment before the status animation runs.
- At most three character beats and two fourth-wall beats may occur within the last five scheduled beats.
- No entertainment event may rewrite `.queue-number`, replace a ticket card, or persist temporary nodes after completion.
- Legacy mystery visuals remain available only to dedicated legacy test APIs and are excluded from normal rotation.
