// Minimal lokal Spotify auto-token proxy (Client Credentials).
// Ingen dependencies. Node 18+.
import http from 'node:http';
import { URL } from 'node:url';
import { readFileSync, existsSync } from 'node:fs';

const PORT = process.env.PORT ? Number(process.env.PORT) : 8787;
let CLIENT_ID = process.env.CLIENT_ID || '';
let CLIENT_SECRET = process.env.CLIENT_SECRET || '';

// Simpel .env loader (uden dependency)
function loadEnv() {
  try{
    if (existsSync('.env')) {
      const txt = readFileSync('.env', 'utf8');
      for (const line of txt.split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/i);
        if (!m) continue;
        const key = m[1];
        let val = m[2];
        if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
          val = val.slice(1, -1);
        }
        process.env[key] = val;
      }
      CLIENT_ID = process.env.CLIENT_ID || CLIENT_ID;
      CLIENT_SECRET = process.env.CLIENT_SECRET || CLIENT_SECRET;
    }
  }catch{}
}
loadEnv();

let cached = null; // { access_token, token_type, expires_in, obtained_at, expires_at }

async function getToken() {
  const now = Math.floor(Date.now()/1000);
  if (cached && cached.expires_at - 30 > now) return cached; // 30s safety

  if (!CLIENT_ID || !CLIENT_SECRET) {
    throw new Error('CLIENT_ID/CLIENT_SECRET mangler. Udfyld .env eller ENV vars.');
  }

  const body = new URLSearchParams();
  body.set('grant_type', 'client_credentials');

  const res = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: {
      'Authorization': 'Basic ' + Buffer.from(CLIENT_ID + ':' + CLIENT_SECRET).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body
  });

  if (!res.ok) {
    const txt = await res.text();
    throw new Error('Spotify token fejl: ' + res.status + ' ' + txt);
  }

  const json = await res.json();
  const obtained_at = now;
  const expires_at = obtained_at + (json.expires_in || 3600);
  cached = { ...json, obtained_at, expires_at };
  return cached;
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }

  if (url.pathname === '/token') {
    try {
      const token = await getToken();
      res.writeHead(200, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(JSON.stringify(token));
    } catch (e) {
      res.writeHead(500, {'Content-Type': 'application/json; charset=utf-8'});
      res.end(JSON.stringify({ error: e.message || String(e) }));
    }
    return;
  }

  if (url.pathname === '/') {
    res.writeHead(200, {'Content-Type': 'text/plain; charset=utf-8'});
    res.end('Spotify Auto Token Proxy – brug /token');
    return;
  }

  res.writeHead(404, {'Content-Type': 'text/plain; charset=utf-8'});
  res.end('Not found');
});

server.listen(PORT, () => {
  console.log(`Auto-token proxy lytter på http://localhost:${PORT}`);
});
