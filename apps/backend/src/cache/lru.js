export class LRU {
  constructor({ max = 500, ttl = 3600_000 } = {}) {
    this.max = max; this.ttl = ttl; this.map = new Map();
  }
  _now() { return Date.now(); }
  get(k) {
    const e = this.map.get(k);
    if (!e) return null;
    if (e.exp && e.exp < this._now()) { this.map.delete(k); return null; }
    // touch
    this.map.delete(k); this.map.set(k, e);
    return e.val;
  }
  set(k, v) {
    const exp = this.ttl ? this._now() + this.ttl : 0;
    if (this.map.has(k)) this.map.delete(k);
    this.map.set(k, { val: v, exp });
    if (this.map.size > this.max) {
      const oldest = this.map.keys().next().value;
      this.map.delete(oldest);
    }
  }
}
