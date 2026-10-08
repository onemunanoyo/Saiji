# Saiji-Toxic-v2 ブラウザ内実行

コメント → 拡張機能のバックグラウンド → offscreen document → Worker → ONNX Runtime Web → 判定、という構成です。WebGPUがGPU推論、WASMがCPU推論を担当します。通常の利用にPythonサーバーやCUDAのインストールは必要ありません。モデル、tokenizer、実行ランタイムはdistに同梱し、コメントを外部へ送信しません。

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

setupスクリプトがHFモデルを `models/Saiji-Toxic-v2` に用意し、exportが `models/browser` にONNXとtokenizerを作成します。ビルド時にdistへコピーします。モデルがない環境でもソースのビルドはできますが、AI推論を利用する前にモデル生成が必要です。モデル・環境・収集データはGitに含めません。

Pythonの起動・停止スクリプトとserver.pyは比較・デバッグ用として残しています。拡張機能はlocalhost判定サーバーへ接続しません。

## 配布について

現段階はモデル同梱のローカル読み込み用です。FP32のモデルは約641MBあり、Chrome Store向けの最終パッケージ化は未実施です。公開前にモデルの量子化またはモデル資産のダウンロード・キャッシュ方式を検討し、再評価とStore要件の確認を行います。実行コードはローカルに同梱します。

実ブラウザの計測記録は `logs/browser-smoke.json` と `logs/browser-benchmark-receipt.json` に保存しています。後者の再実行には `node tools/browser-benchmark.mjs <benchmark.jsonl>` を使います（隔離ブラウザのCDPポート9227が必要）。
