#!/usr/bin/env node
const fs = require('fs');

function arg(name) {
  const i = process.argv.indexOf('--' + name);
  if (i !== -1) return process.argv[i + 1] || true;
  return null;
}
const playlistId = arg('playlist');
const token = arg('token');
const keepNoPreview = !!arg('keep-no-preview');
const outFile = arg('out') || 'tracks.json';

if (!playlistId || !token) {
  console.error('Brug: node fetch-playlist.js --playlist PLAYLIST_ID --token "ACCESS_TOKEN" [--keep-no-preview] [--out tracks.json]');
  process.exit(1);
}

async function fetchJSON(url, token){
  const res = await fetch(url, { headers: { Authorization: 'Bearer ' + token } });
  if (!res.ok) throw new Error('HTTP ' + res.status + ' ' + await res.text());
  return res.json();
}

async function fetchAll(playlistId, token) {
  let url = 'https://api.spotify.com/v1/playlists/' + encodeURIComponent(playlistId) + '/tracks?limit=100';
  let items = [];
  while (url) {
    const json = await fetchJSON(url, token);
    items = items.concat(json.items || []);
    url = json.next;
  }
  return items;
}

function normalize(item){
  const t = item?.track;
  if(!t || t.type !== 'track' || t.is_local) return null;
  const cover = (t.album?.images?.[1]?.url) || (t.album?.images?.[0]?.url) || null;
  return {
    id: t.id,
    name: t.name || null,
    artist: (t.artists || []).map(a => a.name).join(', '),
    preview_url: t.preview_url || null,
    cover
  };
}

function dedupe(arr){
  const m = new Map();
  for(const x of arr){
    if(!x || !x.id) continue;
    if(!m.has(x.id)) m.set(x.id, x);
  }
  return [...m.values()];
}

(async () => {
  try{
    const items = await fetchAll(playlistId, token);
    let tracks = items.map(normalize).filter(Boolean);
    if (!keepNoPreview) tracks = tracks.filter(t => !!t.preview_url);
    tracks = dedupe(tracks);
    const payload = { tracks };
    fs.writeFileSync(outFile, JSON.stringify(payload, null, 2), 'utf8');
    console.log('Skrev ' + tracks.length + ' tracks til ' + outFile);
  }catch(e){
    console.error('Fejl:', e.message || e);
    process.exit(2);
  }
})();