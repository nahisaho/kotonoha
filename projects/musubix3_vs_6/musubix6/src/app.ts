import express, { type ErrorRequestHandler } from 'express';
import Database from 'better-sqlite3';

interface Product {
  id: number;
  name: string;
  price: number;
  stock: number;
}

interface Item {
  productId: number;
  name: string;
  price: number;
  quantity: number;
  total: number;
}

interface Cart {
  id: number;
  items: Item[];
  total: number;
}

class HttpError extends Error {
  constructor(public readonly status: number, message: string) {
    super(message);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function integer(value: unknown, min: number, field: string): number {
  if (typeof value !== 'number' || !Number.isSafeInteger(value) || value < min) {
    throw new HttpError(400, `${field} must be a safe integer >= ${min}`);
  }
  return value;
}

function decimal(value: unknown, min: number, field: string): number {
  if (typeof value !== 'string' || !/^\d+$/.test(value)) {
    throw new HttpError(400, `${field} must be a decimal integer`);
  }
  return integer(Number(value), min, field);
}

function bodyObject(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new HttpError(400, 'A JSON object is required');
  return value;
}

/** @id CODE-SHOP-007 @implements REQ-SHOP-007 */
function totals(items: Omit<Item, 'total'>[]): { items: Item[]; total: number } {
  let total = 0;
  const lines = items.map(item => {
    const lineTotal = item.price * item.quantity;
    total += lineTotal;
    if (!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total)) {
      throw new HttpError(400, 'Cart total exceeds safe integer precision');
    }
    return { ...item, total: lineTotal };
  });
  return { items: lines, total };
}

/** @id CODE-CAT-004 @implements REQ-CAT-004 */
export function createApp(db: Database.Database = new Database(':memory:')) {
  db.pragma('foreign_keys = ON');
  db.pragma('busy_timeout = 5000');
  db.exec(`
    CREATE TABLE IF NOT EXISTS products (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL CHECK(length(trim(name)) > 0),
      price INTEGER NOT NULL CHECK(typeof(price) = 'integer' AND price > 0 AND price <= 9007199254740991),
      stock INTEGER NOT NULL CHECK(typeof(stock) = 'integer' AND stock >= 0 AND stock <= 9007199254740991)
    );
    CREATE TABLE IF NOT EXISTS carts (id INTEGER PRIMARY KEY AUTOINCREMENT);
    CREATE TABLE IF NOT EXISTS cart_items (
      cart_id INTEGER NOT NULL REFERENCES carts(id),
      product_id INTEGER NOT NULL REFERENCES products(id),
      quantity INTEGER NOT NULL CHECK(typeof(quantity) = 'integer' AND quantity > 0 AND quantity <= 9007199254740991),
      PRIMARY KEY (cart_id, product_id)
    );
    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      total INTEGER NOT NULL CHECK(total > 0 AND total <= 9007199254740991)
    );
    CREATE TABLE IF NOT EXISTS order_items (
      order_id INTEGER NOT NULL REFERENCES orders(id),
      product_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price INTEGER NOT NULL,
      quantity INTEGER NOT NULL,
      total INTEGER NOT NULL,
      PRIMARY KEY (order_id, product_id)
    );
  `);

  const app = express();
  app.locals.db = db;
  app.disable('x-powered-by');
  app.set('query parser', 'simple');
  app.use(express.json({ limit: '100kb' }));

  const findProduct = db.prepare<[number], Product>('SELECT * FROM products WHERE id = ?');

  function requireProduct(id: number): Product {
    const product = findProduct.get(id);
    if (!product) throw new HttpError(404, 'Product not found');
    return product;
  }

  function requireCart(id: number): void {
    if (!db.prepare('SELECT id FROM carts WHERE id = ?').get(id)) {
      throw new HttpError(404, 'Cart not found');
    }
  }

  function readCart(id: number): Cart {
    requireCart(id);
    const rows = db.prepare<[number], Omit<Item, 'total'>>(`
      SELECT p.id AS productId, p.name, p.price, ci.quantity
      FROM cart_items ci JOIN products p ON p.id = ci.product_id
      WHERE ci.cart_id = ? ORDER BY p.id
    `).all(id);
    return { id, ...totals(rows) };
  }

  /** @id CODE-CAT-001 @implements REQ-CAT-001 */
  app.post('/products', (req, res) => {
    const body = bodyObject(req.body);
    if (typeof body.name !== 'string' || body.name.trim().length === 0) {
      throw new HttpError(400, 'name must be a nonblank string');
    }
    const name = body.name.trim();
    const price = integer(body.price, 1, 'price');
    const stock = integer(body.stock, 0, 'stock');
    const result = db.prepare('INSERT INTO products (name, price, stock) VALUES (?, ?, ?)').run(name, price, stock);
    res.status(201).json(requireProduct(Number(result.lastInsertRowid)));
  });

  /** @id CODE-CAT-002 @implements REQ-CAT-002 */
  app.get('/products', (req, res) => {
    const allowed = new Set(['q', 'minPrice', 'maxPrice', 'limit', 'offset']);
    for (const [key, value] of Object.entries(req.query)) {
      if (!allowed.has(key) || typeof value !== 'string') {
        throw new HttpError(400, 'Invalid product query');
      }
    }
    const query = req.query;
    const q = typeof query.q === 'string' ? query.q.toLowerCase() : '';
    const minPrice = query.minPrice === undefined ? 0 : decimal(query.minPrice, 0, 'minPrice');
    const maxPrice = query.maxPrice === undefined ? Number.MAX_SAFE_INTEGER : decimal(query.maxPrice, 0, 'maxPrice');
    const limit = query.limit === undefined ? undefined : decimal(query.limit, 1, 'limit');
    const offset = query.offset === undefined ? 0 : decimal(query.offset, 0, 'offset');
    if (minPrice > maxPrice) throw new HttpError(400, 'minPrice must not exceed maxPrice');
    const products = db.prepare<[], Product>('SELECT * FROM products ORDER BY id').all()
      .filter(p => p.name.toLowerCase().includes(q) && p.price >= minPrice && p.price <= maxPrice);
    res.json(products.slice(offset, limit === undefined ? undefined : offset + limit));
  });

  /** @id CODE-CAT-003 @implements REQ-CAT-003 */
  app.get('/products/:id', (req, res) => {
    res.json(requireProduct(decimal(req.params.id, 1, 'id')));
  });

  /** @id CODE-SHOP-001 @implements REQ-SHOP-001 */
  app.post('/carts', (_req, res) => {
    const result = db.prepare('INSERT INTO carts DEFAULT VALUES').run();
    res.status(201).json(readCart(Number(result.lastInsertRowid)));
  });

  app.get('/carts/:id', (req, res) => {
    res.json(readCart(decimal(req.params.id, 1, 'id')));
  });

  /** @id CODE-SHOP-002 @implements REQ-SHOP-002 */
  app.post('/carts/:id/items', (req, res) => {
    const cartId = decimal(req.params.id, 1, 'id');
    const body = bodyObject(req.body);
    const productId = integer(body.productId, 1, 'productId');
    const added = integer(body.quantity, 1, 'quantity');
    const updated = db.transaction(() => {
      requireCart(cartId);
      const p = requireProduct(productId);
      const existing = db.prepare<[number, number], { quantity: number }>(
        'SELECT quantity FROM cart_items WHERE cart_id = ? AND product_id = ?',
      ).get(cartId, productId)?.quantity ?? 0;
      if (added > p.stock - existing) throw new HttpError(409, 'Insufficient stock');
      const quantity = existing + added;
      const current = readCart(cartId);
      totals([...current.items.filter(item => item.productId !== productId),
        { productId, name: p.name, price: p.price, quantity }]);
      db.prepare(`
        INSERT INTO cart_items (cart_id, product_id, quantity) VALUES (?, ?, ?)
        ON CONFLICT(cart_id, product_id) DO UPDATE SET quantity = excluded.quantity
      `).run(cartId, productId, quantity);
      return readCart(cartId);
    }).immediate();
    res.json(updated);
  });

  /** @id CODE-SHOP-003 @implements REQ-SHOP-003 */
  app.delete('/carts/:id/items/:productId', (req, res) => {
    const cartId = decimal(req.params.id, 1, 'id');
    const productId = decimal(req.params.productId, 1, 'productId');
    const updated = db.transaction(() => {
      requireCart(cartId);
      db.prepare('DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?').run(cartId, productId);
      return readCart(cartId);
    }).immediate();
    res.json(updated);
  });

  /** @id CODE-SHOP-004 @implements REQ-SHOP-004 */
  function checkout(cartId: number) {
    const cart = readCart(cartId);
    if (cart.items.length === 0) throw new HttpError(400, 'Cart is empty');
    for (const item of cart.items) {
      if (requireProduct(item.productId).stock < item.quantity) {
        throw new HttpError(409, 'Insufficient stock');
      }
    }
    const result = db.prepare('INSERT INTO orders (total) VALUES (?)').run(cart.total);
    const orderId = Number(result.lastInsertRowid);
    const decrement = db.prepare('UPDATE products SET stock = stock - ? WHERE id = ? AND stock >= ?');
    const snapshot = db.prepare(`
      INSERT INTO order_items (order_id, product_id, name, price, quantity, total)
      VALUES (?, ?, ?, ?, ?, ?)
    `);
    for (const item of cart.items) {
      const changed = decrement.run(item.quantity, item.productId, item.quantity);
      if (changed.changes !== 1) throw new HttpError(409, 'Insufficient stock');
      snapshot.run(orderId, item.productId, item.name, item.price, item.quantity, item.total);
    }
    db.prepare('DELETE FROM cart_items WHERE cart_id = ?').run(cartId);
    return { orderId, total: cart.total, items: cart.items };
  }

  /** @id CODE-SHOP-006 @implements REQ-SHOP-006 */
  const atomicCheckout = db.transaction(checkout);
  app.post('/carts/:id/checkout', (req, res) => {
    const cartId = decimal(req.params.id, 1, 'id');
    res.status(201).json(atomicCheckout.immediate(cartId));
  });

  /** @id CODE-SHOP-005 @implements REQ-SHOP-005 */
  app.get('/orders/:id', (req, res) => {
    const orderId = decimal(req.params.id, 1, 'id');
    const order = db.prepare<[number], { total: number }>('SELECT total FROM orders WHERE id = ?').get(orderId);
    if (!order) throw new HttpError(404, 'Order not found');
    const items = db.prepare<[number], Item>(`
      SELECT product_id AS productId, name, price, quantity, total
      FROM order_items WHERE order_id = ? ORDER BY product_id
    `).all(orderId);
    res.json({ orderId, total: order.total, items });
  });

  app.use((_req, res) => {
    res.status(404).json({ error: 'Route not found' });
  });
  const handleError: ErrorRequestHandler = (err: unknown, _req, res, next) => {
    if (res.headersSent) {
      next(err);
      return;
    }
    if (err instanceof HttpError) {
      res.status(err.status).json({ error: err.message });
    } else if (isRecord(err) && (err.type === 'entity.parse.failed' || err.type === 'entity.too.large')) {
      res.status(400).json({ error: 'Invalid JSON request body' });
    } else {
      console.error('Request failed:', err);
      res.status(500).json({ error: 'Internal server error' });
    }
  };
  app.use(handleError);
  return app;
}
