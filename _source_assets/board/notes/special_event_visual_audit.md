# Real Data Special Event visual audit

Audit date: 2026-09-26

Scope: Developing board only. Runtime assets remain the approved WebP atlases recorded in `source-assets-db.json`; source ZIP and extracted PNG files are not read at runtime.

## Composition rules applied

- One beat has one primary attention target: the changed reception number first, then the character reaction.
- Character face-safe zones remain clear during reaction holds. Contact effects may cross a face only at the instant of impact.
- Rear effect, target, character, contact, foreground shard, typography, and flash use separate depth roles.
- Dust/brake effects use FEET or contact anchors; alert/dizzy effects use HEAD/FACE-side anchors; trails use TRAIL_ORIGIN.
- Characters exit through a screen edge or return through the fourth-wall hole. Mid-screen opacity-only exits are not used for these scenes.
- CANCEL uses six large foreground shards in full motion mode (four in reduced/low mode), not particle swarms.

## Special event findings and resolution

| Event | Before | Severity | Resolution |
| --- | --- | --- | --- |
| CALL | Target impact was readable but lacked a distinct anticipation/freeze beat | S2 | Added target hold, POMPON approach, giant impact typography, board reaction, flash, number scale/bounce, impact freeze, reaction hold, and edge exit |
| GUIDED | Number and POMPON could read as separate motions; exit resembled a fade | S1 | Number and POMPON now accelerate in one direction, fully cross the screen edge, then leave speed-line/sparkle aftermath |
| HOLD | Parallel motion weakened the cause-and-effect and stop | S1 | Added screech anticipation, shared braking motion, freeze, `ピタッ！！`, POMPON stumble, CHIRU reaction, and directional exits |
| CANCEL | Removal read too close to a disappearing card | S1 | Added small-crack warning, inspection, pause, major break, six large foreground shards, flash, freeze, POMPON/CHIRU eye contact, escape/chase, `ガシャン！`, and reassembly |

## Visual QA

Checked at 1080 x 1920 for anticipation, impact, reaction, and exit. CALL entry clipping was corrected so the face is fully visible at the stop point. CANCEL alert placement was moved away from POMPON's face. All four special events returned temporary event DOM to zero after completion.
