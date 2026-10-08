# Saiji-Toxic-v2 ブラウザ内実行

コメント → 拡張機能のバックグラウンド → offscreen document → Worker → ONNX Runtime Web → 判定、という構成です。WebGPUがGPU推論、WASMがCPU推論を担当します。通常の利用にPythonサーバーやCUDAのインストールは必要ありません。実行ランタイムはdistに同梱します。モデル未配置の場合は設定でHF取得を有効にしてモデルをダウンロードできます。コメントを外部へ送信しません。

## この環境で使う

Chrome/Edgeの拡張機能ページで開発者モードを有効にし、このリポジトリの `dist` を読み込みます。すでに読み込んでいる場合は拡張機能を再読み込みしてください。設定のAIフィルタを有効にし、実行方式を選択して保存し、「モデル準備を確認」を押します。YouTube/Twitchのタブも再読み込みしてください。

- 自動: WebGPUを優先し、初期化が失敗した場合はWASMへ切り替えます。
- WebGPU: GPUを指定します。利用できなければエラーを表示します。
- CPU（WASM）: CPUだけで実行します。

Chrome 120以降を対象にしています。Apple Siliconでも同じWebGPU/WASM構成ですが、Mac実機は未検証です。CPU版は混雑したチャットでは処理が追いつかない場合があります。待機中の判定は最大32件とし、超過・エラー時のコメントは表示を維持します。AI判定でユーザーBANは行いません。

## モデルと判定条件

HF `j-llm/Saiji-toxic_v2` のrevision `88e9f6476ad2a5954f26cf1f10c1453b6664e1ff` をFP32 ONNXへ変換しています。採用モデルは1epoch＋短文追加学習版です。3epoch版ではありません。

既定プリセットは人手で確認した1,000件のベンチと同じ条件です。toxicity / harassment / obscene / discrimination / threat の最大値が `0.005039215087890625` 以上なら非表示にします。他の5ラベルはこのプリセットでは使いません。設定画面でラベルごとのしきい値を変更できます。

ブラウザ版の1,000件WebGPU再評価では、元のCUDA FP16版との判定差は0件でした（TP9、FP59、FN9）。中央値15.4ms、95パーセンタイル17.3ms／件。少数例でのWASMは約0.6秒／件でした。計測はWindowsの隔離したheadless EdgeでWebGPUテスト用フラグを使用しています。通常のChrome UIでのライブ配信動作とMac実機の性能を保証する結果ではありません。別の入力ではFP32/FP16の丸め差で閾値近辺の判定が変わる可能性があります。

## 開発環境で再生成

```powershell
./setup-classifier.ps1 -Backend cpu
./.venv-classifier/Scripts/python.exe -m pip install onnx
./.venv-classifier/Scripts/python.exe tools/export_browser_model.py
npm ci
npm run typecheck
npm test
npm run build
```

setupスクリプトがHFモデルを `models/Saiji-Toxic-v2` に用意し、exportが `models/browser` にONNXとtokenizerを作成します。ビルド時にdistへコピーします。モデルがない環境でもソースのビルドはできます。AI推論の初回準備時にHFから検証済みONNXを取得するため、利用者によるモデル変換は不要です。モデル・環境・収集データはGitに含めません。

Pythonの起動・停止スクリプトとserver.pyは比較・デバッグ用として残しています。拡張機能はlocalhost判定サーバーへ接続しません。

## 配布について

現段階はローカル読み込み用で、同梱またはHF取得に対応しています。FP32のモデルは約641MBあり、Chrome Store向けの最終パッケージ化は未実施です。公開前にモデルの量子化またはモデル資産のダウンロード・キャッシュ方式を検討し、再評価とStore要件の確認を行います。実行コードはローカルに同梱します。

実ブラウザの計測記録は `logs/browser-smoke.json` と `logs/browser-benchmark-receipt.json` に保存しています。後者の再実行には `node tools/browser-benchmark.mjs <benchmark.jsonl>` を使います（隔離ブラウザのCDPポート9227が必要）。

## HF取得とキャッシュ

「モデルがない場合はHugging Faceから取得する」は初期設定で有効です。モデル準備時は同梱ファイル、ブラウザキャッシュ、HFの順に探します。無効でも同梱・キャッシュ済みモデルは使えます。HFへの通信はモデル資産の取得のみで、コメント本文は送信しません。

HFのbrowser/に追加した検証済みFP32 ONNXをrevision `3530d6bb0492c4038f61092c7c2db0598747b424` に固定し、全ファイルをSHA-256で検査してから保存・使用します。初回約650MBの通信と保存領域が必要です。実行コードやWASMを外部から取得することはありません。キャッシュは拡張機能の削除やブラウザのストレージ消去で失われる場合があります。非公開リポジトリの認証には対応しません（指定モデルは公開）。

モデル未同梱の実ブラウザ検証ではHF取得後のWASM判定と、workerを再初期化してネットワークを切った後のキャッシュによるWebGPU判定が成功しました。記録は `logs/hf-download-smoke.json`。再実行はモデル未同梱の隔離ブラウザで `node tools/browser-hf-smoke.mjs <extension-id>` を使用します。

## 起動とメモリ解放

AIと全体フィルタが有効で、破棄されていないYouTube/Twitchタブがある場合に限り、最初のコメント判定または「モデル準備を確認」でモデルをロードします。対象タブを開くだけで先読みはしません。全タブで一つの推論workerを共有します。

対象タブをすべて閉じた・対象外ページへ移動した・AI/全体フィルタを無効にした場合は、処理中でもworkerを終了し、offscreen documentを閉じてモデルの常駐を解除します。HFから保存したディスクキャッシュは削除しません。次回必要になった際は再ロードするため、初回判定に待ち時間が発生します。設定画面だけを開いてもモデルは起動しません。

GPUドライバやブラウザのメモリ管理により、タスクマネージャーの使用量が即座にゼロになることまでは保証しません。推論中のFP32モデル自体のメモリ使用量は変わりません。

Windowsの隔離Edge/WebGPUで、対象なしでは起動しないこと、最後の対象タブ終了・対象外への移動・AI無効化・全体フィルタ無効化時のoffscreen終了と、次回の再初期化を実測確認しました。記録は `logs/browser-lifecycle-smoke.json`。M5でのメモリ使用量と解放後のOS表示は未計測です。

## 判定順序

既存のNGワード・ブラックリストによる判定を先に行い、削除されたコメントはAIへ送信しません。表示が残ったコメントだけを分類します。親スレッドが非表示の場合も子コメントは分類しません。AI判定待ちの間に親が非表示になった場合は、AIによる追加の非表示・カウントを行いません。
