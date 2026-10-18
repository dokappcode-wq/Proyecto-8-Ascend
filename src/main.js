import { GameManager } from './core/GameManager.js';
import TrainingGround from './world/maps/TrainingGround.js';
import DistrictZero from './world/maps/DistrictZero.js';

const game = new GameManager({
  canvas: document.getElementById('game'),
  maps: [TrainingGround, DistrictZero],
});

// Acceso para depuración desde la consola y para las pruebas automáticas.
window.__ascend = game;
