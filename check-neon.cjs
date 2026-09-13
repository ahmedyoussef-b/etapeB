const { Client } = require('pg');

async function main() {
  const url = process.env.DATABASE_URL;
  console.log('URL:', url ? url.substring(0, 60) + '...' : 'NOT SET');

  const client = new Client({ connectionString: url, ssl: false });

  try {
    console.log('Connecting (30s timeout)...');
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(new Error('TIMEOUT')), 30000);
      client.connect().then(() => { clearTimeout(timer); resolve(); }).catch((e) => { clearTimeout(timer); reject(e); });
    });
    console.log('Connected!');
    const r = await client.query('SELECT 1 as ok');
    console.log('Query OK:', r.rows);
    const t = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema='public' LIMIT 5`);
    console.log('Tables:', t.rows);
    const u = await client.query(`SELECT email, role FROM "User" LIMIT 5`);
    console.log('Users:', u.rows);
  } catch (e) {
    console.error('ERROR:', e.message, e.code || '');
  } finally {
    await client.end();
  }
}
main();
