# kotonoha

kotonohaは、技術文書の作成とプレゼンテーション設計を支援するGitHub Copilot CLIスキルを提供します。`tech-writer`は、開発文書、要件・設計文書、運用・移行文書、調達文書、Qiita・Zenn記事の構成と文章を整えます。対応する文書の一覧は「対応している文書」に掲載しています。`presentation-planner`は、プレゼンテーションシナリオ、スライド構成、デザイン仕様、PPTX作成スキル向けの引き継ぎ情報を生成します。

[English](./README.md) | [日本語](./README-ja.md)

## kotonoha（言の葉）という名前

`kotonoha`は、「言葉」「言語」「和歌」を表す古典的・詩的な表現「言の葉（ことのは）」に由来します。読み手の意図を、明確で構造化された言葉へ育てるという、このプロジェクトの目的を表しています。

『万葉集』との関係には補足が必要です。『万葉集』という書名を「万（よろづ）の言の葉、すなわち数多くの歌」と解釈する伝統的な説がありますが、書名の由来は確定していません。「やまとうたは、人の心を種として、よろづの言の葉とぞなれりける」という有名な表現の直接の典拠は、『万葉集』ではなく紀貫之による[『古今和歌集』仮名序](https://ja.wikisource.org/wiki/%E5%8F%A4%E4%BB%8A%E5%92%8C%E6%AD%8C%E9%9B%86%E4%BB%AE%E5%90%8D%E5%BA%8F)です。

それ以前の『万葉集』にも、言葉が現実に働きかけるという近い思想が「言霊」として詠まれています。奈良県立万葉文化館の「万葉百科」では、山上憶良の[894番歌](https://manyo-hyakka.pref.nara.jp/db/detailLink?cls=db_manyo&pkey=894)や[3254番歌](https://manyo-hyakka.pref.nara.jp/db/detailLink?cls=db_manyo&pkey=3254)で確認できます。「言の葉」の歴史的な語義については、[コトバンク](https://kotobank.jp/word/%E8%A8%80%E3%81%AE%E8%91%89-503155)も参照しています。

## tech-writerが解決する課題

技術文書には、「文章が自然か」と「必要な情報が適切な構成で含まれているか」という別々の課題があります。kotonohaは両方の機能を同梱しています。`tech-writer`が構成と情報の完全性を担当し、独自実装の`japanese-prose`が[GiNZA](https://github.com/megagonlabs/ginza)を使って、文単位の自然さ、読解負荷、用語統一、係り受けの深さ、AIらしい反復表現を検査します。

kotonohaは文書構造と技術的な不変条件を固定してから日本語表現を最適化し、構造を再検証した後にrubber-duck reviewを実施します。

## 主な機能

- README、設計書・ADR、APIリファレンス、PR説明・コミットメッセージ・Issue、リリースノート、ユーザーマニュアル、コードコメント、要件定義書、システム設計書、テスト計画書、運用設計書・Runbook、移行計画書、セキュリティ設計書、技術提案書、RFI・RFP、Qiita・Zenn記事の作成とレビュー
- 文書種別ごとの推奨構成とチェックリスト
- ID、事実、表、コード、受け入れ基準を変更せずに日本語表現を反復的に最適化する、GiNZAベースの独自`japanese-prose`文章診断
- 文書作成後のrubber-duck reviewと、対応可能な指摘がなくなるまでの修正・再レビュー
- `scripts/lint.py`による構造検査。見出しレベルの飛び、言語指定のないコードブロック、未解決のプレースホルダー、不審なリンク、文章に隣接した強調記号を検出
- コミットメッセージ本文とコードコメント・docstringを除き、すべての文書種別でMarkdownを標準形式として使用
- 日本語を主な対象言語とし、英語文書にも対応

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
| 情報提供依頼 | RFI | `rfi` |
| 提案依頼 | RFP | `rfp` |
| 技術記事 | Zenn記事 | `zenn` |
| 技術記事 | Qiita記事 | `qiita` |

再利用可能なテンプレートには、README、設計判断、ユーザーマニュアル、PR説明があります。要件定義、システム設計、テスト、運用、移行、セキュリティの各文書にも対応しています。技術提案、RFI、RFP、Qiita記事のテンプレートも含まれます。すべての文書種別には、`skills/tech-writer/references/doctypes/`配下に専用の構成ガイドとレビューチェックリストがあります。

## presentation-plannerの機能

- 対象者、意思決定、行動喚起、プレゼンテーションの制約を定義
- ブリーフ、対象者の理解を導くシナリオ、主張型タイトルを使ったスライド構成を生成
- YAMLデザイン仕様とPPTX作成スキル向けの決定的な引き継ぎ情報を生成
- 経営判断、技術説明、データ報告向けのシナリオテンプレート
- 経営提案、技術説明、データ報告向けのデザイン仕様
- `.pptx`の生成、バイナリ編集、レンダリング、視覚的な品質確認は専用PPTXスキルへ委譲

## セットアップ

### 前提条件

- GitHub Copilot CLIがインストールされていること
- tech-writerの構造lintを実行する場合はPython 3.9以上
- 同梱`japanese-prose`の文章lint、読解負荷分析、アウトライン抽出、用語検査を実行する場合はPython 3.10以上と`uv`。GiNZA、`ja_ginza`、spaCyは初回実行時に`uv`が解決

### npmからインストール

パッケージをインストールし、同梱CLIでスキルをスキルディレクトリへコピーします。

```bash
npm install --save-dev kotonoha
npx kotonoha install
```

### 同梱スキルをまとめてインストール

`kotonoha install`は、まだ存在しない同梱スキルをすべてインストールします。次のコマンドは、`tech-writer`、`japanese-prose`、`presentation-planner`を`.github/skills/`へインストールします。

```bash
npm install --save-dev kotonoha
npx kotonoha install --skill all
```

`--skill all`が既定値であるため、`npx kotonoha install`も同じ動作です。3つのスキルがインストールされたことを確認します。

```bash
test -f .github/skills/tech-writer/SKILL.md
test -f .github/skills/japanese-prose/SKILL.md
test -f .github/skills/presentation-planner/SKILL.md
```

いずれかのディレクトリがすでに存在する場合、既定のコマンドはそのディレクトリを保持し、不足しているスキルだけをインストールします。すべてのインストール済みスキルをまとめて置き換える場合は、ローカルのカスタマイズを確認またはバックアップしてから実行します。

```bash
npx kotonoha install --skill all --force
```

### 内蔵された日本語表現最適化

kotonohaには独自開発の`japanese-prose`が同梱されるため、文章最適化スキルを別途インストールする必要はありません。`npx kotonoha install`により`tech-writer`と同じスキルルートへ配置され、GiNZAを使った文章lint、読解負荷検査、用語抽出、アウトライン検査、反復的な文章レビューをローカルで実行できます。この実装はkotonoha向けにゼロから開発しており、`natural-japanese`のソースコードを含みません。GiNZAの依存関係とライセンス情報は`skills/japanese-prose/NOTICE.md`に記録しています。

自然言語で指示するときは、GiNZAを明示する必要はありません。日本語文書を自然にする、読みやすくする、簡潔にする、AIらしい定型表現を減らす、といった依頼により、同梱された文章最適化ワークフローが呼び出されます。

```text
README-ja.mdの日本語を自然で読みやすい表現に修正して
```

```text
この設計書の不自然な日本語、長すぎる文、AIらしい反復表現を確認し、
指摘を修正して
```

目的に応じて、次のようにモードを指定できます。

- ファイルを修正する: `README-ja.mdの日本語表現を最適化して`
- 修正せずにレビューする: `README-ja.mdの日本語をレビューして。ファイルは修正しないで`
- 採点だけ行う: `README-ja.mdの日本語表現を100点満点で採点して`
- すべての診断を実行する: `README-ja.mdをfullモードで日本語表現最適化して`
- GiNZAを明示する: `README-ja.mdをGiNZAで解析し、係り受けや読解負荷を改善して`

新しい日本語文書では、`このリポジトリの日本語READMEを作成して`のように依頼すると、`tech-writer`が下書きと構造レビューを行い、rubber-duck reviewの前にGiNZAベースの文章最適化を実行します。文章最適化を確実に指定する場合は、`<ファイル名>を技術文書として作成または修正し、GiNZAによる日本語表現最適化まで実施して`と指示します。

既定のインストール先は、現在のプロジェクトの`.github/skills/tech-writer`、`.github/skills/japanese-prose`、`.github/skills/presentation-planner`です。スキルを1つだけインストールする場合や、別の対応ディレクトリを使用する場合は、次のように指定します。

```bash
npx kotonoha install --skill presentation-planner
npx kotonoha install --target .claude/skills
npx kotonoha install --target ~/.copilot/skills
```

`--skill <name>`を明示したインストールは、既存のスキルディレクトリを上書きしません。既存のインストールを確認またはバックアップし、選択したスキルを置き換える場合にだけ`--force`を指定します。

```bash
npx kotonoha install --force
```

すべてのスキルをインストールする場合、既存のスキルディレクトリはスキップされ、不足しているスキルだけが追加されます。このため、`tech-writer`だけをインストール済みの環境から安全に更新できます。

```bash
npx kotonoha install
# Skipped tech-writer (...)
# Installed japanese-prose (...)
# Installed presentation-planner (...)
```

### kotonohaを更新

インストール済みスキルディレクトリ内のローカル変更を、先に確認してコミットまたはバックアップします。`--force`による更新は、ローカルのカスタマイズを含む対象ディレクトリ全体を置き換えます。

最新の安定版へ更新します。

```bash
npm install --save-dev kotonoha@latest
```

現在のプレリリース版を試す場合は、`next`タグをインストールします。

```bash
npm install --save-dev kotonoha@next
```

npmパッケージを更新しても、コピー済みのスキルは自動更新されません。パッケージ更新後に、同梱スキルを再インストールします。

```bash
npx kotonoha install --force
```

スキルを1つだけ更新する場合は、次のように実行します。

```bash
npx kotonoha install --skill tech-writer --force
npx kotonoha install --skill japanese-prose --force
npx kotonoha install --skill presentation-planner --force
```

最初のインストールで別のインストール先を指定した場合は、同じディレクトリを再度指定します。

```bash
npx kotonoha install --target ~/.copilot/skills --force
```

インストール済みパッケージのバージョンを確認し、置き換えられたファイルをコミット前に確認します。

```bash
npx kotonoha --version
git diff -- .github/skills
```

`--force`なしで`npx kotonoha install`を実行しても既存のスキルディレクトリは更新されず、不足しているスキルだけがインストールされます。

### ソースチェックアウトからインストール

このリポジトリでは、スキルが`.github/skills/`配下にリンクされているため、Copilot CLIで使用するための追加設定は不要です。

別のプロジェクトでソースチェックアウトのスキルを使用する場合は、スキルのディレクトリを対象リポジトリの`.github/skills/`、`.claude/skills/`、またはグローバルの`~/.copilot/skills/`へコピーします。

```bash
cp -r skills/tech-writer /path/to/your-repo/.github/skills/tech-writer
cp -r skills/japanese-prose /path/to/your-repo/.github/skills/japanese-prose
cp -r skills/presentation-planner /path/to/your-repo/.github/skills/presentation-planner
```

## Copilotに文書作成を依頼

Copilot CLIセッションで必要な文書種別を依頼すると、対応するスキルが自動的に呼び出されます。

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
skills/tech-writer/          # tech-writerスキル
  SKILL.md                   # スキル定義
  references/                # 構成原則、文書種別ごとの規則とチェックリスト
  references/doctypes/       # README、要件、設計、テスト、運用、移行、セキュリティ、API、PR・Issue、リリースノート、提案、RFI・RFP、Qiita・Zenn
  scripts/lint.py            # 構造とMarkdown表示のlintスクリプト
  assets/templates/          # 要件、設計、テスト、運用、移行、セキュリティ、調達などの文書テンプレート
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
.github/skills/tech-writer   # Copilot CLIが読み込むskills/tech-writerへのシンボリックリンク
.github/skills/japanese-prose
.github/skills/presentation-planner
```

## 既知の制約

- `skills/tech-writer/scripts/lint.py`は、見出し、コードブロック、プレースホルダー、リンク、Markdown強調記号などの構造・表示上の問題を検出します。文章の自然さ、語彙、リズム、読解負荷は、別工程として呼び出される同梱`skills/japanese-prose`がGiNZAで検査します。
- 文書種別は主に日本語の技術文書作成規則を前提としています。コミットメッセージの命令形などを含む多くのガイドは、英語文書にも適用できます。
- `presentation-planner`だけでは`.pptx`バイナリを生成または検証できません。生成と視覚的な品質確認には専用PPTXスキルが必要です。
- デザインのカスタマイズ方法は、`skills/presentation-planner/references/customizing-design-templates.md`に記載されています。

## 謝辞

- [GiNZA](https://github.com/megagonlabs/ginza)（MIT License）— kotonoha独自の日本語文章診断に、形態素解析、品詞タグ付け、係り受け解析、見出し語化、文境界、固有表現抽出を提供します。

## ライセンス

MIT。詳細は[LICENSE](./LICENSE)を参照してください。
