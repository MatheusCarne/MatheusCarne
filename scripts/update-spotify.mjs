// Atualiza a seção "Ouvidas recentemente" do README com o Spotify.
// Requer Node 20+ (fetch nativo, sem dependências).

import { readFileSync, writeFileSync } from "node:fs";

const {
  SPOTIFY_CLIENT_ID,
  SPOTIFY_CLIENT_SECRET,
  SPOTIFY_REFRESH_TOKEN,
} = process.env;

if (!SPOTIFY_CLIENT_ID || !SPOTIFY_CLIENT_SECRET || !SPOTIFY_REFRESH_TOKEN) {
  console.error("Faltam secrets: SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET, SPOTIFY_REFRESH_TOKEN");
  process.exit(1);
}

const README = "README.md";
const START = "<!-- SPOTIFY:START -->";
const END = "<!-- SPOTIFY:END -->";
const LIMIT = 5; // quantas músicas mostrar

async function getAccessToken() {
  const basic = Buffer.from(`${SPOTIFY_CLIENT_ID}:${SPOTIFY_CLIENT_SECRET}`).toString("base64");
  const res = await fetch("https://accounts.spotify.com/api/token", {
    method: "POST",
    headers: {
      Authorization: `Basic ${basic}`,
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      grant_type: "refresh_token",
      refresh_token: SPOTIFY_REFRESH_TOKEN,
    }),
  });
  if (!res.ok) throw new Error(`Erro ao renovar token: ${res.status} ${await res.text()}`);
  return (await res.json()).access_token;
}

async function getRecentTracks(token) {
  const res = await fetch("https://api.spotify.com/v1/me/player/recently-played?limit=30", {
    headers: { Authorization: `Bearer ${token}` },
  });
  if (!res.ok) throw new Error(`Erro ao buscar músicas: ${res.status} ${await res.text()}`);
  const { items } = await res.json();

  // Remove repetidas (mesma música tocada várias vezes) e limita
  const seen = new Set();
  const tracks = [];
  for (const { track } of items) {
    if (seen.has(track.id)) continue;
    seen.add(track.id);
    tracks.push(track);
    if (tracks.length === LIMIT) break;
  }
  return tracks;
}

const esc = (s) => s.replace(/\|/g, "\\|");

function render(tracks) {
  if (tracks.length === 0) return "_Nada tocado recentemente._";

  const rows = tracks.map((t) => {
    const cover = t.album.images.at(-1)?.url ?? "";
    const name = esc(t.name);
    const artists = esc(t.artists.map((a) => a.name).join(", "));
    return `| <img src="${cover}" width="40" height="40" alt=""> | [${name}](${t.external_urls.spotify}) | ${artists} |`;
  });

  return ["| | Música | Artista |", "|---|---|---|", ...rows].join("\n");
}

const token = await getAccessToken();
const tracks = await getRecentTracks(token);
const block = `${START}\n${render(tracks)}\n${END}`;

const readme = readFileSync(README, "utf8");
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);

if (!pattern.test(readme)) {
  console.error(`Marcadores ${START} / ${END} não encontrados no README.md`);
  process.exit(1);
}

writeFileSync(README, readme.replace(pattern, block));
console.log(`README atualizado com ${tracks.length} músicas.`);
