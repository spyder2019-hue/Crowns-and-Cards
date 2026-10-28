/* Crowns & Cards v7: minimal two-slot fusion UI, using the established upgrade formulas. */
(function(){
 'use strict';
 let chosenBaseId=null, chosenMaterialIds=[];
 const maxLevel=5;
 const own=()=>Array.isArray(state.units)?state.units:[];
 const base=()=>own().find(x=>x.id===chosenBaseId&&CREATURES[x.key])||null;
 const price=unit=>creatureLevel(unit)+1;
 const canUpgrade=unit=>Boolean(unit&&CREATURES[unit.key]&&creatureLevel(unit)<maxLevel&&freeMaterials(unit).length>=price(unit));
 const freeMaterials=unit=>unit?own().filter(x=>x.id!==unit.id&&x.key===unit.key&&creatureLevel(x)===1&&!state.army.includes(x.id)):[];
 const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
 const colors={'Обычная':'common','Редкая':'rare','Эпическая':'epic','Легендарная':'legendary'};
 const rarityClass=(unit,lvl)=>'cc-quality-'+(colors[CREATURES[unit.key]?.rarity]||'common')+' cc-level-'+(lvl||creatureLevel(unit));
 const picture=unit=>escape(CARD_ART[unit.key]);
 const textStats=(atk,hp)=>'<span class="cc7-stats"><span class="cc7-atk">⚔ <b>'+atk+'</b></span><span class="cc7-hp">♥ <b>'+hp+'</b></span></span>';
 function normalize(){
   const u=base();
   if(!u||!canUpgrade(u)){chosenBaseId=null;chosenMaterialIds=[];return}
   const eligible=new Set(freeMaterials(u).map(m=>m.id));
   chosenMaterialIds=chosenMaterialIds.filter((id,i,list)=>eligible.has(id)&&list.indexOf(id)===i).slice(0,price(u));
 }
 function chooseBase(id){
   const candidate=own().find(u=>u.id===Number(id)&&canUpgrade(u));
   if(!candidate)return false;
   chosenBaseId=candidate.id;chosenMaterialIds=[];return true;
 }
 function toggleMaterial(id){
   normalize();
   const u=base();if(!u)return false;
   const picked=freeMaterials(u).find(x=>x.id===Number(id));
   if(!picked)return false;
   if(chosenMaterialIds.includes(picked.id))chosenMaterialIds=chosenMaterialIds.filter(n=>n!==picked.id);
   else if(chosenMaterialIds.length<price(u))chosenMaterialIds.push(picked.id);
   return true;
 }
 function autoFill(){
   normalize();
   let u=base();
   if(!u){
     const units=own().filter(canUpgrade);
     if(!units.length)return {ok:false,message:'Нет карт, которые можно улучшить.'};
     units.sort((a,b)=>{
       const af=freeMaterials(a).length>=price(a)?1:0;
       const bf=freeMaterials(b).length>=price(b)?1:0;
       return bf-af||creatureLevel(b)-creatureLevel(a)||a.id-b.id;
     });
     u=units[0];chosenBaseId=u.id;
   }
   chosenMaterialIds=freeMaterials(u).slice(0,price(u)).map(x=>x.id);
   const needed=price(u),count=chosenMaterialIds.length;
   return {ok:count===needed,message:count===needed?'Слоты заполнены. Можно выполнить слияние.':'Недостаточно одинаковых свободных карт: '+count+' из '+needed+'.'};
 }
 function canFuse(){
   normalize();const u=base();
   return Boolean(u&&creatureLevel(u)<maxLevel&&chosenMaterialIds.length===price(u));
 }
 function fuse(){
   if(typeof battle!=='undefined'&&battle&&!battle.over)return {ok:false,message:'Заверши бой перед слиянием.'};
   if(!canFuse())return {ok:false,message:'Сначала заполни оба слота нужными копиями.'};
   const u=base(),ids=new Set(chosenMaterialIds);
   const lvl=creatureLevel(u),name=CREATURES[u.key].name;
   // A second validation immediately before consuming materials protects saved units.
   const allowed=new Set(freeMaterials(u).map(m=>m.id));
   if(ids.size!==price(u)||![...ids].every(id=>allowed.has(id)))return {ok:false,message:'Набор карт изменился. Заполни слоты заново.'};
   state.units=own().filter(item=>!ids.has(item.id));
   u.level=lvl+1;
   chosenBaseId=u.id;chosenMaterialIds=[];
   save();
   return {ok:true,message:name+' улучшен до '+(lvl+1)+' уровня: ⚔ '+creatureStats(u).atk+' ♥ '+creatureStats(u).hp};
 }
 function render(){
   normalize();
   const u=base(),level=u?creatureLevel(u):0,need=u?price(u):0;
   const materials=u?freeMaterials(u):[];
   const filled=chosenMaterialIds.length,ready=canFuse();
   const info=u?CREATURES[u.key]:null;
   const current=u?creatureStats(u):null;
   const out=u?{atk:current.atk+1,hp:current.hp+2}:null;
   const left=u?
     '<img src="'+picture(u)+'" alt=""><strong>'+escape(info.name)+'</strong><span class="cc7-level">УР. '+level+'</span>'+textStats(current.atk,current.hp):
     '<span class="cc7-plus">＋</span><strong>Выбрать карту</strong><small>Нажми на слот</small>';
   const material=filled&&u?
     '<img src="'+picture(u)+'" alt=""><strong>Копии карты</strong><span class="cc7-level">'+filled+' / '+need+'</span>'+textStats(info.atk,info.hp):
     '<span class="cc7-plus">＋</span><strong>Материал</strong><small>'+(u?'Нужно копий: '+need:'Сначала выбери карту')+'</small>';
   const preview=u?
      '<img src="'+picture(u)+'" alt=""><strong>'+escape(info.name)+'</strong><span class="cc7-level">УР. '+(level+1)+'</span>'+textStats(out.atk,out.hp):
      '<span class="cc7-result-mark">✦</span><strong>Результат</strong><small>Новая карта</small>';
   const hint=u?('Копии: '+filled+' / '+need+(filled===need?' · Готово к слиянию':materials.length<need?' · Не хватает карт':'')):'Выбери карту или нажми «Автозаполнение».';
   return '<div class="cc7-lab">'+
     '<div class="cc7-equation">'+
       '<div class="cc7-operand"><span class="cc7-caption">ОСНОВНАЯ КАРТА</span><button type="button" class="cc7-card cc7-input '+(u?rarityClass(u):'cc7-empty')+'" data-cmd="lab-slot:base" aria-label="Выбрать карту для улучшения">'+left+'</button></div>'+
       '<span class="cc7-sign" aria-hidden="true">+</span>'+
       '<div class="cc7-operand"><span class="cc7-caption">КОПИИ</span><button type="button" class="cc7-card cc7-input '+(u?rarityClass(u,1):'cc7-empty')+'" data-cmd="lab-slot:material" aria-label="Выбрать копии для слияния">'+material+'</button></div>'+
       '<span class="cc7-sign" aria-hidden="true">=</span>'+
       '<div class="cc7-operand"><span class="cc7-caption">ПОЛУЧИТСЯ</span><div class="cc7-card cc7-result '+(u?rarityClass(u,level+1):'cc7-empty')+(ready?' cc7-ready':'')+'" aria-label="Предварительный результат слияния">'+preview+'</div></div>'+
     '</div>'+
     '<div class="cc7-hint" role="status">'+escape(hint)+'</div>'+
     '<div class="cc7-actions"><button type="button" class="cc7-auto" data-cmd="lab-autofill">✦ АВТОЗАПОЛНЕНИЕ</button><button type="button" class="cc7-merge" data-cmd="lab-fuse" '+(ready?'':'disabled')+'>⚗ СЛИТЬ КАРТЫ</button></div>'+
     '<p class="cc7-note">Для слияния нужны '+(u?need:'несколько')+' свободные копии того же существа 1-го уровня. Карты-материалы расходуются только после подтверждения.</p>'+
   '</div>';
 }
 function chooser(slot){
   normalize();
   const u=base();
   const all=slot==='material'?freeMaterials(u):own().filter(canUpgrade);
   const list=all.slice().sort((a,b)=>slot==='material'?a.id-b.id:creatureLevel(b)-creatureLevel(a)||a.id-b.id);
   const shown=list.slice(0,100);
   const item=u2=>{
     const c=CREATURES[u2.key],s=creatureStats(u2),isSelected=slot==='material'&&chosenMaterialIds.includes(u2.id);
     const label=slot==='material'?(isSelected?'✓ Выбрано':'＋ Добавить'):'Выбрать';
     const id='lab-pick:'+slot+':'+u2.id;
     return '<button type="button" class="cc7-option '+rarityClass(u2)+(isSelected?' cc7-selected':'')+'" data-cmd="'+id+'"><img src="'+picture(u2)+'" alt=""><span><b>'+escape(c.name)+'</b><small>'+escape(c.rarity)+' · Ур. '+creatureLevel(u2)+' · №'+u2.id+'</small>'+textStats(s.atk,s.hp)+'</span><em>'+label+'</em></button>';
   };
   if(slot==='material'&&!u)return {title:'Сначала выбери основную карту',html:'<p>Нажми «Выбрать карту», затем добавь копии того же существа.</p><button class="cc7-auto" type="button" data-cmd="lab-slot:base">＋ Выбрать карту</button>'};
   const title=slot==='material'?'Материалы · '+chosenMaterialIds.length+' / '+price(u):'Выбрать карту';
   const intro=slot==='material'?'Выбери '+price(u)+' свободные копии первого уровня. Карты, находящиеся в отряде, защищены.':'Показаны только карты с достаточным количеством свободных копий для улучшения.';
   return {title,html:'<div class="cc7-chooser"><p>'+intro+'</p><div class="cc7-options">'+(shown.map(item).join('')||'<p>Нет доступных карт для улучшения. Нужны свободные копии того же существа 1-го уровня; карты отряда защищены.</p>')+'</div>'+(list.length>100?'<small>Показаны первые 100 карт.</small>':'')+'<button type="button" class="cc7-auto" data-cmd="lab-done">Готово</button></div>'};
 }
 function clear(){chosenBaseId=null;chosenMaterialIds=[];}
 window.CrownsLab={render,chooser,chooseBase,toggleMaterial,autoFill,canFuse,fuse,clear,get selection(){return {baseId:chosenBaseId,materialIds:chosenMaterialIds.slice()}}};
})();