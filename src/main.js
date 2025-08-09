import { initLegacyGame } from './legacy/game.js';

const rootEl = document.getElementById('app');
if (rootEl) {
  initLegacyGame(rootEl);
}
