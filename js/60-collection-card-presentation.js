(function(){
 'use strict';
 const rarities={'Обычная':'common','Редкая':'rare','Эпическая':'epic','Легендарная':'legendary'};
 const labels={melee:'ВОИН',ranged:'СТРЕЛОК',magic:'МАГ'};
 const icons={melee:'⚔',ranged:'➶',magic:'✧'};
 window.packPreviewCard = function(name,img){
  const key=Object.keys(CREATURES).find(k=>CREATURES[k].name===name);
  const c=key ? CREATURES[key] : null;
  const hero=!c && HERO_POOL.find(h=>h.name===name);
  const rarity=c ? c.rarity : 'Легендарная';
  const rarityKey=rarities[rarity]||'legendary';
  const type=c ? labels[c.type] : 'ГЕРОЙ';
  const typeIcon=c ? icons[c.type] : '♛';
  const stats=c ? `<span class="cc-stat cc-attack"><span class="cc-stat-icon">⚔</span><span class="cc-stat-number">${c.atk}</span><span class="cc-stat-title">АТАКА</span></span><span class="cc-stat cc-health"><span class="cc-stat-icon">♥</span><span class="cc-stat-number">${c.hp}</span><span class="cc-stat-title">ЗДОРОВЬЕ</span></span>` : '<span>♛ БЕССМЕРТНЫЙ ГЕРОЙ</span>';
  const foot=c ? 'КАРТА СУЩЕСТВА' : (hero && hero.title ? hero.title : 'ГЕРОЙ ЛИЧЕЙ');
  return `<div class="undead-card rarity-${rarityKey} ${c?'':'pack-collectible-hero'}" role="group" aria-label="Карта: ${name}">
    <span class="cc-inner-border" aria-hidden="true"></span>
    <span class="cc-card-header"><span class="cc-card-name">${name}</span><span class="cc-class-icon" aria-hidden="true">${typeIcon||'✧'}</span></span>
    <span class="cc-art-frame"><span class="cc-art-bg" style="background-image:url('${img}')"></span><img class="cc-card-image" src="${img}" alt="${name}" loading="lazy"><span class="cc-art-fade"></span><span class="cc-type-tag">${type||'СУЩЕСТВО'}</span></span>
    <span class="cc-rarity-line"><span class="cc-rarity-gem">◆</span> ${rarity} <span class="cc-rarity-gem">◆</span></span>
    <span class="cc-stats-row">${stats}</span>
    <span class="cc-card-bottom"><span>${foot}</span><span>✦</span></span>
  </div>`;
 };
 // Initial preview was drawn with obsolete tiles before this patch loaded.
 refreshPackUI();
 const baseRenderPacks=renderPacks;
 renderPacks=function(){
  baseRenderPacks();
  const root=document.getElementById('recent-drops');
  if(root && state.recent && state.recent.length){
   root.innerHTML=state.recent.slice(0,8).map(x=>`<span class="pack-recent-tag">${x.emoji||'✦'} ${x.name||''}</span>`).join('');
  }
 };
 renderPacks();
})();
