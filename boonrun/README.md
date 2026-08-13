# ブーンRUN — CURRENT README

Runtime: `1.0.35`  
Build: `2026-08-13-playable-v1.0.35-responsive-machine-cards-common`

## MACHINE SERIES COMMON CONTRACT

共通正本：

`00_SHARED_SPEC / ASOBooN MACHINE SERIES 共通仕様 v1.0`

- **COMMON = そのマシンが何者か**
- **BOONJUMP = そのマシンがどう飛ぶか**
- **BOONRUN = そのマシンがどう走るか**

マシン性能はゲーム間で共有しません。

## Current 9 Machine IDs

`boon, wagon, buggy, bike, sport, ssr, princess, valkyrie, secret`

`ssr` = コズミックファントム。`suv`を新IDとして追加しません。

## COMMON Asset Workflow

方式B：`assets/machines/`をSOURCE OF TRUTHとし、BOONRUNは単独アップロード安全性のためruntime sync copyを`boonrun/assets/`に保持します。

9枚のMACHINE CARD、body、wheel、shadow等のIDENTITYはCOMMON。  
CRITICAL、ULTIMATE、障害物、ガソリン、ドローン、道路、走行VFX、走行性能はBOONRUN専用です。

## Current RUN Display Order

`boon → wagon → buggy → bike → sport → ssr → princess → valkyrie → secret`

カード番号は表示順ではなくシリーズ登場順です。

## Protection

COMMON同期を理由に以下を変更しません。

- 走行性能
- ジャンプ物理
- CRITICAL
- ULTIMATE
- 障害物 / ガソリン / ドローン
- 55 course patterns
- ranking endpoint / keys
- save data
- internal machine IDs


## RUN/JUMP Coordination

変更通知・アイデア共有は `00_SHARED_SPEC` 内の `RUN-JUMP 連携ログ` / `RUN-JUMP アイデア共有ボード` を使用します。
