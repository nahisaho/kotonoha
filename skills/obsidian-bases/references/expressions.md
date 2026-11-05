# Bases filters, formulas and summaries

Build standalone `.base` configuration within the checker's supported subset.
Target: kotonoha 0.5.3 development. The
[execution contract](execution-contract.json) is authoritative; this guide
does not expand its function allowlist or application compatibility claims.

## Scope filters before choosing a view

Global and per-view filters combine with AND. A recursive filter object has
one key (`and`, `or` or `not`) whose value is a list of filters; a plain
expression string is also allowed.

```yaml
filters:
  and:
    - 'file.inFolder("Research")'
    - 'file.ext == "md"'
    - not:
        - 'file.hasTag("archived")'
formulas:
  normalized_status: 'note.status.lower().trim()'
properties:
  formula.normalized_status:
    displayName: "Status"
summaries:
  rounded_mean: 'values.mean().round(1)'
views:
  - type: table
    name: "Research queue"
    filters: 'note.status != "done"'
    order:
      - file.name
      - formula.normalized_status
      - note.score
    summaries:
      note.score: rounded_mean
    limit: 30
```

This is illustrative configuration, not evidence that a Research folder or
string-valued `status`/numeric `score` properties exist. Static validation
does not establish runtime types. Removing filters can reveal the whole Vault
when opened; show exact changes and obtain authority for that scope.

## Property and formula namespaces

| Expression | Meaning |
|---|---|
| `note.status` or `status` | A source note's property |
| `file.name`, `file.ext`, `file.folder` | File metadata |
| `formula.normalized_status` | A formula defined in this base |
| `formula["normalized_status"]` | Literal-key formula reference |
| `this` | Context-dependent current file; not an automatically read active note |
| `values` | Aggregated values, only in custom summaries |

Missing formula definitions and cycles block saving. A quoted
`"formula.normalized_status"` is text, not a dependency. Literal member keys
are supported; dynamic indices and dynamic function targets are not.
Do not create source-note properties just to satisfy an assumed type.

## Supported expression functions

Use only the contract's calls and argument counts:

| Calls | Argument counts |
|---|---|
| `if` | 2-3 |
| `today`, `now` | 0 |
| `date`, `list` | 1 |
| `link` | 1-2 |
| `min`, `max` | 2-128 |
| `.hasTag` | 1-128 |
| `.hasLink`, `.inFolder`, `.contains`, `.toFixed`, `.join` | 1 |
| `.lower`, `.trim`, `.unique` | 0 |
| `.round` | 0-1 |
| `values.mean()` | 0; custom-summary context only |

Operators include `!`, unary `+`/`-`, arithmetic `+ - * / %`, comparisons
`== != > >= < <=` and logical `&&`/`||`. Arrays and accepted literal members
are supported; optional chaining, arbitrary JavaScript and unlisted operators
or functions are not. Never evaluate an expression to test it.
Passing the allowlist proves neither receiver type nor the actual value.

## Views and summary selection

Table/Cards require declared Obsidian >=1.9, List >=1.10 and Kanban >=1.14.
Kanban needs `groupBy`. `groupOrder` needs `groupBy` and an empty group order
hides all groups; it is not a filter. `order` controls displayed properties,
not row sorting. Do not add a `sort` key from an unverified example.

View `summaries` maps property names to built-in names or custom summary keys.
Built-ins are `Average`, `Min`, `Max`, `Sum`, `Range`, `Median`, `Stddev`,
`Earliest`, `Latest`, `Checked`, `Unchecked`, `Empty`, `Filled` and `Unique`.
Choose summaries for actual types; static checks do not prove their results.
Map/community-plugin views and extra image/sort/plugin settings are not in the
current checker subset. Do not remove unsupported settings to enable an edit.

## Validate before saving, query only by separate choice

Follow the [workflow](workflow.md) to check exact original/candidate text and
match byte hashes before authorized host saving. YAML validity alone is
insufficient. Unknown version, missing dependencies and partial checks block
saving. The checker never opens a Vault, evaluates formulas or renders a view.

For actual result sets, a separately authorized `obsidian-cli` workflow can
use `base:query` after effective result-scope consent. A query does not prove
static compatibility or authorize creating records and changing source notes.

## Application syntax references

- [Bases syntax](https://help.obsidian.md/bases/syntax)
- [Bases functions](https://help.obsidian.md/bases/functions)
