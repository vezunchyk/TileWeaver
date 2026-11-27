/* js/ui/precise-place.js — Панель точного розміщення (🎯).
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function openPrecisionPanel(){
    if(!selected || selected.type!=='placement') return;
    precisionOpen = true;
    precisionPanelEl.style.display = 'block';
    updatePrecisionOverlay();
    updateSelPanel();
  }
  function closePrecisionPanel(){
    precisionOpen = false;
    precisionPanelEl.style.display = 'none';
    document.getElementById('precCrossH').style.display = 'none';
    document.getElementById('precCrossV').style.display = 'none';
    updateSelPanel();
  }
  function precStepVector(dir){
    // dir: 'up'|'down'|'left'|'right' -> {dx,dy} у world-пікселях
    if(precMode==='pixel'){
      var m = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] }[dir];
      return { dx:m[0]*precStep, dy:m[1]*precStep };
    }
    var cd = { up:[0,-1], down:[0,1], left:[-1,0], right:[1,0] }[dir];
    var o = cellToWorld(0,0), tgt = cellToWorld(cd[0], cd[1]);
    return { dx: tgt.x-o.x, dy: tgt.y-o.y };
  }
  function precMove(dir){
    if(!selected || selected.type!=='placement'){ closePrecisionPanel(); return; }
    var v = precStepVector(dir);
    nudgeSelected(v.dx, v.dy);
    updatePrecisionOverlay();
  }
  function precBindDpad(id, dir){
    var el = document.getElementById(id);
    el.addEventListener('pointerdown', function(e){
      e.preventDefault();
      precMove(dir);
      clearTimeout(precRepeatDelay); clearInterval(precRepeatTimer);
      precRepeatDelay = setTimeout(function(){
        precRepeatTimer = setInterval(function(){ precMove(dir); }, 90);
      }, 350);
    });
    var stop = function(){ clearTimeout(precRepeatDelay); clearInterval(precRepeatTimer); };
    el.addEventListener('pointerup', stop);
    el.addEventListener('pointerleave', stop);
    el.addEventListener('pointercancel', stop);
  }
  // Крихітний хрестик-приціл на канві — показує РІВНО ту точку (anchor/pivot обʼєкта),
  // навколо якої рухається розміщення, замість того, щоб вгадувати по краях текстури.
  function updatePrecisionOverlay(){
    var crossH = document.getElementById('precCrossH'), crossV = document.getElementById('precCrossV');
    if(!precisionOpen) return;
    if(!selected || selected.type!=='placement'){ closePrecisionPanel(); return; }
    var p = placementById(selected.id);
    if(!p){ closePrecisionPanel(); return; }
    var sp = worldToScreen(p.x, p.y);
    crossH.style.display = 'block'; crossV.style.display = 'block';
    crossH.style.top = sp.y+'px';
    crossV.style.left = sp.x+'px';
    document.getElementById('precX').textContent = Math.round(p.x);
    document.getElementById('precY').textContent = Math.round(p.y);
  }
