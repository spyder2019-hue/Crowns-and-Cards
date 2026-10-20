/* World squad slots (uses existing saved army IDs and CARD_ART assets). */
(function(){
  let openSlot = -1;
  function currentUnits(){return (state.army||[]).map(id=>byId(id)).filter(Boolean).slice(0,4)}
  function renderWorldArmy(){
    const container=document.getElementById('world-army-slots');
    if(!container)return;
    const units=currentUnits();
    document.getElementById('world-army-count').textContent=units.length+' / 4';
    container.innerHTML=Array.from({length:4},(_,i)=>{
      const unit=units[i];
      const name=unit?CREATURES[unit.key].name:'Пустой слот';
      const interior=unit?`<img src="${CARD_ART[unit.key]}" alt="${name}">`:'<span class="world-army-plus" aria-hidden="true">＋</span>';
      const sub=unit?'Ур. '+creatureLevel(unit)+' · заменить':'Нажми, чтобы выбрать';
      const ownedCount=unit?state.units.filter(u=>u.key===unit.key).length:0;
      const stackBadge=ownedCount>1?`<span class="world-army-owned-count" title="В коллекции ${ownedCount} копий этого существа" aria-hidden="true">×${ownedCount}</span>`:'';
      return `<button type="button" class="world-army-slot ${unit?'filled':'empty'}" data-world-slot="${i}" aria-label="Слот ${i+1}: ${name}${ownedCount>1?', в коллекции '+ownedCount+' копий':''}. Нажми, чтобы ${unit?'заменить или убрать бойца':'выбрать бойца'}"><span class="world-army-medallion">${interior}${stackBadge}</span><span class="world-army-label">${unit?name:'СЛОТ '+(i+1)}</span><span class="world-army-mini">${sub}</span></button>`;
    }).join('');
    if(openSlot>=0)drawPicker();
  }
  function drawPicker(){
    const picker=document.getElementById('world-army-picker');
    if(openSlot<0){picker.hidden=true;picker.innerHTML='';document.body.classList.remove('world-army-modal-open');return;}
    const selected=currentUnits();
    const at=selected[openSlot];
    // Stack identical cards in the army picker too. Other equipped copies remain unavailable.
    const groups=new Map();
    for(const u of state.units){
      if(!CREATURES[u.key])continue;
      if(state.army.includes(u.id)&&(!at||u.id!==at.id))continue;
      if(!groups.has(u.key))groups.set(u.key,[]);
      groups.get(u.key).push(u);
    }
    const totalCopies=new Map();
    for(const u of state.units)totalCopies.set(u.key,(totalCopies.get(u.key)||0)+1);
    const rarityColors={'Обычная':'common','Редкая':'rare','Эпическая':'epic','Легендарная':'legendary'};
    const typeLabels={melee:'ВОИН',ranged:'СТРЕЛОК',magic:'МАГ'};
    const typeIcons={melee:'⚔',ranged:'➶',magic:'✧'};
    const descriptions={
      boneguard:'Непоколебимый защитник забытых могил.',
      skeletal_archer:'Его стрелы находят цель даже во тьме.',
      gravedigger:'Слышит зов земли и поднимает павших.',
      deathmage:'Повелевает запретными чарами смерти.',
      necromancer:'Каждая битва пополняет его легион.',
      boneconstruct:'Немая мощь из костей погибших.',
      undeadwarrior:'Его клинок не знает усталости.',
      ghoststeed:'Всадник, пришедший из-за грани.',
      lichlord:'Древний властелин нескончаемой ночи.'
    };
    function makeCard(u,isCurrent,copiesTotal,usableCount){
      const c=CREATURES[u.key];
      if(!c)return '';
      const upgraded=creatureStats(u);
      const rarity=rarityColors[c.rarity]||'common';
      const serial=String(u.id).padStart(3,'0');
      const action=isCurrent?'data-remove-world-unit':`data-select-world-unit="${u.id}"`;
      const label=isCurrent?'Убрать из отряда':'Выбрать в отряд';
      return `<button type="button" class="undead-card rarity-${rarity} ${isCurrent?'is-in-army':''}" ${action} aria-label="${c.name}, копий ${copiesTotal}, доступно ${usableCount}, атака ${upgraded.atk}, здоровье ${upgraded.hp}. ${label}">
        <span class="cc-inner-border" aria-hidden="true"></span>
        ${copiesTotal>1?`<span class="cc-stack-count" title="Всего ${copiesTotal} копий в коллекции" aria-hidden="true">×${copiesTotal}</span>`:''}
        <span class="cc-card-header"><span class="cc-card-name">${c.name}</span><span class="cc-class-icon" title="${typeLabels[c.type]}">${typeIcons[c.type]||'✧'}</span></span>
        <span class="cc-art-frame"><span class="cc-art-bg" style="background-image:url('${CARD_ART[u.key]}')"></span><img class="cc-card-image" src="${CARD_ART[u.key]}" alt="" loading="lazy"><span class="cc-art-fade"></span><span class="cc-art-corners" aria-hidden="true"></span><span class="cc-type-tag">${typeLabels[c.type]||'СУЩЕСТВО'}</span></span>
        <span class="cc-rarity-line"><span class="cc-rarity-gem">◆</span> ${c.rarity} · УР. ${creatureLevel(u)} <span class="cc-rarity-gem">◆</span></span>
        <span class="cc-flavor">${descriptions[u.key]||'Воин проклятых земель.'}</span>
        <span class="cc-stats-row"><span class="cc-stat cc-attack"><span class="cc-stat-icon">⚔</span><span class="cc-stat-number">${upgraded.atk}</span><span class="cc-stat-title">АТАКА</span></span><span class="cc-stat cc-health"><span class="cc-stat-icon">♥</span><span class="cc-stat-number">${upgraded.hp}</span><span class="cc-stat-title">ЗДОРОВЬЕ</span></span></span>
        <span class="cc-card-bottom"><span>${copiesTotal>1?'ДОСТУПНО '+usableCount:'№ '+serial}</span><span class="cc-selection ${isCurrent?'chosen':''}">${isCurrent?'− УБРАТЬ':'＋ ВЫБРАТЬ'}</span></span>
      </button>`;
    }
    // One illustrated card per kind; choose the first free instance of that kind.
    const ordered=[...groups.entries()].sort(([a],[b])=>(at&&a===at.key?-1:at&&b===at.key?1:0));
    const cards=ordered.map(([key,copies])=>{
      const isCurrent=Boolean(at&&at.key===key);
      const selectable=copies.filter(u=>!state.army.includes(u.id)).sort((a,b)=>creatureLevel(b)-creatureLevel(a))[0];
      const shown=isCurrent?at:selectable;
      if(!shown)return '';
      return makeCard(shown,isCurrent,totalCopies.get(key)||copies.length,copies.length-(isCurrent?1:0));
    }).join('');
    const intro=at?'Выбери новую карту, чтобы заменить бойца, или нажми на карту текущего бойца, чтобы убрать его.':'Выбери карту существа для пустого слота.';
    picker.innerHTML=`<div class="world-army-dialog" role="dialog" aria-modal="true" aria-label="Выбор карты бойца">
      <div class="world-army-picker-top"><div><span class="world-army-dialog-kicker">✦ КОЛОДА НЕЖИТИ ✦</span><strong>СЛОТ ${openSlot+1} · ${at?'ЗАМЕНА КАРТЫ':'ВЫБОР КАРТЫ'}</strong><p>${intro}</p></div><button type="button" class="world-army-picker-close" data-close-world-picker aria-label="Закрыть выбор">✕</button></div>
      <div class="world-army-choices">${cards||'<div class="world-army-empty-note">Нет доступных карт. Открой пак во вкладке «Паки».</div>'}</div>
    </div>`;
    picker.hidden=false;
    document.body.classList.add('world-army-modal-open');
    const close=picker.querySelector('[data-close-world-picker]');
    if(close)close.focus({preventScroll:true});
  }
  function openWorldArmySlot(i){
    if(!Number.isInteger(i)||i<0||i>3)return;
    openSlot=i;drawPicker();
  }
  window.openWorldArmySlot=openWorldArmySlot;
  function equipUnit(id){
    const unit=byId(id);
    if(!unit||openSlot<0||openSlot>3)return;
    const current=currentUnits().map(u=>u.id);
    if(current.includes(id))return;
    if(openSlot>=current.length){
      if(current.length===4)return;
      current.push(id);
    }else{
      current[openSlot]=id;
    }
    state.army=current;
    openSlot=-1;drawPicker();
    save();
  }
  function removeFromSlot(){
    const current=currentUnits().map(u=>u.id);
    if(openSlot<0||openSlot>=current.length)return;
    current.splice(openSlot,1);
    state.army=current;
    openSlot=-1;drawPicker();
    save();
  }
  document.addEventListener('click',function(e){
    const slot=e.target.closest('[data-world-slot]');
    if(slot){openWorldArmySlot(Number(slot.dataset.worldSlot));return;}
    const choice=e.target.closest('[data-select-world-unit]');
    if(choice){equipUnit(Number(choice.dataset.selectWorldUnit));return;}
    if(e.target.closest('[data-remove-world-unit]')){removeFromSlot();return;}
    if(e.target.closest('[data-close-world-picker]')){openSlot=-1;drawPicker();return;}
    if(e.target.id==='world-army-picker'){openSlot=-1;drawPicker();return;}
  });
  document.addEventListener('keydown',function(e){if(e.key==='Escape'&&openSlot>=0){openSlot=-1;drawPicker();}});
  const originalRenderAllWorldArmy=renderAll;
  renderAll=function(){originalRenderAllWorldArmy();renderWorldArmy();};
  renderWorldArmy();
})();
