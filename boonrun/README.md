# ブーンRUN — v1.0.37 DEV / REPLAY DRIVE

Runtime: `1.0.37-dev`  
Build: `2026-08-13-dev-v1.0.37-replay-drive`  
Base: `v1.0.36 / MACHINE SERIES v1.1`

> このフォルダは隔離DEV版です。Google Drive本番正本へ自動反映しません。

## 今回の目的

ゲームバランスを変えずに、RUNの「もう1回！」を強化します。

- SELF BEST CHASE
- CRITICAL FLOW
- SECTION CLEAR
- RUN RESULT STORY
- DEATH COACH

## MACHINE SERIES COMMON CONTRACT

- **COMMON = そのマシンが何者か**
- **BOONJUMP = そのマシンがどう飛ぶか**
- **BOONRUN = そのマシンがどう走るか**

方式Bを維持し、COMMON IDENTITYとRUN GAMEPLAYを混ぜません。

## Current 9 Machine IDs

`boon, wagon, buggy, bike, sport, ssr, princess, valkyrie, secret`

`ssr` = コズミックファントム。`suv`は新machine IDとして復活させません。

## v1.0.37 DEVで変更していないもの

- 9台の性能
- 走行速度 / 難易度カーブ
- ジャンプ物理 / hitbox
- CRITICAL判定幅
- Valkyrie MACH SYNC / DIVINE MACH
- 全ULTIMATE性能
- 燃料消費 / 燃料供給
- 55 course patterns
- 障害物挙動
- ranking endpoint / payload schema
- save key `asoboonBoonrun.v1`
- COMMON asset bytes
- BOONJUMP

## リリース条件

このDEVを本番候補へ昇格する場合は、JUMP側公開作業終了後に差分を再取り込みし、実機QAを行ってください。
