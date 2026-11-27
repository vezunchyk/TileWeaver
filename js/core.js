/* js/core.js — Загальні допоміжні функції (тости, ідентифікатори, робота з шарами/мовою) і початкова ініціалізація.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  // ---------- Швидкий пошук розміщення за id (замість project.placements.find на кожен id: у масових діях це O(N·k)) ----------
  // Карта id → позиція будується один раз і лише добудовується при додаванні в кінець. Кожне влучання перевіряється
  // (arr[ix].id === id); якщо карта застаріла — запасний лінійний пошук, як раніше. Результат завжди той самий, що в find().
  var pidCache = { arr:null, len:0, map:new Map() };
  function placementById(id){
    var arr = project.placements, c = pidCache;
    if(c.arr !== arr || arr.length < c.len){ c.arr = arr; c.len = 0; c.map = new Map(); }
    if(arr.length > c.len){
      for(var i = c.len; i < arr.length; i++){ var k = arr[i].id; if(!c.map.has(k)) c.map.set(k, i); }
      c.len = arr.length;
    }
    var ix = c.map.get(id);
    if(ix !== undefined){ var p = arr[ix]; if(p && p.id === id) return p; }
    for(var j = 0; j < arr.length; j++){ if(arr[j].id === id){ c.map.set(id, j); return arr[j]; } }
    return undefined;
  }
  // Множина id зі списку (кеш за масивом і довжиною) — для ids.includes(...) у циклах
  var idSetCache = { arr:null, len:-1, set:null };
  function idSetOf(ids){
    var c = idSetCache;
    if(c.arr !== ids || c.len !== ids.length){ c.arr = ids; c.len = ids.length; c.set = new Set(ids); }
    return c.set;
  }


  function applyI18n(){
    setTimeout(function(){ if(document.body) trWalk(document.body); }, 0);
    document.querySelectorAll('[data-i18n]').forEach(function(el){ el.textContent = t(el.getAttribute('data-i18n')); });
    document.getElementById('langBtn').textContent = LANG_NAMES[lang] || lang.toUpperCase();
    buildModeBar(); buildCloneLineBar();
  } // крок baseZ між шарами. Просте правило: новий шар = поточний максимум baseZ серед існуючих шарів + LAYER_Z_STEP. НІКОЛИ не перераховується заднім числом і не залежить від того, скільки шарів видалено — тільки від того, що є ПРЯМО ЗАРАЗ.
  function nextLayerBaseZ(){
    var maxBase = 0;
    (project.layers||[]).forEach(function(l){ if((l.baseZ||0) > maxBase) maxBase = l.baseZ||0; });
    return maxBase + LAYER_Z_STEP;
  }
  function getHouseAlpha(p){
    if(!houseView.enabled || !houseView.group || p.group !== houseView.group) return 1;
    if(p.isRoof) return 0; // дах завжди ховаємо, поки дивимось всередину будинку
    if(p.floor == null) return 1; // елементи цього будинку без floor (ще не розмічені) — не чіпаємо
    var diff = p.floor - houseView.activeFloor;
    if(diff === 0) return 1;
    if(Math.abs(diff) === 1) return 0.25; // сусідній поверх — напівпрозорий орієнтир
    return 0.05; // далекі поверхи — майже невидимі, але не зовсім (щоб не губився контекст)
  }
  function scheduleUndoWarm(){
    clearTimeout(undoWarmHandle);
    undoWarmHandle = setTimeout(function(){
      if(window.requestIdleCallback) requestIdleCallback(function(){ undoMgr.warm(); }, { timeout:3000 }); else undoMgr.warm();
    }, 300);
  }
  function pushUndo(){ placementsEpoch++; undoMgr.push(); }
  function afterUndoRestore(){
    placementsEpoch++;
    selected = null;
    renderLayersStrip(); render(); saveActiveProject();
  }
  // Назад: бере останній ВІДМІННИЙ від поточного стан (порожні записи пропускає) і кладе поточний у «вперед»
  function undo(){
    if(!undoMgr.undo()){ toast(t('toastNoUndo')); return; }
    afterUndoRestore();
  }
  // Вперед: повертає те, що скасували. Якщо після «назад» зробили нову дію — старе «вперед» недійсне
  function redo(){
    if(!undoMgr.redo()){ toast(t('toastNoRedo')); return; }
    afterUndoRestore();
  }
  function toast(msg){
    var el = document.getElementById('toast');
    el.textContent = trText(String(msg)); el.classList.add('show');
    clearTimeout(el._h); el._h = setTimeout(function(){ el.classList.remove('show'); }, 1400);
  }

  function resizeCanvas(){
    var r = wrap.getBoundingClientRect();
    canvas.width = r.width * devicePixelRatio;
    canvas.height = r.height * devicePixelRatio;
    canvas.style.width = r.width+'px'; canvas.style.height = r.height+'px';
    ctx.setTransform(devicePixelRatio,0,0,devicePixelRatio,0,0);
    ctx.imageSmoothingEnabled = false;
    if(view.panX===0 && view.panY===0){ view.panX = r.width/2; view.panY = r.height/2; }
    resizeMinimapCanvas();
    render();
  }
