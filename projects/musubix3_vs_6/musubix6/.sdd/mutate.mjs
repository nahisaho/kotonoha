import { readFileSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { resolve } from 'node:path';

const root = fileURLToPath(new URL('../', import.meta.url));
const appPath = resolve(root, 'src/app.ts');
const serverPath = resolve(root, 'src/server.ts');
const app = readFileSync(appPath, 'utf8');
const server = readFileSync(serverPath, 'utf8');
const record = process.argv.includes('--record');
const mutations = [
  ['CAT-001', 'price validation', appPath, "integer(body.price, 1, 'price')", "integer(body.price, 0, 'price')"],
  ['CAT-002', 'case-insensitive filtering', appPath, 'p.name.toLowerCase().includes(q)', 'p.name.includes(q)'],
  ['CAT-003', 'missing product status', appPath, "throw new HttpError(404, 'Product not found')", "throw new HttpError(400, 'Product not found')"],
  ['CAT-004', 'internal error masking', appPath, "error: 'Internal server error'", "error: 'products table internal details'"],
  ['CAT-005', 'PORT validation', serverPath, "!/^\\d+$/.test(rawPort) || Number(rawPort) > 65535", "Number(rawPort) > 65535"],
  ['SHOP-001', 'cart totals', appPath, 'return { id, ...totals(rows) };', 'return { id, ...totals(rows), total: 0 };'],
  ['SHOP-002', 'cumulative stock check', appPath, 'added > p.stock - existing', 'added > p.stock'],
  ['SHOP-003', 'cart-scoped removal', appPath, "DELETE FROM cart_items WHERE cart_id = ? AND product_id = ?", "DELETE FROM cart_items WHERE (? IS NOT NULL) AND product_id = ?"],
  ['SHOP-004', 'cart clearing', appPath, "DELETE FROM cart_items WHERE cart_id = ?'", "DELETE FROM cart_items WHERE cart_id = ? AND 0'"],
  ['SHOP-005', 'snapshot retrieval', appPath, 'SELECT product_id AS productId, name, price, quantity, total', "SELECT product_id AS productId, 'Wrong name' AS name, price, quantity, total"],
  ['SHOP-006', 'transaction rollback', appPath, 'atomicCheckout.immediate(cartId)', 'checkout(cartId)'],
  ['SHOP-007', 'safe arithmetic', appPath, '!Number.isSafeInteger(lineTotal) || !Number.isSafeInteger(total)', 'false'],
];

function run(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: 'utf8', timeout: 60000 });
  if (result.error) throw result.error;
  return { ...result, output: `${result.stdout ?? ''}${result.stderr ?? ''}` };
}

const evidence = [];
try {
  for (const [id, mechanism, path, from, to] of mutations) {
    const source = path === appPath ? app : server;
    if (source.split(from).length !== 2) throw new Error(`Nonunique mutation target: ${id}`);
    writeFileSync(path, source.replace(from, to));
    try {
      const build = run('npm', ['run', 'build']);
      if (build.status !== 0) throw new Error(`Mutation build failed: ${id}\n${build.output}`);
      const args = record
        ? ['musubix6', 'sdd', 'tdd', 'red', `TEST-${id}`]
        : ['vitest', 'run', 'test/shop.test.ts', '-t', `TEST-${id}(?![0-9A-Za-z])`];
      const result = run('npx', args);
      const assertion = /AssertionError|expected .+ to|expected \d+/.test(result.output);
      const killed = record ? result.status === 0 && result.output.includes(`RED ok TEST-${id}`) : result.status === 1;
      if (!killed || !assertion || /Cannot find module|Transform failed|SyntaxError/.test(result.output)) {
        throw new Error(`Mutation not killed by assertion: ${id}\n${result.output}`);
      }
      evidence.push({
        requirement: `REQ-${id}`,
        test: `TEST-${id}`,
        mechanism,
        replacement: { from, to },
        command: `npm run build && npx ${args.join(' ')}`,
        outcome: record ? 'Assertion Red recorded; original restored and Green recorded' : 'Killed by assertion (exit 1); original restored',
      });
      console.log(`KILLED TEST-${id}: ${mechanism}`);
    } finally {
      writeFileSync(path, source);
    }
    if (record) {
      const green = run('npx', ['musubix6', 'sdd', 'tdd', 'green', `TEST-${id}`]);
      if (green.status !== 0 || !green.output.includes(`GREEN ok TEST-${id}`)) {
        throw new Error(`Restored Green rejected: ${id}\n${green.output}`);
      }
    }
  }
} finally {
  writeFileSync(appPath, app);
  writeFileSync(serverPath, server);
  const build = run('npm', ['run', 'build']);
  if (build.status !== 0) throw new Error(`Restored build failed\n${build.output}`);
}
const restored = run('npm', ['test']);
if (restored.status !== 0) throw new Error(`Restored tests failed\n${restored.output}`);
writeFileSync(resolve(root, '.sdd/mutation-report.json'), JSON.stringify({
  command: record ? 'node .sdd/mutate.mjs --record' : 'node .sdd/mutate.mjs',
  evidence,
  restored: { command: 'npm run build && npm test', outcome: 'PASS: 12 tests; build exit 0' },
}, null, 2) + '\n');
console.log('Restored implementation: build and all 12 tests PASS');
