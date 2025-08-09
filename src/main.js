import { loadAllData } from './dataLoader.js';
import { spawnPack } from './spawn.js';
import { initLegacyGame, addUnitsToWorld, getWorldSummary, fitCanvasToScreen, setMobileInputVector } from './legacy/game.js';
import { createJoystick } from './mobileJoystick.js';

const rootEl = document.getElementById('app');
initLegacyGame(rootEl);

let joystick = null;
function initMobileControls(){
  if (!joystick) joystick = createJoystick(document.body);
}
initMobileControls();

const canvas = document.querySelector('canvas');
function applySizing(){ fitCanvasToScreen(canvas); }
window.addEventListener('resize', applySizing, { passive:true });
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', applySizing, { passive:true });
}
applySizing();

['pointerdown','pointermove','wheel','touchstart','touchmove'].forEach(t => {
  canvas.addEventListener(t, e => { if (e.cancelable) e.preventDefault(); }, { passive:false });
});

function gameTick(){
  const v = joystick ? joystick.get() : {x:0,y:0};
  setMobileInputVector(v);
  requestAnimationFrame(gameTick);
}
requestAnimationFrame(gameTick);

let lastSpawn = null;

/**
 * Update the status element.
 * @param {string} msg
 * @param {boolean} [isError=false]
 */
function setStatus(msg, isError = false) {
  const el = document.getElementById('status');
  if (el) {
    el.textContent = msg;
    el.classList.toggle('error', isError);
  }
}

async function main() {
  let data;
  try {
    data = await loadAllData();
  } catch (err) {
    setStatus(`Fehler beim Laden: ${err.message}`, true);
    return;
  }

  const zoneSel = document.getElementById('zone');
  const diffSel = document.getElementById('difficulty');
  data.zones.forEach((z) => {
    const opt = document.createElement('option');
    opt.value = z.id;
    opt.textContent = z.name;
    zoneSel.appendChild(opt);
  });
  data.difficulties.forEach((d) => {
    const opt = document.createElement('option');
    opt.value = d.id;
    opt.textContent = d.id;
    diffSel.appendChild(opt);
  });

  const seedInput = document.getElementById('seed');
  const spawnBtn = document.getElementById('spawn');
  const spawnWorldBtn = document.getElementById('spawnToWorld');
  const outEl = document.getElementById('out');

  spawnBtn.addEventListener('click', async () => {
    spawnBtn.disabled = true;
    spawnWorldBtn.disabled = true;
    const zoneId = zoneSel.value;
    const difficulty = diffSel.value;
    const seed = seedInput.value;
    const t0 = performance.now();
    lastSpawn = null;
    try {
      const res = await spawnPack({ zoneId, difficulty, seed });
      lastSpawn = Array.isArray(res) ? res : res.pack;
      outEl.textContent = JSON.stringify(res, null, 2);
      const zoneLevel = res.zoneLevel ?? 'N/A';
      const ms = Math.round(performance.now() - t0);
      setStatus(`Spawn OK • ZoneLevel=${zoneLevel} • Seed="${seed}" • ${ms}ms`);
    } catch (err) {
      lastSpawn = null;
      console.error(err);
      setStatus(err.message, true);
    } finally {
      spawnBtn.disabled = false;
      spawnWorldBtn.disabled = false;
    }
  });

  spawnWorldBtn.addEventListener('click', () => {
    if (Array.isArray(lastSpawn) && lastSpawn.length) {
      const added = addUnitsToWorld(lastSpawn);
      const summary = getWorldSummary();
      setStatus(`Spawned to world: ${added.length} entities • Enemies total: ${summary.enemies}`);
    } else {
      setStatus("Bitte zuerst 'Spawn Pack' ausführen.", true);
    }
  });
}

main();
