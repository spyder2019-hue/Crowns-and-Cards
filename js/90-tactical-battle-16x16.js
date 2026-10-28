/* Hex tactical battlefield, 16 × 16 cells (pointy-top hexagons, odd-r layout). No CDN or server. */
(function(){
 'use strict';
 const SIZE=16,CW=1200,CH=760;
 // Hex geometry: HS is the circumradius, KY squashes the board vertically for the 2.5D look.
 const HS=37,KY=.6,HW=Math.sqrt(3)*HS,ROW=1.5*HS*KY,DEPTH=9;
 const OX=(CW-HW*(SIZE+.5))/2+HW/2,OY=176;
 const SPRITE_H=100,IMPACT_MS=305;
 const zoomSteps=[0.72,0.85,1,1.18,1.38];let zoomIndex=2;

 const arenaCanvas=document.getElementById('arena');let ctx=arenaCanvas.getContext('2d');
 const scroller=document.getElementById('tactics-board-scroll');
 let hoverTile=null,pickedAlly=null,focusedEnemy=null,cameraReady=false,enemyBusy=false;
 // Visual events never influence the turn rules or the saved game state.
 const motion=new Map(),effects=[],anims=new Map(),ghosts=new Map();
 let frameId=0,lastFrame=0,paintTime=0;
 let fxEnabled=localStorage.getItem('cc-motion')!=='off'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const clamp01=t=>Math.min(1,Math.max(0,t));
 const ease=t=>1-Math.pow(1-clamp01(t),3);
 const easeIO=t=>{t=clamp01(t);return t*t*(3-2*t)};
 const lerp=(a,b,t)=>a+(b-a)*t;
 const hashId=id=>String(id).split('').reduce((s,c)=>s+c.charCodeAt(0),0);

 // ---------- hex math (odd-r offset: odd rows are shifted right by half a hex) ----------
 const NEIGHBORS=[
  [[1,0],[0,-1],[-1,-1],[-1,0],[-1,1],[0,1]],
  [[1,0],[1,-1],[0,-1],[-1,0],[0,1],[1,1]]
 ];
 const toCube=(x,y)=>{const q=x-((y-(y&1))>>1);return {q,r:y,s:-q-y}};
 const hexDist=(a,b)=>{const A=toCube(a.x,a.y),B=toCube(b.x,b.y);return Math.max(Math.abs(A.q-B.q),Math.abs(A.r-B.r),Math.abs(A.s-B.s))};
 const md=hexDist;
 const posKey=(x,y)=>x+','+y;
 const inBounds=(x,y)=>x>=0&&y>=0&&x<SIZE&&y<SIZE;
 function project(x,y){return [OX+HW*(x+((Math.round(y)&1)?.5:0)),OY+ROW*y]}
 function cellAt(px,py){
   const row=Math.round((py-OY)/ROW);let best=null,bd=Infinity;
   for(let r=row-1;r<=row+1;r++){
     const col=Math.round((px-OX)/HW-((r&1)?.5:0));
     for(let c=col-1;c<=col+1;c++){
       const [cx,cy]=project(c,r),dx=px-cx,dy=(py-cy)/KY,d=dx*dx+dy*dy;
       if(d<bd){bd=d;best={x:c,y:r}}
     }
   }
   return best&&inBounds(best.x,best.y)&&bd<=HS*HS*1.02?best:null;
 }
 function hexPath(cx,cy,s=1){
   ctx.beginPath();
   for(let i=0;i<6;i++){const a=Math.PI/180*(60*i-30),px=cx+HS*s*Math.cos(a),py=cy+HS*s*KY*Math.sin(a);i?ctx.lineTo(px,py):ctx.moveTo(px,py)}
   ctx.closePath();
 }
 const hexVert=(cx,cy,i,s=1)=>{const a=Math.PI/180*(60*i-30);return [cx+HS*s*Math.cos(a),cy+HS*s*KY*Math.sin(a)]};

 function aliveVisuals(t){
   if(effects.some(e=>t-e.start<e.duration)||ghosts.size)return true;
   for(const m of motion.values())if(t-m.start<m.duration)return true;
   for(const a of anims.values())for(const k in a)if(t-a[k].start<a[k].dur)return true;
   return false;
 }
 function tick(t){
   frameId=0;if(!battle||document.hidden||document.getElementById('tab-battle').classList.contains('hidden'))return;
   // 30 fps cap for battery life on mobile.
   if(t-lastFrame>32){lastFrame=t;drawBoard(t)}
   if(fxEnabled&&battle.phase!=='done')frameId=requestAnimationFrame(tick);
   else if(aliveVisuals(t))frameId=requestAnimationFrame(tick);
 }
 function frame(){if(!fxEnabled||frameId||!battle||document.hidden)return;frameId=requestAnimationFrame(tick)}
 function faceToward(u,target){
   if(!u||!target||u.x===null||target.x===null)return;
   const dx=project(target.x,target.y)[0]-project(u.x,u.y)[0];
   if(Math.abs(dx)>2)u.face=dx>0?'r':'l';
 }
 function motionEvent(u,oldX,oldY){
   if(!fxEnabled)return;
   const steps=Math.max(1,hexDist({x:oldX,y:oldY},u));
   const dx=project(u.x,u.y)[0]-project(oldX,oldY)[0];if(Math.abs(dx)>2)u.face=dx>0?'r':'l';
   motion.set(u.id,{x:oldX,y:oldY,start:performance.now(),duration:Math.min(900,Math.max(340,steps*185)),hops:steps});frame();
 }
 function playAnim(u,kind,opts={}){
   if(!fxEnabled||!u)return;
   const dur={lunge:520,cast:620,hit:430,spawn:500,heal:760}[kind]||500;
   const set=anims.get(u.id)||{};set[kind]={start:performance.now()+(opts.delay||0),dur,...opts};anims.set(u.id,set);frame();
 }
 const animP=(a,t)=>a?(t-a.start)/a.dur:-1;
 function fx(kind,x,y,extra={}){
   if(!fxEnabled||!battle)return;
   const durations={attack:650,death:1100,heal:860,deploy:540,turn:1000};
   effects.push({kind,x,y,start:performance.now()+(extra.delay||0),duration:durations[kind]||700,...extra});
   if(effects.length>36)effects.splice(0,effects.length-36);
   frame();
 }
 function battleAnimationReset(){motion.clear();effects.length=0;anims.clear();ghosts.clear();layerId='';lastFrame=0;if(frameId)cancelAnimationFrame(frameId);frameId=0}

 const positions={forest:[[13,5],[13,9],[14,12]],ruins:[[13,4],[12,9],[14,12]],dragon:[[12,5],[13,9],[14,12]]};
 const rockSets={
  forest:[[5,3],[6,3],[7,3],[6,6],[7,6],[9,7],[10,7],[8,11],[9,11],[5,12]],
  ruins:[[6,4],[7,4],[8,4],[5,8],[6,8],[9,8],[10,8],[7,12],[8,12],[11,10]],
  dragon:[[7,4],[8,4],[5,7],[6,7],[9,7],[10,7],[7,10],[8,10],[10,12]]
 };
 const rangeOf=u=>CREATURES[u.key].type==='melee'?1:CREATURES[u.key].type==='ranged'?5:3;
 const speedOf=u=>CREATURES[u.key].type==='melee'?4:3;
 const inBattle=()=>!!(battle&&!battle.over);
 const unitHere=(x,y,except)=>!battle?null:[...battle.allies,...battle.enemies].find(u=>u.alive&&u.x===x&&u.y===y&&u.id!==except);
 let rockCache=null,rockPlace='';
 const rocks=()=>{const id=battle?.place.id;if(rockCache&&rockPlace===id)return rockCache;rockPlace=id;return rockCache=new Set((rockSets[id]||rockSets.forest).map(p=>posKey(...p)))};
 const isRock=(x,y)=>rocks().has(posKey(x,y));
 const allLiving=side=>battle[side==='player'?'allies':'enemies'].filter(u=>u.alive);
 const selected=()=>battle?.allies.find(u=>u.id===pickedAlly&&u.alive);
 const allPlaced=()=>battle&&battle.allies.every(u=>u.x!==null&&u.y!==null);
 const activeUnit=()=>battle?[...battle.allies,...battle.enemies].find(u=>u.id===battle.activeId&&u.alive)||null:null;
 const activePlayer=()=>{const u=activeUnit();return u&&u.side==='player'?u:null};
 const activeEnemy=()=>{const u=activeUnit();return u&&u.side==='enemy'?u:null};
 const write=(t)=>{if(!battle)return;battle.log.unshift(t);battle.log=battle.log.slice(0,45)};
 const validFree=(x,y,except)=>inBounds(x,y)&&!isRock(x,y)&&!unitHere(x,y,except);
 function bfs(unit){
   if(unit.x===null)return new Map();
   const map=new Map([[posKey(unit.x,unit.y),0]]);const q=[[unit.x,unit.y]];
   for(let i=0;i<q.length;i++){
     const [x,y]=q[i],d=map.get(posKey(x,y));
     for(const [dx,dy] of NEIGHBORS[y&1]){
       const nx=x+dx,ny=y+dy,k=posKey(nx,ny);
       if(!validFree(nx,ny,unit.id)||map.has(k))continue;
       map.set(k,d+1);q.push([nx,ny]);
     }
   }
   return map;
 }
 function clearShot(from,to){
   // Ranged attacks are blocked by standing stones between the hex centers.
   if(md(from,to)<=1)return true;
   const [x0,y0]=project(from.x,from.y),[x1,y1]=project(to.x,to.y);
   const steps=md(from,to)*4;
   for(let i=1;i<steps;i++){
     const t=i/steps,c=cellAt(lerp(x0,x1,t),lerp(y0,y1,t));
     if(!c||(c.x===from.x&&c.y===from.y)||(c.x===to.x&&c.y===to.y))continue;
     if(isRock(c.x,c.y))return false;
   }
   return true;
 }
 const canHit=(a,b)=>a.x!==null&&b.x!==null&&md(a,b)<=rangeOf(a)&&clearShot(a,b);
 function seeded(x,y,seed=0){let k=(x*73856093)^(y*19349663)^(seed*83492791);k=Math.imul(k^(k>>>13),1274126177);return ((k^(k>>>16))>>>0)/4294967295;}

 // ---------- creature sprites: trimmed + cached, with tinted copies for flashes ----------
 const spriteCache=new Map(),tintCache=new Map();
 // Source art is drawn facing right unless listed here.
 const NATIVE_FACE={ghoststeed:'l'};
 const SPRITE_SCALE={boneconstruct:1.22,lichlord:1.1,necromancer:1.04,ghoststeed:1.15,deathmage:1,skeletal_archer:1,gravedigger:1,boneguard:1,undeadwarrior:1.04};
 function sprite(key){
   let e=spriteCache.get(key);if(e)return e;
   const img=new Image();e={img,canvas:null};spriteCache.set(key,e);
   img.onload=()=>{buildSprite(e);if(battle)drawBoard()};
   img.src=CARD_ART[key];return e;
 }
 function buildSprite(e){
   const img=e.img,w=img.naturalWidth,h=img.naturalHeight;let sx=0,sy=0,sw=w,sh=h;
   try{
     // Find the opaque bounding box on a small probe so the figure stands exactly on the hex.
     const pw=Math.round(w/4),ph=Math.round(h/4),probe=document.createElement('canvas');probe.width=pw;probe.height=ph;
     const pg=probe.getContext('2d');pg.drawImage(img,0,0,pw,ph);const d=pg.getImageData(0,0,pw,ph).data;
     let x0=pw,y0=ph,x1=0,y1=0;
     for(let y=0;y<ph;y++)for(let x=0;x<pw;x++)if(d[(y*pw+x)*4+3]>24){if(x<x0)x0=x;if(x>x1)x1=x;if(y<y0)y0=y;if(y>y1)y1=y}
     if(x1>x0&&y1>y0){sx=Math.max(0,x0*4-4);sy=Math.max(0,y0*4-4);sw=Math.min(w-sx,(x1-x0+1)*4+8);sh=Math.min(h-sy,(y1-y0+1)*4+8)}
   }catch(err){/* file:// canvas is tainted: fall back to the full frame */}
   const ch=Math.round(SPRITE_H*2.7),cw=Math.max(1,Math.round(sw*ch/sh));
   const c=document.createElement('canvas');c.width=cw;c.height=ch;
   const g=c.getContext('2d');g.imageSmoothingQuality='high';g.drawImage(img,sx,sy,sw,sh,0,0,cw,ch);
   e.canvas=c;
 }
 function tinted(key,color){
   const id=key+color;let c=tintCache.get(id);if(c)return c;
   const e=spriteCache.get(key);if(!e||!e.canvas)return null;
   c=document.createElement('canvas');c.width=e.canvas.width;c.height=e.canvas.height;
   const g=c.getContext('2d');g.drawImage(e.canvas,0,0);g.globalCompositeOperation='source-atop';g.fillStyle=color;g.fillRect(0,0,c.width,c.height);
   tintCache.set(id,c);return c;
 }
 function spriteSize(key){
   const e=spriteCache.get(key),sc=SPRITE_SCALE[key]||1;let h=SPRITE_H*sc,w=h*.8;
   if(e&&e.canvas){w=h*e.canvas.width/e.canvas.height;if(w>HW*1.62){w=HW*1.62;h=w*e.canvas.height/e.canvas.width}}
   return {w,h};
 }

 // ---------- scenery + hex floor (baked once per expedition into an offscreen layer) ----------
 const TERRAIN={
  forest:{base:[62,76,66],sideA:'#212822',sideB:'#131914',accent:'rgba(121,166,117,.30)',rune:'rgba(150,214,146,.14)',vein:'rgba(83,98,71,.40)'},
  ruins:{base:[99,91,82],sideA:'#312a23',sideB:'#1a1512',accent:'rgba(178,150,114,.22)',rune:'rgba(245,216,160,.15)',vein:'rgba(91,77,67,.38)'},
  dragon:{base:[66,71,79],sideA:'#1e232c',sideB:'#11151d',accent:'rgba(121,141,172,.24)',rune:'rgba(110,228,255,.14)',vein:'rgba(73,80,94,.42)'}
 };
 const TERRAIN_DEFAULT={base:[72,74,80],sideA:'#22272e',sideB:'#141920',accent:'rgba(170,150,118,.22)',rune:'rgba(210,180,120,.16)',vein:'rgba(81,81,88,.40)'};
 function sceneFor(id){
  return id==='forest'
    ?{skyA:'#29342d',skyMid:'#18221d',skyB:'#090c10',mist:'rgba(127,158,119,.08)',title:'Т Л Е Ю Щ И Й   Л Е С',hazeCore:'rgba(194,224,178,.10)',horizon:'#1a2019',horizonNear:'#232b24',treeGlow:'rgba(127,184,126,.10)',shadow:'rgba(0,0,0,.33)',frontFace:'#2c241d',sideFace:'#241d19'}
    :id==='ruins'
      ?{skyA:'#3a332d',skyMid:'#1f1a18',skyB:'#09090b',mist:'rgba(191,160,114,.08)',title:'Р У И Н Ы   Н Е К Р О П О Л Я',hazeCore:'rgba(251,220,160,.08)',horizon:'#1f1a16',horizonNear:'#2a211b',treeGlow:'rgba(203,163,117,.08)',shadow:'rgba(0,0,0,.34)',frontFace:'#342a21',sideFace:'#2c221c'}
      :{skyA:'#253144',skyMid:'#161a25',skyB:'#07080d',mist:'rgba(118,152,189,.10)',title:'Н Е К Р О П О Л Ь   П Е П Л А',hazeCore:'rgba(196,220,255,.10)',horizon:'#141923',horizonNear:'#1d2230',treeGlow:'rgba(93,171,197,.10)',shadow:'rgba(0,0,0,.35)',frontFace:'#2b2729',sideFace:'#201d21'};
 }
 function drawHexTile(x,y,cx,cy,terrain,placeId){
   const number=seeded(x,y,placeId.length),dust=seeded(x,y,71),crack=seeded(x,y,141);
   const delta=Math.round(number*14)-7;
   const [r,g,b]=terrain.base.map(v=>Math.max(8,Math.min(255,v+delta)));
   // Two visible stone walls on the camera-facing side give the tile thickness.
   for(const [i,col] of [[1,terrain.sideA],[2,terrain.sideB]]){
     const a=hexVert(cx,cy,i,.965),c=hexVert(cx,cy,i+1,.965);
     ctx.beginPath();ctx.moveTo(...a);ctx.lineTo(...c);ctx.lineTo(c[0],c[1]+DEPTH);ctx.lineTo(a[0],a[1]+DEPTH);ctx.closePath();ctx.fillStyle=col;ctx.fill();
   }
   const top=ctx.createLinearGradient(cx,cy-HS*KY,cx,cy+HS*KY);
   top.addColorStop(0,`rgb(${r+17},${g+17},${b+17})`);top.addColorStop(.35,`rgb(${r+7},${g+7},${b+7})`);top.addColorStop(.8,`rgb(${r},${g},${b})`);top.addColorStop(1,`rgb(${Math.max(0,r-18)},${Math.max(0,g-18)},${Math.max(0,b-18)})`);
   hexPath(cx,cy,.965);ctx.fillStyle=top;ctx.fill();
   ctx.lineWidth=1;ctx.strokeStyle='rgba(255,238,204,.10)';ctx.stroke();
   const hl=ctx.createLinearGradient(cx-HW/3,cy-HS*KY,cx+HW/4,cy+HS*KY/2);hl.addColorStop(0,'rgba(255,255,255,.10)');hl.addColorStop(1,'rgba(255,255,255,0)');
   hexPath(cx,cy,.9);ctx.fillStyle=hl;ctx.fill();
   ctx.strokeStyle=terrain.vein;ctx.lineWidth=1;
   ctx.beginPath();ctx.moveTo(cx-18,cy+4);ctx.lineTo(cx-8,cy-1);ctx.lineTo(cx+1,cy+2);ctx.lineTo(cx+13,cy-4);ctx.stroke();
   if(crack>.45){ctx.beginPath();ctx.moveTo(cx-7,cy+9);ctx.lineTo(cx+1,cy+3);ctx.lineTo(cx+9,cy+8);ctx.stroke()}
   if(dust>.52){ctx.strokeStyle=terrain.accent;ctx.lineWidth=.9;ctx.beginPath();ctx.moveTo(cx-11,cy+6);ctx.lineTo(cx-1,cy+1);ctx.lineTo(cx+10,cy+5);ctx.stroke()}
   if(dust>.72){ctx.fillStyle=terrain.rune;ctx.beginPath();ctx.arc(cx+10,cy-1,2.6,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(cx-6,cy+5,2.1,0,Math.PI*2);ctx.fill()}
 }
 function rock(sx,sy,x,y){
   ctx.save();ctx.translate(sx,sy-6);const height=18+seeded(x,y,12)*12;
   ctx.beginPath();ctx.moveTo(-17,9);ctx.lineTo(-14,-height+9);ctx.lineTo(-3,-height-7);ctx.lineTo(13,-height+7);ctx.lineTo(17,8);ctx.lineTo(0,17);ctx.closePath();
   const shade=ctx.createLinearGradient(-17,-height,14,10);shade.addColorStop(0,'#747681');shade.addColorStop(.4,'#414750');shade.addColorStop(1,'#151c26');ctx.fillStyle=shade;ctx.shadowBlur=11;ctx.shadowColor='#060a0ecb';ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#98897588';ctx.lineWidth=1;ctx.stroke();
   ctx.beginPath();ctx.moveTo(-13,-height+10);ctx.lineTo(-2,-height-4);ctx.lineTo(4,4);ctx.strokeStyle='#bbc0bd66';ctx.stroke();
   ctx.restore();
 }
 function drawBoardBase(scene){
   const x0=OX-HW*.78,x1=OX+HW*(SIZE-.1)+HW*.28,y0=OY-HS*KY*1.35,y1=OY+(SIZE-1)*ROW+HS*KY*1.3;
   ctx.save();ctx.shadowBlur=26;ctx.shadowColor=scene.shadow;
   ctx.beginPath();ctx.roundRect(x0,y0+14,x1-x0,y1-y0+16,14);ctx.fillStyle=scene.frontFace;ctx.fill();ctx.shadowBlur=0;
   ctx.beginPath();ctx.roundRect(x0,y0,x1-x0,y1-y0,14);ctx.fillStyle='rgba(30,27,25,.94)';ctx.fill();
   ctx.strokeStyle='rgba(232,209,162,.20)';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
 }

 function drawTree(x,y,s=1,glow='rgba(96,200,170,.06)'){
   ctx.save();ctx.translate(x,y);ctx.scale(s,s);
   ctx.strokeStyle='rgba(18,13,11,.92)';ctx.lineWidth=6;ctx.lineCap='round';
   ctx.beginPath();ctx.moveTo(0,50);ctx.lineTo(0,5);ctx.moveTo(0,22);ctx.lineTo(-15,-6);ctx.moveTo(0,14);ctx.lineTo(16,-10);ctx.moveTo(-2,28);ctx.lineTo(-22,14);ctx.moveTo(3,32);ctx.lineTo(24,18);ctx.stroke();
   ctx.shadowColor=glow;ctx.shadowBlur=12;ctx.strokeStyle='rgba(66,86,100,.24)';ctx.lineWidth=2;
   ctx.beginPath();ctx.moveTo(0,4);ctx.lineTo(-15,-6);ctx.moveTo(0,12);ctx.lineTo(16,-10);ctx.stroke();
   ctx.restore();
 }
 function drawPillar(x,y,s=1,fire=false){
   ctx.save();ctx.translate(x,y);ctx.scale(s,s);
   const stone=ctx.createLinearGradient(-20,-70,18,22);stone.addColorStop(0,'#807866');stone.addColorStop(.5,'#473f36');stone.addColorStop(1,'#1a1715');
   ctx.fillStyle=stone;ctx.beginPath();ctx.moveTo(-18,16);ctx.lineTo(-10,-60);ctx.lineTo(2,-70);ctx.lineTo(16,-55);ctx.lineTo(20,18);ctx.lineTo(0,25);ctx.closePath();ctx.fill();
   ctx.strokeStyle='rgba(217,198,160,.25)';ctx.lineWidth=1;ctx.stroke();
   ctx.fillStyle='#16110f';ctx.fillRect(-23,18,46,10);
   if(fire){
     ctx.shadowColor='#ff9d58';ctx.shadowBlur=18;
     const flame=ctx.createRadialGradient(0,-78,1,0,-78,18);flame.addColorStop(0,'rgba(255,239,182,.95)');flame.addColorStop(.55,'rgba(255,142,78,.80)');flame.addColorStop(1,'rgba(255,142,78,0)');
     ctx.fillStyle=flame;ctx.beginPath();ctx.moveTo(0,-98);ctx.quadraticCurveTo(18,-82,0,-66);ctx.quadraticCurveTo(-17,-82,0,-98);ctx.fill();ctx.shadowBlur=0;
   }
   ctx.restore();
 }
 function drawSceneBackdrop(scene,t){
   const bg=ctx.createLinearGradient(0,0,0,CH);
   bg.addColorStop(0,scene.skyA);bg.addColorStop(.44,scene.skyMid);bg.addColorStop(1,scene.skyB);ctx.fillStyle=bg;ctx.fillRect(0,0,CW,CH);
   const haze=ctx.createRadialGradient(CW*.52,92,40,CW*.52,92,300);haze.addColorStop(0,scene.hazeCore);haze.addColorStop(1,'rgba(0,0,0,0)');ctx.fillStyle=haze;ctx.fillRect(0,0,CW,300);
   ctx.fillStyle=scene.mist;for(let i=0;i<7;i++){ctx.beginPath();ctx.ellipse(105+i*165,145+i*12,150,36,0,0,Math.PI*2);ctx.fill()}
   ctx.fillStyle=scene.horizon;ctx.beginPath();ctx.moveTo(0,226);ctx.bezierCurveTo(120,172,250,208,340,174);ctx.bezierCurveTo(470,126,575,198,690,164);ctx.bezierCurveTo(805,130,930,188,1015,160);ctx.bezierCurveTo(1110,129,1165,150,1200,138);ctx.lineTo(1200,280);ctx.lineTo(0,280);ctx.closePath();ctx.fill();
   ctx.fillStyle=scene.horizonNear;ctx.beginPath();ctx.moveTo(0,270);ctx.bezierCurveTo(120,244,220,282,360,238);ctx.bezierCurveTo(510,196,650,286,800,232);ctx.bezierCurveTo(938,182,1056,250,1200,220);ctx.lineTo(1200,346);ctx.lineTo(0,346);ctx.closePath();ctx.fill();
   drawTree(112,258,1.15,scene.treeGlow);drawTree(180,286,.92,scene.treeGlow);drawTree(1075,250,1.12,scene.treeGlow);drawTree(1002,292,.96,scene.treeGlow);
   drawPillar(132,245,1.04,true);drawPillar(1068,238,1.08,true);
 }
 function drawForeground(scene,t){
   // Decorations and haze stay in camera space, and never cover interactive tiles.
   const floor=ctx.createLinearGradient(0,CH-68,0,CH);floor.addColorStop(0,'rgba(9,12,15,0)');floor.addColorStop(1,'rgba(7,9,13,.78)');
   ctx.fillStyle=floor;ctx.fillRect(0,CH-68,CW,68);
   ctx.save();ctx.strokeStyle='rgba(216,194,140,.12)';ctx.lineWidth=1;
   ctx.beginPath();ctx.moveTo(66,CH-28);ctx.lineTo(184,CH-28);ctx.moveTo(CW-184,CH-28);ctx.lineTo(CW-66,CH-28);ctx.stroke();ctx.restore();
 }

 let layer=null,layerId='';
 function buildLayer(){
   const id=battle.place.id;
   if(layer&&layerId===id)return layer;
   layer=document.createElement('canvas');layer.width=CW;layer.height=CH;
   const old=ctx;ctx=layer.getContext('2d');
   try{
     const scene=sceneFor(id),terrain=TERRAIN[id]||TERRAIN_DEFAULT;
     drawSceneBackdrop(scene,0);drawBoardBase(scene);
     ctx.textAlign='center';ctx.fillStyle='#d9bb8766';ctx.font='12px Georgia';ctx.fillText('⚜  '+scene.title+'  ·  Г Е К С - П О Л Е   1 6 × 1 6  ⚜',CW/2,44);
     for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){const [cx,cy]=project(x,y);drawHexTile(x,y,cx,cy,terrain,id)}
   }finally{ctx=old}
   layerId=id;return layer;
 }
 function drawFlicker(t){
   const flicker=fxEnabled?(Math.sin(t/400)+1)*.5:0;
   ctx.fillStyle=`rgba(255,170,92,${.05+flicker*.05})`;
   ctx.beginPath();ctx.ellipse(132,247,52,18,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(1068,240,58,20,0,0,Math.PI*2);ctx.fill();
 }

 // ---------- effects ----------
 function drawEffects(t){
   ctx.save();
   for(const e of effects){
     const k=(t-e.start)/e.duration;
     if(k<0||k>=1)continue;
     const [tx,ty]=project(e.x,e.y);
     if(e.kind==='attack'){
       const [sx,sy]=project(e.fromX,e.fromY),kind=e.atkKind||'melee',x0=sx,y0=sy-52,x1=tx,y1=ty-46,hitAt=.47;
       const col=kind==='magic'?['#d38aff','#a24cff','210,120,255']:kind==='ranged'?['#ffe6aa','#ffba58','255,200,120']:['#fff1c8','#ff9a58','255,170,100'];
       if(kind==='magic'&&k<.3){ // casting glow in the caster's hands
         const g=ctx.createRadialGradient(x0,y0,1,x0,y0,26);g.addColorStop(0,'rgba(236,190,255,.95)');g.addColorStop(1,'rgba(160,70,255,0)');
         ctx.globalAlpha=Math.sin(k/.3*Math.PI);ctx.fillStyle=g;ctx.beginPath();ctx.arc(x0,y0,26,0,6.283);ctx.fill();ctx.globalAlpha=1;
       }
       if(kind!=='melee'&&k<hitAt){
         const pos=q=>[lerp(x0,x1,q),lerp(y0,y1,q)-(kind==='ranged'?24:12)*Math.sin(q*Math.PI)];
         const p=ease(k/hitAt),[x,y]=pos(p),[bx,by]=pos(Math.max(0,p-.04));
         ctx.shadowColor=col[1];ctx.shadowBlur=18;
         if(kind==='ranged'){ // arrow with a head, pointing along the flight path
           const a=Math.atan2(y-by,x-bx);ctx.save();ctx.translate(x,y);ctx.rotate(a);
           ctx.strokeStyle='#e9d9b0';ctx.lineWidth=2.4;ctx.beginPath();ctx.moveTo(-24,0);ctx.lineTo(0,0);ctx.stroke();
           ctx.fillStyle='#fff3cf';ctx.beginPath();ctx.moveTo(6,0);ctx.lineTo(-3,-4);ctx.lineTo(-3,4);ctx.closePath();ctx.fill();
           ctx.strokeStyle='#b98a52';ctx.lineWidth=1.6;ctx.beginPath();ctx.moveTo(-24,0);ctx.lineTo(-29,-4);ctx.moveTo(-24,0);ctx.lineTo(-29,4);ctx.stroke();ctx.restore();
         } else {
           for(let i=1;i<=5;i++){const [px,py]=pos(Math.max(0,p-i*.03));ctx.globalAlpha=.5-i*.08;ctx.fillStyle=col[0];ctx.beginPath();ctx.arc(px,py,9-i,0,6.283);ctx.fill()}
           ctx.globalAlpha=1;ctx.fillStyle=col[0];ctx.beginPath();ctx.arc(x,y,9,0,6.283);ctx.fill();
         }
         ctx.shadowBlur=0;
       } else if(k>=hitAt){
         const q=(k-hitAt)/(1-hitAt),alpha=1-q;
         if(kind==='melee'){ // crescent slash across the target
           ctx.save();ctx.translate(x1,y1);ctx.rotate(-.6+q*.5);ctx.globalAlpha=alpha;
           ctx.strokeStyle=col[0];ctx.shadowColor=col[1];ctx.shadowBlur=16;ctx.lineWidth=6*(1-q)+1;ctx.lineCap='round';
           ctx.beginPath();ctx.arc(0,0,28+q*8,Math.PI*1.1,Math.PI*1.85);ctx.stroke();ctx.restore();
         }
         ctx.strokeStyle=`rgba(${col[2]},${alpha})`;ctx.lineWidth=4*(1-q)+.4;ctx.shadowColor=col[1];ctx.shadowBlur=16;
         ctx.beginPath();ctx.ellipse(tx,ty-34,12+q*40,(12+q*40)*.7,0,0,6.283);ctx.stroke();
         for(let i=0;i<7;i++){const a=i*6.283/7+k*2,r=12+q*46;ctx.fillStyle=i%2?'#ffe2af':col[1];ctx.beginPath();ctx.arc(tx+Math.cos(a)*r,ty-40+Math.sin(a)*r*.6,2.6*(1-q),0,6.283);ctx.fill()}
         ctx.shadowBlur=0;
       }
       if(k>.46){ctx.globalAlpha=Math.max(0,1-(k-.46)/.54);ctx.textAlign='center';ctx.font='bold 23px Georgia';ctx.shadowColor='#000';ctx.shadowBlur=5;ctx.fillStyle='#ffbe90';ctx.fillText('−'+e.power,tx,ty-SPRITE_H-6-(k-.46)*46);ctx.shadowBlur=0;ctx.globalAlpha=1}
     } else if(e.kind==='heal'){
       ctx.strokeStyle=`rgba(97,238,183,${1-k})`;ctx.lineWidth=4*(1-k)+1;
       for(let q=0;q<3;q++){ctx.beginPath();ctx.ellipse(tx,ty-10-(k*34),19+k*18+q*7,(12+k*17+q*6)*.7,0,0,6.283);ctx.stroke()}
       ctx.font='bold 21px Georgia';ctx.textAlign='center';ctx.fillStyle=`rgba(150,255,191,${1-k})`;ctx.fillText('+'+e.healing,tx,ty-SPRITE_H-4-k*42);
     } else if(e.kind==='death'){
       // Bone fragments fly apart under gravity, a violet soul wisp rises.
       for(let i=0;i<9;i++){
         const a=seeded(i,3,e.x*7+e.y)*6.283,sp=24+seeded(i,5,e.y)*38,px=tx+Math.cos(a)*sp*k,py=ty-38-Math.sin(a)*sp*.5*k+k*k*58;
         ctx.save();ctx.translate(px,py);ctx.rotate(a+k*7);ctx.globalAlpha=1-k;ctx.fillStyle=i%3?'#e6d7b5':'#cdbb92';ctx.beginPath();ctx.roundRect(-4,-1.8,8,3.6,1.8);ctx.fill();ctx.restore();
       }
       ctx.globalAlpha=Math.sin(k*Math.PI)*.85;const wy=ty-48-k*52,g=ctx.createRadialGradient(tx,wy,1,tx,wy,20);g.addColorStop(0,'rgba(220,190,255,.95)');g.addColorStop(1,'rgba(150,90,255,0)');
       ctx.fillStyle=g;ctx.beginPath();ctx.ellipse(tx+Math.sin(k*9)*5,wy,13,20,0,0,6.283);ctx.fill();ctx.globalAlpha=1;
     } else if(e.kind==='deploy'){
       ctx.strokeStyle=`rgba(107,248,182,${1-k})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(tx,ty,9+k*26,(9+k*26)*KY,0,0,6.283);ctx.stroke();
     } else if(e.kind==='turn'){
       ctx.globalAlpha=Math.min(.85,(1-k)*2);ctx.textAlign='center';ctx.fillStyle='#f2d49d';ctx.shadowColor='#a97832';ctx.shadowBlur=25;ctx.font='bold 35px Georgia';ctx.fillText(e.label,CW/2,CH/2-30-k*25);ctx.shadowBlur=0;ctx.globalAlpha=1;
     }
   }
   ctx.restore();
   for(let i=effects.length-1;i>=0;i--)if(t-effects[i].start>=effects[i].duration)effects.splice(i,1);
   for(const [id,m] of motion)if(t-m.start>=m.duration)motion.delete(id);
   for(const [id,set] of anims){for(const kind in set)if(t-set[kind].start>=set[kind].dur)delete set[kind];if(!Object.keys(set).length)anims.delete(id)}
   for(const [id,gh] of ghosts)if(t-gh.start>=gh.dur)ghosts.delete(id);
 }

 // ---------- creature figure ----------
 function unitPixel(u,t=paintTime){
   const m=motion.get(u.id),[nx,ny]=project(u.x,u.y);
   if(m&&fxEnabled){const k=easeIO((t-m.start)/m.duration),[ox,oy]=project(m.x,m.y);return [lerp(ox,nx,k),lerp(oy,ny,k)]}
   return [nx,ny];
 }
 function drawUnit(u,sx,sy,t,deathP=null){
   const key=u.key,e=sprite(key),an=anims.get(u.id)||{},ghost=deathP!==null;
   const phase=hashId(u.id)*.9,isTurn=!ghost&&battle?.activeId===u.id;
   const focus=!ghost&&(isTurn||pickedAlly===u.id||focusedEnemy===u.id);
   let ox=0,oy=0,sxk=1,syk=1,rot=0,alpha=1,tintA=0,tintC='#ffffff',glow=null;
   if(fxEnabled){
     const br=Math.sin(t/430+phase);syk+=br*.022*(isTurn?1.5:1);sxk-=br*.012;
     const m=motion.get(u.id);
     if(m){const p=clamp01((t-m.start)/m.duration);oy-=Math.abs(Math.sin(p*Math.PI*m.hops))*8;rot+=Math.sin(p*Math.PI*m.hops*2)*.05}
     let p=animP(an.lunge,t);
     if(p>=0&&p<1){const k=p<.55?ease(p/.55):1-easeIO((p-.55)/.45);ox+=an.lunge.dx*k;oy+=an.lunge.dy*k;sxk+=.07*k;syk-=.05*k}
     p=animP(an.cast,t);
     if(p>=0&&p<1){const s=Math.sin(p*Math.PI);oy-=s*6;syk+=s*.07;sxk-=s*.03;ox+=(an.cast.dx||0)*(p<.5?-s:s*.9);if(an.cast.glow)glow=an.cast.glow}
     p=animP(an.hit,t);
     if(p>=0&&p<1){ox+=Math.sin(p*38)*4*(1-p)+(an.hit.dx||0)*(1-p)*8;tintA=Math.pow(1-p,1.25)*.85;tintC=p<.22?'#ffffff':'#ff5a4a';syk-=.05*(1-p)}
     p=animP(an.heal,t);
     if(p>=0&&p<1){tintA=Math.max(tintA,Math.sin(p*Math.PI)*.55);tintC='#4cff9a';oy-=Math.sin(p*Math.PI)*5}
     p=animP(an.spawn,t);
     if(p>=0&&p<1){oy-=(1-ease(p))*36;alpha*=clamp01(p*3);syk*=.7+.3*ease(p)}
     else if(p<0&&an.spawn)alpha=0;
     if(ghost&&deathP>0){const d=clamp01(deathP);alpha*=1-Math.pow(d,1.4);syk*=1-.5*d;sxk*=1+.12*d;tintA=Math.max(tintA,d*.65);tintC='#b9a5ff'}
   }
   if(!ghost&&battle&&battle.phase==='fight'&&u.turnDone)alpha*=.78;
   ctx.save();ctx.translate(sx,sy);
   // ground shadow + team ring (they stay on the hex while the body hops)
   const lift=clamp01(-oy/40);
   ctx.globalAlpha=alpha;
   ctx.beginPath();ctx.ellipse(ox*.6,2,25-lift*6,9-lift*2,0,0,6.283);ctx.fillStyle='rgba(2,5,8,.55)';ctx.fill();
   const ally=u.side==='player';
   ctx.beginPath();ctx.ellipse(0,0,HS*.7,HS*.7*KY,0,0,6.283);ctx.strokeStyle=ally?'rgba(104,230,200,.8)':'rgba(240,110,98,.8)';ctx.lineWidth=2;
   ctx.shadowColor=ally?'#44dcbd':'#e9655d';ctx.shadowBlur=focus?18:7;ctx.stroke();ctx.shadowBlur=0;
   if(isTurn){const pulse=fxEnabled?(Math.sin(t/260)+1)*.5:.5;ctx.beginPath();ctx.ellipse(0,0,HS*.82+pulse*3,(HS*.82+pulse*3)*KY,0,0,6.283);ctx.strokeStyle=`rgba(255,226,157,${.65+pulse*.3})`;ctx.lineWidth=2.4;ctx.stroke()}
   const {w,h}=spriteSize(key);
   if(e.canvas){
     const flipSign=(NATIVE_FACE[key]||'r')!==(u.face||(ally?'r':'l'))?-1:1;
     ctx.save();ctx.translate(ox,oy+4);ctx.rotate(rot);ctx.scale(flipSign*sxk,syk);
     ctx.drawImage(e.canvas,-w/2,-h,w,h);
     if(tintA>.01){const tc=tinted(key,tintC);if(tc){ctx.globalAlpha=alpha*tintA;ctx.drawImage(tc,-w/2,-h,w,h)}}
     ctx.restore();
   } else {ctx.globalAlpha=alpha;ctx.textAlign='center';ctx.font='38px Georgia';ctx.fillStyle='#c6a16a';ctx.fillText('☠',0,-24)}
   if(glow){ctx.globalAlpha=1;const g=ctx.createRadialGradient(ox,oy-h*.55,2,ox,oy-h*.55,30);g.addColorStop(0,glow);g.addColorStop(1,'rgba(160,80,255,0)');ctx.fillStyle=g;ctx.beginPath();ctx.arc(ox,oy-h*.55,30,0,6.283);ctx.fill()}
   ctx.globalAlpha=1;
   if(!ghost&&u.alive){
     // health bar + HP badge (stack-style, like the originals)
     const by=oy*.4-h-8,bw=44;
     ctx.fillStyle='#0e151ce6';ctx.fillRect(-bw/2-2,by-2,bw+4,9);
     ctx.fillStyle=ally?'#5fd4ac':'#e58274';ctx.fillRect(-bw/2,by,bw*Math.max(0,u.hp/u.maxHp),5);
     ctx.strokeStyle='#c1a47a';ctx.lineWidth=.8;ctx.strokeRect(-bw/2,by,bw,5);
     ctx.beginPath();ctx.arc(HS*.62,-1,10,0,6.283);ctx.fillStyle=ally?'#164a40':'#5a2420';ctx.fill();ctx.strokeStyle=ally?'#78e8cd':'#f08a7e';ctx.lineWidth=1.4;ctx.stroke();
     ctx.fillStyle='#fff4da';ctx.font='bold 11px Georgia';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(Math.max(0,u.hp),HS*.62,-.5);ctx.textBaseline='alphabetic';
     if(ally&&u.level>1){ctx.fillStyle='#ffe2ad';ctx.font='bold 9px Georgia';ctx.fillText('Ур.'+u.level,-HS*.62,3)}
     if(focus){
       ctx.font='bold 11px Georgia';ctx.shadowColor='#000';ctx.shadowBlur=5;ctx.fillStyle='#ffe2ad';ctx.fillText(CREATURES[key].name.slice(0,20),0,HS*KY+13);ctx.shadowBlur=0;
     }
   }
   ctx.restore();
 }

 // ---------- the board ----------
 function drawBoard(t=performance.now()){
  if(!battle)return;
  paintTime=t;
  ctx.clearRect(0,0,CW,CH);
  ctx.save();
  const impact=effects.findLast(e=>e.kind==='attack'&&t-e.start>=0&&t-e.start<e.duration&&(t-e.start)/e.duration>.45);
  if(fxEnabled&&impact){const d=(t-impact.start)/impact.duration;ctx.translate(Math.sin(t*.31)*2.5*(1-d),Math.cos(t*.27)*2.2*(1-d))}
  ctx.drawImage(buildLayer(),0,0);
  drawFlicker(t);
  const ally=activePlayer();
  const moveMap=battle.phase==='fight'&&battle.turn==='player'&&ally&&!ally.moved?bfs(ally):null;
  const pulse=fxEnabled?(Math.sin(t/340)+1)*.5:.5;
  const targets=ally&&battle.phase==='fight'&&battle.turn==='player'&&!ally.acted?allLiving('enemy').filter(e=>canHit(ally,e)):[];
  // floor highlights
  for(let y=0;y<SIZE;y++)for(let x=0;x<SIZE;x++){
    if(isRock(x,y))continue;
    const [cx,cy]=project(x,y),free=!unitHere(x,y);
    if(battle.phase==='deploy'){
      if(x<=3&&free){hexPath(cx,cy,.9);ctx.fillStyle=`rgba(80,225,170,${.2+pulse*.07})`;ctx.fill();ctx.strokeStyle='rgba(150,255,215,.5)';ctx.lineWidth=1.4;ctx.stroke()}
      else if(x>=12){hexPath(cx,cy,.9);ctx.fillStyle='rgba(230,90,80,.10)';ctx.fill()}
    } else if(moveMap&&free){
      const d=moveMap.get(posKey(x,y));
      if(d>0&&d<=speedOf(ally)){hexPath(cx,cy,.9);ctx.fillStyle=`rgba(90,190,255,${.22+pulse*.06})`;ctx.fill();ctx.strokeStyle='rgba(175,232,255,.75)';ctx.lineWidth=1.5;ctx.stroke()}
    }
  }
  for(const e of targets){const [cx,cy]=project(e.x,e.y);hexPath(cx,cy,.95);ctx.fillStyle=`rgba(240,80,70,${.2+pulse*.12})`;ctx.fill();ctx.strokeStyle='rgba(255,150,135,.95)';ctx.lineWidth=2.2;ctx.stroke()}
  const cur=activeUnit()||selected();
  if(cur&&cur.x!==null){const [cx,cy]=project(cur.x,cur.y);hexPath(cx,cy,.96);ctx.strokeStyle=`rgba(255,226,157,${.7+pulse*.3})`;ctx.lineWidth=2.2;ctx.stroke()}
  if(hoverTile){const [cx,cy]=project(hoverTile.x,hoverTile.y);hexPath(cx,cy,.96);ctx.fillStyle='rgba(255,231,157,.14)';ctx.fill();ctx.strokeStyle='#f9d18f';ctx.lineWidth=1.8;ctx.stroke()}
  // depth-sorted scene objects: rocks, creatures and fading corpses
  const objects=[];
  for(const key of rocks()){const [x,y]=key.split(',').map(Number),[sx,sy]=project(x,y);objects.push({sy,draw:()=>rock(sx,sy,x,y)})}
  for(const u of [...battle.allies,...battle.enemies])if(u.alive&&u.x!==null){const [sx,sy]=unitPixel(u,t);objects.push({sy,draw:()=>drawUnit(u,sx,sy,t)})}
  for(const gh of ghosts.values()){const [sx,sy]=project(gh.u.x,gh.u.y);objects.push({sy,draw:()=>drawUnit(gh.u,sx,sy,t,(t-gh.start)/gh.dur)})}
  objects.sort((a,b)=>a.sy-b.sy);for(const o of objects)o.draw();
  if(fxEnabled){
    const shimmer=(Math.sin(t/700)+1)*.5;
    ctx.fillStyle=`rgba(115,84,154,${.05+shimmer*.06})`;ctx.fillRect(36,56,CW-72,3);
    for(let i=0;i<16;i++){
      const px=(seeded(i,7)*CW+Math.sin(t/2100+i)*18),py=(seeded(i,2)*210+Math.cos(t/1950+i)*10);
      ctx.fillStyle=i%2?'#f9d49a44':'#9badcf2e';ctx.beginPath();ctx.arc(px,py,1+seeded(i,3)*1.2,0,Math.PI*2);ctx.fill();
    }
  }
  drawEffects(t);
  drawForeground(sceneFor(battle.place.id),t);
  ctx.strokeStyle='rgba(205,170,121,.22)';ctx.lineWidth=2;ctx.strokeRect(20,20,CW-40,CH-40);
  ctx.restore();
 }

 function canvasBase(){
   const avail=scroller?scroller.clientWidth:1140;
   return avail>=1160?1140:avail<760?820:Math.max(740,avail-6);
 }
 function layoutBoard(){
  arenaCanvas.style.width=Math.round(canvasBase()*zoomSteps[zoomIndex])+'px';
  arenaCanvas.style.height='auto';
 }
 function centerBoard(){
  if(!scroller||cameraReady)return;
  const visible=scroller.clientWidth;
  if(visible){
    const w=arenaCanvas.getBoundingClientRect().width;
    // While deploying, show the player's side; afterwards the middle of the field.
    scroller.scrollLeft=battle&&battle.phase==='deploy'?0:Math.max(0,(w-visible)/2);cameraReady=true;
  }
 }
 function scrollToUnit(u){
  if(!scroller||!u||u.x===null)return;
  const rect=arenaCanvas.getBoundingClientRect(),k=rect.width/CW,[px,py]=project(u.x,u.y);
  const left=px*k-scroller.clientWidth/2,top=(py-60)*k-scroller.clientHeight/2;
  if(scroller.scrollWidth>scroller.clientWidth+4||scroller.scrollHeight>scroller.clientHeight+4)
    scroller.scrollTo({left:Math.max(0,left),top:Math.max(0,top),behavior:fxEnabled?'smooth':'auto'});
 }
 function tileFromEvent(e){
   const rect=arenaCanvas.getBoundingClientRect();
   const px=(e.clientX-rect.left)*CW/rect.width,py=(e.clientY-rect.top)*CH/rect.height;
   // A tall figure also covers the hex behind it, so tapping the body picks that creature first.
   if(battle){
     const here=[...battle.allies,...battle.enemies].filter(u=>u.alive&&u.x!==null).map(u=>({u,p:project(u.x,u.y),h:spriteSize(u.key).h}))
       .sort((a,b)=>b.p[1]-a.p[1]);
     for(const {u,p,h} of here)if(Math.abs(px-p[0])<=HW*.42&&py<=p[1]+8&&py>=p[1]-h*.85)return {x:u.x,y:u.y};
   }
   return cellAt(px,py);
 }
 function spawnFallback(){
  const coords=[[2,6],[2,8],[3,10],[1,11]];
  battle.allies.forEach((u,i)=>{if(u.x!==null)return;let [x,y]=coords[i]||[2,4+i];if(!validFree(x,y,u.id)){
    outer:for(let yy=2;yy<14;yy++)for(let xx=0;xx<=3;xx++)if(validFree(xx,yy,u.id)){x=xx;y=yy;break outer}
   }u.x=x;u.y=y;playAnim(u,'spawn',{delay:i*120});
  });
  if(!selected())pickedAlly=battle.allies[0]?.id||null;
  renderBattle();
 }
 function doPlace(x,y){
   const u=selected();if(!u){write('Выбери бойца из панели отряда.');return}
   if(x>3){write('Расстановка разрешена только в зелёной зоне слева.');return}
   if(!validFree(x,y,u.id)){write('Эта клетка занята или недоступна.');return}
   u.x=x;u.y=y;playAnim(u,'spawn');fx('deploy',x,y);write(CREATURES[u.key].name+' размещён на клетке '+(x+1)+' : '+(y+1)+'.');
   const next=battle.allies.find(a=>a.x===null);pickedAlly=next?next.id:u.id;
 }
 function activeAttack(a,t){
   if(battle.phase!=='fight'||battle.activeId!==a.id||a.turnDone||a.acted)return false;
   if(!canHit(a,t)){write('Цель далеко или закрыта скалой. Дальность '+rangeOf(a)+' кл.');return false}
   const power=CREATURES[a.key].atk+(a.side==='player'?((Math.max(1,Number(a.level)||1)-1)+(state.hero.attack||0)+(typeof equipmentAttackBonus==='function'?equipmentAttackBonus():0)):(battle.place.enemyBonus||0));
   const type=CREATURES[a.key].type,atkKind=type==='magic'||type==='mage'?'magic':type==='ranged'?'ranged':'melee';
   t.hp-=power;a.acted=true;
   faceToward(a,t);faceToward(t,a);
   const [ax]=project(a.x,a.y),[tx]=project(t.x,t.y),[,ay]=project(a.x,a.y),[,ty]=project(t.x,t.y);
   const len=Math.hypot(tx-ax,ty-ay)||1,ux=(tx-ax)/len,uy=(ty-ay)/len;
   fx('attack',t.x,t.y,{fromX:a.x,fromY:a.y,power,atkKind,isMagic:atkKind==='magic'});
   if(atkKind==='melee')playAnim(a,'lunge',{dx:ux*Math.min(26,len*.55),dy:uy*Math.min(26,len*.55)*KY});
   else playAnim(a,'cast',{dx:atkKind==='ranged'?-ux*5:0,glow:atkKind==='magic'?'rgba(236,190,255,.9)':null});
   playAnim(t,'hit',{delay:IMPACT_MS,dx:ux});
   write(CREATURES[a.key].name+' атакует '+CREATURES[t.key].name+' — '+power+' урона.');
   if(t.hp<=0){
     t.hp=0;t.alive=false;fx('death',t.x,t.y,{delay:IMPACT_MS+160});
     if(fxEnabled)ghosts.set(t.id,{u:{id:t.id,key:t.key,side:t.side,x:t.x,y:t.y,face:t.face,alive:false},start:performance.now()+IMPACT_MS+160,dur:900});
     write('☠ '+CREATURES[t.key].name+' погибает.');
     if(t.side==='player'){
       state.units=state.units.filter(c=>c.id!==t.id);state.army=state.army.filter(id=>id!==t.id);write('Копия №'+t.id+' навсегда удалена из коллекции.');
       save();
     }
   }
   if(!allLiving('enemy').length){endExpedition(true);return true}
   if(!allLiving('player').length){endExpedition(false);return true}
   if(a.side==='player')finishTurn(a);
   return true;
 }

 function buildTurnQueue(){
   const allies=allLiving('player').sort((a,b)=>speedOf(b)-speedOf(a)||a.id-b.id);
   const enemies=allLiving('enemy').sort((a,b)=>speedOf(b)-speedOf(a)||String(a.id).localeCompare(String(b.id)));
   const queue=[];const max=Math.max(allies.length,enemies.length);
   for(let i=0;i<max;i++){if(allies[i])queue.push(allies[i].id);if(enemies[i])queue.push(enemies[i].id)}
   return queue;
 }
 function startRound(round){
   if(!battle||battle.over)return;
   battle.round=round;battle.turnQueue=buildTurnQueue();battle.turnIndex=0;
   [...battle.allies,...battle.enemies].forEach(u=>{u.turnDone=false;u.moved=false;u.acted=false});
   fx('turn',8,8,{label:'РАУНД '+battle.round});
   write('✦ Раунд '+battle.round+'. Порядок хода обновлён.');
   beginNextTurn();
 }
 function beginNextTurn(){
   if(!battle||battle.over)return;
   while(battle.turnIndex < (battle.turnQueue?.length||0)){
     const id=battle.turnQueue[battle.turnIndex];
     const unit=[...battle.allies,...battle.enemies].find(u=>u.id===id&&u.alive);
     if(!unit){battle.turnIndex++;continue}
     battle.activeId=id;battle.turn=unit.side;
     unit.moved=false;unit.acted=false;setTimeout(()=>scrollToUnit(unit),60);
     if(unit.side==='player'){
       pickedAlly=unit.id;focusedEnemy=null;enemyBusy=false;
       write('Ходит '+CREATURES[unit.key].name+'. Можно двигаться и атаковать.');
       renderBattle();
       return;
     }
     enemyBusy=true;focusedEnemy=null;renderBattle();
     setTimeout(()=>enemyAction(unit.id),fxEnabled?260:20);
     return;
   }
   startRound((battle.round||1)+1);
 }
 function finishTurn(unit,reason=''){
   if(!battle||battle.over||!unit)return;
   unit.turnDone=true;unit.moved=true;unit.acted=true;
   if(reason)write(reason);
   battle.turnIndex=(battle.turnIndex||0)+1;
   battle.activeId=null;
   if(!allLiving('enemy').length){endExpedition(true);return}
   if(!allLiving('player').length){endExpedition(false);return}
   beginNextTurn();
 }
 async function enemyAction(unitId){
   const foe=battle&&battle.enemies.find(u=>u.id===unitId&&u.alive);
   if(!battle||battle.over||!foe){enemyBusy=false;return}
   const targets=allLiving('player');if(!targets.length){endExpedition(false);return}
   targets.sort((a,b)=>md(foe,a)-md(foe,b)||a.hp-b.hp);
   const t=targets[0];
   if(!canHit(foe,t)){
     const distances=bfs(foe);let choice=null,score=Infinity;
     for(const [key,d] of distances){if(d<1||d>speedOf(foe))continue;const [x,y]=key.split(',').map(Number);
       const candidate={x,y};const s=Math.max(0,md(candidate,t)-rangeOf(foe))*100+md(candidate,t)+d*.05;
       if(s<score){score=s;choice=candidate}
     }
     if(choice){const ox=foe.x,oy=foe.y;foe.x=choice.x;foe.y=choice.y;foe.moved=true;motionEvent(foe,ox,oy);write(CREATURES[foe.key].name+' занимает выгодную позицию.');renderBattle();await wait(fxEnabled?(motion.get(foe.id)?.duration||460)+80:40)}
   }
   const possible=allLiving('player').filter(u=>canHit(foe,u)).sort((a,b)=>a.hp-b.hp);
   if(possible.length){activeAttack(foe,possible[0]);renderBattle();await wait(fxEnabled?820:40)}
   enemyBusy=false;
   if(battle&&!battle.over)finishTurn(foe);
 }
 function canEndCurrentTurn(){
   const u=activePlayer();return !!(battle&&battle.phase==='fight'&&battle.turn==='player'&&u&&!enemyBusy);
 }

 function enterTile(x,y){
  if(!inBattle()||enemyBusy)return;
  const u=unitHere(x,y);
  if(battle.phase==='deploy'){
    if(u&&u.side==='player'){pickedAlly=u.id;focusedEnemy=null;}
    else if(!u)doPlace(x,y);
    else focusedEnemy=u.id;
    renderBattle();return;
  }
  if(battle.turn!=='player')return;
  const a=activePlayer();
  if(u&&u.side==='player'){
    if(u.id!==a?.id)write('Сейчас ходит другой союзник: '+CREATURES[a.key].name+'.');
    pickedAlly=a?.id||u.id;focusedEnemy=null;renderBattle();return;
  }
  if(u&&u.side==='enemy'){
    focusedEnemy=u.id;
    if(a)activeAttack(a,u);
    renderBattle();return;
  }
  if(!a){write('Сейчас нет активного союзника.');renderBattle();return}
  if(a.moved){write('Этот боец уже перемещался в свой ход.');renderBattle();return}
  if(!validFree(x,y,a.id)){write('Нельзя занять эту клетку.');renderBattle();return}
  const distance=bfs(a).get(posKey(x,y));
  if(distance===undefined||distance>speedOf(a)){write('Слишком далеко. Доступно клеток движения: '+speedOf(a)+'.');renderBattle();return}
  const beforeX=a.x,beforeY=a.y;a.x=x;a.y=y;a.moved=true;motionEvent(a,beforeX,beforeY);
  write(CREATURES[a.key].name+' перемещается на '+(x+1)+':'+(y+1)+'.');
  if(!allLiving('enemy').some(e=>canHit(a,e))){
    write('После перемещения цель недоступна — ход завершён.');
    finishTurn(a);
  } else renderBattle();
 }

 function deploy(){
   if(!battle||battle.phase!=='deploy'||!allPlaced())return;
   battle.phase='fight';
   pickedAlly=battle.allies[0].id;focusedEnemy=null;
   write('⚔ Битва началась. Теперь существа ходят по очереди — по одному бойцу за раз.');
   startRound(1);
 }
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 function enemyPhase(){
   const u=activePlayer();
   if(!canEndCurrentTurn())return;
   finishTurn(u,'Ход '+CREATURES[u.key].name+' завершён.');
 }
 function endExpedition(victory){
  if(!battle||battle.over)return;
  battle.over=true;battle.phase='done';battle.turn='done';
  if(victory){
    state.gold+=battle.place.gold;state.xp+=battle.place.xp;state.won[battle.place.id]=true;
    write('🏆 Победа! '+battle.place.gold+' золота и '+battle.place.xp+' опыта.');
    if(battle.place.id==='dragon'&&Math.random()<.75){addUnit('lichlord');state.recent.unshift({emoji:'♛',name:CREATURES.lichlord.name});write('Награда Некрополя: Король-лич!')}
    while(state.xp>=state.level*100){state.xp-=state.level*100;state.level++;
       state.hero.points=(state.hero.points||0)+1;write('★ '+state.hero.name+' достигает уровня '+state.level+'. Получено очко развития!')}
  } else write('Поражение. Живые бойцы сохраняются; погибшие потеряны навсегда.');
  write('Поход завершён.');
  state.army=state.army.filter(id=>state.units.some(u=>u.id===id));
  save();renderBattle();
 }
 function inspector(){
  if(!battle)return;
  const unit=focusedEnemy!==null?battle.enemies.find(u=>u.id===focusedEnemy&&u.alive):(activePlayer()||selected());
  const root=document.getElementById('battle-inspector');
  if(!unit){root.innerHTML='<div class="tactics-mini-title">✦ ВЫБРАННЫЙ БОЕЦ</div><div style="font-size:12px;color:#aaa">Нажми на союзника в отряде или на поле.</div>';return}
  const c=CREATURES[unit.key];
  root.innerHTML=`<div class="tactics-mini-title">${unit.side==='player'?'✦ СОЮЗНЫЙ БОЕЦ':'☠ ВРАГ'}</div><div class="ti-hero"><img src="${CARD_ART[unit.key]}" alt=""><div><b>${c.name}</b><small>⚔ ${c.atk+(unit.side==='player'?(Math.max(1,Number(unit.level)||1)-1)+(state.hero.attack||0)+(typeof equipmentAttackBonus==='function'?equipmentAttackBonus():0):0)} · ♥ ${Math.max(0,unit.hp)} / ${unit.maxHp}</small><small>Дальность ${rangeOf(unit)} · движение ${speedOf(unit)}</small><small>${unit.x===null?'Не размещён':`Клетка ${unit.x+1} : ${unit.y+1}`}</small><div class="ti-hp"><span style="width:${Math.max(0,unit.hp/unit.maxHp)*100}%"></span></div></div></div>`;
 }
 function formation(){
  const el=document.getElementById('tactics-formation');
  if(!battle)return;
  el.innerHTML='<h3>✦ '+(battle.phase==='deploy'?'РАССТАВЬ СВОЙ ОТРЯД': 'БОЙЦЫ ОТРЯДА')+' · '+allLiving('player').length+'/4</h3>'+battle.allies.map(u=>`<button type="button" data-tactics-unit="${u.id}" class="tf-unit ${u.id===pickedAlly?'selected':''} ${u.x!==null?'placed':''} ${u.turnDone?'acted':''}" ${!u.alive?'disabled':''}><img src="${CARD_ART[u.key]}" alt=""><span>${CREATURES[u.key].name}${u.side==='player'&&u.level>1?' · Ур. '+u.level:''}</span><small>${!u.alive?'☠ погиб':u.x===null?'✚ разместить':battle.phase==='deploy'?'✓ размещён':`♥ ${u.hp} ${u.turnDone?'· ход сделан':battle.activeId===u.id?'· ходит сейчас':''}`}</small></button>`).join('');
 }
 function battleWelcome(){
  document.getElementById('battle-title').textContent='АРЕНА ПОХОДОВ';
  document.getElementById('battle-sub').textContent='Гекс-поле 16 × 16 · пошаговая стратегия';
  const status=document.getElementById('battle-status');status.innerHTML='<div class="tactics-welcome" style="width:100%"><h3>Выбери место для похода</h3><p>Размести до четырёх существ на поле, затем веди пошаговый бой: существа ходят по очереди, по одному бойцу за раз.</p><div class="tactics-missions">'+PLACES.map(p=>`<button type="button" class="tactics-mission" onclick="startBattle('${p.id}')"><div style="font-size:31px">${p.emoji}</div><b>${p.name}</b><small>✦ ${p.gold} золота · ${p.xp} опыта</small></button>`).join('')+'</div></div>';
  document.querySelector('.tactics-stage').style.display='none';
  document.getElementById('end-turn').disabled=true;
 }
 function renderTactics(){
  if(!battle){battleWelcome();return}
  document.querySelector('.tactics-stage').style.display='grid';
  document.getElementById('battle-title').textContent=battle.place.name.toUpperCase();
  const setup=battle.phase==='deploy',done=battle.phase==='done';
  document.getElementById('battle-sub').textContent='Поле 16 × 16 · '+(setup?'подготовка отряда':done?'поход завершён':`Раунд ${battle.round} · ${battle.turn==='player'?'ходит '+CREATURES[activePlayer()?.key||pickedAlly]?.name||'союзник':'ходит '+CREATURES[activeEnemy()?.key||'boneguard']?.name||'враг'}`);
  document.getElementById('battle-status').textContent=setup?`РАССТАНОВКА · ${battle.allies.filter(u=>u.x!==null).length} из ${battle.allies.length} бойцов размещено. Выбирай в панели справа, затем нажимай на зелёную клетку.`:done?((allLiving('enemy').length===0?'🏆 ПОБЕДА':'☠ ПОРАЖЕНИЕ')+' · Можно вернуться к карте.'): `РАУНД ${battle.round} · Союзники: ${allLiving('player').length} · Противники: ${allLiving('enemy').length} · ${battle.turn==='player'?'ходит '+CREATURES[activePlayer()?.key||pickedAlly]?.name:'враг действует…'}`;
  document.getElementById('tactics-instruction').textContent=setup?'Выбери бойца справа и нажми на свободную клетку в зелёной зоне. Повтори для каждого бойца. Затем нажми «Начать бой».':done?'Поход завершён. Выжившие сохраняются, павшие карты исчезают навсегда.':'Ходит только один боец за раз. Сначала можно переместиться по синим клеткам, затем атаковать врага или завершить ход кнопкой.';
  document.getElementById('tactics-auto-deploy').style.display=setup?'':'none';
  document.getElementById('tactics-deploy').style.display=setup?'':'none';
  document.getElementById('tactics-deploy').disabled=!allPlaced();
  document.getElementById('attack').style.display=!setup&&!done?'':'none';
  document.getElementById('heal').style.display=!setup&&!done?'':'none';
  const a=activePlayer();const enemy=battle.enemies.find(u=>u.id===focusedEnemy&&u.alive);
  document.getElementById('attack').disabled=enemyBusy||done||battle.turn!=='player'||!a||a.acted||battle.activeId!==a.id||!enemy||!canHit(a,enemy);
  document.getElementById('heal').disabled=enemyBusy||done||battle.turn!=='player'||!a||a.acted||battle.activeId!==a.id||a.hp>=a.maxHp;
  const end=document.getElementById('end-turn');end.disabled=setup||done||enemyBusy||battle.turn!=='player'||!activePlayer();end.textContent=setup?'Расставь бойцов':done?'Бой окончен':'Передать ход →';
  document.getElementById('retreat').textContent=done?'← К карте':setup?'← Отменить поход':'← Отступить';
  document.getElementById('battle-log').innerHTML=battle.log.map(x=>`<div>✦ ${x}</div>`).join('');
  document.getElementById('tactics-cursor').textContent=hoverTile?`Клетка ${hoverTile.x+1} : ${hoverTile.y+1}`:setup?'◈ Зелёные клетки — зона расстановки':done?'✦ Поход окончен':'◈ Синие гексы — доступный ход · красные — цель активного бойца';
  inspector();formation();initiative();layoutBoard();drawBoard();centerBoard();frame();
 }
 function markNavigation(tab){document.querySelectorAll('.gothic-sidebar [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));}
 const oldShowTab=showTab;
 // startBattle used by all expedition buttons; keep original collection, heroes, gear, maps.
 startBattle=function(placeId){
  if(!state.army.length){alert('Выбери хотя бы одного бойца в четырёх слотах под героем.');showTab('world');if(typeof openWorldArmySlot==='function')openWorldArmySlot(0);return}
  const place=PLACES.find(p=>p.id===placeId)||PLACES[0];
  const allies=state.army.map(id=>byId(id)).filter(Boolean).slice(0,4).map(u=>({id:u.id,key:u.key,side:'player',level:creatureLevel(u),hp:creatureStats(u).hp+(typeof equipmentHealthBonus==='function'?equipmentHealthBonus():0),maxHp:creatureStats(u).hp+(typeof equipmentHealthBonus==='function'?equipmentHealthBonus():0),x:null,y:null,alive:true,moved:false,acted:false}));
  const enemies=place.enemies.map((key,i)=>({id:'e'+i,key,side:'enemy',hp:Math.round(CREATURES[key].hp*(place.hpMult||1)),maxHp:Math.round(CREATURES[key].hp*(place.hpMult||1)),x:(positions[place.id]||positions.forest)[i][0],y:(positions[place.id]||positions.forest)[i][1],alive:true,moved:false,acted:false}));
  battle={place,allies,enemies,phase:'deploy',round:0,turn:'player',over:false,activeId:null,turnQueue:[],turnIndex:0,log:['Поход: '+place.name+'. Размести существ в выделенной зоне.']};
  battleAnimationReset();pickedAlly=allies[0]?.id||null;focusedEnemy=null;hoverTile=null;cameraReady=false;enemyBusy=false;
  showTab('battle');markNavigation('battle');renderBattle();enemies.forEach((en,i)=>{en.face='l';playAnim(en,'spawn',{delay:120*i})});
 };
 renderBattle=renderTactics;
 enemyTurn=enemyPhase;
 // Replace fragile legacy actions and retreat behavior with turn-based actions.
 document.getElementById('end-turn').onclick=enemyPhase;
 document.getElementById('tactics-deploy').onclick=deploy;
 document.getElementById('tactics-auto-deploy').onclick=spawnFallback;
 document.getElementById('retreat').onclick=()=>{
   if(!battle){showTab('map');markNavigation('map');return}
   if(!battle.over&&battle.phase==='fight'&&!confirm('Отступить? Погибшие существа уже потеряны, выжившие сохранятся.'))return;
   battle=null;battleAnimationReset();hoverTile=null;pickedAlly=null;focusedEnemy=null;enemyBusy=false;showTab('map');markNavigation('map');
 };
 document.getElementById('attack').onclick=()=>{
  const ally=selected(),enemy=battle?.enemies.find(u=>u.id===focusedEnemy&&u.alive);
  if(ally&&enemy)activeAttack(ally,enemy);renderBattle();
 };
 document.getElementById('heal').onclick=()=>{
  const u=activePlayer();if(!u||u.acted||battle?.phase!=='fight'||battle.turn!=='player')return;
  const healing=Math.min(3,u.maxHp-u.hp);u.hp+=healing;u.acted=true;playAnim(u,'heal');fx('heal',u.x,u.y,{healing});write('✦ '+CREATURES[u.key].name+' восстанавливает '+healing+' здоровья.');renderBattle();finishTurn(u);
 };
 document.getElementById('tactics-formation').addEventListener('click',e=>{
   const button=e.target.closest('[data-tactics-unit]');if(!button||!battle||battle.over||enemyBusy)return;
   const chosen=Number(button.dataset.tacticsUnit);if(battle.phase==='fight'&&battle.turn==='player'&&battle.activeId!==chosen){write('Сейчас ходит '+CREATURES[activePlayer().key].name+'.');pickedAlly=activePlayer().id;}else pickedAlly=chosen;focusedEnemy=null;renderBattle();
 });
 // ---------- turn-order strip (initiative) above the board ----------
 const boardArea=document.querySelector('#tab-battle .tactics-board-area');
 const initEl=document.createElement('div');initEl.id='tactics-initiative';initEl.style.display='none';
 if(boardArea&&scroller)boardArea.insertBefore(initEl,scroller);
 function initiative(){
   if(!battle||battle.phase!=='fight'){initEl.style.display='none';return}
   const all=[...battle.allies,...battle.enemies],find=id=>all.find(u=>u.id===id&&u.alive);
   const now=(battle.turnQueue||[]).slice(battle.turnIndex||0).map(find).filter(Boolean);
   const next=buildTurnQueue().map(find).filter(Boolean);
   const chip=(u,cur)=>`<button type="button" class="ti-chip ${u.side==='player'?'ally':'enemy'} ${cur?'current':''}" data-init="${u.id}" title="${CREATURES[u.key].name} · ♥ ${u.hp}"><img src="${CARD_ART[u.key]}" alt=""><i>${u.hp}</i></button>`;
   initEl.style.display='flex';
   initEl.innerHTML=`<span class="ti-label">РАУНД ${battle.round}</span>`+now.map(u=>chip(u,u.id===battle.activeId)).join('')+`<span class="ti-label next">РАУНД ${battle.round+1}</span>`+next.map(u=>chip(u,false)).join('');
 }
 initEl.addEventListener('click',e=>{
   const b=e.target.closest('[data-init]');if(!b||!battle)return;
   const u=[...battle.allies,...battle.enemies].find(x=>String(x.id)===b.dataset.init&&x.alive);if(!u)return;
   if(u.side==='enemy'&&!enemyBusy){focusedEnemy=u.id;renderBattle()}
   scrollToUnit(u);
 });
 const hexStyle=document.createElement('style');hexStyle.textContent=`
   #tab-battle #arena{touch-action:pan-x pan-y;user-select:none;-webkit-user-select:none;cursor:pointer}
   #tab-battle #tactics-initiative{align-items:center;gap:6px;padding:8px 12px 6px;overflow-x:auto;background:linear-gradient(#1c1812,#0d1118);border-bottom:1px solid #7a6242;scrollbar-width:none}
   #tab-battle #tactics-initiative::-webkit-scrollbar{display:none}
   #tab-battle .ti-label{flex:0 0 auto;font:700 9px Georgia,serif;letter-spacing:1.5px;color:#b99a62;padding:0 4px;writing-mode:horizontal-tb}
   #tab-battle .ti-label.next{margin-left:8px;opacity:.6}
   #tab-battle .ti-chip{position:relative;flex:0 0 auto;width:42px;height:48px;padding:0;border-radius:7px;overflow:hidden;border:2px solid #4d9f8b;background:#111821;transition:transform .15s,box-shadow .15s}
   #tab-battle .ti-chip.enemy{border-color:#b0584d}
   #tab-battle .ti-chip.current{border-color:#ffe29d;box-shadow:0 0 12px #ffd37a99;transform:translateY(-2px) scale(1.08)}
   #tab-battle .ti-chip img{display:block;width:100%;height:100%;object-fit:cover;object-position:50% 12%;transform:scale(1.7);transform-origin:50% 22%}
   #tab-battle .ti-chip i{position:absolute;right:1px;bottom:0;font:700 10px Georgia,serif;font-style:normal;color:#fff4da;background:#000a;border-radius:5px 0 0 0;padding:0 4px}
   @media(max-width:620px){#tab-battle .ti-chip{width:36px;height:42px}}
 `;document.head.appendChild(hexStyle);
 const camTitle=document.querySelector('#tab-battle .tactics-camera>span:first-child');if(camTitle)camTitle.textContent='ГЕКС-ПОЛЕ · 16×16';
 arenaCanvas.setAttribute('aria-label','Гекс-поле 16 на 16. Выбирай бойца и нажимай на гекс для расстановки, перемещения или атаки.');
 arenaCanvas.title='Нажми на гекс или на существо';
 const info=document.querySelector('#tab-battle .tactics-board-footer span:last-child');
 if(info)info.textContent='Прокручивай поле пальцем · +/− — масштаб · стрелки и Enter — с клавиатуры';
 arenaCanvas.addEventListener('click',e=>{const pos=tileFromEvent(e);if(pos)enterTile(pos.x,pos.y)});
 arenaCanvas.addEventListener('mousemove',e=>{
   if(!battle)return;
   const tile=tileFromEvent(e);if((tile?.x??-1)===(hoverTile?.x??-1)&&(tile?.y??-1)===(hoverTile?.y??-1))return;
   hoverTile=tile;drawBoard();
   document.getElementById('tactics-cursor').textContent=tile?'Клетка '+(tile.x+1)+' : '+(tile.y+1):'◈ Выбери клетку';
 });
 arenaCanvas.addEventListener('mouseleave',()=>{hoverTile=null;if(battle)drawBoard()});
 arenaCanvas.addEventListener('keydown',e=>{
   if(!battle||battle.over)return;
   const offsets={ArrowUp:[0,-1],ArrowDown:[0,1],ArrowLeft:[-1,0],ArrowRight:[1,0]};
   if(offsets[e.key]){e.preventDefault();if(!hoverTile)hoverTile={x:2,y:8};else{const [dx,dy]=offsets[e.key];hoverTile={x:Math.min(15,Math.max(0,hoverTile.x+dx)),y:Math.min(15,Math.max(0,hoverTile.y+dy))}}drawBoard()}
   if(e.key==='Enter'||e.key===' '){e.preventDefault();if(hoverTile)enterTile(hoverTile.x,hoverTile.y)}
 });
 const motionButton=document.getElementById('tactics-motion-toggle');
 if(motionButton){
   motionButton.setAttribute('aria-pressed',String(fxEnabled));motionButton.textContent=fxEnabled?'✧ ЭФФЕКТЫ: ВКЛ':'✧ ЭФФЕКТЫ: ВЫКЛ';
   motionButton.onclick=()=>{fxEnabled=!fxEnabled;localStorage.setItem('cc-motion',fxEnabled?'on':'off');motionButton.setAttribute('aria-pressed',String(fxEnabled));motionButton.textContent=fxEnabled?'✧ ЭФФЕКТЫ: ВКЛ':'✧ ЭФФЕКТЫ: ВЫКЛ';if(!fxEnabled)battleAnimationReset();drawBoard();frame()};
 }
 document.getElementById('tactics-zoom-out').onclick=()=>{zoomIndex=Math.max(0,zoomIndex-1);cameraReady=false;layoutBoard();centerBoard()};
 document.getElementById('tactics-zoom-in').onclick=()=>{zoomIndex=Math.min(zoomSteps.length-1,zoomIndex+1);cameraReady=false;layoutBoard();centerBoard()};
 window.addEventListener('resize',()=>{cameraReady=false;layoutBoard();centerBoard()});
 renderBattle();
})();