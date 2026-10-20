/* Isometric tactical expedition, 16 × 16 cells. No CDN or server. */
(function(){
 'use strict';
 const SIZE=16,W=64,H=35,DEPTH=9,CW=1200,CH=760,OX=CW/2,OY=86;
 const zoomSteps=[0.72,0.85,1,1.18,1.38];let zoomIndex=2;
 const arenaCanvas=document.getElementById('arena');const ctx=arenaCanvas.getContext('2d');
 const scroller=document.getElementById('tactics-board-scroll');
 const boardCache={};let hoverTile=null;let pickedAlly=null;let focusedEnemy=null;let cameraReady=false;let enemyBusy=false;
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
   const number=seeded(x,y,battle.place.id.length);
   const base=battle.place.id==='forest'?[45,69,62]:battle.place.id==='ruins'?[71,75,83]:[57,50,62];
   const delta=Math.round(number*20)-9;
   let [r,g,b]=base.map(v=>v+delta),isDeploy=x<=3,isEnemy=x>=12;
   if(battle.phase==='deploy'){
     if(isDeploy){g+=23;b+=10}
     if(isEnemy){r+=24;g-=12}
   }
   ctx.beginPath();ctx.moveTo(sx-W/2,sy);ctx.lineTo(sx,sy+H/2);ctx.lineTo(sx,sy+H/2+DEPTH);ctx.lineTo(sx-W/2,sy+DEPTH);ctx.closePath();ctx.fillStyle='#171d21';ctx.fill();
   ctx.beginPath();ctx.moveTo(sx,sy+H/2);ctx.lineTo(sx+W/2,sy);ctx.lineTo(sx+W/2,sy+DEPTH);ctx.lineTo(sx,sy+H/2+DEPTH);ctx.closePath();ctx.fillStyle='#0d151b';ctx.fill();
   diamond(sx,sy);ctx.fillStyle=`rgb(${r},${g},${b})`;ctx.fill();
   ctx.lineWidth=.75;ctx.strokeStyle='rgba(214,203,166,.18)';ctx.stroke();
   const n=seeded(x,y,9);
   if(n>.46){ctx.beginPath();ctx.moveTo(sx-11,sy+2);ctx.lineTo(sx-2,sy-1);ctx.lineTo(sx+7,sy+2);ctx.strokeStyle='rgba(13,20,23,.20)';ctx.stroke()}
   if(battle.place.id==='forest'&&n>.58){ctx.strokeStyle='rgba(112,151,104,.4)';ctx.beginPath();ctx.moveTo(sx-4,sy+3);ctx.lineTo(sx-2,sy-3);ctx.moveTo(sx+1,sy+2);ctx.lineTo(sx+4,sy-2);ctx.stroke()}
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
 function token(u,sx,sy){
   const selectedUnit=pickedAlly===u.id||focusedEnemy===u.id;
   const radius=25;
   ctx.save();ctx.translate(sx,sy-26);
   ctx.shadowColor=u.side==='player'?'#54ffd4':'#f67763';ctx.shadowBlur=selectedUnit?24:8;
   ctx.beginPath();ctx.ellipse(0,25,23,9,0,0,Math.PI*2);ctx.fillStyle='#030709b0';ctx.fill();
   ctx.shadowBlur=0;
   const frame=ctx.createLinearGradient(-radius,-radius,radius,radius);frame.addColorStop(0,u.side==='player'?'#a7efcc':'#f1a39b');frame.addColorStop(.5,'#b0915c');frame.addColorStop(1,u.side==='player'?'#22635b':'#703333');
   ctx.beginPath();ctx.arc(0,-7,radius,0,Math.PI*2);ctx.fillStyle=frame;ctx.fill();
   ctx.beginPath();ctx.arc(0,-7,radius-4,0,Math.PI*2);ctx.save();ctx.clip();
   const img=portrait(u.key);
   if(img.complete&&img.naturalWidth){const isPortrait=img.naturalHeight/img.naturalWidth;const h=radius*2.5,w=h/isPortrait;
      ctx.drawImage(img,-w/2,-radius*1.8,w,h);
   }else{ctx.fillStyle='#252734';ctx.fillRect(-radius,-radius-9,radius*2,radius*2);ctx.fillStyle='#d6ba8a';ctx.font='25px Georgia';ctx.textAlign='center';ctx.fillText('☠',0,4)}
   ctx.restore();ctx.strokeStyle='#0a131c';ctx.lineWidth=2;ctx.stroke();
   if(selectedUnit){ctx.strokeStyle='#ffe6a1';ctx.lineWidth=2.5;ctx.beginPath();ctx.arc(0,-7,radius+5,0,Math.PI*2);ctx.stroke()}
   if(battle.phase==='fight'&&u.side==='player'&&u.acted){ctx.fillStyle='#080e18bb';ctx.beginPath();ctx.arc(0,-7,radius-3,0,Math.PI*2);ctx.fill()}
   ctx.restore();healthbar(u,sx,sy);
   ctx.textAlign='center';ctx.font='bold 11px Georgia';ctx.shadowColor='#000';ctx.shadowBlur=3;ctx.fillStyle='#f7e4c0';ctx.fillText(CREATURES[u.key].name.slice(0,18),sx,sy+27);ctx.shadowBlur=0;
 }
 function marker(sx,sy,color){ctx.save();ctx.beginPath();ctx.ellipse(sx,sy,13,6.8,0,0,Math.PI*2);ctx.fillStyle=color;ctx.fill();ctx.strokeStyle='#f4e6ba66';ctx.lineWidth=1;ctx.stroke();ctx.restore()}
 function drawBoard(){
  if(!battle)return;
  ctx.clearRect(0,0,CW,CH);
  const bg=ctx.createRadialGradient(600,320,45,600,380,670);bg.addColorStop(0,'#29323a');bg.addColorStop(.52,'#101922');bg.addColorStop(1,'#080d14');ctx.fillStyle=bg;ctx.fillRect(0,0,CW,CH);
  // Gothic vignette and corner ornament.
  ctx.textAlign='center';ctx.fillStyle='#a88d5b44';ctx.font='12px Georgia';ctx.fillText('⚜  Т А К Т И Ч Е С К О Е   П О Л Е   1 6 × 1 6  ⚜',CW/2,39);
  const ally=selected();const moveMap=battle.phase==='fight'&&ally&&!ally.moved?bfs(ally):null;
  const dots=[];const pendingAttack=[];
  for(let sum=0;sum<=30;sum++)for(let x=0;x<16;x++){
    const y=sum-x;if(!inBounds(x,y))continue;
    const [sx,sy]=project(x,y);relief(x,y,sx,sy);
    const u=unitHere(x,y);
    if(hoverTile&&hoverTile.x===x&&hoverTile.y===y){diamond(sx,sy);ctx.fillStyle='#ffe79d24';ctx.fill();ctx.strokeStyle='#f9d18f';ctx.lineWidth=1.5;ctx.stroke()}
    if(!u&&!isRock(x,y)){
      if(battle.phase==='deploy'&&x<=3){dots.push([sx,sy,'#5bddaa55'])}
      else if(battle.phase==='fight'&&ally&&moveMap&&!ally.moved&&moveMap.get(posKey(x,y))>0&&moveMap.get(posKey(x,y))<=speedOf(ally)){
        dots.push([sx,sy,'#6fcbf988']);
      }
    }
    if(isRock(x,y))rock(sx,sy,x,y);
    if(u)token(u,sx,sy);
    if(ally&&u&&u.side==='enemy'&&battle.phase==='fight'&&!ally.acted&&canHit(ally,u))pendingAttack.push([sx,sy]);
  }
  // Draw hints above tiles, with a small luminous glint.
  for(const [sx,sy,c] of dots)marker(sx,sy,c);
  for(const [sx,sy] of pendingAttack){ctx.strokeStyle='#e77a6acc';ctx.lineWidth=2;ctx.beginPath();ctx.arc(sx,sy-19,33,0,2*Math.PI);ctx.stroke()}
  ctx.strokeStyle='#aa8e5633';ctx.strokeRect(20,20,CW-40,CH-40);
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
   u.x=x;u.y=y;write(CREATURES[u.key].name+' размещён на клетке '+(x+1)+' : '+(y+1)+'.');
   const next=battle.allies.find(a=>a.x===null);pickedAlly=next?next.id:u.id;
 }
 function activeAttack(a,t){
   if(battle.phase!=='fight'||battle.turn!==(a.side==='enemy'?'enemy':'player')||a.acted)return false;
   if(!canHit(a,t)){write('Цель далеко или закрыта скалой. Дальность '+rangeOf(a)+' кл.');return false}
   const power=CREATURES[a.key].atk+(a.side==='player'?((Math.max(1,Number(a.level)||1)-1)+(state.hero.attack||0)+(typeof equipmentAttackBonus==='function'?equipmentAttackBonus():0)):0);
   t.hp-=power;a.acted=true;
   write(CREATURES[a.key].name+' атакует '+CREATURES[t.key].name+' — '+power+' урона.');
   if(t.hp<=0){t.hp=0;t.alive=false;write('☠ '+CREATURES[t.key].name+' погибает.');
     if(t.side==='player'){
       state.units=state.units.filter(c=>c.id!==t.id);state.army=state.army.filter(id=>id!==t.id);write('Копия №'+t.id+' навсегда удалена из коллекции.');
       save();
     }
   }
   if(!allLiving('enemy').length){endExpedition(true);return true}
   if(!allLiving('player').length){endExpedition(false);return true}
   return true;
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
  if(u&&u.side==='player'){pickedAlly=u.id;focusedEnemy=null;renderBattle();return}
  const a=selected();
  if(u&&u.side==='enemy'){
    focusedEnemy=u.id;
    if(a)activeAttack(a,u);
    renderBattle();return;
  }
  if(!a){write('Сначала выбери союзного бойца.');renderBattle();return}
  if(a.moved){write('Этот боец уже перемещался в текущем раунде.');renderBattle();return}
  if(!validFree(x,y,a.id)){write('Нельзя занять эту клетку.');renderBattle();return}
  const distance=bfs(a).get(posKey(x,y));
  if(distance===undefined||distance>speedOf(a)){write('Слишком далеко. Доступно клеток движения: '+speedOf(a)+'.');renderBattle();return}
  a.x=x;a.y=y;a.moved=true;write(CREATURES[a.key].name+' перемещается на '+(x+1)+':'+(y+1)+'.');renderBattle();
 }
 function deploy(){
   if(!battle||battle.phase!=='deploy'||!allPlaced())return;
   battle.phase='fight';battle.turn='player';battle.round=1;
   pickedAlly=battle.allies[0].id;focusedEnemy=null;
   write('⚔ Битва началась. Ход №1 — твой.');renderBattle();
 }
 const wait=ms=>new Promise(resolve=>setTimeout(resolve,ms));
 async function enemyPhase(){
   if(!battle||battle.phase!=='fight'||battle.turn!=='player'||enemyBusy)return;
   enemyBusy=true;battle.turn='enemy';battle.enemies.forEach(u=>{u.acted=false;u.moved=false});write('Враг совершает ход…');renderBattle();
   for(const foe of [...allLiving('enemy')]){
     if(!battle||battle.over)break;
     const targets=allLiving('player');if(!targets.length)break;
     // Choose the closest survivor and move toward attack range using pathfinder.
     targets.sort((a,b)=>md(foe,a)-md(foe,b));
     const t=targets[0];
     if(!canHit(foe,t)){
       const distances=bfs(foe);let choice=null,score=Infinity;
       for(const [key,d] of distances){if(d<1||d>speedOf(foe))continue;const [x,y]=key.split(',').map(Number);
         const candidate={x,y};const s=Math.max(0,md(candidate,t)-rangeOf(foe))*100+md(candidate,t)+d*.05;
         if(s<score){score=s;choice=candidate}
       }
       if(choice){foe.x=choice.x;foe.y=choice.y;write(CREATURES[foe.key].name+' приближается.');renderBattle();await wait(185)}
     }
     const possible=allLiving('player').filter(u=>canHit(foe,u)).sort((a,b)=>a.hp-b.hp);
     if(possible.length){activeAttack(foe,possible[0]);renderBattle();await wait(215)}
   }
   if(battle&&!battle.over){
     if(!allLiving('player').length){endExpedition(false)}
     else{battle.turn='player';battle.round++;
       battle.allies.forEach(u=>{u.moved=false;u.acted=false});
       pickedAlly=allLiving('player')[0]?.id||null;focusedEnemy=null;write('✦ Раунд '+battle.round+'. Твой ход.');renderBattle();}
   }
   enemyBusy=false;
   if(battle)renderBattle();
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
  const unit=focusedEnemy!==null?battle.enemies.find(u=>u.id===focusedEnemy&&u.alive):selected();
  const root=document.getElementById('battle-inspector');
  if(!unit){root.innerHTML='<div class="tactics-mini-title">✦ ВЫБРАННЫЙ БОЕЦ</div><div style="font-size:12px;color:#aaa">Нажми на союзника в отряде или на поле.</div>';return}
  const c=CREATURES[unit.key];
  root.innerHTML=`<div class="tactics-mini-title">${unit.side==='player'?'✦ СОЮЗНЫЙ БОЕЦ':'☠ ВРАГ'}</div><div class="ti-hero"><img src="${CARD_ART[unit.key]}" alt=""><div><b>${c.name}</b><small>⚔ ${c.atk+(unit.side==='player'?(Math.max(1,Number(unit.level)||1)-1)+(state.hero.attack||0)+(typeof equipmentAttackBonus==='function'?equipmentAttackBonus():0):0)} · ♥ ${Math.max(0,unit.hp)} / ${unit.maxHp}</small><small>Дальность ${rangeOf(unit)} · движение ${speedOf(unit)}</small><small>${unit.x===null?'Не размещён':`Клетка ${unit.x+1} : ${unit.y+1}`}</small><div class="ti-hp"><span style="width:${Math.max(0,unit.hp/unit.maxHp)*100}%"></span></div></div></div>`;
 }
 function formation(){
  const el=document.getElementById('tactics-formation');
  if(!battle)return;
  el.innerHTML='<h3>✦ '+(battle.phase==='deploy'?'РАССТАВЬ СВОЙ ОТРЯД': 'БОЙЦЫ ОТРЯДА')+' · '+allLiving('player').length+'/4</h3>'+battle.allies.map(u=>`<button type="button" data-tactics-unit="${u.id}" class="tf-unit ${u.id===pickedAlly?'selected':''} ${u.x!==null?'placed':''} ${u.acted?'acted':''}" ${!u.alive?'disabled':''}><img src="${CARD_ART[u.key]}" alt=""><span>${CREATURES[u.key].name}${u.side==='player'&&u.level>1?' · Ур. '+u.level:''}</span><small>${!u.alive?'☠ погиб':u.x===null?'✚ разместить':battle.phase==='deploy'?'✓ размещён':`♥ ${u.hp} ${u.acted?'· ход сделан':''}`}</small></button>`).join('');
 }
 function battleWelcome(){
  document.getElementById('battle-title').textContent='АРЕНА ПОХОДОВ';
  document.getElementById('battle-sub').textContent='Изометрическое поле 16 × 16 · пошаговая стратегия';
  const status=document.getElementById('battle-status');status.innerHTML='<div class="tactics-welcome" style="width:100%"><h3>Выбери место для похода</h3><p>Размести до четырёх существ на поле, перемещай их по клеткам и побеждай врагов по ходам.</p><div class="tactics-missions">'+PLACES.map(p=>`<button type="button" class="tactics-mission" onclick="startBattle('${p.id}')"><div style="font-size:31px">${p.emoji}</div><b>${p.name}</b><small>✦ ${p.gold} золота · ${p.xp} опыта</small></button>`).join('')+'</div></div>';
  document.querySelector('.tactics-stage').style.display='none';
  document.getElementById('end-turn').disabled=true;
 }
 function renderTactics(){
  if(!battle){battleWelcome();return}
  document.querySelector('.tactics-stage').style.display='grid';
  document.getElementById('battle-title').textContent=battle.place.name.toUpperCase();
  const setup=battle.phase==='deploy',done=battle.phase==='done';
  document.getElementById('battle-sub').textContent='Поле 16 × 16 · '+(setup?'подготовка отряда':done?'поход завершён':`Раунд ${battle.round} · ${battle.turn==='player'?'твой ход':'ход врага'}`);
  document.getElementById('battle-status').textContent=setup?`РАССТАНОВКА · ${battle.allies.filter(u=>u.x!==null).length} из ${battle.allies.length} бойцов размещено. Выбирай в панели справа, затем нажимай на зелёную клетку.`:done?((allLiving('enemy').length===0?'🏆 ПОБЕДА':'☠ ПОРАЖЕНИЕ')+' · Можно вернуться к карте.'): `РАУНД ${battle.round} · Союзники: ${allLiving('player').length} · Противники: ${allLiving('enemy').length} · ${battle.turn==='player'?'Твой ход':'Враг ходит…'}`;
  document.getElementById('tactics-instruction').textContent=setup?'Выбери бойца справа и нажми на свободную клетку в зелёной зоне. Повтори для каждого бойца. Затем нажми «Начать бой».':done?'Поход завершён. Выжившие сохраняются, павшие карты исчезают навсегда.':'Выбери бойца, нажми на синюю клетку для движения, затем на врага в пределах дальности. У каждого бойца одно перемещение и одна атака за раунд.';
  document.getElementById('tactics-auto-deploy').style.display=setup?'':'none';
  document.getElementById('tactics-deploy').style.display=setup?'':'none';
  document.getElementById('tactics-deploy').disabled=!allPlaced();
  document.getElementById('attack').style.display=!setup&&!done?'':'none';
  document.getElementById('heal').style.display=!setup&&!done?'':'none';
  const a=selected();const enemy=battle.enemies.find(u=>u.id===focusedEnemy&&u.alive);
  document.getElementById('attack').disabled=enemyBusy||done||battle.turn!=='player'||!a||a.acted||!enemy||!canHit(a,enemy);
  document.getElementById('heal').disabled=enemyBusy||done||battle.turn!=='player'||!a||a.acted||a.hp>=a.maxHp;
  const end=document.getElementById('end-turn');end.disabled=setup||done||enemyBusy||battle.turn!=='player';end.textContent=setup?'Расставь бойцов':done?'Бой окончен':'Завершить ход →';
  document.getElementById('retreat').textContent=done?'← К карте':setup?'← Отменить поход':'← Отступить';
  document.getElementById('battle-log').innerHTML=battle.log.map(x=>`<div>✦ ${x}</div>`).join('');
  document.getElementById('tactics-cursor').textContent=hoverTile?`Клетка ${hoverTile.x+1} : ${hoverTile.y+1}`:setup?'◈ Зелёные клетки — зона расстановки':done?'✦ Поход окончен':'◈ Синие точки — доступный ход · красные круги — цель';
  inspector();formation();layoutBoard();drawBoard();centerBoard();
 }
 function markNavigation(tab){document.querySelectorAll('.gothic-sidebar [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));}
 const oldShowTab=showTab;
 // startBattle used by all expedition buttons; keep original collection, heroes, gear, maps.
 startBattle=function(placeId){
  if(!state.army.length){alert('Выбери хотя бы одного бойца в четырёх слотах под героем.');showTab('world');if(typeof openWorldArmySlot==='function')openWorldArmySlot(0);return}
  const place=PLACES.find(p=>p.id===placeId)||PLACES[0];
  const allies=state.army.map(id=>byId(id)).filter(Boolean).slice(0,4).map(u=>({id:u.id,key:u.key,side:'player',level:creatureLevel(u),hp:creatureStats(u).hp+(typeof equipmentHealthBonus==='function'?equipmentHealthBonus():0),maxHp:creatureStats(u).hp+(typeof equipmentHealthBonus==='function'?equipmentHealthBonus():0),x:null,y:null,alive:true,moved:false,acted:false}));
  const enemies=place.enemies.map((key,i)=>({id:'e'+i,key,side:'enemy',hp:CREATURES[key].hp,maxHp:CREATURES[key].hp,x:(positions[place.id]||positions.forest)[i][0],y:(positions[place.id]||positions.forest)[i][1],alive:true,moved:false,acted:false}));
  battle={place,allies,enemies,phase:'deploy',round:0,turn:'player',over:false,log:['Поход: '+place.name+'. Размести существ в выделенной зоне.']};
  pickedAlly=allies[0]?.id||null;focusedEnemy=null;hoverTile=null;cameraReady=false;enemyBusy=false;
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
   battle=null;hoverTile=null;pickedAlly=null;focusedEnemy=null;enemyBusy=false;showTab('map');markNavigation('map');
 };
 document.getElementById('attack').onclick=()=>{
  const ally=selected(),enemy=battle?.enemies.find(u=>u.id===focusedEnemy&&u.alive);
  if(ally&&enemy)activeAttack(ally,enemy);renderBattle();
 };
 document.getElementById('heal').onclick=()=>{
  const u=selected();if(!u||u.acted||battle?.phase!=='fight'||battle.turn!=='player')return;
  const healing=Math.min(3,u.maxHp-u.hp);u.hp+=healing;u.acted=true;write('✦ '+CREATURES[u.key].name+' восстанавливает '+healing+' здоровья.');renderBattle();
 };
 document.getElementById('tactics-formation').addEventListener('click',e=>{
   const button=e.target.closest('[data-tactics-unit]');if(!button||!battle||battle.over||enemyBusy)return;
   pickedAlly=Number(button.dataset.tacticsUnit);focusedEnemy=null;renderBattle();
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
 document.getElementById('tactics-zoom-out').onclick=()=>{zoomIndex=Math.max(0,zoomIndex-1);cameraReady=false;layoutBoard();centerBoard()};
 document.getElementById('tactics-zoom-in').onclick=()=>{zoomIndex=Math.min(zoomSteps.length-1,zoomIndex+1);cameraReady=false;layoutBoard();centerBoard()};
 const oldRender=renderBattle;
 // Opening the Arena without a selected expedition shows a mission selector.
 window.addEventListener('resize',()=>{cameraReady=false;centerBoard()});
 renderBattle();
})();
