# kotonoha

kotonoha は、技術文書の構成・型・仕上げを支援する GitHub Copilot CLI 用スキル `tech-writer` を提供するリポジトリです。README・設計ドキュメント/ADR・API仕様書・PR説明文/コミットメッセージ/issueレポート・リリースノート・ユーザーマニュアル/手順書・コードコメントを、読者が迷わない「型」に沿って書く/直すことができます。

## tech-writer が解決する課題

技術文書は「文章として自然か」と「構成として過不足がないか」の2層の問題を抱えがちです。`tech-writer` は後者に特化し、前者(文単位の自然さ・AI臭さの除去)は [natural-japanese](https://github.com/coji/natural-japanese) のような文章校正スキルに委ねます。両方を導入すると、構成を `tech-writer` で確定させた後、日本語の文章を natural-japanese で磨く、という組み合わせで使えます。

## できること

- README・設計ドキュメント/ADR・API仕様書・PR説明文/コミットメッセージ/issueレポート・リリースノート・ユーザーマニュアル・コードコメントの新規作成/レビュー
- doctype別の型とチェックリストに沿った執筆支援
- `scripts/lint.py` による構成面の機械チェック(見出し階層の飛び、コードブロックの言語指定漏れ、プレースホルダの残存、リンク切れの疑いなど)
- 日本語主軸、英語文書作成にも対応

## セットアップ

### 前提条件

- GitHub Copilot CLI がインストール済みであること
- lintスクリプトを実行する場合は Python 3.9 以上(標準ライブラリのみで動作、追加インストール不要)

### インストール

このリポジトリ内で Copilot CLI を使う場合、スキルは `.github/skills/tech-writer` に配置済みのため追加作業は不要です。

他のプロジェクトで使う場合は、`skills/tech-writer` ディレクトリを対象リポジトリの `.github/skills/`、`.claude/skills/`、または `~/.copilot/skills/`(グローバル)にコピーしてください。

```bash
cp -r skills/tech-writer /path/to/your-repo/.github/skills/tech-writer
```

## 使い方

Copilot CLI のセッション内で、対象文書の種類を含めて依頼するだけで自動的に呼び出されます。

- 「READMEを書いて」「この設計ドキュメントをレビューして」「PRの説明文を書いて」「この手順書を分かりやすくして」

構成面のみの簡易診断を行いたい場合:

```bash
uv run skills/tech-writer/scripts/lint.py --json path/to/document.md
```

`uv` がない環境では `python3 skills/tech-writer/scripts/lint.py path/to/document.md` でも実行できます(標準ライブラリのみに依存)。

## リポジトリ構成

```
skills/tech-writer/          # スキル本体
  SKILL.md                   # スキル定義
  references/                # 構成憲法・doctype別の型とチェックリスト
  references/doctypes/       # README・設計書・API仕様書・PR/issue・リリースノート・手順書・コメントの型
  scripts/lint.py            # 構成面の検査スクリプト
  assets/templates/          # 主要doctypeの雛形
.github/skills/tech-writer   # skills/tech-writer へのシンボリックリンク(Copilot CLIが読む場所)
```

## 既知の制約

- `scripts/lint.py` は構成面(見出し・コードブロック・プレースホルダ・リンク)のみを検出し、文章の自然さ・語彙・リズムは検出しません。
- doctypeは日本語の技術文書慣習を主に想定しており、英語文書では一部の型(特にコミットメッセージの命令形規則など)がそのまま適用できます。

## 参考にしたプロジェクト

- [natural-japanese](https://github.com/coji/natural-japanese)(MIT License) — 「検出は機械、判断は人間(またはエージェント)」「事後修正より生成時制約」という設計思想を参考にしました。

## ライセンス

MIT. See [LICENSE](./LICENSE).
