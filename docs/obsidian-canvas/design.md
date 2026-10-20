# Obsidian Canvas専用Skill 設計書

承認済みのCanvas要件に対し、専用の検査と既存の安全な保存処理を組み合わせる。
本書、実行契約、独自の受入データを設計レビューと利用者承認の対象とする。

- 文書版: 0.3
- 作成日・最終更新日: 2026-10-19
- ステータス: In Review。設計全体の承認前。
- 要件: `docs/obsidian-canvas/requirements.md`、文書版0.2。
- 要件SHA-256: `9ccca26b16934cb0bb5d408897c35454b2349c068bf75d21176d5c9a636c121f`
- 承認履歴: `docs/obsidian-canvas/approvals.json`。文書内の作成時点の状態より、別管理の実際の承認履歴を優先する。
- 導入方式: 利用者は`obsidian-vault`を必須の兄弟Skillとする構成を選択済み。

## 正本と構成

機械インターフェースの正本を`skills/obsidian-canvas/references/execution-contract.json`とする。
コマンド、必須フラグ、型、出力、終了コードはこのファイルから検証する。
本書は、機械スキーマだけでは表せない分類の優先順、変更の判定、保存の前提を規定する。
期待値の正本は`docs/obsidian-canvas/acceptance-cases.json`とし、製品の実行結果から生成しない。

| 配置予定 | 責務 |
|---|---|
| skills/obsidian-canvas/SKILL.md | 日本語での受付、4用途の構成提案、送信・コピーの同意、実際の差分承認 |
| skills/obsidian-canvas/references/workflow.md | 導入、操作、診断結果、制約、復旧の説明 |
| skills/obsidian-canvas/references/execution-contract.json | 実行契約。実装より先に承認する |
| skills/obsidian-canvas/assets/templates/ | 4用途の独自Canvas例。例の参照先を実在すると説明しない |
| skills/obsidian-canvas/scripts/canvas.py | Canvasの解析、参照・配置の診断、変更検査、計画、適用 |
| skills/obsidian-canvas/scripts/canvas.py.lock | オフライン起動用の依存固定 |
| skills/obsidian-canvas/scripts/test_canvas.pyと対応lock | 独立した期待値との照合、保存・拒否・復旧の試験 |
| skills/obsidian-vault/scripts/vault.py | 共用するファイル操作と確定処理。従来のMarkdown用インターフェースは維持する |

常駐サービス、MCP、独自データベース、永続的な全文索引を追加しない。
図の意味内容は、許可された資料と利用者の意図からホストが提案する。
スクリプトは、その提案を独立して検査し、モデルの説明だけで保存を許可しない。

## 起動、依存、導入

起動部分は次のとおりとする。`<canvas-dir>`はインストール先のSkillディレクトリを指す。

```text
uv run --offline --locked --python 3.12 <canvas-dir>/scripts/canvas.py COMMAND ...
```

CPython 3.12、uv、Linuxを前提とし、Python依存は`markdown-it-py>=3,<5`、`PyYAML>=6,<7`、`jsonschema>=4,<5`とする。
初回の`uv sync --locked --python 3.12 --script <canvas-dir>/scripts/canvas.py`は通信の許可を別に得る。
実際の処理では自動ダウンロードせず、固定されたオフライン経路が起動できなければ未実施とする。

単独インストールはCanvasだけを追加する。`obsidian-vault`を自動導入・置換しない。
兄弟の`vault.py`を既知の相対位置から読み、`STORAGE_API_VERSION=1`と必要な関数を確認する。
旧版などで共用APIがない場合も依存不足とし、利用者が許可するまで更新しない。
`japanese-prose`は添削時に必須とし、通常の図の編集には必須にしない。
文書構成や論点整理を兄弟Skillへ委ねる場合は、その存在と利用許可を確認する。

## コマンドの責務

| コマンド | 入力 | 結果 | 書き込み |
|---|---|---|---|
| inspect | request、任意のpath | Canvasごとの構造・参照・配置の診断 | なし |
| read | request、path | 原文、SHA-256、バイト数。Canvasには診断も付ける | なし |
| layout | request、外部領域のcandidate | 選択したカードを機械配置した別候補 | 同意済みの外部領域のみ |
| plan | request、candidate、必要なreview | 検証済み計画と差分、または変更なし・拒否 | 同意済みの外部領域のみ |
| apply | request、plan、承認した計画のSHA-256 | 保存・検証・再実行の結果 | 許可された1Canvasと外部領域 |

