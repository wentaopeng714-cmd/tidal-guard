import './style.css';
import {Game,LEVELS,type Upgrade} from './simulation';
import {World} from './world';
import {Sound} from './audio';

const svg=(content:string)=>`<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.1" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${content}</svg>`;
const icons={heart:svg('<path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z" fill="currentColor"/>'),coin:svg('<circle cx="12" cy="12" r="9"/><path d="M14.5 8.5h-4a2 2 0 0 0 0 4h3a2 2 0 0 1 0 4H9.5M12 6v12"/>'),power:svg('<path d="m12 2 2.2 6.1 6.5-2-3 6 4.3 4.9-6.5.2L12 23l-3.5-5.8-6.5-.2 4.3-4.9-3-6 6.5 2Z" fill="currentColor"/>'),haste:svg('<path d="m13.5 2-9 12h6L10 22l9.5-13H13l.5-7Z" fill="currentColor"/>'),chain:svg('<path d="m4 17 5-5 5 3 6-10M15 5h5v5"/><circle cx="4" cy="17" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="14" cy="15" r="2"/>'),shield:svg('<path d="m12 3 8 3v6c0 5-8 9-8 9s-8-4-8-9V6l8-3Z"/><path d="m8 12 3 3 5-6"/>'),pause:svg('<path d="M8 5v14M16 5v14" stroke-width="4"/>'),play:svg('<path d="m8 4 12 8-12 8Z" fill="currentColor"/>'),sound:svg('<path d="m11 4-6 5H2v6h3l6 5V4ZM16 8a6 6 0 0 1 0 8M19 4a11 11 0 0 1 0 16"/>'),mute:svg('<path d="m11 4-6 5H2v6h3l6 5V4ZM16 9l6 6M22 9l-6 6"/>'),help:svg('<circle cx="12" cy="12" r="9"/><path d="M9 9a3 3 0 0 1 6 0c0 2-3 2-3 4M12 17h.01"/>'),burst:svg('<circle cx="12" cy="12" r="4"/><path d="M12 1v3m0 16v3M1 12h3m16 0h3M4 4l2 2m12 12 2 2M4 20l2-2M18 6l2-2"/>'),arrow:svg('<path d="M5 12h14m-6-6 6 6-6 6"/>')};
document.querySelector('#app')!.innerHTML=`
<main class="game-shell">
 <header class="masthead"><a class="brand" href="#" aria-label="潮汐守卫"><span class="brand-mark">${icons.burst}</span><span>潮汐守卫<small>TIDAL GUARD</small></span></a><span class="edition">A LITTLE ISLAND. A BIG DEFENCE.</span><div class="tools"><button id="sound" class="tool" aria-label="开启音效" title="音效">${icons.mute}</button><button id="help" class="tool" aria-label="玩法帮助">${icons.help}</button></div></header>
 <section class="hud" aria-label="战斗状态"><div class="health stat">${icons.heart}<span id="hearts">3</span><span id="shield-count"></span></div><button id="levels" class="wave-stat" aria-label="查看15关路线"><div class="wave-title"><span id="level-name">初见车队</span><strong>关卡 <b id="wave">01</b><i> / 15</i></strong></div><div class="progress"><span id="progress"></span></div></button><div class="money stat">${icons.coin}<span id="coins">24</span></div><button id="pause" class="tool pause" aria-label="暂停游戏">${icons.pause}</button></section>
 <div id="world"></div><div class="paper-grain" aria-hidden="true"></div>
 <div class="island-caption"><span>01 — SUNSHELL BAY</span><i>晴 · 微风 · 适合守岛</i></div>
 <div id="toast" role="status"></div>
 <div class="tower-label"><span class="live-dot"></span><span id="tower-level">海盐炮塔 · LV 1</span><span class="tag">AUTO</span></div>
 <div id="welcome" class="welcome"><span class="eyebrow">WELCOME TO SUNSHELL BAY</span><h1>把夏天，守住。</h1><p>击破方块，收集金币。<br>击败高血量车头，建造你的炮台阵列。</p><button id="start" class="start-button">开始守岛 ${icons.arrow}</button><small>160 血车头 · 15 关挑战 · 最多 5 座炮台</small></div>
 <div id="level-clear" class="level-clear" hidden><span class="eyebrow">COAST CLEAR</span><h2 id="clear-title"></h2><p id="clear-info"></p><button id="next-level" class="start-button">进入下一关</button><small>可先在下方升级 / 增建炮台，再出发。</small></div>
 <footer class="dock"><div class="dock-top"><button id="build-tower" class="build-button" aria-label="增建炮台"><b>＋ 增建炮台</b><span id="build-price">24 金币</span><span id="tower-count">1 / 5</span></button><button id="speed" title="切换游戏速度">1× 速度</button></div><div class="upgrades">
 ${(['power','haste','chain','shield'] as Upgrade[]).map((type,i)=>`<button class="upgrade ${type}" id="${type}" data-upgrade="${type}" aria-label="${['升级火力','升级射速','升级连锁','修复或购买护盾'][i]}"><span class="upgrade-top"><span class="icon">${icons[type]}</span><kbd>${i+1}</kbd></span><span class="upgrade-name">${['火力强化','极速装填','连锁弹射','海岸护盾'][i]}</span><span class="upgrade-desc" id="desc-${type}">${['全体伤害 +3','全体射速 +18%','全体弹射 +1','修复 / 抵挡 1 次'][i]}</span><span class="upgrade-foot"><span id="level-${type}">LV 0</span><strong>${icons.coin}<b id="cost-${type}">6</b></strong></span></button>`).join('')}
 <button id="burst" class="burst" aria-label="释放潮汐爆发"><span class="burst-icon">${icons.burst}</span><strong>潮汐爆发</strong><span id="burst-state">全场冲击</span><kbd>SPACE</kbd><span class="burst-progress" id="burst-progress"></span></button>
 </div><p class="footer-note"><span id="hint">点击开始，海岸就交给你了。</span><span id="best">BEST 00</span></p></footer>
 <div id="modal" class="modal" hidden><section class="modal-card" role="dialog" aria-modal="true" aria-labelledby="modal-title"><span class="eyebrow" id="modal-eyebrow"></span><h2 id="modal-title"></h2><div id="modal-body"></div><button id="modal-action" class="start-button"></button><button id="modal-secondary" class="text-button" hidden>重新开始</button></section></div>
 <div id="webgl-error" hidden>你的浏览器暂时无法启动 3D 画面。请启用硬件加速后刷新页面。</div>
</main>`;
const $=<T extends HTMLElement=HTMLElement>(id:string)=>document.getElementById(id) as T;
let game=new Game();const sound=new Sound();let world:World;
try{world=new World($('world'));}catch(error){$('webgl-error').hidden=false;throw error;}
let highScore=0;try{highScore=Number(localStorage.getItem('tidal-guard-best')||0);sound.enabled=localStorage.getItem('tidal-guard-sound')==='true';}catch{}
let toastTimer=0,modalKind='',lastMode=game.mode,lastWave=0,manual=false,lastUI='';
function toast(message:string){$('toast').textContent=message;$('toast').classList.add('visible');toastTimer=2.7;}
function updateSound(){ $('sound').innerHTML=sound.enabled?icons.sound:icons.mute;$('sound').setAttribute('aria-label',sound.enabled?'关闭音效':'开启音效');$('sound').setAttribute('aria-pressed',String(sound.enabled)); }
function syncUI(){
 const signature=JSON.stringify([game.mode,game.coins,game.hp,game.shield,game.wave,game.defeated,game.levels,Math.ceil(game.burstCooldown),game.enemies.length>0,game.targetId,game.kills,game.mode==='intermission',game.speed,highScore,game.towerCount]);
 $('burst-progress').style.transform=`scaleY(${game.burstCooldown/22})`;
 if(signature===lastUI)return;lastUI=signature;
 $('coins').textContent=String(game.coins);$('hearts').textContent=String(game.hp);$('shield-count').innerHTML=game.shield?`${icons.shield}${game.shield}`:'';
 $('wave').textContent=String(game.wave).padStart(2,'0');$('progress').style.width=`${game.defeated/game.waveCount*100}%`;
 $('tower-level').textContent=`炮台 ${game.towerCount} / 5 · 每发 ${game.damage} · ${(1/game.interval).toFixed(1)} 发/秒`;
 $('level-name').textContent=game.config.name;
 $<HTMLButtonElement>('build-tower').disabled=!game.canBuild();$('build-price').textContent=game.towerCount===game.maxTowers?'已建满':`${game.buildCost} 金币`;
 $('tower-count').textContent=`${game.towerCount} / ${game.maxTowers}`;
 $('level-clear').hidden=game.mode!=='intermission';
 if(game.mode==='intermission'){const next=LEVELS[game.wave];$('clear-title').textContent=`第 ${game.wave} 关守住了！`;$('clear-info').textContent=`奖励 +${game.config.bonus} 金币。下一关：${next.name}，${next.heads} 个 ${next.headHp} 血车头。`;$('next-level').textContent=`进入第 ${game.wave+1} 关 →`;} 
 $('welcome').hidden=game.mode!=='ready';$('tower-level').parentElement!.classList.toggle('hidden',game.mode==='ready'||game.mode==='intermission');
 $('pause').innerHTML=game.mode==='paused'?icons.play:icons.pause;($('pause') as HTMLButtonElement).disabled=game.mode==='ready'||game.mode==='won'||game.mode==='lost'||game.mode==='intermission';
 $('pause').setAttribute('aria-label',game.mode==='paused'?'继续游戏':'暂停游戏');
 for(const type of ['power','haste','chain','shield'] as Upgrade[]){
   const maxed=type==='shield'?game.shield>=3:game.levels[type]>=game.limit(type);
   ($<HTMLButtonElement>(type)).disabled=!game.canBuy(type);$('cost-'+type).textContent=maxed?'MAX':String(game.cost(type));$('level-'+type).textContent=type==='shield'?`护盾 ${game.shield}`:`LV ${game.levels[type]}`;
 }
 const cooldown=game.burstCooldown;$('burst-state').textContent=cooldown>0?`${Math.ceil(cooldown)}s 冷却`:'全场冲击';$<HTMLButtonElement>('burst').disabled=game.mode!=='playing'||cooldown>0||game.enemies.length===0;
 $('burst-progress').style.transform=`scaleY(${cooldown/22})`;$('speed').textContent=`${game.speed}× 速度`;
 $('best').textContent=`BEST ${String(Math.max(highScore,game.kills)).padStart(2,'0')}`;
 $('hint').textContent=game.mode==='ready'?'点击开始，海岸就交给你了。':game.mode==='intermission'?'本关已清空 · 所有升级对全部炮台生效':`已击破 ${game.kills} · ${game.targetId?'正在锁定目标':'自动追踪中'} · 点击方块集火`;
}
function showModal(kind:string){
 modalKind=kind;$('modal').hidden=false;$('modal-secondary').hidden=kind!=='pause';
 const titles:Record<string,string>={pause:'海风歇一会儿。',help:'组建你的海岸炮台阵列。',levels:'十五关，一条海岸线。',won:'海岸，守住了。',lost:'再守一次夏天。'};
 $('modal-title').textContent=titles[kind];$('modal-eyebrow').textContent=({pause:'TAKE A LITTLE BREAK',help:'HOW TO PLAY',levels:'CAMPAIGN · 15 LEVELS',won:'ISLAND PROTECTED',lost:'THE TIDE WILL TURN'} as Record<string,string>)[kind];
 $('modal-body').innerHTML=kind==='levels'?`<div class=level-grid>${LEVELS.map(l=>`<div class="level-node ${l.number<game.wave?'complete':l.number===game.wave?'current':''}"><b>${String(l.number).padStart(2,'0')}</b><span>${l.name}</span><small>车头 ${l.headHp}</small></div>`).join('')}</div><p>关卡逐一解锁。金币、升级和已建炮台带入下一关。</p>`:kind==='help'?`<ul class="instructions"><li><b>守住中心</b><span>高血量车头拖着方块车厢靠近，漏过敌人会扣生命。</span></li><li><b>强化炮塔</b><span>用金币增建炮台（B 键），最多 5 座。伤害、射速和弹射升级对全部炮台生效，数字键 1–4 购买升级。</span></li><li><b>主动出击</b><span>点击方块锁定目标。空格释放全场爆发，22 秒后恢复。</span></li><li><b>逐关推进</b><span>共 15 关，车头血量、数量、车厢数量和速度逐渐提高。关间可以整备，点击“进入下一关”再出发。P / Esc 暂停。</span></li></ul>`:kind==='pause'?'<p>你的炮塔和海岸都在等你。</p>':`<p>${kind==='won'?'每一颗金币，都没白花。':'把金币花在火力上，试试及时释放潮汐爆发。'}</p><div class="results"><span><b>${game.wave}<small> / 15</small></b>抵达波次</span><span><b>${game.kills}</b>击破方块</span><span><b>${game.earned}</b>获得金币</span></div>`;
 $('modal-action').innerHTML=(kind==='pause'?'继续守岛':(kind==='help'||kind==='levels')?'知道了':kind==='won'?'再来一局':'再试一次')+icons.arrow;
 requestAnimationFrame(()=>$('modal-action').focus());
}
function closeModal(){ $('modal').hidden=true;modalKind=''; }
function restart(){closeModal();world.reset();game=new Game();game.start();lastMode='playing';toast('第 1 关 · 160 血车头来袭');syncUI();}
function pause(){if(!['playing','paused'].includes(game.mode))return;game.togglePause();if(game.mode==='paused')showModal('pause');else closeModal();syncUI();}
$('next-level').onclick=()=>{if(game.nextLevel())syncUI();};
$('build-tower').onclick=()=>{sound.unlock();if(game.buildTower()){toast(`第 ${game.towerCount} 座炮台已建好 · 自动加入战斗`);syncUI();}};
$('levels').onclick=()=>{helpResume=game.mode==='playing';if(helpResume)game.togglePause();showModal('levels');};
$('start').onclick=()=>{sound.unlock();game.start();syncUI();};
$('sound').onclick=()=>{sound.unlock();sound.enabled=!sound.enabled;try{localStorage.setItem('tidal-guard-sound',String(sound.enabled));}catch{}updateSound();sound.play('buy');};
$('pause').onclick=pause;
let helpResume=false;
$('help').onclick=()=>{helpResume=game.mode==='playing';if(helpResume)game.togglePause();showModal('help');};
$('modal-action').onclick=()=>{sound.unlock();if(modalKind==='pause'){game.togglePause();closeModal();}else if(modalKind==='help'||modalKind==='levels'){if(helpResume&&game.mode==='paused')game.togglePause();closeModal();}else restart();syncUI();};
$('modal-secondary').onclick=restart;
for(const type of ['power','haste','chain','shield'] as Upgrade[])$(type).onclick=()=>{sound.unlock();if(game.buy(type)){toast(({power:'全部炮台强化 · 每发 '+game.damage+' 点伤害',haste:'极速装填 · 火力更密集了',chain:'连锁弹射 · 一发命中多个方块',shield:'海岸防线已加固'})[type]);syncUI();}};
$('burst').onclick=()=>{sound.unlock();if(game.burst())toast('潮汐爆发！');};
$('speed').onclick=()=>{game.speed=game.speed===1?2:1;syncUI();};
world.renderer.domElement.addEventListener('pointerdown',e=>{sound.unlock();const id=world.pick(e.clientX,e.clientY);if(id!==null){game.select(id);syncUI();}});
window.addEventListener('keydown',e=>{
 if(e.repeat)return;
 if(e.key==='Escape'||e.code==='KeyP'){if(modalKind==='help'||modalKind==='levels')$('modal-action').click();else pause();return;}
 if(!$('modal').hidden)return;
 if(e.code==='KeyB')$('build-tower').click();
 if(e.code==='Space'){e.preventDefault();if(game.mode==='ready')$('start').click();else $('burst').click();}
 if(['1','2','3','4'].includes(e.key))$((['power','haste','chain','shield'])[Number(e.key)-1]).click();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&game.mode==='playing')pause();});
