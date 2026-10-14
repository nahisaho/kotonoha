# Minimal Online Shop

TypeScript / Express 5 / SQLite REST API. Node.js 20 or newer is required.
No authentication, payment or admin UI is provided.

```sh
npm ci
npm run build
npm test
npm start
# Or: PORT=8080 npm start
```

The server defaults to port 3000 and uses an initially empty in-memory database.
Data disappears on shutdown. `PORT=0` selects an available port; invalid values
fail startup. SIGINT/SIGTERM close the listener and database.
If your npm configuration blocks dependency install scripts, approve
`better-sqlite3` and `esbuild` before rebuilding those packages.

## API

| Method | Path | Request / response |
| --- | --- | --- |
| GET | `/products` | Product array; optional `q`, `minPrice`, `maxPrice`, `limit`, `offset` |
| POST | `/products` | `{name, price, stock}` -> product, 201 |
| GET | `/products/:id` | `{id, name, price, stock}` |
| POST | `/carts` | `{id, items: [], total: 0}`, 201 |
| GET | `/carts/:id` | `{id, items, total}` |
| POST | `/carts/:id/items` | `{productId, quantity}` -> updated cart |
| DELETE | `/carts/:id/items/:productId` | Updated cart; absent items are a no-op |
| POST | `/carts/:id/checkout` | `{orderId, total, items}`, 201 |
| GET | `/orders/:id` | Immutable `{orderId, total, items}` |

Items are `{productId, name, price, quantity, total}`. Prices and totals are
integer JPY; all numeric inputs must be safe integers. Names must be nonblank
and are trimmed. Price must be positive, stock nonnegative, quantity positive.
Identifiers are positive decimal integers.

Products are listed in id order. `q` is a case-insensitive literal name substring
(including Unicode case folding supported by JavaScript). Price bounds are
inclusive, nonnegative decimal integers. `limit` is positive and `offset` is
nonnegative; defaults are no limit and offset 0. Malformed, duplicate, structured
or unknown query parameters and reversed price bounds return 400.

Carts do not reserve stock. Adds merge quantities, rejecting cumulative quantities
above current stock (409). Checkout checks every item in an IMMEDIATE SQLite
transaction: stock decrements, order creation and cart clearing all commit or
all roll back. Empty checkout is 400; insufficient stock is 409. Cart prices
reflect live products, while orders snapshot names and prices at checkout.
Unsafe line or aggregate monetary totals return 400 without writes.

All errors have the shape `{error: string}`. Syntax validation precedes resource
lookup: invalid input is 400, missing resources 404, stock conflicts 409, and
unexpected failures are logged and return a generic 500.

## Embedding and verification

`src/app.ts` exports `createApp(db?)`. Pass a `better-sqlite3` database for shared
or file-backed storage; the app initializes its tables without resetting data.
The caller owns an injected database and must close it. Without an argument,
each app gets an isolated in-memory database, available at `app.locals.db`
for explicit cleanup. Only `src/server.ts` starts a listener.

Requirements and PASS/counterexample tables are in `.sdd/specs/`, the feature
plan in `.sdd/plan.md`, and hash-chained Red/Green evidence in `.sdd/tdd.jsonl`.
`npm test` and the SDD test runner rebuild the compiled server automatically.
`.sdd/mutation-report.json` records twelve assertion-killed regressions and
the restored build/test result. Reproduce with `node .sdd/mutate.mjs` without
other concurrent builds; the runner restores source files in `finally` blocks.

```sh
npx musubix6 sdd trace
npx musubix6 sdd gate
```