すべてのコマンドでmodel_contextの同意を先に確認する。
layout、plan、applyにはworkspace_copiesの同意も必要とする。
Vaultの本文は本経路のinspectまたはreadで取得し、ホストの汎用ツールで権限確認を迂回しない。
候補とレビューは、許可済みのVault外の領域にホストが準備する。
候補・レビュー・計画・結果の入力は同意済みworkspaceの内側に限定し、途中の親もリンクを追わない。
workspaceと操作ディレクトリは現在の利用者所有の0700、制御・コピーは0600を必要とする。
CLIでは未知・重複したフラグ、必須値の欠落を入力失敗にする。引数内のパスをシェルとして実行しない。

inspectでpathを指定した場合は、そのCanvasだけを解析する。未指定なら許可範囲内のCanvasを列挙する。
readの対象は`.canvas`と`.md`に限定する。添付は参照診断で存在と通常ファイルかどうかだけを確認する。
読み取り不能は、inspectでは部分実施、readでは実行失敗とする。
読めた原文の構造が不正・非対応の場合は部分実施とし、検証済みの文書として扱わない。
UTF-8で復号できない原文はcontentをnullとし、ハッシュと非対応理由だけを返す。
原文、候補、依頼ファイルのJSONは、重複キーと非有限数を拒否する。

## 共用する保存基盤

既存の公開契約、コマンド名、Markdownの検査、出力を維持したまま、次の内部APIを抽出する。
共用APIの呼び出し元は信頼する製品コードであり、利用者が読み取り可能な形式を任意に増やす入口にはしない。

| API | 振る舞い |
|---|---|
| Vault.read_authorized(path, maximum) | 範囲確認後、親のディスクリプターをたどり、通常ファイルを上限付きで読む。呼び出し元が形式を制約する |
| Vault.stat_authorized(path) | 範囲を確認してから、リンクを追わず存在・型を確認する。添付内容を読まない |
| Vault.enumerate_authorized(suffixes, strict_file_scopes) | 許可範囲を列挙し、必要な拡張子だけを返す。未処理領域と完全性を返す |
| commit_bytes | 一時ファイル、同期、直前照合、確定、確定後照合、所有した一時ファイルの片付けを共用する |

従来のVault.readは`.md`制約を維持して共用APIへ委譲する。
従来の列挙も、`.md`以外の明示ファイル範囲を拒否する振る舞いを維持する。
Canvas側の列挙では、許可された別形式の明示ファイルを勝手に読み込まず、必要な形式の走査から除外する。
Markdownの解析器、コード・コメントの除外、既知の内部リンク判定は、既存の関数を再利用する。
ただしtextカードにはノートのプロパティがないため、frontmatterの除去処理を適用しない。

commit_bytesは、既に確認した親ディスクリプター、対象名、原文と候補、原文の属性、期待するルート・親の実体を受け取る。
呼び出し元は、メモリ上のprogressで確定済みかどうかを把握できる。例外によって確定情報を失わない。
結果・成功記録、計画の解釈、意味レビューは呼び出し元が担当し、共用APIにCanvasの制御入力を混ぜない。
既存のapplyも同じ確定部分を使う。既存の障害注入・再実行・同時操作の試験を回帰条件にする。
新しいコードへ変わるため、従来の未適用計画はimplementation_changedとなり、再計画・再承認が必要になる。

## 文書の解析と分類

まず厳密なUTF-8とJSONを確認する。BOM、復号不能、未対応のUnicode文字列は非対応とする。
整数を表す数値は真偽値と区別し、JavaScriptで正確に表せる整数の範囲に限定する。
数値の字句は十進で正確に読み、浮動小数点への丸め後に整数性や上限を判定しない。
対応範囲の整数値は内部でintに正規化できるが、ハッシュと原文には受け取ったバイト列を使う。
指数表記と負のゼロも数学的に整数なら受け入れ、非整数はinvalid_typeとする。
Decimalで正確に整数性と範囲を検査してから内部表現へ変換する。巨大な指数・桁数もinteger_rangeとし、floatやPythonのint桁数制限に依存しない。
Decimalでも構築できない巨大な指数は、JSON数値の仮数・小数桁数・指数を字句で比較して分類する。
仮数がすべてゼロなら指数の大小・符号にかかわらず対応する。非ゼロの巨大な正指数はinteger_range、巨大な負指数で整数でなければinvalid_typeとする。
指数の大小は桁数と十進文字列で比較し、指数に比例する整数やゼロ埋め文字列を構築しない。
上記のinteger_rangeは巨大な整数値の場合であり、正確な非整数を非対応扱いして隠すものではない。
DocumentのJSON Schemaは対応済みモデルの形の検査であり、不正・非対応の分類器ではない。ID重複と接続先も別に検査する。
それを越える整数は仕様違反ではなく、本実装の非対応として診断する。
色は6種類のプリセット文字列と`#RRGGBB`だけに対応し、16進の大文字小文字は受け入れる。
他の色表記は不正と断定せず非対応とする。

