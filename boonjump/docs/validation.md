# 検証結果｜永続保存・HOME分離版

- JavaScript構文チェック：合格
- `safeStorage.get()`：`window.localStorage.getItem()` を使用
- メイン保存キー：`asoboonBooncar.v6`
- バックアップ保存キー：`asoboonBooncar.v6.backup`
- 旧v2〜v5データ移行：維持
- ゲームHOME：ページ内タイトル画面へ復帰
- ミニアプリHOME：`../home.html`
- Service Worker：キャッシュ版を更新
