/* js/preview.js — Режим «👁 Перегляд» (персонаж): стан pvs, порядок малювання, кнопки й жести.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function pvIsFloorTag(v){ return typeof v === 'string' && v.trim().toLowerCase() === 'підлога'; }
  function pvTileIsGround(tileId){
    if(pvTileGround && pvTileGround.has(tileId)) return pvTileGround.get(tileId);
    var t = project.tiles[tileId], res = false;
    if(t){
      if(pvIsFloorTag(t.tag)) res = true;
      var fid = t.folderId;
      for(var n=0; !res && fid && n<50; n++){
        var f = (project.tileFolders||[]).find(function(x){ return x.id === fid; });
        if(!f) break;
        if(pvIsFloorTag(f.tag) || (pvs.fallback && /^(ромби|плита)$/i.test(String(f.name||'').trim()))) res = true;
        fid = f.parentId;
      }
    }
    if(pvTileGround) pvTileGround.set(tileId, res);
    return res;
  }
  function pvIsGround(p){ return pvIsFloorTag(p.tag) || pvTileIsGround(p.tileId); }
  function pvFloorOf(p){ return p.isRoof ? 1000 : ((p.floor >= 1) ? Math.min(15, Math.floor(p.floor)) : 1); }
  function pvSy(p){ var t = project.tiles[p.tileId], ga = t ? gridAnchorOffset(t) : {x:0,y:0}; return ((p.sortY != null) ? p.sortY : p.y) + ga.y; }
  function pvAnyFloorTag(){
    if(project.placements.some(function(p){ return pvIsFloorTag(p.tag); })) return true;
    if(Object.keys(project.tiles).some(function(id){ return pvIsFloorTag(project.tiles[id].tag); })) return true;
    return (project.tileFolders||[]).some(function(f){ return pvIsFloorTag(f.tag); });
  }
  function pvMaxFloor(){
    var mx = 1;
    project.placements.forEach(function(p){ if(!p.isRoof && p.floor > mx) mx = Math.min(15, Math.floor(p.floor)); });
    return mx;
  }
  // Групи, у яких стоїть персонаж: ноги на ромбі «Підлоги» цієї групи на поточному поверсі (запас 8x4 px, як у грі).
  function pvInsideGroups(){
    var set = {};
    project.placements.forEach(function(p){
      if(!p.group || p.isRoof || set[p.group]) return;
      if(pvFloorOf(p) !== pvs.floor || !pvIsGround(p)) return;
      var b = placementBBox(p), cx = (b.x0 + b.x1) / 2, cy = b.y0 + 16.5, hw = (b.x1 - b.x0) / 2, hh = 16.5;
      if(Math.abs(pvs.x - cx) / (hw + 8) + Math.abs(pvs.y - cy) / (hh + 4) <= 1) set[p.group] = true;
    });
    return set;
  }
  function pvOverlapsActor(b){ return !(b.x0 >= pvs.x + PV_HALF_W || b.x1 <= pvs.x - PV_HALF_W || b.y0 >= pvs.y || b.y1 <= pvs.y - PV_H); }
  function pvBuildOrder(vis){
    pvTileGround = new Map();
    var inside = pvInsideGroups();
    pvs.inside = Object.keys(inside);
    var groups = {};
    vis.forEach(function(p){
      if(p.group && inside[p.group] && (p.isRoof || pvFloorOf(p) > pvs.floor)) return; // сховано, як у грі
      var fk = pvFloorOf(p), g = groups[fk] || (groups[fk] = { under:[], stand:[] });
      var it = { p:p, b:placementBBox(p), z:p.z || 0, sy:pvSy(p) };
      (fk === 1000 || pvIsGround(p) ? g.under : g.stand).push(it);
    });
    var keys = Object.keys(groups).map(Number).sort(function(a, b){ return a - b; });
    var byZY = function(a, b){ return (a.z - b.z) || (a.sy - b.sy); };
    var target = null;
    keys.forEach(function(k){ if(k !== 1000 && k <= pvs.floor) target = k; });
    if(target === null){ var fl = keys.filter(function(k){ return k !== 1000; }); target = fl.length ? fl[0] : null; }
    var out = [], placed = false;
    keys.forEach(function(k){
      var g = groups[k]; g.under.sort(byZY); g.stand.sort(byZY);
      g.under.forEach(function(it){ out.push(it.p); });
      var slot = g.stand.length;
      if(k === target){
        for(var i = 0; i < g.stand.length; i++){
          var it = g.stand[i];
          if(it.sy < pvs.y || !pvOverlapsActor(it.b)) continue;
          slot = i; break;
        }
      }
      g.stand.forEach(function(it, i){ if(k === target && i === slot){ out.push(PV_ACTOR); placed = true; } out.push(it.p); });
      if(k === target && slot === g.stand.length){ out.push(PV_ACTOR); placed = true; }
    });
    if(!placed) out.push(PV_ACTOR);
    // Що закриває персонажа: перші тайли ПІСЛЯ нього, що його перекривають (підлоги свого поверху й нижче не рахуємо).
    var cover = [], seen = false;
    for(var j = 0; j < out.length && cover.length < 2; j++){
      if(out[j] === PV_ACTOR){ seen = true; continue; }
      if(!seen) continue;
      var q = out[j];
      if(pvFloorOf(q) <= pvs.floor && pvIsGround(q)) continue;
      if(!pvOverlapsActor(placementBBox(q))) continue;
      var tq = project.tiles[q.tileId];
      cover.push((tq && tq.name ? tq.name : q.tileId) + ' (Z ' + (q.z || 0) + ', Y ' + Math.round(pvSy(q)) + ')');
    }
    pvs.info = 'Ноги: ' + Math.round(pvs.x) + ', ' + Math.round(pvs.y) + ' · поверх ' + pvs.floor
      + (pvs.inside.length ? ' · у будинку ' + pvs.inside.join(', ') : ' · поза будинком')
      + '\n' + (cover.length ? 'Закриває: ' + cover.join('; ') : 'Нічого не закриває')
      + (pvs.fallback ? '\nТег «Підлога» ще не поставлено: беру папки Ромби/Плита' : '');
    pvTileGround = null;
    var box = document.getElementById('pvInfoBox');
    if(box) box.textContent = pvs.info;
    return out;
  }
  function pvDrawActor(c, ox, oy){
    c.save();
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.beginPath(); c.ellipse(ox, oy, 11, 4, 0, 0, Math.PI * 2); c.fill();
    c.fillStyle = '#3b4a2c'; c.fillRect(ox - 7, oy - 12, 5, 12); c.fillRect(ox + 2, oy - 12, 5, 12);
    c.fillStyle = '#6c8f4e'; c.fillRect(ox - 9, oy - 40, 18, 30);
    c.fillStyle = '#4a6b3a'; c.fillRect(ox - 12, oy - 38, 4, 18);
    c.fillStyle = '#d9b38c'; c.fillRect(ox - 6, oy - 54, 12, 14);
    c.fillStyle = '#2f3a24'; c.fillRect(ox - 7, oy - 56, 14, 5);
    c.strokeStyle = '#111'; c.lineWidth = 1; c.strokeRect(ox - 9.5, oy - 40.5, 19, 31);
    c.fillStyle = '#e24b4a'; c.strokeStyle = '#fff'; c.lineWidth = 1.5;
    c.beginPath(); c.arc(ox, oy, 3, 0, Math.PI * 2); c.fill(); c.stroke();
    c.restore();
  }
  function pvSetOn(on){
    pvs.on = on;
    var btn = document.getElementById('previewToggle'), fb = document.getElementById('pvFloorBtn'), box = document.getElementById('pvInfoBox');
    if(btn) btn.classList.toggle('active', on);
    if(fb) fb.style.display = on ? '' : 'none';
    if(on){
      pvs.fallback = !pvAnyFloorTag();
      pvs.savedTool = tool; tool = 'pan'; selected = null;
      var r = wrap.getBoundingClientRect(), c = screenToWorld(r.width / 2, r.height / 2);
      pvs.x = Math.round(c.x); pvs.y = Math.round(c.y + 20);
      if(!box){
        box = document.createElement('div'); box.id = 'pvInfoBox';
        box.style.cssText = 'position:absolute; left:8px; top:8px; z-index:20; max-width:92%; background:rgba(0,0,0,0.72); color:#fff; font-size:12px; line-height:1.4; padding:5px 9px; border-radius:4px; pointer-events:none; white-space:pre-line;';
        if(getComputedStyle(wrap).position === 'static') wrap.style.position = 'relative';
        wrap.appendChild(box);
      }
      box.style.display = '';
    } else {
      if(pvs.savedTool != null) tool = pvs.savedTool;
      if(box) box.style.display = 'none';
    }
    if(typeof updateToolButtons === 'function') updateToolButtons();
    render();
  }

  // z для НОВОГО обʼєкта = baseZ активного шару + 1. Однакове значення для БУДЬ-ЯКОЇ
  // кількості нових обʼєктів за одну операцію (тап, заливка лінією/прямокутником/ромбом) —
  // НЕ зростає з кожним обʼєктом. Наприклад шар з baseZ=40 → усі нові обʼєкти отримують 41,
  // хоч би скільки їх розмістили за раз чи за 10 разів поспіль.
  function newPlacementZ(layerId){
    return (getLayer(layerId).baseZ||0) + 1;
  }
  function pvLocal(e){ var r = wrap.getBoundingClientRect(); return { x: e.clientX - r.left, y: e.clientY - r.top }; }
  function pvHitActor(sx, sy){
    var f = worldToScreen(pvs.x, pvs.y), c = worldToScreen(pvs.x, pvs.y - 28);
    return Math.hypot(sx - f.x, sy - f.y) < 40 || Math.hypot(sx - c.x, sy - c.y) < 40;
  }
  function pvEnd(e){
    if(!pvs.on) return;
    e.stopImmediatePropagation();
    pvPtrs.delete(e.pointerId);
    try{ wrap.releasePointerCapture(e.pointerId); }catch(err){}
    if(pvPtrs.size < 2) pvPinch = null;
    if(pvPtrs.size === 0){ pvDrag = null; pvPan = null; }
    else if(pvPtrs.size === 1){ var r = Array.from(pvPtrs.values())[0]; pvDrag = null; pvPan = { x: r.x, y: r.y }; }
  }