world.renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();if(game.mode==='playing')pause();toast('画面连接中断，请刷新重试');});
world.renderer.domElement.addEventListener('webglcontextrestored',()=>location.reload());
function step(dt:number){
 const simDt=dt*game.speed;const steps=Math.ceil(simDt/(1/60));for(let i=0;i<steps;i++)game.tick(simDt/steps);
 for(const e of game.events){world.event(e);sound.play(e.type);if(e.type==='wave')toast(`第 ${e.amount} 关 · ${game.config.name} · 车头 ${game.config.headHp} 血`);if(e.type==='clear')toast(`过关！奖励 +${e.amount} 金币`);}game.events=[];
 if(game.mode!==lastMode){if(game.mode==='won'||game.mode==='lost'){highScore=Math.max(highScore,game.kills);try{localStorage.setItem('tidal-guard-best',String(highScore));}catch{}showModal(game.mode);}lastMode=game.mode;}
 if(game.wave!==lastWave)lastWave=game.wave;
 if(toastTimer>0){toastTimer-=dt;if(toastTimer<=0)$('toast').classList.remove('visible');}
 world.update(game,game.mode==='paused'?0:dt);syncUI();
}
let last=performance.now();function frame(now:number){const dt=Math.min(.05,(now-last)/1000);last=now;if(!manual)step(dt);requestAnimationFrame(frame);}requestAnimationFrame(frame);updateSound();syncUI();
Object.assign(window,{
 render_game_to_text:()=>JSON.stringify({...game.snapshot(),assetsReady:world.assetsReady,assetError:world.assetError,drawCalls:world.renderer.info.render.calls,triangles:world.renderer.info.render.triangles}),
 advanceTime:(ms:number)=>{manual=true;for(let left=ms/1000;left>0;left-=1/60)step(Math.min(1/60,left));},
 resumeRealtime:()=>{manual=false;},
});