| 優先順 | 検出 | structureと参照 |
|---|---|---|
| 1 | UTF-8や文字列の非対応 | unsupported。参照は解決しない |
| 2 | JSON構文、重複キー、非有限数、既知属性の型・列挙値、ID重複、接続先欠落の不正 | invalid。確定した参照結果を出さない |
| 3 | 未知属性・ノード種別、対応範囲外の数値や色 | unsupported。既知部分を示し、抽出した参照はsource_parse_incompleteとする |
| 4 | 既知の構造だけで成立 | supported。参照と配置を診断する |

キーの未知判定は、文書、各ノード、各接続で行う。
nodesとedgesの省略は有効であり、空配列へ自動補完しない。
ノードIDと接続IDは集合ごとに重複を検査し、異なる集合の同じIDは許す。
必須ではない属性に既定値を書き戻さない。配列順と、既存の属性の有無も保持対象にする。
構造が不正・非対応の原文を、標準属性だけ抜き出して編集できたように扱わない。
編集時は原文と候補の両方を検査し、どちらかが不正・非対応なら保存しない。

## 参照の診断と保存ポリシー

| 対象 | 解決規則 |
|---|---|
| fileノードのfile、groupのbackground | Vaultルートからの厳密な相対パス。名前だけの検索やURLデコードはしない |
| fileノードのsubpath | `.md`に対する`#平文見出し`だけを検証する。重複、装飾、ブロックID、非Markdownは判定不能になり得る |
| textのwikilink | 既存のノート解決規則を使う。名前だけなら全Vaultの必要領域の完全性が必要。既知の複数候補は先に曖昧とする |
| textのMarkdownリンク | Canvasのフォルダーを基準に1回だけURLデコードする。対象は`.md`、見出しは平文の完全一致 |
| textの同一文書内参照、添付埋め込み等 | 確認できる記法以外は判定不能とし、Obsidian固有の解決を推測しない |
| linkノードのurl | HTTP・HTTPSでホストがある形式を許可。存在は確認せずexternal_urlとして報告する |

file・backgroundでVault外や管理フォルダーを示すパスと、非対応URL方式はpolicy_forbiddenをtrueにする。
text内の範囲外・管理参照は存在確認せずforbidden_pathとするが、policy_forbiddenはfalseとする。
Canvas全体の保存拒否は、承認済み要件どおりfile・background・link.urlに限定する。
管理パスはASCIIの大文字小文字を無視した事前フィルターで拒否し、`.OBSIDIAN`や`.Git`も探索しない。他のパス名を推測変換しない。
それ以外の範囲外の参照は存在確認もせずoutside_scopeとし、必要な権限を勝手に追加しない。
親参照は、正規化後もVault内で許可されるMarkdown相対リンクだけに認める。fileとbackgroundでは認めない。
シンボリックリンクをたどらず、未処理領域では欠落や一意性を確定しない。
`.md`の参照では、既存の解析器による致命的な解析失敗をtarget_parse_incompleteとする。
添付は本文を読まず、メタデータだけで診断する。明示的な参照先に候補検索を足さない。
個別参照では構文・禁止先、読み取り範囲、存在と通常ファイル、対象の解析、subpathの順に確認する。
存在が確認できたファイルの非対応subpathは、そのパスをcandidatesに残す。ディレクトリは候補にしない。
制御文字を含むパスと、制御文字・空白を含むURLも、存在確認前に禁止先として扱う。

HTTP等の外部リンクは内部参照の欠落として扱わず、通信しない。
external_urlと配置上の注意だけでは部分実施にしない。
未解決と曖昧も、判定を完了できた結果であり、それだけでは処理失敗にしない。
参照理由ごとの部分実施条件は実行契約のx-reference-reasonsを正本とする。
その分類との対応、Diagnosticのcategoryとcodeの対応も実行契約に照合し、未知の理由を勝手に追加しない。
external_url以外の判定不能と未処理領域は部分実施とする。未解決・曖昧だけなら保存後も完了とする。
許可された判定不能参照を残して保存した場合は、保存済みと部分実施を併記する。
保存禁止の参照が原文にあれば、関係のないカードの変更でもCanvas全体の編集を拒否する。
参照診断はその実行時点の結果であり、参照先の内容や実在が保存後も不変とは保証しない。

