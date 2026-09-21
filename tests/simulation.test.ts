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
 const g=new Game();g.start();g.buildTower();let count=0,leaks=0;const results=[];
 for(;count<60*3600&&!['won','lost'].includes(g.mode);count++){
  if(g.canShop){
   if(g.hp<3&&g.canBuy('shield'))g.buy('shield');
   if(g.towerCount<Math.min(5,2+Math.floor(g.wave/3))&&g.canBuild())g.buildTower();
   if(g.wave>=7&&g.levels.chain<4&&g.canBuy('chain'))g.buy('chain');
   else if(g.levels.power<=g.levels.haste+1&&g.canBuy('power'))g.buy('power');
   else if(g.canBuy('haste')&&g.levels.haste<8)g.buy('haste');
   else if(g.levels.chain<3&&g.canBuy('chain'))g.buy('chain');
   if(g.mode==='intermission'){results.push({level:g.wave,seconds:Math.round(g.waveTime),towers:g.towerCount,hp:g.hp});g.nextLevel();}
  }
  if(g.enemies.filter(e=>!e.boss).length>=4)g.burst();
  g.tick(1/60);leaks+=g.events.filter(e=>e.type==='leak').length;g.events=[];
 }
 assert.equal(g.mode,'won',JSON.stringify(g.snapshot()));assert.equal(g.wave,15);assert.equal(g.kills+leaks,LEVELS.reduce((n,l)=>n+l.count,0));assert.ok(leaks<=8);assert.equal(g.towerCount,5);
 console.log('Campaign:',JSON.stringify({seconds:Math.round(count/60),kills:g.kills,levels:g.levels,coins:g.coins,stages:results}));
});
test('without upgrades, escalating campaign eventually defeats the initial turret',()=>{const g=new Game();g.start();for(let t=0;t<60*1800&&!['won','lost'].includes(g.mode);t++){if(g.mode==='intermission')g.nextLevel();g.tick(1/60);g.events=[];}assert.equal(g.mode,'lost');assert.ok(g.wave<15);});

test('direct level selection starts a clean, correctly equipped game',()=>{
 for(const n of [1,4,7,10,13,15]){
  const g=new Game(n);assert.equal(g.wave,n);assert.equal(g.hp,3);assert.equal(g.kills,0);
  assert.equal(g.enemies.length,0);assert.equal(g.mode,'ready');
  assert.ok(g.towerCount>=1&&g.towerCount<=5);assert.equal(g.towerTimers.length,g.towerCount);
  g.start();assert.equal(g.enemies[0].maxHp,LEVELS[n-1].headHp);
  advance(g,.2);assert.deepEqual(new Set(g.shots.map(s=>s.source)),new Set(Array.from({length:g.towerCount},(_,i)=>i)));
 }
 for(const n of [0,16,1.5,NaN])assert.throws(()=>new Game(n),RangeError);
});
test('every selected stage can be cleared with its equipment and earned money',()=>{
 for(let n=1;n<=15;n++){
  const g=new Game(n);g.start();
  for(let t=0;t<60*240&&g.mode==='playing';t++){
   if(g.hp<3&&g.canBuy('shield'))g.buy('shield');
   if(g.towerCount<Math.min(5,2+Math.floor(g.wave/3))&&g.canBuild())g.buildTower();
   if(g.wave>=7&&g.levels.chain<4&&g.canBuy('chain'))g.buy('chain');
   else if(g.levels.power<=g.levels.haste+1&&g.canBuy('power'))g.buy('power');
   else if(g.levels.haste<8&&g.canBuy('haste'))g.buy('haste');
   else if(g.levels.chain<3&&g.canBuy('chain'))g.buy('chain');
   if(g.enemies.filter(e=>!e.boss).length>=4)g.burst();
   g.tick(1/60);g.events=[];
  }
  assert.ok(g.mode==='intermission'||g.mode==='won',`Selected level ${n}: ${JSON.stringify(g.snapshot())}`);
 }
});


test('late wagons survive an upgraded volley and HP does not rubber-band with purchases',()=>{
 for(const n of [5,10,15]){
  const g=new Game(n);g.start();const wagon=g.enemies.find(e=>!e.boss)!;
  assert.ok(wagon.hp>g.damage*5,`Level ${n} should require sustained fire`);
  const before=wagon.hp;g.hit(wagon,g.damage);assert.equal(wagon.hp,before-g.damage);
  const hp=wagon.hp,max=wagon.maxHp;g.coins=10000;g.buy('power');g.buy('haste');g.buildTower();
  assert.equal(wagon.hp,hp);assert.equal(wagon.maxHp,max);
 }
});
test('late stages defeat unattended starting equipment across different wagon rolls',()=>{
 for(const seed of [1,237,9001])for(const n of [10,13,15]){
  const g=new Game(n);g.seed=seed;g.start();advance(g,240);
  assert.equal(g.mode,'lost',`Level ${n}, seed ${seed} must not be an idle win`);
 }
});
test('all 15 selected stages remain winnable with deliberate upgrades and human-paced inputs',()=>{
 for(const seed of [1,237,9001])for(let n=1;n<=15;n++){
  const g=new Game(n);g.seed=seed;g.start();
  for(let tick=0;tick<240*60&&g.mode==='playing';tick++){
   if(tick%30===0){
    // At most one shop action every half second, including emergency repairs.
    if(g.hp<3&&g.canBuy('shield'))g.buy('shield');
    else if(g.towerCount<Math.min(5,2+Math.floor(n/3))&&g.canBuild())g.buildTower();
    else if(n>=7&&g.levels.chain<4&&g.canBuy('chain'))g.buy('chain');
    else if(g.levels.power<=g.levels.haste+1&&g.canBuy('power'))g.buy('power');
    else if(g.levels.haste<8&&g.canBuy('haste'))g.buy('haste');
    else if(g.levels.chain<3&&g.canBuy('chain'))g.buy('chain');
    if(g.enemies.filter(e=>!e.boss).length>=4)g.burst();
   }
   g.tick(1/60);g.events=[];
  }
  assert.ok(['intermission','won'].includes(g.mode),`Level ${n}, seed ${seed}: ${g.mode}`);
 }
});
