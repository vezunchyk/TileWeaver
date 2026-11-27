/* js/ui/pivot-picker.js — Піднікер pivot, живе прев'ю, стрілочки корекції, прив'язка до периметра клітинки.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function lpToPx(wx, wy){
    var scale = lpFitScale * livePreviewZoom;
    return {
      x: livePreviewCanvas.width/2  + livePreviewPanX + (wx - lpFitCenterX) * scale,
      y: livePreviewCanvas.height/2 + livePreviewPanY + (wy - lpFitCenterY) * scale
    };
  }
  function lpToWorld(sx, sy){
    var scale = lpFitScale * livePreviewZoom;
    return {
      x: lpFitCenterX + (sx - livePreviewCanvas.width/2  - livePreviewPanX) / scale,
      y: lpFitCenterY + (sy - livePreviewCanvas.height/2 - livePreviewPanY) / scale
    };
  }
  function lpGetStamp(key, builder){
    if(!lpStampCache[key]) lpStampCache[key] = builder();
    return lpStampCache[key];
  }
  // Малює сітку РІВНО ТАКОЮ, якою вона є на активному gridType — не приблизний ромб лініями,
  // а той самий піксельний штамп, що й render() кладе на справжню карту: пунктирний
  // діамант для 'iso' (те саме window.isoGridStamp), точна растрова маска ISO_ASYM_MASK_RUNS
  // для 'isoAsym' (buildIsoAsymStamp — та сама функція, той самий контур пікселя в піксель),
  // і звичайний квадрат для top-down. Кешується окремо від window.isoGridStamp/isoAsymGridStamp
  // головного рендера (інший розмір/колір під прев'ю), щоб не збивати одне одного.
  function lpDrawGridStamp(ctx, cx, cy, isTarget, dispScale){
    var color = isTarget ? 'rgba(201,162,39,0.95)' : 'rgba(255,255,255,0.4)';
    var key = project.gridType + '_' + project.cellSize + '_' + (isTarget?'t':'n');
    if(project.gridType === 'iso'){
      var st = lpGetStamp(key, function(){
        var cw = project.cellSize, hw = Math.floor(cw/2), hh = Math.floor(cw/4);
        var c = document.createElement('canvas'); c.width = Math.max(1,cw); c.height = Math.max(1,hh);
        var sc = c.getContext('2d'); sc.fillStyle = color;
        for(var i=0;i<hh;i++){ sc.fillRect(hw-(i*2), i, 2, 1); if(i>0) sc.fillRect(hw+(i*2), i, 2, 1); }
        return c;
      });
      ctx.drawImage(st, cx-st.width/2, cy-st.height/2);
    } else if(project.gridType === 'isoAsym'){
      var st2 = lpGetStamp(key, function(){ return buildIsoAsymStamp(project.cellSize, color); });
      ctx.drawImage(st2, cx-st2.width/2, cy-st2.height/2);
    } else if(project.gridType === 'isoPixel'){
      var st3 = lpGetStamp(key, function(){ return buildIsoPixelStamp(project.cellSize, color); });
      ctx.drawImage(st3, cx-st3.width/2, cy-st3.height/2);
    } else {
      ctx.strokeStyle = color;
      ctx.lineWidth = (isTarget?1.5:1) / dispScale;
      var cs = project.cellSize;
      ctx.strokeRect(cx-cs/2, cy-cs/2, cs, cs);
    }
  } // 1 = 3x3, 2 = 5x5
  function updateLivePreview(){
    if(!renameTargetId) return;
    var tile = project.tiles[renameTargetId];
    if(!tile || !tile.img || !tile.img.complete || !tile.img.naturalWidth) return;
    var lpCssW = livePreviewCanvas.clientWidth;
    if(lpCssW){
      var lpBw = Math.round(lpCssW * (window.devicePixelRatio || 1));
      if(livePreviewCanvas.width !== lpBw){ livePreviewCanvas.width = lpBw; livePreviewCanvas.height = lpBw; }
    }
    var W = livePreviewCanvas.width, H = livePreviewCanvas.height;
    livePreviewCtx.setTransform(1,0,0,1,0,0);
    livePreviewCtx.clearRect(0,0,W,H);

    var origin = cellToWorld(0,0);
    var c10 = cellToWorld(1,0), c01 = cellToWorld(0,1);
    var stepCol = { x:c10.x-origin.x, y:c10.y-origin.y };
    var stepRow = { x:c01.x-origin.x, y:c01.y-origin.y };
    var cellVerts = diamondVertices();

    var iw = (tile.animFrames > 1) ? tile.img.naturalWidth / tile.animFrames : tile.img.naturalWidth;
    var ih = tile.img.naturalHeight;
    var ga = (pendingAnchorMode === 'edge') ? pointOnDiamond(pendingEdgeT) : { x:0, y:0 };
    var ax = ga.x, ay = ga.y;
    var x0 = Math.round(ax - iw*pendingPivotX), y0 = Math.round(ay - ih*pendingPivotY);

    // ціль + 4 сусіди (ліво/право/верх/низ) — щоб було видно, чи паркан лягає на спільну грань.
    // Межі кадру (fit) НЕ залежать від поточного x0/y0 (де саме зараз намальована текстура) —
    // лише від НАЙГІРШОГО можливого простору, який вона може зайняти (для pivot 0..1 —
    // текстура в межах [ax-iw..ax+iw] × [ay-ih..ay+ih]; для pivot поза картинкою межі розширюються). Якщо рахувати межі від
    // ФАКТИЧНОЇ позиції текстури, то кожен зсув pivot на 1px трохи зсуває і саму "камеру"
    // прев'ю — сітка починає сіпатись/мерехтіти відносно текстури саме тоді, коли намагаєшся
    // точно прицілитись. Тепер кадр стабільний: рухається тільки текстура, сітка стоїть на місці.
    // Сітка навколо клітинки: квадрат (2R+1)x(2R+1). R=1 -> 3x3 (за замовчуванням), R=2 -> 5x5 (кнопка біля ⟲).
    // Цільова клітинка (0,0) лишається першою, щоб підсвічувалась і малювалась так само, як раніше.
    var neigh = [ {c:0,r:0} ];
    for(var nr=-lpGridRadius; nr<=lpGridRadius; nr++){ for(var nc=-lpGridRadius; nc<=lpGridRadius; nc++){ if(nc!==0 || nr!==0) neigh.push({c:nc, r:nr}); } }
    var minX=Math.min(ax-iw, x0), minY=Math.min(ay-ih, y0), maxX=Math.max(ax+iw, x0+iw), maxY=Math.max(ay+ih, y0+ih);
    neigh.forEach(function(o){
      var cx = o.c*stepCol.x + o.r*stepRow.x, cy = o.c*stepCol.y + o.r*stepRow.y;
      cellVerts.forEach(function(v){
        minX=Math.min(minX,cx+v.x); maxX=Math.max(maxX,cx+v.x);
        minY=Math.min(minY,cy+v.y); maxY=Math.max(maxY,cy+v.y);
      });
    });
    var pad = 10;
    lpFitScale = Math.min((W-2*pad)/(maxX-minX||1), (H-2*pad)/(maxY-minY||1));
    lpFitScale = Math.min(lpFitScale, 3 * Math.max(1, W/220));
    if(lpFitScale >= 1) lpFitScale = Math.floor(lpFitScale); // ціле масштаб — усі пікселі однакової ширини
    lpFitCenterX = (minX+maxX)/2; lpFitCenterY = (minY+maxY)/2;
    var dispScale = lpFitScale * livePreviewZoom;

    // Далі весь малюнок іде в координатах СВІТУ (тих самих, що cellToWorld/placementBBox) —
    // canvas сам масштабує й зсуває через translate/scale, тому ніде більше не множимо
    // вручну на dispScale і не ведемо окремий переклад в екранні пікселі (як робили раніше
    // через lpToPx у циклі) — це і простіше, і повністю усуває розсинхрон між тим, як
    // малюється сітка і як малюється текстура.
    livePreviewCtx.save();
    livePreviewCtx.translate(W/2 + livePreviewPanX, H/2 + livePreviewPanY);
    livePreviewCtx.scale(dispScale, dispScale);
    livePreviewCtx.translate(-lpFitCenterX, -lpFitCenterY);
    livePreviewCtx.imageSmoothingEnabled = false;

    neigh.forEach(function(o){
      var cx = o.c*stepCol.x + o.r*stepRow.x, cy = o.c*stepCol.y + o.r*stepRow.y;
      var isTarget = (o.c===0 && o.r===0);
      // приблизна залита підсвітка клітинки (не обов'язково піксельно точна форма — просто тло)
      livePreviewCtx.beginPath();
      cellVerts.forEach(function(v,i){
        var wx = cx+v.x, wy = cy+v.y;
        if(i===0) livePreviewCtx.moveTo(wx,wy); else livePreviewCtx.lineTo(wx,wy);
      });
      livePreviewCtx.closePath();
      livePreviewCtx.fillStyle = isTarget ? 'rgba(201,162,39,0.15)' : 'rgba(255,255,255,0.04)';
      livePreviewCtx.fill();
      // ТОЧНИЙ контур активної сітки (iso/isoAsym/2d) — піксель у піксель як на карті
      lpDrawGridStamp(livePreviewCtx, cx, cy, isTarget, dispScale);
    });

    livePreviewCtx.drawImage(tile.img, 0, 0, iw, ih, x0, y0, iw, ih);

    livePreviewCtx.beginPath();
    livePreviewCtx.arc(ax, ay, 4/dispScale, 0, Math.PI*2);
    livePreviewCtx.fillStyle = '#c0392b';
    livePreviewCtx.strokeStyle = '#fff';
    livePreviewCtx.lineWidth = 1.5/dispScale;
    livePreviewCtx.fill(); livePreviewCtx.stroke();
    livePreviewCtx.restore();
  }
  function lpDist(a,b){ return Math.hypot(b.x-a.x, b.y-a.y); }
  function lpRebaseGesture(){
    var ids = Object.keys(lpPointers);
    if(ids.length === 1){
      lpGesture = { type:'pan', startPan:{x:livePreviewPanX,y:livePreviewPanY}, startPoint: lpPointers[ids[0]] };
    } else if(ids.length >= 2){
      var p1 = lpPointers[ids[0]], p2 = lpPointers[ids[1]];
      var mid = { x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2 };
      lpGesture = { type:'pinch', startDist: lpDist(p1,p2) || 1, startZoom: livePreviewZoom, anchorWorld: lpToWorld(mid.x, mid.y) };
    } else {
      lpGesture = null;
    }
  }
  function lpCanvasPoint(e){
    var rect = livePreviewCanvas.getBoundingClientRect();
    return {
      x: (e.clientX - rect.left) * (livePreviewCanvas.width / rect.width),
      y: (e.clientY - rect.top) * (livePreviewCanvas.height / rect.height)
    };
  }
  function lpPointerEnd(e){
    delete lpPointers[e.pointerId];
    try{ livePreviewCanvas.releasePointerCapture(e.pointerId); }catch(err){}
    lpRebaseGesture();
    if(!Object.keys(lpPointers).length){ // після pinch зум прилипає до цілого — без «півпікселів»
      var lpSc = lpFitScale * livePreviewZoom;
      if(lpSc >= 1){ livePreviewZoom = Math.round(lpSc) / lpFitScale; updateLivePreview(); }
    }
  }
  function updatePivotDot(){
    // Позиція крапки рахується від РЕАЛЬНОГО розміру прев'ю на екрані (clientWidth/Height),
    // а не від пікселів самого файлу — pivotX/Y завжди нормалізовані 0..1, тому це коректно
    // незалежно від того, наскільки велика чи маленька картинка.
    // Крапка і червона лінія Y-сортування рахуються від позиції картинки у padding-полі (offsetLeft/Top),
    // тож pivot може бути й поза картинкою (pivotX/Y тоді <0 або >1).
    var dotX = pivotPickerImg.offsetLeft + pendingPivotX * pivotPickerImg.clientWidth;
    var dotY = pivotPickerImg.offsetTop + pendingPivotY * pivotPickerImg.clientHeight;
    pivotPickerDot.style.left = dotX + 'px';
    pivotPickerDot.style.top = dotY + 'px';
    var lineEl = document.getElementById('pivotPickerLine');
    if(lineEl) lineEl.style.top = dotY + 'px';
    updateLivePreview();
  }
  function pivotLimits(){
    var w = pivotPickerImg.clientWidth || 1, h = pivotPickerImg.clientHeight || 1;
    return { minX: -PIVOT_PAD.l / w, maxX: 1 + PIVOT_PAD.r / w, minY: -PIVOT_PAD.t / h, maxY: 1 + PIVOT_PAD.b / h };
  }
  function pivotFromEvent(e){
    var rect = pivotPickerImg.getBoundingClientRect();
    var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    var cy = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    var lim = pivotLimits();
    var fx = Math.max(lim.minX, Math.min(lim.maxX, (cx - rect.left) / rect.width));
    var fy = Math.max(lim.minY, Math.min(lim.maxY, (cy - rect.top) / rect.height));
    // pivotX/Y — це частка (0..1), але сам pivot має "прилипати" до КОНКРЕТНОГО пікселя
    // вихідної текстури — інакше при перетягуванні палець рухається плавно, а картинка
    // потім розміщується зі зсувом у пів пікселя чи менше, чого в піксель-арт редакторах
    // бути не повинно (крок завжди мінімум 1px джерела).
    var tile = project.tiles[renameTargetId];
    if(tile && tile.img && tile.img.naturalWidth){
      var iw = (tile.animFrames > 1) ? tile.img.naturalWidth / tile.animFrames : tile.img.naturalWidth;
      var ih = tile.img.naturalHeight;
      fx = Math.round(fx * iw) / iw;
      fy = Math.round(fy * ih) / ih;
    }
    pendingPivotX = fx;
    pendingPivotY = fy;
    updatePivotDot();
  }
  // ---------- Стрілочки корекції pivot на ±1px джерела (поруч із прев'ю) ----------
  // Пальцем по маленькій картинці pivot-пікера важко влучити стабільно — рука тремтить, і
  // точка "тікає" на зайвий піксель. Тут той самий крок (1px джерела, той самий Math.round-
  // snapping, що й у pivotFromEvent), просто без тремтіння руки. Тап = 1 крок, утримання =
  // повтор кожні 90мс — та сама схема, що й у 🎯 панелі точного розміщення на карті.
  //
  // ВАЖЛИВО: pivot і РЕНДЕР текстури рухаються в ПРОТИЛЕЖНИХ напрямках — рендер малюється як
  // x0 = ax - iw*pivotX (і так само по Y). Тобто збільшення pivotX зсуває сам малюнок ЛІВОРУЧ
  // на карті/у прев'ю, а не праворуч. Кнопки тут керують тим, що людина БАЧИТЬ у прев'ю
  // (текстура рухається праворуч/вниз/etc так, як підписано на кнопці), тому знаки навмисно
  // ІНВЕРТОВАНІ відносно сирого pivotX/Y — інакше "→" зсовував би текстуру ліворуч, а "↑" вниз.
  function pivotNudgeStep(dir){
    var tile = project.tiles[renameTargetId];
    var iw = 1, ih = 1;
    if(tile && tile.img && tile.img.naturalWidth){
      iw = (tile.animFrames > 1) ? tile.img.naturalWidth / tile.animFrames : tile.img.naturalWidth;
      ih = tile.img.naturalHeight;
    }
    // {dx,dy} — напрямок, в який має зсунутись ВИДИМА текстура (не сирий pivot)
    var d = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] }[dir];
    var lim = pivotLimits();
    pendingPivotX = Math.max(lim.minX, Math.min(lim.maxX, pendingPivotX - d[0]/iw));
    pendingPivotY = Math.max(lim.minY, Math.min(lim.maxY, pendingPivotY - d[1]/ih));
    updatePivotDot();
  }
  function bindPivotNudge(id, dir){
    var el = document.getElementById(id);
    el.addEventListener('pointerdown', function(e){
      e.preventDefault();
      pivotNudgeStep(dir);
      clearTimeout(pivotNudgeRepeatDelay); clearInterval(pivotNudgeRepeatTimer);
      pivotNudgeRepeatDelay = setTimeout(function(){
        pivotNudgeRepeatTimer = setInterval(function(){ pivotNudgeStep(dir); }, 90);
      }, 350);
    });
    var stop = function(){ clearTimeout(pivotNudgeRepeatDelay); clearInterval(pivotNudgeRepeatTimer); };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointerleave', stop);
    el.addEventListener('pointercancel', stop);
  }
  // Перераховує 4 вершини АКТУАЛЬНОЇ сітки проєкту (diamondVertices(), світові координати,
  // які залежать від gridType/cellSize) у фіксований квадрат SVG 160×160, з відступом і
  // збереженням пропорцій — щоб піктограма завжди показувала форму, схожу на реальну клітинку.
  function computeEdgeAnchorUIVerts(){
    var verts = diamondVertices();
    var maxX = 1, maxY = 1;
    verts.forEach(function(v){ maxX = Math.max(maxX, Math.abs(v.x)); maxY = Math.max(maxY, Math.abs(v.y)); });
    var pad = 22, box = 160/2 - pad;
    var scale = Math.min(box/maxX, box/maxY);
    var cx = 80, cy = 80;
    return verts.map(function(v){ return { x: cx + v.x*scale, y: cy + v.y*scale }; });
  }
  function renderEdgeAnchorSvg(){
    edgeAnchorUIVerts = computeEdgeAnchorUIVerts();
    edgeAnchorPoly.setAttribute('points', edgeAnchorUIVerts.map(function(v){ return v.x+','+v.y; }).join(' '));
    updateEdgeAnchorDotPos();
  }
  function updateEdgeAnchorDotPos(){
    if(pendingAnchorMode === 'edge'){
      var verts = edgeAnchorUIVerts || computeEdgeAnchorUIVerts();
      var seg = pendingEdgeT * 4;
      var i0 = Math.floor(seg) % 4, i1 = (i0+1) % 4, f = seg - Math.floor(seg);
      var a = verts[i0], b = verts[i1];
      var px = a.x + (b.x-a.x)*f, py = a.y + (b.y-a.y)*f;
      edgeAnchorDot.setAttribute('cx', px); edgeAnchorDot.setAttribute('cy', py);
      edgeAnchorDot.style.display = 'block';
      edgeAnchorCenterDot.setAttribute('fill', 'var(--dim)');
      var nearest4 = Math.round(pendingEdgeT*4)%4 === (pendingEdgeT*4) ? EDGE_ANCHOR_LABELS[pendingEdgeT] : null;
      edgeAnchorStatus.textContent = nearest4 ? nearest4 : ('На грані — ' + Math.round(pendingEdgeT*400)/4 + '%');
    } else {
      edgeAnchorDot.style.display = 'none';
      edgeAnchorCenterDot.setAttribute('fill', 'var(--amber)');
      edgeAnchorStatus.textContent = 'Центр клітинки';
    }
    updateLivePreview();
  }
  // Знаходить найближчу до (px,py) точку на периметрі чотирикутника edgeAnchorUIVerts і
  // повертає її як параметр t в [0,1) — той самий формат, що й pointOnDiamond() рахує для
  // реальних ігрових координат. Використовується і для tap, і для drag: користувачу не треба
  // потрапити точно НА лінію, досить тапнути десь поруч — крапка сама "прилипає" до контуру.
  function nearestEdgeT(px, py){
    var verts = edgeAnchorUIVerts || computeEdgeAnchorUIVerts();
    var best = null;
    for(var i=0;i<4;i++){
      var a = verts[i], b = verts[(i+1)%4];
      var abx = b.x-a.x, aby = b.y-a.y;
      var apx = px-a.x, apy = py-a.y;
      var lenSq = abx*abx+aby*aby;
      var f = lenSq ? Math.max(0, Math.min(1, (apx*abx+apy*aby)/lenSq)) : 0;
      var cx = a.x+abx*f, cy = a.y+aby*f;
      var dx = px-cx, dy = py-cy, d2 = dx*dx+dy*dy;
      if(best===null || d2<best.d2) best = { d2:d2, t:(i+f)/4 };
    }
    return best.t;
  }
  function edgeAnchorFromEvent(e){
    var rect = edgeAnchorSvg.getBoundingClientRect();
    var cx = (e.touches && e.touches[0]) ? e.touches[0].clientX : e.clientX;
    var cy = (e.touches && e.touches[0]) ? e.touches[0].clientY : e.clientY;
    // viewBox 0..160 == розмір елемента 160×160px, тому переклад координат — проста лінійна
    var px = (cx - rect.left) * (160/rect.width), py = (cy - rect.top) * (160/rect.height);
    // Тап прямо по центральній крапці (чи дуже близько до неї) перемикає в режим "центр",
    // навіть якщо найближча точка периметра формально ближче — це навмисний "магніт", інакше
    // важко влучити саме в центр на маленькому тач-екрані.
    var dcx = px-80, dcy = py-80;
    if(dcx*dcx+dcy*dcy < 16*16){
      pendingAnchorMode = 'center';
    } else {
      pendingAnchorMode = 'edge';
      pendingEdgeT = nearestEdgeT(px, py);
    }
    updateEdgeAnchorDotPos();
  }
  function openRename(id){
    renameTargetId=id;
    renameInput.value=project.tiles[id].name;
    updateTagButtons();
    var tile = project.tiles[id];
    var animEnabledEl = document.getElementById('animEnabled');
    var animFieldsEl = document.getElementById('animFields');
    animEnabledEl.checked = !!tile.animFrames;
    animFieldsEl.style.display = tile.animFrames ? 'block' : 'none';
    document.getElementById('animFrameCount').value = tile.animFrames || 4;
    document.getElementById('animFrameMs').value = tile.animFrameMs || 150;
    document.getElementById('animLoop').checked = !!tile.animLoop;
    pendingVariableFrames = (hasVariableFrames(tile)) ? tile.frames.slice() : null;
    document.getElementById('variableFramesEnabled').checked = !!pendingVariableFrames;
    toggleVariableFramesUI();
    updateFrameMarkSummary();
    var pv = tilePivot(tile);
    pendingPivotX = pv.x; pendingPivotY = pv.y;
    livePreviewZoom = 1; livePreviewPanX = 0; livePreviewPanY = 0;
    lpPointers = {}; lpGesture = null;
    if(typeof tile.edgeAnchorT === 'number'){
      pendingAnchorMode = 'edge'; pendingEdgeT = tile.edgeAnchorT;
    } else if(tile.gridAnchor && tile.gridAnchor !== 'center'){
      // старий проєкт (тільки gridAnchor-вершина, без edgeAnchorT) — показуємо як точку рівно
      // на відповідній вершині нового picker'а; при наступному "OK" збережеться вже як edgeAnchorT
      pendingAnchorMode = 'edge';
      pendingEdgeT = { top:0, right:0.25, bottom:0.5, left:0.75 }[tile.gridAnchor] || 0;
    } else {
      pendingAnchorMode = 'center'; pendingEdgeT = 0;
    }
    renderEdgeAnchorSvg();
    pivotPickerImg.src = tile.dataURL;
    pivotPickerImg.onload = updatePivotDot;
    if(pivotPickerImg.complete) updatePivotDot();
    document.getElementById('anchorApplyFolderMsg').style.display = 'none';
    livePreviewPanel.style.display = 'block';
    renameModal.style.display='flex';
  }
  function toggleVariableFramesUI(){
    var on = document.getElementById('variableFramesEnabled').checked;
    document.getElementById('uniformFrameCountRow').style.display = on ? 'none' : 'block';
    document.getElementById('variableFramesBlock').style.display = on ? 'block' : 'none';
    // Коли кадри різної ширини увімкнені — у кожного кадру ТЕПЕР своя точка прив'язки
    // (виставляється в екрані розмітки), тож загальний піпер точки прив'язки на весь тайл
    // втрачає сенс — ховаємо його повністю, а не тільки одне поле.
    document.getElementById('singlePivotSection').style.display = on ? 'none' : 'block';
    if(!on) pendingVariableFrames = null;
  }
  function updateFrameMarkSummary(){
    var el = document.getElementById('variableFramesSummary');
    el.textContent = (pendingVariableFrames && pendingVariableFrames.length)
      ? 'Розмічено кадрів: ' + pendingVariableFrames.length
      : 'Кадри ще не розмічені — натисни кнопку нижче';
  }