## 変更の許可と差分

変更は配列の添字ではなく、ノード・接続のIDで比較する。
nodes・edgesの省略状態、存続するIDの相対順、各属性の有無と値を比較する。
全体のJSONの字下げ・キー順等が変わる可能性を、allow_formattingと完全なバイト差分で明示する。
changed editではallow_formattingがtrueでなければ拒否する。この同意は指定外の属性値や配列順の変更を許可しない。

| mutationsの指定 | 許可する変更 |
|---|---|
| node/edge、add、ID、fieldsは空 | そのIDのオブジェクト追加 |
| node/edge、remove、ID、fieldsは空 | そのIDの削除 |
| node/edge、set、ID、fields | 指定した属性の追加・変更・削除。idとtypeの変更は不可 |
| document、set、idはnull、fields | nodes_presence、edges_presence、nodes_order、edges_orderだけを指定できる |

IDやノード種別を変えるときは、元の削除と新しい追加を明示する。
ノード種別だけを変える同一IDのremove/add対は例外として許す。deltaでは同じ原文位置のremove、addの順にし、IDが残るため接続を依存削除しない。
deltaではこの対を原文の対象位置に隣接して置く。これは一般の追加を候補順に並べる規則の例外である。
Canvas内の同一IDの相対順は置換でも維持し、変更にはdocumentのnodes_orderを明示する。
この対は新規の意味内容としてmarkingsを必要とする。IDを変える場合の接続先変更は別に指定する。
add/removeでは、存続するオブジェクトの相対順を変えない。
ノード追加に必要なnodes配列の出現、接続追加に必要なedges配列の出現は、依存変更として計画に示す。
不要な空配列の補完は許可しない。依存変更はdelta.jsonにも記録する。
削除するノードに接続する辺の削除だけは、元の指示に対する依存変更として許可する。
接続IDを列挙した計画が承認されなければ、そのノード削除も行わない。
それ以外の未指定変更は、意味レビューや人間の承認があっても検査を迂回して保存しない。
createでは原文がなく、候補全体を承認するためmutationsを空とする。

## 根拠と提案を図に残す

Reviewのdiagram_checksで、意図、根拠、図内の印、依存変更、配置データを実際に確認する。
新しいオブジェクトと、意味に関わる属性を変更したオブジェクトには、requestのmarkingsを必要とする。
意味属性はtext、file、subpath、url、label、background、接続先と端点形状とする。
位置・寸法・色・接続面だけの変更では、新しい根拠を表す印を強制しない。
ただし、グループの印が何を包むかも配置データとしてレビューする。

categoryはevidence、proposal、unverifiedとし、表示する印をそれぞれ`[根拠あり]`、`[提案]`、`[未確認]`とする。
carrierの既知の文字列属性の先頭に、その印が必要である。
正確な接頭辞は印と直後のASCII空白1文字とし、先頭に複数の印を重ねない。
text本文、groupのlabel、接続のlabelなら、自分自身をcarrierにできる。
file/linkノードにはlabelを追加せず、矩形で完全に包むgroupのlabelをcarrierとする。
他のノードも、そのようなgroupをcarrierにできる。groupはnodes配列で対象より先に置く。
接続をgroupに対応付ける場合は、その両端ノードが同じgroupの内側になければならない。
これにより、file/linkカードや無名の辺にも、色や非標準属性によらず区別を残す。
印の存在・対応・矩形の包含は機械検査するが、根拠が実際に正しいかどうかは文脈レビューで確認する。
evidenceでもファイルの実在だけから内容や関係を正しいと断定しない。
既存の変更しない内容に印を一律に追加しない。

有効な分類は自己の接頭辞を優先する。自己に印がなければ、配列で先行し完全包含する最内側のgroupを使う。
接続では両端を含むgroupを対象にする。包含関係で絞れない複数groupの分類が同じならその分類とし、異なればambiguous_markingとする。
自己の印があるカードは、異なる分類のgroup内でも自己の分類を維持する。group自身の提案と、その中の根拠ありのカードは区別する。
すべての存続対象で編集前後の有効な分類を比較する。移動、group削除、接頭辞変更による影響も含める。
分類が変わる対象は、直接の本文変更がなくても新しいmarkingsを必要とする。無印や曖昧な状態への変更は拒否する。
その影響をdeltaの仮想属性effective_category、dependency=trueとして列挙する。これはCanvasに追加する属性ではない。
添削では自己の接頭辞と全対象の有効な分類を保護し、分類変更を許さない。

