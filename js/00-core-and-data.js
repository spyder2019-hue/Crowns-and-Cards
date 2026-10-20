const CREATURES={boneguard:{name:'Костяной страж',emoji:'💀',type:'melee',hp:12,atk:3,rarity:'Обычная'},skeletal_archer:{name:'Скелет-лучник',emoji:'💀',type:'ranged',hp:7,atk:4,rarity:'Обычная'},gravedigger:{name:'Могильщик',emoji:'💀',type:'melee',hp:10,atk:3,rarity:'Обычная'},deathmage:{name:'Маг смерти',emoji:'💀',type:'magic',hp:8,atk:6,rarity:'Редкая'},necromancer:{name:'Некромант',emoji:'💀',type:'magic',hp:11,atk:6,rarity:'Эпическая'},boneconstruct:{name:'Костяной голем',emoji:'💀',type:'melee',hp:19,atk:4,rarity:'Редкая'},undeadwarrior:{name:'Мёртвый воин',emoji:'💀',type:'melee',hp:14,atk:5,rarity:'Редкая'},ghoststeed:{name:'Призрачный всадник',emoji:'💀',type:'magic',hp:12,atk:7,rarity:'Эпическая'},lichlord:{name:'Король-лич',emoji:'💀',type:'magic',hp:25,atk:9,rarity:'Легендарная'}};
const CARD_ART={"boneguard":"assets/creatures/boneguard.webp","skeletal_archer":"assets/creatures/skeletal-archer.webp","gravedigger":"assets/creatures/gravedigger.webp","deathmage":"assets/creatures/deathmage.webp","necromancer":"assets/creatures/necromancer.webp","boneconstruct":"assets/creatures/boneconstruct.webp","undeadwarrior":"assets/creatures/undeadwarrior.webp","ghoststeed":"assets/creatures/ghoststeed.webp","lichlord":"assets/creatures/lichlord.webp"};
const PLACES=[{id:'forest',name:'Заброшенные земли',emoji:'🌲',desc:'Лёгкая вылазка · нежить',enemies:['boneguard','skeletal_archer','gravedigger'],gold:100,xp:40},{id:'ruins',name:'Проклятый лес',emoji:'🏚️',desc:'Средняя опасность · проклятые',enemies:['undeadwarrior','deathmage','boneconstruct'],gold:180,xp:70},{id:'dragon',name:'Некрополь',emoji:'☠',desc:'Босс · владыка нежити',enemies:['necromancer','ghoststeed','lichlord'],gold:350,xp:150}];
const fresh=()=>({gold:500,xp:0,level:1,nextId:6,units:[{id:1,key:'boneguard'},{id:2,key:'skeletal_archer'},{id:3,key:'gravedigger'},{id:4,key:'deathmage'},{id:5,key:'undeadwarrior'}],quest:false,won:{},recent:[],hero:{name:'Арден',title:'Странствующий капитан',attack:0,points:0}});
let state;try{state=JSON.parse(localStorage.getItem('cc-save'))||fresh()}catch(e){state=fresh()}state.army=Array.isArray(state.army)?state.army:state.units.slice(0,4).map(u=>u.id);const legacyKeys={skeleton:'boneguard',archer:'skeletal_archer',knight:'undeadwarrior',mage:'deathmage',wolf:'gravedigger',orc:'boneconstruct',golem:'boneconstruct',dragon:'lichlord',ghost:'ghoststeed',goblin:'gravedigger'};state.units=state.units.map(u=>({...u,key:CREATURES[u.key]?u.key:(legacyKeys[u.key]||'boneguard')}));state.recent=(state.recent||[]).filter(x=>x&&x.name);let battle=null,filter='all',selectedUnit=null,selectedEnemy=null;

// Permanent creature levels. Old saves without level keep level 1.
function creatureLevel(unit){return Math.max(1,Math.min(5,Number(unit&&unit.level)||1));}
function creatureStats(unit){const c=CREATURES[unit.key],bonus=creatureLevel(unit)-1;return {atk:c.atk+bonus,hp:c.hp+bonus*2};}

