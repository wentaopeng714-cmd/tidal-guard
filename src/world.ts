import * as THREE from 'three';
import {stageTheme} from './themes';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { ENEMY_GAP, TOWER_SITES, type Enemy, type Event, type Game } from './simulation';

const COLORS = [0xf25861,0x9255d1,0xb8e939,0x26bead,0xffb52e];
const INK=0x453449;
const points=[[-8.4,-5.5],[-5,-5.5],[-1,-5.5],[3.4,-5.3],[5.6,-3.7],[6,-.4],[5.4,3.6],[3,5.7],[-1,6],[-4.6,4.8],[-6,2],[-5.7,-1.5],[-3.9,-3],[-1.7,-2.6],[.1,-.6],[.5,1.2],[-1.1,1.9]];
export const path=new THREE.CatmullRomCurve3(points.map(([x,z])=>new THREE.Vector3(x,.12,z*1.43)),false,'centripetal');
const TOWER=new THREE.Vector3(-1.1,0,1.9*1.43);
interface Particle { mesh:THREE.Mesh; velocity:THREE.Vector3; life:number; max:number; coin:boolean }
export class World {
  renderer:THREE.WebGLRenderer;scene=new THREE.Scene();camera=new THREE.OrthographicCamera();
  tower=new THREE.Group();turret=new THREE.Group();enemies=new Map<number,THREE.Group>(); bullets=new Map<number,THREE.Mesh>();
  particles:Particle[]=[];rings:{mesh:THREE.Mesh;life:number}[]=[];floating:{sprite:THREE.Sprite;life:number}[]=[];labels=new Map<string,THREE.CanvasTexture>();
  mats=new Map<number,THREE.MeshStandardMaterial>();enemyGeometry=new RoundedBoxGeometry(1,1.04,1,2,.09);
  bulletGeometry=new THREE.SphereGeometry(.105,8,6);particleGeometry=new THREE.BoxGeometry(.1,.1,.1);
  coinGeometry=new THREE.CylinderGeometry(.15,.15,.045,10);raycaster=new THREE.Raycaster();pointer=new THREE.Vector2();
  towers:THREE.Group[]=[];turrets:THREE.Group[]=[];recoils:number[]=[];pads:THREE.Group[]=[];
  stage=0; beachObjects:THREE.Object3D[]=[]; palms=new THREE.Group(); scenery=new THREE.Group();
  groundMaterial=new THREE.MeshBasicMaterial({color:0xf8ebc2,toneMapped:false});
  roadMaterial=new THREE.MeshStandardMaterial({color:0xb89ba7,roughness:.86,side:THREE.DoubleSide});
  sun=new THREE.DirectionalLight(0xffefd6,2.5);
  selectedRing:THREE.Mesh; assetsReady=false; assetError=false; recoil=0; time=0; shake=0;
  constructor(public host:HTMLElement) {
    this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});
    this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.shadowMap.enabled=true;this.renderer.shadowMap.type=THREE.PCFSoftShadowMap;
    this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.toneMapping=THREE.ACESFilmicToneMapping;this.renderer.toneMappingExposure=1.05;
    host.append(this.renderer.domElement);this.renderer.domElement.setAttribute('aria-label','3D 螺旋塔防战场，点击方块可锁定目标');
    this.scene.add(new THREE.HemisphereLight(0xfff7dc,0xb7a4ba,1.9));
    const sun=this.sun;sun.position.set(-7,15,-7);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);
    Object.assign(sun.shadow.camera,{left:-14,right:14,top:14,bottom:-14,near:.5,far:40});sun.shadow.bias=-.0005;sun.shadow.normalBias=.04;sun.shadow.radius=4;this.scene.add(sun);
    this.environment();this.road();this.buildTower();this.buildPads();this.scene.add(this.palms,this.scenery);
    this.selectedRing=new THREE.Mesh(new THREE.RingGeometry(.58,.65,40),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.9,side:THREE.DoubleSide}));
    this.selectedRing.rotation.x=-Math.PI/2;this.selectedRing.visible=false;this.scene.add(this.selectedRing);
    this.resize();new ResizeObserver(()=>this.resize()).observe(host);
    this.loadPalms();
  }
  material(color:number) { if(!this.mats.has(color))this.mats.set(color,new THREE.MeshStandardMaterial({color,roughness:.86,metalness:0}));return this.mats.get(color)!; }
  mesh(geometry:THREE.BufferGeometry,color:number,parent:THREE.Object3D=this.scene) {const m=new THREE.Mesh(geometry,this.material(color));m.castShadow=true;m.receiveShadow=true;parent.add(m);return m;}
  box(w:number,h:number,d:number,color:number,parent:THREE.Object3D=this.scene,r=.06) {return this.mesh(new RoundedBoxGeometry(w,h,d,2,r),color,parent);}
  cylinder(rt:number,rb:number,h:number,color:number,parent:THREE.Object3D=this.scene,n=12) {return this.mesh(new THREE.CylinderGeometry(rt,rb,h,n),color,parent);}
  resize() {
    const w=this.host.clientWidth,h=this.host.clientHeight;if(!w||!h)return;
    this.renderer.setSize(w,h);const aspect=w/h;const vh=Math.max(17.1,16.5/aspect);
    this.camera.left=-vh*aspect/2;this.camera.right=vh*aspect/2;this.camera.top=vh/2;this.camera.bottom=-vh/2;
    this.camera.near=.1;this.camera.far=90;this.camera.position.set(0,24,15.6);this.camera.lookAt(0,0,.15);this.camera.updateProjectionMatrix();
  }
  environment() {
    const ground=new THREE.Mesh(new THREE.PlaneGeometry(150,150),this.groundMaterial);ground.rotation.x=-Math.PI/2;ground.position.y=.005;this.scene.add(ground);
    const shadow=new THREE.Mesh(new THREE.PlaneGeometry(150,150),new THREE.ShadowMaterial({color:0x76606b,opacity:.23}));shadow.rotation.x=-Math.PI/2;shadow.position.y=.015;shadow.receiveShadow=true;this.scene.add(shadow);
    const environmentStart=this.scene.children.length;
    // Tiny, sparse freckles give the otherwise clean material a paper-and-sand finish.
    const dots=new THREE.InstancedMesh(new THREE.CircleGeometry(.015,5),new THREE.MeshBasicMaterial({color:0xb6a383,transparent:true,opacity:.19}),1800);
    const dummy=new THREE.Object3D();let seed=19;const rand=()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};
    for(let i=0;i<1800;i++){const angle=rand()*Math.PI*2,r=Math.sqrt(rand())*12;dummy.position.set(Math.cos(angle)*r*1.1,.024,Math.sin(angle)*r);dummy.rotation.x=-Math.PI/2;dummy.scale.setScalar(.5+rand());dummy.updateMatrix();dots.setMatrixAt(i,dummy.matrix);}this.scene.add(dots);
    const shells=[[-7.1,4.8],[-6.5,-4.4],[3.4,-6.7],[7.8,3.2],[-3.1,7.2],[2.6,7.3],[7,-5.7],[-7.7,.3],[-1,-7],[8,-1.4]];
    shells.forEach(([x,z],i)=>{if(i%2===0)this.star(x,z,i%3===0?0xe68879:0x65c8bd,.3+i%3*.06);else{const s=this.mesh(new THREE.IcosahedronGeometry(.23,0),[0xe9bc76,0xf0b3bc,0x9ccdc0][i%3]);s.scale.set(1,.4,.7);s.position.set(x,.12,z);}});
    [[-7.8,6.3],[7.7,-3.5],[6.9,5.7],[-7.9,-3]].forEach(([x,z],i)=>{const rock=this.mesh(new THREE.DodecahedronGeometry(.32+(i%2)*.1,0),0xc0b292);rock.position.set(x,.13,z);rock.scale.y=.7;rock.rotation.y=i;});
    const umbrella=new THREE.Group();umbrella.position.set(8,0,4.5);this.scene.add(umbrella);
    this.cylinder(.035,.035,1.7,0xe5d2ac,umbrella).position.y=.85;
    for(let i=0;i<8;i++){const geo=new THREE.ConeGeometry(.8,.33,8,1,true,i*Math.PI/4,Math.PI/4);const m=this.mesh(geo,i%2?0xfaf2da:0xf08e7c,umbrella);m.position.y=1.65;}
    const towel=this.box(.8,.035,1.65,0xeeb3a0);towel.position.set(8,.04,5.25);towel.rotation.y=.25;
    const board=this.box(.13,1.5,.13,0xb08862);board.position.set(-7.6,.75,-6.5);
    const sign=this.box(1.45,.55,.12,0xfff2d1);sign.position.set(-7.6,1.2,-6.5);sign.rotation.x=-.1;
    const label=this.sprite('IN',INK,120);label.scale.set(.7,.35,1);label.position.set(-7.6,1.24,-6.39);this.scene.add(label);
    const flagPole=this.cylinder(.028,.028,1.7,INK);flagPole.position.set(1.1,.85,2.6);
    const flag=this.mesh(new THREE.PlaneGeometry(.62,.35),0xec8b79);flag.material=new THREE.MeshStandardMaterial({color:0xec8b79,side:THREE.DoubleSide});flag.position.set(1.39,1.49,2.6);
    this.beachObjects=this.scene.children.slice(environmentStart);
    for(const object of this.beachObjects)object.position.z*=1.43;
  }
  star(x:number,z:number,color:number,r:number) {
    const s=new THREE.Shape();for(let i=0;i<10;i++){const a=i*Math.PI/5,rr=i%2?r*.43:r;i?s.lineTo(Math.sin(a)*rr,Math.cos(a)*rr):s.moveTo(0,r);}s.closePath();
    const m=this.mesh(new THREE.ExtrudeGeometry(s,{depth:.045,bevelEnabled:true,bevelThickness:.025,bevelSize:.025,bevelSegments:1,steps:1}),color);m.rotation.x=-Math.PI/2;m.rotation.z=x;m.position.set(x,.045,z);
  }
  async loadPalms() {
    try {
      const gltf=await new GLTFLoader().loadAsync(new URL('assets/environment/tree_palmBend.glb',document.baseURI).href);
      gltf.scene.traverse(o=>{if(o instanceof THREE.Mesh){const materials=Array.isArray(o.material)?o.material:[o.material];for(const mat of materials){if(mat instanceof THREE.MeshStandardMaterial){mat.metalness=0;mat.roughness=1;mat.color.setHex(mat.name==='leafsGreen'?0x39a76f:0xb17948);}}}});
      const bounds=new THREE.Box3().setFromObject(gltf.scene);const size=bounds.getSize(new THREE.Vector3());
      [[-7.5,-5.8,2.7,.4],[-7.6,4.1,2.5,1.7],[7.7,-5.4,2.4,3.7],[7.8,6.4,2.8,4.3]].forEach(([x,z,h,a])=>{
        const palm=gltf.scene.clone(true);palm.scale.setScalar(h/size.y);palm.position.set(x,-bounds.min.y*h/size.y,z*1.43);palm.rotation.y=a;
        palm.traverse(o=>{if(o instanceof THREE.Mesh){o.castShadow=true;o.receiveShadow=true;}});this.palms.add(palm);
      });this.assetsReady=true;
    } catch(error){this.assetError=true;console.error('Palm asset failed to load',error);}
  }
  road() {
    const positions:number[]=[],indices:number[]=[],n=320,half=.7;
    for(let i=0;i<=n;i++){
      const p=path.getPointAt(i/n),t=path.getTangentAt(i/n);const nx=-t.z,nz=t.x;
      positions.push(p.x+nx*half,.066,p.z+nz*half,p.x-nx*half,.066,p.z-nz*half);
      if(i<n){const j=i*2;indices.push(j,j+2,j+1,j+1,j+2,j+3);}
    }
    const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(positions,3));g.setIndex(indices);g.computeVertexNormals();
    const road=new THREE.Mesh(g,this.roadMaterial);road.receiveShadow=true;this.scene.add(road);
    const curbGeo=new RoundedBoxGeometry(.69,.22,.27,2,.055);const curb=new THREE.InstancedMesh(curbGeo,this.material(0xffffff),146);curb.castShadow=true;curb.receiveShadow=true;
    const dummy=new THREE.Object3D();
    for(let i=0;i<73;i++){
      const p=path.getPointAt(i/74),t=path.getTangentAt(i/74);
      for(let j=0;j<2;j++){const side=j?1:-1;dummy.position.set(p.x-t.z*.83*side,.17,p.z+t.x*.83*side);dummy.rotation.set(0,-Math.atan2(t.z,t.x),0);dummy.updateMatrix();curb.setMatrixAt(i*2+j,dummy.matrix);curb.setColorAt(i*2+j,new THREE.Color(i%9===0?0xee786b:i%9===4?0x48bfb3:0xf8edca));}
    }this.scene.add(curb);
    const dashes=new THREE.InstancedMesh(new THREE.PlaneGeometry(.055,.31),new THREE.MeshBasicMaterial({color:0xeee1d3,transparent:true,opacity:.6}),62);
    for(let i=0;i<62;i++){const p=path.getPointAt(i/62),t=path.getTangentAt(i/62);dummy.position.set(p.x,.072,p.z);dummy.rotation.set(-Math.PI/2,0,Math.atan2(t.x,t.z));dummy.updateMatrix();dashes.setMatrixAt(i,dummy.matrix);}this.scene.add(dashes);
  }
  setStage(level:number) {
    if(this.stage===level)return;
    this.stage=level;const t=stageTheme(level),v=t.variant;
    this.groundMaterial.color.set(t.ground);this.roadMaterial.color.setHex(t.road).offsetHSL(v*.012,0,-v*.025);
    this.sun.color.setHex(t.sun);this.sun.position.set(-7+v*5,15,-7+v*2);
    this.beachObjects.forEach(o=>o.visible=t.kind==='beach');this.palms.visible=t.kind==='beach';
    this.palms.rotation.y=v*.025;
    this.scenery.traverse(o=>{if(o instanceof THREE.Mesh)o.geometry.dispose();});this.scenery.clear();
    // Fixed margins keep scenery outside the convoy and turret sites.
    const sites=[[-7.5,-7.5],[7.7,-6.7],[-7.8,1],[7.9,1.5],[-7.4,6.9],[7.6,8.2],[-3.9,9.8],[3.7,-9.4]];
    sites.forEach(([x,z],i)=>{
      const group=new THREE.Group();group.position.set(x+(v-1)*.12*(i%2?1:-1),0,z+(v-1)*.28);group.rotation.y=i*.8+v*.7;
      const scale=.85+((i+v)%3)*.18;group.scale.setScalar(scale);this.scenery.add(group);
      if(t.kind==='forest'||t.kind==='snow'){
        this.cylinder(.13,.19,1,0x977559,group,7).position.y=.5;
        for(let j=0;j<3;j++){
          const tree=this.mesh(new THREE.ConeGeometry(.8-j*.16,1.1,7),t.kind==='snow'?[0x7ca6ac,0xb4cfd0,0xf3f7ee][j]:[0x66977b,0x7daa7e,0x9cbc80][j],group);tree.position.y=1+j*.46;
        }
        if(t.kind==='forest'){
          this.cylinder(.07,.09,.4,0xffead0,group).position.set(.85,.2,.4);
          const mushroom=this.mesh(new THREE.SphereGeometry(.32,10,6,0,Math.PI*2,0,Math.PI/2),i%2?0xe49c91:0xe6c779,group);mushroom.position.set(.85,.42,.4);
        }else{
          const ice=this.mesh(new THREE.ConeGeometry(.32,1.1,5),0x9ccee0,group);ice.position.set(.85,.55,.4);ice.rotation.z=.16;
          const snow=this.mesh(new THREE.DodecahedronGeometry(.55,0),0xf1f7ef,group);snow.position.set(-.5,.2,.2);snow.scale.y=.45;
        }
      }else if(t.kind==='desert'){
        if(i%2===0){
          this.cylinder(.24,.26,1.8,0x6baf91,group,7).position.y=.9;
          for(const side of [-1,1]){
            const arm=this.cylinder(.13,.15,.68,0x6baf91,group,7);arm.rotation.z=Math.PI/2;arm.position.set(side*.37,.85+side*.2,0);
            this.cylinder(.14,.15,.68,0x7dbc93,group,7).position.set(side*.64,1.1+side*.2,0);
          }
          this.mesh(new THREE.IcosahedronGeometry(.18),0xeea0a4,group).position.set(0,1.85,0);
        }else{
          for(let j=0;j<3;j++){const rock=this.cylinder(.6-j*.14,.78-j*.15,.55, [0xcf9374,0xe6b68b,0xf3cf9f][j],group,6);rock.position.y=.27+j*.51;rock.rotation.y=j*.15;}
        }
      }else if(t.kind==='crystal'){
        const base=this.mesh(new THREE.DodecahedronGeometry(.73,0),0x8f83af,group);base.position.y=.18;base.scale.y=.38;
        for(let j=0;j<3;j++){
          const crystal=this.cylinder(0,.27,1.3+j*.28,[0xb085d7,0x8cced7,0xe3b2df][(j+v)%3],group,5);
          crystal.position.set((j-1)*.4,.8+j*.14,j%2*.25);crystal.rotation.z=(j-1)*-.22;
        }
      }else{
        // Additional coral clusters distinguish the three coastal stages.
        for(let j=0;j<v+1;j++){const coral=this.mesh(new THREE.IcosahedronGeometry(.22+j*.08,0),[0xf0b1a7,0x7dccbe,0xe5c581][(i+j)%3],group);coral.position.set(j*.32,.16+j*.09,0);coral.scale.y=1.5;}
      }
    });
    // Broad terrain patches add depth without animated opacity or coplanar surfaces.
    for(let i=0;i<6;i++){
      const patch=this.mesh(new THREE.CircleGeometry(.7+(i%3)*.28,12),t.accent,this.scenery);
      patch.rotation.x=-Math.PI/2;patch.position.set(i%2?-9:9,.029,-8+i*3.1);patch.scale.set(1.3,.7,1);patch.castShadow=false;
    }
  }
  buildTower() {
    this.tower.position.copy(TOWER);this.tower.scale.setScalar(1.3);this.scene.add(this.tower);
    this.cylinder(1.1,1.16,.18,0xd79fb4,this.tower,12).position.y=.16;
    this.cylinder(1.02,1.08,.22,0x42b9ad,this.tower,12).position.y=.29;
    this.cylinder(.72,.94,.62,0xfaf0d7,this.tower).position.y=.7;
    this.cylinder(.74,.77,.09,0x43b7ab,this.tower).position.y=.94;
    this.cylinder(.65,.74,.3,0xfff5dd,this.tower).position.y=1.1;
    this.turret.name='turret';this.turret.position.y=1.24;this.tower.add(this.turret);
    this.cylinder(.63,.65,.18,0xfff5dd,this.turret).position.y=.03;
    this.cylinder(.32,.32,.12,0x48bcb0,this.turret,8).position.y=.16;
    this.cylinder(.115,.115,.13,INK,this.turret,8).position.y=.22;
    const support=this.box(.38,.32,.7,0xfff4d7,this.turret);support.position.set(0,.03,.54);
    const barrel=this.cylinder(.19,.22,.95,0x44b6a9,this.turret,12);barrel.rotation.x=Math.PI/2;barrel.position.set(0,.06,.96);
    const rim=this.cylinder(.235,.235,.14,0xee796d,this.turret,12);rim.rotation.x=Math.PI/2;rim.position.set(0,.06,1.42);
    const hole=this.cylinder(.14,.14,.145,INK,this.turret,12);hole.rotation.x=Math.PI/2;hole.position.set(0,.06,1.435);
    for(let i=0;i<8;i++){const a=i*Math.PI/4;const bolt=this.cylinder(.05,.05,.045,0xfff5dd,this.tower,6);bolt.position.set(Math.sin(a)*.93,.43,Math.cos(a)*.93);}
    this.turret.rotation.y=Math.PI;
    this.towers=[this.tower];this.turrets=[this.turret];this.recoils=[0];
  }
  buildPads() {
    for(const site of TOWER_SITES.slice(1)) {
      const group=new THREE.Group();group.position.set(site.x,.04,site.z);
      const ring=new THREE.Mesh(new THREE.RingGeometry(.52,.61,40),new THREE.MeshBasicMaterial({color:0xc2ab83,transparent:true,opacity:.65,side:THREE.DoubleSide}));ring.rotation.x=-Math.PI/2;group.add(ring);
      const plus=this.sprite('+',0x9b8767,70);plus.position.y=.16;plus.scale.set(.5,.5,1);group.add(plus);
      this.scene.add(group);this.pads.push(group);
    }
  }
  syncTowers(count:number) {
    while(this.towers.length<count){
      const index=this.towers.length,site=TOWER_SITES[index],tower=this.tower.clone(true);
      tower.position.set(site.x,0,site.z);tower.scale.setScalar(.83);
      const turret=tower.getObjectByName('turret') as THREE.Group;
      this.scene.add(tower);this.towers.push(tower);this.turrets.push(turret);this.recoils[index]=this.recoils[index]??0;
    }
    this.pads.forEach((p,i)=>p.visible=i>=count-1);
  }
  sprite(text:string,color=INK,size=96) {
    const key=text+'-'+color;
    if(!this.labels.has(key)) {
      const c=document.createElement('canvas');c.width=128;c.height=128;const ctx=c.getContext('2d')!;
      ctx.font=`900 ${text.length>1?Math.min(64,size):Math.min(96,size)}px Arial, sans-serif`;ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';ctx.lineWidth=4;
      ctx.strokeStyle='#fff5df';ctx.strokeText(text,64,68);ctx.fillStyle='#'+color.toString(16).padStart(6,'0');ctx.fillText(text,64,68);
      const tex=new THREE.CanvasTexture(c);tex.colorSpace=THREE.SRGBColorSpace;this.labels.set(key,tex);
    }
    return new THREE.Sprite(new THREE.SpriteMaterial({map:this.labels.get(key),transparent:true,depthWrite:false,toneMapped:false}));
  }
  paintHp(label:THREE.Sprite,e:Enemy) {
    const texture=label.material.map!,canvas=texture.image as HTMLCanvasElement,ctx=canvas.getContext('2d')!;
    ctx.clearRect(0,0,256,128);ctx.textAlign='center';ctx.textBaseline='middle';ctx.lineJoin='round';
    const text=String(e.hp);let size=e.boss?80:104;ctx.font=`900 ${size}px Arial, sans-serif`;
    while(ctx.measureText(text).width>236){size-=2;ctx.font=`900 ${size}px Arial, sans-serif`;}
    ctx.strokeStyle='#fff5df';ctx.lineWidth=5;ctx.strokeText(text,128,68);ctx.fillStyle=e.boss?'#513645':'#362a40';ctx.fillText(text,128,68);
    texture.needsUpdate=true;
  }
  createEnemy(e:Enemy) {
    const group=new THREE.Group();
    if(e.boss){
      this.box(1.7,.22,1.1,0xe67864,group).position.set(0,.3,0);
      this.box(.78,.85,1.0,0x31b7a8,group).position.set(-.36,.8,0);
      this.box(.9,.14,1.14,0xffe1a0,group).position.set(-.36,1.28,0);
      const boiler=this.cylinder(.35,.35,.8,0x3bb3a4,group);boiler.rotation.z=Math.PI/2;boiler.position.set(.36,.69,0);
      this.cylinder(.17,.13,.44,0xffe4b0,group).position.set(.51,1.13,0);
      this.cylinder(.22,.22,.11,0xe77767,group).position.set(.51,1.38,0);
      this.box(.14,.3,1.15,0xffd16c,group).position.set(.9,.43,0);
      this.box(.37,.28,.03,0x3c4350,group).position.set(-.36,.89,.511);
      this.box(.37,.28,.03,0x3c4350,group).position.set(-.36,.89,-.511);
    }else{
      const body=this.mesh(this.enemyGeometry,COLORS[e.color],group);body.position.y=.73;body.name='body';
      // Inset chassis: no coplanar overlap with the coloured body.
      this.box(.94,.16,.85,0x695b64,group).position.y=.17;
    }
    for(const x of e.boss?[-.57,.57]:[-.32,.32])for(const z of [-.53,.53]){
      const wheel=this.cylinder(.16,.16,.1,0x5b4d56,group,10);wheel.rotation.x=Math.PI/2;wheel.position.set(x,.19,z);
    }
    const canvas=document.createElement('canvas');canvas.width=256;canvas.height=128;
    const texture=new THREE.CanvasTexture(canvas);texture.colorSpace=THREE.SRGBColorSpace;texture.generateMipmaps=false;texture.minFilter=THREE.LinearFilter;
    const label=new THREE.Sprite(new THREE.SpriteMaterial({map:texture,transparent:true,depthWrite:false,depthTest:false,toneMapped:false}));
    label.position.set(0,e.boss?1.92:1.4,0);label.scale.set(e.boss?1.65:1.15,e.boss?.825:.575,1);label.renderOrder=20;label.name='hp';group.add(label);this.paintHp(label,e);
    group.userData.id=e.id;group.userData.hp=e.hp;this.scene.add(group);this.enemies.set(e.id,group);return group;
  }
  removeGroup(g:THREE.Group) {
    g.traverse(o=>{if(o instanceof THREE.Sprite){if(o.name==='hp')o.material.map?.dispose();o.material.dispose();}else if(o instanceof THREE.Mesh && o.geometry!==this.enemyGeometry)o.geometry.dispose();});this.scene.remove(g);
  }
  pick(clientX:number,clientY:number) {
    const rect=this.renderer.domElement.getBoundingClientRect();this.pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);this.raycaster.setFromCamera(this.pointer,this.camera);
    const hit=this.raycaster.intersectObjects([...this.enemies.values()],true)[0];if(!hit)return null;
    let o:THREE.Object3D|null=hit.object;while(o && o.userData.id===undefined)o=o.parent;return o?.userData.id??null;
  }
  event(event:Event) {
    if(event.type==='shot')this.recoils[event.source??0]=.16;
    if(event.type==='leak') {this.shake=.3;this.ring(0xef786c,TOWER);}
    if(event.type==='burst') {this.ring(0x45cfc1,TOWER);this.ring(0xffe09b,TOWER);this.shake=.18;}
    if(event.type==='kill') {
      const p=path.getPointAt(Math.min(1,event.p!));
      const reward=this.sprite('+'+event.amount,INK,64);reward.position.copy(p).y=1.5;reward.scale.set(1,1,1);this.scene.add(reward);this.floating.push({sprite:reward,life:.95});
      for(let i=0;i<12;i++){
        const coin=i<3,m=new THREE.Mesh(coin?this.coinGeometry:this.particleGeometry,this.material(coin?0xffcd58:COLORS[event.color||0]));
        m.position.copy(p).y=.6;m.rotation.set(Math.random(),0,Math.PI/2);this.scene.add(m);
        this.particles.push({mesh:m,velocity:new THREE.Vector3((Math.random()-.5)*3,2+Math.random()*3,(Math.random()-.5)*3),life:.6+Math.random()*.5,max:1.1,coin});
      }
    }
  }
  ring(color:number,p:THREE.Vector3) { const mesh=new THREE.Mesh(new THREE.RingGeometry(.85,1,64),new THREE.MeshBasicMaterial({color,transparent:true,opacity:.75,side:THREE.DoubleSide}));mesh.position.copy(p).y=.2;mesh.rotation.x=-Math.PI/2;this.scene.add(mesh);this.rings.push({mesh,life:.7}); }
  update(game:Game,dt:number) {
    this.time+=dt;this.setStage(game.wave);this.syncTowers(game.towerCount);
    const actual=game.enemies.length?game.enemies:game.mode==='ready'?Array.from({length:7},(_,i)=>({id:-i-1,p:.012+(6-i)*ENEMY_GAP,hp:i===0?160:6,maxHp:i===0?160:6,color:i%5,speed:0,hit:0,boss:i===0})):[];
    const active=new Set(actual.map(e=>e.id));
    for(const [id,g]of this.enemies)if(!active.has(id)){this.removeGroup(g);this.enemies.delete(id);}
    for(const e of actual) {
      const g=this.enemies.get(e.id)||this.createEnemy(e),p=path.getPointAt(Math.min(e.p,1)),t=path.getTangentAt(Math.min(e.p,1));g.position.copy(p);
      g.rotation.y=-Math.atan2(t.z,t.x);
      if(g.userData.hp!==e.hp){const label=g.getObjectByName('hp') as THREE.Sprite;this.paintHp(label,e);g.userData.hp=e.hp;}
    }
    for(let i=0;i<this.turrets.length;i++){
      const turret=this.turrets[i],site=TOWER_SITES[i],target=game.targetForTower(i);
      if(target){const p=path.getPointAt(Math.min(1,target.p));let diff=Math.atan2(p.x-site.x,p.z-site.z)-turret.rotation.y;diff=Math.atan2(Math.sin(diff),Math.cos(diff));turret.rotation.y+=diff*Math.min(1,dt*18);}
      this.recoils[i]=Math.max(0,(this.recoils[i]||0)-dt);turret.position.y=1.24-Math.sin(this.recoils[i]/.16*Math.PI)*.05;
    }
    const selected=game.enemies.find(e=>e.id===game.targetId);this.selectedRing.visible=!!selected;if(selected){this.selectedRing.position.copy(path.getPointAt(Math.min(1,selected.p))).y=.14;this.selectedRing.rotation.z=this.time;}
    const shotIds=new Set(game.shots.map(s=>s.id));for(const[id,m]of this.bullets)if(!shotIds.has(id)){this.scene.remove(m);this.bullets.delete(id);}
    for(const s of game.shots) {
      let m=this.bullets.get(s.id);if(!m){m=new THREE.Mesh(this.bulletGeometry,this.material(0xffe27b));this.bullets.set(s.id,m);this.scene.add(m);}
      const target=game.enemies.find(e=>e.id===s.target);if(!target){m.visible=false;continue;}m.visible=true;
      const end=path.getPointAt(Math.min(1,target.p));end.y=.8;const site=TOWER_SITES[s.source];const begin=new THREE.Vector3(site.x,s.source===0?1.7:1.12,site.z);const d=end.clone().sub(begin).normalize();begin.addScaledVector(d,s.source===0?1.45:.95);
      const alpha=1-s.remaining/s.duration;m.position.lerpVectors(begin,end,alpha);m.position.y+=Math.sin(alpha*Math.PI)*.45;
    }
    for(const p of [...this.particles]){p.life-=dt;p.mesh.position.addScaledVector(p.velocity,dt);p.velocity.y-=9*dt;p.mesh.rotation.y+=dt*8;p.mesh.scale.setScalar(Math.max(0,Math.min(1,p.life*3)));if(p.life<=0){this.scene.remove(p.mesh);this.particles.splice(this.particles.indexOf(p),1);}}
    for(const r of [...this.rings]){r.life-=dt;r.mesh.scale.setScalar(1+(1-r.life/.7)*10);(r.mesh.material as THREE.MeshBasicMaterial).opacity=Math.max(0,r.life);if(r.life<=0){this.scene.remove(r.mesh);r.mesh.geometry.dispose();(r.mesh.material as THREE.Material).dispose();this.rings.splice(this.rings.indexOf(r),1);}}
    for(const f of [...this.floating]){f.life-=dt;f.sprite.position.y+=dt*1.4;f.sprite.material.opacity=Math.min(1,f.life*2);if(f.life<=0){this.scene.remove(f.sprite);f.sprite.material.dispose();this.floating.splice(this.floating.indexOf(f),1);}}
    if(this.shake>0){this.shake=Math.max(0,this.shake-dt);this.camera.position.x=Math.sin(this.time*75)*this.shake*.16;}else this.camera.position.x=0;
    this.renderer.render(this.scene,this.camera);
  }
  reset() {for(const tower of this.towers.slice(1))this.scene.remove(tower);this.towers=[this.tower];this.turrets=[this.turret];this.recoils=[0];this.pads.forEach(p=>p.visible=true);for(const g of this.enemies.values())this.removeGroup(g);this.enemies.clear();for(const m of this.bullets.values())this.scene.remove(m);this.bullets.clear();for(const p of this.particles)this.scene.remove(p.mesh);this.particles=[];for(const f of this.floating){this.scene.remove(f.sprite);f.sprite.material.dispose();}this.floating=[];for(const r of this.rings){this.scene.remove(r.mesh);r.mesh.geometry.dispose();(r.mesh.material as THREE.Material).dispose();}this.rings=[];}
}
