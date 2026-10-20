/* Isometric tactical expedition, 16 × 16 cells. No CDN or server. */
(function(){
 'use strict';
 const SIZE=16,W=64,H=35,DEPTH=9,CW=1200,CH=760,OX=CW/2,OY=86;
 const zoomSteps=[0.72,0.85,1,1.18,1.38];let zoomIndex=2;
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
 function project(x,y){return [OX+(x-y)*W/2,OY+(x+y)*H/2]}
 function diamond(sx,sy){ctx.beginPath();ctx.moveTo(sx,sy-H/2);ctx.lineTo(sx+W/2,sy);ctx.lineTo(sx,sy+H/2);ctx.lineTo(sx-W/2,sy);ctx.closePath()}
 function relief(x,y,sx,sy){
   const terrain={
     forest:{base:[52,66,58],sideA:'#1f2823',sideB:'#131b17',accent:'rgba(113,156,105,.34)',rune:'rgba(151,210,133,.16)'},
     ruins:{base:[89,87,82],sideA:'#29241f',sideB:'#171411',accent:'rgba(179,148,112,.26)',rune:'rgba(244,212,150,.18)'},
     dragon:{base:[67,58,70],sideA:'#241c28',sideB:'#17111a',accent:'rgba(125,91,162,.28)',rune:'rgba(202,122,255,.18)'}
   }[battle.place.id]||{base:[72,74,80],sideA:'#22272e',sideB:'#141920',accent:'rgba(170,150,118,.22)',rune:'rgba(210,180,120,.14)'};
   const number=seeded(x,y,battle.place.id.length);
   const dust=seeded(x,y,71);
   const delta=Math.round(number*18)-8;
   let [r,g,b]=terrain.base.map(v=>Math.max(10,Math.min(255,v+delta)));
   const isDeploy=x<=3,isEnemy=x>=12;
   if(battle.phase==='deploy'){
     if(isDeploy){g+=18;b+=8}
     if(isEnemy){r+=16;g-=8}
   }
   ctx.beginPath();ctx.moveTo(sx-W/2,sy);ctx.lineTo(sx,sy+H/2);ctx.lineTo(sx,sy+H/2+DEPTH);ctx.lineTo(sx-W/2,sy+DEPTH);ctx.closePath();ctx.fillStyle=terrain.sideA;ctx.fill();
   ctx.beginPath();ctx.moveTo(sx,sy+H/2);ctx.lineTo(sx+W/2,sy);ctx.lineTo(sx+W/2,sy+DEPTH);ctx.lineTo(sx,sy+H/2+DEPTH);ctx.closePath();ctx.fillStyle=terrain.sideB;ctx.fill();
   const topGrad=ctx.createLinearGradient(sx,sy-H/2,sx,sy+H/2);
   topGrad.addColorStop(0,`rgb(${r+10},${g+10},${b+10})`);topGrad.addColorStop(.58,`rgb(${r},${g},${b})`);topGrad.addColorStop(1,`rgb(${Math.max(0,r-14)},${Math.max(0,g-14)},${Math.max(0,b-14)})`);
   diamond(sx,sy);ctx.fillStyle=topGrad;ctx.fill();
   ctx.lineWidth=.8;ctx.strokeStyle='rgba(228,212,175,.15)';ctx.stroke();
   ctx.strokeStyle='rgba(11,16,23,.22)';ctx.lineWidth=1.1;
   ctx.beginPath();
   ctx.moveTo(sx-16,sy+2);ctx.lineTo(sx-7,sy-4);ctx.lineTo(sx+4,sy+1);ctx.lineTo(sx+15,sy-6);ctx.stroke();
   if(dust>.42){ctx.strokeStyle=terrain.accent;ctx.lineWidth=.8;ctx.beginPath();ctx.moveTo(sx-10,sy+7);ctx.lineTo(sx-2,sy+1);ctx.lineTo(sx+8,sy+5);ctx.stroke()}
   if(dust>.68){ctx.fillStyle=terrain.rune;ctx.beginPath();ctx.arc(sx+8,sy-1,3.1,0,Math.PI*2);ctx.fill();ctx.beginPath();ctx.arc(sx-5,sy+4,2.2,0,Math.PI*2);ctx.fill()}
   if(battle.place.id==='dragon'&&dust>.58){ctx.strokeStyle='rgba(230,117,72,.20)';ctx.beginPath();ctx.moveTo(sx-5,sy-7);ctx.lineTo(sx+3,sy-3);ctx.lineTo(sx+9,sy+3);ctx.stroke()}
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
    ?{skyA:'#2a332f',skyB:'#0e1315',mist:'rgba(116,167,118,.08)',title:'Т Л Е Ю Щ И Й   Л Е С'}
    :battle.place.id==='ruins'
      ?{skyA:'#35312d',skyB:'#100e0e',mist:'rgba(192,153,111,.08)',title:'Р У И Н Ы   Н Е К Р О П О Л Я'}
      :{skyA:'#2c2232',skyB:'#0b0811',mist:'rgba(167,117,219,.10)',title:'П А С С А Ж   Д Р А К О Н А'};
  const bg=ctx.createLinearGradient(0,0,0,CH);
  bg.addColorStop(0,scene.skyA);bg.addColorStop(.45,'#131822');bg.addColorStop(1,scene.skyB);ctx.fillStyle=bg;ctx.fillRect(0,0,CW,CH);
  ctx.fillStyle=scene.mist;for(let i=0;i<7;i++){ctx.beginPath();ctx.ellipse(160+i*165,118+i*16,145,34,0,0,Math.PI*2);ctx.fill()}
  ctx.textAlign='center';ctx.fillStyle='#c8a66a55';ctx.font='12px Georgia';ctx.fillText('⚜  '+scene.title+'  ·  П О Л Е   1 6 × 1 6  ⚜',CW/2,39);
  const ally=activePlayer();const moveMap=battle.phase==='fight'&&battle.turn==='player'&&ally&&!ally.moved?bfs(ally):null;
  const tiles=[],actors=[];
  for(let sum=0;sum<=30;sum++)for(let x=0;x<SIZE;x++){
    const y=sum-x;if(!inBounds(x,y))continue;
    const [sx,sy]=project(x,y);relief(x,y,sx,sy);
    const u=unitHere(x,y);
    if(hoverTile&&hoverTile.x===x&&hoverTile.y===y){diamond(sx,sy);ctx.fillStyle='#ffe79d2e';ctx.fill();ctx.strokeStyle='#f9d18f';ctx.lineWidth=2;ctx.stroke()}
    if(!u&&!isRock(x,y)){
      if(battle.phase==='deploy'&&x<=3)tiles.push([sx,sy,'#5bddaa88']);
      else if(battle.phase==='fight'&&ally&&moveMap&&!ally.moved&&moveMap.get(posKey(x,y))>0&&moveMap.get(posKey(x,y))<=speedOf(ally))tiles.push([sx,sy,'#6fcbf9bb']);
    }
    if(isRock(x,y))rock(sx,sy,x,y);
    if(u)actors.push(u);
  }
  for(const [sx,sy,c] of tiles){
    ctx.beginPath();ctx.ellipse(sx,sy,12,6,0,0,Math.PI*2);ctx.shadowColor=c;ctx.shadowBlur=fxEnabled?8:0;ctx.fillStyle=c;ctx.fill();ctx.shadowBlur=0;
  }
  // Draw characters in depth order; this also preserves overlap while a miniature walks.
  actors.sort((a,b)=>a.x+a.y-b.x-b.y || a.x-b.x);
  for(const u of actors){const [sx,sy]=unitPixel(u,t);token(u,sx,sy,t)}
  if(ally&&battle.phase==='fight'&&battle.turn==='player'&&!ally.acted)for(const e of allLiving('enemy'))if(canHit(ally,e)){
    const [sx,sy]=project(e.x,e.y);ctx.strokeStyle='#f48377cc';ctx.lineWidth=2;
    ctx.beginPath();ctx.ellipse(sx,sy,27,11,0,0,Math.PI*2);ctx.stroke();
  }
  if(fxEnabled){
    const shimmer=(Math.sin(t/700)+1)*.5;
    ctx.fillStyle=`rgba(115,84,154,${.08+shimmer*.08})`;ctx.fillRect(22,50,CW-44,3);
    for(let i=0;i<22;i++){const px=(seeded(i,7)*CW+Math.sin(t/2100+i)*18),py=(seeded(i,2)*CH+Math.cos(t/1950+i)*12);ctx.fillStyle=i%2?'#f9d49a55':'#9badcf33';ctx.beginPath();ctx.arc(px,py,1+seeded(i,3)*1.4,0,Math.PI*2);ctx.fill();}
  }
  drawEffects(t);
  ctx.strokeStyle='#aa8e5655';ctx.lineWidth=2;ctx.strokeRect(20,20,CW-40,CH-40);
  ctx.restore();
 }
 function layoutBoard(){
  arenaCanvas.style.width=Math.round(1080*zoomSteps[zoomIndex])+'px';
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
   const dx=(px-OX)/(W/2),dy=(py-OY)/(H/2);
   const x=Math.round((dx+dy)/2),y=Math.round((dy-dx)/2);
   if(!inBounds(x,y))return null;
   const [sx,sy]=project(x,y);
   return Math.abs(px-sx)/(W/2)+Math.abs(py-sy)/(H/2)<=1.1?{x,y}:null;
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
 arenaCanvas.addEventListener('click',e=>{const pos=tileFromEvent(e);if(pos)enterTile(pos.x,pos.y)});
 arenaCanvas.addEventListener('mousemove',e=>{
   if(!battle)return;const tile=tileFromEvent(e);if((tile?.x??-1)===(hoverTile?.x??-1)&&(tile?.y??-1)===(hoverTile?.y??-1))return;
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
 const oldRender=renderBattle;
 // Opening the Arena without a selected expedition shows a mission selector.
 window.addEventListener('resize',()=>{cameraReady=false;centerBoard()});
 renderBattle();
})();