# Obsidian操作ガイド

対象のVaultと読み取り範囲を指定し、診断・候補・保存を分けて実行する。
Obsidianアプリ、公式CLI、MCP、コミュニティプラグインは不要である。
Skillへの自然言語の依頼例は次のとおり。

```text
/absolute/path/to/vault の Notes と Targets を読み取り対象にして、
内部リンクを診断して。未作成リンクは修復しないで。
```

```text
このVaultのNotes/draft.mdを誤りだけ添削して。
差分を確認するまで保存しないで。
```

## 導入と起動

既存の同名Skillを無断で置換しない。必要な兄弟Skillは別途導入する。

```bash
npx kotonoha install --skill obsidian-vault
npx kotonoha install --skill tech-writer
npx kotonoha install --skill japanese-prose
```

既存のjapanese-proseが古い場合は共通ゲートを利用できず、依存不足となる。
既存Skillのローカル変更を確認・退避し、利用者が更新を許可してから、対象Skillだけを`--force`付きで再導入する。

Linux、CPython 3.12、uvが必要である。依存関係の初回準備は通信が発生し得るため、利用者の別途許可を得て実行する。

```bash
uv sync --locked --python 3.12 --script .github/skills/obsidian-vault/scripts/vault.py
```

実際のノート処理は必ずオフラインの固定起動経路を使う。
起動に失敗した場合、ホストは機能を未実施と説明する。未起動のスクリプトのJSON結果を捏造しない。

```bash
uv run --offline --locked --python 3.12 .github/skills/obsidian-vault/scripts/vault.py inspect --request /absolute/workspace/request.json
```

## 依頼ファイル

正本は[execution-contract.json](execution-contract.json)である。
以下は、指定範囲のリンクを調べる依頼の例である。絶対パスは実際の場所に置き換える。
model_contextは、この範囲の情報をホストモデルへ渡す同意を得た場合だけtrueにする。

```json
{
  "schema_version": 1,
  "vault_root": "/absolute/path/to/vault",
  "read_scopes": [
    {"kind": "directory", "path": "Notes"},
    {"kind": "directory", "path": "Targets"}
  ],
  "purpose": "許可された範囲のリンク診断",
  "intent": "links",
  "write_target": null,
  "base_sha256": null,
  "deliverable": null,
  "declared_rules": [],
  "protected_terms": [],
  "workspace": null,
  "consent": {"model_context": true, "workspace_copies": false},
  "limits": {"max_files": null, "max_file_bytes": null, "max_total_bytes": null}
}
```

全Vaultを明示的に許可した場合だけ、read_scopesをdirectoryの`.`にする。
ファイル単位ではkindをfileとする。`.obsidian`と`.git`は通常探索から除外し、内容を取得しない。
上限のnullは、指定範囲にその上限を設けない指定である。上限を使う場合は事前に合意し、打ち切り結果を確認する。

intentはconventions、related、links、create、proofreadから選ぶ。
規約を宣言した資料は、許可範囲内のパスとしてdeclared_rulesに指定する。
観測は名前・フォルダー・プロパティ名と型・タグの事実であり、一般的な規約の推測とは区別する。

## 原文、計画、適用

以降のコマンドでは、共通の起動部分を省略している。

```text
read --request request.json --path Notes/draft.md
plan --request request.json --candidate /absolute/workspace/candidate.md --review /absolute/workspace/review.json
apply --request request.json --plan /absolute/workspace/OPERATION_ID/plan.json --approve-plan-sha256 PRESENTED_HASH
```

添削ではintentをproofread、write_targetを対象パスにする。
最初のreadではbase_sha256をnullにできる。候補作成前に取得した原文のSHA-256を設定してからplanを呼ぶ。
原文を再取得せずにハッシュだけを新しいものに付け替えない。原文が変わったら候補とレビューも作り直す。
workspaceにはVault外の既存の絶対パスを指定し、コピーへの同意を得てworkspace_copiesをtrueにする。

