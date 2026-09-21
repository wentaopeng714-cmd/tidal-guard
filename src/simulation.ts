export type Mode = 'ready' | 'playing' | 'paused' | 'intermission' | 'won' | 'lost';
export type Upgrade = 'power' | 'haste' | 'chain' | 'shield';
export const ENEMY_GAP = .029; // 1.75 world units: enough for a locomotive and a wagon, including bends.
export const TOWER_SITES = [
  { x: -1.1, z: 2.717 }, { x: .4, z: -5.8 },
  { x: 3.25, z: 1.1 }, { x: -1.4, z: 6.55 }, { x: -2.9, z: -.6 },
];
const names = ['初见车队','珊瑚浅滩','椰林弯道','潮声渐近','重装先锋','双车头来袭','沙洲长队','疾风海湾','装甲列阵','重装双列','三列压境','落日追击','深潮防线','最后的海湾','潮汐终章'];
export const LEVELS = names.map((name, i) => ({
  number: i + 1, name, count: 16 + i * 3, heads: 1 + Math.floor(i / 5),
  headHp: Math.round(160 * Math.pow(1.43, i)),
  wagonHp: Math.round(6 * Math.pow(1.23, i)),
  speed: .0105 + i * .00048,
  reward: 2 + Math.floor(i / 3), bonus: 12 + i * 5,
}));
// Direct entry uses a fixed equipment kit; sequential play preserves earned upgrades.
export function startingKit(level: number) {
  const i = level - 1;
  return { towers: Math.min(5, 1 + Math.ceil(i / 3)), power: Math.ceil(i * .72),
    haste: Math.min(8, Math.ceil(i * .6)), chain: Math.min(3, Math.floor(i / 4)), coins: 24 + i * 12 };
}
export interface Enemy { id: number; p: number; hp: number; maxHp: number; color: number; speed: number; hit: number; boss: boolean }
export interface Shot { id: number; source: number; target: number; remaining: number; duration: number; damage: number; chain: number }
export interface Event { type: 'shot'|'hit'|'kill'|'leak'|'wave'|'burst'|'buy'|'build'|'clear'|'win'|'lose'; id?: number; source?: number; p?: number; amount?: number; color?: number }
export class Game {
  mode: Mode = 'ready'; wave = 1; readonly maxWaves = LEVELS.length;
  hp = 3; shield = 0; coins = 24; kills = 0; earned = 0; towerCount = 1;
  levels = { power: 0, haste: 0, chain: 0 };
  enemies: Enemy[] = []; shots: Shot[] = []; events: Event[] = [];
  elapsed = 0; waveTime = 0; spawned = 0; defeated = 0;
  towerTimers = [0]; spawnTimer = 0; burstCooldown = 0; targetId: number|null = null;
  nextId = 1; seed = 237; speed = 1;
  constructor(level = 1) {
    if (!Number.isInteger(level) || level < 1 || level > LEVELS.length) throw new RangeError('关卡范围为 1–15');
    this.wave = level;
    const kit = startingKit(level);
    this.towerCount = kit.towers; this.coins = kit.coins;
    this.levels = { power: kit.power, haste: kit.haste, chain: kit.chain };
    this.towerTimers = Array(kit.towers).fill(0);
  }
  get config() { return LEVELS[this.wave - 1]; }
  get waveCount() { return this.config.count; }
  get damage() { return 3 + this.levels.power * 3; }
  get interval() { return Math.max(.14, .44 * Math.pow(.85, this.levels.haste)); }
  get maxLevel() { return 12; }
  get maxTowers() { return TOWER_SITES.length; }
  get buildCost() { return [24, 75, 180, 360][this.towerCount - 1] ?? Infinity; }
  get canShop() { return this.mode === 'playing' || this.mode === 'intermission'; }
  random() { this.seed = (Math.imul(this.seed, 1664525) + 1013904223) >>> 0; return this.seed / 4294967296; }
  cost(type: Upgrade) {
    if (type === 'shield') return 18 + this.shield * 9;
    return Math.round(({ power: 8, haste: 10, chain: 18 }[type]) * Math.pow(1.52, this.levels[type]));
  }
  limit(type: Upgrade) { return type === 'chain' ? 4 : type === 'haste' ? 8 : this.maxLevel; }
  canBuy(type: Upgrade) {
    return this.canShop && this.coins >= this.cost(type) && (type === 'shield' ? this.shield < 3 || this.hp < 3 : this.levels[type] < this.limit(type));
  }
  buy(type: Upgrade) {
    if (!this.canBuy(type)) return false;
    this.coins -= this.cost(type);
    if (type === 'shield') { if (this.hp < 3) this.hp++; else this.shield++; }
    else this.levels[type]++;
    this.events.push({ type: 'buy' }); return true;
  }
  canBuild() { return this.canShop && this.towerCount < this.maxTowers && this.coins >= this.buildCost; }
  buildTower() {
    if (!this.canBuild()) return false;
    this.coins -= this.buildCost; this.towerCount++;
    this.towerTimers.push(this.interval * .35);
    this.events.push({ type: 'build', amount: this.towerCount }); return true;
  }
  beginLevel() {
    this.mode = 'playing'; this.enemies = []; this.shots = []; this.spawned = 0; this.defeated = 0;
    this.waveTime = 0; this.spawnTimer = 1.6; this.targetId = null; this.burstCooldown = 0;
    this.towerTimers = Array.from({ length: this.towerCount }, (_, i) => i * .045);
    // Seed a connected convoy with the high-HP locomotive at the front.
    for (let i = 0; i < 6; i++) { this.spawn(true); this.enemies[i].p = (5 - i) * ENEMY_GAP; }
    this.events.push({ type: 'wave', amount: this.wave });
  }
  start() { if (this.mode === 'ready') this.beginLevel(); }
  nextLevel() {
    if (this.mode !== 'intermission' || this.wave >= this.maxWaves) return false;
    this.wave++; this.beginLevel(); return true;
  }
  togglePause() { if (this.mode === 'playing') this.mode = 'paused'; else if (this.mode === 'paused') this.mode = 'playing'; }
  select(id: number) { if (this.mode === 'playing' && this.enemies.some(e => e.id === id)) this.targetId = id; }
  burst() {
    if (this.mode !== 'playing' || this.burstCooldown > 0 || !this.enemies.length) return false;
    this.burstCooldown = 22; this.events.push({ type: 'burst' });
    for (const e of [...this.enemies]) this.hit(e, 12 + this.levels.power * 6);
    return true;
  }
  spawn(initial = false) {
    if (this.spawned >= this.waveCount) return false;
    if (!initial && this.enemies.some(e => e.p < ENEMY_GAP)) return false;
    const stride = Math.ceil(this.waveCount / this.config.heads);
    const boss = this.spawned % stride === 0;
    const hp = boss ? this.config.headHp : Math.round(this.config.wagonHp * (.85 + this.random() * .3));
    this.enemies.push({ id: this.nextId++, p: 0, hp, maxHp: hp, color: Math.floor(this.random() * 5), speed: this.config.speed, hit: 0, boss });
    this.spawned++; return true;
  }
  hit(e: Enemy, amount: number) {
    if (!this.enemies.includes(e)) return;
    e.hp -= amount; e.hit = .1; this.events.push({ type: 'hit', id: e.id, p: e.p, amount });
    if (e.hp <= 0) {
      const reward = e.boss ? 18 + this.wave * 5 : this.config.reward;
      this.coins += reward; this.earned += reward; this.kills++; this.defeated++;
      this.events.push({ type: 'kill', id: e.id, p: e.p, amount: reward, color: e.color });
      this.enemies.splice(this.enemies.indexOf(e), 1);
      if (this.targetId === e.id) this.targetId = null;
    }
  }
  targetForTower(source: number) {
    const manual = this.enemies.find(e => e.id === this.targetId);
    if (manual) return manual;
    const sorted = [...this.enemies].sort((a, b) => b.p - a.p);
    const available = sorted.filter(e => e.hp > this.shots.filter(s => s.target === e.id).reduce((n, s) => n + s.damage, 0));
    const candidates = available.length ? available : sorted;
    // Auxiliary turrets clear wagons for income while the main turret attacks the locomotive.
    return (source > 0 ? candidates.find(e => !e.boss) : undefined) ?? candidates[0];
  }
  tick(dt: number) {
    if (this.mode !== 'playing') return;
    this.elapsed += dt; this.waveTime += dt; this.burstCooldown = Math.max(0, this.burstCooldown - dt);
    // Every member of the convoy has the same speed. Keep the spacing invariant even if data is changed later.
    let previousP = Infinity;
    for (const e of [...this.enemies].sort((a, b) => b.p - a.p)) {
      e.p = Math.min(e.p + e.speed * dt, previousP - ENEMY_GAP); previousP = e.p;
      e.hit = Math.max(0, e.hit - dt);
      if (e.p >= 1) {
        this.enemies.splice(this.enemies.indexOf(e), 1); this.defeated++;
        if (this.targetId === e.id) this.targetId = null;
        if (this.shield > 0) this.shield--; else this.hp--;
        this.events.push({ type: 'leak', id: e.id, p: 1 });
        if (this.hp <= 0) { this.hp = 0; this.mode = 'lost'; this.events.push({ type: 'lose' }); return; }
      }
    }
    this.spawnTimer -= dt;
    if (this.spawned < this.waveCount && this.spawnTimer <= 0 && this.spawn()) this.spawnTimer = Math.max(.9, 1.8 - this.wave * .045);
    for (const shot of [...this.shots]) {
      shot.remaining -= dt;
      if (shot.remaining > 0) continue;
      this.shots.splice(this.shots.indexOf(shot), 1);
      const target = this.enemies.find(e => e.id === shot.target);
      if (target) {
        const near = this.enemies.filter(e => e.id !== target.id && Math.abs(e.p - target.p) < ENEMY_GAP * 4.1)
          .sort((a, b) => Math.abs(a.p - target.p) - Math.abs(b.p - target.p));
        this.hit(target, shot.damage);
        for (const e of near.slice(0, shot.chain)) this.hit(e, Math.max(1, Math.floor(shot.damage * .65)));
      }
    }
    for (let source = 0; source < this.towerCount; source++) {
      this.towerTimers[source] -= dt;
      if (this.towerTimers[source] > 0 || !this.enemies.length) continue;
      const target = this.targetForTower(source);
      const duration = .2;
      this.shots.push({ id: this.nextId++, source, target: target.id, remaining: duration, duration, damage: this.damage, chain: this.levels.chain });
      this.events.push({ type: 'shot', id: target.id, source, p: target.p });
      this.towerTimers[source] = this.interval;
    }
    if (this.spawned === this.waveCount && this.enemies.length === 0) {
      this.shots = []; this.targetId = null;
      this.coins += this.config.bonus; this.earned += this.config.bonus;
      this.mode = this.wave === this.maxWaves ? 'won' : 'intermission';
      this.events.push({ type: this.mode === 'won' ? 'win' : 'clear', amount: this.config.bonus });
    }
  }
  snapshot() {
    return { mode: this.mode, wave: this.wave, maxWaves: this.maxWaves, hp: this.hp, shield: this.shield, coins: this.coins, kills: this.kills,
      towerCount: this.towerCount, levels: this.levels, spawned: this.spawned, waveCount: this.waveCount,
      burstCooldown: +this.burstCooldown.toFixed(2), targetId: this.targetId,
      enemies: this.enemies.map(e => ({ id: e.id, p: +e.p.toFixed(4), hp: e.hp, boss: e.boss })),
      coordinateSystem: 'XZ ground, Y up; p 0=entry, p 1=central tower' };
  }
}
