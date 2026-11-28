/* js/init/21-preview.js — Код запуску теми: Режим «👁 Перегляд» (персонаж): стан pvs, порядок малювання, кнопки й жести. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---- «Перегляд»: кнопки і жести ----
  document.getElementById('previewToggle').addEventListener('click', function(){ pvSetOn(!pvs.on); });
  document.getElementById('pvFloorBtn').addEventListener('click', function(){
    var mx = pvMaxFloor();
    pvs.floor = (pvs.floor >= mx) ? 1 : pvs.floor + 1;
    this.textContent = 'Поверх ' + pvs.floor;
    render();
  });
  pvPtrs = new Map(), pvDrag = null, pvPan = null, pvPinch = null;
  wrap.addEventListener('pointerdown', function(e){
    if(!pvs.on) return;
    if(e.target.closest && e.target.closest('#selPanel, #houseViewBar, #shadowPanel')) return;
    e.stopImmediatePropagation(); e.preventDefault();
    try{ wrap.setPointerCapture(e.pointerId); }catch(err){}
    var q = pvLocal(e); pvPtrs.set(e.pointerId, q);
    if(pvPtrs.size === 1){
      if(pvHitActor(q.x, q.y)){ var w = screenToWorld(q.x, q.y); pvDrag = { dx: pvs.x - w.x, dy: pvs.y - w.y }; pvPan = null; }
      else { pvPan = { x: q.x, y: q.y }; pvDrag = null; }
    } else if(pvPtrs.size === 2){
      var a = Array.from(pvPtrs.values()), mid = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
      pvDrag = null; pvPan = null;
      pvPinch = { d: Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1, zoom: view.zoom, w: screenToWorld(mid.x, mid.y) };
    }
  }, true);
  wrap.addEventListener('pointermove', function(e){
    if(!pvs.on || !pvPtrs.has(e.pointerId)) return;
    e.stopImmediatePropagation(); e.preventDefault();
    var q = pvLocal(e); pvPtrs.set(e.pointerId, q);
    if(pvPinch && pvPtrs.size >= 2){
      var a = Array.from(pvPtrs.values()), mid = { x: (a[0].x + a[1].x) / 2, y: (a[0].y + a[1].y) / 2 };
      var d = Math.hypot(a[0].x - a[1].x, a[0].y - a[1].y) || 1;
      view.zoom = Math.max(0.1, Math.min(32, pvPinch.zoom * d / pvPinch.d));
      view.panX = mid.x - pvPinch.w.x * view.zoom; view.panY = mid.y - pvPinch.w.y * view.zoom;
    } else if(pvDrag){
      var w = screenToWorld(q.x, q.y); pvs.x = Math.round(w.x + pvDrag.dx); pvs.y = Math.round(w.y + pvDrag.dy);
    } else if(pvPan){
      view.panX += q.x - pvPan.x; view.panY += q.y - pvPan.y; pvPan = { x: q.x, y: q.y };
    }
    render();
  }, true);
  wrap.addEventListener('pointerup', pvEnd, true);
  wrap.addEventListener('pointercancel', pvEnd, true);
