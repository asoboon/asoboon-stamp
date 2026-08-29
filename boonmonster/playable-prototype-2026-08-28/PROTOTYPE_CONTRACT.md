# BOON MONSTER Playable Prototype Contract

## Scope

This vertical slice validates one complete loop using the existing 117 PIXEL LOCK assets. It does not alter, regenerate, or relock any asset.

## Player loop

`NEW GAME -> BIRTH -> HOME -> EXPERIENCE -> BABY -> ANIMAL -> EXPERIENCE -> CATEGORY -> EXPERIENCE -> LIGHT/DARK FINAL -> DEX -> ENDING/HOME -> SAVE/LOAD`

The prototype uses a static 96x96 locked asset as the runtime fallback for every state. Missing reaction or animation states are intentionally out of scope.

## Rules

- Baby maturity threshold: 5 turns.
- Animal maturity threshold: 6 turns.
- Category maturity threshold: 7 turns.
- Growth events are applied through one central state transition function.
- Baby and animal routes follow the current lineage and category mapping.
- Final rank is a prototype-only developer choice: `FORCE LIGHT` or `FORCE DARK`.
- Dex registration is permanent in the save data and duplicate-free.
- Save data is versioned and stored locally in the browser.

## Explicitly out of scope

Full animation coverage, final UI polish, final sound, balance tuning, 65-asset rebase, and production LIGHT/DARK gameplay rules.
