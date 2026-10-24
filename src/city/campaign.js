import { CERO } from './cero/index.js';

/** Barrios con campaña (de momento, el Distrito Cero). */
export function registerCampaign(director) {
  director.register(CERO);
}
