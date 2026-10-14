import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import Database from 'better-sqlite3';
import request from 'supertest';
import { spawn } from 'node:child_process';
import { once } from 'node:events';
import { createApp } from '../src/app';

let db: Database.Database;
let api: ReturnType<typeof request>;

beforeEach(() => {
  db = new Database(':memory:');
  api = request(createApp(db));
});

afterEach(() => {
  db.close();
  vi.restoreAllMocks();
});

async function product(name = 'Tea', price = 100, stock = 5) {
  const response = await api.post('/products').send({ name, price, stock });
  expect(response.status).toBe(201);
  return response.body as { id: number; name: string; price: number; stock: number };
}

async function cart() {
  const response = await api.post('/carts');
  expect(response.status).toBe(201);
  return response.body.id as number;
}

async function add(cartId: number, productId: number, quantity = 1) {
  return api.post(`/carts/${cartId}/items`).send({ productId, quantity });
}

function error(response: { status: number; body: unknown; headers: Record<string, string> }, status: number) {
  expect(response.status).toBe(status);
  expect(response.headers['content-type']).toContain('application/json');
  expect(response.body).toEqual({ error: expect.any(String) });
}

describe('catalog', () => {
  /** @id TEST-CAT-001 @verifies REQ-CAT-001 */
  it('TEST-CAT-001 creates persisted products and rejects invalid bodies and JSON', async () => {
    const created = await product('  Tea  ', 1, 0);
    expect(created).toEqual({ id: 1, name: 'Tea', price: 1, stock: 0 });
    expect(db.prepare('SELECT * FROM products').all()).toEqual([created]);
    const valid = { name: 'Tea', price: 100, stock: 0 };
    for (const body of [
      {}, null, [], { ...valid, name: '' }, { ...valid, name: ' \t ' },
      { ...valid, name: 123 }, { ...valid, price: 0 }, { ...valid, price: -1 },
      { ...valid, price: 1.5 }, { ...valid, price: '100' },
      { ...valid, price: Number.MAX_SAFE_INTEGER + 1 },
      { ...valid, stock: -1 }, { ...valid, stock: 0.5 }, { ...valid, stock: '0' },
      { ...valid, stock: Number.MAX_SAFE_INTEGER + 1 },
    ]) {
      error(await api.post('/products').send(body), 400);
    }
    error(await api.post('/products').set('Content-Type', 'application/json').send('{"name":'), 400);
    error(await api.post('/products'), 400);
    expect(db.prepare('SELECT count(*) AS n FROM products').get()).toEqual({ n: 1 });
  });

  /** @id TEST-CAT-002 @verifies REQ-CAT-002 */
  it('TEST-CAT-002 filters literal case-insensitive names and inclusive prices with pagination', async () => {
    expect((await api.get('/products')).body).toEqual([]);
    const a = await product('Green Tea', 100);
    const b = await product('Black TEA', 200);
    const c = await product('Coffee', 300);
    const d = await product('100%_Tea', 400);
    const e = await product('CAFÉ', 500);
    expect((await api.get('/products')).body).toEqual([a, b, c, d, e]);
    expect((await api.get('/products?q=tEa&minPrice=100&maxPrice=200')).body).toEqual([a, b]);
    expect((await api.get('/products?q=tea&limit=1&offset=1')).body).toEqual([b]);
    expect((await api.get('/products?offset=3')).body).toEqual([d, e]);
    expect((await api.get('/products?offset=99')).body).toEqual([]);
    expect((await api.get('/products?q=%25_')).body).toEqual([d]);
    expect((await api.get('/products?q=caf%C3%A9')).body).toEqual([e]);
    expect((await api.get('/products?q=&minPrice=0')).body).toEqual([a, b, c, d, e]);
    for (const query of [
      'minPrice=-1', 'maxPrice=2.5', 'minPrice=', 'maxPrice=abc',
      'minPrice=300&maxPrice=100', 'limit=0', 'limit=-1', 'offset=-1',
      'limit=1.5', 'offset=abc', 'limit=9007199254740992', 'minPrice=1e2',
      'limit=1&limit=2', 'q=a&q=b', 'q[x]=a', 'offset[]=1',
    ]) error(await api.get(`/products?${query}`), 400);
  });

  /** @id TEST-CAT-003 @verifies REQ-CAT-003 */
  it('TEST-CAT-003 retrieves a product and distinguishes absent from malformed ids', async () => {
    const p = await product();
    expect((await api.get(`/products/${p.id}`)).body).toEqual(p);
    error(await api.get('/products/999'), 404);
    for (const id of ['0', '-1', '1.2', '1abc', '9007199254740992', '1e0']) {
      error(await api.get(`/products/${id}`), 400);
    }
  });

  /** @id TEST-CAT-004 @verifies REQ-CAT-004 */
  it('TEST-CAT-004 isolates default DBs, preserves injected DBs and emits safe JSON errors', async () => {
    const p = await product();
    expect((await request(createApp(db)).get('/products')).body).toEqual([p]);
    const first = createApp();
    const second = createApp();
    try {
      await request(first).post('/products').send({ name: 'Only first', price: 5, stock: 1 }).expect(201);
      expect((await request(second).get('/products')).body).toEqual([]);
      error(await api.get('/unknown'), 404);
      error(await api.put('/products'), 404);
      const log = vi.spyOn(console, 'error').mockImplementation(() => {});
      db.exec('DROP TABLE products');
      const failure = await api.get('/products');
      error(failure, 500);
      expect(JSON.stringify(failure.body)).not.toMatch(/sqlite|table|SELECT|products/i);
      expect(log).toHaveBeenCalled();
    } finally {
      first.locals.db.close();
      second.locals.db.close();
    }
  });

  /** @id TEST-CAT-005 @verifies REQ-CAT-005 */
  it('TEST-CAT-005 serves compiled app on PORT and shuts down cleanly, rejecting invalid PORT', async () => {
    const child = spawn(process.execPath, ['dist/server.js'], {
      env: { ...process.env, PORT: '0' }, stdio: ['ignore', 'pipe', 'pipe'],
    });
    let output = '';
    let stderr = '';
    child.stderr.on('data', chunk => { stderr += chunk.toString(); });
    const exited = once(child, 'exit');
    const ready = new Promise<string>(resolve => {
      const timeout = setTimeout(() => resolve(output), 5000);
      child.stdout.on('data', chunk => {
        output += chunk.toString();
        if (/Listening on port \d+/.test(output)) {
          clearTimeout(timeout);
          resolve(output);
        }
      });
      child.once('exit', () => { clearTimeout(timeout); resolve(output); });
    });
    try {
      const text = await ready;
      expect(text, stderr).toMatch(/Listening on port \d+/);
      const port = /Listening on port (\d+)/.exec(text)![1];
      const response = await fetch(`http://127.0.0.1:${port}/products`);
      expect(response.status).toBe(200);
      expect(await response.json()).toEqual([]);
    } finally {
      if (child.exitCode === null) child.kill('SIGTERM');
      const [code, signal] = await exited;
      if (output.includes('Listening on port')) {
        expect([code, signal]).toEqual([0, null]);
      }
    }
    for (const port of ['abc', '-1', '65536', '1.5', '']) {
      const invalid = spawn(process.execPath, ['dist/server.js'], { env: { ...process.env, PORT: port } });
      let message = '';
      invalid.stderr.on('data', chunk => { message += chunk.toString(); });
      const [code] = await once(invalid, 'exit');
      expect(code).not.toBe(0);
      expect(message).toContain('Invalid PORT');
    }
  });
});