## 日本語の添削

proofreadは既存のtext.text、group.label、edge.labelだけを対象とする。
対象は文字列として存在していることを必要とし、オブジェクトの追加・削除・並び替えは許可しない。
原文のCanvasと候補のハッシュをReviewに結び付け、diagram_checksに加えて変更文字列ごとの9つの意味チェックを必要とする。
各選択文字列には、既存のcheck_bytesによる機械的な保護とObsidian記法の保護を適用する。
機械計算した変更文字列のentity、id、field、前後のUTF-8ハッシュの集合と、Review.semantic_checksの集合を完全一致させる。
余分、欠落、重複、古いハッシュを拒否し、各文字列を実際に確認した9項目だけを記録する。全体レビューから各文字列の判定を捏造しない。
同一バイト列のno_changesを除き、proofreadでは文字列の変更を1件以上必要とする。整形だけならprotected_changeとし、通常の整形編集として依頼を分ける。
各レコードの実際の判定を既存check_bytesのreview形式へ変換できるが、すべてtrueであることを機械的に補わない。
labelにも同じ保守的なMarkdown保護を適用する。数値トークンは出現順を保護し、数量の対象との対応も文脈で確認する。
proofreadでは必ずinvariants.pyを実装ハッシュに含め、SEMANTIC_CHECKSの9項目が一致しなければdependency_missingとする。
添削で新しい意味を作ったと装わないため、意味を保つ添削には新たなmarkingsを強制しない。
対象外の値、見出し、リンク、コード、数値、識別子等が変われば拒否する。

## 配置と画面確認

矩形の内部が交差する独立した非groupノードをoverlapとして報告する。辺の交差や文字の折り返しは評価しない。
groupがカードを完全に内包する場合は、重なりの違反にしない。
寸法が正でない場合はnonpositive_sizeを配置上の注意として報告し、公式の整数型違反と混同しない。
非正寸法のノードは重なり計算から除外する。辺が触れるだけなら重なりとせず、group同士・groupとカードは重なり報告の対象外にする。
負の位置、循環、自己接続、同じファイルの複数カードは、それだけで修復しない。

layoutはgrid、horizontal、verticalを提供する。対象IDの順序はrequestのnode_idsに従う。
gridは最大幅・最大高のセルを使い、指定した列数と正のgapで配置する。
horizontalとverticalも対象の最大寸法を基準にし、順番に正のgapを確保する。
座標と寸法は正確な整数演算で扱い、範囲を越える結果を拒否する。
layoutでは正の寸法の非groupカードだけを扱い、選択カードが既存groupと交差する場合は拒否する。
groupの変更はホストが候補へ明示してplanで検査する。自動配置のために未選択カードやgroupを動かさない。
layoutは参照診断や画面確認の合格を意味せず、両方をnot_performedとして返す。
layout候補は、依頼バイト列と入力候補バイト列のSHA-256から定めた`layout-<hash>`ディレクトリ内のcandidate.canvasに排他的に作る。
既存ディレクトリや候補へ書き重ねずworkspace_conflictで拒否する。元の候補は変更しない。

4用途のテンプレートは、関係図の格子、主題から論点への段組み、分岐付きの横方向フロー、比較軸ごとの列を出発点とする。
提案時は必要なカード数や関係に合わせて変更し、テンプレートの例を事実として提示しない。
Obsidianは自動起動しない。利用者が表示を確認した結果がない場合、render_checkはnot_performedのままにする。
データ上の配置レビューを、フォント、折り返し、テーマを含む実表示の確認と取り違えない。

## 計画、保存、復旧

planの前提はcreate/edit/proofread、正しい.canvas対象、外部領域への同意である。
edit/proofreadは、候補生成に使った原文のbase_sha256と現在の対象の一致を必要とする。
一致した原文と候補が同一バイト列なら、保存能力やレビューを要求せずno_changesとし、計画を作らない。
変更がある場合だけ、構造、保存禁止の参照、変更許可、markings、レビュー、保存能力を検査する。
範囲と送信同意は、変更なしでも迂回しない。

全変更計画に、実際の担当者が確認したdiagram_checksを必要とする。
create/editのsemantic_checksはnull、proofreadでは変更文字列ごとの9項目を持ち、trueだけが通過できる。
レビュー全体の欠落はreview_required、意味レコードの欠落・不一致・拒否はreview_rejected、create/editで意味レコードが非nullならinvalid_inputとする。
レビューは原文・候補の正確なバイト列のハッシュに結び付ける。createの原文ハッシュはnullとする。
計画の状態はvalidatedとし、モデルのレビューを人間の承認と扱わない。

