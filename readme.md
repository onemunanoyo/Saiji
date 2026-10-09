# 塞耳 Saiji（さいじ）

YouTube・Twitchのコメントを、自分の画面で非表示にするChrome拡張機能です。NGワード・ユーザーミュートに加え、任意の日本語AIフィルターを利用できます。

![Chrome](https://img.shields.io/badge/Chrome-Manifest_V3-4285F4?logo=googlechrome&logoColor=white)
![Version](https://img.shields.io/badge/version-1.1.0-blue)
![License](https://img.shields.io/badge/source-MIT-green)

## 機能

- NGワードによる部分一致フィルター。全角英数字・英字の大小を正規化して判定します。
- YouTubeライブ・通常コメント・Twitchなど、適用先を選んでNGワードを登録できます。
- 同じ投稿者がNGワードに3回該当すると、ローカルの追放リストへ追加します。違反回数は15分ごと、追放リストは7日ごとにリセットします。設定から個別解除も可能です。
- 日本語コメント向けの実験的AIフィルター。WebGPUでGPU推論、WASMでCPU推論を実行します。
- 日本語・英語・韓国語のUI。その他のUI言語では英語を表示します。

非表示や追放は自分のブラウザ内だけに適用されます。配信サイト上でコメントを削除したり、投稿者をBANしたりするものではありません。NGワードは正規表現ではなく文字列の部分一致です。

## インストール

### Chrome Web Store 

https://chromewebstore.google.com/detail/%E5%A1%9E%E8%80%B3-saiji/onimoeehiofocnalanlkchmjddbeleid?hl=ja


ソースから利用する場合は、Node.jsとnpmを用意して次を実行します。

```sh
git clone https://github.com/onemunanoyo/Saiji.git
cd Saiji
npm ci
npm run build
```

Chromeの `chrome://extensions/` でデベロッパーモードを有効にし、「パッケージ化されていない拡張機能を読み込む」から生成された `dist/` を選択してください。更新時は拡張機能と対象ページを再読み込みします。

開発ブランチを利用する場合は、そのブランチをチェックアウトしてからビルドしてください。通常のビルドは、ローカルにモデルがある場合に同梱します。モデルの事前配置は必須ではありません。

## 使い方

1. ツールバーのSaijiアイコンから設定を開き、NGワードと適用先を登録します。
2. YouTubeまたはTwitchでコメントを表示します。全体フィルターはポップアップから切り替えられます。
3. AIを使う場合は設定のAIフィルターを有効にし、実行方式と判定条件を保存します。AIは初期設定では無効です。
4. 対象サイトのタブを開いた状態で「モデル準備を確認」を押すと、準備状態を確認できます。

## 日本語AIフィルター（実験機能）

[Saiji-Toxic-v2](https://huggingface.co/j-llm/Saiji-toxic_v2)をブラウザ内で実行します。Pythonサーバー・CUDA・外部APIキーは不要です。

**日本語の配信コメント向けの実験機能です。誤検出・見逃しがあり、日本語以外の精度は検証していません。UIの多言語対応はモデルの多言語対応を意味しません。**

| 実行方式 | 動作 |
|---|---|
| 自動 | WebGPUを優先し、初期化に失敗した場合はCPUのWASMに切り替えます |
| WebGPU | GPUで推論します。利用できない場合はエラーを表示します |
| CPU（WASM） | GPUを使わずCPUで推論します |

初回のモデル取得には約650MBの通信と保存領域が必要です。同梱モデル、ブラウザのキャッシュ、Hugging Faceの順に確認します。自動取得を無効にした場合も、同梱・キャッシュ済みのモデルは利用できます。取得するモデルは固定リビジョンに指定し、SHA-256で検証します。JS・MJS・WASMの実行コードは拡張機能に同梱しています。

NGワード・追放リストで非表示にしたコメントと、非表示の親スレッドに属するコメントはAI判定を省略します。AI判定による非表示は、自動追放の違反回数に加算しません。

全タブで1つの推論Workerを共有します。待機中の判定は最大32件で、混雑・エラー時はAIで非表示にせず、通常のルール判定を継続します。非同期処理のため、コメントが一瞬見える場合があります。入力はNFKC正規化し、最大128トークンに切り詰めるため、長文の末尾を判定できない場合があります。

モデルは必要時にロードします。対象タブがなくなった場合、またはAI・全体フィルターを無効にした場合はWorkerとoffscreen documentを終了します。保存済みのモデルキャッシュは維持します。ロード中・推論中はモデルに加えて作業領域のメモリも使用し、OS上の使用量が直ちにゼロになることは保証しません。

既定のベンチマーク用プリセットは、先頭5ラベル（toxicity / harassment / obscene / discrimination / threat）の最大スコアが `0.005039215087890625` 以上なら非表示にします。この値は有害確率を保証するものではなく、利用方針に応じてラベルとしきい値を調整してください。モデル・評価条件・ビルド方法は [CLASSIFIER.md](CLASSIFIER.md) に記載しています。

## データと通信

コメント本文・投稿者情報・対象ページURLをフィルタリングのため端末内で処理します。コメント本文や投稿者情報を開発者・外部の判定サーバーへ送信しません。

- NGワード、追放リスト、設定、処理件数などは `chrome.storage.local` に保存します。
- 違反回数はメモリ内に保持し、15分ごとにリセットします。
- AIの判定結果は直近256件を最大60秒、メモリ内にキャッシュします。
- AIモデルはブラウザのCache Storageに保存します。拡張機能の削除やブラウザのストレージ消去で失われる場合があります。
- Hugging Faceからモデルを取得する際、接続先にはIPアドレスや要求URLなど通常の通信情報が伝わります。コメントは送信しません。
- 広告・追跡用の分析や、データ販売の機能はありません。

現在の1.1.0のデータ処理は [PRIVACY.md](PRIVACY.md) に記載しています。公開ポリシーの掲載先は [こちら](https://github.com/onemunanoyo/saiji-privacy-policy/blob/main/PRIVACY_POLICY.md) です。公開先の文面も最新版に揃えてください。

## 対応環境

Chrome 120以降を対象とするManifest V3拡張機能です。Windows・macOS（Apple Siliconを含む）などでブラウザのWebGPU/WASMを使用します。WebGPUの利用可否はブラウザ・GPU・ドライバーによります。

Windowsの隔離したEdge環境では、モデル取得・WebGPU/WASM推論・対象タブ終了時の解放を確認しています。Apple Silicon M5では利用者による動作報告がありますが、性能・メモリ使用量の定量検証は未実施です。すべてのChromium系ブラウザでの動作を保証するものではありません。

## 開発と配布

```sh
npm run typecheck     # TypeScriptの型チェック
npm test              # 自動テスト
npm run build         # dist/へ開発用ビルド
npm run dev           # 変更を監視してビルド
npm run package:store # モデルを含まないStore用ビルドとZIPを生成
```

Store用の出力は `release/extension/`、提出用ZIPは `release/Saiji-1.1.0-store.zip` です。モデル・Python環境・ログ・ソースマップはZIPに含みません。Storeへの提出手順と権限の説明は [store/SUBMISSION.md](store/SUBMISSION.md) を参照してください。

| ディレクトリ | 内容 |
|---|---|
| `src/content/` | コメント監視とルール・AIによる非表示 |
| `src/background/` | 設定、定期処理、推論の受付とライフサイクル |
| `src/inference/` | モデル取得、トークナイザー、WebGPU/WASM推論 |
| `src/options/`・`src/popup/` | 設定画面とポップアップ |
| `public/` | Manifest、翻訳、HTML、アイコン |
| `tests/` | 自動テスト |
| `tools/` | パッケージ化・ブラウザ検証 |
| `store/` | Store掲載文と申請資料 |

ビルドと通常利用にPythonは不要です。拡張機能はlocalhost判定サーバーに接続しません。

## ライセンス

Saijiのソースコードは [MIT License](LICENSE) です。Saiji-Toxic-v2モデルはApache-2.0、同梱ライブラリはそれぞれのライセンスに従います。配布パッケージに各ライセンスと第三者の著作権表示を含めています。
