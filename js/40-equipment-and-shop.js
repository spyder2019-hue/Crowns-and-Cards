(function(){
'use strict';
const GEAR = [
 {id:'iron_crown',slot:'helmet',name:'Железный венец',icon:'♛',price:140,atk:0,hp:2,detail:'Шлем, выкованный для военачальника'},
 {id:'bone_crown',slot:'helmet',name:'Корона праха',icon:'♛',price:350,atk:1,hp:4,detail:'Древний венец мёртвых королей'},
 {id:'grave_armor',slot:'armor',name:'Латы стража',icon:'♜',price:210,atk:0,hp:5,detail:'Тяжёлая защита из некрополя'},
 {id:'dark_mantle',slot:'armor',name:'Мантия тьмы',icon:'♜',price:330,atk:1,hp:4,detail:'Одежда хранителей запретных знаний'},
 {id:'wander_boots',slot:'boots',name:'Сапоги странника',icon:'♢',price:110,atk:0,hp:2,detail:'Мягкие сапоги для дальних походов'},
 {id:'iron_sword',slot:'weapon',name:'Рунический меч',icon:'⚔',price:190,atk:2,hp:0,detail:'Усиливает атаки союзников'},
 {id:'lich_staff',slot:'weapon',name:'Посох лича',icon:'⚚',price:390,atk:4,hp:0,detail:'Оружие тёмного владыки'},
 {id:'guardian_shield',slot:'shield',name:'Щит хранителя',icon:'⬡',price:170,atk:0,hp:4,detail:'Щит из древней усыпальницы'},
 {id:'old_amulet',slot:'amulet',name:'Амулет пепла',icon:'✧',price:155,atk:1,hp:1,detail:'Слабая, но верная магия'},
 {id:'soul_amulet',slot:'amulet',name:'Осколок души',icon:'✧',price:325,atk:2,hp:3,detail:'Редкая реликвия личей'}
];
const SLOTS={helmet:'Шлем',armor:'Броня',boots:'Обувь',weapon:'Оружие',shield:'Щит',amulet:'Амулет'};
const OWN = () => Array.isArray(state.gearOwned) ? state.gearOwned : (state.gearOwned=[]);
const EQUIPPED = () => state.gearEquipped && typeof state.gearEquipped === 'object' ? state.gearEquipped : (state.gearEquipped={});
const heroKey=()=>String(state.hero.id||state.hero.name||'arden');
function equipmentForHero(){const map=EQUIPPED();return map[heroKey()]||(map[heroKey()]={});}
function gearById(id){return GEAR.find(i=>i.id===id)}
window.equipmentAttackBonus=function(){return Object.values(equipmentForHero()).reduce((n,id)=>n+(gearById(id)?.atk||0),0)};
window.equipmentHealthBonus=function equipmentHealthBonus(){return Object.values(equipmentForHero()).reduce((n,id)=>n+(gearById(id)?.hp||0),0)}
function equipMessage(message){const e=document.getElementById('equipment-message');if(e){e.textContent=message;}}
function shopMessage(message){const e=document.getElementById('shop-status');if(e){e.textContent=message;}}
function closeChooser(){document.getElementById('equipment-chooser').hidden=true;}
function openChooser(slot){
 const pop=document.getElementById('equipment-chooser'), equipped=equipmentForHero(), owned=OWN();
 const items=GEAR.filter(g=>g.slot===slot&&owned.includes(g.id));
 pop.innerHTML='';
 const heading=document.createElement('h3');heading.textContent=SLOTS[slot];pop.append(heading);
 const intro=document.createElement('p');intro.textContent=items.length?'Выбери купленное снаряжение:':'В этом слоте пока нет предмета.';pop.append(intro);
 for(const gear of items){
  const button=document.createElement('button');button.type='button';button.className='equipment-choice'+(equipped[slot]===gear.id?' selected':'');
  const icon=document.createElement('span');icon.className='choice-icon';icon.textContent=gear.icon;
  const text=document.createElement('span');const name=document.createElement('b');name.textContent=gear.name;
  const stats=document.createElement('small');stats.textContent='⚔ +'+gear.atk+'   ❤ +'+gear.hp+(equipped[slot]===gear.id?' · Надето':'');
  text.append(name,stats);button.append(icon,text);
  button.onclick=()=>{equipped[slot]=gear.id;save();equipMessage('Надето: '+gear.name);closeChooser()};pop.append(button);
 }
 const foot=document.createElement('div');foot.className='equipment-chooser-footer';
 const store=document.createElement('button');store.type='button';store.className='equipment-store-link';store.textContent='Открыть магазин';store.onclick=()=>{closeChooser();showTab('shop');document.querySelectorAll('.gothic-sidebar [data-tab]').forEach(b=>b.classList.toggle('active',b.dataset.tab==='shop'))};
 const close=document.createElement('button');close.type='button';close.textContent='Закрыть';close.onclick=closeChooser;
 foot.append(store,close);pop.append(foot);pop.hidden=false;
}
function renderEquipSlots(){
 const chosen=equipmentForHero();
 document.querySelectorAll('#equipment-stage [data-equipment-slot]').forEach(btn=>{
  const slot=btn.dataset.equipmentSlot, item=gearById(chosen[slot]);
  btn.classList.toggle('equipped',Boolean(item));
  btn.querySelector('.equipment-slot-icon').textContent=item?item.icon:({helmet:'♛',armor:'♜',boots:'♢',weapon:'⚔',shield:'⬡',amulet:'✧'}[slot]);
  btn.title=item?(SLOTS[slot]+': '+item.name):SLOTS[slot]+' — нажми, чтобы выбрать или купить';
  btn.setAttribute('aria-label',btn.title);
 });
}
function renderEquipmentStore(){
 const shop=document.getElementById('equipment-store-grid');if(!shop)return;
 shop.innerHTML='';
 for(const gear of GEAR){
  const purchased=OWN().includes(gear.id);
  const card=document.createElement('article');card.className='equipment-store-item';
  const art=document.createElement('div');art.className='store-item-art';art.textContent=gear.icon;
  const title=document.createElement('strong');title.textContent=gear.name;
  const info=document.createElement('small');info.textContent=SLOTS[gear.slot]+' · '+gear.detail;
  const stats=document.createElement('span');stats.className='store-item-bonus';stats.textContent='⚔ +'+gear.atk+'  ·  ❤ +'+gear.hp;
  const button=document.createElement('button');button.type='button';
  button.disabled=purchased;button.textContent=purchased?'✓ Куплено':'Купить · '+gear.price+' золота';
  button.onclick=()=>{
    if(OWN().includes(gear.id)){shopMessage('Предмет уже куплен.');return}
    if(state.gold<gear.price){shopMessage('Недостаточно золота для покупки «'+gear.name+'».');return}
    state.gold-=gear.price;OWN().push(gear.id);
    equipmentForHero()[gear.slot]=gear.id;
    save();shopMessage('Куплено и надето: '+gear.name+'!');
  };
  card.append(art,title,info,stats,button);shop.append(card);
 }
}
function renderEquipment(){
 if(!document.getElementById('equipment-stage'))return;
 const h=state.hero;
 const image=document.getElementById('equipment-hero-image');if(image)image.src=typeof heroPicture==='function'?heroPicture(h.id):'';
 document.getElementById('equipment-hero-title').textContent=h.name||'Арден';
 document.getElementById('equipment-hero-subtitle').textContent=(h.title||'Герой')+' · Уровень '+(state.level||1);
 document.getElementById('equipment-bonuses').textContent='⚔ +'+(Number(h.attack||0)+equipmentAttackBonus())+' · ❤ +'+equipmentHealthBonus()+' от экипировки';
 const upgrade=document.getElementById('equipment-upgrade-button');upgrade.disabled=!(h.points>0);
 document.getElementById('equipment-upgrade-status').textContent='Очки развития: '+(h.points||0)+' · Бонус атаки: +'+(h.attack||0);
 renderEquipSlots();renderEquipmentStore();
}
window.renderEquipment=renderEquipment;
// Preserve original rendering and saved progression while extending the character screen.
const originalRender=renderAll;
renderAll=function(){originalRender();renderEquipment()};
document.querySelectorAll('#equipment-stage [data-equipment-slot]').forEach(b=>b.onclick=()=>openChooser(b.dataset.equipmentSlot));
document.getElementById('develop-hero-btn').onclick=()=>{
 const el=document.getElementById('equipment-upgrades');el.hidden=!el.hidden;
 const picker=document.getElementById('hero-picker');picker.hidden=true;
 renderEquipment();
};
document.getElementById('equipment-upgrade-button').onclick=()=>{upgradeHero();equipMessage('Усиление героя сохранено.')};
document.getElementById('select-hero-btn').addEventListener('click',()=>{document.getElementById('equipment-upgrades').hidden=true});
renderEquipment();
})();
