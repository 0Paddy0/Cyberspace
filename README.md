# Cyberspace

## Übersicht
Dieses Projekt demonstriert eine modulare Spawn-Pipeline für eine ARPG-artige Spielwelt. Daten zu Zonen, Tiers und Affixen werden über eine RNG-Instanz verarbeitet, um Gegnerpakete zu erzeugen.

**Architektur-Dateien**
- `src/rng.js`
- `src/dataLoader.js`
- `src/formulas.js`
- `src/spawn.js`
- `src/legacy/game.js`

## Setup & Start
- `index.html` mit einem lokalen HTTP-Server öffnen.
- In VS Code: Erweiterung **Live Server** installieren, `index.html` rechtsklicken → "Open with Live Server".

## GitHub Pages
- Nach dem ersten erfolgreichen Run ist die Seite hier erreichbar:
  https://<USER>.github.io/<REPO>/
- Bei 404: 1–2 Minuten warten oder Pages in Settings prüfen.
- Wenn Assets nicht laden: <base>-Tag prüfen (siehe Workflow-Schritt "Inject base path").

## Datenformate (Kurzreferenz)
- `difficulties.json`: `hp_mult`, `dmg_mult`, `def_mult`, `res_bonus`, `affix_pool`
- `zones.json`: `level_range` je Difficulty, `spawn_table`, optionale `tier_probs`, `difficulty_multipliers`
- `monsters.json`: `base_level_offset`, `base_hp/dps/def`, `base_res`, `ai`
- `tiers.json`: `level_bonus`, *`mults`, `affix_count`, optionale `minions`
- `affixes.json`: `mods`
- `lootTables.json`: `rolls`, `entries`

## API (Kurz)
- `createRNG(seed)`
- `spawnPack({ zoneId, difficulty, seed })`
- Brücke zur Spielwelt: `addUnitsToWorld(units)`

## Reproduzierbarkeit
Gleicher `seed` → gleiche Spawns. Debug-Ausgabe über `console.debug` (Parameter `debug=true`).

## How-To erweitern
- **Neue Zone**: Datensatz in `zones.json` ergänzen.
- **Neuer Monster-/Affix-Eintrag**: `monsters.json` bzw. `affixes.json` erweitern.
- Beispiel:
```json
{
  "zones": { "id123": { "spawn_table": ["zombie"] } },
  "monsters": { "zombie": { "base_hp": 10 } },
  "affixes": { "fast": { "mods": ["speed+10"] } }
}
```
- Per-Zone-Overrides (z.B. `tier_probs`, `difficulty_multipliers`):
```json
{
  "zoneId": {
    "tier_probs": { "1": 0.8, "2": 0.2 },
    "difficulty_multipliers": { "hell": 1.5 }
  }
}
```

## Troubleshooting
- Fehlende IDs oder leere `spawn_table` → Daten prüfen.
- Validation errors in der Konsole anzeigen lassen.
- Status im UI: `#status`; weitere Infos über `console.debug` (bei `debug=true`).

## TODO / Limits
- Echte World-Integration (Kollision, AI, Pathing)
- Balancing und automatisierte Tests
- Loot-Drop-Rendering

