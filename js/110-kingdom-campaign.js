/* Crowns & Cards — Nine Kingdoms Campaign v1.
   Uses the existing tactical battle and state.won save data; no parallel economy. */
(function () {
  'use strict';
  if (typeof PLACES === 'undefined' || typeof state === 'undefined') return;

  const territories = [
    {
      id: 'human', name: 'Королевство людей', icon: '🏰', color: '#f7d27d', level: 1,
      desc: 'Начало пути: защити столицу и собери свой первый отряд.',
      spot: [33, 29, 38, 35],
      missions: [
        ['Дозор у ворот', 'Отрази нападение на городские ворота.', ['boneguard','skeletal_archer','gravedigger']],
        ['Путь каравана', 'Очисти торговую дорогу от нежити.', ['boneguard','undeadwarrior','skeletal_archer']],
        ['Осаждённая крепость', 'Прорвись к защитникам крепости.', ['undeadwarrior','deathmage','boneconstruct']],
        ['Босс: Падший рыцарь', 'Победи командира мёртвого войска.', ['undeadwarrior','boneconstruct','necromancer']]
      ]
    },
    {
      id: 'elf', name: 'Эльфийские земли', icon: '🌳', color: '#87f1ae', level: 2,
      desc: 'Древний лес прячет исчезнувшие тропы и магические руины.',
      spot: [0, 29, 33, 35],
      missions: [
        ['Тропа светлячков','Найди пропавший эльфийский патруль.',['skeletal_archer','boneguard','skeletal_archer']],
        ['Осквернённая роща','Уничтожь нежить среди древних деревьев.',['gravedigger','undeadwarrior','deathmage']],
        ['Хранители источника','Освободи волшебный источник.',['boneconstruct','deathmage','necromancer']],
        ['Босс: Теневой друид','Останови порчу лесного сердца.',['deathmage','ghoststeed','necromancer']]
      ]
    },
    {
      id: 'north', name: 'Северные земли', icon: '❄️', color: '#9eeeff', level: 3,
      desc: 'Ледяные крепости и забытая армия за снежными перевалами.',
      spot: [0, 0, 40, 29],
      missions: [
        ['Ледяной дозор','Пробейся через метель на перевал.',['boneguard','boneconstruct','skeletal_archer']],
        ['Замёрзшие шахты','Освободи шахтёрский поселок.',['gravedigger','boneconstruct','deathmage']],
        ['Цитадель инея','Штурмуй крепость снежных теней.',['undeadwarrior','boneconstruct','ghoststeed']],
        ['Босс: Ледяной владыка','Сокруши правителя северной цитадели.',['necromancer','boneconstruct','lichlord']]
      ]
    },
    {
      id: 'desert', name: 'Пустынные земли', icon: '☀️', color: '#ffcc78', level: 4,
      desc: 'Песчаные города, гробницы и сокровища древних царей.',
      spot: [0, 64, 40, 36],
      missions: [
        ['Песчаный тракт','Найди безопасный путь сквозь барханы.',['gravedigger','skeletal_archer','undeadwarrior']],
        ['Забытый оазис','Разведай оазис с опасными развалинами.',['boneguard','deathmage','ghoststeed']],
        ['Пирамида печатей','Сними печати с подземной гробницы.',['boneconstruct','necromancer','deathmage']],
        ['Босс: Царь праха','Победи пробуждённого владыку гробниц.',['boneconstruct','ghoststeed','lichlord']]
      ]
    },
    {
      id: 'cursed', name: 'Проклятые земли', icon: '🔮', color: '#e2abff', level: 5,
      desc: 'Горные колдовские башни и нестабильные порталы.',
      spot: [39, 0, 35, 30],
      missions: [
        ['Шёпот скал','Исследуй разлом на границе проклятия.',['deathmage','undeadwarrior','skeletal_archer']],
        ['Фиолетовый портал','Закрой разлом магической силы.',['necromancer','deathmage','ghoststeed']],
        ['Башня рун','Найди источник тёмных чар.',['boneconstruct','deathmage','lichlord']],
        ['Босс: Архимаг бездны','Разруши его связь с порталом.',['necromancer','ghoststeed','lichlord']]
      ]
    },
    {
      id: 'fire', name: 'Огненные земли', icon: '🔥', color: '#ff9d76', level: 6,
      desc: 'Лавовые поля и вулканическая крепость у края мира.',
      spot: [74, 0, 26, 36],
      missions: [
        ['Каменный берег','Пройди через обжигающее ущелье.',['undeadwarrior','boneguard','deathmage']],
        ['Лавовый проход','Уничтожь гарнизон на пути к вулкану.',['boneconstruct','ghoststeed','undeadwarrior']],
        ['Огненная башня','Возьми под контроль главную башню.',['necromancer','deathmage','lichlord']],
        ['Босс: Магмовый король','Победи стража вулканической крепости.',['boneconstruct','ghoststeed','lichlord']]
      ]
    },
    {
      id: 'forgotten', name: 'Забытые земли', icon: '🗝️', color: '#b5e9d0', level: 7,
      desc: 'Остров руин, где всё ещё горят древние маяки.',
      spot: [73, 36, 27, 32],
      missions: [
        ['Покинутый порт','Высадись на берег исчезнувшей цивилизации.',['gravedigger','undeadwarrior','ghoststeed']],
        ['Зал сломанных клятв','Найди летопись погибшего королевства.',['skeletal_archer','necromancer','deathmage']],
        ['Подземный архив','Раскрой тайну запечатанного архива.',['boneconstruct','ghoststeed','lichlord']],
        ['Босс: Вечный страж','Заверши древнее испытание.',['necromancer','boneconstruct','lichlord']]
      ]
    },
    {
      id: 'dark', name: 'Тёмные земли', icon: '🌑', color: '#cd9cff', level: 8,
      desc: 'Острые чёрные пики и столица теневых властителей.',
      spot: [39, 66, 35, 34],
      missions: [
        ['Чёрный перевал','Пройди мимо дозорных теневой армии.',['deathmage','ghoststeed','skeletal_archer']],
        ['Тропа обсидиана','Сокруши тёмных рыцарей у ворот.',['undeadwarrior','necromancer','boneconstruct']],
        ['Осквернённый трон','Преодолей элитную охрану дворца.',['ghoststeed','lichlord','deathmage']],
        ['Босс: Король теней','Срази повелителя ночи.',['lichlord','ghoststeed','necromancer']]
      ]
    },
    {
      id: 'dead', name: 'Мёртвые земли', icon: '☠️', color: '#87fce6', level: 9,
      desc: 'Последний некрополь. Здесь заканчивается первая кампания.',
      spot: [73, 67, 27, 33],
      missions: [
        ['Туман погибших','Проложи дорогу через кладбищенские поля.',['boneconstruct','ghoststeed','necromancer']],
        ['Долина костей','Разбей главную армию некрополя.',['undeadwarrior','lichlord','boneconstruct']],
        ['Врата вечности','Прорви защиту магов смерти.',['necromancer','lichlord','deathmage']],
        ['Финальный босс: Король-лич','Заверши кампанию и освободи королевства.',['lichlord','lichlord','ghoststeed']]
      ]
    }
  ];
  const MISSIONS=[];
  territories.forEach((region,ridx)=>{
    region.missions=region.missions.map(([name,desc,enemies],midx)=>{
      const boss=midx===3, elite=midx===2, id=`camp_${region.id}_${midx+1}`;
      const mission={id,region:region.id,name,desc,enemies,boss,elite,
        gold:85+ridx*45+midx*38+(boss?170:0), xp:32+ridx*16+midx*20+(boss?75:0),
        hpMult:1+0.085*ridx+(boss?.20:elite?.10:0), enemyBonus:Math.floor(ridx/3)+(boss?1:0)};
      MISSIONS.push(mission);
      if(!PLACES.some(x=>x.id===id)) PLACES.push(mission);
      return mission;
    });
  });
  let current='human';
  const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&quot;'}[c]));
  const beaten=mission=>Boolean(state.won&&state.won[mission.id]);
  const isRegionOpen=index=>index===0||beaten(territories[index-1].missions.at(-1));
  const isMissionOpen=(regionIndex,index)=>isRegionOpen(regionIndex)&&(index===0||beaten(territories[regionIndex].missions[index-1]));
  const totals=()=>territories.reduce((n,r)=>n+r.missions.filter(beaten).length,0);
  const select=id=>{if(territories.some(r=>r.id===id))current=id;};
  const getMission=id=>MISSIONS.find(m=>m.id===id);
  const canStart=id=>{const m=getMission(id);if(!m)return false;const ri=territories.findIndex(r=>r.id===m.region);return isMissionOpen(ri,territories[ri].missions.indexOf(m));};

  function draw() {
    const number=totals();
    const landButtons=territories.map((r,i)=>{
      const done=r.missions.filter(beaten).length,opened=isRegionOpen(i);
      const [left,top,width,height]=r.spot;
      const status=done===4?'★':opened?'⚔':'🔒';
      return `<button type="button" class="cc-campaign-hit ${current===r.id?'is-current':''} ${opened?'is-open':'is-locked'}" data-cmd="region:${r.id}" style="left:${left}%;top:${top}%;width:${width}%;height:${height}%;--region-color:${r.color}" aria-label="${escape(r.name)}. ${opened?'Доступно':'Закрыто'}. Выполнено ${done} из 4"><span class="cc-campaign-hit-badge">${status} ${done}/4</span></button>`;
    }).join('');
    const r=territories.find(x=>x.id===current)||territories[0];
    const idx=territories.indexOf(r),open=isRegionOpen(idx),done=r.missions.filter(beaten).length;
    const missionList=r.missions.map((m,i)=>{
      const cleared=beaten(m),available=isMissionOpen(idx,i),prev=r.missions[i-1];
      const tag=cleared?'✓ Пройдено':available?'⚔ В бой':'🔒 Закрыто';
      return `<div class="cc-campaign-mission ${cleared?'is-cleared':''} ${available?'':'is-locked'}">
        <div class="cc-campaign-mission-icon">${m.boss?'👑':m.elite?'⚔️':String(i+1)}</div>
        <div class="cc-campaign-mission-info"><strong>${escape(m.name)}</strong><p>${escape(m.desc)}</p><small>🪙 ${m.gold} золота · ⭐ ${m.xp} опыта · ${m.boss?'Босс':m.elite?'Элитное':'Обычное'}</small></div>
        <button type="button" class="cc-campaign-start" data-cmd="campaign:${m.id}" ${available?'':'disabled'}>${tag}</button>
      </div>`;
    }).join('');
    const hint=!open?`Откроется после победы над боссом региона «${escape(territories[idx-1].name)}».` : done===4?'Все задания выполнены. Можно повторять бои ради наград.':'Проходи задания по порядку, чтобы открыть следующий бой.';
    const finished=number===MISSIONS.length;
    const result=`<div class="cc-campaign-page">
      <div class="cc-campaign-header"><div><h1>🗺 Карта девяти земель</h1><p>Выбирай земли на карте, проходи задания и побеждай боссов.</p></div><strong class="cc-campaign-global-progress">🏆 ${number}/${MISSIONS.length}</strong></div>
      <div class="cc-campaign-scroll" id="cc-campaign-scroll" aria-label="Карта земель, прокручивается горизонтально"><div class="cc-campaign-canvas"><img src="assets/maps/nine-kingdoms-campaign.webp?v=1" draggable="false" alt="Карта девяти фантастических королевств, включая земли людей, эльфов, севера, пустыни, проклятых, огня, забытых, тьмы и мёртвых">${landButtons}</div></div>
      <div class="cc-campaign-scroll-hint">↔ На телефоне двигай карту пальцем. Нажми на землю, чтобы выбрать задания.</div>
      <section class="cc-campaign-detail" aria-label="Задания выбранного королевства" style="--campaign-color:${r.color}">
        <div class="cc-campaign-detail-head"><div><div class="cc-campaign-region-label">${open?'ДОСТУПНО':'ЗАКРЫТО'} · РЕК. УР. ${r.level}+</div><h2>${r.icon} ${escape(r.name)}</h2><p>${escape(r.desc)}</p></div><span class="cc-campaign-counter">${done}/4</span></div>
        <div class="cc-campaign-progress"><span style="width:${done*25}%"></span></div>
        <p class="cc-campaign-hint">${hint}</p>
        <div class="cc-campaign-missions">${missionList}</div>
      </section>${finished?'<div class="cc-campaign-finale">👑 Кампания пройдена! Все девять земель освобождены.</div>':''}
    </div>`;
    Promise.resolve().then(()=>{const el=document.getElementById('cc-campaign-scroll');if(!el)return;const btn=el.querySelector('.cc-campaign-hit.is-current');if(btn){const target=btn.offsetLeft+btn.offsetWidth/2-el.clientWidth/2;el.scrollLeft=Math.max(0,target)}});
    return result;
  }
  window.CrownsCampaign={render:draw,select,getMission,canStart,regions:territories,missions:MISSIONS,completed:totals};
})();