# じょはり (Johari)

まだ知らない自分に出会う思考の窓。思考を整理し、対話を通じて新しい視点を発見するためのプラットフォームです。

## 概要

「じょはり」は、個人の思考を「スレッド（Scrap）」として記録し、それに対してコメントや返信を行うことで、自分自身の考えを深めたり、他者との対話を通じて新しい気づきを得たりすることを目的としたアプリケーションです。

## 主な機能

- **スレッド（Scrap）作成**: 思考の断片をタイトルと内容で記録。
- **リアルタイム対話**: Firebase Firestore を利用したリアルタイムなコメント・返信機能。
- **Markdown サポート**: 数式（KaTeX）、コードハイライト（Highlight.js）、GitHub Flavored Markdown に対応。
- **ステータス管理**: スレッドを「オープン（進行中）」または「クローズ（完了）」として管理。
- **プロフィール機能**: 自己紹介（50文字制限の「続きを読む」機能付き）やアイコンの設定。
- **マイページ**: 自分が作成したスレッドの管理と、外部サイトへの埋め込み用 iframe コードの生成。
- **公開プロフィール**: 他のユーザーの思考一覧を閲覧可能。
- **レスポンシブデザイン**: モバイル・デスクトップ両対応のモダンな UI。

## 技術スタック

- **Frontend**: React 19, Vite, Tailwind CSS 4
- **Backend**: Express (Vite Middleware)
- **Database/Auth**: Firebase (Firestore, Authentication)
- **Animation**: Motion (motion/react)
- **Icons**: Lucide React
- **Markdown**: react-markdown, remark-gfm, rehype-highlight, rehype-katex

## セットアップ

### 環境変数

以下の環境変数を設定する必要があります。

- `GEMINI_API_KEY`: Gemini API を利用する場合に必要（現在は主にプラットフォーム側で管理）。
- `GOOGLE_MAPS_PLATFORM_KEY`: 地図機能を利用する場合に必要。
- Firebase 設定 (`firebase-applet-config.json`):
  - `apiKey`
  - `authDomain`
  - `projectId`
  - `appId`
  - `firestoreDatabaseId`

### 開発コマンド

```bash
# 依存関係のインストール
npm install

# 開発サーバーの起動
npm run dev

# ビルド
npm run build

# 型チェック（Lint）
npm run lint
```

## ライセンス

MIT License
