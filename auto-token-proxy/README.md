# Spotify Auto Token Proxy (lokal)

Minimal Node 18+ server der henter et Spotify **Client Credentials** access token lokalt og udstiller det på:
```
GET http://localhost:8787/token
```

## Opsætning
1. Omdøb `.env.example` → `.env` og udfyld `CLIENT_ID` og `CLIENT_SECRET` fra din app på https://developer.spotify.com/dashboard/
2. Kør serveren:
```bash
node server.js
```
3. Test:
```bash
curl http://localhost:8787/token
```

**Bemærk**
- Client Credentials kan læse **offentlige** data (playlister, tracks/album) men ikke private brugerlister.
- Token caches i hukommelsen og fornyes automatisk.