操作ディレクトリは`<workspace>/<operation_id>/`の0700、既知のファイルは0600とする。
before.canvasは編集時だけ、candidate.canvas、semantic-review.json、diff.patch、delta.json、diagnostics.json、plan.jsonは変更計画で保持する。
結果はresult.json、検証済み成功はreceipt.jsonとし、いずれもその操作内に置く。
operation_idは、operation_nonceを含む依頼、契約・実装、ルート・親の実体、対象、原文・候補、レビュー・差分・変更・診断の各ハッシュを正規JSONにして算出する。
ホストは1操作につきランダムな128bitのnonceを作り、同じ計画の再実行では維持する。衝突や不明状態の回避のため自動更新しない。
同一計画の再作成は全アーティファクトと実体が一致し、結果・成功記録・一時ファイルがなければ既存計画を無書き込みで返す。それ以外は拒否する。
実装ハッシュはCanvasのスクリプト・lock・SKILL、兄弟backendのスクリプト・lock、利用する意味検査コードを含める。
意味検査コードを利用しない計画では、その非依存を明示してハッシュ対象から除外する。
計画内のアーティファクトのパスは既知の操作パスに完全一致させ、任意の参照先へ差し替えられないようにする。

applyでは全ハッシュ・パス・実体・検査を再確認する。
新しい内容を受け入れる承認として、plan.jsonの正確なSHA-256を利用者が明示的に承認してから渡す。
plan/applyはVaultルートの同じディスクリプターにflockを取り、既存Skillの保存と直列化する。
作成は同じ親の一時ファイルから排他的に確定し、既存対象を置き換えない。
編集は内容・実体・属性を最終照合し、所有者・グループ・権限を維持して原子的に置換する。
新規のモードは0666にumaskを適用し、編集用の一時ファイルは0600から必要な属性へ合わせる。
拡張属性、複数ハードリンク、未検証FS、保全不能な属性では保存を拒否する。
名前は/procのディスクリプター参照と要求パスを照合し、実際の綴りを確認できなければ保存を拒否する。

一時ファイルは`.kotonoha-<operation_id>.tmp`とし、既存なら上書きしない。
確定前にresultへ未確定の記録を同期し、途中終了による曖昧さを検出する。
確定後は対象を読み戻して照合し、receiptとresultの記録まで成功したときだけ検証済み保存とする。
確定前の失敗は自分が作った一時ファイルだけを片付ける。確定後の失敗はunknownとし、自動で元へ戻さない。
receiptの形式と結び付け、現在の内容がすべて一致する場合だけalready_appliedとし、現在の書き込みは行わない。
receiptの不正・欠落と過去の保存の可能性、現在の内容の変化があれば再保存せず、対象と記録の確認を求める。
成功済みのresultとreceiptが不一致の場合も、自動で片方を再生成しない。
最後の照合直後の外部編集と、同権限の悪意あるプロセスは完全には排除できない。

### 再実行の判定表

新規のtarget_exists判定より先に再実行を評価する。resultはOperationResult、receiptはReceiptで検証する。
妥当には全ハッシュ・対象・操作の結び付けの一致も含む。unknownのresultはpendingと同じ不確定状態として扱う。
beforeは編集前の完全一致、作成では対象なし、afterは候補の完全一致、otherはそれ以外とする。
下表を上から適用し、各行は対象のすべての状態を被覆する。記録を修復・再生成しない。

| result | receipt | 対象 | 判定 |
|---|---|---|---|
| 不正 | 任意 | 任意 | replay_mismatch、今回の保存なし |
| 任意の妥当またはなし | 妥当 | after | already_applied、検証済み、今回の保存なし |
| 任意の妥当またはなし | 妥当 | before/other | replay_mismatch |
| saved | なし/不正 | 任意 | replay_mismatch |
| pending/unknown | なし/不正 | 任意 | prior_outcome_unknown |
| なし | 不正 | 任意 | replay_mismatch |
| なし | なし | before | 一時ファイルもなければ初回保存へ |
| なし | なし | after/other | target_changed。作成ならtarget_exists |

既存の一時ファイルは所有を推測して消さずworkspace_conflictとする。
不明な操作の復旧は、利用者が対象・原文・候補・記録を確認し、必要なら表示された正確な既知の一時パスを明示的に削除する。
その確認と新しい依頼・nonce・計画への承認がある場合だけ別操作として再開する。自動再保存・ロールバックをしない。

