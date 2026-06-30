# ドローン大冒険ゲーム - デプロイ手順

このドキュメントでは、ドローン大冒険ゲームをVercelにデプロイする手順を説明します。

## 前提条件

- Vercelアカウント
- Node.js（バージョン14以上）
- npm（バージョン6以上）

## デプロイ手順

### 1. Vercel CLIのインストール

```bash
npm install -g vercel
```

### 2. Vercelにログイン

```bash
vercel login
```

### 3. Vercel KVの設定

1. Vercelダッシュボードで新しいプロジェクトを作成
2. 「Storage」タブから「KV Database」を選択し、新しいKVデータベースを作成
3. 作成したKVデータベースの接続情報を取得

### 4. 環境変数の設定

プロジェクトのルートディレクトリに`.env.local`ファイルを作成し、以下の環境変数を設定：

```
KV_URL=your_kv_url_here
KV_REST_API_TOKEN=your_api_token_here
KV_REST_API_READ_ONLY_TOKEN=your_read_only_token_here
XUMM_API_KEY=your_xumm_api_key_here