function save(){localStorage.setItem('cc-save',JSON.stringify(state));renderAll()}function uid(){return state.nextId++}function addUnit(key){state.units.push({id:uid(),key})}function count(key){return state.units.filter(u=>u.key===key).length}function byId(id){return state.units.find(u=>u.id===id)}function typeName(t){return ({melee:'Ближний бой',ranged:'Стрелок',magic:'Магия'})[t]}
function renderHeader(){document.getElementById('gold').textContent=state.gold;document.getElementById('level').textContent=state.level;document.getElementById('total').textContent=state.units.length}
function renderHero(){document.getElementById('world-hero-name').textContent=state.hero.name;document.getElementById('world-hero-level').textContent='Уровень '+state.level;let xpNeed=state.level*100, pct=Math.min(100,state.xp/xpNeed*100);let html=`<div class="hero"><div class="portrait">👑</div><div style="flex:1"><h3>${state.hero.name}</h3><div class="muted">${state.hero.title} · Уровень ${state.level}</div><div class="bar"><span style="width:${pct}%"></span></div><small>${state.xp} / ${xpNeed} опыта</small></div></div><p>Бонус героя: <b>+${state.hero.attack||0} к атаке</b> каждому союзнику.</p>`;document.getElementById('hero-summary').innerHTML=html;document.getElementById('skill-badge').textContent=state.hero.points?' · Очки: '+state.hero.points:'';document.getElementById('upgrade-status').textContent='Бонус атаки: +'+(state.hero.attack||0)+' · Свободных очков: '+(state.hero.points||0);document.getElementById('upgrade-attack').disabled=!(state.hero.points>0);document.getElementById('army-summary').innerHTML=state.army.length?state.army.map(id=>byId(id)).filter(Boolean).map(u=>`<span class="army-chip">${CREATURES[u.key].name} #${u.id}</span>`).join(''):'<span class="muted">Отряд пуст. Добавь существ в слоты под героем.</span>';document.getElementById('quest-status').textContent=state.quest?'Задание выполнено.':'Забери стартовые припасы: скелет, лучник и 100 золота.';document.getElementById('claim-quest').disabled=state.quest}
let activeRegion='forest';
(function(){const group=document.getElementById('atlas-trees');if(!group)return;let seed=41;function rand(){seed=(seed*16807)%2147483647;return seed/2147483647}let markup='';for(let i=0;i<330;i++){const x=rand()*900,y=rand()*650;if((x>640&&x<810)||(x>360&&x<610&&y>180&&y<335))continue;const r=3+rand()*8;markup+=`<path d="M${x} ${y-r}l${r*.8} ${r*1.6}h-${r*1.6}z" fill="${rand()>.5?'#142b27':'#20392f'}" opacity="${.35+rand()*.5}"/>`}group.innerHTML=markup})();
function chooseRegion(id){activeRegion=id;renderPlaces()}
function renderPlaces(){const p=PLACES.find(x=>x.id===activeRegion)||PLACES[0];document.querySelectorAll('[data-region]').forEach(el=>el.classList.toggle('selected',el.dataset.region===activeRegion));const details=document.getElementById('region-details');details.innerHTML=`<div class="side-kicker">РАЗВЕДКА МЕСТНОСТИ</div><div class="region-engraving ${p.id}">${p.id==='forest'?'♠':p.id==='ruins'?'♜':'♛'}</div><h2>${p.name}</h2><p>${p.desc}</p><div class="region-rule"></div><div class="region-stats"><div><small>НАГРАДА</small><strong>${p.gold} золота</strong></div><div><small>ОПЫТ ГЕРОЯ</small><strong>${p.xp} ед.</strong></div></div>${state.won[p.id]?'<div class="region-cleared">✧ Победа уже одержана</div>':''}<button class="march-btn" onclick="startBattle('${p.id}')" ${!state.units.length?'disabled':''}>⚔ &nbsp; Начать поход <span>→</span></button><small class="risk-note">Павшие существа будут потеряны навсегда.</small>`}
function renderCollection(){
  const count=document.getElementById('collection-count');
  const groups=new Map();
  for(const u of state.units){
    if(!CREATURES[u.key]) continue;
    if(!groups.has(u.key)) groups.set(u.key,[]);
    groups.get(u.key).push(u);
  }
  count.textContent=state.units.length+' карт · '+groups.size+' видов';
  const list=[...groups.entries()].filter(([key])=>filter==='all'||key===filter||CREATURES[key].type===filter);
  const rarityColors={'Обычная':'common','Редкая':'rare','Эпическая':'epic','Легендарная':'legendary'};
  const typeLabels={melee:'ВОИН',ranged:'СТРЕЛОК',magic:'МАГ'};
  const typeIcons={melee:'⚔',ranged:'➶',magic:'✧'};
  const flavor={
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
  document.getElementById('collection-cards').innerHTML=list.length?list.map(([key,copies])=>{
    const c=CREATURES[key];
    const best=copies.reduce((a,b)=>creatureLevel(a)>=creatureLevel(b)?a:b);
    const bestStats=creatureStats(best);
    const selected=copies.filter(u=>state.army.includes(u.id)).length;
    const remaining=copies.length-selected;
    const active=selected>0;
    const rarity=rarityColors[c.rarity]||'common';
    const serial=String(copies[0].id).padStart(3,'0');
    const selection=remaining===0?'− УБРАТЬ 1':selected?'＋ В ОТРЯД ('+selected+')':'＋ В ОТРЯД';
    const action=remaining?'Добавить одну копию в отряд':'Убрать одну копию из отряда';
    return `<button type="button" class="undead-card collection-stack-card rarity-${rarity} ${active?'is-in-army':''}" onclick="toggleCollectionStack('${key}')" aria-pressed="${active}" aria-label="${c.name}, копий ${copies.length}, в отряде ${selected}. ${action}">
      <span class="cc-inner-border" aria-hidden="true"></span>
      ${copies.length>1?`<span class="cc-stack-count" aria-hidden="true">×${copies.length}</span>`:''}
      <span class="cc-card-header"><span class="cc-card-name">${c.name}</span><span class="cc-class-icon" title="${typeLabels[c.type]}">${typeIcons[c.type]||'✧'}</span></span>
      <span class="cc-art-frame"><span class="cc-art-bg" style="background-image:url('${CARD_ART[key]}')"></span><img class="cc-card-image" src="${CARD_ART[key]}" alt="" loading="lazy"><span class="cc-art-fade"></span><span class="cc-art-corners" aria-hidden="true"></span><span class="cc-type-tag">${typeLabels[c.type]||'СУЩЕСТВО'}</span></span>
      <span class="cc-rarity-line"><span class="cc-rarity-gem">◆</span> ${c.rarity} <span class="cc-rarity-gem">◆</span></span>
      <span class="cc-flavor">${creatureLevel(best)>1?`✦ ЛУЧШАЯ КАРТА · УР. ${creatureLevel(best)}<br>`:''}${flavor[key]||'Воин проклятых земель.'}</span>
      <span class="cc-stats-row"><span class="cc-stat cc-attack"><span class="cc-stat-icon">⚔</span><span class="cc-stat-number">${bestStats.atk}</span><span class="cc-stat-title">АТАКА</span></span><span class="cc-stat cc-health"><span class="cc-stat-icon">♥</span><span class="cc-stat-number">${bestStats.hp}</span><span class="cc-stat-title">ЗДОРОВЬЕ</span></span></span>
      <span class="cc-card-bottom"><span>${copies.length===1?'№ '+serial:selected+' / '+copies.length+' В ОТРЯДЕ'}</span><span class="cc-selection ${active?'chosen':''}">${selection}</span></span>
    </button>`;
  }).join(''):'<div class="collection-empty"><div class="collection-empty-sigil">✧</div><strong>Коллекция пуста</strong><p>Открой пак существ, чтобы получить первые карты нежити.</p><button type="button" onclick="showTab(&quot;packs&quot;)">ОТКРЫТЬ ПАКИ →</button></div>';
}
window.toggleCollectionStack=function(key){
  const copies=state.units.filter(u=>u.key===key);
  if(!copies.length) return;
  const available=copies.filter(u=>!state.army.includes(u.id)).sort((a,b)=>creatureLevel(b)-creatureLevel(a))[0];
  if(available){
    if(state.army.length>=4){alert('В отряде может быть не больше 4 существ.');return;}
    state.army.push(available.id);
  }else{
    // Every copy is equipped: clicking the stack removes one individual copy.
    const equipped=copies.find(u=>state.army.includes(u.id));
    if(equipped) state.army=state.army.filter(id=>id!==equipped.id);
  }
  save();
};
function renderArmy(){const selected=state.army.map(id=>byId(id)).filter(Boolean);document.getElementById('army-count').textContent=selected.length+' / 4';document.getElementById('army-equipped').innerHTML=Array.from({length:4},(_,i)=>{const u=selected[i];return u?`<button class="army-slot filled" onclick="toggleArmy(${u.id})"><img src="${CARD_ART[u.key]}" alt=""><b>${CREATURES[u.key].name}</b><small>№${u.id} · убрать</small></button>`:`<div class="army-slot">Слот ${i+1}<small>Пусто</small></div>`}).join('');document.getElementById('army-pool').innerHTML=state.units.length?state.units.map(u=>{const c=CREATURES[u.key],on=state.army.includes(u.id);return `<button class="army-choice ${on?'chosen':''}" onclick="toggleArmy(${u.id})"><img src="${CARD_ART[u.key]}" alt=""><b>${c.name}</b><small>№${u.id} · ${c.rarity}</small><small>${on?'✓ В отряде':'＋ Добавить'}</small></button>`}).join(''):'<div class="empty">В коллекции нет карт. Открой пак.</div>'}
window.toggleArmy=function(id){if(state.army.includes(id))state.army=state.army.filter(x=>x!==id);else if(state.army.length>=4){alert('В отряде может быть не больше 4 существ.');return}else if(byId(id))state.army.push(id);save()};
function renderPacks(){document.getElementById('recent-drops').innerHTML=state.recent.length?state.recent.map(x=>`${x.emoji} ${x.name}`).join('<br>'):'Пока ничего не найдено.'}
function renderAll(){state.army=state.army.filter(id=>state.units.some(u=>u.id===id)).slice(0,4);renderHeader();renderHero();renderPlaces();renderCollection();renderPacks();renderArmy()}
function showTab(tab){document.querySelectorAll('main>section').forEach(s=>s.classList.add('hidden'));document.getElementById('tab-'+tab).classList.remove('hidden');document.querySelectorAll('.nav button').forEach(b=>b.classList.toggle('active',b.dataset.tab===tab));if(tab==='battle')renderBattle()}
document.querySelectorAll('.nav button').forEach(b=>b.onclick=()=>showTab(b.dataset.tab));document.querySelectorAll('[data-filter]').forEach(b=>b.onclick=()=>{filter=b.dataset.filter;document.querySelectorAll('[data-filter]').forEach(x=>x.classList.toggle('active',x===b));renderCollection()});
document.getElementById('claim-quest').onclick=()=>{if(state.quest)return;state.quest=true;addUnit('boneguard');addUnit('skeletal_archer');state.gold+=100;save()};document.getElementById('buy-pack').onclick=()=>{let pool=Object.keys(CREATURES);let drops=[];for(let i=0;i<3;i++){let key=pool[Math.floor(Math.random()*pool.length)];addUnit(key);drops.push(CREATURES[key]);state.recent.unshift(CREATURES[key])}state.recent=state.recent.slice(0,12);document.getElementById('pack-result').innerHTML='<div class="notice">Пак открыт! Новые карты:</div><div class="cards">'+drops.map(c=>`<div class="unit"><img class="pack-art" src="${CARD_ART[Object.keys(CREATURES).find(k=>CREATURES[k]===c)]}" alt=""><strong>${c.name}</strong><span class="type">${c.rarity}</span></div>`).join('')+'</div>';save()};
document.getElementById('reset').onclick=()=>{if(confirm('Удалить весь прогресс и начать заново?')){state=fresh();battle=null;save();showTab('world')}};
window.upgradeHero=function(){if(!(state.hero.points>0))return;state.hero.points--;state.hero.attack=(state.hero.attack||0)+1;save()};
function startBattle(placeId){if(!state.army.length){alert('Сначала выбери хотя бы одного бойца в четырёх слотах под героем.');showTab('world');openWorldArmySlot(0);return}let p=PLACES.find(x=>x.id===placeId);let allies=state.army.map(id=>byId(id)).filter(Boolean).slice(0,4).map((u,i)=>({id:u.id,key:u.key,side:'player',hp:CREATURES[u.key].hp+(typeof equipmentHealthBonus==='function'?equipmentHealthBonus():0),slot:[8,9,4,5][i],alive:true}));let enemies=p.enemies.map((key,i)=>({id:'e'+i,key,side:'enemy',hp:CREATURES[key].hp,slot:i,alive:true}));battle={place:p,allies,enemies,turn:'player',log:[`Ты вошёл в локацию: ${p.name}.`],over:false};selectedUnit=null;selectedEnemy=null;showTab('battle');renderBattle()}
function alive(side){return battle[side==='player'?'allies':'enemies'].filter(u=>u.alive)}function unitAt(slot){return [...battle.allies,...battle.enemies].find(u=>u.alive&&u.slot===slot)}function log(msg){battle.log.unshift(msg);battle.log=battle.log.slice(0,30)}function damage(attacker,target){let base=CREATURES[attacker.key].atk+(attacker.side==='player'?((state.hero.attack||0)+(typeof equipmentAttackBonus==='function'?equipmentAttackBonus():0)):0);target.hp-=base;log(`${CREATURES[attacker.key].name} наносит ${base} урона: ${CREATURES[target.key].name}.`);if(target.hp<=0){target.alive=false;log(`☠ ${CREATURES[target.key].name} погибает.`);if(target.side==='player'){state.units=state.units.filter(u=>u.id!==target.id);log(`Копия #${target.id} удалена из коллекции.`)}}}
function renderBattle(){if(!battle)return;document.getElementById('battle-title').textContent=battle.place.name;document.getElementById('battle-sub').textContent=`Ход: ${battle.turn==='player'?'твой':'врага'} · Союзники ${alive('player').length} · Враги ${alive('enemy').length}`;document.getElementById('arena').innerHTML=Array.from({length:12},(_,slot)=>{let u=unitAt(slot);if(!u)return `<div class="tile" onclick="selectSlot(${slot})"><small>·</small></div>`;let c=CREATURES[u.key],sel=(selectedUnit===u.id||selectedEnemy===u.id);return `<div class="tile ${u.side} ${sel?'selected':''}" onclick="selectSlot(${slot})"><img class="battle-art" src="${CARD_ART[u.key]}" alt=""><small>${c.name}</small><small>❤️ ${Math.max(0,u.hp)}</small></div>`}).join('');document.getElementById('battle-log').innerHTML=battle.log.map(x=>`<div>• ${x}</div>`).join('');document.getElementById('attack').disabled=battle.over||battle.turn!=='player'||selectedUnit===null||selectedEnemy===null;document.getElementById('end-turn').disabled=battle.over||battle.turn!=='player';document.getElementById('heal').disabled=battle.over||battle.turn!=='player'||selectedUnit===null}
window.selectSlot=function(slot){if(!battle||battle.over||battle.turn!=='player')return;let u=unitAt(slot);if(!u)return;if(u.side==='player'){selectedUnit=u.id;selectedEnemy=null}else if(selectedUnit!==null){selectedEnemy=u.id}else{selectedEnemy=u.id}renderBattle()};
document.getElementById('attack').onclick=()=>{if(!battle||battle.over)return;let a=battle.allies.find(u=>u.id===selectedUnit&&u.alive),t=battle.enemies.find(u=>u.id===selectedEnemy&&u.alive);if(!a||!t)return;damage(a,t);selectedEnemy=null;selectedUnit=null;if(!alive('enemy').length){finishBattle(true);return}renderBattle()};document.getElementById('heal').onclick=()=>{let a=battle?.allies.find(u=>u.id===selectedUnit&&u.alive);if(!a)return;a.hp=Math.min(CREATURES[a.key].hp,a.hp+3);log(`${CREATURES[a.key].name} восстанавливает 3 здоровья.`);selectedUnit=null;renderBattle()};document.getElementById('end-turn').onclick=enemyTurn;function enemyTurn(){if(!battle||battle.over)return;battle.turn='enemy';for(let e of alive('enemy')){let targets=alive('player');if(!targets.length)break;let t=targets[Math.floor(Math.random()*targets.length)];damage(e,t)}if(!alive('player').length){finishBattle(false);return}battle.turn='player';selectedUnit=null;selectedEnemy=null;log('Твой ход. Выбери бойца и цель.');renderBattle()}
function finishBattle(win){if(!battle)return;battle.over=true;if(win){state.gold+=battle.place.gold;state.xp+=battle.place.xp;state.won[battle.place.id]=true;log(`Победа! Получено ${battle.place.gold} золота и ${battle.place.xp} опыта.`);if(battle.place.id==='dragon'&&Math.random()<.75){addUnit('lichlord');state.recent.unshift(CREATURES.dragon);log('Награда босса: карта Дракона!')}while(state.xp>=state.level*100){state.xp-=state.level*100;state.level++;state.hero.points=(state.hero.points||0)+1;log(`⭐ Арден достиг ${state.level} уровня! Доступно очко развития.`)}}else log('Поражение. Выжившие сохраняются, погибшие копии потеряны.');log('Сражение завершено.');document.getElementById('end-turn').disabled=true;document.getElementById('attack').disabled=true;document.getElementById('heal').disabled=true;document.getElementById('battle-sub').textContent=win?'Победа! Награды получены.':'Поражение. Армия понесла потери.';document.getElementById('retreat').textContent='Вернуться в мир';save();renderBattle()}
document.getElementById('retreat').onclick=()=>{if(battle&&!battle.over&&confirm('Отступить? Это считается поражением; погибшие существа теряются.')){for(let a of alive('player')){a.alive=false;state.units=state.units.filter(u=>u.id!==a.id)}finishBattle(false)}battle=null;document.getElementById('retreat').textContent='Отступить';showTab('world');save()};
/* World layout is now CSS grid; do not relocate its panels in JavaScript. */if(!state.hero)state.hero={name:'Арден',title:'Странствующий капитан'};state.hero.points??=0;state.hero.attack??=0;renderAll();

const HERO_ART='assets/heroes/hero-art.jpg';
const HERO_POOL=[{id:'nerkaz',name:'Нерказ',title:'Огненный лич',skill:'Владычество над пламенем',attack:2},{id:'ksarvel',name:'Ксар’Вел',title:'Лич Пустоты',skill:'Проклятие',attack:1},{id:'malrak',name:'Малрак',title:'Лич Чумы',skill:'Чумная аура',attack:1}];
let packType='units';
// Migrate the original starter character to the approved fire lich artwork and identity.
if(state.hero && ((state.hero.name==='Арден' && !state.hero.id) || (state.hero.name==='Нерказ' && !state.hero.id))){
  state.hero={...state.hero,id:'nerkaz',name:'Нерказ',title:'Огненный лич',skill:'Владычество над пламенем'};
}
state.heroes=Array.isArray(state.heroes)?state.heroes:[];
state.heroes=state.heroes.map(h=>h.id==='nerkaz'?{...h,name:'Нерказ',title:'Огненный лич',skill:'Владычество над пламенем'}:h);

const NERKAZ_FIRE_ART='assets/heroes/nerkaz-fire-lich.webp';
function heroPicture(id){return (id==='nerkaz'||id==='Nerkaz')?NERKAZ_FIRE_ART:HERO_ART}
function packPreviewCard(name,img){return `<div class="preview-card"><img src="${img}" alt=""><strong>${name}</strong></div>`}
function refreshPackUI(){
 const isHero=packType==='heroes';
 document.querySelectorAll('.pack-menu-item').forEach(b=>b.classList.toggle('selected',b.dataset.packType===packType));
 document.getElementById('pack-title').textContent=isHero?'ПАК ГЕРОЕВ':'ПАК НЕЖИТИ';
 document.getElementById('pack-description').textContent=isHero?'Один постоянный герой. Повторы не исчезают.':'Три случайных существа для армии.';
 document.getElementById('pack-feature-art').style.backgroundImage=`url("${isHero?HERO_ART:CARD_ART.lichlord}")`;
 document.getElementById('preview-heading').textContent=isHero?'ЛИЧИ И ПОЛКОВОДЦЫ':'ВОЗМОЖНЫЕ СУЩЕСТВА';
 document.getElementById('pack-preview-cards').innerHTML=isHero?HERO_POOL.map(h=>packPreviewCard(h.name,heroPicture(h.id))).join(''):['boneguard','skeletal_archer','ghoststeed','lichlord'].map(k=>packPreviewCard(CREATURES[k].name,CARD_ART[k])).join('');
 document.getElementById('pack-result').innerHTML='';
}
document.querySelectorAll('.pack-menu-item').forEach(b=>b.onclick=()=>{packType=b.dataset.packType;refreshPackUI()});
document.getElementById('buy-pack').onclick=()=>{
 if(packType==='heroes'){
   const available=HERO_POOL.filter(h=>h.id!==state.hero.id&&!state.heroes.some(x=>x.id===h.id));
   const h=(available.length?available:HERO_POOL)[Math.floor(Math.random()*(available.length||HERO_POOL.length))];
   if(h.id!==state.hero.id&&!state.heroes.some(x=>x.id===h.id))state.heroes.push({...h,level:1,xp:0});
   state.recent.unshift({emoji:'♛',name:h.name});
   state.recent=state.recent.slice(0,8);save();
   document.getElementById('pack-result').innerHTML=packPreviewCard(h.name,heroPicture(h.id));
 }else{
   const keys=Object.keys(CREATURES),draw=[];
   for(let i=0;i<3;i++){const k=keys[Math.floor(Math.random()*keys.length)];addUnit(k);draw.push(k);state.recent.unshift({emoji:'☠',name:CREATURES[k].name})}
   state.recent=state.recent.slice(0,8);save();
   document.getElementById('pack-result').innerHTML=draw.map(k=>packPreviewCard(CREATURES[k].name,CARD_ART[k])).join('');
 }
};
// Persistent hero collection shown in the collection tab, not mixed with expendable units.
const originalRenderCollection=renderCollection;
renderCollection=function(){originalRenderCollection();let el=document.getElementById('hero-roster');if(!el){el=document.createElement('div');el.id='hero-roster';document.getElementById('tab-collection').append(el)}el.innerHTML=state.heroes.length?'<div class="panel" style="margin-top:15px"><h2>Герои</h2><p class="muted">Постоянные персонажи. Не погибают в бою.</p>'+state.heroes.map(h=>`<div class="hero-collection-card"><img src="${heroPicture(h.id)}" alt=""><div><strong>${h.name}</strong><div>${h.title} · уровень ${h.level}</div><small>${h.skill}</small></div></div>`).join('')+'</div>':''};
refreshPackUI();renderAll();
