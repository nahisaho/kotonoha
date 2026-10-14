---
feature: catalog
tier: T2
approval: auto
---
# Catalog and API foundation
Goal: Implement F1-F3 and the application/runtime contract in APP_SPEC.md. Non-goals: authentication, payment, admin UI.

| ID | EARS requirement | Test |
| --- | --- | --- |
| REQ-CAT-001 | When POST /products receives a nonblank string name, positive safe-integer JPY price and nonnegative safe-integer stock, the API shall persist and return a product with a numeric id (201); invalid or malformed JSON input shall return 400 with {error:string}. | TEST-CAT-001 |
| REQ-CAT-002 | When GET /products is requested, the API shall return products in id order (default unbounded limit, offset 0), applying case-insensitive name substring q, inclusive nonnegative integer minPrice/maxPrice, positive integer limit and nonnegative integer offset; invalid/duplicate/structured query values or reversed price bounds shall return 400. | TEST-CAT-002 |
| REQ-CAT-003 | When GET /products/:id is requested, the API shall return the product (200), or 404 if absent; malformed/nonpositive/unsafe ids shall return 400. | TEST-CAT-003 |
| REQ-CAT-004 | When createApp(db?) is called, the API shall initialize SQLite tables, preserve an injected database across app instances, isolate default in-memory instances, and return JSON {error:string} for unknown routes (404) and unexpected errors (500, logged without exposing internals). | TEST-CAT-004 |
| REQ-CAT-005 | When the compiled server is started, it shall listen on PORT (default 3000), reject invalid PORT, serve the API, and close its listener/database on termination; npm test and npm run build shall succeed. | TEST-CAT-005 |

## PASS conditions and counterexamples
| REQ | Observable PASS condition | Counterexample | TEST/command | Evidence |
| --- | --- | --- | --- | --- |
| `REQ-CAT-001` | Stored valid product; invalid values get JSON 400 | Fractional price, blank name, negative stock or malformed JSON accepted | TEST-CAT-001 | .sdd/tdd.jsonl; mutation report |
| `REQ-CAT-002` | Exact filtered/paged arrays and literal substring | Wrong case/range/order, LIKE wildcard interpreted, invalid query ignored | TEST-CAT-002 | .sdd/tdd.jsonl; mutation report |
| `REQ-CAT-003` | Exact product or explicit error | Missing id returns 200 or partial numeric id accepted | TEST-CAT-003 | .sdd/tdd.jsonl; mutation report |
| `REQ-CAT-004` | Injected persistence and default isolation | Unknown route HTML; exception details leak; shared default DB | TEST-CAT-004 | .sdd/tdd.jsonl; mutation report |
| `REQ-CAT-005` | Spawned runtime responds and exits on SIGTERM | Wrong port, invalid configuration accepted, shutdown hangs | TEST-CAT-005; npm run build | .sdd/tdd.jsonl; mutation report |
Oracle: APP_SPEC.md F1-F3 and non-functional clauses. Contract/input/execution/verdict/history/integration are checked through HTTP, direct SQLite observations, isolated databases and real server startup; no external integration is needed.
## Design
Express 5 parses JSON and validates boundary values; better-sqlite3 supplies synchronous prepared statements and database transactions. createApp owns a new memory DB only when none is supplied; server owns its explicit DB.
Products use INTEGER PRIMARY KEY and SQL CHECK constraints; all query values are bound. Explicit statuses and JSON errors form the API contract; internal errors are logged and masked. Tests use supertest with separate SQLite instances.
## Assumptions / risks
Names are trimmed; extra body fields are ignored; ids are positive safe integers. List defaults are unbounded with offset 0; integer query values use decimal digits only. No seed data or persistence is mandated; server uses in-memory SQLite.
Spike: Node 24 loaded better-sqlite3 12.11.1; an IMMEDIATE transaction inserting a row and throwing rolled back to zero rows (node runtime probe, passed). Unicode case folding is performed in JavaScript, not SQLite LIKE.
Validation precedence: validate path/body/query syntax before looking up resources. Express JSON parsing is covered by TEST-CAT-001; simple query parsing rejects bracketed keys and duplicate values (for example limit=1&limit=2).
