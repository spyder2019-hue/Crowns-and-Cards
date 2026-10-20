/* Card fusion laboratory; free upgrades, unchanged creature art. */
(function(){
 'use strict';
 const MAX_LEVEL=5;
 let selectedKey=null,baseId=null;
 const ownedFor=(key)=>state.units.filter(u=>u.key===key);
 const upgradeCost=(level)=>level+1; // level 1->2 costs 2, then 3, 4, 5
 const materials=(key,id)=>ownedFor(key).filter(u=>u.id!==id&&!state.army.includes(u.id)&&creatureLevel(u)===1);
 function getBase(){return byId(baseId)}
 function chooseKey(key){
   if(!CREATURES[key])return;
   selectedKey=key;
   const arr=ownedFor(key).slice().sort((a,b)=>creatureLevel(b)-creatureLevel(a)||(state.army.includes(b.id)?1:0)-(state.army.includes(a.id)?1:0)||a.id-b.id);
   baseId=arr.length?arr[0].id:null;
   renderLab();
 }
 function showStat(n,label){return '<div><span style="font-size:11px;color:#b5a58b">'+label+'</span><br>'+n+'</div>'}
 function renderLab(){
   const roster=document.getElementById('lab-roster'),workspace=document.getElementById('lab-workspace');
   if(!roster||!workspace)return;
   const keys=Object.keys(CREATURES).filter(k=>ownedFor(k).length);
   if(!keys.length){roster.innerHTML='<div class="lab-empty">Пока нет карт. Открой пак нежити, чтобы получить существ для слияния.</div>';workspace.innerHTML='<div class="lab-empty">Для работы лаборатории необходимы карты существ.</div>';selectedKey=null;baseId=null;return;}
   if(!keys.includes(selectedKey))selectedKey=keys[0];
   if(!ownedFor(selectedKey).some(u=>u.id===baseId)){
     const sorted=ownedFor(selectedKey).slice().sort((a,b)=>creatureLevel(b)-creatureLevel(a)||a.id-b.id);baseId=sorted[0].id;
   }
   roster.innerHTML=keys.map(key=>{
     const copies=ownedFor(key);const best=Math.max(...copies.map(creatureLevel));
     return '<button type="button" class="lab-entry '+(key===selectedKey?'selected':'')+'" data-lab-key="'+key+'" aria-pressed="'+(key===selectedKey)+'"><img src="'+CARD_ART[key]+'" alt=""><span class="lab-entry-body"><strong>'+CREATURES[key].name+'</strong><small>Макс. ур. '+best+'</small></span><span class="lab-entry-copy">×'+copies.length+'</span></button>';
   }).join('');
   const unit=getBase(),c=CREATURES[unit.key],lvl=creatureLevel(unit),stats=creatureStats(unit);
   const needed=upgradeCost(lvl),sacrifices=materials(selectedKey,unit.id),count=sacrifices.length;
   const capped=lvl>=MAX_LEVEL,ready=!capped&&count>=needed;
   const next={atk:stats.atk+1,hp:stats.hp+2};
   const options=ownedFor(selectedKey).slice().sort((a,b)=>creatureLevel(b)-creatureLevel(a)||a.id-b.id).map(u=>'<option value="'+u.id+'" '+(u.id===baseId?'selected':'')+'>№'+u.id+' · уровень '+creatureLevel(u)+(state.army.includes(u.id)?' · в отряде':'')+'</option>').join('');
   workspace.innerHTML='<div class="lab-fusion-layout">'+
    '<div class="lab-card"><div class="lab-card-name">'+c.name+'</div><div class="lab-level">УРОВЕНЬ '+lvl+'</div><div class="lab-card-art"><img src="'+CARD_ART[selectedKey]+'" alt="'+c.name+'"></div><div class="lab-card-rarity">✦ '+c.rarity+' ✦</div><div class="lab-card-stats">'+showStat(stats.atk,'⚔ АТАКА')+showStat(stats.hp,'♥ ЗДОРОВЬЕ')+'</div></div>'+
    '<div class="lab-controls"><div><label for="lab-base-select">Какую копию улучшать</label><select id="lab-base-select" aria-label="Карта для улучшения">'+options+'</select></div>'+
    '<div class="lab-change"><b>УРОВЕНЬ '+lvl+(capped?' · МАКСИМУМ':' → '+(lvl+1))+'</b><div>⚔ Атака: '+stats.atk+(capped?'':' → <span class="lab-next">'+next.atk+'</span>')+'</div><div>♥ Здоровье: '+stats.hp+(capped?'':' → <span class="lab-next">'+next.hp+'</span>')+'</div></div>'+
    (capped?'<div class="lab-requirement">✦ Достигнут максимальный уровень.</div>':'<div class="lab-requirement">Базовые свободные копии: <b>'+count+' / '+needed+'</b><div class="lab-meter"><div class="lab-meter-fill" style="width:'+Math.min(100,count/needed*100)+'%"></div></div></div>')+
    '<button type="button" class="lab-merge" id="lab-merge" '+(!ready?'disabled':'')+'>'+(capped?'МАКСИМАЛЬНЫЙ УРОВЕНЬ':ready?'⚗ СЛИТЬ БЕСПЛАТНО':'НУЖНО ЕЩЁ '+Math.max(0,needed-count)+' КОП.')+'</button>'+
    '<div class="lab-note">После слияния копии-материалы исчезнут. Улучшенная карта останется с тем же обликом и тем же номером.</div></div></div>';
 }
 function fuse(){
   const base=getBase();if(!base||base.key!==selectedKey)return;
   const lvl=creatureLevel(base);if(lvl>=MAX_LEVEL)return;
   // Prevent editing the collection while tactical battle is active.
   if(battle&&!battle.over){alert('Заверши текущий поход, прежде чем объединять карты.');return;}
   const candidates=materials(selectedKey,base.id);
   const cost=upgradeCost(lvl);
   if(candidates.length<cost){renderLab();return;}
   const removed=new Set(candidates.slice(0,cost).map(u=>u.id));
   state.units=state.units.filter(u=>!removed.has(u.id));
   base.level=lvl+1;
   save(); // uses existing save / renderAll hooks
   renderLab();
 }
 document.addEventListener('click',e=>{
   const typeBtn=e.target.closest('[data-lab-key]');if(typeBtn){chooseKey(typeBtn.dataset.labKey);return;}
   if(e.target.closest('#lab-merge'))fuse();
 });
 document.addEventListener('change',e=>{
   if(e.target.id==='lab-base-select'){
     const next=Number(e.target.value);
     if(ownedFor(selectedKey).some(u=>u.id===next)){baseId=next;renderLab();}
   }
 });
 // Each time we enter the Laboratory, rebuild from the saved collection.
 const prevShowTab=showTab;
 showTab=function(tab){prevShowTab(tab);if(tab==='lab')renderLab();};
 const prevRenderAll=renderAll;
 renderAll=function(){prevRenderAll();if(!document.getElementById('tab-lab').classList.contains('hidden'))renderLab();};
 // Restore old-save creatures when switching for the first time.
 state.units.forEach(u=>{if(!Number.isFinite(Number(u.level)))u.level=1;});
 renderLab();
})();