describe('shopping', () => {
  /** @id TEST-SHOP-001 @verifies REQ-SHOP-001 */
  it('TEST-SHOP-001 creates isolated carts and calculates line and aggregate totals', async () => {
    const id = await cart();
    const other = await cart();
    expect(other).not.toBe(id);
    expect((await api.get(`/carts/${id}`)).body).toEqual({ id, items: [], total: 0 });
    const a = await product('Tea', 100);
    const b = await product('Cake', 250);
    expect((await add(id, a.id, 2)).status).toBe(200);
    expect((await add(id, b.id, 3)).status).toBe(200);
    expect((await api.get(`/carts/${id}`)).body).toEqual({
      id, items: [
        { productId: a.id, name: 'Tea', price: 100, quantity: 2, total: 200 },
        { productId: b.id, name: 'Cake', price: 250, quantity: 3, total: 750 },
      ], total: 950,
    });
    expect((await api.get(`/carts/${other}`)).body).toEqual({ id: other, items: [], total: 0 });
    error(await api.get('/carts/999'), 404);
    error(await api.get('/carts/no'), 400);
  });

  /** @id TEST-SHOP-002 @verifies REQ-SHOP-002 */
  it('TEST-SHOP-002 merges quantities, validates inputs and rejects cumulative stock excess without changes', async () => {
    const id = await cart();
    const p = await product('Tea', 100, 3);
    expect((await add(id, p.id, 2)).status).toBe(200);
    const merged = await add(id, p.id, 1);
    expect(merged.status).toBe(200);
    expect(merged.body.items[0].quantity).toBe(3);
    error(await add(id, p.id, 1), 409);
    expect((await api.get(`/carts/${id}`)).body).toEqual(merged.body);
    expect((await api.get(`/products/${p.id}`)).body.stock).toBe(3);
    const empty = await product('Empty', 1, 0);
    error(await add(id, empty.id), 409);
    error(await add(999, p.id), 404);
    error(await add(id, 999), 404);
    for (const body of [
      {}, null, [], { productId: p.id, quantity: 0 },
      { productId: p.id, quantity: -1 }, { productId: p.id, quantity: 1.5 },
      { productId: p.id, quantity: '1' }, { productId: p.id, quantity: Number.MAX_SAFE_INTEGER + 1 },
      { productId: 0, quantity: 1 }, { productId: -1, quantity: 1 },
      { productId: '1', quantity: 1 }, { productId: 1.5, quantity: 1 },
      { productId: Number.MAX_SAFE_INTEGER + 1, quantity: 1 },
    ]) error(await api.post(`/carts/${id}/items`).send(body), 400);
    error(await api.post('/carts/999/items').send({ productId: 'bad', quantity: 0 }), 400);
    error(await api.post('/carts/no/items').send({ productId: p.id, quantity: 1 }), 400);
    expect((await api.get(`/carts/${id}`)).body).toEqual(merged.body);
  });

  /** @id TEST-SHOP-003 @verifies REQ-SHOP-003 */
  it('TEST-SHOP-003 removes only the requested cart item and is idempotent', async () => {
    const id = await cart();
    const other = await cart();
    const p = await product();
    await add(id, p.id, 2);
    await add(other, p.id);
    const removed = await api.delete(`/carts/${id}/items/${p.id}`);
    expect(removed.status).toBe(200);
    expect(removed.body).toEqual({ id, items: [], total: 0 });
    expect((await api.delete(`/carts/${id}/items/${p.id}`)).body).toEqual(removed.body);
    expect((await api.get(`/carts/${other}`)).body.total).toBe(100);
    error(await api.delete(`/carts/999/items/${p.id}`), 404);
    error(await api.delete(`/carts/${id}/items/no`), 400);
    error(await api.delete(`/carts/no/items/${p.id}`), 400);
  });

  /** @id TEST-SHOP-004 @verifies REQ-SHOP-004 */
  it('TEST-SHOP-004 atomically checks out or preserves all state on stock conflict', async () => {
    const id = await cart();
    error(await api.post(`/carts/${id}/checkout`), 400);
    error(await api.post('/carts/999/checkout'), 404);
    error(await api.post('/carts/no/checkout'), 400);
    const a = await product('Tea', 100, 5);
    const b = await product('Cake', 250, 3);
    await add(id, a.id, 2);
    await add(id, b.id, 3);
    const before = (await api.get(`/carts/${id}`)).body;
    db.prepare('UPDATE products SET stock = 2 WHERE id = ?').run(b.id);
    error(await api.post(`/carts/${id}/checkout`), 409);
    expect((await api.get(`/products/${a.id}`)).body.stock).toBe(5);
    expect((await api.get(`/products/${b.id}`)).body.stock).toBe(2);
    expect((await api.get(`/carts/${id}`)).body).toEqual(before);
    expect(db.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 0 });
    db.prepare('UPDATE products SET stock = 3 WHERE id = ?').run(b.id);
    const checked = await api.post(`/carts/${id}/checkout`);
    expect(checked.status).toBe(201);
    expect(checked.body).toEqual({ orderId: expect.any(Number), total: 950, items: before.items });
    expect((await api.get(`/products/${a.id}`)).body.stock).toBe(3);
    expect((await api.get(`/products/${b.id}`)).body.stock).toBe(0);
    expect((await api.get(`/carts/${id}`)).body).toEqual({ id, items: [], total: 0 });
    error(await api.post(`/carts/${id}/checkout`), 400);
    expect(db.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 1 });
  });

  /** @id TEST-SHOP-005 @verifies REQ-SHOP-005 */
  it('TEST-SHOP-005 retrieves immutable order snapshots independent of live products', async () => {
    const id = await cart();
    const p = await product();
    await add(id, p.id, 2);
    const checked = await api.post(`/carts/${id}/checkout`);
    expect(checked.status).toBe(201);
    db.prepare('UPDATE products SET name = ?, price = ? WHERE id = ?').run('Changed', 999, p.id);
    const retrieved = await api.get(`/orders/${checked.body.orderId}`);
    expect(retrieved.status).toBe(200);
    expect(retrieved.body).toEqual(checked.body);
    error(await api.get('/orders/999'), 404);
    error(await api.get('/orders/1abc'), 400);
  });

  /** @id TEST-SHOP-006 @verifies REQ-SHOP-006 */
  it('TEST-SHOP-006 prevents overselling and rolls back mid-checkout database failures', async () => {
    const p = await product('Rare', 100, 1);
    const first = await cart();
    const second = await cart();
    await add(first, p.id);
    await add(second, p.id);
    const results = await Promise.all([
      api.post(`/carts/${first}/checkout`), api.post(`/carts/${second}/checkout`),
    ]);
    expect(results.map(r => r.status).sort()).toEqual([201, 409]);
    expect((await api.get(`/products/${p.id}`)).body.stock).toBe(0);
    expect(db.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 1 });
    const loser = results[0]!.status === 409 ? first : second;
    expect((await api.get(`/carts/${loser}`)).body.items).toHaveLength(1);
    const id = await cart();
    const a = await product('A', 100, 3);
    const b = await product('B', 100, 3);
    await add(id, a.id, 2);
    await add(id, b.id, 2);
    const before = (await api.get(`/carts/${id}`)).body;
    db.exec(`CREATE TRIGGER fail_stock BEFORE UPDATE OF stock ON products
      WHEN OLD.id = ${b.id} BEGIN SELECT RAISE(ABORT, 'forced failure'); END`);
    const log = vi.spyOn(console, 'error').mockImplementation(() => {});
    error(await api.post(`/carts/${id}/checkout`), 500);
    expect(log).toHaveBeenCalled();
    expect((await api.get(`/products/${a.id}`)).body.stock).toBe(3);
    expect((await api.get(`/products/${b.id}`)).body.stock).toBe(3);
    expect((await api.get(`/carts/${id}`)).body).toEqual(before);
    expect(db.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 1 });
    expect(db.prepare('SELECT count(*) AS n FROM order_items').get()).toEqual({ n: 1 });
    db.exec('DROP TRIGGER fail_stock');
    expect((await api.post(`/carts/${id}/checkout`)).status).toBe(201);
    expect(db.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 2 });
  });

  /** @id TEST-SHOP-007 @verifies REQ-SHOP-007 */
  it('TEST-SHOP-007 rejects unsafe line and aggregate totals before changing state', async () => {
    const id = await cart();
    const a = await product('Expensive', Number.MAX_SAFE_INTEGER, 3);
    expect((await add(id, a.id)).status).toBe(200);
    const before = (await api.get(`/carts/${id}`)).body;
    error(await add(id, a.id), 400);
    const b = await product('Extra', 1, 1);
    error(await add(id, b.id), 400);
    expect((await api.get(`/carts/${id}`)).body).toEqual(before);
    db.prepare('UPDATE cart_items SET quantity = 2 WHERE cart_id = ?').run(id);
    error(await api.post(`/carts/${id}/checkout`), 400);
    expect((await api.get(`/products/${a.id}`)).body.stock).toBe(3);
    expect(db.prepare('SELECT count(*) AS n FROM orders').get()).toEqual({ n: 0 });
    expect(db.prepare('SELECT quantity FROM cart_items WHERE cart_id = ?').get(id)).toEqual({ quantity: 2 });
    db.prepare('UPDATE cart_items SET quantity = 1 WHERE cart_id = ?').run(id);
    const valid = await api.post(`/carts/${id}/checkout`);
    expect(valid.status).toBe(201);
    expect(valid.body.total).toBe(Number.MAX_SAFE_INTEGER);
  });
});
