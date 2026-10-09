# Saiji Privacy Policy / プライバシーポリシー / 개인정보 처리방침
Updated: 2026-10-09

## English
Saiji filters YouTube and Twitch comments locally. The optional AI filter is an experimental classifier for Japanese stream comments; other-language accuracy has not been evaluated.

Comment text and author identifiers are read only to filter the displayed comments. AI inference runs inside your browser. Comment text, author identifiers, NG words, browsing history, and model scores are not uploaded by Saiji. A short-lived in-memory cache of comment text and scores may be kept for up to 60 seconds (maximum 256 entries). There is no analytics or advertising service in the extension.

Your settings, NG words, muted user identifiers, blacklist-update timestamp and filter counters are stored in Chrome's local extension storage. Downloaded model files are stored in the extension's browser cache. Saiji checks open target tabs to start or release the model; it does not retain a browsing history log. Closing all target tabs or disabling filtering releases the inference worker; downloaded model files remain cached.

If you enable AI and allow model download, missing model files are downloaded from Hugging Face and its delivery infrastructure. The first download is about 650 MB. These providers receive network information such as your IP address and requested model-file URL. Saiji does not attach comment text or author identifiers to those requests. Hugging Face handles its own infrastructure under its privacy policy: https://huggingface.co/privacy . Downloaded files are fixed to a specific revision and checked against their SHA-256 hashes. JavaScript and WASM runtime code are bundled in the extension.

You can disable AI or model downloads in settings, remove NG words and muted users through the UI, and delete all extension storage/cache by uninstalling Saiji. We do not sell user data or use it for advertising, creditworthiness or lending decisions. Data accessed by Saiji is used only to provide its comment filtering function. This use follows the Chrome Web Store User Data Policy, including its Limited Use requirements.

Maintainer: onemunanoyo. Support: https://github.com/onemunanoyo/Saiji/issues . This policy describes Saiji's behavior, not the data practices of YouTube, Twitch, your browser or Hugging Face.

## 日本語
SaijiはYouTube/Twitchのコメントを端末内でフィルタリングします。任意のAI機能は日本語配信コメント向けの実験的な分類器で、他言語の精度は未検証です。

コメント本文と投稿者識別子は表示のフィルタリングのために読み取ります。AI推論はブラウザ内で行い、本文・投稿者識別子・NGワード・閲覧履歴・判定スコアを外部へ送信しません。本文とスコアを最大256件・60秒の一時メモリキャッシュに保持する場合があります。解析・広告サービスは組み込んでいません。

設定・NGワード・ミュートした投稿者識別子・ブラックリスト更新時刻・非表示件数は拡張機能のローカルストレージに保存します。取得済みモデルはブラウザキャッシュに保存します。対象タブの有無を確認してモデルを起動・解放しますが、閲覧履歴のログは保存しません。対象タブをすべて閉じるかフィルタを無効にすると推論workerを終了します。モデルのディスクキャッシュは残ります。

AIとモデル取得を有効にした場合、不足するモデルをHugging Faceと配信基盤から取得します。初回は約650MBです。提供元にはIPや取得対象のモデルURLなど通信情報が届きますが、本文や投稿者識別子は含めません。提供元の方針は https://huggingface.co/privacy を参照してください。取得するrevisionを固定しSHA-256で検証します。JavaScript/WASMの実行コードは拡張機能に同梱します。

設定でAI・モデル取得を無効にでき、UIからNGワードとミュートを削除できます。アンインストールすると拡張機能の保存データを削除できます。利用者データの販売、広告、信用評価や融資判断への利用は行いません。読み取ったデータはコメントのフィルタリングにのみ使用し、Chrome Web Store User Data PolicyのLimited Use要件に従います。

管理者：onemunanoyo。問い合わせ：https://github.com/onemunanoyo/Saiji/issues 。YouTube・Twitch・ブラウザ・Hugging Face自身のデータ取扱いは対象外です。

## 한국어
Saiji는 YouTube/Twitch 댓글을 기기 안에서 필터링합니다. 선택적 AI는 일본어 방송 댓글용 실험적 분류기이며 다른 언어의 정확도는 검증하지 않았습니다.

댓글 내용과 작성자 식별자는 표시 필터링에만 사용합니다. AI 추론은 브라우저 안에서 실행하며 댓글, 작성자 식별자, 차단 단어, 방문 기록, 점수를 업로드하지 않습니다. 댓글과 점수는 최대 256건, 60초 동안 임시 메모리 캐시에 유지될 수 있습니다. 분석 또는 광고 서비스를 포함하지 않습니다.

설정, 차단 단어, 음소거 작성자 식별자, 차단 목록 갱신 시각, 숨김 통계는 확장 프로그램의 로컬 저장소에 보관합니다. 다운로드한 모델은 브라우저 캐시에 저장합니다. 대상 탭의 존재를 확인해 모델을 실행하거나 해제하며 방문 기록 로그는 보관하지 않습니다. 대상 탭을 모두 닫거나 필터를 끄면 추론 worker를 종료하지만 모델 파일 캐시는 유지합니다.

AI와 모델 다운로드를 허용하면 누락된 모델을 Hugging Face 및 배포 인프라에서 가져옵니다. 첫 다운로드는 약 650MB입니다. 제공자는 IP와 모델 파일 URL 등 연결 정보를 받지만 댓글과 작성자 식별자는 받지 않습니다. 제공자의 정책은 https://huggingface.co/privacy 를 참조하세요. 고정된 revision 및 SHA-256 검사로 파일을 확인합니다. JavaScript/WASM 실행 코드는 확장 프로그램에 포함됩니다.

설정에서 AI/모델 다운로드를 끄고 UI에서 차단 단어와 음소거 목록을 삭제할 수 있습니다. 확장 프로그램 제거로 저장 데이터와 캐시를 삭제할 수 있습니다. 데이터 판매, 광고, 신용 평가 또는 대출 판단에 사용하지 않습니다. 데이터는 댓글 필터링에만 사용하며 Chrome Web Store User Data Policy의 Limited Use 요구를 준수합니다.

관리자: onemunanoyo. 문의: https://github.com/onemunanoyo/Saiji/issues . 이 정책은 YouTube, Twitch, 브라우저, Hugging Face 자체의 데이터 처리를 다루지 않습니다.
