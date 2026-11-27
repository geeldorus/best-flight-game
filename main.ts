// Kestrel Courier — the hand-in program (Node 22, standard library only).
// It copies this repository's game/ and screenshots/ into /output and writes
// /output/dossier.json, the summary the judge reads, using the vendored
// make.fun library. The game itself is plain static files under game/:
// game/index.html opens in desktop Chrome and plays offline, no network.
//
// Run it locally with MAKEFUN_OUTPUT_DIR standing in for /output:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts

import { cpSync, existsSync, mkdirSync, readdirSync, statSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-game.ts';

const here = fileURLToPath(new URL('.', import.meta.url));
const out = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

// Preflight: the entry is not shippable without a game and its screenshots.
if (!existsSync(join(here, 'game', 'index.html'))) {
  throw new Error('game/index.html is missing — nothing to hand in');
}
const shots = existsSync(join(here, 'screenshots'))
  ? readdirSync(join(here, 'screenshots')).filter((f) => !f.startsWith('.'))
  : [];
if (shots.length < 3 || shots.length > 4) {
  throw new Error(`screenshots/ must hold 3 or 4 images, found ${shots.length}`);
}
function countFiles(dir) {
  let n = 0;
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    n += entry.isDirectory() ? countFiles(join(dir, entry.name)) : 1;
  }
  return n;
}
const gameFiles = countFiles(join(here, 'game'));
if (gameFiles > 993) throw new Error(`game/ holds ${gameFiles} files, over the 993 cap`);

mkdirSync(out, { recursive: true });
cpSync(join(here, 'game'), join(out, 'game'), { recursive: true });
mkdirSync(join(out, 'screenshots'), { recursive: true });
if (existsSync(join(here, 'screenshots'))) {
  cpSync(join(here, 'screenshots'), join(out, 'screenshots'), { recursive: true });
}

// The gate's own caps, from the kit's reference/gate.json: only text_max_bytes
// shapes the dossier's bytes; the rest refuse an entry the scorer would refuse
// (more than 4 screenshots or one over 256 KiB; more than 993 files in game/
// or 48 MiB of game files in all, or a path under game/ over 1000 bytes).
const dossier = buildDossier(out, {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  game_max_files: 993,
  game_max_bytes: 50331648,
  game_path_max_bytes: 1000,
});
writeFileSync(join(out, 'dossier.json'), dossier);
console.log(
  `Kestrel Courier handed in: ${gameFiles} game files, ${shots.length} screenshots, `
  + `dossier ${Buffer.byteLength(dossier, 'utf8')} bytes -> ${out}`,
);
