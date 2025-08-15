# Rock Quiz – Lokal (auto‑token + playlist‑import)

- **Auto‑token fallback:** Appen henter automatisk et Spotify access token fra `http://localhost:8787/token` hvis du ikke har sat et token manuelt i Indstillinger.
- **Importer playlist:** Indsæt en offentlig Spotify playlist‑URL/ID og appen henter tracks (med preview). Du kan downloade `tracks.json` direkte fra UI’et.

## Brug
1. Start **auto‑token proxyen** (se mappen `auto-token-proxy`).
2. Åbn `index.html` i en browser.
3. Klik **Importer playlist** og indsæt en offentlig playlist‑URL/ID. Spil!

> Bemærk: Private playlister kræver bruger‑OAuth; Client Credentials kan kun se offentlige data.
