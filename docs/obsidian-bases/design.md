# Obsidian Bases専用Skill 設計書

ホストのファイルツールが保存し、読み取り専用の検査器が候補のYAMLと式を検査する。
検査器にVaultのパスや書き込み機能を持たせず、直接編集を専用保存CLIへ置き換えない。

- 文書版: 0.1
- 作成日・最終更新日: 2026-10-20
- ステータス: In Review。設計全体は未承認。
- 承認済み要件: [requirements.md](requirements.md) v0.2
- 要件SHA-256: `fbb003b3ba89f1b0aaea4b2ba4b3035f3a66b15a25275ac4c5843e684d2376e7`
- 承認記録: [approvals.json](approvals.json)
- 正本: [execution-contract.json](../../skills/obsidian-bases/references/execution-contract.json)
- 独立した期待値: [acceptance-cases.json](acceptance-cases.json)
- 設計修正版: [design-addendum.md](design-addendum.md)。競合する記述は修正版と実行契約を優先する。改訂設計は未承認。

## 構成と責務

新規Skillは`skills/obsidian-bases/`へ置く。設計段階では実行契約だけを置き、SKILL.mdや製品コードは承認後に作る。

| ファイル・担当 | 責務 |
|---|---|
| SKILL.md | 受付、許可、対象の確認、直接編集、結果不明時の停止 |
| references/workflow.md | 自然言語の依頼例、検査の準備、編集前後の確認、保持と限界 |
| references/execution-contract.json | 入出力、対応構造、式、上限、状態、固定依存の正本 |
| scripts/check.cjs | 標準入力の制御データだけを検査し、JSONを返す。Vaultを探索・保存しない |
| scripts/package.json、scripts/package-lock.json | 検査用の固定依存。ルートの依存や保存APIとは独立する |
| scripts/verify.cjs | 独立した受入データによる製品試験。明示的なnpm runnerから実行する |
| assets/templates/*.base | Table、Cards、List、Kanbanの独自構成例 |
| ホスト | 許可されたファイルツール、パス・属性確認、差分提示、保存と読み戻し |

検査器には保存、修復、ノート探索、URL取得、フォルダー作成のコマンドを設けない。
obsidian-vaultの保存APIやPython・uvを、このSkillの直接編集の必須条件にしない。
他Skillの承認済み契約、Canvasの保存方式、既存のMarkdown CLIは変更しない。
検査の成功は、読み取り・送信・保存の許可を証明しない。

## 実行経路と固定依存

Node.js 18以上を前提とする。隔離検証の実測環境はLinux、Node.js 24.21.0、npm 12.2.0である。
Node.js 18、macOS、Windows、実casefold FSの検証済み対応は、この検証だけでは主張しない。
保存対象は、ホストが必要なパス・属性・衝突確認を実施できるローカル通常ファイルに限定する。

固定依存はyaml 2.9.1、jsep 1.4.0、ajv 8.20.0、jsonc-parser 3.3.1とする。
YAMLと式を独自の文字列置換で解析せず、既存の構文解析器のASTを検査する。
jsepはルートパッケージのNode.js下限を引き上げない版を選び、式を評価する機能は利用しない。

初回準備では、依存の配置先、通信の有無、ロックに固定した公開パッケージの取得を説明して許可を得る。

```text
npm ci --prefix <bases-dir>/scripts --ignore-scripts --no-audit --no-fund
npm ci --prefix <bases-dir>/scripts --offline --ignore-scripts --no-audit --no-fund
```

上記は通信許可の有無に応じて選ぶ別経路であり、オフライン失敗からオンラインへ自動移行しない。
通常処理は、次の読み取り専用コマンドだけを使う。

```text
node <bases-dir>/scripts/check.cjs --stdin
node <bases-dir>/scripts/check.cjs --help
```

標準入力はRequestのJSONであり、documentに原文または候補の文字列を入れる。
ディスク上の依頼・候補・計画ファイルを必須にせず、パスを引数やJSONで受け取る機能も設けない。
ホストはデータをJSONとして符号化して渡し、文字列をシェルのソースや引数展開へ埋め込まない。
標準入力を受け付ける起動経路がなければ、無検査保存へ進まず機能不足を示す。
必要なコピーを作る別方式を希望する場合も、場所・保持への新しい同意が必要である。

依存はscripts/node_modules内の固定名から絶対パスで読み込み、各package.jsonの版を照合する。
親ディレクトリのnode_modules、NODE_PATH、npx、実行中のダウンロードへフォールバックしない。
ロックのintegrityは準備時のnpm ciが検証する。同権限の悪意ある改変まで検査器が隔離するとは説明しない。
`--help`は依存も標準入力も不要でUsageを返す。不明・省略・重複・余分な引数はinvalid_input/1とする。
Node自体の起動失敗はホストが未実施と説明し、未起動の検査器のJSONを捏造しない。

## 制御入力とYAMLの解析

最初に引数を検査し、標準入力を16MiBに制限してUTF-8として厳密に復号する。
入力上限超過、復号不能、JSONの構文誤り・コメント・末尾カンマ・重複キー・未知キー・型誤りはinvalid_input/1とする。
JSONはjsonc-parserで木として解析し、すべてのobjectのキー重複を検査する。
不足依存があってJSONを検査できない場合はdependency_missing/4であり、制御入力を検査済みとしない。
フラグ誤りとhelpは依存読込より先に処理する。

Ajvは正本の最上位x-*メタデータを除いたスキーマを使う。
strict、allErrors、allowUnionTypes、ownPropertiesを有効にし、共有親で定義した条件付きrequiredのためstrictRequiredだけを無効にする。
Request、Document、Reportは同じ$defsを参照し、製品コードへ別スキーマを複製しない。

YAMLは1.2のcore schema、uniqueKeys、strict、keepSourceTokens、intAsBigIntを使って解析する。
toJSやエイリアス解決より先にASTを走査し、明示タグ・アンカー・エイリアス・マージキー・バージョンやタグのディレクティブを拒否する。
これらと複数文書はunsupported_yaml_featureまたはmultiple_yaml_documentsとし、原文を対応形式へ変換しない。
空の文書、配列、スカラーのルートは対応するmappingではない。既知の構造不一致としてinvalid_typeを返す。
文字列以外のmappingキーを、文字列へ自動変換しない。

documentは1MiB、ASTはキー・値・collectionを合計して10,000node、collectionの深さはルートを1として64までとする。
Pairラッパーはnode数に含めない。走査は反復処理とし、上限を超えて解析を続けない。
解析器が深い入力でRangeErrorを返した場合も、成功へ置き換えず上限・解析失敗を報告する。
Nodeの終了・ホストのタイムアウト等で報告できなければ、ホストは検査未完了とし、保存しない。

UTF-8 BOMと孤立サロゲートはunsupported_unicodeとして保存対象外にする。
BOM付き原文も書き換えず、妥当なUnicodeなら元のUTF-8バイト列のSHA-256を返す。
孤立サロゲートから置換文字のバイト列を作ってハッシュを付けず、source_sha256をnullにする。
コメント、引用符、順序、空白、改行を含む入力をそのまま保持し、検査器からYAMLを再生成しない。

整数項目は元のScalarの数値字句を用い、真偽値や丸められた小数を整数として通さない。
`20.0`のような正確な整数値は許可し、`20.000000000000000001`はinvalid_typeとする。
係数・小数桁・指数を文字列で分類してから安全な範囲へ変換し、巨大指数を展開しない。
非有限数、安全な整数範囲を超える整数、初期対応外の非10進数表現はunsupported_numberとする。
limitの初期範囲は1から1,000,000までとする。整数であっても0や負値は未対応値として扱い、公式仕様違反とは断定しない。
不適切な数値を先に検出した項目から、型誤りを重ねて捏造しない。

## 対応構造と最低機能

正本のDocumentが型・階層のガードであり、未知と不正の分類や式の参照検査は別に行う。
schemaのoneOf等の内部エラーをそのまま複数報告せず、対象の実際の型に対応する検査を選ぶ。
mappingやsequenceはデータとして走査し、動的なrequire、関数呼び出し、prototypeへの代入に使わない。
辞書はMapまたはprototypeを持たないobjectで保持し、所有するキーだけを調べる。

| 対象 | 初期対応と意味 |
|---|---|
| filters | 非空の式文字列、またはand/or/notのうち1キーを持つ再帰object。リストの空と省略を保持する |
| formulas | 名前と非空の式文字列。最大256定義 |
| properties | プロパティ名ごとのdisplayName。省略と空objectは補完しない |
| summaries | 独自集計名と式文字列 |
| views | Table、Cards、List、Kanbanの配列。typeとnameを持つ |
| 表示項目 | orderの配列順。これは行のソート設定とは区別する |
| limit | 初期対応範囲の正確な整数 |
| groupBy | propertyと、指定する場合のASC/DESC direction |
| groupOrder | グループ値と順序。nullも保持し、空配列は全グループ非表示という意味を残す |
| ビューのsummaries | プロパティと、組み込み集計名または既知の独自集計名 |

KanbanはgroupByを必須とする。groupOrderだけがある構造も、初期対応ではgroupByを要求する。
propertiesの表示名は式の識別子ではない。noteの任意プロパティには宣言を要求しない。
formulaを参照する表示項目・グループ・プロパティ設定・集計対象では、定義名を照合する。
独自集計の割り当てが未定義ならsummary_missingとする。組み込み名は正本の一覧を使い、大文字小文字を勝手に変えない。
同名ビューにはduplicate_view_nameの注意を付けるが、名前だけで対象を選ばず、元の順序位置と内容で利用者が対象を特定する。

4ビューすべてについて、新規作成とname、order、filtersの編集を試験する。KanbanではgroupByとgroupOrderも対象にする。
viewsの追加・削除・並べ替えと、最低対応キーの追加・削除・変更を独立例で試験する。
名前が空など、公式資料だけで合法性を確定できない値の制限は実装の非対応とし、公式の形式違反と混同しない。

Cards/List/Kanban固有の画像・幅・マーカー等は、UI説明だけからYAMLキーを推測しない。
それらを含む既存ファイルは既知部分を診断し、初期版ではファイル全体の編集を拒否する。
同様に、行ソート用の未確認キーを作らない。列順のorder、グループのdirection/groupOrderと行ソートは報告で区別する。
4ビューの最低作成・編集機能を満たせなくなった場合は、要件の再承認が必要であり、設計承認だけで縮小しない。

## 式の認識と静的診断

式のASTはjsepで作り、正本で列挙したnode、演算子、関数・メソッド名と引数数だけを認める。
Identifierの表記はUnicodeの識別子と`_`・`$`に限定する。
文字列、有限な数値、真偽値、配列、括弧、単項・二項演算、静的なmemberとcallを扱う。
要素の欠けた配列、Compound、三項演算子、代入、関数定義、optional chaining、動的な呼び出し・添字は初期対応外とする。
構文解析器が受け入れる全JavaScript表現をBasesの対応文法とみなさない。
解析できない式はunsupported_expressionとし、公式仕様違反と断定せず、保存を拒否する。

関数名と引数数は、固定した公式Functions資料とBases syntaxの例に基づく。
roundは本文が引数省略を説明しているため0または1引数、toFixedとjoinは1引数とする。
meanはFunctionsの索引にないが、Bases syntaxの独自集計例に明示されるため、集計のvaluesに対してだけ許可する。
ほかの未記載メソッドを類推して追加しない。valuesは独自集計だけの変数である。
引数・receiverの実際の型や戻り値は評価せず、構文の認識を実行結果の保証にしない。

formula.nameとformula["name"]は、受理したASTのmemberから抽出する。
引用文字列中の`formula.fake`を参照に数えず、formula[name]を解決済みとしない。
既知参照の未定義名をformula_missingとし、formulasの依存グラフの強連結成分から循環を検出する。
自己参照も循環である。各循環は1件のformula_cycleとし、relatedに成分内の名前を安定整列して示す。
不完全な式から参照や循環がないことを断定しない。

上限は式のUTF-16長4,096、AST 1,024node、深さ64とする。
解析前にも引用・エスケープを考慮した括弧深さを確認し、解析後は反復走査でnodeと深さを検査する。
巨大な数値を演算せず、非有限となる字句はunsupported_numberとする。
thisは文法として認識しても、アクティブファイルや埋め込み元を取得しない。
filtersの全体とビュー単位がANDになることを説明し、結果集合をローカルで実行・再現しない。

## 診断と結果

Reportは常にread_only=true、authorization=not_assessed、write_status=not_requestedとする。
render_checkとexpression_evaluationはnot_performedであり、検査器がアプリを確認したように報告しない。
application_versionは利用者の申告値であることを示し、実行中のアプリから検証した値とはしない。
少なくとも1ビューがあり、すべての静的検査と申告版条件を満たす場合だけstatic_checks_passedをtrueにする。
添削intentではproofread_gate=external_requiredとし、日本語の保護検査・意味レビューまで通過したとは示さない。

| 条件 | status・終了コード | 保存への扱い |
|---|---|---|
| 制御入力・予期しない実行失敗 | failed・1 | 検査未完了 |
| YAMLの不正、既知の型・必須項目の問題、未定義参照、循環 | not_performed・2 | 拒否 |
| 未知キー・ビュー、未対応式・値、資源上限、アプリ版不明 | partial・3 | 拒否 |
| 依存不足、申告版が必要条件を満たさない | not_performed・4 | 拒否 |
| 全静的検査が完了、注意だけが残る | completed・0 | 保存許可ではない。ホスト側の全条件を別に確認 |

空mappingや空viewsはinspectではno_viewsの注意とし、static_checks_passed=falseを返す。
create/edit/proofreadの候補にビューがなければmissing_required/2で保存を拒否する。
構造の未知と不正が混在する場合は両方の問題を残し、invalid/2を優先する。
YAML自体の解析失敗と文書全体の非対応機能は、その問題だけを返して後続の型・式検査を行わない。
対応構造を確認できない場合は、アプリ版や未定義参照の二次的な問題を捏造しない。

issueはcode、category、path、line、column、relatedを持ち、生の例外文や本文を出さない。
pathはmappingキーと配列indexからなる位置であり、非parserのissueではline・columnをnullにする。
YAML parserのエラーだけ、元の位置から1始まりの行・列を求める。rootの問題は空pathとする。
同じissueは重複させず、pathの成分、code、relatedの順で安定整列する。文字列はコードポイント順、indexは数値順にする。
unsupportedの位置はunprocessedにも示す。未知のアプリ版は文書本文の未処理位置を意味しない。
既知の不正がある場合はinvalid/2を優先し、未処理位置が残れば検査が完全でないことも保持する。

issueは256件、出力JSONは1MiBまでとする。上限に達して省略する場合はlimit_exceededを必ず残す。
省略した位置を列挙し切れなければunprocessedにrootを示す。切り詰めたcompletedを返さない。
実行失敗ではstructure=unprocessedとし、直前までの検査を完了扱いにしない。

## 直接編集のホスト手順

検査器はパス・権限・競合・保存を強制しない。以下はSkillとホストが実施する条件である。

1. Vaultの絶対パス、処理目的、読み取り範囲、モデル入力、対象の正確な`.base`パスを確認する。
2. Vaultルートから対象までの実体と綴りを調べ、範囲外、親参照、途中を含むsymlink、大小文字違いを含む管理パスを拒否する。
3. 既存対象は内容・実体・所有者・グループ・権限・リンク数・拡張属性を確認する。保全・確認できなければ止める。
4. 原文を読み、変更するキー・ビュー・内容を確定する。ビュー名だけで曖昧なら、元のindexと内容を提示して対象を確認する。
5. 原文と候補を検査する。不正・非対応の既存対象を、許可された部分編集に見せて修復しない。候補だけの合格で原文の制約を回避しない。
6. 完全なバイト差分を確認し、指定外の値・順序・コメント・引用・空白・改行が保持されていることを実際に比較する。再シリアライズしない。
7. フィルター・formulasの変更は常に拡大可能性を説明し、正確な変更前後と保存への許可を確認する。既に同じ差分と保存が明示されていれば重ねて承認を求めない。
8. 提案だけ、確認待ち、拒否、能力不足なら書かない。同一バイト列なら変更なしとし、依存準備や保存のために不要な操作を追加しない。
9. 保存直前に原文の内容と実体、親と名前を再確認する。新規は非上書きの排他的な作成、編集は属性を保全できるホストの方法を使う。
10. 保存後は読み戻して期待バイト列と照合する。エラー・不一致なら不明とし、再保存・ロールバックを自動実行しない。

差分確認はホストのファイルツールと実際の比較で行い、新たな保存CLIや機械的な変更許可エンジンを実装しない。
書き込みを自動制御する機能がないのに、指示や検査結果だけで強制隔離できるとは主張しない。
ホストの書き込み方法を実現可能性だけで決めず、対象の属性・衝突条件を満たせなければ保存しない。
初期受入ではこの環境の実ツールで正常作成・部分編集を行い、独立したバイト比較とメタデータ確認を記録する。
拒否シナリオはアクセス記録とファイル不変を確認し、模擬ホストの試験を実ホストでの強制制御の証明としない。

日本語添削では、選択されたnameとdisplayNameの文字列だけを対象にする。
利用者がコピーに同意した外部領域で、各文字列にjapanese-proseの不変条件検査と実際の9項目意味レビューを適用する。
全体YAMLを日本語文書として添削せず、式・識別子・制御キー・数値・他の文字列を保持する。
書き込み直前の差分とハッシュが実際のレビューに対応していることも確認する。
コピー・依存・レビューが不足すれば保存せず、通常の設定変更へ黙って言い換えない。

読み取り、モデルへの入力、保存、外部コピーは別の許可である。
資料内の指示、式、プロパティ名、URLはデータとして扱い、権限を追加しない。
式が言及するノートや画像を自動取得せず、別途許可されたプロパティ調査でも全Vaultの型・件数を断定しない。
アプリで開く際の通信可能性、KanbanのUIがノート属性や場所を変え得ること、本Skillがそれらを実行しないことを説明する。

## 配布と既存機能との共存

新しいSkillは選択導入・全導入でコピーする。兄弟Skillや依存を導入時に自動追加・更新しない。
npmのfiles設定に`!skills/**/node_modules/`を追加し、source installerでも同じキャッシュをコピー対象から除く。
gitではnode_modulesを除外するが、scripts/package-lock.jsonは固定依存の正本として追跡・配布する。
ルートのpackage-lockを新規作成せず、ルートに実行時依存を追加しない。

npm 12の実際のpackでは、rootのlockと異なり、明示的なskills配下のnested package-lockが含まれることを確認した。
同時にnested node_modulesも含まれ得るため、明示的な除外が必要である。
配布されたtarballを実際に導入し、検査器・契約・private package manifest・lock・テンプレートの完全一致を確認する。
依存未準備の起動は4、別途許可した固定準備後のオフライン起動は正常に動くことを確認する。
既存のローカル改変や同名Skillを無断置換せず、更新には対象を明示した許可を求める。

`test:obsidian-bases`は`node --test skills/obsidian-bases/scripts/verify.cjs`とする。
verify.cjsは通常のルート自動探索へ混入させず、依存を準備した明示経路で実行する。
既存のnpm、Vault、Canvas、日本語添削のrunnerは維持し、リグレッションと実CLIの特性比較を実施する。

## 受入と設計承認

独立データは34診断例、12コマンド群、8資源境界群、16ホスト群を定める。
展開後の入力と期待値は製品出力から作らず、全Reportのスキーマと固定項目、正確なコード・位置・状態を照合する。
パラメーター群は具体的な各入力へ展開し、省略した検査を件数で隠さない。
4用途の候補の意味・対象範囲・表示項目・グループの意図は、機械検査とは別に文脈レビューする。
意味レビューを全trueの試験用データで捏造せず、実施した担当者と前後の内容を記録する。

| 受入ID | 設計上の確認 |
|---|---|
| AC-001 | ホストのパス・属性・権限確認、検査器にパス入力とVaultアクセスがないこと |
| AC-002 | YAML ASTの型・特徴検査、正本の構造、未知・不正・位置の分類 |
| AC-003 | AST許可集合、非実行、参照・循環・集計検査 |
| AC-004、AC-005 | 4ビューの最低キー、独立例、実ツール編集と完全差分 |
| AC-006、AC-007 | 明示許可と確認待ち、バイト保持、変更なし |
| AC-008、AC-009 | 衝突・直前変更・属性・読み戻し・結果不明、保証しない範囲 |
| AC-010 | 選択表示文字列の外部ゲートと意味レビュー |
| AC-011 | キャッシュ除外、nested lock、単独・全・packed導入、既存runner |
| AC-012 | 権限の分離、条件変更の保守的な確認、this・画像・データ内命令 |
| AC-013 | 原文・制御・AST・式・診断・出力の実境界値と未処理位置 |
| AC-014 | 固定期待値、文脈レビュー、実条件・時間と表示未確認の分離 |

隔離検証は/tmp/kotonoha-test/obsidian-bases/feasibility/で実施した。
YAMLの型・重複・拡張・原文範囲、式のAST、JSONの厳密な入力、実引数形、固定準備後のオフライン起動、実tarballのnested lockとキャッシュ除外を確認した。
検証用のlauncherや検査コードは使い捨てであり、製品コードへコピー・翻案しない。製品試験が合格したとはみなさない。
実casefold FS、Node.js 18での実行、Obsidian表示、実際の式評価、ホスト権限の強制隔離は未検証である。
公式根拠は要件の固定リビジョンに加え、同じ版の[Functions](https://github.com/obsidianmd/obsidian-help/blob/cd6c9f3c7d5492bbbec94e8f403572b84eeb325b/en/Bases/Functions.md)を使う。

設計レビュー後、正確な全対象パス・SHA-256、指摘の解消状況と上記の残る制約を提示する。
利用者が設計全体を明示承認するまで、製品の実装を開始しない。
