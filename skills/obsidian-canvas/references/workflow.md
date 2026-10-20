# Obsidian Canvasの操作ガイド

Canvas専用の5コマンドで、許可範囲の読み取りから差分承認、1ファイルの保存までを分離する。
制御ファイルの正本は[execution-contract.json](execution-contract.json)である。
以下のパスと数値は説明用であり、利用者の許可を表す値ではない。

## 導入

初期対応はLinux、CPython 3.12、uv、検証できるローカルFSである。
Obsidianアプリ、MCP、プラグインは不要である。
同じSkillルートにobsidian-vaultを置き、共用APIの版が1であることを必要とする。
旧公開版0.4.1にはこのAPIがない。Canvas単独導入は兄弟を自動追加・更新しない。
依存不足ではdependency_missingとなり、更新の許可を得るまで処理を行わない。

未導入の場合の選択導入は次のとおりである。開発中のCanvasは公開版0.4.1には含まれない。
既存Skillは既定では保持される。更新が必要なら、ローカルの変更を確認し、利用者の承認後に対象を明示して置換する。

```bash
kotonoha install --skill obsidian-canvas
kotonoha install --skill obsidian-vault
```

上記はCopilot向けの導入例である。Claude Codeでは両コマンドに`--agent claude`、両方には`--agent all`を付ける。CanvasとVaultの兄弟Skillは、エージェントごとの同じルートに置く。

添削にはjapanese-proseも必要である。通常の図の編集では必須にしない。
初回の依存準備で通信する場合は、対象と目的を説明して別に許可を得る。

```text
uv sync --locked --python 3.12 --script <canvas-dir>/scripts/canvas.py
```

実行では必ず固定されたオフライン経路を使う。パスに空白があれば、シェルで1引数になるよう引用する。

```text
uv run --offline --locked --python 3.12 <canvas-dir>/scripts/canvas.py inspect --request /absolute/private/request.json
uv run --offline --locked --python 3.12 <canvas-dir>/scripts/canvas.py inspect --request /absolute/private/request.json --path Maps/research.canvas
uv run --offline --locked --python 3.12 <canvas-dir>/scripts/canvas.py read --request /absolute/private/request.json --path Maps/research.canvas
```

Vault内の本文はこのinspect/readで取得する。ホストの汎用ツールで許可範囲の確認を迂回しない。
readは許可された`.md`と`.canvas`に対応し、添付の本文は取得しない。

## 読み取り依頼

Vaultの絶対パス、目的、読み取り範囲、モデルに渡す情報を事前に確定する。
次の例はMapsだけを対象とする。model_context=falseのままでは読み取らない。
同意を確認してからtrueにし、勝手に範囲を`.`へ拡大しない。
上限のnullは明示的な無制限である。必要な上限を合意してから数値を設定する。

```json
{
  "schema_version": 1,
  "vault_root": "/absolute/vault",
  "read_scopes": [{"kind": "directory", "path": "Maps"}],
  "purpose": "選択したCanvasの構造と参照を診断する",
  "intent": "inspect",
  "write_target": null,
  "base_sha256": null,
  "workspace": null,
  "consent": {"model_context": false, "workspace_copies": false},
  "limits": {"max_files": null, "max_file_bytes": null, "max_total_bytes": null},
  "mutations": [],
  "markings": [],
  "protected_terms": [],
  "allow_formatting": false,
  "layout": null,
  "operation_nonce": null
}
```

管理フォルダーは大文字小文字の違いも含めて探索せず、シンボリックリンクを追わない。
範囲外の参照は存在確認も行わない。追加の参照先本文を読むには新しい読み取り許可が必要である。
参照先の実在と、その内容や関係が正しいことは別々に報告する。

## 候補、配置、変更対象

成果物と補助ファイルは、セッション領域へ一切保存しない。`~/.copilot/session-state/`も対象とする。
依頼、原文、候補、差分、診断、レビュー、計画、保存記録、結果、一時ファイルにも同じ制約を適用する。
作業ディレクトリはユーザー指定を優先し、未指定なら依頼開始時のカレントディレクトリを使う。
相対指定の作業ディレクトリは開始時のカレントから、相対保存先は選択した作業ディレクトリから解決する。
Vaultルート基準と明示されたパスや絶対パスは維持する。CLIのVault相対パスを作業ディレクトリ基準に変換しない。
書き込み前に実体の保存場所を確認し、セッション領域への指定なら別の場所への許可を得るまで止める。
CLIのworkspaceには引き続きVault外の場所が必要であり、セッション領域へ自動退避しない。
委譲先にも保存場所と同じ制約を引き継ぎ、ファイルが不要な診断には標準出力を使う。

作成ではintent=create、保存先、Vault外のworkspace、コピー同意を設定する。
base_sha256はnull、mutationsは空とし、候補全体を承認対象にする。
編集ではintent=editとし、readで得た原文のbase_sha256と保存先を設定する。
候補生成後に原文が変わった場合は、再取得して提案からやり直す。
保存先の親を自動作成しない。

operation_nonceはホストが1操作につき生成する128bitのランダム値を32桁の小文字16進数で記録する。
同一計画ではその値を維持し、衝突・不明状態の回避のため自動更新しない。
workspaceと操作ディレクトリは現在の利用者所有の0700、入力やコピーは0600とする。
候補・レビュー・計画の途中の親もシンボリックリンクにしない。

変更はノードまたは接続のIDと属性で指定する。
次の例はnode-aの位置だけを変更し、他の値や存続IDの順序は変えない。

