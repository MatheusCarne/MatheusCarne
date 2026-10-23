// Atualiza a seção "Ouvidas recentemente" do README com o Last.fm.
// Requer Node 20+ (fetch nativo, sem dependências).

import { readFileSync, writeFileSync } from "node:fs";

const { LASTFM_API_KEY, LASTFM_USER } = process.env;

if (!LASTFM_API_KEY || !LASTFM_USER) {
  console.error("Faltam secrets: LASTFM_API_KEY, LASTFM_USER");
  process.exit(1);
}

const README = "README.md";
const START = "<!-- SPOTIFY:START -->";
const END = "<!-- SPOTIFY:END -->";
const LIMIT = 5; // quantas músicas mostrar

// O Last.fm devolve essa imagem quando o álbum não tem capa
const PLACEHOLDER = "2a96cbd8b46e442fc41c2b86b821562f";

async function getRecentTracks() {
  const url = new URL("https://ws.audioscrobbler.com/2.0/");
  url.search = new URLSearchParams({
    method: "user.getrecenttracks",
    user: LASTFM_USER,
    api_key: LASTFM_API_KEY,
    format: "json",
    limit: "30",
  }).toString();

  const res = await fetch(url);
  const data = await res.json();
  if (!res.ok || data.error) {
    throw new Error(`Erro do Last.fm: ${res.status} ${data.message ?? JSON.stringify(data)}`);
  }

  const raw = data.recenttracks?.track ?? [];
  const list = Array.isArray(raw) ? raw : [raw];

  // Remove repetidas (mesma música tocada várias vezes) e limita
  const seen = new Set();
  const tracks = [];
  for (const t of list) {
    const key = `${t.artist["#text"]}::${t.name}`;
    if (seen.has(key)) continue;
    seen.add(key);
    tracks.push(t);
    if (tracks.length === LIMIT) break;
  }
  return tracks;
}

const esc = (s) => s.replace(/\|/g, "\\|");

async function imageOk(url) {
  try {
    const res = await fetch(url, { method: "HEAD" });
    return res.ok;
  } catch {
    return false;
  }
}

async function render(tracks) {
  if (tracks.length === 0) return "_Nada tocado recentemente._";

  const rows = await Promise.all(
    tracks.map(async (t) => {
      const img = t.image?.find((i) => i.size === "medium")?.["#text"] ?? "";
      const hasCover = img && !img.includes(PLACEHOLDER) && (await imageOk(img));
      const cover = hasCover
        ? `<img src="${img}" width="40" height="40" alt="">`
        : "🎵";
      const nowPlaying = t["@attr"]?.nowplaying === "true" ? "▶️ " : "";
      const name = esc(t.name);
      const artist = esc(t.artist["#text"]);
      return `| ${cover} | ${nowPlaying}[${name}](${t.url}) | ${artist} |`;
    })
  );

  return ["| | Música | Artista |", "|---|---|---|", ...rows].join("\n");
}

const tracks = await getRecentTracks();
const block = `${START}\n${await render(tracks)}\n${END}`;

const readme = readFileSync(README, "utf8");
const pattern = new RegExp(`${START}[\\s\\S]*?${END}`);

if (!pattern.test(readme)) {
  console.error(`Marcadores ${START} / ${END} não encontrados no README.md`);
  process.exit(1);
}

writeFileSync(README, readme.replace(pattern, block));
console.log(`README atualizado com ${tracks.length} músicas.`);
