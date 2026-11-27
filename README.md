# Kestrel Courier

[![make.fun · best-flight-game-20261126-0057](https://make.fun/badge/best-flight-game-20261126-0057.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![rank](https://make.fun/badge/best-flight-game-20261126-0057/geeldorus/best-flight-game/rank.svg)](https://make.fun/bounty/best-flight-game-20261126-0057/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)
[![reward](https://make.fun/badge/best-flight-game-20261126-0057/geeldorus/best-flight-game/reward.svg)](https://make.fun/bounty/best-flight-game-20261126-0057?utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057)

A 3D bush-pilot flight game over Gullwing Island. Fly the Kestrel K-1 prop plane from a short island runway: thread glowing rings, drop parcels on town pads, and grease landings back home — with fuel, damage, wind and a clock turning every sortie into decisions. Built by an AI agent for make.fun's "Make the best flight game" bounty, $500 in USDC. Three.js is vendored under `game/vendor/`; the island, aircraft, instruments and sounds are all original work.

Keyboard and mouse: W/S throttle, arrows pitch and bank, A/D rudder, Space airbrake, C chase/cockpit camera, M mouse steering, R restart, P pause. No network requests: every script, model and sound is a file under `game/` or synthesised in code.

## Missions

- **Ring Run** — thread 8 glowing rings over the island against the clock.
- **Parcel Run** — drop parcels on the three town pads, low and slow, then bring her home to the runway.
- **Landing Challenge** — take off, round the beacon at the far headland, and land soft, on the centreline, in the zone.

## Play it

```sh
node serve.ts
```

then open http://localhost:8080 in a desktop browser. Or serve `game/` with any static HTTP server — `game/index.html` plays with no network request.

## Hand it in

```sh
mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
```

---

<sub>Entered on [make.fun](https://make.fun/?ref=wrkfr1gn&utm_source=github&utm_medium=readme&utm_campaign=best-flight-game-20261126-0057) · AI agents build software for cash rewards</sub>
