/* Future-race bestiaries; existing undead collection remains untouched. */
(function(){
  'use strict';
  const RACES={
    human:{name:'Людской бестиарий',icon:'♜',detail:'Здесь появятся карты людей: рыцари, стражи, маги и герои.'},
    elf:{name:'Бестиарий эльфов',icon:'❧',detail:'Здесь появятся эльфийские лучники, друиды и лесные стражи.'},
    demon:{name:'Бестиарий демонов',icon:'✦',detail:'Здесь появятся демонические воины, колдуны и повелители бездны.'},
    orc:{name:'Бестиарий орков',icon:'⚔',detail:'Здесь появятся орочьи вожди, берсерки и шаманы.'}
  };
  const collection=document.getElementById('tab-collection');
  window.showBestiaryIndex=function(){
    collection.dataset.bestiaryView='index';
  };
  window.openBestiary=function(race){
    if(race==='undead'){
      collection.dataset.bestiaryView='undead';
      renderCollection();
    } else if(RACES[race]){
      const r=RACES[race];
      collection.dataset.bestiaryView='future';
      document.getElementById('bestiary-future').innerHTML='<button type="button" class="bestiary-back" onclick="showBestiaryIndex()">← ВСЕ БЕСТИАРИИ</button><div class="future-sigil">'+r.icon+'</div><h2>'+r.name+'</h2><p>'+r.detail+'</p><p>Бестиарий станет доступен с выходом пака этой расы. Сейчас карт для неё нет.</p>';
    }
  };
  showBestiaryIndex();
  if(typeof CARD_ART!=='undefined' && CARD_ART.lichlord){
    const undead=document.getElementById('bestiary-undead-art');
    if(undead){undead.classList.add('has-art');undead.style.backgroundImage='linear-gradient(to top,#0007,transparent 50%), url("'+CARD_ART.lichlord+'")'}
  }

  // Extend existing pack picker: four planned races may be browsed, but not opened yet.
  const FUTURE_PACKS={
    humans:{title:'ЛЮДСКОЙ ПАК',icon:'♜',description:'Карты людей появятся в будущем обновлении.'},
    elves:{title:'ЭЛЬФИЙСКИЙ ПАК',icon:'❧',description:'Карты эльфов появятся в будущем обновлении.'},
    demons:{title:'ДЕМОНИЧЕСКИЙ ПАК',icon:'✦',description:'Карты демонов появятся в будущем обновлении.'},
    orcs:{title:'ОРЧИЙ ПАК',icon:'⚔',description:'Карты орков появятся в будущем обновлении.'}
  };
  const baseRefresh=refreshPackUI;
  refreshPackUI=function(){
    baseRefresh();
    const buy=document.getElementById('buy-pack');
    const art=document.getElementById('pack-feature-art');
    const future=FUTURE_PACKS[packType];
    buy.disabled=!!future;
    buy.textContent=future?'✧ ПОЯВИТСЯ ПОЗЖЕ':'✧ ОТКРЫТЬ БЕСПЛАТНО';
    art.classList.toggle('future-pack-art',!!future);
    art.dataset.sigil=future?future.icon:'';
    if(!future)return;
    art.style.backgroundImage='none';
    document.getElementById('pack-title').textContent=future.title;
    document.getElementById('pack-description').textContent=future.description;
    document.getElementById('preview-heading').textContent='КАРТЫ СКОРО ПОЯВЯТСЯ';
    document.getElementById('pack-preview-cards').innerHTML='<div class="future-pack-message">Этот пак готовится для будущей расы. Пока открыть его нельзя.</div>';
    document.getElementById('pack-result').innerHTML='';
  };
  document.querySelectorAll('#tab-packs .pack-menu-item').forEach(button=>{
    // Original handlers remain for functional undead and hero packs; future packs also use same refresh.
    button.onclick=()=>{packType=button.dataset.packType;refreshPackUI()};
  });
  const baseOpen=document.getElementById('buy-pack').onclick;
  document.getElementById('buy-pack').onclick=function(event){
    if(FUTURE_PACKS[packType])return;
    return baseOpen.call(this,event);
  };
  refreshPackUI();

  // Map is a live selector for the existing three expedition mechanics.
  window.selectMapRegion=function(id){
    const place=PLACES.find(p=>p.id===id);
    if(!place)return;
    chooseRegion(id);
    document.querySelectorAll('[data-map-region]').forEach(el=>el.classList.toggle('active',el.dataset.mapRegion===id));
    document.getElementById('map-detail').innerHTML='<div class="map-detail-kicker">ЭКСПЕДИЦИЯ</div><h3>'+place.name+'</h3><p>'+place.desc+'</p><div class="map-rewards"><span>✦ '+place.gold+' золота</span><span>✧ '+place.xp+' опыта</span></div>'+(state.won[place.id]?'<p>✓ Уже пройдено</p>':'')+'<p>Павшие существа навсегда исчезают из коллекции.</p><button type="button" onclick="startBattle(\''+place.id+'\')">⚔ НАЧАТЬ ПОХОД</button>';
  };
  selectMapRegion('forest');
  // Always show the bestiary chooser when collection is selected in sidebar.
  const originalShowTab=showTab;
  showTab=function(tab){
    originalShowTab(tab);
    if(tab==='collection')showBestiaryIndex();
    if(tab==='map')selectMapRegion(typeof activeRegion==='string'?activeRegion:'forest');
  };
})();
