/* js/init/01-minimap.js — Код запуску теми: Мінімапа та модалка «вся карта» (зум і панорамування). Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- мінімапа ----------
  var showMinimap = false;
  var minimapDirty = true; // true — треба перемалювати кеш "крапок" (тільки коли карта дійсно змінилась, не щокадру)
  var minimapEl = document.getElementById('minimapCanvas');
  var minimapCtx = minimapEl.getContext('2d');
  var minimapContent = document.createElement('canvas'); // кеш "крапок" обʼєктів — важка частина (прохід по всіх placements), перемальовується рідко
  var minimapContentCtx = minimapContent.getContext('2d');
  var minimapBounds = null; // {minX,minY,scale,offX,offY} — переклад світових координат у пікселі мінімапи
  var MINIMAP_CSS_SIZE = 72;

  // Середній колір тайла (для мінімапи) — рахується один раз на tileId і кешується, а не на
  // кожен окремий плейсмент. Без цього всі обʼєкти малювались ОДНИМ узагальненим кольором,
  // тому купа трави (найчастіший тайл) зливалась в суцільну пляму, а будинки/дерева губились
  // серед неї — саме це й виглядало як "тільки трава і то гидким кольором".
  var tileAvgColorCache = {};

  // ---------- модалка "вся карта": зум + панорамування, без миттєвого тапу-телепорту ----------
  var minimapModal = document.getElementById('minimapModal');
  var minimapModalCanvas = document.getElementById('minimapModalCanvas');
  var minimapModalCtx = minimapModalCanvas.getContext('2d');
  var minimapModalBaseBounds = null; // "вписати всю карту" — точка відліку для zoom/pan
  var minimapModalZoom = 1;
  var minimapModalCenter = null;
  // Панорамування прев'ю ВСЕРЕДИНІ модалки (не миттєвий стрибок основної карти по тапу) —
  // "гортаємо" оверв'ю пальцем, основна карта переміщується лише коли явно тиснемо "Перейти".
  var mmDragging = false, mmLastX=0, mmLastY=0, mmMoved=false;
  minimapModalCanvas.addEventListener('pointerdown', function(e){
    e.stopPropagation();
    mmDragging = true; mmMoved = false; mmLastX=e.clientX; mmLastY=e.clientY;
    minimapModalCanvas.setPointerCapture(e.pointerId);
  });
  minimapModalCanvas.addEventListener('pointermove', function(e){
    if(!mmDragging) return;
    e.stopPropagation();
    var dx = e.clientX-mmLastX, dy = e.clientY-mmLastY;
    if(Math.hypot(dx,dy) > 3) mmMoved = true;
    mmLastX=e.clientX; mmLastY=e.clientY;
    var mb = getZoomedModalBounds(minimapModalCanvas.width, minimapModalCanvas.height);
    if(!mb) return;
    var dpr = devicePixelRatio || 1;
    minimapModalCenter.x -= (dx*dpr)/mb.scale;
    minimapModalCenter.y -= (dy*dpr)/mb.scale;
    redrawMinimapModal();
  });
  minimapModalCanvas.addEventListener('pointerup', function(e){ e.stopPropagation(); mmDragging=false; });
  minimapModalCanvas.addEventListener('pointercancel', function(){ mmDragging=false; });
  minimapModalCanvas.addEventListener('wheel', function(e){ e.preventDefault(); e.stopPropagation(); zoomMinimapModal(e.deltaY<0?1.2:1/1.2); }, {passive:false});
  document.getElementById('minimapModalZoomIn').addEventListener('click', function(){ zoomMinimapModal(1.4); });
  document.getElementById('minimapModalZoomOut').addEventListener('click', function(){ zoomMinimapModal(1/1.4); });
  document.getElementById('minimapModalGo').addEventListener('click', function(){
    if(!minimapModalCenter){ minimapModal.style.display='none'; return; }
    var r = wrap.getBoundingClientRect();
    view.panX = r.width/2 - minimapModalCenter.x*view.zoom;
    view.panY = r.height/2 - minimapModalCenter.y*view.zoom;
    minimapModal.style.display = 'none';
    render();
  });
  minimapEl.addEventListener('click', function(e){ e.stopPropagation(); openMinimapModal(); });
  document.getElementById('minimapModalClose').addEventListener('click', function(){ minimapModal.style.display='none'; });
  minimapModal.addEventListener('click', function(e){ if(e.target===minimapModal) minimapModal.style.display='none'; });
