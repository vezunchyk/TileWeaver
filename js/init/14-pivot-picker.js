/* js/init/14-pivot-picker.js — Код запуску теми: Піднікер pivot, живе прев'ю, стрілочки корекції, прив'язка до периметра клітинки. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */

  // ---------- Живе прев'ю точки прив'язки (окрема плаваюча панель, лівий верхній кут) ----------
  // Показує ЦІЛЬОВУ клітинку і 4 сусідні (тим самим базисом сітки, що й cellToWorld/isoCell),
  // а поверх — реальну текстуру, намальовану ТОЧНО за тією ж формулою, що й на карті
  // (placementBBox: ax=anchor.x, ay=anchor.y, x0=ax-w*pivotX, y0=ay-h*pivotY) — тобто це не
  // приблизна ілюстрація, а той самий розрахунок, що виконає рушій під час гри.
  var livePreviewPanel = document.getElementById('livePreviewPanel');
  var livePreviewCanvas = document.getElementById('livePreviewCanvas');
  var livePreviewCtx = livePreviewCanvas.getContext('2d');
  // Користувацький zoom/pan прев'ю — НЕ перераховується щоразу заново, а зберігається між
  // кадрами, поки відкрита ця ж модалка: livePreviewZoom (множник поверх авто-підбору масштабу)
  // і livePreviewPanX/Y (зсув у ПІКСЕЛЯХ канваса). Скидаються в 1/0/0 тільки при відкритті
  // модалки для (нового) тайла — щоб кожна текстура спершу показувалась "як влізе", а далі
  // користувач сам зближує/пересуває пальцями під себе.
  var livePreviewZoom = 1, livePreviewPanX = 0, livePreviewPanY = 0;
  var LP_ZOOM_MIN = 0.4, LP_ZOOM_MAX = 12;
  // lpFit* — параметри автопідбору (масштаб і світовий центр кадру), рахуються заново на
  // кожен виклик updateLivePreview() від актуального bbox тайла, і є "базою", НА ЯКУ вже
  // накладається livePreviewZoom/Pan. Винесені в зовнішню область видимості, бо потрібні і
  // рендеру, і обробникам жестів (переклад екранних координат пальця в світові).
  var lpFitScale = 1, lpFitCenterX = 0, lpFitCenterY = 0;
  var lpStampCache = {};
  var lpGridRadius = 1;
  // ---------- Жести на прев'ю: 1 палець = pan, 2 пальці = pinch-zoom ----------
  // Активні дотики зберігаються за pointerId, щоб коректно розрізняти перехід 1↔2 пальці
  // (наприклад користувач почав тягнути одним пальцем, потім доклав другий — жест має плавно
  // переключитись з pan на pinch, а не смикнутись). "База" жесту перераховується щоразу, як
  // змінюється КІЛЬКІСТЬ активних пальців (lpRebaseGesture) — так і pan, і pinch завжди
  // рахуються від свіжої точки старту, без накопичення похибки за багато кадрів.
  var lpPointers = {};
  var lpGesture = null;
  livePreviewCanvas.addEventListener('pointerdown', function(e){
    e.preventDefault();
    livePreviewCanvas.setPointerCapture(e.pointerId);
    lpPointers[e.pointerId] = lpCanvasPoint(e);
    lpRebaseGesture();
  });
  livePreviewCanvas.addEventListener('pointermove', function(e){
    if(!(e.pointerId in lpPointers)) return;
    lpPointers[e.pointerId] = lpCanvasPoint(e);
    if(!lpGesture) return;
    if(lpGesture.type === 'pan' && Object.keys(lpPointers).length === 1){
      var p = lpPointers[e.pointerId];
      livePreviewPanX = lpGesture.startPan.x + (p.x - lpGesture.startPoint.x);
      livePreviewPanY = lpGesture.startPan.y + (p.y - lpGesture.startPoint.y);
    } else if(lpGesture.type === 'pinch' && Object.keys(lpPointers).length >= 2){
      var ids = Object.keys(lpPointers);
      var p1 = lpPointers[ids[0]], p2 = lpPointers[ids[1]];
      var newDist = lpDist(p1,p2);
      var mid = { x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2 };
      livePreviewZoom = Math.max(LP_ZOOM_MIN, Math.min(LP_ZOOM_MAX, lpGesture.startZoom * (newDist/lpGesture.startDist)));
      // Тримаємо anchorWorld (світову точку, що була під серединою пальців на СТАРТІ жесту)
      // рівно під поточною серединою пальців — це і є "звична" поведінка pinch-zoom з інших
      // застосунків: куди тицьнув — те й лишається під пальцями, решта масштабується довкола.
      var scale = lpFitScale * livePreviewZoom;
      livePreviewPanX = mid.x - livePreviewCanvas.width/2  - (lpGesture.anchorWorld.x - lpFitCenterX) * scale;
      livePreviewPanY = mid.y - livePreviewCanvas.height/2 - (lpGesture.anchorWorld.y - lpFitCenterY) * scale;
    }
    updateLivePreview();
  });
  livePreviewCanvas.addEventListener('pointerup', lpPointerEnd);
  livePreviewCanvas.addEventListener('pointercancel', lpPointerEnd);
  document.getElementById('livePreviewGridBtn').addEventListener('click', function(){
    lpGridRadius = (lpGridRadius === 1) ? 2 : 1;
    this.textContent = (2*lpGridRadius+1) + '×' + (2*lpGridRadius+1);
    livePreviewZoom = 1; livePreviewPanX = 0; livePreviewPanY = 0;
    updateLivePreview();
  });
  document.getElementById('livePreviewResetBtn').addEventListener('click', function(){
    livePreviewZoom = 1; livePreviewPanX = 0; livePreviewPanY = 0;
    updateLivePreview();
  });
  // Pivot може лежати ЗА межами картинки (вершок: на лінії дверей під ним; сходи: на задньому краї).
  // Допустима зона = пунктирне поле навколо картинки в піднікері (відступи нижче, у px на екрані).
  var PIVOT_PAD = { l:40, r:40, t:40, b:100 };
  var pivotDragging = false;
  pivotPickerWrap.addEventListener('pointerdown', function(e){ pivotDragging = true; pivotFromEvent(e); });
  pivotPickerWrap.addEventListener('pointermove', function(e){ if(pivotDragging) pivotFromEvent(e); });
  window.addEventListener('pointerup', function(){ pivotDragging = false; });
  document.querySelectorAll('.pivot-preset').forEach(function(btn){
    btn.addEventListener('click', function(){
      pendingPivotX = parseFloat(btn.dataset.px); pendingPivotY = parseFloat(btn.dataset.py);
      updatePivotDot();
    });
  });
  var pivotNudgeRepeatTimer = null, pivotNudgeRepeatDelay = null;
  bindPivotNudge('pivotNudgeUp', 'up'); bindPivotNudge('pivotNudgeDown', 'down');
  bindPivotNudge('pivotNudgeLeft', 'left'); bindPivotNudge('pivotNudgeRight', 'right');
  // ---------- Прив'язка точки pivot до довільної точки на ПЕРИМЕТРІ клітинки ----------
  // Раніше pivot ЗАВЖДИ мапився на ЦЕНТР клітинки (ту саму точку, куди стає центр суцільного
  // тайла-ромба) — тому для обʼєктів, що стоять на ГРАНІ (паркани, стіни), доводилось шукати
  // на текстурі якусь умовну точку "в порожньому просторі" за межами самого малюнка, щоб
  // компенсувати зсув від центру до грані. Потім зʼявилась прив'язка до ВЕРШИНИ ромба — але
  // паркан, що стоїть ПОСЕРЕДИНІ грані (не в куті), все одно не міг бути виставлений точно.
  //
  // Тепер: художник тапає ПРЯМО на видиму частину малюнка (pivot — де він реально торкається
  // землі, це вище) і окремо перетягує крапку по контуру ромба-піктограми нижче — вона
  // прилипає до НАЙБЛИЖЧОЇ точки периметра (не тільки до вершин), і зберігається як одне
  // число edgeAnchorT (0..1, див. pointOnDiamond). Двоклацнута крапка в центрі ромба означає
  // "звичайний тайл, без зсуву" (той самий режим, що раніше звався gridAnchor:'center').
  var pendingAnchorMode = 'center'; // 'center' | 'edge'
  var pendingEdgeT = 0;
  var edgeAnchorSvg = document.getElementById('edgeAnchorSvg');
  var edgeAnchorPoly = document.getElementById('edgeAnchorPoly');
  var edgeAnchorDot = document.getElementById('edgeAnchorDot');
  var edgeAnchorCenterDot = document.getElementById('edgeAnchorCenterDot');
  var edgeAnchorStatus = document.getElementById('edgeAnchorStatus');
  var edgeAnchorUIVerts = null; // 4 точки ромба в координатах SVG (viewBox 0..160), лічені при відкритті модалки
  var EDGE_ANCHOR_LABELS = { 0:'Верхня грань', 0.25:'Права грань', 0.5:'Нижня грань', 0.75:'Ліва грань' };
  var edgeAnchorDragging = false;
  document.getElementById('edgeAnchorWrap').addEventListener('pointerdown', function(e){ edgeAnchorDragging = true; edgeAnchorFromEvent(e); });
  document.getElementById('edgeAnchorWrap').addEventListener('pointermove', function(e){ if(edgeAnchorDragging) edgeAnchorFromEvent(e); });
  window.addEventListener('pointerup', function(){ edgeAnchorDragging = false; });
  document.getElementById('edgeAnchorCenterBtn').addEventListener('click', function(){
    pendingAnchorMode = 'center'; updateEdgeAnchorDotPos();
  });
  document.querySelectorAll('.edge-anchor-preset').forEach(function(btn){
    btn.addEventListener('click', function(){
      pendingAnchorMode = 'edge'; pendingEdgeT = parseFloat(btn.dataset.t);
      updateEdgeAnchorDotPos();
    });
  });
  document.getElementById('animEnabled').addEventListener('change', function(e){
    document.getElementById('animFields').style.display = e.target.checked ? 'block' : 'none';
  });
  document.getElementById('variableFramesEnabled').addEventListener('change', toggleVariableFramesUI);
  document.getElementById('openFrameMarkBtn').addEventListener('click', function(){
    var tile = project.tiles[renameTargetId];
    if(!tile || !tile.img || !tile.img.naturalWidth){ toast(t('toastImgNotLoaded')); return; }
    openFrameMark(tile, pendingVariableFrames);
  });
