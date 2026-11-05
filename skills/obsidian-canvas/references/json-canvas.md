# JSON Canvas fields and editing choices

Use JSON Canvas 1.0 to describe a diagram; use the existing Canvas CLI to
inspect, plan and save it. Target: kotonoha 0.5.3 development.
The [execution contract](execution-contract.json) defines the supported subset.

## Document and identity

A `.canvas` file is a JSON object with optional `nodes` and `edges` arrays.
New diagrams normally include both. Node array order defines stacking:
earlier nodes are behind later nodes. Reordering it changes the diagram.
JSON strings encode a newline as `\n`, not an unescaped line break or `\\n`.

Each node/edge needs a unique string `id`. A 16-character random hex ID is a
convenient convention, not a JSON Canvas specification requirement. Keep
existing IDs and generate collision-free IDs only for new entities.
Do not regenerate IDs to simplify an edit.

## Nodes, geometry and content

Every node has `id`, `type`, `x`, `y`, `width` and `height`. Kotonoha accepts
safe integers; saving requires positive dimensions. Negative coordinates are
valid. The top-left corner is `(x, y)`; x grows rightward and y downward.
Color is optional.

| Type | Additional fields | Meaning |
|---|---|---|
| `text` | Required `text` | Markdown card; syntax is not rendered by the checker |
| `file` | Required `file`, optional `subpath` beginning with `#` | Authorized Vault-relative file, optionally a heading/block reference |
| `link` | Required `url` | HTTP(S) URL card, not automatically fetched |
| `group` | Optional `label`, `background`, `backgroundStyle` | Visual rectangle; background style is `cover`, `ratio` or `repeat` |

Group membership is geometric, not a stored child-ID list. Do not invent
`children`, `parent`, `title` or `label` fields on text/file/link nodes.
File/background paths still need scope and path checks; a valid string cannot
authorize reading an attachment. Arbitrary block/heading references can remain
indeterminate under the current diagnostic subset.

## Edges and colors

Edges require `id`, `fromNode` and `toNode`; both endpoints must name existing
nodes. Optional `fromSide`/`toSide` use `top`, `right`, `bottom` or `left`.
Optional `fromEnd`/`toEnd` use `none` or `arrow`; specification defaults are
`none` and `arrow`, respectively. Keep absent fields absent during edits.
An edge may also have `label` and `color`.

Colors are strings: presets `"1"` through `"6"` or `"#RRGGBB"`. Exact preset
appearance is application-defined, not proof of meaning. Evidence/proposal/
unverified status must remain in the required textual markings, never color
alone or custom attributes.

## Select an original template

Use the existing templates under `assets/templates/`:

| Goal | Template | Check before planning |
|---|---|---|
| Note relationships | `note-map.canvas` | File existence and evidence for each relationship separately |
| Ideas and questions | `mind-map.canvas` | Proposed categories versus established facts |
| Decisions and branches | `workflow.canvas` | Condition labels and arrow direction |
| Compare sources | `comparison.canvas` | Shared comparison criteria and missing evidence |

Select dimensions and gaps for the actual content; do not impose a new grid
on unselected cards. Keep groups behind their contents, preserve unspecified
array order and include dependent edge removals when deleting a node.
Overlaps, unresolved files, ambiguous references and unsupported features are
different findings, not invitations to repair everything.

## Validate, then follow the approval workflow

JSON parsing alone cannot establish reference scope, requested mutations,
persisted markings, semantic review, visual rendering or save authority.
Use the [workflow](workflow.md) and its request/plan/apply contract.
Unknown attributes/extensions are diagnosis-only; never strip them merely to
make the document pass. General JSON Canvas guides may allow more than this
storage policy. Do not replace a failed plan with direct file writes or the
official application CLI.

Rendering remains not performed unless observed in Obsidian. URL cards and
embedded resources can cause traffic later when the app opens them even
though kotonoha's Canvas checker makes no network requests.

## Specification reference

- [JSON Canvas 1.0](https://jsoncanvas.org/spec/1.0/)
