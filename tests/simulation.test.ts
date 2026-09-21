import test from 'node:test';
import assert from 'node:assert/strict';
import { Game, LEVELS, ENEMY_GAP } from '../src/simulation.ts';
const advance=(g:Game,seconds:number)=>{for(let i=0;i<seconds*60;i++)g.tick(1/60);};

test('15 distinct levels increase head HP, wagon HP, train size and speed',()=>{
 assert.equal(LEVELS.length,15);assert.equal(LEVELS[0].headHp,160);
 for(let i=1;i<15;i++){for(const key of ['headHp','wagonHp','count','speed'] as const)assert.ok(LEVELS[i][key]>LEVELS[i-1][key]);assert.ok(LEVELS[i].heads>=LEVELS[i-1].heads);}
 assert.equal(LEVELS[14].heads,3);
});
test('ready and paused games neither advance nor purchase',()=>{const g=new Game();advance(g,5);assert.equal(g.spawned,0);assert.equal(g.buy('power'),false);assert.equal(g.buildTower(),false);g.start();advance(g,1);g.togglePause();const state=JSON.stringify(g.snapshot());advance(g,10);assert.equal(JSON.stringify(g.snapshot()),state);assert.equal(g.buildTower(),false);g.togglePause();advance(g,1);assert.ok(g.elapsed>1);});
test('turrets have their own projectiles and share upgrades, with a limit of five',()=>{
 const g=new Game();g.start();const cost=g.buildCost;assert.ok(g.buildTower());assert.equal(g.coins,24-cost);assert.equal(g.towerCount,2);assert.equal(g.buildTower(),false);advance(g,.16);assert.deepEqual(new Set(g.shots.map(s=>s.source)),new Set([0,1]));
 g.coins=10000;while(g.canBuild())g.buildTower();assert.equal(g.towerCount,5);const before=g.coins;assert.equal(g.buildTower(),false);assert.equal(g.coins,before);g.buy('power');g.shots=[];g.towerTimers.fill(0);g.tick(.01);assert.equal(g.shots.length,5);assert.ok(g.shots.every(s=>s.damage===6));
});
test('coin costs and caps are enforced',()=>{const g=new Game();g.start();const before=g.coins,cost=g.cost('power');assert.ok(g.buy('power'));assert.equal(g.coins,before-cost);assert.equal(g.damage,6);g.coins=0;assert.equal(g.buy('haste'),false);g.coins=100000;for(let i=0;i<30;i++)g.buy('haste');assert.equal(g.levels.haste,8);assert.equal(g.buy('haste'),false);for(let i=0;i<8;i++)g.buy('chain');assert.equal(g.levels.chain,4);});
test('burst rewards wagons but does not instantly erase the high-HP engine',()=>{const g=new Game();g.start();const head=g.enemies.find(e=>e.boss)!,before=g.coins;assert.ok(g.burst());assert.ok(g.enemies.includes(head));assert.equal(head.hp,148);assert.ok(g.coins>before);assert.equal(g.burst(),false);assert.equal(g.burstCooldown,22);});
test('spawn and movement keep every train separated across all 15 levels',()=>{
 for(let level=1;level<=15;level++){const g=new Game();g.wave=level;g.start();g.hp=1000;g.towerTimers=[Infinity];assert.equal(g.spawn(),false);for(let t=0;t<120*60;t++){g.tick(1/60);const es=[...g.enemies].sort((a,b)=>b.p-a.p);for(let i=1;i<es.length;i++)assert.ok(es[i-1].p-es[i].p>=ENEMY_GAP-1e-10,`level ${level}: overlapping pair`);assert.ok(es.every(e=>e.p>=0));g.events=[];}}
});
test('leaks consume a shield first; losing clears manual target',()=>{const g=new Game();g.start();g.enemies=g.enemies.slice(0,4);g.towerTimers=[Infinity];g.shield=1;for(let i=0;i<4;i++){const e=g.enemies[0];g.targetId=e.id;e.p=.999999;g.tick(.1);}assert.equal(g.mode,'lost');assert.equal(g.hp,0);assert.equal(g.shield,0);assert.equal(g.targetId,null);});
test('level clear waits for the player and preserves towers and upgrades',()=>{const g=new Game();g.start();g.buildTower();g.coins=100;g.buy('power');g.enemies=[];g.spawned=g.waveCount;g.tick(.01);assert.equal(g.mode,'intermission');const elapsed=g.elapsed;advance(g,20);assert.equal(g.wave,1);assert.equal(g.elapsed,elapsed);assert.ok(g.buy('haste'));assert.ok(g.nextLevel());assert.equal(g.wave,2);assert.equal(g.towerCount,2);assert.equal(g.levels.power,1);assert.equal(g.levels.haste,1);assert.equal(g.enemies[0].maxHp,LEVELS[1].headHp);assert.equal(g.nextLevel(),false);});
test('complete 15-level campaign using only earned money and legal inputs',()=>{
 const g=new Game();g.start();g.buildTower();let count=0,lastLevel=1;const results=[];
 for(;count<60*3600&&!['won','lost'].includes(g.mode);count++){
  if(g.canShop){
   if(g.hp<3&&g.canBuy('shield'))g.buy('shield');
   if(g.towerCount<Math.min(5,2+Math.floor(g.wave/3))&&g.canBuild())g.buildTower();
   if(g.levels.power<=g.levels.haste+1&&g.canBuy('power'))g.buy('power');
   else if(g.canBuy('haste')&&g.levels.haste<8)g.buy('haste');
   else if(g.levels.chain<3&&g.canBuy('chain'))g.buy('chain');
   if(g.mode==='intermission'){results.push({level:g.wave,seconds:Math.round(g.waveTime),towers:g.towerCount,hp:g.hp});g.nextLevel();}
  }
  if(g.enemies.filter(e=>!e.boss).length>=4)g.burst();
  g.tick(1/60);g.events=[];
 }
 assert.equal(g.mode,'won',JSON.stringify(g.snapshot()));assert.equal(g.wave,15);assert.equal(g.kills,LEVELS.reduce((n,l)=>n+l.count,0));assert.equal(g.towerCount,5);
 console.log('Campaign:',JSON.stringify({seconds:Math.round(count/60),kills:g.kills,levels:g.levels,coins:g.coins,stages:results}));
});
test('without upgrades, escalating campaign eventually defeats the initial turret',()=>{const g=new Game();g.start();for(let t=0;t<60*1800&&!['won','lost'].includes(g.mode);t++){if(g.mode==='intermission')g.nextLevel();g.tick(1/60);g.events=[];}assert.equal(g.mode,'lost');assert.ok(g.wave<15);});
