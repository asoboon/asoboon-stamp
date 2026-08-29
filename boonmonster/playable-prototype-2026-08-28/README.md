# BOON MONSTER｜PLAYABLE PROTOTYPE 2026-08-28

このフォルダは、2026-08-28〜29にローカルで実装・受入確認した BOON MONSTER の縦切り PLAYABLE PROTOTYPE の記録です。

## 重要

- 既存の公開テストゲーム `/boonmonster/`（育成ループ v0.2）はそのまま維持します。
- このフォルダは既存テストゲームを上書きしません。
- 117 PIXEL LOCK、既存 manifest / DB、BOONRUN、BOONJUMP は変更していません。
- LIGHT / DARK は `PROTOTYPE_DEBUG_ONLY`、RUN / JUMP 接続は `PROTOTYPE_ONLY` のままです。

## 受入済み縦切り

`NEW GAME -> BIRTH -> HOME -> BABY -> ANIMAL -> CATEGORY -> LIGHT/DARK FINAL -> DEX -> SAVE/LOAD`

最終受入では以下を実ブラウザで確認しました。

- FULL LIGHT E2E: PASS
- FULL DARK E2E: PASS
- MOF -> RAB: PASS
- FEN -> STREET: PASS
- EVOLUTION SCREEN: PASS
- DEX: PASS
- SAVE -> RELOAD -> LOAD: PASS
- LOCKED ASSET RESOLUTION: PASS
- PAGE ERROR: 0
- REQUEST FAILED: 0
- CONSOLE ERROR: 0
- BROKEN SPEC ID: 0
- BROKEN IMAGE: 0
- CANON VIOLATION: 0
- BLOCKING ERROR: 0

`PLAYABLE PROTOTYPE ACCEPTED: YES`

## 現在のGitHubテストゲームとの関係

現在の `/boonmonster/` 直下は既存の育成ループ v0.2 を公開・試験する場所です。この受入済み縦切りは、次の統合工程で既存テストゲームへ段階的に取り込むための基準記録として保存します。別ゲームとして並行運用することを目的にしません。
