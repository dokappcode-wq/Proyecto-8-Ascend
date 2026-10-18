/**
 * EventBus — comunicación desacoplada entre sistemas.
 * Los sistemas publican eventos (p. ej. 'map:loaded', 'player:landed') sin
 * conocer quién los escucha.
 */
export class EventBus {
  constructor() {
    this._handlers = new Map();
  }

  on(type, handler) {
    if (!this._handlers.has(type)) this._handlers.set(type, new Set());
    this._handlers.get(type).add(handler);
    return () => this.off(type, handler);
  }

  off(type, handler) {
    this._handlers.get(type)?.delete(handler);
  }

  emit(type, payload) {
    const set = this._handlers.get(type);
    if (!set) return;
    for (const h of [...set]) h(payload);
  }
}