レビューの形式は[japanese-proseの意味レビュー手順](../../japanese-prose/references/review-workflow.md)に従う。
planは入力の候補をそのまま検査し、検査のために保護対象を自動修復しない。
合格した計画はworkspace内の操作IDごとの0700ディレクトリに保存する。
before.md、candidate.md、diff.patch、semantic-review.json、plan.jsonは0600で保持する。
原文と候補が同じ場合はno_changesとなり、計画も保存も行わない。

新規作成はintentをcreateにし、base_sha256をnullにする。
完成ノートではdeliverableをnote、再利用用テンプレートではtemplateとする。
両方とも本文・保存先・計画の承認が必要である。完成ノートに変数が残っていれば保存を拒否する。
親フォルダーを先に用意し、対象を`.md`のパスにする。既存ファイルは上書きしない。
新規ノートの権限は通常のファイル作成と同じくumaskを適用し、編集では既存の所有者・グループ・権限を維持する。

planの内容と差分を実際に確認してから、その計画のSHA-256を承認する。
applyの引数は承認されたバイト列を固定するためのもので、人間の承認の代わりにはならない。
applyは同じ親に`.kotonoha-OPERATION_ID.tmp`を作り、完全な内容を同期してから確定する。
作成済み対象の再確認が必要な再実行では、その対象への読み取り許可も必要である。

## 診断と失敗の読み方

stdoutのJSONにあるexit_codeは終了コードと一致する。

| 終了コード | 処理結果 | 対処 |
|---|---|---|
| 0 | completed | データと保存状態を確認する |
| 1 | failed | 入力または実行時の問題。保存状態がunknownなら内容確認が先 |
| 2 | not_performed | 権限、承認、競合、保護検査の理由を確認する |
| 3 | partial | 未処理・判定不能の範囲と理由を確認する |
| 4 | not_performed | 依存関係または必要機能の不足を確認する |

未解決リンクと曖昧なリンクだけでは処理失敗にしない。
名前だけのwikilinkは、部分範囲で候補が0件・1件でも判定不能となる。
許可範囲で同名候補を2件確認できた場合は曖昧となる。
明示パスと同一ノートの見出しは、必要な有限範囲を確認できれば部分範囲でも診断する。
コードとObsidianコメントの例示は数えず、外部URLは集計するだけでアクセスしない。

見出しは平文の完全一致、大文字小文字とUnicodeは厳密比較とする。
装飾・文字参照の変換、slug、ブロックID、添付ファイルなどには対応しない。
閉じていないフェンス・コメント・frontmatterや非対応YAMLを正常として扱わない。
プロパティは平坦な辞書とスカラーまたは平坦なリストに限定し、アンカー、重複キー、入れ子を拒否する。
Obsidian自体と同じ解決結果になるとは限らない。

## 保存の限界と復旧

保存対象は通常ファイルに限り、シンボリックリンクを追跡しない。
LinuxのローカルFSでも確認できた方式だけを使う。未知のFSやネットワークFSは保存しない。
所有者・グループ・権限を維持できない対象、複数ハードリンク、拡張属性付きの対象も保存しない。
SELinuxラベルも拡張属性に含む。安全機能の削除を回避策にしない。

同じSkillの保存は直列化するが、最終照合直後の外部エディターの変更を完全には防げない。
ホストの同意の取り違え、LLMの意味判断、同権限プロセスの改変も完全には防げない。
保護検査、意味レビュー、人間の差分承認を別々の確認として扱う。

receipt.jsonは保存後の検証済み記録、result.jsonは本文を含めない結果記録である。
保存開始時にはresult.jsonへ結果未確定の記録を置き、強制終了を検出できるようにする。
成功記録と現在の対象が一致すれば、再実行は再保存せずalready_appliedを返す。
成功記録が不正、欠落した記録から以前の保存が疑われる、現在の内容が変わった、という場合は自動再保存しない。
unknownは「変更なし」を意味しない。対象、原文、候補、一時ファイル、記録を確認し、新しい計画が必要か判断する。
一時ファイルや操作ディレクトリは利用者の確認なしに掃除しない。
削除を依頼された場合も、確認した操作ディレクトリの既知ファイルだけを対象にする。