## 制限、結果、検証

制御用のrequest、plan、review、receipt、result、delta、diagnosticsは1MiBまでとする。
原文・候補・バイト差分はpayload用の合意済み上限で扱う。
max_filesは列挙して本文を扱うファイル数、max_file_bytesは各payload、max_total_bytesは1コマンド内のVault本文の異なる版の合計とする。
同じ版の再照合は二重に計上せず、applyでは原文と確定後候補に必要な量を確定前に予約する。
候補は外部領域でもmax_file_bytesの対象とする。nullは明示的に上限を設けない指定である。
上限、読み取り・解析の失敗、部分範囲では、必要領域の完全性を失い、欠落や一意性を断定しない。
private領域の読み取りもサイズと通常ファイルかどうかを先に確認する。
max_total_bytesはVault本文だけを数え、外部の計画・レビュー・候補の読み取りは含めない。
ただし候補の確定後検証分は確定前に予約し、参照先ノートの本文取得もVault本文として数える。
applyは構造・禁止参照・変更許可を再検査し、承認済みdiagnostics.jsonのハッシュも照合する。
参照先の現在の実在・見出し等は再診断し、報告のstatusに使うが、過去の診断と同一であることを承認条件にはしない。
保存内容と計画の診断は変更せず、現在の診断はReport内で区別する。参照先の変化だけではplan_mismatchにしない。
ApplyData.diagnosticsは現在の診断、approved_diagnostics_sha256は計画内の診断のハッシュとする。
plan/applyで本文上限に達した場合も確定前にlimit_exceededで拒否する。inspectの部分実施と、保存前提が不足する拒否を区別する。
診断等の制御アーティファクトが1MiBを越えたらlimit_exceededで保存前に拒否し、切り詰めた成功計画を作らない。

| 結果 | 終了コード | 保存状態 |
|---|---|---|
| 完了 | 0 | not_requested、unsaved、または検証済みsaved |
| 制御入力・実行失敗 | 1 | 未保存。確定後または今回の確定可能性があればunknown |
| 同意・権限・競合・検査による拒否 | 2 | 今回の書き込みはしない |
| 未処理・判定不能が残る部分実施 | 3 | 保存をしていない状態と、診断に制限がある検証済み保存を区別する |
| 依存・必要機能の不足 | 4 | 今回の書き込みはしない |

制御入力失敗、権限・検査拒否、機能不足、診断の制限をこの順に扱う。
今回の確定が不明な場合は最優先でfailed/1/unknownとし、成功のように返さない。
processedとunprocessedはVault内の対象パスを示し、診断はノード・接続IDまたは属性位置を持つ。
フラグやハッシュ値を指定できること自体は、人間の承認や本人性の証明ではない。

### 入力間の整合と診断の正規形

intentがinspectならwrite_target、base_sha256、layoutはnull、mutationsとmarkingsは空とする。
inspectのoperation_nonceはnullとする。create/edit/proofreadのoperation_nonceはNonceで検証する。
createはwrite_targetが必要でbase_sha256はnull、mutationsは空とする。
edit/proofreadはwrite_targetとbase_sha256が必要で、setの対象IDが原文に存在することを確認する。
layoutはcreate/editだけで使い、layoutが非nullであることを必要とする。他のコマンドではlayoutをnullとする。
inspect/readはinspectの依頼だけ、plan/applyはcreate/edit/proofreadの依頼だけを受け付ける。
layoutの出力をplanへ渡すときは、配置変更をmutationsに反映した新しい依頼を作る。
依頼の意味上の矛盾はinvalid_input、許可された操作との衝突は対応する拒否理由とする。

documentのmutationはsetとnullのIDだけとし、4種類の仮想属性だけを許す。
node/edgeのadd/removeのfieldsは空、setのfieldsは空でない既知属性だけとする。
setによるid/typeの変更、同じ対象への矛盾した指示、重複したmarkingは入力失敗とする。
同一IDの種別変更用remove/add対だけは上記の例外とする。
proofreadのsetは選択した既存文字列だけとし、それ以外の変更はprotected_changeとする。
layoutのない依頼やlayoutの結果を、そのまま保存承認とみなさない。
Requestだけで表せるintentの整合はスキーマで検査する。コマンドとの対応、実在ID、指示の衝突等はその後のcontext検査とする。
layout/plan/applyには非nullのworkspaceを必要とし、欠落はinvalid_inputとする。同意のfalseはconsent_requiredである。

