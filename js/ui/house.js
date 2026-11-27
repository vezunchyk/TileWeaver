/* js/ui/house.js — Налаштування будинку: поверх, дах, тінь, назва; перегляд будинку.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  // =====================  НАЛАШТУВАННЯ БУДИНКУ (поверх, дах, тінь, назва)  =====================
  function houseTargets(){ return !selected ? [] : (selected.type==='multi' ? selected.ids.slice() : (selected.type==='placement' ? [selected.id] : [])); }
  function houseObjsOf(ids){ return ids.map(function(id){ return placementById(id); }).filter(Boolean); }
  function houseGroupName(){
    if(!selected) return '';
    if(selected.type==='multi') return selected.houseGroup || '';
    var p0 = placementById(selected.id);
    return (p0 && p0.group) || '';
  }
  function hsBtn(act, label, cls){ return '<button class="hs-btn '+(cls||'')+'" data-hs="'+act+'">'+label+'</button>'; }
  function openHouseSettings(){
    var m = document.getElementById('houseModal'), body = document.getElementById('houseModalBody');
    var objs = houseObjsOf(houseTargets()), g = houseGroupName();
    if(!objs.length || !g){ m.style.display = 'none'; return; }
    var nRoof = objs.filter(function(o){ return o.isRoof; }).length;
    var roofCls = nRoof === objs.length ? 'green' : (nRoof === 0 ? 'red' : 'mixed');
    var floors = []; objs.forEach(function(o){ if(o.floor != null && floors.indexOf(o.floor) < 0) floors.push(o.floor); });
    var floorTxt = floors.length === 0 ? '—' : (floors.length === 1 ? String(floors[0]) : 'різні');
    var all = project.placements.filter(function(x){ return x.group === g && !x.shadowOf; }).length;
    body.innerHTML =
      '<div class="hs-head">🏠 «'+escHtml(g)+'» · вибрано тайлів: '+objs.length+' · у будинку всього: '+all+'</div>'+
      hsBtn('floor', '🏢 Поверх: '+floorTxt)+
      hsBtn('roof', '△ Дах: '+(roofCls==='green' ? 'так (тап — зняти)' : (roofCls==='red' ? 'ні (тап — позначити)' : 'частково (тап — усе дахом)')), roofCls)+
      hsBtn('view', '🏘 Показати поверхи (напівпрозоро)')+
      (objs.length < all ? hsBtn('selall', '🔎 Обрати весь будинок ('+all+')') : '')+
      hsBtn('shadow', '🌑 Тінь будинку')+
      hsBtn('rename', '✏ Змінити назву групи')+
      hsBtn('ungroup', '🚫 Розгрупувати вибране', 'danger');
    m.style.display = 'flex';
  }
  function houseDone(){ saveActiveProject(); render(); openHouseSettings(); } // {id, idx} — режим «Тінь для папки»
  function folderIdsDeep(fid){
    var set = {};
    if(fid){ set[fid] = true; var ch = true; while(ch){ ch = false; project.tileFolders.forEach(function(f){ if(f.parentId && set[f.parentId] && !set[f.id]){ set[f.id] = true; ch = true; } }); } }
    return set;
  }
  function folderTileIds(fid){
    var set = folderIdsDeep(fid);
    return Object.keys(project.tiles).filter(function(id){
      var tl = project.tiles[id]; if(tl.autoShadow || isShadowTile(tl)) return false;
      return fid ? !!set[tl.folderId] : !tl.folderId;
    });
  }
  function folderObjs(fid){
    var ids = {}; folderTileIds(fid).forEach(function(i){ ids[i] = true; });
    return project.placements.filter(function(p){ return !p.shadowOf && ids[p.tileId]; });
  }
  function removeShadowsOf(parentIds){
    var gone = [];
    project.placements = project.placements.filter(function(p){
      if(p.shadowOf && parentIds.indexOf(p.shadowOf) >= 0){ gone.push(p.tileId); return false; }
      return true;
    });
    gone.forEach(dropShadowTile);
  }
  function renderFolderPreview(){
    var cv = document.getElementById('shfPrev'); if(!cv) return;
    var c = cv.getContext('2d'); c.clearRect(0,0,cv.width,cv.height); c.imageSmoothingEnabled = false;
    var ids = folderTileIds(shadowFolder.id);
    c.fillStyle = '#9a9a80'; c.font = '12px sans-serif';
    if(!ids.length){ c.fillText(trText('У папці немає текстур'), 10, 20); return; }
    var tid = ids[shadowFolder.idx % ids.length], tile = project.tiles[tid];
    if(!tile.img.complete || !tile.img.naturalWidth){ c.fillText(trText('Завантаження…'), 10, 20); return; }
    var fake = { id:'__prev', tileId:tid, x:0, y:0, z:0, layerId:project.activeLayerId, scaleX:1, scaleY:1, flipX:false, flipY:false, rotation:0 };
    var b = placementBBox(fake), res = buildShadow([fake], shadowCfg);
    var x0 = b.x0, y0 = b.y0, x1 = b.x1, y1 = b.y1, sx0 = 0, sy0 = 0;
    if(res){ sx0 = res.cx - res.canvas.width/2; sy0 = res.cy - res.canvas.height/2; x0 = Math.min(x0,sx0); y0 = Math.min(y0,sy0); x1 = Math.max(x1,sx0+res.canvas.width); y1 = Math.max(y1,sy0+res.canvas.height); }
    var sc = Math.min((cv.width-16)/(x1-x0), (cv.height-16)/(y1-y0)); if(sc >= 1) sc = Math.floor(sc);
    var ox = (cv.width - (x1-x0)*sc)/2 - x0*sc, oy = (cv.height - (y1-y0)*sc)/2 - y0*sc;
    if(res) c.drawImage(res.canvas, sx0*sc+ox, sy0*sc+oy, res.canvas.width*sc, res.canvas.height*sc);
    c.drawImage(tile.img, 0,0,tileFrameW(tile),tile.img.naturalHeight, b.x0*sc+ox, b.y0*sc+oy, b.w*sc, b.h*sc);
  }
  function shSettingsHtml(){
    function bt(act, label, on){ return '<button data-sh="'+act+'" class="'+(on?'on':'')+'">'+label+'</button>'; }
    var shapes = [['silhouette','За формою'],['diamond','Ромб'],['circle','Коло'],['rect','Блок']];
    var dirs = [['nw','↖'],['ne','↗'],['sw','↙'],['se','↘']];
    return '<div class="shp-row">'+shapes.map(function(x){ return bt('shape:'+x[0], x[1], shadowCfg.shape===x[0]); }).join('')+'</div>'+
      '<div class="shp-row"><span>Світло (усі тіні):</span>'+dirs.map(function(x){ return bt('dir:'+x[0], x[1], lightDir()===x[0]); }).join('')+'</div>'+
      shSlider('len', 'Довжина / розмір', 0.1, 1.5, 0.05, shadowCfg.len, function(v){ return (+v).toFixed(2); })+
      shSlider('opacity', 'Прозорість', 0.1, 0.9, 0.05, shadowCfg.opacity, function(v){ return Math.round(v*100)+'%'; })+
      shSlider('soft', 'Розмір пікселя тіні', 0, 3, 1, shadowCfg.soft, function(v){ return (1+(+v))+'×'; });
  }
  function buildShadowPanel(){
    var el = document.getElementById('shadowPanel');
    if(tool !== 'shadow'){ el.style.display = 'none'; return; }
    function bt(act, label, on){ return '<button data-sh="'+act+'" class="'+(on?'on':'')+'">'+label+'</button>'; }
    if(shadowFolder){
      var opts = '<option value="">Усі папки (корінь)</option>'+project.tileFolders.map(function(f){ return '<option value="'+escHtml(f.id)+'"'+(f.id===shadowFolder.id?' selected':'')+'>'+escHtml(folderPathLabel(f.id))+'</option>'; }).join('');
      var tids = folderTileIds(shadowFolder.id), nObj = folderObjs(shadowFolder.id).length;
      el.innerHTML =
        '<div class="shp-head">📁 Тінь для папки · текстур: '+tids.length+' · обʼєктів на карті: '+nObj+'</div>'+
        '<div class="shp-row"><select data-shf="folder" style="flex:1;">'+opts+'</select></div>'+
        '<canvas id="shfPrev" width="260" height="130" style="width:100%; image-rendering:pixelated; background:#14140c; border-radius:6px;"></canvas>'+
        '<div class="shp-row">'+bt('fprev','◀',false)+'<span>Приклад '+(tids.length ? (shadowFolder.idx % tids.length)+1 : 0)+' / '+tids.length+'</span>'+bt('fnext','▶',false)+'</div>'+
        shSettingsHtml()+
        '<div class="shp-row">'+bt('fapply','✓ Застосувати до всіх ('+nObj+')',false).replace('class=""','class="ok"')+bt('fback','← Назад',false)+'</div>';
      el.style.display = 'block';
      renderFolderPreview();
      return;
    }
    var objs = shadowSelObjs();
    var hasSh = objs.some(shadowOfObj);
    el.innerHTML =
      '<div class="shp-head">🌑 Тінь · виділено: '+objs.length+(objs.length ? '' : ' — тапни обʼєкти на карті')+'</div>'+
      shSettingsHtml()+
      '<div class="shp-row">'+bt('joint','🏠 Одна тінь на всю групу'+(shadowCfg.joint?' ✓':''), !!shadowCfg.joint)+bt('folder','📁 Для папки…',false)+'</div>'+
      '<div class="shp-row">'+bt('apply', hasSh ? '↻ Оновити тінь' : '➕ Додати тінь', false).replace('class=""','class="ok"')+
      bt('remove','🗑', false)+(hasSh ? bt('unlink','✂ Відвʼязати', false) : '')+bt('done','✓ Готово', false)+'</div>';
    el.style.display = 'block';
  }
  function applyShadowSel(onlyExisting){
    var objs = shadowSelObjs();
    if(onlyExisting) objs = objs.filter(shadowOfObj);
    if(!objs.length){ if(!onlyExisting) toast('Спершу тапни обʼєкт на карті'); return; }
    pushUndo();
    var n = 0;
    if(shadowCfg.joint && objs.length > 1){
      // одна спільна тінь на весь будинок; окремі тіні його частин прибираємо
      removeShadowsOf(objs.slice(1).map(function(o){ return o.id; }));
      if(applyShadowTo(objs[0], shadowCfg, objs)) n = 1;
    } else {
      objs.forEach(function(o){ if(applyShadowTo(o, shadowCfg)) n++; });
    }
    saveActiveProject(); render(); buildShadowPanel();
    if(!onlyExisting) toast('Тіней: '+n);
  }
  function regenAllShadows(){
    pushUndo();
    var mapP = {}; project.placements.forEach(function(p){ mapP[p.id] = p; });
    project.placements.slice().forEach(function(p){
      if(!p.shadowOf || !p.shadowCfg || !mapP[p.shadowOf]) return;
      var mem = p.shadowMembers ? p.shadowMembers.map(function(id){ return mapP[id]; }).filter(Boolean) : null;
      applyShadowTo(mapP[p.shadowOf], p.shadowCfg, mem);
    });
    saveActiveProject(); render();
  }
  function shadowTap(wx, wy){
    var h = hitTestPlacement(wx, wy); if(!h) return;
    if(h.shadowOf){ var par0 = placementById(h.shadowOf); if(!par0) return; h = par0; }
    // обʼєкт з групи-будинку вибирає весь будинок
    var grp = h.group ? project.placements.filter(function(x){ return x.group === h.group && !x.shadowOf; }) : [h];
    var allIn = grp.every(function(x){ return shadowSel.indexOf(x.id) >= 0; });
    if(allIn) shadowSel = shadowSel.filter(function(id){ return !grp.some(function(x){ return x.id === id; }); });
    else grp.forEach(function(x){ if(shadowSel.indexOf(x.id) < 0) shadowSel.push(x.id); });
    if(h.group && !allIn) shadowCfg.joint = true; else if(shadowSel.length <= 1) shadowCfg.joint = false;
    var ex = shadowOfObj(h);
    if(ex && ex.shadowCfg){ var j = shadowCfg.joint; shadowCfg = JSON.parse(JSON.stringify(ex.shadowCfg)); shadowCfg.joint = ex.shadowMembers ? true : j; }
    buildShadowPanel(); render();
  }
  function hideHandles(){ handleIds.concat(extraHandleIds).forEach(function(id){ document.getElementById(id).style.display='none'; }); document.getElementById('hRot').style.display='none'; document.getElementById('hSkew').style.display='none'; }
  function updateHandles(b, p){
    if(p && rotatingId === p.id){
      handleIds.concat(extraHandleIds).forEach(function(id){ document.getElementById(id).style.display='none'; });
      var cx = (b.x0+b.x1)/2, cy = (b.y0+b.y1)/2;
      var screenC = worldToScreen(cx, cy);
      var handleDist = 50;
      var rad = (p.rotation||0) * Math.PI/180;
      var hx = screenC.x + Math.sin(rad)*handleDist;
      var hy = screenC.y - Math.cos(rad)*handleDist;
      var hEl = document.getElementById('hRot');
      hEl.style.display = 'block';
      hEl.style.left = hx+'px'; hEl.style.top = hy+'px';
      var skewPt = worldToScreen(b.x1, cy);
      var skewOffset = (p.skewX||0) * (b.y1-b.y0) * view.zoom * 0.5;
      var sEl = document.getElementById('hSkew');
      sEl.style.display = 'block';
      sEl.style.left = (skewPt.x + skewOffset)+'px'; sEl.style.top = skewPt.y+'px';
      return;
    }
    document.getElementById('hRot').style.display='none';
    document.getElementById('hSkew').style.display='none';
    var pTL = worldToScreen(b.x0,b.y0), pTR = worldToScreen(b.x1,b.y0), pBL = worldToScreen(b.x0,b.y1), pBR = worldToScreen(b.x1,b.y1);
    var pts = {hTL:pTL, hTR:pTR, hBL:pBL, hBR:pBR};
    handleIds.forEach(function(id){
      var el = document.getElementById(id);
      el.style.display='block';
      el.style.left = pts[id].x+'px'; el.style.top = pts[id].y+'px';
    });
    extraHandleIds.forEach(function(id){ document.getElementById(id).style.display='none'; });
    if(p && !p.locked && isShadowTile(project.tiles[p.tileId])){
      var emx = (pTL.x+pTR.x)/2, emy = (pTL.y+pBL.y)/2;
      var ep = { hT:[emx,pTL.y], hB:[emx,pBL.y], hL:[pTL.x,emy], hR:[pTR.x,emy] };
      Object.keys(ep).forEach(function(id){ var el2 = document.getElementById(id); el2.style.display='block'; el2.style.left=ep[id][0]+'px'; el2.style.top=ep[id][1]+'px'; });
      var rb = document.getElementById('hRatio');
      rb.style.display = 'flex'; rb.style.left = emx+'px'; rb.style.top = Math.max(26, pTL.y-40)+'px';
      rb.textContent = shadowKeepRatio ? '🔒' : '🔓';
      rb.style.background = shadowKeepRatio ? 'var(--rust)' : 'rgba(20,20,12,0.85)';
    }
  }
  function selKey(){
    if(!selected) return '';
    if(selected.type === 'multi') return 'm:' + selected.ids.slice().sort().join(',');
    return 'p:' + selected.id;
  }
  // Одна кнопка: «Копіювати», а коли буфер уже містить саме це виділення — «Вставити»
  function copyItem(){
    var paste = !!(clipboard && clipboard.srcKey && clipboard.srcKey === selKey());
    return { key:'copy', dataAct: paste ? 'paste' : 'copy', icon: paste ? '📥' : '📋', title: paste ? 'Вставити (у центр екрана)' : 'Копіювати', style: paste ? 'background:var(--green); color:#fff;' : '' };
  }
  function updateSelPanel(){
    if(!selected){ selPanel.style.display='none'; hideHandles(); return; }
    // Поки йде активне перетягування/зміна розміру/обертання — ховаємо панель кнопок, вона
    // затуляє об'єкт саме тоді, коли треба бачити куди тягнеш. Хендли (кутові точки) лишаємо —
    // вони й є ручками для драгу, а не заваджають.
    var dragging = (mode==='dragMove' || mode==='multiDragMove' || mode==='resizeHandle' ||
                    mode==='rotateHandle' || mode==='skewHandle' || mode==='dragMoveRect' ||
                    mode==='resizeCollisionRect' || mode==='dragMovePoly' || mode==='resizePolyVertex');
    var r = wrap.getBoundingClientRect();
    var screenPt;
    if(selected.type === 'multi') {
        var allLockedMS = selected.ids.length > 0 && selected.ids.every(function(id){
            var pp = placementById(id);
            return pp && pp.locked;
        });
        var minZms = selected.ids.reduce(function(m,id){
            var pp = placementById(id);
            return pp ? Math.min(m, pp.z) : m;
        }, Infinity);
        if(minZms===Infinity) minZms = 0;
        var itemsM = [
          {key:'eye', dataAct:'panelEye', icon:'👁', title:'Показати/сховати панель'}, animItem(),
          copyItem(),
          {key:'move', dataAct:'multi-move', icon:'🖐', title:t('multiMoveBtn')},
          {key:'layer', dataAct:'multi-zEdit', icon:fmtZForBtn(minZms), style:'font-size:13px;', title:'Порядок '+minZms+' — тап, щоб ввести число'},
          {key:'zUp', dataAct:'multi-zUp', icon:'▲', title:'Підняти всю групу на 1'},
          {key:'zDown', dataAct:'multi-zDown', icon:'▼', title:'Опустити всю групу на 1'},
        ];
        if(selected.houseGroup){
          itemsM.push({key:'houseSettings', dataAct:'house-settings', icon:'🏠', title:'Налаштування будинку «'+selected.houseGroup+'»: поверх, дах, тінь…', style:'background:var(--rust); color:#fff;'});
        } else {
          itemsM.push({key:'group', dataAct:'multi-group', icon:'🏠', title:t('btnHouseGroup')});
        }
        itemsM.push({key:'shadow', dataAct:'multi-shadow', icon:'🌑', title:'Одна тінь-силует для всього виділеного (будинку)'});
        itemsM.push({key:'shadowOval', dataAct:'multi-shadowOval', icon:'⬭', title:'Одна тінь-еліпс під усім виділеним (будинком)'});
        itemsM.push({key:'stamp', dataAct:'multi-savestamp', icon:'🖨', title:'Зберегти групу як штамп'});
        itemsM.push({key:'autotile', dataAct:'multi-autotile', icon:'▦', title:'Автотайлінг'});
        itemsM.push({key:'lock', dataAct:'multi-lock', icon:(allLockedMS?'🔓':'🔒'), title:(allLockedMS?'Розблокувати всі обʼєкти в цій групі':'Заблокувати всі обʼєкти в цій групі')});
        itemsM.push({key:'del', dataAct:'multi-del', icon:'🗑', title:'Видалити', cls:'del'});
        selPanel.innerHTML = renderIconGrid(itemsM);
        hideHandles();
        screenPt = worldToScreen((selected.minX + selected.maxX)/2, selected.minY);
    } else if(selected.type==='placement'){
      var p = placementById(selected.id);
      if(!p){ selected=null; selPanel.style.display='none'; hideHandles(); return; }
      var b = placementBBox(p);
      var panelBelow = (rotatingId===p.id);
      screenPt = panelBelow ? worldToScreen((b.x0+b.x1)/2, b.y1) : worldToScreen((b.x0+b.x1)/2, b.y0);
      if(p.locked){
        // Заблокований обʼєкт: з дій лишається тільки розблокування — АЛЕ якщо він частина
        // групи (будинку), додаємо ще й пряму кнопку розблокування ВСІЄЇ групи одним тапом.
        var itemsPL = [
          {key:'eye', dataAct:'panelEye', icon:'👁', title:'Показати/сховати панель'}, animItem(),
          {key:'lock', dataAct:'unlock', icon:'🔒', title:'Розблокувати лише цей тайл'}
        ];
        if(p.group){
          itemsPL.push({key:'unlockGroup', dataAct:'unlock-group', icon:'🔓', title:'Розблокувати всю групу '+p.group});
          itemsPL.push({key:'selectHouse', dataAct:'select-house', icon:'🔎', title:'Обрати весь будинок '+p.group});
        }
        selPanel.innerHTML = renderIconGrid(itemsPL);
        hideHandles();
      } else {
        var itemsP = [
          {key:'eye', dataAct:'panelEye', icon:'👁', title:'Показати/сховати панель'}, animItem(),
          {key:'layer', dataAct:'layer', icon:fmtZForBtn(p.z), style:'font-size:13px;', title:'Порядок '+p.z+' — тап, щоб ввести число'},
          {key:'zUp', dataAct:'zUp', icon:'▲', title:'Підняти на 1 (вище по шару)'},
          {key:'zDown', dataAct:'zDown', icon:'▼', title:'Опустити на 1'},
        ];
        itemsP.splice(1, 0, copyItem());
        if(p.group){
          itemsP.push({key:'houseSettings', dataAct:'house-settings', icon:'🏠', title:'Налаштування будинку «'+p.group+'»: поверх, дах, тінь…', style:'background:var(--rust); color:#fff;'});
        } else {
          itemsP.push({key:'group', dataAct:'group', icon:'🏠', title:'Призначити назву групи/будинку'});
        }
        itemsP.push({key:'mirror', dataAct:'mirror', icon:'↔', title:'Дзеркало горизонтально'});
        itemsP.push({key:'mirrorY', dataAct:'mirrorY', icon:'↕', title:'Дзеркало вертикально'});
        itemsP.push({key:'rotate', dataAct:'rotate', icon:'↻', title:'Повернути', style: rotatingId===p.id?'background:var(--green); color:#fff;':''});
        itemsP.push({key:'precision', dataAct:'precision', icon:'🎯', title:'Точне піксельне розміщення', style: precisionOpen?'background:var(--rust); color:#fff;':''});
        itemsP.push({key:'shadow', dataAct:'shadow', icon:'🌑', title:'Тінь-силует (краще для дерев)'});
        itemsP.push({key:'shadowOval', dataAct:'shadowOval', icon:'⬭', title:'Тінь-еліпс (краще для будинків)'});
        itemsP.push({key:'tag', dataAct:'tag', icon:'🏷', title: p.tag ? 'Тег: '+p.tag+' (тап — змінити)' : 'Поставити тег', style: p.tag ? 'background:var(--green); color:#fff;' : ''});
        itemsP.push({key:'lock', dataAct:'lock', icon:'🔓', title:'Заблокувати'});
        itemsP.push({key:'dup', dataAct:'dup', icon:t('dupBtn'), title:'Дублювати'});
        itemsP.push({key:'del', dataAct:'del', icon:'🗑', title:'Видалити', cls:'del'});
        selPanel.innerHTML = renderIconGrid(itemsP);
        updateHandles(b, p);
      }
    } else if(selected.type==='spawn'){
      var sp = project.spawns.find(function(x){return x.id===selected.id;});
      if(!sp){ selected=null; selPanel.style.display='none'; hideHandles(); return; }
      screenPt = worldToScreen(sp.x, sp.y - SPAWN_R);
      hideHandles(); // точка спавну — просто точка, без хендлів масштабу/повороту
      selPanel.innerHTML = renderIconGrid([
        {key:'eye', dataAct:'panelEye', icon:'👁', title:'Показати/сховати панель'}, animItem(),
        {key:'spawnEdit', dataAct:'spawn-edit', icon:'✎', title:'Тип: '+(sp.spawnType||'?')+' · Шанс: '+(sp.chance!=null?sp.chance:100)+'%'},
        {key:'dup', dataAct:'spawn-dup', icon:t('dupBtn'), title:'Дублювати'},
        {key:'del', dataAct:'spawn-del', icon:'🗑', title:'Видалити', cls:'del'}
      ]);
    } else {
      var s = project.collisions.find(function(cc){return cc.id===selected.id;});
      if(!s){ selected=null; selPanel.style.display='none'; hideHandles(); return; }
      if(s.shape==='circle') screenPt = worldToScreen(s.x, s.y - s.r);
      else if(s.shape==='poly'){ var pbx = polyBBox(s); screenPt = worldToScreen((pbx.x0+pbx.x1)/2, pbx.y0); }
      else screenPt = worldToScreen((s.x0+s.x1)/2, s.y0);
      if(s.locked){
        selPanel.innerHTML = renderIconGrid([
          {key:'eye', dataAct:'panelEye', icon:'👁', title:'Показати/сховати панель'}, animItem(),
          {key:'lock', dataAct:'cunlock', icon:'🔒', title:'Розблокувати'}
        ]);
        hideHandles();
      } else {
        // Колізіям не потрібні тінь/z (це властивості спрайту-плейсменту, не форми-колізії) —
        // тому тут лише переміщення (drag, вже працює), масштаб (хендли, вже працює),
        // копіювання, блокування, видалення. "Перевернути" не додано: осесиметричний
        // прямокутник/коло виглядає ІДЕНТИЧНО після дзеркалення — кнопка була б декоративною
        // пустушкою. Кнопка типу циклічно перемикає solid→trigger→floorTransition і одразу
        // питає group/floor полями через promptCollisionMeta().
        var typeIcon = s.type==='trigger' ? '🚪' : (s.type==='floorTransition' ? '🪜' : '⛊');
        var typeTitle = s.type==='trigger' ? 'Тип: Тригер (тап — змінити)' : (s.type==='floorTransition' ? 'Тип: Перехід між поверхами (тап — змінити)' : 'Тип: Звичайна колізія (тап — змінити)');
        selPanel.innerHTML = renderIconGrid([
          {key:'eye', dataAct:'panelEye', icon:'👁', title:'Показати/сховати панель'}, animItem(),
          {key:'ctype', dataAct:'ctype', icon:typeIcon, title:typeTitle},
          {key:'cfloor', dataAct:'cfloor', icon:'Пов.'+(s.onFloor||1), title:'Поверх колізії (тап — змінити)'},
          {key:'dup', dataAct:'cdup', icon:t('dupBtn'), title:'Дублювати'},
          {key:'lock', dataAct:'clock', icon:'🔓', title:'Заблокувати'},
          {key:'del', dataAct:'del', icon:'🗑', title:'Видалити', cls:'del'}
        ]);
        if(s.shape==='poly') hideHandles(); else updateHandles(collisionBBox(s));
      }
    }
    // Сховано (тап по оку) — показуємо ЛИШЕ саме око, щоб можна було тапнути й повернути панель.
    if(selPanelHidden){ selPanel.innerHTML = EYE_BTN_HTML + animBtnHtml(); hideHandles(); }
    selPanel.style.display = dragging ? 'none' : 'block';
    if(draggingPanelPos) return; // саму панель зараз тягне користувач за кнопку ока — не перебивати позицію, її вже оновлює власний обробник drag
    var pw = selPanel.offsetWidth || (selected.type==='multi' ? 240 : 160);
    if(selPanelCustomPos){
      // Користувач утримав і перетягнув панель раніше — вона лишається саме там для БУДЬ-ЯКОГО
      // наступного виділення, замість автопозиціювання під обʼєктом.
      selPanel.style.left = Math.max(4, Math.min(r.width-pw-4, selPanelCustomPos.left)) + 'px';
      selPanel.style.top = Math.max(4, Math.min(r.height-40, selPanelCustomPos.top)) + 'px';
      return;
    }
    // Позиція за замовчуванням — ЗАВЖДИ лівий верхній кут (а не біля обʼєкта, де вона перекривала те, на що тиснеш).
    // Перетягнув за 👁 — далі лишається там.
    selPanel.style.left = '6px';
    selPanel.style.top = '6px';
  }
  function animTitle(){ return animUiOn ? 'Анімація увімкнена (тап рукою по тайлу грає один цикл). Тап — вимкнути' : 'Анімація вимкнена. Тап — увімкнути'; }
  function animItem(){ return {key:'anim', dataAct:'animToggle', icon:'🎞', title:animTitle(), cls: animUiOn ? '' : 'anim-off'}; }
  function animBtnHtml(){ return '<button data-act="animToggle" title="'+animTitle()+'"'+(animUiOn ? '' : ' class="anim-off"')+'>🎞</button>'; }
