/* js/render.js — Малювання карти: render()/renderNow()/renderCore(), режим ?perf, сітка, оверлеї.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  // Розміщення з індексу в заданому прямокутнику (за зростанням позиції в масиві) або null, якщо індекс
  // не побудований чи застарів (тоді викликач перебирає всі, як раніше). Використовує хіт-тест.
  function indexedPlacements(x0, y0, x1, y1){
    var ist = idxState, arr = project.placements;
    if(!ist.arr || ist.arr !== arr || ist.len !== arr.length || ist.epoch !== placementsEpoch) return null;
    var ln = 0;
    for(var k in project.tiles){ var t = project.tiles[k]; if(t && t.img && t.img.complete && t.img.naturalWidth) ln++; }
    if(ist.loaded !== ln) return null;
    var q = ist.index.query(x0, y0, x1, y1), out = new Array(q.length);
    for(var i = 0; i < q.length; i++) out[i] = arr[q[i]];
    return out;
  }
  function renderNow(){
    if(!PERF){ renderCore(); return; }
    var t0 = performance.now(); renderCore(); perfFrameMs = performance.now() - t0;
    perfAvg = perfAvg ? perfAvg*0.9 + perfFrameMs*0.1 : perfFrameMs;
    if(t0 - perfLastShow > 250){
      perfLastShow = t0;
      if(!perfEl){
        perfEl = document.createElement('div');
        perfEl.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99999;background:rgba(0,0,0,.75);color:#9f9;font:10px/1.3 monospace;padding:3px 5px;pointer-events:none;white-space:pre';
        document.body.appendChild(perfEl);
      }
      var us = undoMgr.stats();
      perfEl.textContent = 'кадр ' + perfFrameMs.toFixed(1) + ' мс (сер. ' + perfAvg.toFixed(1) + ')\nвидимих ' + perfLastVisible + ' / всіх ' + project.placements.length + (perfIdxOn ? ' · індекс' : ' · повний прохід') +
        '\nзбереження ' + lastSaveMs.toFixed(0) + ' мс · undo-запис ' + us.lastPushMs.toFixed(1) + ' мс (кроків ' + us.steps + ')';
    }
  }
  function renderCore(){
    var r = wrapRectCache || (wrapRectCache = wrap.getBoundingClientRect());
    var zFloor = Math.sqrt(Math.max(1, r.width*r.height)/12000000); if(view.zoom < zFloor) view.zoom = zFloor; // offCanvas ≤ ~12 Мп
    syncShadows();
    ctx.clearRect(0,0,r.width,r.height);
    document.getElementById('emptyState').style.display =
      (project.placements.length===0 && Object.keys(project.tiles).length===0) ? 'block' : 'none';

    if(view.zoom >= 6){
      var cs = 1;
      var tlc = screenToWorld(0,0), brc = screenToWorld(r.width, r.height);
      var minCx = Math.floor(tlc.x/cs)-1, maxCx = Math.ceil(brc.x/cs)+1;
      var minCy = Math.floor(tlc.y/cs)-1, maxCy = Math.ceil(brc.y/cs)+1;
      if((maxCx-minCx)*(maxCy-minCy) < 60000){
        ctx.fillStyle = '#c9c9c2';
        ctx.fillRect(0,0,r.width,r.height);
        ctx.fillStyle = '#a8a8a0';
        for(var ccx=minCx; ccx<maxCx; ccx++){
          for(var ccy=minCy; ccy<maxCy; ccy++){
            if(((ccx+ccy)&1)===0) continue;
            var p0 = worldToScreen(ccx*cs, ccy*cs);
            var p1 = worldToScreen((ccx+1)*cs, (ccy+1)*cs);
            var qx0 = roundDevicePx(p0.x), qy0 = roundDevicePx(p0.y);
            var qx1 = roundDevicePx(p1.x), qy1 = roundDevicePx(p1.y);
            ctx.fillRect(qx0, qy0, qx1-qx0, qy1-qy0);
          }
        }
      }
    }

    // --- БЕКБУФЕР: сітка + тайли малюються в масштабі 1:1 (без зуму), прив'язані до цілої світової точки ---
    var tl0 = screenToWorld(0,0), br0 = screenToWorld(r.width, r.height);
    var margin = 4;
    var worldX0 = Math.floor(tl0.x) - margin, worldY0 = Math.floor(tl0.y) - margin;
    var logicW = Math.max(1, Math.ceil(br0.x - worldX0) + margin);
    var logicH = Math.max(1, Math.ceil(br0.y - worldY0) + margin);
    if(offCanvas.width !== logicW || offCanvas.height !== logicH){
      offCanvas.width = logicW; offCanvas.height = logicH;
      offCtx.imageSmoothingEnabled = false;
    }
    offCtx.clearRect(0,0,logicW,logicH);

    // Дані на ОДИН кадр (швидкість): видимість шарів і параметри кожного тайла рахуємо раз,
    // а не для кожного з десятків тисяч розміщень. Формули ті самі, що в placementBBox.
    var layerVis = new Map(), frLayers = project.layers || [];
    for(var li=0; li<frLayers.length; li++){ if(!layerVis.has(frLayers[li].id)) layerVis.set(frLayers[li].id, !!frLayers[li].visible); }
    var tdCache = new Map();
    function tileData(id){
      var d = tdCache.get(id);
      if(d !== undefined) return d;
      var tl = project.tiles[id];
      if(!tl || !tl.img || !tl.img.complete || !tl.img.naturalWidth){ tdCache.set(id, null); return null; }
      d = { tile:tl, ih:tl.img.naturalHeight, variable:hasVariableFrames(tl), extra:0, anim:tl.animFrames > 1 };
      var iw = tl.img.naturalWidth, pv;
      if(d.variable){
        var f0 = tl.frames[0]; iw = f0.w; pv = { x:f0.pivotX, y:f0.pivotY };
        var ex = tileMaxFrameW(tl) - f0.w; if(ex > 0) d.extra = ex;
      } else {
        if(tl.animFrames > 1) iw = iw / tl.animFrames;
        pv = tilePivot(tl);
      }
      var ga = gridAnchorOffset(tl);
      d.iw = iw; d.pvx = pv.x; d.pvy = pv.y; d.gax = ga.x; d.gay = ga.y;
      tdCache.set(id, d);
      return d;
    }
    var sorted = [];
    var allPl = project.placements, plN = allPl.length;
    var cullX1 = worldX0 + logicW, cullY1 = worldY0 + logicH;
    // Межі розміщення (ті самі формули, що в відсіканні нижче) — для просторового індексу
    function idxBox(p, o){
      var d = tileData(p.tileId); if(d === null) return false;
      var w = d.iw * p.scaleX, h = d.ih * p.scaleY;
      var x0 = p.x + d.gax - w*d.pvx, y0 = p.y + d.gay - h*d.pvy, x1 = x0 + w, y1 = y0 + h;
      if(d.extra > 0){ x0 -= d.extra; x1 += d.extra; }
      o[0] = x0; o[1] = y0; o[2] = x1; o[3] = y1; return true;
    }
    // Просторовий індекс вмикаємо лише коли карта велика і жодним жестом (перетягування, зміна розміру, поворот тощо)
    // розміщення не редагуються — тоді вони не змінюються під час кадру. Під час жестів діє звичайний прохід по всіх
    // розміщеннях (як раніше); при виділеному обʼєкті індекс звіряється з масивом щокадру.
    var cand = null;
    if(plN >= 3000 && !moveMode && !dragTarget && !resizeData && !rotateData && !skewData &&
       (!mode || mode === 'pan' || mode === 'tapPending')){
      var loadedN = 0;
      for(var tk in project.tiles){ var tt = project.tiles[tk]; if(tt && tt.img && tt.img.complete && tt.img.naturalWidth) loadedN++; }
      var ist = idxState; ist.frames++;
      // Коли щось виділено, його поля можуть мінятись з панелі без зміни «епохи» — тоді звіряємо індекс щокадру (один швидкий прохід)
      if(ist.arr !== allPl || ist.len !== plN || ist.epoch !== placementsEpoch || ist.loaded !== loadedN || ist.frames % 120 === 0 || selected !== null){
        if(ist.arr !== allPl) ist.index.reset();
        ist.index.refresh(allPl, idxBox);
        ist.arr = allPl; ist.len = plN; ist.epoch = placementsEpoch; ist.loaded = loadedN;
      }
      cand = ist.index.query(worldX0, worldY0, cullX1, cullY1);
    }
    perfIdxOn = cand !== null;
    function cullPass(list){
      var cn = list ? list.length : plN, bx = list ? idxState.index.box() : null, same = TWSpatial.same;
      for(var ci = 0; ci < cn; ci++){
        var vi = list ? list[ci] : ci, vp = allPl[vi];
        var vd = tileData(vp.tileId);
        if(vd === null) continue;
        var lv = layerVis.get(vp.layerId);
        if(lv === false) continue; // шар не знайдено = типовий шар (видимий), як у getLayer
        // Кадри з tile.frames можуть бути ширші за "офіційний" (перший) кадр — розширюємо межу
        // відсікання, інакше відчинені двері біля краю екрана могли б різко зникати/зʼявлятись.
        var vw = vd.iw * vp.scaleX, vh = vd.ih * vp.scaleY;
        var vx0 = vp.x + vd.gax - vw*vd.pvx, vy0 = vp.y + vd.gay - vh*vd.pvy;
        var vx1 = vx0 + vw, vy1 = vy0 + vh;
        if(vd.extra > 0){ vx0 -= vd.extra; vx1 += vd.extra; }
        if(list){ // сторожа: якщо межі розійшлись з індексом — індекс застарів, цей кадр рахуємо без нього
          var b4 = vi * 4;
          if(!(same(bx[b4], vx0) && same(bx[b4+1], vy0) && same(bx[b4+2], vx1) && same(bx[b4+3], vy1))) return false;
        }
        // Відсікаємо все, що поза видимою областю (+невеликий запас worldX0/Y0 вже з margin).
        if(vx1 < worldX0 || vx0 > cullX1 || vy1 < worldY0 || vy0 > cullY1) continue;
        sorted.push(vp);
      }
      return true;
    }
    if(!cullPass(cand)){
      idxState.index.refresh(allPl, idxBox); idxState.epoch = placementsEpoch;
      sorted.length = 0; cullPass(null);
    }
    var drawList;
    perfLastVisible = sorted.length;
    if(pvs.on){ drawList = pvBuildOrder(sorted); } else { sorted.sort(comparePlacements); drawList = sorted; }
    if(project.gridOver === false) drawGrid(); // під текстурами
    drawList.forEach(function(p){
      if(p === PV_ACTOR){ pvDrawActor(offCtx, pvs.x - worldX0, pvs.y - worldY0); return; }
      var td = tileData(p.tileId);
      if(td === null) return;
      var tile = td.tile;
      var lv2 = layerVis.get(p.layerId);
      if(lv2 === false) return;
      var rot = (p.rotation||0) * Math.PI/180;
      var skewX = p.skewX||0;
      // Анімований тайл: беремо тільки ПОТОЧНИЙ кадр зі смуги (sx = індекс_кадру * ширина_кадру),
      // а не все зображення цілком. Для tile.frames (кадри різної ширини) джерело й БОКС для
      // малювання беремо з ВЛАСНИХ даних поточного кадру (placementRenderBBox), а не з
      // "офіційного" розміру — саме так відчинені двері можуть намалюватись ширшими за зачинені,
      // залишаючись прив'язаними до тієї самої точки (завіси).
      var frameIdx = td.anim ? getAnimFrameIndex(tile, p) : 0;
      var frameH = td.ih;
      var frameW, sx, bw, bh, bx0, by0, pvx, pvy;
      if(td.variable){
        var vf = tileFrameAt(tile, frameIdx);
        frameW = vf.w; sx = vf.x;
        var rb = placementRenderBBox(p, frameIdx);
        bw = rb.w; bh = rb.h; bx0 = rb.x0; by0 = rb.y0; pvx = rb.pv.x; pvy = rb.pv.y;
      } else {
        frameW = td.anim ? tile.img.naturalWidth / tile.animFrames : tile.img.naturalWidth;
        sx = td.anim ? (frameIdx * frameW) : 0;
        bw = td.iw * p.scaleX; bh = td.ih * p.scaleY;
        bx0 = p.x + td.gax - bw*td.pvx; by0 = p.y + td.gay - bh*td.pvy;
        pvx = td.pvx; pvy = td.pvy;
      }
      var bx = Math.round(bx0) - worldX0, by = Math.round(by0) - worldY0;
      var ha = getHouseAlpha(p);
      if(rot || p.flipX || p.flipY || skewX){
        // КРИТИЧНО: обертати/віддзеркалювати треба навколо PIVOT-точки, а НЕ навколо центру bbox —
        // інакше pivot "з'їжджає" з клітинки щоразу, коли міняється кут/фліп.
        offCtx.save();
        offCtx.globalAlpha = ha;
        var pcx = bx + bw*pvx, pcy = by + bh*pvy;
        offCtx.translate(pcx, pcy);
        if(rot) offCtx.rotate(rot);
        offCtx.scale(p.flipX?-1:1, p.flipY?-1:1);
        if(skewX) offCtx.transform(1,0, skewX,1, 0,0);
        offCtx.drawImage(tile.img, sx, 0, frameW, frameH, -bw*pvx, -bh*pvy, bw, bh);
        offCtx.restore();
      } else {
        // Звичайний тайл (майже всі): без save/restore — вони найдорожчі при десятках тисяч тайлів.
        if(ha !== 1) offCtx.globalAlpha = ha;
        offCtx.drawImage(tile.img, sx, 0, frameW, frameH, bx, by, bw, bh);
        if(ha !== 1) offCtx.globalAlpha = 1;
      }
    });

    function drawGrid(){
    if(!showGrid) return;
      var gridColor = gridRgba();
      offCtx.strokeStyle = gridColor; offCtx.lineWidth = 1;
      var tl = tl0, br = br0;
      var corners = [tl, {x:br.x,y:tl.y}, {x:tl.x,y:br.y}, br];
      var minC=Infinity,maxC=-Infinity,minR=Infinity,maxR=-Infinity;
      var boundsFn = worldToCell; // тепер сітка isoAsym рахується в тій самій системі, що й розміщення
      corners.forEach(function(pt){
        var g = boundsFn(pt.x, pt.y);
        minC=Math.min(minC,g.c); maxC=Math.max(maxC,g.c); minR=Math.min(minR,g.r); maxR=Math.max(maxR,g.r);
      });
      minC=Math.floor(minC)-1; maxC=Math.ceil(maxC)+1; minR=Math.floor(minR)-1; maxR=Math.ceil(maxR)+1;
      if((maxC-minC)*(maxR-minR) < 4000){
        for(var c=minC;c<=maxC;c++){
          for(var rr=minR;rr<=maxR;rr++){
            var wc = cellToWorld(c,rr);
            if(project.gridType === 'iso'){
              var cw = project.cellSize;
              var hw = Math.floor(cw / 2);
              var hh = Math.floor(cw / 4);
              if(!window.isoGridStamp || window.isoGridStampSize !== cw){
                window.isoGridStamp = document.createElement('canvas');
                window.isoGridStamp.width = cw; window.isoGridStamp.height = hh;
                window.isoGridStampSize = cw;
                var gsCtx = window.isoGridStamp.getContext('2d');
                gsCtx.fillStyle = gridColor;
                for(var i=0; i<hh; i++){
                  gsCtx.fillRect(hw-(i*2), i, 2, 1);
                  if(i>0) gsCtx.fillRect(hw+(i*2), i, 2, 1);
                }
              }
              var bx = Math.round(wc.x-hw) - worldX0, by = Math.round(wc.y-hh) - worldY0;
              offCtx.drawImage(window.isoGridStamp, bx, by);
            } else if(project.gridType === 'isoAsym'){
              // ВИПРАВЛЕНО: сітка-гід малюється в ТІЙ САМІЙ точці (wc = cellToWorld(c,rr)),
              // що й реальне розміщення тайлів. Раніше тут використовувались окремі
              // ISO_ASYM_TILE_COL/ROW-вектори (вдвічі щільніші за крок розміщення
              // ISO_ASYM_COL/ROW), через що видима на екрані сітка була вдвічі дрібнішою за
              // реальну клітинку — художник рівняв текстуру по "чужій" сітці, і після
              // розміщення низ обʼєкта (напр. паркану) опинявся не на грані видимого ромба,
              // а посередині двох сусідніх (баг, підтверджений скріншот-порівнянням з
              // Pixel Studio: там низ паркану займає РІВНО грань одного ромба). Той самий
              // растр-штамп (ISO_ASYM_MASK_RUNS), що й тайлиться суцільними текстурами без
              // дірок і накладань, тепер малюється тим самим кроком — сітка і розміщення
              // завжди синхронні.
              if(!window.isoAsymGridStamp || window.isoAsymGridStampSize !== project.cellSize){
                window.isoAsymGridStamp = buildIsoAsymStamp(project.cellSize, gridColor);
                window.isoAsymGridStampSize = project.cellSize;
              }
              var stampW = window.isoAsymGridStamp.width, stampH = window.isoAsymGridStamp.height;
              var bxA = Math.round(wc.x - stampW/2) - worldX0, byA = Math.round(wc.y - stampH/2) - worldY0;
              offCtx.drawImage(window.isoAsymGridStamp, bxA, byA);
            } else if(project.gridType === 'isoPixel'){
              // Той самий підхід, що й isoAsym нижче (растровий штамп, кладеться в ТІЙ САМІЙ
              // точці wc = cellToWorld(c,rr), що й розміщення) — тільки маска інша
              // (ISO_PIXEL_MASK_RUNS, знята з референсу користувача, а не з isoAsym).
              if(!window.isoPixelGridStamp || window.isoPixelGridStampSize !== project.cellSize){
                window.isoPixelGridStamp = buildIsoPixelStamp(project.cellSize, gridColor);
                window.isoPixelGridStampSize = project.cellSize;
              }
              var stampWP = window.isoPixelGridStamp.width, stampHP = window.isoPixelGridStamp.height;
              var bxP = Math.round(wc.x - stampWP/2) - worldX0, byP = Math.round(wc.y - stampHP/2) - worldY0;
              offCtx.drawImage(window.isoPixelGridStamp, bxP, byP);
            } else {
              var bx2 = Math.round(wc.x - project.cellSize/2) - worldX0, by2 = Math.round(wc.y - project.cellSize/2) - worldY0;
              offCtx.strokeRect(bx2, by2, project.cellSize, project.cellSize);
            }
          }
        }
      }
    }
    if(project.gridOver !== false) drawGrid(); // поверх текстур (за замовчуванням)

    // Позиція буфера на екрані рахується БЕЗ округлення — тому рух камери завжди плавний,
    // а вміст всередині буфера завжди піксельно точний (бо прив'язаний до цілих світових координат).
    var screenOriginX = worldX0*view.zoom + view.panX;
    var screenOriginY = worldY0*view.zoom + view.panY;
    ctx.save();
    ctx.imageSmoothingEnabled = false;
    ctx.translate(screenOriginX, screenOriginY);
    ctx.scale(view.zoom, view.zoom);
    ctx.drawImage(offCanvas, 0, 0);
    ctx.restore();

    // --- UI поверх запеченого буфера: виділення текстур (векторне, завжди чітке) ---
    sorted.forEach(function(p){
      var isSingleSel = selected && selected.type === 'placement' && selected.id === p.id;
      var isMultiSel = selected && selected.type === 'multi' && idSetOf(selected.ids).has(p.id);
      if(!isSingleSel && !isMultiSel) return;
      var b = placementBBox(p);
      var s0 = worldToScreen(b.x0, b.y0);
      var s1 = worldToScreen(b.x1, b.y1);
      var rx0 = s0.x, ry0 = s0.y, w = s1.x-s0.x, h = s1.y-s0.y;
      // Контур по ТІЛУ тайла (його справжній розмір), а не по ромбу клітинки, на якій він стоїть
      ctx.save();
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.strokeRect(rx0, ry0, w, h);
      if(isMultiSel){ ctx.fillStyle = 'rgba(201,162,39,0.16)'; ctx.fillRect(rx0, ry0, w, h); }
      ctx.restore();
    });
    // Рамка, якою виділяли, лишається видимою (і їде разом з обʼєктами), як у піксель-редакторах
    if(selected && selected.type === 'multi' && selected.rect){
      var rfP = placementById(selected.refId);
      var rdx = rfP ? rfP.x - selected.refX : 0, rdy = rfP ? rfP.y - selected.refY : 0;
      var q0 = worldToScreen(selected.rect.x0 + rdx, selected.rect.y0 + rdy), q1 = worldToScreen(selected.rect.x1 + rdx, selected.rect.y1 + rdy);
      ctx.save(); ctx.setLineDash([7,5]); ctx.strokeStyle = '#e8c14a'; ctx.lineWidth = 1.5; ctx.fillStyle = 'rgba(201,162,39,0.06)';
      ctx.fillRect(q0.x, q0.y, q1.x-q0.x, q1.y-q0.y); ctx.strokeRect(q0.x, q0.y, q1.x-q0.x, q1.y-q0.y);
      ctx.restore();
    }

    if(showCollisions){
      project.collisions.forEach(function(s){
        var isSel = (selected && selected.type==='collision' && selected.id===s.id) || !!colMulti[s.id];
        ctx.globalAlpha = (tool==='collision' && (s.onFloor||1)!==collisionFloor) ? 0.35 : 1;
        // Колір за типом: звичайна колізія — червоний (як і раніше), тригер — синій,
        // перехід між поверхами — фіолетовий. Виділення завжди перебиває кольором амбер.
        var baseFill = 'rgba(122,46,46,0.35)', baseStroke = '#c94a2a';
        if(s.type==='trigger'){ baseFill = 'rgba(42,90,140,0.35)'; baseStroke = '#2a7ac9'; }
        else if(s.type==='floorTransition'){ baseFill = 'rgba(110,50,150,0.35)'; baseStroke = '#8a3ac9'; }
        ctx.fillStyle = isSel ? 'rgba(201,162,39,0.35)' : baseFill;
        ctx.strokeStyle = isSel ? '#c9a227' : baseStroke; ctx.lineWidth = 2;
        if(s.type==='trigger' || s.type==='floorTransition') ctx.setLineDash([5,4]);
        if(s.shape==='circle'){
          var sc = worldToScreen(s.x, s.y);
          ctx.beginPath(); ctx.arc(sc.x, sc.y, s.r*view.zoom, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        } else if(s.shape==='poly'){
          var pp0 = worldToScreen(s.pts[0].x, s.pts[0].y);
          ctx.beginPath(); ctx.moveTo(pp0.x, pp0.y);
          for(var pi=1; pi<s.pts.length; pi++){ var ppi = worldToScreen(s.pts[pi].x, s.pts[pi].y); ctx.lineTo(ppi.x, ppi.y); }
          ctx.closePath(); ctx.fill(); ctx.stroke();
          if(isSel && !s.locked){
            ctx.setLineDash([]);
            s.pts.forEach(function(q){
              var qs = worldToScreen(q.x, q.y);
              ctx.beginPath(); ctx.arc(qs.x, qs.y, 9, 0, Math.PI*2);
              ctx.fillStyle = '#e8c14a'; ctx.fill(); ctx.strokeStyle = '#1a1a14'; ctx.lineWidth = 2; ctx.stroke();
            });
          }
        } else {
          var s0 = worldToScreen(s.x0, s.y0);
          var w = (s.x1-s.x0)*view.zoom, h=(s.y1-s.y0)*view.zoom;
          ctx.fillRect(s0.x, s0.y, w, h); ctx.strokeRect(s0.x, s0.y, w, h);
        }
        ctx.setLineDash([]);
        if((s.onFloor||1)>1){ var lb=collisionBBox(s), lp=worldToScreen((lb.x0+lb.x1)/2,(lb.y0+lb.y1)/2); ctx.fillStyle='#fff'; ctx.font='bold 15px sans-serif'; ctx.fillText(String(s.onFloor),lp.x-4,lp.y+5); }
        ctx.globalAlpha = 1;
      });
      // Точки спавну — прив'язані до того самого перемикача видимості, що й колізії
      // (це теж "невидима в грі розмітка", окрема кнопка show/hide була б зайвою для MVP).
      project.spawns.forEach(function(sp){
        var isSelS = selected && selected.type==='spawn' && selected.id===sp.id;
        var scr = worldToScreen(sp.x, sp.y);
        ctx.fillStyle = isSelS ? '#c9a227' : '#3a9a4a';
        ctx.strokeStyle = '#132412'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(scr.x, scr.y, SPAWN_R*view.zoom, 0, Math.PI*2); ctx.fill(); ctx.stroke();
        ctx.fillStyle = '#eef7ee'; ctx.font = '11px monospace'; ctx.textAlign = 'center';
        ctx.fillText('✦', scr.x, scr.y+4);
        if(view.zoom > 0.5 && sp.spawnType){
          ctx.font = '9px monospace';
          ctx.fillText(sp.spawnType, scr.x, scr.y - SPAWN_R*view.zoom - 4);
        }
      });
    }

    if(drawingShape){
      ctx.fillStyle = 'rgba(74,122,58,0.3)'; ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = 2;
      if(drawingShape.shape==='circle'){
        var sc = worldToScreen(drawingShape.x, drawingShape.y);
        ctx.beginPath(); ctx.arc(sc.x, sc.y, drawingShape.r*view.zoom, 0, Math.PI*2); ctx.fill(); ctx.stroke();
      } else if(drawingShape.shape==='isoPreview'){
        var ipts = isoPtsFromRect(Math.min(drawingShape.x0,drawingShape.x1), Math.min(drawingShape.y0,drawingShape.y1), Math.max(drawingShape.x0,drawingShape.x1), Math.max(drawingShape.y0,drawingShape.y1));
        ctx.beginPath();
        ipts.forEach(function(q, qi){ var qs = worldToScreen(q.x, q.y); if(qi===0) ctx.moveTo(qs.x, qs.y); else ctx.lineTo(qs.x, qs.y); });
        ctx.closePath(); ctx.fill(); ctx.stroke();
      } else if(drawingShape.shape==='diamondPreview'){
        var c0 = worldToScreen(drawingShape.cx, drawingShape.cy);
        var rad = drawingShape.radius;
        var top = cellToWorld(drawingShape.c0, drawingShape.r0-rad), bot = cellToWorld(drawingShape.c0, drawingShape.r0+rad);
        var left = cellToWorld(drawingShape.c0-rad, drawingShape.r0), right = cellToWorld(drawingShape.c0+rad, drawingShape.r0);
        var pTop=worldToScreen(top.x,top.y), pBot=worldToScreen(bot.x,bot.y), pLeft=worldToScreen(left.x,left.y), pRight=worldToScreen(right.x,right.y);
        ctx.beginPath(); ctx.moveTo(pTop.x,pTop.y); ctx.lineTo(pRight.x,pRight.y); ctx.lineTo(pBot.x,pBot.y); ctx.lineTo(pLeft.x,pLeft.y); ctx.closePath();
        ctx.fill(); ctx.stroke();
      } else {
        var s0 = worldToScreen(drawingShape.x0, drawingShape.y0);
        var w=(drawingShape.x1-drawingShape.x0)*view.zoom, h=(drawingShape.y1-drawingShape.y0)*view.zoom;
        ctx.fillRect(s0.x,s0.y,w,h); ctx.strokeRect(s0.x,s0.y,w,h);
      }
    }

    if(cloneAnchor){
      var ca = worldToScreen(cloneAnchor.x, cloneAnchor.y);
      ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(ca.x, ca.y, 6, 0, Math.PI*2); ctx.stroke();
    }
        if (mode === 'drawArea' && areaSelect) {
        ctx.fillStyle = 'rgba(201, 162, 39, 0.2)';
        ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 1;
        var sA0 = worldToScreen(areaSelect.x0, areaSelect.y0);
        var sA1 = worldToScreen(areaSelect.x1, areaSelect.y1);
        var ax = Math.min(sA0.x, sA1.x), ay = Math.min(sA0.y, sA1.y);
        var aw = Math.abs(sA1.x - sA0.x), ah = Math.abs(sA1.y - sA0.y);
        ctx.fillRect(ax, ay, aw, ah); ctx.strokeRect(ax, ay, aw, ah);
        }
    

    if(tool === 'shadow' && shadowSel.length){
      ctx.save(); ctx.strokeStyle = '#c9a227'; ctx.lineWidth = 2; ctx.setLineDash([6,4]);
      shadowSel.forEach(function(id){
        var sp0 = placementById(id); if(!sp0) return;
        var bb0 = placementBBox(sp0), a0 = worldToScreen(bb0.x0, bb0.y0), a1 = worldToScreen(bb0.x1, bb0.y1);
        ctx.strokeRect(a0.x, a0.y, a1.x-a0.x, a1.y-a0.y);
      });
      ctx.restore();
    }
    updateSelPanel();
    renderMinimap();
    if(typeof updatePrecisionOverlay==='function') updatePrecisionOverlay();
  }
  function buildHouseViewBar(){
    if(!houseView.enabled){ houseViewBarEl.style.display='none'; houseViewBarEl.innerHTML=''; return; }
    houseViewBarEl.style.display = 'flex';
    houseViewBarEl.innerHTML =
      '<span class="hv-label">🏢 '+houseView.group+' · поверх '+houseView.activeFloor+'</span>'+
      '<button data-hv="down">▾ Нижче</button>'+
      '<button data-hv="up">▴ Вище</button>'+
      '<button class="hv-exit" data-hv="exit">✕ Вийти з будинку</button>';
  }
