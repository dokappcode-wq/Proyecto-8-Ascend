import { GameManager } from './core/GameManager.js';
import TrainingGround from './world/maps/TrainingGround.js';
import DistrictZero from './world/maps/DistrictZero.js';
import { VillageNight, VillageDay } from './world/maps/Village.js';
import Forest from './world/maps/Forest.js';
import Ibaia from './world/maps/Ibaia.js';

const game = new GameManager({
  canvas: document.getElementById('game'),
  // Los mapas de la historia (pueblo de noche y de día, bosque) solo se cargan desde el Prólogo
  maps: [TrainingGround, DistrictZero, VillageNight, VillageDay, Forest, Ibaia],
});

// Acceso para depuración desde la consola y para las pruebas automáticas.
window.__ascend = game;
