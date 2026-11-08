# kotonoha

kotonohaは、GitHub CopilotとClaude Code向けのスキルを提供します。曖昧な課題の構造化から、文書化、日本語表現の改善、Obsidianでの知識管理、プレゼンテーション設計までを支援します。

`consulting-analyst`は、課題を論点、仮説、証拠、選択肢、提言へ構造化します。分析結果を受け取った`tech-writer`は、README、設計文書、Blueprint、White Paper、提案書などへ内容を落とし込みます。日本語の表現品質は`japanese-prose`がGiNZAベースの診断で改善します。プレゼンテーションが必要な場合は、`presentation-planner`がシナリオ、スライド構成、デザイン仕様、PPTX作成スキル向けの引き継ぎ情報を生成します。

Obsidian向けには、Markdown記法、許可されたVault内のノート操作、JSON Canvas、Bases、公式アプリCLIを扱います。DefuddleによるWeb・HTML本文の抽出と、KnapによるJSON・CSVからのテンプレート生成にも対応します。操作ごとに、参照範囲・依存関係・保存の許可を確認します。

バージョンは **0.6.0** です（2026-11-08更新）。`obsidian-markdown`、`obsidian-cli`、`defuddle`、`knap`を含む11のスキルを同梱しています。npmパッケージを使うか、[ソースからスキルを導入する手順](#このチェックアウトからスキルを導入)を参照してください。

[English](./README.md) | [日本語](./README-ja.md)

## kotonoha（言の葉）という名前

`kotonoha`は、「言葉」「言語」「和歌」を表す古典的・詩的な表現「言の葉（ことのは）」に由来します。読み手の意図を、明確で構造化された言葉へ育てるという、このプロジェクトの目的を表しています。

『万葉集』との関係には補足が必要です。その書名を「万（よろづ）の言の葉、すなわち数多くの歌」と解釈する伝統的な説がありますが、由来は確定していません。「やまとうたは、人の心を種として、よろづの言の葉とぞなれりける」という有名な表現の直接の典拠は、『万葉集』ではなく紀貫之による[『古今和歌集』仮名序](https://ja.wikisource.org/wiki/%E5%8F%A4%E4%BB%8A%E5%92%8C%E6%AD%8C%E9%9B%86%E4%BB%AE%E5%90%8D%E5%BA%8F)です。

一方、それ以前に成立した『万葉集』でも、言葉が現実に働きかけるという近い思想が「言霊」として詠まれています。奈良県立万葉文化館の「万葉百科」では、山上憶良の[894番歌](https://manyo-hyakka.pref.nara.jp/db/detailLink?cls=db_manyo&pkey=894)や[3254番歌](https://manyo-hyakka.pref.nara.jp/db/detailLink?cls=db_manyo&pkey=3254)で確認できます。「言の葉」の歴史的な語義については、[コトバンク](https://kotobank.jp/word/%E8%A8%80%E3%81%AE%E8%91%89-503155)も参照しています。

## tech-writerが解決する課題

技術文書には、「文章が自然か」と「必要な情報が適切な構成で含まれているか」という別々の課題があります。kotonohaは両方の機能を同梱しています。`tech-writer`が構成と情報の完全性を担当し、独自実装の`japanese-prose`が[GiNZA](https://github.com/megagonlabs/ginza)を使って、文単位の自然さ、読解負荷、用語統一、係り受けの深さ、AIらしい反復表現を検査します。

kotonohaは文書構造と技術的な不変条件を固定してから日本語表現を最適化し、構造を再検証した後にrubber-duck reviewを実施します。

## 主な機能

- Issue Tree、仮説・証拠台帳、Current–Target–Gap、意思決定マトリクス、ピラミッド原則を使った事業・技術課題の構造化
- README、設計書・ADR、APIリファレンス、PR説明、コミットメッセージ、Issue本文、リリースノート、ユーザーマニュアル、コードコメント、要件定義書、システム設計書、テスト計画書、運用設計書・Runbook、移行計画書、セキュリティ設計書、技術提案書、Blueprint、White Paper、RFI・RFP、Qiita・Zenn記事の作成とレビュー
- 文書種別ごとの推奨構成とチェックリスト
- ID、事実、表、コード、受け入れ基準を変更せずに日本語表現を反復的に最適化する、GiNZAベースの独自`japanese-prose`文章診断
- 文書作成後のrubber-duck reviewと、対応可能な指摘がなくなるまでの修正・再レビュー
- `scripts/lint.py`による構造検査。見出しレベルの飛び、言語指定のないコードブロック、未解決のプレースホルダー、不審なリンク、文章に隣接した強調記号を検出
- コミットメッセージ本文とコードコメント・docstringを除き、すべての文書種別でMarkdownを標準形式として使用
- 日本語を主な対象言語とし、英語文書にも対応
- Obsidianの記法説明、許可範囲のVaultノート操作、Canvas図、Bases設定の編集
- 明示的に選択したObsidianアプリ操作、Defuddleによる本文抽出、Knapによるデータからのノート生成。通信や保存への許可は個別に確認

## 対応している文書

| 文書種別 | 例 | Doctype |
|---|---|---|
| プロジェクト概要 | README | `readme` |
| 設計判断 | 設計書、ADR、RFC | `design-doc` |
| 要件定義 | 要件定義書、機能要件、非機能要件 | `requirements-definition` |
| システム設計 | システム設計書、アーキテクチャ設計、詳細設計 | `system-design` |
| テスト計画 | テスト計画書、テスト戦略、受け入れ証跡 | `test-plan` |
| 運用 | 運用設計書、Runbook、インシデント対応手順 | `operations-runbook` |
| 移行 | 移行計画書、データ移行、システム切り替え計画 | `migration-plan` |
| セキュリティ | セキュリティ設計書、脅威モデル | `security-design` |
| APIリファレンス | REST API、イベント、SDKリファレンス | `api-docs` |
| 開発ワークフロー文書 | PR説明、コミットメッセージ、バグ報告、機能要求 | `pr-commit` |
| リリース文書 | リリースノート、CHANGELOG | `release-notes` |
| 利用者向け文書 | ユーザーマニュアル、手順書、チュートリアル | `user-manual` |
| ソースコード文書 | コードコメント、docstring | `code-comments` |
| 社内向け技術提案 | アーキテクチャ、投資、デリバリー提案 | `technical-proposal` |
| 将来構想・変革設計図 | 事業、Operating Model、データ、技術のBlueprint | `blueprint` |
| 証拠に基づく解説・提言 | 技術・事業White Paper | `white-paper` |
| 情報提供依頼 | RFI | `rfi` |
| 提案依頼 | RFP | `rfp` |
| ナレッジノート | Obsidianのノート、再利用可能なテンプレート | `obsidian` |
| 技術記事 | Zenn記事 | `zenn` |
| 技術記事 | Qiita記事 | `qiita` |

再利用可能なテンプレートには、README、設計判断、ユーザーマニュアル、PR説明があります。要件定義、システム設計、テスト、運用、移行、セキュリティの各文書にも対応しています。技術提案、Blueprint、White Paper、RFI、RFP、Obsidianノート、Qiita記事のテンプレートも含まれます。すべての文書種別には、`skills/tech-writer/references/doctypes/`配下に専用の構成ガイドとレビューチェックリストがあります。

Obsidianでは、[`obsidian.md`](skills/tech-writer/assets/templates/obsidian.md)をVault内のテンプレートフォルダーにコピーし、標準のTemplatesプラグインでそのフォルダーを指定します。名前を付けた空のノートで **Templates: Insert template** を実行すると、タイトルと挿入日が展開されます。プロパティ、内部リンク、コールアウト、タスクを含み、コミュニティプラグインは不要です。kotonohaはVaultの設定を変更しません。詳しい設定方法と制約は、[Obsidianガイド](skills/tech-writer/references/doctypes/obsidian.md)を参照してください。

## Obsidian Vaultの操作

Markdownノートとテンプレートの作成・編集は`obsidian-markdown`が担当します。
文書構成にはtech-writer、日本語の校正にはjapanese-proseを利用します。
`obsidian-vault`は、許可範囲のローカル読み取り・静的検証・確定済み候補の保存、明示許可されたファイル・ディレクトリ操作と成果物の取り込みを担う共用基盤です。
直接保存はホストのファイルツールを使うため、Python、uv、専用CLIの計画ファイルは不要です。
Obsidianアプリ、MCP、プラグインにも依存しません。

規約の推定、関連ノートの推薦、独立したリンク分析、校正作業の指揮はobsidian-vaultから削除しました。
アプリ上の検索・リンク確認には、明示的に選択したobsidian-cliを使います。これは編集上の推薦を代行する機能ではありません。
静的検証の観測値・リンク判定、v1依頼形式、Canvas用の共用保存API版1は互換性のために維持しますが、削除した上位ワークフローは提供しません。

Vault、読み取り範囲、モデルに渡す情報を利用者が明示し、指定外の内容を保持します。
保存前の確認を求められた場合は、差分承認まで保存しません。
直接編集の作業ディレクトリはユーザー指定を優先し、未指定なら依頼開始時のカレントディレクトリを使います。
相対保存先はそこから解決しますが、Vaultルート基準と明示したパスや絶対パスは維持します。
許可済みのVaultと範囲内にある対象自体を編集し、セッション領域のコピーで代替しません。
補助ファイルへの同意と適切な保存場所も別途必要です。
Obsidian関連の各ワークフローは、成果物だけでなく原文・候補・診断・レビュー・計画・一時ファイルもセッション領域へ保存しません。
指定場所の実体がセッション領域なら、書き込み前に別の場所を確認し、委譲先にも同じ制約を引き継ぎます。
CLIの作業領域には引き続きVault外の場所が必要です。セッション領域ではない場所への同意を得て使用します。
この制約はスキルが保存するファイルに適用し、ホストが管理する会話ログは制御しません。
CLI計画保存モードも選べます。こちらはLinux、CPython 3.12、uvを使い、正確な差分と計画の承認後にapplyします。
両モードとも、添削時の記法保護とハッシュ付き意味レビューは省略しません。
未解決リンクを誤りと断定せず、自動修復もしません。
CLI処理はオフライン・lock付きで起動します。依存関係の初回準備は別途の許可が必要です。
依頼例、コマンド、コピーの保持と復旧は[操作ガイド](skills/obsidian-vault/references/workflow.md)を参照してください。

保存は必要な確認ができるローカル通常ファイルに限定し、シンボリックリンクや複数ハードリンクを拒否します。
Linuxでは所有者・グループ・権限を維持します。
0.5.4から、通常の直接保存はWSL上のローカルWindowsドライブ（drvfs・9p・v9fs）にも対応します。
既存ノートは置換せず同じ実体へ書き込み、WindowsのACL・属性を保持します。仮想的なLinux権限だけでは拒否しません。
ネットワーク共有は対象外とし、パス・実体・保存後のバイト列を検証します。保存方式が不明な編集ツールは使いません。
`/tmp`等への別出力を、許可済みVaultの更新の代わりにはしません。
WSLのOneDrive保存は、WSLのパス解決・要素の型・ファイル実体の確認を使います。cloud再解析属性はWSLのシンボリックリンクではありません。
通常のWSLファイルにWindows再解析タグ取得や最終パスAPIを要求せず、取得機能がないことだけでは保存を拒否しません。
ネイティブWindowsではcloudタグ検証を維持します。検出した転送・リンク・範囲外への逸脱と実際の権限拒否は引き続き拒否します。
オンライン専用と判明したファイルのローカル取得通信には別途同意が必要です。
Python CLI・Canvas・Basesの対応範囲は広げません。CLIでは引き続きWSLのWindowsドライブや拡張属性付き対象を拒否します。
SELinuxラベルなどの削除を回避策にしません。
直接編集はCLIの原子的確定、ルートロック、成功記録による再実行保護を利用しません。
保存後に読み戻して確認しますが、途中失敗や同時編集の完全な防止は保証しません。
LLMの誤判断を完全には防げず、ホストを隔離する機能でもありません。
WSLのホストから見えるパス確認はWindows再解析情報の独立監査ではなく、検出不能な転送がないことを保証しません。

ホストツールでは、Markdown・PDFに限らず、明示指定したディレクトリの作成と通常ファイルの作成・編集・削除も行えます。
正確な対象・操作への許可を確認し、ワイルドカードの一括指定は範囲内で列挙した全対象を承認してから実行します。
作成は非上書き、編集は原文・実体の再照合、削除は対象・ハッシュの直前照合と削除後の不在確認を必須とします。
OneDriveの削除は他の端末へ同期され得ます。復旧は保証せず、ディレクトリ削除・再帰削除・移動・改名は対象外です。
Markdown校正とCanvas・Basesの保存検査は維持し、Python CLIに新しい操作コマンドは追加しません。

明示指定したPDFのダウンロードとローカルDocling変換成果物は、検証済みのOneDriveを含むVault内作業ディレクトリへ取り込めます。
取得元・通信・変換への許可と全出力先を確認し、作業ディレクトリ指定だけでは書き込みません。
非上書き作成と保存先・属性検査を使い、新規フォルダー、追加出力、補助ファイルには正確な場所への別途同意が必要です。
Doclingは任意導入であり、同梱・自動導入しません。取得と変換を個別に検証し、成果物のパスとハッシュを報告します。
詳しくは[取り込み手順](skills/obsidian-vault/references/workflow.md#pdfdocling変換成果物の取り込み)を参照してください。

## Obsidian Canvasの操作

専用の`obsidian-canvas`は、ノート関係図、アイデア整理、条件付きの手順、資料比較を扱います。
JSON Canvas 1.0の読み取り・診断・配置提案・編集に対応し、Obsidianの起動やURLへの通信は行いません。
この機能は`kotonoha@0.4.2`に含まれます。

同じ場所に共用API版1のobsidian-vaultを導入します。Canvasだけの選択導入では兄弟を自動更新しません。
添削ではjapanese-proseも必要です。初期対応はLinux、CPython 3.12、固定依存によるオフライン実行です。
既存の兄弟Skillが旧版なら、必要な更新を明示し、許可なく置き換えません。

保存前にID・属性ごとの変更、根拠や提案の文字による表示、正確な差分と計画を確認します。
日本語添削には変更文字列ごとのハッシュ付き意味レビューが必要です。
保存は利用者が明示承認した1Canvasだけに限定し、参照元ノートや添付を変更しません。
未知の構造は診断のみとし、実表示や任意の拡張、casefoldファイルシステムの検証済み対応は保証しません。
同意、コマンド、部分実施、保存結果が不明な場合の復旧は[Canvas操作ガイド](skills/obsidian-canvas/references/workflow.md)を参照してください。

## Obsidian Basesの操作

専用の`obsidian-bases`は、Table・Cards・List・Kanbanの`.base`を作成・診断・直接編集します。
この機能は`kotonoha@0.4.2`に含まれます。
作業ディレクトリはユーザー指定を優先し、未指定ならカレントディレクトリを使います。
許可済みの対象自体をホストツールで編集し、ノートのプロパティや埋め込みbaseブロックは変更しません。

読み取り専用のNode検査器へ正確な文字列を渡し、保存するバイト列と検査結果のハッシュを照合します。
Node 18以上と固定依存が必要です。依存の準備は別途許可を得たnpm ciで行い、検査中の自動取得はしません。
導入時には専用のロックファイルを含め、node_modulesはコピーしません。
式の実行やObsidian表示は確認せず、未知の機能・アプリ版不明・未完了の検査では保存を拒否します。
条件・数式の変更は正確な差分と保存の許可を確認し、条件なしでは全Vaultが表示されることを説明します。
直接編集にはCLIのロック・原子的確定・再実行記録はありません。
依存の準備、4種類の独自テンプレート、原文保持、失敗時の扱いは[Bases操作ガイド](skills/obsidian-bases/references/workflow.md)を参照してください。

## Obsidian記法・アプリ操作・データからのノート生成

0.6.0は、[kepano/obsidian-skills](https://github.com/kepano/obsidian-skills)の6つの機能分野を、kotonoha独自の手順と例で扱います。
参照した版は[`3ccff5338ea700537839b21900aa5358a0402c98`](https://github.com/kepano/obsidian-skills/tree/3ccff5338ea700537839b21900aa5358a0402c98)です（2026-11-05確認）。
対応する実行環境や保存方法が参照先と同一という意味ではありません。既存のCanvas・Basesの検査範囲と保存制約を維持します。

| 機能 | kotonohaのSkill | 実行条件と保存先 |
|---|---|---|
| Markdownノートと記法 | [`obsidian-markdown`](skills/obsidian-markdown/SKILL.md) | 外部CLIは不要。作成・編集と日本語校正の指揮を担当し、ローカル入出力はobsidian-vaultへ引き継ぐ |
| JSON Canvas | [`obsidian-canvas`](skills/obsidian-canvas/SKILL.md) | 既存のPython検査と単一Canvasの計画承認を使用。json-canvasという別の導入名は追加しない |
| Bases | [`obsidian-bases`](skills/obsidian-bases/SKILL.md) | 既存のNode静的検査と、許可されたホストツールによる保存を使用 |
| 公式アプリCLI | [`obsidian-cli`](skills/obsidian-cli/SKILL.md) | 登録済みCLIとデスクトップアプリが必要。Vaultと対象ファイルを明示し、アプリ操作への許可を別途確認 |
| Web・HTML本文抽出 | [`defuddle`](skills/defuddle/SKILL.md) | 任意導入のDefuddleを使用。第三者サービスへの通信も含めて許可を確認し、標準出力か同意済みのVault外作業領域へ出力 |
| JSON・CSVテンプレート生成 | [`knap`](skills/knap/SKILL.md) | Knap CLIとNode 20以上が必要。検査・生成・一括出力のプレビューを行い、Vault外へ仮出力 |

公式アプリCLIは、kotonohaの`vault.py`とは別の操作経路です。現在の公式導入手順では、1.12.7以上のインストーラーと、設定画面のGeneralからのCLI登録が必要です。
コマンドがアプリを起動する場合もあるため、起動・プラグイン実行・画面取得には明示的な許可を確認します。保存拒否を回避する代替手段には使いません。
Basesの実データを問い合わせる場合は、結果に含まれる範囲への同意も必要です。静的検査だけで実表示や式の計算結果を確認済みとは扱いません。

Defuddleは、ローカルHTMLの処理でも第三者サービスへ通信する可能性があります。オフライン処理とはみなしません。
Knapによる生成は、元情報の取得・事実確認・保存の許可を兼ねません。一括生成では全出力先をプレビューし、同意済みの空のVault外ディレクトリへ仮出力します。
選択したノートはobsidian-markdownで内容を整え、ローカル保存だけをobsidian-vaultへ1ノートずつ渡します。
新しい経路でもセッション領域への保存は禁止し、外部ツールやアプリ設定を自動導入・変更しません。

依頼例:

```text
この文章の見出し・ブロックへのリンク、入れ子のコールアウト、
YAMLプロパティを確認して。Vaultは読まず、保存もしないで。
```

```text
公式Obsidian CLIで、指定したVaultのNotes/Trial.mdを読んで。
実行前にVaultの識別情報とアプリ起動の許可を確認して。
```

```text
KnapでCSVの各行からノートを作るプレビューを出して。
仮出力は同意済みのVault外ディレクトリを使い、生成・保存前に出力先を示して。
```

詳しい記法とコマンドは、[Markdown記法](skills/obsidian-markdown/references/syntax.md)、[アプリCLI](skills/obsidian-cli/references/commands.md)、[Canvasフィールド](skills/obsidian-canvas/references/json-canvas.md)、[Basesの式](skills/obsidian-bases/references/expressions.md)、[Knapの例](skills/knap/references/rendering.md)を参照してください。

## consulting-analystの機能

- 文書やプレゼンテーションを作る前に、意思決定者、意思決定の問い、成果、範囲、証拠不足を定義
- フレームワークを機械的に埋めず、意思決定に必要な最小構成を選択
- Issue Treeと検証可能な仮説・証拠台帳を作成
- Current–Target–Gap分析と、採点基準・感度分析を伴う選択肢比較を実施
- 事実、推定、前提、解釈、提言を区別
- `tech-writer`と`presentation-planner`へ、証拠を追跡できる分析結果を引き継ぐ

自然言語では、次のように依頼できます。

```text
この事業課題をIssue Treeで構造化し、優先論点ごとに必要な証拠を整理して
```

```text
現状と目標状態を比較してGapを特定し、Blueprint向けの分析を準備して
```

```text
複数案を明示的な評価基準で比較し、不足する証拠を捏造せずに
White Paper向けの分析を作成して
```

## presentation-plannerの機能

- 対象者、意思決定、行動喚起、プレゼンテーションの制約を定義
- ブリーフ、対象者の理解を導くシナリオ、主張型タイトルを使ったスライド構成を生成
- YAMLデザイン仕様とPPTX作成スキル向けの再現可能で明確な引き継ぎ情報を生成
- 経営判断、技術説明、データ報告向けのシナリオテンプレート
- 経営提案、技術説明、データ報告向けのデザイン仕様
- `.pptx`の生成、バイナリ編集、レンダリング、視覚的な品質確認は専用のPPTXスキルに委ねる

## セットアップ

### 前提条件

- GitHub Copilot（CLIまたは対応IDEのエージェントモード）かClaude Codeがインストールされていること
- インストーラー用のNode.js 18以上とnpm
- 対象の操作を選んだ場合のみ、登録済みのObsidianデスクトップCLI、Defuddle、Knapが必要。Knap CLIにはNode.js 20以上を使用
- tech-writerの構造lintを実行する場合はPython 3.9以上
- 同梱`japanese-prose`の文章lint、読解負荷分析、アウトライン抽出、用語検査、編集前後の不変条件検査を実行する場合はPython 3.10以上と`uv`。GiNZA、`ja_ginza`、spaCy、Markdown解析用の依存関係は、各スクリプトの初回実行時に`uv`が解決

### このチェックアウトからスキルを導入

このソースチェックアウトには、11のスキルがすべて含まれます。
リポジトリのルートから、`/path/to/your-project`を導入先プロジェクトの絶対パスに置き換え、利用するエージェントのコマンドを1つ実行します。

```bash
node bin/kotonoha.js install --agent copilot --target /path/to/your-project/.github/skills
node bin/kotonoha.js install --agent claude --target /path/to/your-project/.claude/skills
```

どちらも既定では11のスキルを選択し、既存のスキルディレクトリは保持します。既存のコピーを更新する場合は、ローカルの変更を確認し、置き換える場合にだけ`--force`を追加します。
1つだけ導入する場合は、`--skill obsidian-markdown`などを追加します。
この操作はスキルファイルのコピーのみです。Obsidian、Defuddle、Knap、Pythonの依存関係、Bases検査器の依存関係は導入しません。

### 公開済みのnpmパッケージをインストール

パッケージをインストールし、同梱CLIで各スキルを対象のスキルディレクトリへコピーします。

```bash
npm install --save-dev kotonoha
npx kotonoha install
```

`npm install`はパッケージの導入だけを行います。エージェントの選択画面は表示せず、スキルディレクトリにも自動で書き込みません。

### GitHub Copilot・Claude Code・両方を選択

`--agent`はkotonoha `0.5.0`以降で利用できます。`0.4.2`などの旧版では使えないため、先にnpmパッケージを更新してください。

```bash
npx kotonoha install --agent copilot   # .github/skills/
npx kotonoha install --agent claude    # .claude/skills/
npx kotonoha install --agent all       # 両方のディレクトリ
```

未指定時は従来どおり`--agent copilot`です。`--agent`で配置先のエージェント、`--skill`で導入するスキルを選びます。両エージェントには同じSkillファイル、スクリプト、テンプレートを配置します。エージェント本体のインストール、認証設定、各スキルのPython・Node実行依存の準備は行いません。

エージェントとスキルの選択は組み合わせられます。

```bash
npx kotonoha install --agent claude --skill tech-writer
npx kotonoha install --agent all --skill obsidian-bases
npx kotonoha install --agent all --force
```

既存ディレクトリの保護と`--force`は、選択した各配置先に適用します。明示した単一スキルがどちらかの配置先に存在する場合、コピー開始前に処理を止めます。ただし、コピー中のファイルシステムエラーでは、それ以前のコピーが残ることがあります。複数の配置先をまとめて元に戻す機能はありません。

単一エージェントでは`--target`で配置先を変更できます。`--agent all`と`--target`は併用できません。配置先を個別に変える場合は、エージェントごとに実行します。

この選択はファイルの配置先を決めるもので、エージェント間の隔離ではありません。Copilotも`.claude/skills`を認識するため、Claude向けに配置してもCopilotからの読み込みは防げません。対応する配置先は、公式資料（[CopilotのSkill説明](https://docs.github.com/en/copilot/concepts/agents/about-agent-skills)、[Claude CodeのSkill説明](https://code.claude.com/docs/en/skills)）を参照してください。

### 同梱スキルをまとめてインストール

`kotonoha install`は、まだ存在しない同梱スキルをすべてインストールします。公開済みパッケージを導入した環境で、全スキルを明示的に選ぶコマンドは次のとおりです。

```bash
npx kotonoha install --skill all
```

`--skill all`が既定値であるため、`npx kotonoha install`も同じ動作です。導入できるスキルは、使用したパッケージに依存します。
0.6.0には11のスキルを同梱しています。導入先プロジェクトで、すべて配置されたことを確認します。

```bash
test -f .github/skills/consulting-analyst/SKILL.md
test -f .github/skills/tech-writer/SKILL.md
test -f .github/skills/japanese-prose/SKILL.md
test -f .github/skills/obsidian-vault/SKILL.md
test -f .github/skills/obsidian-canvas/SKILL.md
test -f .github/skills/obsidian-bases/SKILL.md
test -f .github/skills/obsidian-markdown/SKILL.md
test -f .github/skills/obsidian-cli/SKILL.md
test -f .github/skills/defuddle/SKILL.md
test -f .github/skills/knap/SKILL.md
test -f .github/skills/presentation-planner/SKILL.md
```

いずれかのディレクトリがすでに存在する場合、既定のコマンドはそのディレクトリを保持し、不足しているスキルだけをインストールします。すべてのインストール済みスキルをまとめて置き換える場合は、ローカルのカスタマイズを確認またはバックアップしてから実行します。

```bash
npx kotonoha install --skill all --force
```

### 内蔵された日本語表現最適化

kotonohaには独自開発の`japanese-prose`が同梱されるため、文章最適化スキルを別途インストールする必要はありません。`npx kotonoha install`により`tech-writer`と同じスキルルートへ配置され、GiNZAを使った文章lint、読解負荷検査、用語抽出、アウトライン検査、反復的な文章レビューをローカルで実行できます。この実装はkotonoha向けにゼロから開発しており、`natural-japanese`のソースコードを含みません。GiNZAの依存関係とライセンス情報は`skills/japanese-prose/NOTICE.md`に記録しています。

文章lintでは、隣接する助詞・単語の重複、和文括弧の不整合、同一段落内の敬体・常体の混在も確認します。指摘は自動置換の指示ではなく、文脈を確認する対象です。`proofread`モードでは、任意の言い換えを避け、誤字と文法上の誤りだけを最小限に修正します。100点満点のスコアは確認箇所を探す補助であり、訂正精度や品質の保証ではありません。

v0.6.0では、係り受けに基づく擬人化・比喩の候補と、意味が重なる前置きの診断を追加しています。技術用語として自然な用法や、意図した比喩は残します。自動置換は行いません。[nanaism/yomiyasu](https://github.com/nanaism/yomiyasu)の考え方を参照し、実装とテストは独自に作成しています。

編集前の原文は変更せずに保存します。同梱の`scripts/invariants.py`が、数値、識別子、コード、表、リンク、指定された固有名詞・専門用語などの変更を検査します。編集した文章には、原文と編集後のファイルのハッシュに対応した意味保存レビューが必要です。機械的な一致だけでは、意味が保たれたとは判定しません。レビュー形式と終了コードは、[`review-workflow.md`](skills/japanese-prose/references/review-workflow.md)を参照してください。

不変条件ゲートでは、主語・対象・通知先、否定、条件、義務・依頼・推量などが変わった可能性を、編集前後の行番号・本文・検出根拠とともに示します。誤検知や見逃しがあるため、指摘だけで意味の同一性は判定しません。9項目の意味レビューと終了コードは従来どおりです。提出・保存する候補は、レビュー済みの`after_sha256`と一致している必要があります。

自然言語で指示するときは、GiNZAを明示する必要はありません。「日本語文書を自然にする」「読みやすくする」「簡潔にする」「AIらしい定型表現を減らす」といった依頼をすると、同梱の文章最適化ワークフローが呼び出されます。

```text
README-ja.mdの日本語を自然で読みやすい表現に修正して
```

```text
この設計書の不自然な日本語、長すぎる文、AIらしい反復表現を確認し、
指摘を修正して
```

目的に応じて、次のようにモードを指定できます。

- ファイルを修正する: `README-ja.mdの日本語表現を最適化して`
- 誤りだけを修正する: `README-ja.mdをproofreadモードで校正して。任意の言い換えはせず、誤字と文法上の誤りだけを最小限に修正して`
- 修正せずにレビューする: `README-ja.mdの日本語をレビューして。ファイルは修正しないで`
- 採点だけ行う: `README-ja.mdの日本語表現を100点満点で採点して`
- すべての診断を実行する: `README-ja.mdをfullモードで日本語表現最適化して`
- GiNZAを明示する: `README-ja.mdをGiNZAで解析し、係り受けや読解負荷を改善して`

新しい日本語文書では、`このリポジトリの日本語READMEを作成して`のように依頼すると、`tech-writer`が下書きと構造レビューを行い、rubber-duck reviewの前にGiNZAベースの文章最適化を実行します。文章最適化を確実に指定する場合は、`<ファイル名>を技術文書として作成または修正し、GiNZAによる日本語表現最適化まで実施して`と指示します。

既定のインストール先は、現在のプロジェクトの`.github/skills/`です。
同梱の各スキルを、スキル名と同じサブディレクトリに配置します。
スキルを1つだけインストールする場合や、対応している別のディレクトリを使用する場合は、次のように指定します。

```bash
npx kotonoha install --skill consulting-analyst
npx kotonoha install --skill presentation-planner
npx kotonoha install --agent claude
npx kotonoha install --agent claude --target ~/.claude/skills
npx kotonoha install --target ~/.copilot/skills
```

`--skill <name>`を明示したインストールは、既存のスキルディレクトリを上書きしません。すべてのスキルを置き換える場合は、既存のインストールを確認またはバックアップしてから`--force`を指定します。

```bash
npx kotonoha install --force
```

既定の全スキルインストールでは、既存のスキルディレクトリをスキップし、不足しているスキルだけを追加します。このため、`tech-writer`だけがインストールされた環境にも、ほかの同梱スキルを安全に追加できます。

```bash
npx kotonoha install
# Skipped tech-writer (...)
# Installed consulting-analyst (...)
# Installed japanese-prose (...)
# Installed presentation-planner (...)
```

### kotonohaを更新

インストール済みスキルディレクトリ内のローカル変更を、先に確認してコミットまたはバックアップします。`--force`による更新は、ローカルのカスタマイズを含む対象ディレクトリ全体を置き換えます。

最新の安定版へ更新します。

```bash
npm install --save-dev kotonoha@latest
```

`next`タグで公開されているプレリリース版を試す場合は、次のようにインストールします。

```bash
npm install --save-dev kotonoha@next
```

npmパッケージを更新しても、コピー済みのスキルは自動更新されません。パッケージ更新後に、同梱スキルを再インストールします。

```bash
npx kotonoha install --force
npx kotonoha install --agent claude --force
npx kotonoha install --agent all --force
```

上記のうち、初回の導入と同じ`--agent`に対応するコマンドを1つ実行します。最初のコマンドが更新するのは、既定のCopilot向け配置先だけです。

スキルを1つだけ更新する場合は、次のように実行します。

```bash
npx kotonoha install --skill consulting-analyst --force
npx kotonoha install --skill tech-writer --force
npx kotonoha install --skill japanese-prose --force
npx kotonoha install --skill presentation-planner --force
```

最初のインストールで別のインストール先を指定した場合は、更新時にも同じディレクトリを指定します。

```bash
npx kotonoha install --target ~/.copilot/skills --force
```

インストール済みパッケージのバージョンと、置き換えられたファイルの差分をコミット前に確認します。

```bash
npx kotonoha --version
git diff -- .github/skills .claude/skills
```

`--force`なしで`npx kotonoha install`を実行しても既存のスキルディレクトリは更新されず、不足しているスキルだけがインストールされます。

### ソースチェックアウトからインストール

このリポジトリでは、スキルが`.github/skills/`配下にリンクされているため、Copilot CLIで使用するための追加設定は不要です。

別のプロジェクトでソースチェックアウトに含まれるスキルを使用する場合は、各スキルのディレクトリを対象リポジトリの`.github/skills/`、`.claude/skills/`、またはグローバルの`~/.copilot/skills/`へコピーします。

```bash
cp -r skills/consulting-analyst /path/to/your-repo/.github/skills/consulting-analyst
cp -r skills/tech-writer /path/to/your-repo/.github/skills/tech-writer
cp -r skills/japanese-prose /path/to/your-repo/.github/skills/japanese-prose
cp -r skills/obsidian-vault /path/to/your-repo/.github/skills/obsidian-vault
cp -r skills/obsidian-canvas /path/to/your-repo/.github/skills/obsidian-canvas
cp -r skills/obsidian-bases /path/to/your-repo/.github/skills/obsidian-bases
cp -r skills/obsidian-markdown /path/to/your-repo/.github/skills/obsidian-markdown
cp -r skills/obsidian-cli /path/to/your-repo/.github/skills/obsidian-cli
cp -r skills/defuddle /path/to/your-repo/.github/skills/defuddle
cp -r skills/knap /path/to/your-repo/.github/skills/knap
cp -r skills/presentation-planner /path/to/your-repo/.github/skills/presentation-planner
```

## Copilot・Claude Codeに文書作成を依頼

CopilotまたはClaude Codeのセッションで必要な文書種別を依頼すると、対応するスキルが自動的に呼び出されます。

- 「READMEを書いて」「この設計書をレビューして」「PR説明文を書いて」「この手順書を分かりやすくして」
- 「要件定義書を作って」「承認済み要件からシステム設計書を書いて」「移行計画とRunbookを作って」
- 「この提案書からPPTXを作って」「経営層向けプレゼンを設計して」「技術説明資料を設計して」

構造だけを簡単に診断する場合は、次のコマンドを実行します。

```bash
uv run skills/tech-writer/scripts/lint.py --json path/to/document.md
```

`uv`がない場合も、標準ライブラリだけを使う次のコマンドで実行できます。

```bash
python3 skills/tech-writer/scripts/lint.py path/to/document.md
```

## リポジトリ構成

```text
skills/consulting-analyst/   # 課題構造化と証拠に基づく分析スキル
  SKILL.md                   # 分析ワークフロー、制約、引き継ぎ
  references/                # フレームワーク選択、証拠規律、引き継ぎ契約
  assets/templates/          # ブリーフ、Issue Tree、証拠、意思決定、統合artifact
skills/tech-writer/          # tech-writerスキル
  SKILL.md                   # スキル定義
  references/                # 構成原則、文書種別ごとの規則とチェックリスト
  references/doctypes/       # README、要件、設計、テスト、運用、移行、セキュリティ、API、PR・Issue、リリースノート、提案、Blueprint、White Paper、RFI・RFP、Qiita・Zenn
  scripts/lint.py            # 構造とMarkdown表示のlintスクリプト
  assets/templates/          # 要件、設計、テスト、運用、移行、セキュリティ、将来構想、調査・提言、調達などの文書テンプレート
skills/japanese-prose/       # 独自開発のGiNZAベース文章最適化スキル
  SKILL.md                   # 執筆、lint、レビュー、収束のワークフロー
  references/                # 執筆規則、レビューワークフロー、採点規則
  scripts/                   # 文章lint、読解負荷、アウトライン、用語検査
  NOTICE.md                  # GiNZAの依存関係とライセンス情報
skills/presentation-planner/ # シナリオ、デザイン仕様、PPTX引き継ぎスキル
  SKILL.md
  references/                # 責任境界、シナリオ・デザインガイド、カスタマイズ、引き継ぎ契約
  assets/scenario-templates/ # 経営判断、技術説明、データ報告向けシナリオ
  assets/design-templates/   # 経営提案、技術説明、データ報告向けYAMLデザイン
skills/obsidian-vault/       # ローカル読み取り・検証・保存の共用基盤
skills/obsidian-canvas/      # JSON Canvas診断、配置、承認付き保存
  scripts/                   # 固定依存のオフラインCLIと独自受入データの試験
  assets/templates/          # 関係図、アイデア、手順、比較の構成例
skills/obsidian-bases/       # Basesの直接編集と読み取り専用検査
  scripts/                   # 標準入力の検査器、専用依存のlock、作業コピー用の試験
  assets/templates/          # Table、Cards、List、Kanban
skills/obsidian-markdown/    # ノート作成・編集。ローカル入出力はobsidian-vaultへ
skills/obsidian-cli/         # 明示選択した公式アプリCLI
skills/defuddle/             # 任意導入のWeb・HTML本文抽出。Vaultへ直接保存しない
skills/knap/                 # 任意導入のJSON・CSV生成、プレビュー、Vault外への仮出力
.github/skills/tech-writer   # Copilot CLIが読み込むskills/tech-writerへのシンボリックリンク
.github/skills/consulting-analyst
.github/skills/japanese-prose
.github/skills/presentation-planner
.github/skills/obsidian-vault
.github/skills/obsidian-canvas
.github/skills/obsidian-bases
.github/skills/obsidian-markdown
.github/skills/obsidian-cli
.github/skills/defuddle
.github/skills/knap
```

## 既知の制約

- `consulting-analyst`は、提供済みまたは検証済みの証拠を構造化します。市場データ、顧客情報、見積もり、引用を捏造しません。
- `skills/tech-writer/scripts/lint.py`は、見出し、コードブロック、プレースホルダー、リンク、Markdown強調記号などの構造・表示上の問題を検出します。文章の自然さ、語彙、リズム、読解負荷は、別工程として呼び出される同梱`skills/japanese-prose`がGiNZAで検査します。
- 文書種別は主に日本語の技術文書作成規則を前提としています。コミットメッセージの命令形などを含む多くのガイドは、英語文書にも適用できます。
- `presentation-planner`だけでは`.pptx`バイナリを生成または検証できません。生成と視覚的な品質確認には専用PPTXスキルが必要です。
- デザインのカスタマイズ方法は、`skills/presentation-planner/references/customizing-design-templates.md`に記載されています。

## 謝辞

- [GiNZA](https://github.com/megagonlabs/ginza)（MIT License）— kotonoha独自の日本語文章診断に、形態素解析、品詞タグ付け、係り受け解析、原形化、文境界、固有表現抽出を提供します。

## ライセンス

MIT。詳細は[LICENSE](./LICENSE)を参照してください。
