# Board action map

This file records what each approved source family is for. It is a design boundary as well as an idea list: an action is not eligible merely because its source exists.

## Implemented rotation

The normal scheduler now exposes 47 source-approved patterns in a 77-beat shuffle cycle:

- 6 source-effect micro actions: magic star pass, sparkle sweep, card glint, speed pass, dust gust, and magic trail.
- 8 character cameos: four POMPON and four CHIRU appearances with distinct peek, pride, surprise, question, sneak, dodge, and alert meanings.
- 3 POMPON stories: brake failure, smug-to-oops, and star flyback.
- 6 duo stories: chase/catch, peek discovery, boast/disbelief, failure/scold, shared escape, and friendship oops.
- 1 rare story: ball ride success that escalates into a solo crash.
- 6 fourth-wall micro actions: center crack, corner crack, crack chain, frame pulse, shard burst, and false break.
- 14 fourth-wall stories: twelve source compositions plus `FW_KNOCK_KNOCK_POMPON` and `FW_REPAIR_REBREAK_DUO`.

The cycle allocates 30 quick source beats, 21 character beats, and 26 fourth-wall beats. Character events are forced after a long absence, but no more than three character or two fourth-wall beats may occupy the last five decisions.

## 2026-09-26 show-timing pass

- Every character Scene publishes an eight-beat recipe: anticipation, entrance, action, hold, incident, reaction, aftermath, exit.
- Relative `HEAD`, `FACE`, `HAND`, `FEET`, `BODY`, `CENTER`, `IMPACT`, `TRAIL_ORIGIN`, and `ENTRY_POINT` anchors bind effects to the acting pose.
- The idle character pace is 1.62 on top of the shared 2.5 kiosk slowdown; real-call delivery remains on its separate fast path.
- New character stories: `POMPON_WRONG_WAY_VICTORY`, `DUO_RESCUE_RELAY`, `DUO_QUIET_PEEK_RETREAT`.
- Fourth-wall stories hold a single impact point across crack, frame, character, impact, and shards, with longer warning, impact, reaction and exit beats.

## Character intent

| Beat | Setup | Payoff | Approved source families |
| --- | --- | --- | --- |
| POMPON trouble | dash, proud run, or ball ride | brake miss, flyback, wobble, oops | POMPON movement plus movement/impact/aftermath effects |
| CHIRU correction | visible POMPON mistake | retort, exasperation, chase, or scold | contextual CHIRU pose after its cause |
| CHIRU rescue | visible danger or runaway motion | catch, dodge, or guide away | chase/dodge/catch assets with alert or movement effects |
| Duo comedy | shared discovery or confident pose | entanglement, surprise, escape, or shared oops | duo story images, never an unrelated overlay pair |
| Fourth-wall tease | crack or frame pulse | false alarm, peek, or short breakout | crack/frame/impact layers without touching ticket DOM |
| Fourth-wall spectacle | clear impact setup | character breakout, shards, then clean retreat | one story scope with bounded foreground nodes |

## Candidate next actions (review gate)

These are intentionally not enabled until their source sequence is reviewed on the target monitor:

- **CHIRU rescue relay:** POMPON cannot stop, CHIRU chases, catch pose resolves the danger, then both wobble away. This must not resemble the existing chase/catch beat too closely.
- **POMPON frame knock:** a small corner knock, pause, second knock, face peek, then the crack closes. Candidate for a medium fourth-wall beat.
- **CHIRU push-back:** POMPON starts to break out; CHIRU appears in the duo frame and pushes the pose back inside. Requires a believable direction match.
- **Wrong-way victory lap:** proud run crosses once, re-enters from the same side looking confused, then exits the correct side. Candidate only if the repeated source pose reads clearly at monitor distance.
- **Quiet audience check:** POMPON and CHIRU alternate peeks from opposite edges, notice each other, and retreat without a chase. This provides a calm beat between large stories.

## Rejection rules for new actions

- Do not add a second ID that only changes color, anchor, or random frame while preserving the same setup and payoff.
- Do not combine a reaction pose without a visible cause.
- Do not place character or foreground effect nodes inside `#queueGrid`.
- Do not use a full-screen opaque layer, persist longer than the ticket-readable window, or run concurrently with a real status transition.
- Do not promote the three unmanifested generated character images until they have semantic names and explicit approval.