```json
[
  {"entity": "node", "id": "node-a", "action": "set", "fields": ["x", "y"]}
]
```

追加・削除はadd/removeと空のfieldsを使う。
同じIDの種別変更はremove/addの対を明示し、接続先を黙って付け替えない。
nodes/edgesの有無や順序を意図的に変える場合は、documentの仮想属性を明示する。
削除するカードに依存する接続の削除は、計画で接続IDごとに確認する。
JSONの整形差分も承認対象とし、changed editではallow_formatting=trueを必要とする。

自動配置はgrid、horizontal、verticalと対象IDの順序を指定する。
最大幅・最大高と正の余白で位置を計算し、group、非正寸法、既存groupとの交差を拒否する。
配置だけでは参照や実表示を確認したことにはならない。

```text
uv run --offline --locked --python 3.12 <canvas-dir>/scripts/canvas.py layout --request /absolute/private/layout-request.json --candidate /absolute/private/input.canvas
```

layoutは別の候補を作り、原文や入力候補を変更しない。
結果をplanへ渡すときはlayoutをnullに戻し、位置変更をmutationsに反映した新しい依頼を用意する。

## 印とレビュー

印は`[根拠あり] `、`[提案] `、`[未確認] `のいずれかを、既知の文字列属性の先頭に置く。
直後にはASCII空白1文字を付ける。
追加または意味内容を変える対象には、対象と印の対応をmarkingsで宣言する。

```json
{
  "entity": "node",
  "id": "file-a",
  "carrier_entity": "node",
  "carrier_id": "evidence-group",
  "carrier_field": "label",
  "category": "evidence"
}
```

file/linkカードは先行する包含groupを使う。text、group、接続ラベルは自分自身にも対応付けられる。
自己の印を優先し、なければ最内側のgroupを使う。複数のgroupで分類が矛盾すれば拒否する。
移動やgroupの削除・分類変更が、未変更のカードへ与える影響も計画に示す。
file/linkへ独自のlabelや子一覧を追加しない。

すべての変更計画には、原文・候補の正確なハッシュと実際の担当者を持つReviewが必要である。
diagram_checksで意図、根拠の区別、印の保持、依存変更、配置データを実際に確認する。
create/editのsemantic_checksはnullとする。
添削ではintent=proofreadとし、変更文字列ごとのStringReviewを必要とする。
選択したtext.text、group.label、edge.label以外を変えない。

StringReviewにはentity、id、field、文字列の前後UTF-8ハッシュと、9項目のchecksを記録する。
図全体のハッシュと文字列のハッシュを取り違えない。
変更文字列との完全一致が必要であり、余分・欠落・重複・古いハッシュは通過しない。
実際に確認していない項目をtrueにせず、合格するための意味レビューを自動生成しない。
添削で印の分類や数量対応、リンク、コード、見出し、用語を変えない。

## 計画と承認

```text
uv run --offline --locked --python 3.12 <canvas-dir>/scripts/canvas.py plan --request /absolute/private/request.json --candidate /absolute/private/input.canvas --review /absolute/private/review.json
```

planはVaultを変更しない。原文と候補が同一バイト列なら、レビューや保存能力を要求せずno_changesを返す。
変更計画では操作ディレクトリに原文、候補、レビュー、差分、変更一覧、診断、plan.jsonを保持する。
新規作成ではbefore.canvasを作らない。
利用者には保存先、正確な全アーティファクトのパス、計画ハッシュ、完全な差分、未確認事項を提示する。
同じ親の一時ファイル、外部編集の競合、保持・削除方法、実表示の未確認も説明する。
後でObsidianを開くとURLカードなどが通信し得ることを伝える。

実際の利用者がこの計画と差分を承認した後にだけapplyする。
次の引数値は説明用であり、過去のハッシュやAIの判定を人間の承認として使わない。

```text
uv run --offline --locked --python 3.12 <canvas-dir>/scripts/canvas.py apply --request /absolute/private/request.json --plan /absolute/private/OPERATION_ID/plan.json --approve-plan-sha256 APPROVED_PLAN_SHA256
```

依頼、内容、レビュー、検査コード、対象の実体が変われば再承認する。
保存は1操作1Canvasに限定し、ノート・添付を変更しない。

## 結果と復旧

| 終了コード | 意味 |
|---|---|
| 0 | 完了。保存要求がない場合と検証済み保存を区別する |
| 1 | 入力または実行失敗。確定後の失敗はunknownになり得る |
| 2 | 同意、権限、競合、検査による拒否。今回の保存なし |
| 3 | 判定不能や未処理が残る。検証済み保存を伴う場合もある |
| 4 | 兄弟Skill、依存関係、安全な保存機能等が不足 |

未解決・曖昧・外部URLだけで部分実施にせず、理由ごとの規則に従う。
partial/saved/verified=trueは、保存を確認したが参照に未確認が残る結果である。
failed/unknownは今回の保存結果が不明であり、自動再保存やロールバックを行わない。
参照先は保存後も変わり得る。計画時の診断と適用時の現在の診断を区別する。

成功記録と現在の候補が一致する再実行だけをalready_appliedとする。
過去の不確定な記録、記録の不正・不一致、既存の一時ファイルを、消してやり直す回避策にしない。
対象と原文・候補・記録を利用者が確認し、正確な既知パスの削除や新しい計画を明示承認した場合だけ再開する。
同じ親への原子的な保存でも、最終照合直後の外部編集と同権限の悪意あるプロセスを完全には防げない。
