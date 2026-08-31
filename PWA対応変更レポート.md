# PWA・iPad・Cloudflare Pages対応 変更レポート

## 変更内容

- アプリ名「商談価格ナビ」のWeb App Manifestを追加
- Service Workerによるアプリ画面・CSS・JavaScript・アイコンのオフラインキャッシュを追加
- iPad Safariの「ホーム画面に追加」とスタンドアロン表示に対応
- Apple Touch Icon、PWA用192px・512px・maskableアイコンを追加
- Cloudflare Pages用のHTTPヘッダー設定を追加
- HTTPSおよびlocalhostでのみService Workerを登録する安全な構成へ変更
- オンライン／オフライン／ホーム画面アプリ起動状態をヘッダーへ表示
- iPadのセーフエリア、縦画面、動的画面高、入力時ズームを調整
- タップ領域を44px以上へ拡大し、タッチ操作性を改善
- READMEへCloudflare Pages公開、iPad追加、更新手順を追加

## 維持した機能

- `.xlsm` / `.xlsx` のファイル選択・ドラッグ＆ドロップ読込
- ブランド・商品・インチ・サイズ検索
- ブランド・商品の複数選択と初期全選択
- 1本価格・4本価格
- 工賃設定、工賃ON/OFF、工賃込み4本総額
- 工賃設定のブラウザ保存
- コピー機能、商談モード
- 原価を画面へ表示しない仕様

## 配置構成

- `index.html`
- `manifest.json`
- `service-worker.js`
- `_headers`
- `css/`
- `js/`
- `data/`
- `vendor/`
- `icons/`

ビルドは不要です。この構成のままCloudflare Pagesへアップロードできます。

## オフライン時の注意

アプリ画面は初回オンライン起動後にオフライン起動できます。現在版では、Excelから読み込んだ商品・価格データもブラウザ内に保存し、次に別の価格表を読み込むか「データをクリア」を押すまで復元します。
