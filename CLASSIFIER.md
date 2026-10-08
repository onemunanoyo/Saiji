# Saiji-Toxic-v2 ローカル実行

## Windows

Python 3.11以降とNode.jsが必要です。PowerShellでこのフォルダを開きます。

```powershell
./setup-classifier.ps1 -Backend cuda
npm ci
npm run build
./start-toxic.ps1 -Device auto
```

CPUのみならセットアップのBackendと起動のDeviceをcpuに変更します。初回はHFからモデルをダウンロードします。非公開の場合は先にHF認証が必要です。トークンをソースへ記入しないでください。

Chromeの拡張機能ページで開発者モードを有効にし、このフォルダのdistを「パッケージ化されていない拡張機能を読み込む」で登録します。設定のAIフィルタで有効化し、保存時にlocalhostアクセスを許可して接続確認します。YouTube/Twitchのタブを再読み込みします。判定サーバーのターミナルは起動したままにしてください。

## Apple Silicon

```sh
sh setup-classifier.sh
npm ci
npm run build
sh start-toxic.sh auto
```

MPSが利用可能ならautoはMPSを選びます。CPUのみは `sh start-toxic.sh cpu`。MPSはfloat32、CUDAはfloat16、CPUはfloat32です。Apple Silicon実機の検証はまだ行っていません。指定したGPUが利用できない場合は明示的なエラーにし、無言でCPUへ切り替えません。

## 判定設定

初期値はAI無効。AIを有効にすると、1,000件の人手ブラインド比較に使った短文学習版の個別閾値0.005039215087890625を先頭5ラベルすべてに適用します。これはmax(first5)と同じ条件です。閾値は旧387件で選び、1,000件を見る前に固定したものです。理由別ルールへ切り替えるボタンもあります。モデルスコアは校正済み確率ではありません。

NFKC正規化、128トークン。Windows CUDAはベンチと同じFP16。CPU/MPSは数値差で閾値付近の判定が変わる可能性があります。モデルはHFのコミットSHAを固定して保存し、download-manifest.jsonに記録します。

コメント本文はこのマシンの127.0.0.1:8765だけへ送られます。推論時にHFへ本文は送りません。サーバー停止・混雑・タイムアウト時にはコメントを表示したままにします。AI判定ではユーザーをBANしません。

Chrome Store用の最終整形・プライバシー表示・ストア提出はこの段階では行いません。モデルやPython環境は拡張パッケージに同梱せず、ブラウザ側とローカル推論を分離します。
