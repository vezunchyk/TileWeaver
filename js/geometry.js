/* js/geometry.js — Геометрія: типи ізометричної сітки, анімовані тайли, кадри різної ширини, pivot, placementBBox, якорі.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */
 // cellSize, під який виміряно вектори вище
  function isoAsymCell(c, r){
    var s = project.cellSize / ISO_ASYM_BASE;
    return {
      x: c*ISO_ASYM_COL.dx*s + r*ISO_ASYM_ROW.dx*s,
      y: c*ISO_ASYM_COL.dy*s + r*ISO_ASYM_ROW.dy*s
    };
  }
  function invIsoAsym(x, y){
    var s = project.cellSize / ISO_ASYM_BASE;
    var a = ISO_ASYM_COL.dx*s, b = ISO_ASYM_ROW.dx*s;
    var e = ISO_ASYM_COL.dy*s, f = ISO_ASYM_ROW.dy*s;
    var det = a*f - b*e;
    var c = (x*f - y*b) / det;
    var r = (y*a - x*e) / det;
    return { c:c, r:r };
  }
  function buildIsoAsymStamp(cellSize, color){
    var s = cellSize / ISO_ASYM_BASE;
    var w = Math.max(1, Math.round(ISO_ASYM_MASK_W*s));
    var h = Math.max(1, Math.round(ISO_ASYM_MASK_H*s));
    var stamp = document.createElement('canvas');
    stamp.width = w; stamp.height = h;
    var sctx = stamp.getContext('2d');
    sctx.fillStyle = color;
    for(var rr=0; rr<ISO_ASYM_MASK_H; rr++){
      var runs = ISO_ASYM_MASK_RUNS[rr];
      for(var k=0; k<runs.length; k+=2){
        var c0 = runs[k], len = runs[k+1];
        var px0 = Math.floor(c0*s), px1 = Math.ceil((c0+len)*s);
        var py0 = Math.floor(rr*s), py1 = Math.ceil((rr+1)*s);
        sctx.fillRect(px0, py0, Math.max(1,px1-px0), Math.max(1,py1-py0));
      }
    }
    return stamp;
  }
  function invIsoAsymTile(x, y){
    // Обернення для TILE-векторів (лінії сітки), а не для розміщення (ISO_ASYM_ROW/COL).
    // Потрібне окремо, бо межі циклу промальовки мають рахуватись під ту густоту, яка
    // РЕАЛЬНО малюється (часник), інакше лічильник клітинок рахує "зайві" і впирається
    // в захисний ліміт (>4000 → сітка мовчки не малюється взагалі — саме цей баг).
    var s = project.cellSize / ISO_ASYM_BASE;
    var a = ISO_ASYM_TILE_COL.dx*s, b = ISO_ASYM_TILE_ROW.dx*s;
    var e = ISO_ASYM_TILE_COL.dy*s, f = ISO_ASYM_TILE_ROW.dy*s;
    var det = a*f - b*e;
    var c = (x*f - y*b) / det;
    var r = (y*a - x*e) / det;
    return { c:c, r:r };
  }
  function buildIsoPixelStamp(cellSize, color){
    var s = cellSize / ISO_PIXEL_BASE;
    var w = Math.max(1, Math.round(ISO_PIXEL_MASK_W*s));
    var h = Math.max(1, Math.round(ISO_PIXEL_MASK_H*s));
    var stamp = document.createElement('canvas');
    stamp.width = w; stamp.height = h;
    var sctx = stamp.getContext('2d');
    sctx.fillStyle = color;
    for(var rr=0; rr<ISO_PIXEL_MASK_H; rr++){
      var runs = ISO_PIXEL_MASK_RUNS[rr];
      for(var k=0; k<runs.length; k+=2){
        var c0 = runs[k], len = runs[k+1];
        var px0 = Math.floor(c0*s), px1 = Math.ceil((c0+len)*s);
        var py0 = Math.floor(rr*s), py1 = Math.ceil((rr+1)*s);
        sctx.fillRect(px0, py0, Math.max(1,px1-px0), Math.max(1,py1-py0));
      }
    }
    return stamp;
  }

  function cellToWorld(c,r){
    if(project.gridType==='iso' || project.gridType==='isoPixel') return isoCell(c,r);
    if(project.gridType==='isoAsym') return isoAsymCell(c,r);
    return { x:(c+0.5)*project.cellSize, y:(r+0.5)*project.cellSize };
  }
  function worldToCell(x,y){
    if(project.gridType==='iso' || project.gridType==='isoPixel') return invIso(x,y);
    if(project.gridType==='isoAsym') return invIsoAsym(x,y);
    return { c:x/project.cellSize - 0.5, r:y/project.cellSize - 0.5 };
  }
  function snapPoint(x,y){
    var g = worldToCell(x,y);
    return cellToWorld(Math.round(g.c), Math.round(g.r));
  } // id розміщення -> { t0: час старту (мс), dur: тривалість одного циклу (мс) }
  function getAnimFrameIndex(tile, p){
    if(!tile.animFrames || tile.animFrames < 2) return 0;
    if(!animUiOn || !p) return 0;
    // Галочка «Грати постійно» в налаштуваннях тайла — крутиться безперестанку (як було раніше)
    if(tile.animLoop) return Math.floor((Date.now() - animStartTime) / (tile.animFrameMs||150)) % tile.animFrames;
    var a = animPlay[p.id];
    if(!a) return 0;
    var elapsed = Date.now() - a.t0;
    if(elapsed >= a.dur) return 0;
    return Math.min(tile.animFrames-1, Math.floor(elapsed / (tile.animFrameMs||150)));
  }
  function hasLoopingTile(){
    if(!animUiOn) return false;
    return Object.keys(project.tiles).some(function(id){ var t = project.tiles[id]; return t.animLoop && t.animFrames > 1; });
  }
  function startPlacementAnim(p){
    if(!animUiOn || !p) return;
    var tile = project.tiles[p.tileId];
    if(!tile || !(tile.animFrames > 1)) return;
    animPlay[p.id] = { t0: Date.now(), dur: (tile.animFrameMs||150) * tile.animFrames };
    registerAnimatedTile();
    scheduleRender();
  }
  // ---------- Кадри різної ширини (напр. двері: зачинені вужчі за відчинені) ----------
  // Раніше ВСІ кадри анімації вважались однаковою шириною (naturalWidth/animFrames) —
  // тому анімації, де кадри реально різного розміру (двері виходять за межі одвірка,
  // коли відчинені), або "їхали" через дробові пікселі на межі кадру, або відчинений
  // кадр стискався в розмір зачиненого. tile.frames — масив {x,w,pivotX,pivotY} на кожен
  // кадр окремо, з ВЛАСНОЮ точкою прив'язки (той самий принцип, що в Unity: кожен спрайт
  // сам знає, де в ньому "нульова" точка, а не спільний слот на всіх). Присутність цього
  // масиву — і є ознака "новий" анімований тайл; звичайні (дерева/вода/прапори, де кадри
  // й так однакові) НІЧИМ не відрізняються від того, що було, і не потребують переробки.
  function hasVariableFrames(tile){ return !!(tile && Array.isArray(tile.frames) && tile.frames.length > 1); }
  function tileFrameAt(tile, idx){
    if(!tile || !tile.frames || !tile.frames.length) return null;
    return tile.frames[Math.max(0, Math.min(tile.frames.length-1, idx))];
  }
  function tileMaxFrameW(tile){
    var m = 0;
    tile.frames.forEach(function(f){ if(f.w>m) m=f.w; });
    return m;
  }
  function hasAnyAnimatedTile(){
    return Object.keys(project.tiles).some(function(id){ return project.tiles[id].animFrames > 1; });
  }
  // Тихий цикл перемальовки — працює ЛИШЕ поки в проєкті є хоч один анімований тайл, інакше
  // сам себе зупиняє. scheduleRender() (уже throttled через requestAnimationFrame) означає, що
  // часті виклики тут не спричиняють зайвих окремих рендерів — це просто "попроси оновити",
  // не "онови просто зараз".
  function registerAnimatedTile(){
    if(animTickTimer) return;
    animTickTimer = setInterval(function(){
      if(document.hidden) return;
      if(!hasAnyAnimatedTile()){ clearInterval(animTickTimer); animTickTimer=null; return; }
      var ids = Object.keys(animPlay);
      if(!ids.length && !hasLoopingTile()) return; // ніщо не грає — зайвих перемальовок нема
      var now = Date.now();
      ids.forEach(function(id){ if(now - animPlay[id].t0 >= animPlay[id].dur) delete animPlay[id]; });
      scheduleRender(); // і для кадрів, що грають, і для фінального повернення на кадр 1
    }, 60);
  }

  // ---------- Точка прив'язки (pivot) — як у Unity/Godot ----------
  // У кожної текстури є своя pivot-точка (нормалізована 0..1 відносно ЇЇ ВЛАСНИХ пікселів —
  // 0.5,0.5 це центр, 0.5,1 це низ-центр і т.д., художник ставить її сам на прев'ю в модалці
  // тайла). За замовчуванням ця точка ставиться в ЦЕНТР клітинки (p.x/p.y) — так само, як у
  // будь-якому нормальному ізо-редакторі, і це коректно для суцільних тайлів-ромбів (підлога),
  // бо їхній візуальний центр і є центр клітинки.
  //
  // Але для обʼєктів, що стоять на ГРАНІ ромба (паркани, стіни), "центр клітинки" — НЕ та
  // точка, до якої вони мають прикріплюватись: грань зміщена від центру на половину клітинки.
  // Раніше єдиним способом було шукати на текстурі умовну точку "в порожньому просторі" за
  // межами малюнка, яка компенсує цей зсув, — незручно і для кожної текстури окремо.
  // gridAnchor вирішує це: художник просто клікає ПРЯМО на видиму частину малюнка (де він
  // реально торкається землі) і додатково каже, ЯКІЙ ВЕРШИНІ ромба ця точка відповідає
  // ('top'/'right'/'bottom'/'left') — конкретний числовий зсув від центру до цієї вершини
  // рахує рушій сам, тут-таки, залежно від типу сітки й cellSize.
  // Чотири вершини ромба поточної клітинки відносно її центру (0,0), в порядку
  // [верх, право, низ, ліво] — та сама геометрія, що раніше жила прямо в switch()
  // всередині gridAnchorOffset(), тепер винесена окремо, щоб її можна було не тільки
  // "вибрати вершину", а й ІНТЕРПОЛЮВАТИ точку вздовж ребра між двома сусідніми вершинами.
  function diamondVertices(){
    if(project.gridType === 'isoAsym'){
      // Зсуви вершин асиметричного ромба (ISO_ASYM_MASK_RUNS) відносно його ВЛАСНОГО центру,
      // виміряні з растрової маски (BASE=64): верх(32,0), право(62,15), низ(30,31), ліво(0,16);
      // центр (32,16). Зсув = вершина − центр.
      var s = project.cellSize / ISO_ASYM_BASE;
      return [
        { x: 0*s,   y: -16*s },
        { x: 30*s,  y: -1*s  },
        { x: -2*s,  y: 15*s  },
        { x: -32*s, y: 0*s   }
      ];
    } else if(project.gridType === 'iso' || project.gridType === 'isoPixel'){
      var hw = project.cellSize / 2, hh = project.cellSize / 4;
      return [ {x:0,y:-hh}, {x:hw,y:0}, {x:0,y:hh}, {x:-hw,y:0} ];
    } else {
      var cs = project.cellSize;
      return [ {x:0,y:-cs/2}, {x:cs/2,y:0}, {x:0,y:cs/2}, {x:-cs/2,y:0} ];
    }
  }
  // Точка на ПЕРИМЕТРІ ромба, параметризована одним неперервним числом t в [0,1):
  // t=0 верхня вершина, t=0.25 права, t=0.5 нижня, t=0.75 ліва — і будь-яке значення
  // МІЖ ними лінійно інтерпольоване вздовж відповідного ребра. Раніше можна було
  // прив'язатись ЛИШЕ до однієї з 4 вершин — паркан на грані (не в куті ромба) фізично
  // не міг бути виставлений правильно. Тепер довільна точка на грані (наприклад t=0.63,
  // "63% шляху від правої до нижньої вершини") рахується так само дешево, без спеціальних
  // випадків для кожної грані.
  function pointOnDiamond(t){
    var verts = diamondVertices();
    t = ((t % 1) + 1) % 1; // нормалізуємо в [0,1), про всяк випадок, якщо прийде негативне чи >1
    var seg = t * 4;
    var i0 = Math.floor(seg) % 4;
    var i1 = (i0 + 1) % 4;
    var f = seg - Math.floor(seg);
    var a = verts[i0], b = verts[i1];
    // Округлюємо до ЦІЛОГО пікселя — в піксель-арт редакторах об'єкт ніколи не зсувається на
    // пів пікселя чи менше; крок завжди мінімум 1px. t — неперервний параметр (для плавного
    // drag по контуру), але фактична точка прив'язки завжди "прилипає" до пиксельної сітки.
    return { x: Math.round(a.x + (b.x - a.x) * f), y: Math.round(a.y + (b.y - a.y) * f) };
  }
  // Зсув точки прив'язки текстури відносно центру клітинки. Пріоритет:
  // 1) tile.edgeAnchorT (нове поле, число 0..1) — довільна точка на периметрі ромба;
  // 2) tile.gridAnchor (старе поле, рядок 'top'/'right'/'bottom'/'left') — проєкти,
  //    збережені до появи edgeAnchorT; мапиться на ту саму вершину, що й раніше, без
  //    міграції даних на диску (просто рахується "на льоту" при кожному виклику).
  // 3) немає жодного з двох — 'center', зсув (0,0), як і завжди для звичайних тайлів.
  function gridAnchorOffset(tile){
    if(!tile) return { x:0, y:0 };
    if(typeof tile.edgeAnchorT === 'number') return pointOnDiamond(tile.edgeAnchorT);
    var anchor = tile.gridAnchor;
    if(!anchor || anchor === 'center') return { x:0, y:0 };
    var verts = diamondVertices();
    switch(anchor){
      case 'top':    return { x:Math.round(verts[0].x), y:Math.round(verts[0].y) };
      case 'right':  return { x:Math.round(verts[1].x), y:Math.round(verts[1].y) };
      case 'bottom': return { x:Math.round(verts[2].x), y:Math.round(verts[2].y) };
      case 'left':   return { x:Math.round(verts[3].x), y:Math.round(verts[3].y) };
    }
    return { x:0, y:0 };
  }
  function tilePivot(tile){
    if(tile && tile.pivotX != null && tile.pivotY != null) return { x:tile.pivotX, y:tile.pivotY };
    if(tile && tile.anchor === 'bottom') return { x:0.5, y:1 }; // старі проєкти до появи pivot-редактора
    return { x:0.5, y:0.5 };
  }
  function placementBBox(p){
    var tile = project.tiles[p.tileId];
    var img = tile && tile.img;
    var iw = img ? img.naturalWidth : 64, ih = img ? img.naturalHeight : 64;
    var pv;
    if(hasVariableFrames(tile)){
      // "Офіційний" розмір обʼєкта на карті (сітка/колізії/хендли виділення) — це розмір
      // ПЕРШОГО кадру (стан спокою: зачинені двері). Кадри анімації можуть виступати за цю
      // межу під час програвання (як крона дерева вже може виступати за межі свого тайла) —
      // це не помилка, так і задумано.
      var f0 = tile.frames[0];
      iw = f0.w; pv = { x:f0.pivotX, y:f0.pivotY };
    } else {
      // Анімований тайл (старого типу) — це смуга з кількох кадрів в одному PNG (горизонтально),
      // тому "ширина одного кадру" = ширина всього зображення / кількість кадрів, а НЕ повна
      // ширина смуги. Це критично для ВСЬОГО, що рахує розмір/позицію обʼєкта через
      // placementBBox — хіт-тест, ручки виділення, мінімапа тощо — інакше анімований тайл на
      // карті виглядав би в animFrames разів ширшим, ніж треба.
      if(tile && tile.animFrames > 1) iw = iw / tile.animFrames;
      pv = tilePivot(tile);
    }
    var w = iw * p.scaleX, h = ih * p.scaleY;
    var ga = gridAnchorOffset(tile);
    var ax = p.x + ga.x, ay = p.y + ga.y;
    var x0 = ax - w*pv.x, y0 = ay - h*pv.y;
    return { x0:x0, y0:y0, x1:x0+w, y1:y0+h, w:w, h:h, pv:pv };
  }
  // Box для МАЛЮВАННЯ конкретного кадру анімації (а не "офіційного" розміру обʼєкта).
  // Формула анкера (x0 = ax - w*pv.x) навмисно ІДЕНТИЧНА placementBBox — завдяки цьому у
  // render() точка прив'язки (bx + b.w*b.pv.x) лишається на тому самому місці екрана
  // незалежно від того, який саме кадр зараз малюється, навіть якщо його w/pivot інші.
  // Для звичайних/старих анімованих тайлів box для малювання завжди дорівнює placementBBox
  // (жодної зміни поведінки) — ця функція щось міняє лише коли hasVariableFrames(tile).
  function placementRenderBBox(p, frameIdx){
    var tile = project.tiles[p.tileId];
    if(!hasVariableFrames(tile)) return placementBBox(p);
    var img = tile.img;
    var f = tileFrameAt(tile, frameIdx);
    var iw = f.w, ih = img.naturalHeight;
    var w = iw * p.scaleX, h = ih * p.scaleY;
    var ga = gridAnchorOffset(tile);
    var ax = p.x + ga.x, ay = p.y + ga.y;
    var x0 = ax - w*f.pivotX, y0 = ay - h*f.pivotY;
    return { x0:x0, y0:y0, x1:x0+w, y1:y0+h, w:w, h:h, pv:{x:f.pivotX,y:f.pivotY} };
  }
  function getLayer(id){
    return (project.layers && project.layers.find(function(l){return l.id===id;})) || {id:'default', name:t('layerDefaultName')+' 1', visible:true, locked:false};
  }
  function getLayerOrder(layerId){
    var idx = (project.layers || []).findIndex(function(l){ return l.id===layerId; });
    return idx < 0 ? -1 : idx;
  }

  function comparePlacements(a,b){
    // z ТЕПЕР АБСОЛЮТНЕ число, а не "відносне до шару". Порядок малювання визначається
    // ПРОСТО значенням p.z (і y як тайбрейк) — жодного додавання baseZ, жодних формул.
    // baseZ шару — це лише "звідки почати" для НОВИХ обʼєктів на цьому шарі (baseZ+1),
    // він більше ніяк не впливає на сортування вже існуючих обʼєктів. Якщо хтось вручну
    // поставить обʼєкту на шарі 1 z=25, а на шарі 2 обʼєкти лишаться на z=21 — вони так і
    // намалюються в порядку 21 раніше за 25, і це нормально: користувач сам вирішує z руками
    // через "Змінити глибину", і сам відповідає за те, що вибрав.
    return ((a.z||0)-(b.z||0)) || ((a.sortY!=null?a.sortY:a.y)-(b.sortY!=null?b.sortY:b.y));
  }
