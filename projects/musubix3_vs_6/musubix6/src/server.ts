import Database from 'better-sqlite3';
import { createApp } from './app';

/** @id CODE-CAT-005 @implements REQ-CAT-005 */
function start() {
  const rawPort = process.env.PORT ?? '3000';
  if (!/^\d+$/.test(rawPort) || Number(rawPort) > 65535) {
    console.error('Invalid PORT: expected an integer from 0 to 65535');
    process.exitCode = 1;
    return;
  }
  const db = new Database(':memory:');
  const app = createApp(db);
  const server = app.listen(Number(rawPort), () => {
    const address = server.address();
    if (address && typeof address === 'object') {
      console.log(`Listening on port ${address.port}`);
    }
  });
  server.on('error', err => {
    console.error('Server failed:', err);
    db.close();
    process.exitCode = 1;
  });
  let closing = false;
  function shutdown() {
    if (closing) return;
    closing = true;
    const timeout = setTimeout(() => server.closeAllConnections(), 10000);
    timeout.unref();
    server.close(err => {
      clearTimeout(timeout);
      db.close();
      if (err) {
        console.error('Shutdown failed:', err);
        process.exitCode = 1;
      }
    });
  }
  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);
}

start();
