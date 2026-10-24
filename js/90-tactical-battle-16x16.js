/* Isometric tactical expedition, 16 × 16 cells. No CDN or server. */
(function(){
 'use strict';
 const SIZE=16,W=70,H=40,DEPTH=14,CW=1200,CH=760,OX=CW/2,OY=112;
 const zoomSteps=[0.72,0.85,1,1.18,1.38];let zoomIndex=2;
 const BASE_YAW=Math.PI/4,TAU=Math.PI*2,CENTER=(SIZE-1)/2;
 const PROJ_X=W/Math.SQRT2,PROJ_Y=H/Math.SQRT2,PROJ_CY=OY+(SIZE-1)*H/2;
 let cameraYaw=BASE_YAW,cameraMove=null,rotationFrame=0,dragInfo=null,ignoreClickUntil=0;
 const normalizeAngle=a=>((a%TAU)+TAU)%TAU;
 const degrees=()=>Math.round(normalizeAngle(cameraYaw-BASE_YAW)*180/Math.PI)%360;

 const arenaCanvas=document.getElementById('arena');const ctx=arenaCanvas.getContext('2d');
 const scroller=document.getElementById('tactics-board-scroll');
 const boardCache={};let hoverTile=null;let pickedAlly=null;let focusedEnemy=null;let cameraReady=false;let enemyBusy=false;
 // Visual events do not influence the turn rules or saved game state.
 const motion=new Map();const effects=[];let frameId=0,lastFrame=0,paintTime=0;
 let fxEnabled=localStorage.getItem('cc-motion')!=='off'&&!window.matchMedia('(prefers-reduced-motion: reduce)').matches;
 const ease=t=>1-Math.pow(1-Math.min(1,Math.max(0,t)),3);
 const lerp=(a,b,t)=>a+(b-a)*t;
 const aliveVisuals=t=>effects.some(e=>t-e.start<e.duration)||[...motion.values()].some(m=>t-m.start<m.duration);
 function unitPixel(u,t=paintTime){
   const m=motion.get(u.id);
   if(m&&fxEnabled){const k=ease((t-m.start)/m.duration);return project(lerp(m.x,u.x,k),lerp(m.y,u.y,k));}
   return project(u.x,u.y);
 }
 function tick(t){
   frameId=0;if(!battle||document.hidden||document.getElementById('tab-battle').classList.contains('hidden'))return;
   // 30 fps cap for battery life on mobile.
   if(t-lastFrame>32){lastFrame=t;drawBoard(t)}
   if(fxEnabled&&battle.phase!=='done')frameId=requestAnimationFrame(tick);
   else if(aliveVisuals(t))frameId=requestAnimationFrame(tick);
 }
 function frame(){if(!fxEnabled||frameId||!battle||document.hidden)return;frameId=requestAnimationFrame(tick)}
 function motionEvent(u,oldX,oldY,duration=430){if(!fxEnabled)return;motion.set(u.id,{x:oldX,y:oldY,start:performance.now(),duration});frame()}
 function fx(kind,x,y,extra={}){
   if(!fxEnabled||!battle)return;
   const durations={attack:650,death:960,heal:860,deploy:540,turn:1000};
   effects.push({kind,x,y,start:performance.now(),duration:durations[kind]||700,...extra});
   if(effects.length>36)effects.splice(0,effects.length-36);
   frame();
 }
 function battleAnimationReset(){motion.clear();effects.length=0;lastFrame=0;if(frameId)cancelAnimationFrame(frameId);frameId=0}

 const positions={forest:[[13,5],[13,9],[14,12]],ruins:[[13,4],[12,9],[14,12]],dragon:[[12,5],[13,9],[14,12]]};
 const rockSets={
  forest:[[5,3],[6,3],[7,3],[6,6],[7,6],[9,7],[10,7],[8,11],[9,11],[5,12]],
  ruins:[[6,4],[7,4],[8,4],[5,8],[6,8],[9,8],[10,8],[7,12],[8,12],[11,10]],
  dragon:[[7,4],[8,4],[5,7],[6,7],[9,7],[10,7],[7,10],[8,10],[10,12]]
 };
 const rangeOf=u=>CREATURES[u.key].type==='melee'?1:CREATURES[u.key].type==='ranged'?5:3;
 const speedOf=u=>CREATURES[u.key].type==='melee'?3:2;
 const posKey=(x,y)=>x+','+y;
 const inBounds=(x,y)=>x>=0&&y>=0&&x<SIZE&&y<SIZE;
 const md=(a,b)=>Math.abs(a.x-b.x)+Math.abs(a.y-b.y);
 const inBattle=()=>!!(battle&&!battle.over);
 const unitHere=(x,y,except)=>!battle?null:[...battle.allies,...battle.enemies].find(u=>u.alive&&u.x===x&&u.y===y&&u.id!==except);
 const rocks=()=>new Set((rockSets[battle?.place.id]||rockSets.forest).map(p=>posKey(...p)));
 const isRock=(x,y)=>rocks().has(posKey(x,y));
 const allLiving=side=>battle[side==='player'?'allies':'enemies'].filter(u=>u.alive);
 const selected=()=>battle?.allies.find(u=>u.id===pickedAlly&&u.alive);
 const allPlaced=()=>battle&&battle.allies.every(u=>u.x!==null&&u.y!==null);
 const activeUnit=()=>battle?[...battle.allies,...battle.enemies].find(u=>u.id===battle.activeId&&u.alive)||null:null;
 const activePlayer=()=>{const u=activeUnit();return u&&u.side==='player'?u:null};
 const activeEnemy=()=>{const u=activeUnit();return u&&u.side==='enemy'?u:null};
 const rankUnit=u=>({unit:u,speed:speedOf(u),hp:u.hp});
 const write=(t)=>{if(!battle)return;battle.log.unshift(t);battle.log=battle.log.slice(0,45)};
 const validFree=(x,y,except)=>inBounds(x,y)&&!isRock(x,y)&&!unitHere(x,y,except);
 function bfs(unit){
   if(unit.x===null)return new Map();
   const map=new Map([[posKey(unit.x,unit.y),0]]);const q=[[unit.x,unit.y]];
   for(let i=0;i<q.length;i++){
     const [x,y]=q[i],d=map.get(posKey(x,y));
     for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
       const nx=x+dx,ny=y+dy,k=posKey(nx,ny);
       if(!validFree(nx,ny,unit.id)||map.has(k))continue;
       map.set(k,d+1);q.push([nx,ny]);
     }
   }
   return map;
 }
 function clearShot(from,to){
   // Ranged attacks are blocked by standing stones between the centers.
   if(md(from,to)<=1)return true;
   const steps=Math.max(Math.abs(to.x-from.x),Math.abs(to.y-from.y))*3;
   for(let i=1;i<steps;i++){
     const t=i/steps,x=Math.round(from.x+(to.x-from.x)*t),y=Math.round(from.y+(to.y-from.y)*t);
     if((x!==from.x||y!==from.y)&&(x!==to.x||y!==to.y)&&isRock(x,y))return false;
   }
   return true;
 }
 const canHit=(a,b)=>a.x!==null&&b.x!==null&&md(a,b)<=rangeOf(a)&&clearShot(a,b);
 const artCache=new Map();
 function portrait(key){
   if(artCache.has(key))return artCache.get(key);
   const img=new Image();artCache.set(key,img);
   img.onload=()=>{if(battle)drawBoard();};
   img.src=CARD_ART[key];return img;
 }
 function seeded(x,y,seed=0){let k=(x*73856093)^(y*19349663)^(seed*83492791);k=Math.imul(k^(k>>>13),1274126177);return ((k^(k>>>16))>>>0)/4294967295;}
 function project(x,y){
   const u=x-CENTER,v=y-CENTER,c=Math.cos(cameraYaw),si=Math.sin(cameraYaw);
   return [OX+(u*c-v*si)*PROJ_X,PROJ_CY+(u*si+v*c)*PROJ_Y];
 }
 function inverseProject(sx,sy){
   const u=(sx-OX)/PROJ_X,v=(sy-PROJ_CY)/PROJ_Y,c=Math.cos(cameraYaw),si=Math.sin(cameraYaw);
   return {x:CENTER+u*c+v*si,y:CENTER-u*si+v*c};
 }
 function tileCorners(sx,sy){
   const c=Math.cos(cameraYaw),si=Math.sin(cameraYaw),vx=[c*PROJ_X,si*PROJ_Y],vy=[-si*PROJ_X,c*PROJ_Y];
   return [
     [sx-(vx[0]+vy[0])/2,sy-(vx[1]+vy[1])/2],
     [sx+(vx[0]-vy[0])/2,sy+(vx[1]-vy[1])/2],
     [sx+(vx[0]+vy[0])/2,sy+(vx[1]+vy[1])/2],
     [sx+(-vx[0]+vy[0])/2,sy+(-vx[1]+vy[1])/2]
   ];
 }
 function tracePolygon(points){ctx.beginPath();ctx.moveTo(...points[0]);for(let i=1;i<points.length;i++)ctx.lineTo(...points[i]);ctx.closePath()}
 function diamond(sx,sy){tracePolygon(tileCorners(sx,sy))}

 function relief(x,y,sx,sy){
   const terrain={
     forest:{base:[62,76,66],sideA:'#212822',sideB:'#131914',accent:'rgba(121,166,117,.30)',rune:'rgba(150,214,146,.12)',vein:'rgba(83,98,71,.34)'},
     ruins:{base:[99,91,82],sideA:'#312a23',sideB:'#1a1512',accent:'rgba(178,150,114,.22)',rune:'rgba(245,216,160,.13)',vein:'rgba(91,77,67,.32)'},
     dragon:{base:[66,71,79],sideA:'#1e232c',sideB:'#11151d',accent:'rgba(121,141,172,.24)',rune:'rgba(110,228,255,.12)',vein:'rgba(73,80,94,.36)'}
   }[battle.place.id]||{base:[72,74,80],sideA:'#22272e',sideB:'#141920',accent:'rgba(170,150,118,.22)',rune:'rgba(210,180,120,.14)',vein:'rgba(81,81,88,.34)'};
   const number=seeded(x,y,battle.place.id.length);
   const dust=seeded(x,y,71);
   const crack=seeded(x,y,141);
   const delta=Math.round(number*14)-7;
   let [r,g,b]=terrain.base.map(v=>Math.max(8,Math.min(255,v+delta)));
   const isDeploy=x<=3,isEnemy=x>=12;
   if(battle.phase==='deploy'){
     if(isDeploy){g+=10;b+=6}
     if(isEnemy){r+=12;g-=4}
   }
   // Only walls on the camera-facing side show a vertical stone edge.
   const corners=tileCorners(sx,sy);
   for(let i=0;i<4;i++){
     const a=corners[i],b=corners[(i+1)%4];
     if((a[1]+b[1])/2 <= sy+.05)continue;
     tracePolygon([a,b,[b[0],b[1]+DEPTH],[a[0],a[1]+DEPTH]]);
     ctx.fillStyle=i%2===0?terrain.sideA:terrain.sideB;ctx.fill();
   }
   const topGrad=ctx.createLinearGradient(sx,sy-H/2,sx,sy+H/2);
   topGrad.addColorStop(0,`rgb(${r+16},${g+16},${b+16})`);
   topGrad.addColorStop(.32,`rgb(${r+7},${g+7},${b+7})`);
   topGrad.addColorStop(.78,`rgb(${r},${g},${b})`);
   topGrad.addColorStop(1,`rgb(${Math.max(0,r-18)},${Math.max(0,g-18)},${Math.max(0,b-18)})`);
   diamond(sx,sy);ctx.fillStyle=topGrad;ctx.fill();
   ctx.lineWidth=.55;ctx.strokeStyle='rgba(255,238,204,.06)';ctx.stroke();

   const highlight=ctx.createLinearGradient(sx-W/4,sy-H/3,sx+W/4,sy+H/4);
   highlight.addColorStop(0,'rgba(255,255,255,.09)');highlight.addColorStop(1,'rgba(255,255,255,0)');
   diamond(sx,sy);ctx.fillStyle=highlight;ctx.fill();

   ctx.strokeStyle=terrain.vein;ctx.lineWidth=1;
   ctx.beginPath();
   ctx.moveTo(sx-18,sy+4);ctx.lineTo(sx-8,sy-1);ctx.lineTo(sx+1,sy+2);ctx.lineTo(sx+13,sy-4);
   ctx.stroke();
   if(crack>.45){ctx.beginPath();ctx.moveTo(sx-7,sy+9);ctx.lineTo(sx+1,sy+3);ctx.lineTo(sx+9,sy+8);ctx.stroke();}
   if(dust>.52){ctx.strokeStyle=terrain.accent;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(sx-11,sy+6);ctx.lineTo(sx-1,sy+1);ctx.lineTo(sx+10,sy+5);ctx.stroke()}
   if(dust>.72){ctx.fillStyle=terrain.rune;ctx.beginPath();ctx.arc(sx+10,sy-1,2.6,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(sx-6,sy+5,2.1,0,Math.PI*2);ctx.fill()}
 }

 function rock(sx,sy,x,y){
   ctx.save();ctx.translate(sx,sy-9);const height=18+seeded(x,y,12)*12;
   ctx.beginPath();ctx.moveTo(-17,9);ctx.lineTo(-14,-height+9);ctx.lineTo(-3,-height-7);ctx.lineTo(13,-height+7);ctx.lineTo(17,8);ctx.lineTo(0,17);ctx.closePath();
   const shade=ctx.createLinearGradient(-17,-height,14,10);shade.addColorStop(0,'#747681');shade.addColorStop(.4,'#414750');shade.addColorStop(1,'#151c26');ctx.fillStyle=shade;ctx.shadowBlur=11;ctx.shadowColor='#060a0ecb';ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle='#98897588';ctx.lineWidth=1;ctx.stroke();
   ctx.beginPath();ctx.moveTo(-13,-height+10);ctx.lineTo(-2,-height-4);ctx.lineTo(4,4);ctx.strokeStyle='#bbc0bd66';ctx.stroke();
   ctx.restore();
 }
 function healthbar(u,sx,sy){
   const y=sy-63,w=40;ctx.fillStyle='#0e151ce0';ctx.fillRect(sx-w/2-2,y-2,w+4,9);
   ctx.fillStyle=u.side==='player'?'#5fd4ac':'#e58274';ctx.fillRect(sx-w/2,y,w*Math.max(0,u.hp/u.maxHp),5);
   ctx.strokeStyle='#c1a47a';ctx.lineWidth=.7;ctx.strokeRect(sx-w/2,y,w,5);
 }
 function token(u,sx,sy,t){
   const active=battle?.activeId===u.id||pickedAlly===u.id||focusedEnemy===u.id;
   const idle=fxEnabled?Math.sin(t/380+String(u.id).length*1.7)*2.1:0;
   const bob=fxEnabled?Math.sin(t/600+String(u.id).length)*1.5:0;
   const frameW=52,frameH=69;
   ctx.save();ctx.globalAlpha=(battle&&battle.phase==='fight'&&u.turnDone)?0.76:1;ctx.translate(sx,sy+bob);
   // Cast-shadow and ornate plinth make each figure feel anchored on the ground.
   ctx.beginPath();ctx.ellipse(0,0,27,10,0,0,Math.PI*2);ctx.fillStyle='#030709c9';ctx.fill();
   ctx.save();ctx.shadowColor=u.side==='player'?'#44dcbd':'#e9655d';ctx.shadowBlur=active?23:9;
   const platform=ctx.createLinearGradient(0,-6,0,9);platform.addColorStop(0,u.side==='player'?'#7ac5af':'#c77c71');platform.addColorStop(.6,'#5c4837');platform.addColorStop(1,'#161b22');
   ctx.beginPath();ctx.ellipse(0,-2,24,8,0,0,Math.PI*2);ctx.fillStyle=platform;ctx.fill();ctx.strokeStyle=active?'#ffe2a5':'#ac8c5d';ctx.lineWidth=1.5;ctx.stroke();ctx.restore();
   ctx.translate(0,-13+idle);
   // Animated portrait standee. Actual skinned 3D characters are a later engine milestone.
   ctx.shadowColor='#000';ctx.shadowBlur=12;ctx.shadowOffsetY=5;
   const art=portrait(u.key);
   const grad=ctx.createLinearGradient(-25,-75,25,5);
   grad.addColorStop(0,u.side==='player'?'#65e4c6':'#faab91');grad.addColorStop(.5,'#c7aa77');grad.addColorStop(1,'#403a35');
   ctx.fillStyle=grad;ctx.beginPath();ctx.roundRect(-frameW/2-2,-frameH-16,frameW+4,frameH+7,8);ctx.fill();
   ctx.shadowBlur=0;ctx.shadowOffsetY=0;
   ctx.save();ctx.beginPath();ctx.roundRect(-frameW/2,-frameH-14,frameW,frameH+3,6);ctx.clip();
   ctx.fillStyle='#121821';ctx.fillRect(-frameW/2,-frameH-14,frameW,frameH+3);
   if(art.complete&&art.naturalWidth){
     const scale=(frameH+3)/art.naturalHeight;
     const w=art.naturalWidth*scale*1.30;
     ctx.drawImage(art,-w/2,-frameH-13,w,frameH+3);
   } else {ctx.textAlign='center';ctx.font='38px Georgia';ctx.fillStyle='#c6a16a';ctx.fillText('☠',0,-29)}
   const vignette=ctx.createLinearGradient(0,-frameH-12,0,-8);vignette.addColorStop(0,'#07101908');vignette.addColorStop(.75,'#0b111922');vignette.addColorStop(1,'#070d15eb');ctx.fillStyle=vignette;ctx.fillRect(-frameW/2,-frameH-14,frameW,frameH+3);
   ctx.restore();
   ctx.strokeStyle=active?'#ffe29d':'#bd9a66';ctx.lineWidth=active?2.2:1;
   ctx.strokeRect(-frameW/2,-frameH-14,frameW,frameH+3);
   ctx.beginPath();ctx.moveTo(-frameW/2,-frameH-14);ctx.lineTo(0,-frameH-20);ctx.lineTo(frameW/2,-frameH-14);ctx.stroke();
   if(active){ctx.strokeStyle='#fbe4ac';ctx.lineWidth=1.4;ctx.beginPath();ctx.ellipse(0,0,29,12,0,0,Math.PI*2);ctx.stroke()}
   if(battle.phase==='fight'&&u.side==='player'&&u.acted){ctx.fillStyle='#07101abb';ctx.fillRect(-frameW/2,-frameH-14,frameW,frameH+3)}
   ctx.restore();
   ctx.save();ctx.translate(0,-17+idle);healthbar(u,sx,sy-15+idle);ctx.restore();
   ctx.textAlign='center';ctx.font='bold 11px Georgia';ctx.shadowColor='#000';ctx.shadowBlur=5;ctx.fillStyle='#ffe2ad';ctx.fillText(CREATURES[u.key].name.slice(0,18),sx,sy+22);ctx.shadowBlur=0;
 }
 function boardFootprint(){
   return [project(-.5,-.5),project(SIZE-.5,-.5),project(SIZE-.5,SIZE-.5),project(-.5,SIZE-.5)];
 }
 function drawBoardBase(scene){
   const corners=boardFootprint();
   ctx.save();
   ctx.shadowBlur=24;ctx.shadowColor=scene.shadow;
   tracePolygon(corners.map(([x,y])=>[x,y+DEPTH+12]));ctx.fillStyle=scene.shadow;ctx.fill();ctx.shadowBlur=0;
   for(let i=0;i<4;i++){
     const a=corners[i],b=corners[(i+1)%4];
     if((a[1]+b[1])/2 <= PROJ_CY+.05)continue;
     tracePolygon([a,b,[b[0],b[1]+DEPTH+25],[a[0],a[1]+DEPTH+25]]);
     ctx.fillStyle=i%2===0?scene.frontFace:scene.sideFace;ctx.fill();
   }
   tracePolygon(corners);ctx.fillStyle='rgba(34,31,28,.92)';ctx.fill();
   ctx.strokeStyle='rgba(232,209,162,.16)';ctx.lineWidth=1;ctx.stroke();
   ctx.restore();
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
   const flicker=fxEnabled?(Math.sin(t/400)+1)*.5:0;
   drawTree(112,258,1.15,scene.treeGlow);drawTree(180,286,.92,scene.treeGlow);drawTree(1075,250,1.12,scene.treeGlow);drawTree(1002,292,.96,scene.treeGlow);
   drawPillar(132,245,1.04,true);drawPillar(1068,238,1.08,true);
   ctx.fillStyle=`rgba(255,170,92,${.05+flicker*.04})`;ctx.beginPath();ctx.ellipse(132,247,52,18,0,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.ellipse(1068,240,58,20,0,0,Math.PI*2);ctx.fill();
 }
 function drawForeground(scene,t){
   // Decorations and haze stay in camera space, and never cover interactive tiles.
   const floor=ctx.createLinearGradient(0,CH-68,0,CH);floor.addColorStop(0,'rgba(9,12,15,0)');floor.addColorStop(1,'rgba(7,9,13,.78)');
   ctx.fillStyle=floor;ctx.fillRect(0,CH-68,CW,68);
   ctx.save();ctx.strokeStyle='rgba(216,194,140,.12)';ctx.lineWidth=1;
   ctx.beginPath();ctx.moveTo(66,CH-28);ctx.lineTo(184,CH-28);ctx.moveTo(CW-184,CH-28);ctx.lineTo(CW-66,CH-28);ctx.stroke();ctx.restore();
 }

 function marker(sx,sy,color){ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,13,6.8,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#f4e6ba66';ctx.lineWidth=1;ctx.stroke();ctx.restore()}
 function drawEffects(t){
   ctx.save();
   for(const e of effects){
     const k=Math.min(1,Math.max(0,(t-e.start)/e.duration));
     if(k>=1)continue;
     const [tx,ty]=project(e.x,e.y);
     if(e.kind==='attack'){
       const [sx,sy]=project(e.fromX,e.fromY),fire=e.isMagic;
       if(k<.47){
         const p=ease(k/.47),x=lerp(sx,tx,p),y=lerp(sy-46,ty-35,p)-14*Math.sin(p*Math.PI);
         ctx.shadowColor=fire?'#df78fa':'#ffb460';ctx.shadowBlur=22;
         ctx.strokeStyle=fire?'#d38aff':'#ffde9f';ctx.lineWidth=fire?4:2.5;
         ctx.beginPath();ctx.moveTo(lerp(sx,tx,Math.max(0,p-.14)),lerp(sy-46,ty-35,Math.max(0,p-.14)));ctx.lineTo(x,y);ctx.stroke();
         ctx.beginPath();ctx.arc(x,y,fire?9:5,0,Math.PI*2);ctx.fillStyle=fire?'#dc9dff':'#ffe6aa';ctx.fill();
         ctx.shadowBlur=0;
       } else {
         const q=(k-.47)/.53,alpha=1-q;
         ctx.strokeStyle=fire?`rgba(210,120,255,${alpha})`:`rgba(255,175,105,${alpha})`;ctx.lineWidth=5*(1-q)+.4;
         ctx.shadowColor=fire?'#a24cff':'#ffba58';ctx.shadowBlur=20;
         ctx.beginPath();ctx.arc(tx,ty-35,12+q*43,Math.PI*.18,Math.PI*1.85);ctx.stroke();
         for(let i=0;i<7;i++){const a=i*6.283/7+k*2,r=12+q*48;ctx.fillStyle=i%2?'#ffe2af':'#e9835d';ctx.beginPath();ctx.arc(tx+Math.cos(a)*r,ty-35+Math.sin(a)*r*.6,2.5*(1-q),0,6.283);ctx.fill()}
         ctx.shadowBlur=0;
       }
       if(k>.46){ctx.globalAlpha=Math.max(0,1-(k-.46)/.54);ctx.textAlign='center';ctx.font='bold 23px Georgia';ctx.shadowColor='#000';ctx.shadowBlur=5;ctx.fillStyle='#ffbe90';ctx.fillText('−'+e.power,tx,ty-75-(k-.46)*46);ctx.shadowBlur=0;ctx.globalAlpha=1;}
     } else if(e.kind==='heal'){
       ctx.strokeStyle=`rgba(97,238,183,${1-k})`;ctx.lineWidth=4*(1-k)+1;
       for(let q=0;q<3;q++){ctx.beginPath();ctx.ellipse(tx,ty-20-(k*24),19+k*18+q*7,12+k*17+q*6,0,0,Math.PI*2);ctx.stroke()}
       ctx.font='bold 21px Georgia';ctx.textAlign='center';ctx.fillStyle=`rgba(150,255,191,${1-k})`;ctx.fillText('+'+e.healing,tx,ty-72-k*42);
     } else if(e.kind==='death'){
       ctx.save();ctx.globalAlpha=1-k;ctx.translate(tx,ty-35-k*30);ctx.textAlign='center';ctx.font=`${Math.round(30+k*15)}px Georgia`;ctx.shadowColor='#bf7dff';ctx.shadowBlur=18;ctx.fillStyle='#e6c8df';ctx.fillText('☠',0,0);ctx.restore();
     } else if(e.kind==='deploy'){
       ctx.strokeStyle=`rgba(107,248,182,${1-k})`;ctx.lineWidth=2;ctx.beginPath();ctx.ellipse(tx,ty,9+k*23,4+k*12,0,0,Math.PI*2);ctx.stroke();
     } else if(e.kind==='turn'){
       ctx.globalAlpha=Math.min(.85,(1-k)*2);ctx.textAlign='center';ctx.fillStyle='#f2d49d';ctx.shadowColor='#a97832';ctx.shadowBlur=25;ctx.font='bold 35px Georgia';ctx.fillText(e.label,CW/2,CH/2-30-k*25);ctx.shadowBlur=0;ctx.globalAlpha=1;
     }
   }
   ctx.restore();
   for(let i=effects.length-1;i>=0;i--)if(t-effects[i].start>=effects[i].duration)effects.splice(i,1);
   for(const [id,m] of motion)if(t-m.start>=m.duration)motion.delete(id);
 }
 function drawBoard(t=performance.now()){
  if(!battle)return;
  paintTime=t;
  ctx.clearRect(0,0,CW,CH);
  ctx.save();
  const impact=effects.findLast(e=>e.kind==='attack'&&t-e.start<e.duration&&(t-e.start)/e.duration>.45);
  if(fxEnabled&&impact){const d=(t-impact.start)/impact.duration;ctx.translate(Math.sin(t*.31)*2.5*(1-d),Math.cos(t*.27)*2.2*(1-d))}
  const scene=battle.place.id==='forest'
    ?{skyA:'#29342d',skyMid:'#18221d',skyB:'#090c10',mist:'rgba(127,158,119,.08)',title:'Т Л Е Ю Щ И Й   Л Е С',hazeCore:'rgba(194,224,178,.10)',horizon:'#1a2019',horizonNear:'#232b24',treeGlow:'rgba(127,184,126,.10)',shadow:'rgba(0,0,0,.33)',frontFace:'#2c241d',sideFace:'#241d19'}
    :battle.place.id==='ruins'
      ?{skyA:'#3a332d',skyMid:'#1f1a18',skyB:'#09090b',mist:'rgba(191,160,114,.08)',title:'Р У И Н Ы   Н Е К Р О П О Л Я',hazeCore:'rgba(251,220,160,.08)',horizon:'#1f1a16',horizonNear:'#2a211b',treeGlow:'rgba(203,163,117,.08)',shadow:'rgba(0,0,0,.34)',frontFace:'#342a21',sideFace:'#2c221c'}
      :{skyA:'#253144',skyMid:'#161a25',skyB:'#07080d',mist:'rgba(118,152,189,.10)',title:'Н Е К Р О П О Л Ь   П Е П Л А',hazeCore:'rgba(196,220,255,.10)',horizon:'#141923',horizonNear:'#1d2230',treeGlow:'rgba(93,171,197,.10)',shadow:'rgba(0,0,0,.35)',frontFace:'#2b2729',sideFace:'#201d21'};
  drawSceneBackdrop(scene,t);
  drawBoardBase(scene);
  ctx.textAlign='center';ctx.fillStyle='#d9bb8766';ctx.font='12px Georgia';ctx.fillText('⚜  '+scene.title+'  ·  Т А К Т И Ч Е С К О Е   П О Л Е   1 6 × 1 6  ⚜',CW/2,44);
  const ally=activePlayer();const moveMap=battle.phase==='fight'&&battle.turn==='player'&&ally&&!ally.moved?bfs(ally):null;
  const tiles=[],actors=[];
  const cells=[];
  for(let x=0;x<SIZE;x++)for(let y=0;y<SIZE;y++){
    const [sx,sy]=project(x,y);cells.push({x,y,sx,sy});
  }
  cells.sort((a,b)=>a.sy-b.sy||a.sx-b.sx);
  for(const {x,y,sx,sy} of cells){
    relief(x,y,sx,sy);
    const u=unitHere(x,y);
    if(hoverTile&&hoverTile.x===x&&hoverTile.y===y){diamond(sx,sy);ctx.fillStyle='rgba(255,231,157,.16)';ctx.fill();ctx.strokeStyle='#f9d18f';ctx.lineWidth=1.7;ctx.stroke()}
    if(!u&&!isRock(x,y)){
      if(battle.phase==='deploy'&&x<=3)tiles.push([sx,sy,'rgba(115,225,180,.52)','rgba(164,255,220,.18)']);
      else if(battle.phase==='fight'&&ally&&moveMap&&!ally.moved&&moveMap.get(posKey(x,y))>0&&moveMap.get(posKey(x,y))<=speedOf(ally))tiles.push([sx,sy,'rgba(108,203,246,.72)','rgba(174,232,255,.18)']);
    }
    if(isRock(x,y))rock(sx,sy,x,y);
    if(u)actors.push(u);
  }
  for(const [sx,sy,c,ring] of tiles){
    ctx.beginPath();ctx.ellipse(sx,sy,15,7.2,0,0,Math.PI*2);ctx.shadowColor=c;ctx.shadowBlur=fxEnabled?10:0;ctx.fillStyle=c;ctx.fill();ctx.shadowBlur=0;
    ctx.beginPath();ctx.ellipse(sx,sy,22,10,0,0,Math.PI*2);ctx.strokeStyle=ring;ctx.lineWidth=2;ctx.stroke();
  }
  actors.sort((a,b)=>project(a.x,a.y)[1]-project(b.x,b.y)[1]||project(a.x,a.y)[0]-project(b.x,b.y)[0]);
  for(const u of actors){const [sx,sy]=unitPixel(u,t);token(u,sx,sy,t)}
  if(ally&&battle.phase==='fight'&&battle.turn==='player'&&!ally.acted)for(const e of allLiving('enemy'))if(canHit(ally,e)){
    const [sx,sy]=project(e.x,e.y);ctx.strokeStyle='rgba(244,131,119,.84)';ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(sx,sy,29,12,0,0,Math.PI*2);ctx.stroke();
  }
  if(fxEnabled){
    const shimmer=(Math.sin(t/700)+1)*.5;
    ctx.fillStyle=`rgba(115,84,154,${.05+shimmer*.06})`;ctx.fillRect(36,56,CW-72,3);
    for(let i=0;i<16;i++){
      const px=(seeded(i,7)*CW+Math.sin(t/2100+i)*18),py=(seeded(i,2)*210+Math.cos(t/1950+i)*10);
      ctx.fillStyle=i%2?'#f9d49a44':'#9badcf2e';ctx.beginPath();ctx.arc(px,py,1+seeded(i,3)*1.2,0,Math.PI*2);ctx.fill();
    }
  }
  drawEffects(t);
  drawForeground(scene,t);
  ctx.strokeStyle='rgba(205,170,121,.22)';ctx.lineWidth=2;ctx.strokeRect(20,20,CW-40,CH-40);
  ctx.restore();
 }

 function layoutBoard(){
  arenaCanvas.style.width=Math.round(1140*zoomSteps[zoomIndex])+'px';
  arenaCanvas.style.height='auto';
 }
 function centerBoard(){
  if(!scroller||cameraReady)return;
  const visible=scroller.clientWidth;
  if(visible){scroller.scrollLeft=Math.max(0,(arenaCanvas.getBoundingClientRect().width-visible)/2);cameraReady=true;}
 }
 function tileFromEvent(e){
   const rect=arenaCanvas.getBoundingClientRect();
   const px=(e.clientX-rect.left)*CW/rect.width,py=(e.clientY-rect.top)*CH/rect.height;
   const tile=inverseProject(px,py),x=Math.round(tile.x),y=Math.round(tile.y);
   if(!inBounds(x,y)||Math.abs(tile.x-x)>.51||Math.abs(tile.y-y)>.51)return null;
   return {x,y};
 }
 function spawnFallback(){
  const coords=[[2,6],[2,8],[3,10],[1,11]];
  battle.allies.forEach((u,i)=>{if(u.x!==null)return;let [x,y]=coords[i]||[2,4+i];if(!validFree(x,y,u.id)){
    outer:for(let yy=2;yy<14;yy++)for(let xx=0;xx<=3;xx++)if(validFree(xx,yy,u.id)){x=xx;y=yy;break outer}
   }u.x=x;u.y=y;
  });
  if(!selected())pickedAlly=battle.allies[0]?.id||null;
  renderBattle();
 }
 function doPlace(x,y){
   const u=selected();if(!u){write('Выбери бойца из панели отряда.');return}
   if(x>3){write('Расстановка разрешена только в зелёной зоне слева.');return}
   if(!validFree(x,y,u.id)){write('Эта клетка занята или недоступна.');return}
   u.x=x;u.y=y;fx('deploy',x,y);write(CREATURES[u.key].name+' размещён на клетке '+(x+1)+' : '+(y+1)+'.');
   const next=battle.allies.find(a=>a.x===null);pickedAlly=next?next.id:u.id;
 }
 function activeAttack(a,t){
   if(battle.phase!=='fight'||battle.activeId!==a.id||a.turnDone||a.acted)return false;
   if(!canHit(a,t)){write('Цель далеко или закрыта скалой. Дальность '+rangeOf(a)+' кл.');return false}
   const power=CREATURES[a.key].atk+(a.side==='player'?((Math.max(1,Number(a.level)||1)-1)+(state.hero.attack||0)+(typeof equipmentAttackBonus==='function'?equipmentAttackBonus():0)):0);
   t.hp-=power;a.acted=true;fx('attack',t.x,t.y,{fromX:a.x,fromY:a.y,power,isMagic:CREATURES[a.key].type==='magic'||CREATURES[a.key].type==='mage'});
   write(CREATURES[a.key].name+' атакует '+CREATURES[t.key].name+' — '+power+' урона.');
   if(t.hp<=0){t.hp=0;t.alive=false;fx('death',t.x,t.y);write('☠ '+CREATURES[t.key].name+' погибает.');
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
     unit.moved=false;unit.acted=false;
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
     if(choice){const ox=foe.x,oy=foe.y;foe.x=choice.x;foe.y=choice.y;foe.moved=true;motionEvent(foe,ox,oy);write(CREATURES[foe.key].name+' занимает выгодную позицию.');renderBattle();await wait(fxEnabled?460:40)}
   }
   const possible=allLiving('player').filter(u=>canHit(foe,u)).sort((a,b)=>a.hp-b.hp);
   if(possible.length){activeAttack(foe,possible[0]);renderBattle();await wait(fxEnabled?620:40)}
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
  document.getElementById('battle-sub').textContent='Изометрическое поле 16 × 16 · пошаговая стратегия';
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
  document.getElementById('tactics-cursor').textContent=hoverTile?`Клетка ${hoverTile.x+1} : ${hoverTile.y+1}`:setup?'◈ Зелёные клетки — зона расстановки':done?'✦ Поход окончен':'◈ Синие точки — доступный ход · красные круги — цель активного бойца';
  inspector();formation();layoutBoard();drawBoard();centerBoard();frame();
 }
 function markNavigation(tab){document.querySelectorAll('.gothic-sidebar [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));}
 const oldShowTab=showTab;
 // startBattle used by all expedition buttons; keep original collection, heroes, gear, maps.
 startBattle=function(placeId){
  if(!state.army.length){alert('Выбери хотя бы одного бойца в четырёх слотах под героем.');showTab('world');if(typeof openWorldArmySlot==='function')openWorldArmySlot(0);return}
  const place=PLACES.find(p=>p.id===placeId)||PLACES[0];
  const allies=state.army.map(id=>byId(id)).filter(Boolean).slice(0,4).map(u=>({id:u.id,key:u.key,side:'player',level:creatureLevel(u),hp:creatureStats(u).hp+(typeof equipmentHealthBonus==='function'?equipmentHealthBonus():0),maxHp:creatureStats(u).hp+(typeof equipmentHealthBonus==='function'?equipmentHealthBonus():0),x:null,y:null,alive:true,moved:false,acted:false}));
  const enemies=place.enemies.map((key,i)=>({id:'e'+i,key,side:'enemy',hp:CREATURES[key].hp,maxHp:CREATURES[key].hp,x:(positions[place.id]||positions.forest)[i][0],y:(positions[place.id]||positions.forest)[i][1],alive:true,moved:false,acted:false}));
  battle={place,allies,enemies,phase:'deploy',round:0,turn:'player',over:false,activeId:null,turnQueue:[],turnIndex:0,log:['Поход: '+place.name+'. Размести существ в выделенной зоне.']};
  battleAnimationReset();pickedAlly=allies[0]?.id||null;focusedEnemy=null;hoverTile=null;cameraReady=false;enemyBusy=false;
  showTab('battle');markNavigation('battle');renderBattle();
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
  const healing=Math.min(3,u.maxHp-u.hp);u.hp+=healing;u.acted=true;fx('heal',u.x,u.y,{healing});write('✦ '+CREATURES[u.key].name+' восстанавливает '+healing+' здоровья.');renderBattle();finishTurn(u);
 };
 document.getElementById('tactics-formation').addEventListener('click',e=>{
   const button=e.target.closest('[data-tactics-unit]');if(!button||!battle||battle.over||enemyBusy)return;
   const chosen=Number(button.dataset.tacticsUnit);if(battle.phase==='fight'&&battle.turn==='player'&&battle.activeId!==chosen){write('Сейчас ходит '+CREATURES[activePlayer().key].name+'.');pickedAlly=activePlayer().id;}else pickedAlly=chosen;focusedEnemy=null;renderBattle();
 });
 function updateAngleLabel(){
   const label=document.getElementById('tactics-angle');if(label)label.textContent=degrees()+'°';
 }
 function cancelRotationAnimation(){if(rotationFrame)cancelAnimationFrame(rotationFrame);rotationFrame=0;cameraMove=null}
 function setYaw(angle){cameraYaw=angle;hoverTile=null;updateAngleLabel();if(battle)drawBoard()}
 function rotateTo(target){
   cancelRotationAnimation();
   const start=cameraYaw,span=target-start,begin=performance.now();
   cameraMove={start,target};
   function step(now){
     const t=Math.min(1,(now-begin)/320),k=t*t*(3-2*t);
     setYaw(start+span*k);
     if(t<1){rotationFrame=requestAnimationFrame(step)}else{rotationFrame=0;cameraMove=null}
   }
   rotationFrame=requestAnimationFrame(step);
 }
 function rotateBy(amount){rotateTo(cameraYaw+amount)}
 const rotationStyle=document.createElement('style');rotationStyle.textContent=`
   #tab-battle .tactics-camera .tactics-rotate-btn{min-width:35px;min-height:33px;padding:2px 9px;border:1px solid #9a7b4d;background:linear-gradient(#2e3340,#171d28);border-radius:5px;color:#f5d49c;font-size:20px;touch-action:manipulation}
   #tab-battle .tactics-camera .tactics-rotate-btn:hover{border-color:#f6d99f;box-shadow:0 0 10px #c59d5650}
   #tab-battle .tactics-camera #tactics-angle{min-width:43px;text-align:center;font:600 11px system-ui,sans-serif;letter-spacing:1px;color:#edcd91}
   #tab-battle .tactics-camera #tactics-reset-angle{font-size:11px;min-width:58px}
   #tab-battle #arena{touch-action:none;user-select:none;-webkit-user-select:none;cursor:grab}
   #tab-battle #arena.cc-rotating{cursor:grabbing}
   #tab-battle .tactics-camera{flex-wrap:wrap}
 `;document.head.appendChild(rotationStyle);
 const cameraControls=document.querySelector('#tab-battle .tactics-camera');
 if(cameraControls){
   const createBtn=(id,label,title,callback)=>{
     const button=document.createElement('button');button.type='button';button.id=id;button.className='tactics-rotate-btn';
     button.textContent=label;button.title=title;button.setAttribute('aria-label',title);button.onclick=callback;return button;
   };
   const angle=document.createElement('span');angle.id='tactics-angle';angle.setAttribute('aria-label','Угол поворота арены');
   const left=createBtn('tactics-rotate-left','⟲','Повернуть арену влево на 45 градусов (Q)',()=>rotateBy(-Math.PI/4));
   const right=createBtn('tactics-rotate-right','⟳','Повернуть арену вправо на 45 градусов (E)',()=>rotateBy(Math.PI/4));
   const reset=createBtn('tactics-reset-angle','СБРОС','Исходный ракурс камеры (R)',()=>rotateTo(BASE_YAW));
   const zoomOut=document.getElementById('tactics-zoom-out');
   cameraControls.insertBefore(left,zoomOut);cameraControls.insertBefore(angle,zoomOut);cameraControls.insertBefore(right,zoomOut);cameraControls.insertBefore(reset,zoomOut);
   updateAngleLabel();
 }
 arenaCanvas.setAttribute('aria-label','Тактическое поле 16 на 16. Поверни арену перетаскиванием, кнопками или клавишами Q и E. Клик выбирает клетку.');
 arenaCanvas.title='Перетаскивай, чтобы вращать арену; щелчок выбирает клетку';
 const info=document.querySelector('#tab-battle .tactics-board-footer span:last-child');
 if(info)info.textContent='Перетаскивай поле для поворота · Q/E — поворот · R — исходный ракурс · +/− — масштаб';
 arenaCanvas.addEventListener('pointerdown',e=>{
   if(!battle||e.button!==0&&e.button!==2)return;
   cancelRotationAnimation();dragInfo={id:e.pointerId,startX:e.clientX,startY:e.clientY,startYaw:cameraYaw,moved:false};
   if(e.button===2)e.preventDefault();
   if(arenaCanvas.setPointerCapture)arenaCanvas.setPointerCapture(e.pointerId);
 });
 arenaCanvas.addEventListener('pointermove',e=>{
   if(dragInfo?.id!==e.pointerId)return;
   const dx=e.clientX-dragInfo.startX,dy=e.clientY-dragInfo.startY;
   if(!dragInfo.moved&&Math.hypot(dx,dy)>7)dragInfo.moved=true;
   if(!dragInfo.moved)return;
   arenaCanvas.classList.add('cc-rotating');
   const sensitivity=.010*(CW/arenaCanvas.getBoundingClientRect().width);
   setYaw(dragInfo.startYaw+dx*sensitivity);
 });
 function endPointer(e){
   if(!dragInfo||dragInfo.id!==e.pointerId)return;
   if(dragInfo.moved)ignoreClickUntil=performance.now()+500;
   dragInfo=null;arenaCanvas.classList.remove('cc-rotating');
   if(arenaCanvas.hasPointerCapture?.(e.pointerId))arenaCanvas.releasePointerCapture(e.pointerId);
 }
 arenaCanvas.addEventListener('pointerup',endPointer);
 arenaCanvas.addEventListener('pointercancel',endPointer);
 arenaCanvas.addEventListener('contextmenu',e=>e.preventDefault());
 arenaCanvas.addEventListener('click',e=>{
   if(performance.now()<ignoreClickUntil)return;
   const pos=tileFromEvent(e);if(pos)enterTile(pos.x,pos.y);
 });
 arenaCanvas.addEventListener('mousemove',e=>{
   if(!battle||dragInfo?.moved)return;
   const tile=tileFromEvent(e);if((tile?.x??-1)===(hoverTile?.x??-1)&&(tile?.y??-1)===(hoverTile?.y??-1))return;
   hoverTile=tile;drawBoard();
   document.getElementById('tactics-cursor').textContent=tile?'Клетка '+(tile.x+1)+' : '+(tile.y+1):'◈ Выбери клетку';
 });
 arenaCanvas.addEventListener('mouseleave',()=>{if(dragInfo)return;hoverTile=null;if(battle)drawBoard()});
 arenaCanvas.addEventListener('keydown',e=>{
   if(!battle||battle.over)return;
   if(['q','й','e','у','r','к'].includes(e.key.toLowerCase())){
     e.preventDefault();const key=e.key.toLowerCase();
     if(key==='q'||key==='й')rotateBy(-Math.PI/4);else if(key==='e'||key==='у')rotateBy(Math.PI/4);else rotateTo(BASE_YAW);
     return;
   }
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
 const oldRender=renderBattle;
 window.addEventListener('keydown',e=>{
   if(e.defaultPrevented||!battle||document.getElementById('tab-battle').classList.contains('hidden'))return;
   if(e.target?.closest?.('input,textarea,select,[contenteditable]'))return;
   const key=e.key.toLowerCase();
   if(key==='q'||key==='й'||key==='e'||key==='у'||key==='r'||key==='к'){
     e.preventDefault();if(key==='q'||key==='й')rotateBy(-Math.PI/4);else if(key==='e'||key==='у')rotateBy(Math.PI/4);else rotateTo(BASE_YAW);
   }
 });
 // Opening the Arena without a selected expedition shows a mission selector.
 window.addEventListener('resize',()=>{cameraReady=false;centerBoard()});
 renderBattle();
})();