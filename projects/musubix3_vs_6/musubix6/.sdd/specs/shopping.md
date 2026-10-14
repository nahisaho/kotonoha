---
feature: shopping
tier: T2
approval: auto
---
# Cart and order state
Goal: Implement APP_SPEC.md F4-F7. Non-goals: stock reservations, payments, authentication, order cancellation.

| ID | EARS requirement | Test |
| --- | --- | --- |
| REQ-SHOP-001 | When POST /carts is requested, the API shall persist and return a new cart (201); GET /carts/:id shall return {id,items,total} with productId, name, price, quantity and line total, or 404 if absent. | TEST-SHOP-001 |
| REQ-SHOP-002 | When POST /carts/:id/items receives a valid productId and positive safe-integer quantity, the API shall merge the product quantity and return the cart (200); missing cart/product shall return 404, malformed input/ids shall return 400, and cumulative quantity exceeding current stock shall return 409 without changing the cart. | TEST-SHOP-002 |
| REQ-SHOP-003 | When DELETE /carts/:id/items/:productId is requested for an existing cart, the API shall remove that item and return the cart (200), including if already absent; missing cart shall return 404 and malformed ids shall return 400. | TEST-SHOP-003 |
| REQ-SHOP-004 | When POST /carts/:id/checkout is requested for a nonempty cart with sufficient stock, the API shall atomically create an order, decrement all stock and empty the cart, returning {orderId,total,items} (201); malformed cart ids shall return 400 before lookup, missing cart shall return 404, empty cart 400, and insufficient stock 409 with no stock/order/cart changes. | TEST-SHOP-004 |
| REQ-SHOP-005 | When GET /orders/:id is requested, the API shall return the immutable {orderId,total,items} snapshot (200), or 404 if absent and 400 for malformed ids. | TEST-SHOP-005 |
| REQ-SHOP-006 | When competing or repeated checkouts or a database write failure occurs, the API shall never oversell, partially decrement stock, retain a partial order or clear an unsuccessful cart. | TEST-SHOP-006 |
| REQ-SHOP-007 | When monetary arithmetic exceeds safe integer precision, the API shall return 400 before mutation and preserve cart, stock and orders. | TEST-SHOP-007 |

## PASS conditions and counterexamples
| REQ | Observable PASS condition | Counterexample | TEST/command | Evidence |
| --- | --- | --- | --- | --- |
| `REQ-SHOP-001` | Empty and filled cart exact totals | Incorrect line sum, missing cart accepted | TEST-SHOP-001 | .sdd/tdd.jsonl; mutation report |
| `REQ-SHOP-002` | Merge and stock conflict preserve state | Compare added quantity only or reserve stock at add | TEST-SHOP-002 | .sdd/tdd.jsonl; mutation report |
| `REQ-SHOP-003` | Removal updates total; absent removal idempotent | Remove from another cart or malformed id accepted | TEST-SHOP-003 | .sdd/tdd.jsonl; mutation report |
| `REQ-SHOP-004` | Exact checkout snapshot, stock decrements, cart empty | One unavailable item causes partial writes | TEST-SHOP-004 | .sdd/tdd.jsonl; mutation report |
| `REQ-SHOP-005` | Historical order unchanged after product edits | Order reads live prices | TEST-SHOP-005 | .sdd/tdd.jsonl; mutation report |
| `REQ-SHOP-006` | At most one competing checkout succeeds; forced failure fully rolls back | Overselling, orphan order, partially changed stock/cart | TEST-SHOP-006 | .sdd/tdd.jsonl; mutation report |
| `REQ-SHOP-007` | Unsafe line or aggregate total rejected without writes | Unsafe rounded total accepted | TEST-SHOP-007 | .sdd/tdd.jsonl; mutation report |
Oracle: APP_SPEC.md F4-F7; total is sum(price * quantity). All six risk stages are exercised using HTTP responses, persisted rows, concurrent requests, trigger-induced failure and independent arithmetic expectations.
## Design
State table: missing cart -> 404; empty checkout -> 400; stock conflict -> 409; valid add/remove -> updated cart; successful checkout -> immutable order + empty cart. Carts do not reserve stock.
SQLite foreign keys and composite cart-item key enforce identity. Checkout runs synchronously inside an IMMEDIATE transaction, checks every item and safe totals, snapshots product fields, conditionally decrements stock and clears items.
Order rows and order items are separate from live products. Any thrown write error rolls the whole transaction back; central error middleware logs unexpected errors and emits generic JSON 500.
## Assumptions / risks
Cart items reflect current product prices until checkout; order items preserve name/price at checkout. Missing products are 404. Empty request bodies are allowed for cart creation/checkout. No public edit/delete-product endpoints are added.
Spike: a real better-sqlite3 IMMEDIATE transaction inserting then throwing rolled back to zero rows. Competing HTTP checkouts and a trigger-induced mid-checkout failure test atomicity. Safe-integer arithmetic is required to avoid silently rounded JPY totals.
Validation precedence: malformed path/body values return 400 before any resource lookup. SQLite synchronous execution plus IMMEDIATE write locking serializes checkout; the API handles competing requests without awaiting inside transactions.