参照はnodes配列順、次にedges配列順で出力する。
同じ対象内ではfile、background、url、text、labelの順にし、文字列内は出現順とする。
rawは元の参照文字列、fragmentは参照に指定された`#`から始まる部分、なければnullとする。
fileノードではrawをfile属性、fragmentをsubpath属性に対応させる。URLカードのfragmentはnullとする。
occurrenceは属性内で1から数える。candidatesはVault相対パスのコードポイント順とする。
issuesは対象の配列位置、属性名、code、related_idsの順に安定整列する。文書全体の問題を先にする。
既知の不正と未知の属性が併存するときは両方を報告するが、structureはinvalid、referencesは空とする。
重なりはnodesの後のノードをid、先のノードをrelated_idsに示し、同じ組を重複報告しない。
処理済み・未処理パスはそれぞれコードポイント順にし、同一パスを重複させない。
deltaはdocument、node、edgeの順、同じ集合では原文順、追加は候補順、属性は名前順とする。
依存変更は独立したChangeとして示す。IDと配列の順序をキーに含め、辞書順で勝手に並べ替えない。

受入データのdiagnostic_casesとenum_casesは、参照集合を展開したDiagnostics全体の期待値を定める。
workflow_casesのreasonはReport.issuesのcodeに対応する。文書内の問題はdata内のdiagnosticsに入れる。
制御入力はinvalid_input、同意はconsent_required、レビューはreview_required・stale_review・review_rejectedとする。
変更拒否にはsource_not_editable、candidate_not_editable、forbidden_reference、unrequested_change、
formatting_consent_required、marking_required、protected_change、layout_refusedを使う。
承認・計画照合にはapproval_mismatch、plan_mismatch、target_changed、target_existsを使う。
復旧にはprior_outcome_unknown、replay_mismatch、必要機能にはstorage_capability、dependency_missingを使う。
上限はlimit_exceeded、その他の予期しない実行失敗はruntime_errorとし、例外の詳細を公開ログへ流さない。
作業領域の衝突はworkspace_conflict、スコープ・管理パス・リンク等の拒否はscope_refusedとする。
これらは表示文言ではなく機械照合用の理由であり、説明文は日本語の利用者向け資料で補う。

| 受入ID | 主な設計要素 |
|---|---|
| AC-001 | backendの範囲制約、対象の拡張子、文字列をコマンドとして実行しない境界 |
| AC-002 | 厳密な解析、既知構造スキーマ、未知と不正の分類、保存拒否 |
| AC-003 | 参照規則、対象別の許可確認、文字列・メタデータ・本文の区別 |
| AC-004 | 矩形の診断、group包含、レイアウトの制限、実表示の未確認 |
| AC-005 | 4テンプレート、markingsとdiagram_checks、文脈レビュー |
| AC-006、AC-007 | IDによる変更比較、依存する辺の削除、指定外属性と存続順の保持 |
| AC-008 | 選択文字列の保護、Canvas全体の意味レビュー、変更なし |
| AC-009、AC-010 | 同意、原文ハッシュ、外部の計画、正確な差分・計画承認 |
| AC-011 | 共用確定処理、属性確認、競合、成功記録、途中終了 |
| AC-012 | 上限、未処理範囲、失敗時の結果スキーマ |
| AC-013 | 単独・全導入、必須backend、旧APIの拒否、既存の回帰試験 |
| AC-014 | 外部コピー、無通信、資料内命令を実行しない受付、既知ファイルだけの削除 |
| AC-015 | 独立した受入データ、繰り返し診断、配置の期待値、モデル判断と機械検査の分離 |

## 設計承認までの検証と残る制約

隔離した検証では、実行契約のスキーマ、全コマンドの引数形、状態遷移、ディスクリプターとロック・排他作成・置換を確認する。
検証コードは製品コードへ流用せず、実装後の受入試験の代わりにしない。
casefoldされたFSや実際のObsidian表示を試していなければ、その未実施を記録する。
実装では既存のnpm、Markdown Vault、日本語添削の回帰試験を先に実施し、共用APIの抽出後も同じ試験を行う。
抽出前に独自の固定入力について既存CLIのstdout、終了コード、JSONを記録し、抽出後と完全比較する。これは旧契約の特性記録であり、新機能の期待値には使わない。
未知のCanvas拡張、実表示、モデルの意図判断、最終照合後の外部編集は残る制約として利用者に説明する。
承認対象の全ファイルパスとハッシュ、独立レビューの指摘と残る制約を提示し、明示承認後にだけ実装する。
