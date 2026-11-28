/* js/tools/collision.js — Вибір тапом по пікселю, колізії «З текстури» (контур), ізометрична колізія.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function tileAlpha(tile, tid){
    var ent = alphaCache[tid];
    if(ent && ent.img === tile.img) return ent;
    var w = tile.img.naturalWidth, h = tile.img.naturalHeight;
    if(!w || !h || w*h > 16000000) return (alphaCache[tid] = { img:tile.img, a:null });
    try{
      var c = document.createElement('canvas'); c.width = w; c.height = h;
      var x = c.getContext('2d', { willReadFrequently:true }); x.drawImage(tile.img, 0, 0);
      var d = x.getImageData(0,0,w,h).data, al = new Uint8Array(w*h);
      for(var i=0; i<al.length; i++) al[i] = d[i*4+3];
      ent = { img:tile.img, w:w, h:h, a:al };
    }catch(e){ ent = { img:tile.img, a:null }; }
    return (alphaCache[tid] = ent);
  }
  // Чи є ВИДИМИЙ піксель тайла p у світовій точці (wx,wy) — з урахуванням кадру анімації, віддзеркалення, повороту і нахилу (як у render)
  function pixelHitAt(p, wx, wy){
    var tile = project.tiles[p.tileId];
    if(!tile || !tile.img.complete || !tile.img.naturalWidth) return true;
    var ent = tileAlpha(tile, p.tileId); if(!ent || !ent.a) return true;
    var frameIdx = getAnimFrameIndex(tile, p), bb, frameW, sx = 0, frameH = ent.h;
    if(hasVariableFrames(tile)){ var vf = tileFrameAt(tile, frameIdx); frameW = vf.w; sx = vf.x; bb = placementRenderBBox(p, frameIdx); }
    else { bb = placementBBox(p); frameW = tile.animFrames > 1 ? ent.w / tile.animFrames : ent.w; sx = tile.animFrames > 1 ? frameIdx*frameW : 0; }
    var dx = wx - (Math.round(bb.x0) + bb.w*bb.pv.x), dy = wy - (Math.round(bb.y0) + bb.h*bb.pv.y);
    var rot = (p.rotation||0) * Math.PI/180;
    if(rot){ var cs = Math.cos(rot), sn = Math.sin(rot), rx = dx*cs + dy*sn, ry = -dx*sn + dy*cs; dx = rx; dy = ry; }
    if(p.flipX) dx = -dx; if(p.flipY) dy = -dy;
    if(p.skewX) dx = dx - p.skewX*dy;
    var u = (dx + bb.w*bb.pv.x) / bb.w * frameW, v = (dy + bb.h*bb.pv.y) / bb.h * frameH;
    if(!(u >= 0 && v >= 0 && u < frameW && v < frameH)) return false;
    return ent.a[Math.floor(v)*ent.w + Math.floor(sx+u)] > 16;
  }
  function hitTestPlacement(wx, wy){
    var pad = 9 / view.zoom, cands = [];
    // Якщо просторовий індекс актуальний — беремо лише розміщення поблизу пальця (в тому ж порядку, що в масиві);
    // інакше, як і раніше, перебираємо всі.
    var list = indexedPlacements(wx - pad, wy - pad, wx + pad, wy + pad) || project.placements;
    for(var i=0; i<list.length; i++){
      var p = list[i];
      if(p.layerId !== project.activeLayerId) continue;      // лише активний шар
      var lyr = getLayer(p.layerId);
      if(!lyr.visible || lyr.locked) continue;
      var b = placementBBox(p);
      if(wx >= b.x0-pad && wx <= b.x1+pad && wy >= b.y0-pad && wy <= b.y1+pad) cands.push(p);
    }
    if(!cands.length) return null;
    function topAt(x, y){
      var best = null;
      for(var k=0; k<cands.length; k++){ var c = cands[k]; if(pixelHitAt(c, x, y) && (!best || comparePlacements(c, best) >= 0)) best = c; }
      return best;
    }
    var hit = topAt(wx, wy);                                  // 1) точно під пальцем
    if(hit) return hit;
    var dirs = [[1,0],[-1,0],[0,1],[0,-1],[0.7,0.7],[-0.7,0.7],[0.7,-0.7],[-0.7,-0.7]], radii = [2, 4, 7];
    for(var r=0; r<radii.length; r++){                         // 2) невеликий допуск на товщину пальця (у екранних px)
      var rw = radii[r] / view.zoom, bestR = null;
      for(var d=0; d<dirs.length; d++){
        var h2 = topAt(wx + dirs[d][0]*rw, wy + dirs[d][1]*rw);
        if(h2 && (!bestR || comparePlacements(h2, bestR) >= 0)) bestR = h2;
      }
      if(bestR) return bestR;
    }
    return null;
  }
  function opaqueFrameRect(tile, tid, frameIdx){
    var ent = tileAlpha(tile, tid); if(!ent || !ent.a) return null;
    var frameW, sx = 0;
    if(hasVariableFrames(tile)){ var vf = tileFrameAt(tile, frameIdx); frameW = vf.w; sx = vf.x; }
    else { frameW = tile.animFrames > 1 ? Math.floor(ent.w / tile.animFrames) : ent.w; sx = tile.animFrames > 1 ? frameIdx*frameW : 0; }
    var key = tid + '|' + sx + '|' + frameW;
    var c = opqCache[key]; if(c && c.img === tile.img) return c.r;
    var minX = Infinity, minY = Infinity, maxX = -1, maxY = -1, a = ent.a, W = ent.w, H = ent.h;
    for(var y=0; y<H; y++){
      var row = y*W + sx;
      for(var x=0; x<frameW; x++){
        if(a[row + x] > 16){ if(x<minX)minX=x; if(x>maxX)maxX=x; if(y<minY)minY=y; if(y>maxY)maxY=y; }
      }
    }
    var r = (maxX < 0) ? null : { u0:minX, v0:minY, u1:maxX+1, v1:maxY+1, fw:frameW, fh:H };
    opqCache[key] = { img:tile.img, r:r };
    return r;
  }
  function opaqueWorldBBox(p){
    var tile = project.tiles[p.tileId];
    var bb = placementBBox(p);
    if(!tile || !tile.img || !tile.img.complete || !tile.img.naturalWidth) return bb;
    var r = opaqueFrameRect(tile, p.tileId, 0); if(!r) return bb;
    var cx = Math.round(bb.x0) + bb.w*bb.pv.x, cy = Math.round(bb.y0) + bb.h*bb.pv.y;
    var rot = (p.rotation||0) * Math.PI/180, cs = Math.cos(rot), sn = Math.sin(rot);
    var us = [r.u0, r.u1], vs = [r.v0, r.v1];
    var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    for(var i=0;i<2;i++) for(var j=0;j<2;j++){
      var dx = us[i]/r.fw*bb.w - bb.w*bb.pv.x, dy = vs[j]/r.fh*bb.h - bb.h*bb.pv.y;
      if(p.skewX) dx = dx + p.skewX*dy;
      if(p.flipX) dx = -dx; if(p.flipY) dy = -dy;
      var wx = cx + dx*cs - dy*sn, wy = cy + dx*sn + dy*cs;
      if(wx<minX)minX=wx; if(wx>maxX)maxX=wx; if(wy<minY)minY=wy; if(wy>maxY)maxY=wy;
    }
    return { x0:minX, y0:minY, x1:maxX, y1:maxY, w:maxX-minX, h:maxY-minY, pv:bb.pv };
  }

  // ===== Колізія «З текстури» по КОНТУРУ: обводимо непрозорі пікселі (найбільша суцільна частина), спрощуємо
  // (Дугласа–Пекера) і переводимо у світ тим самим перетворенням, що й opaqueWorldBBox. Так колізія лягає
  // на саму текстуру, а не на прозорі кути прямокутника. Повертає масив {x,y} або null.
  function traceOpaqueContour(a, W, sx, fw, fh, cell, feet){
    var gw = Math.ceil(fw/cell), gh = Math.ceil(fh/cell), m = new Uint8Array(gw*gh);
    for(var y=0; y<fh; y++){ var row = y*W + sx, gr = Math.floor(y/cell)*gw;
      for(var x=0; x<fw; x++){ if(a[row+x] > 16) m[gr + Math.floor(x/cell)] = 1; } }
    if(feet){
      // «Ноги»: для кожної колонки беремо нижню чверть ЇЇ висоти від власного низу (тому похила стіна дає смугу
      // вздовж основи, а не горизонтальний зріз). Колонки йдуть від найнижчої, поки низ змінюється плавно —
      // різкий стрибок (крона над стовбуром) обриває ланцюжок.
      var bot = new Int32Array(gw).fill(-1), top = new Int32Array(gw).fill(-1);
      for(var cx0=0; cx0<gw; cx0++) for(var cy0=0; cy0<gh; cy0++){ if(m[cy0*gw+cx0]){ if(top[cx0]<0) top[cx0]=cy0; bot[cx0]=cy0; } }
      var s0 = -1; for(var c0=0; c0<gw; c0++){ if(bot[c0]>=0 && (s0<0 || bot[c0]>bot[s0])) s0 = c0; }
      if(s0 < 0) return null;
      var keep = new Uint8Array(gw); keep[s0] = 1;
      [-1,1].forEach(function(dr){ for(var c=s0+dr; c>=0 && c<gw; c+=dr){ if(bot[c]<0 || Math.abs(bot[c]-bot[c-dr])>2) break; keep[c]=1; } });
      var m2 = new Uint8Array(m.length);
      for(var c1=0; c1<gw; c1++){ if(!keep[c1]) continue;
        var th = Math.max(1, Math.round((bot[c1]-top[c1]+1)*0.25));
        for(var y2=bot[c1]-th+1; y2<=bot[c1]; y2++){ if(m[y2*gw+c1]) m2[y2*gw+c1] = 1; } }
      m = m2;
    }
    // найбільша 8-звʼязна компонента
    var lab = new Int32Array(gw*gh), best = 0, bestN = 0, n = 0, st = [];
    for(var i=0; i<m.length; i++){
      if(!m[i] || lab[i]) continue;
      n++; var cnt = 0; st.push(i); lab[i] = n;
      while(st.length){ var c = st.pop(); cnt++; var cx = c%gw, cy = (c/gw)|0;
        for(var oy=-1; oy<=1; oy++) for(var ox=-1; ox<=1; ox++){
          var nx = cx+ox, ny = cy+oy; if(nx<0||ny<0||nx>=gw||ny>=gh) continue;
          var ni = ny*gw+nx; if(m[ni] && !lab[ni]){ lab[ni] = n; st.push(ni); } } }
      if(cnt > bestN){ bestN = cnt; best = n; }
    }
    if(!best) return null;
    function op(x, y){ return x>=0 && y>=0 && x<gw && y<gh && lab[y*gw+x]===best; }
    var sx0 = -1, sy0 = -1;
    for(var k=0; k<lab.length; k++){ if(lab[k]===best){ sx0 = k%gw; sy0 = (k/gw)|0; break; } }
    // обхід по краях клітинок, внутрішність праворуч (екранні координати, y вниз)
    var x1 = sx0, y1 = sy0, dx = 1, dy = 0, pts = [], guard = 0, maxG = (gw+gh+4)*(gw+gh+4);
    do{
      pts.push({x:x1, y:y1});
      x1 += dx; y1 += dy; // крок уздовж ребра, далі вибір повороту
      // клітинки попереду: ліво-вперед / право-вперед (відносно напрямку руху)
      var al, ar;
      if(dx===1){ al = op(x1, y1-1); ar = op(x1, y1); }
      else if(dx===-1){ al = op(x1-1, y1); ar = op(x1-1, y1-1); }
      else if(dy===1){ al = op(x1, y1); ar = op(x1-1, y1); }
      else { al = op(x1-1, y1-1); ar = op(x1, y1-1); }
      var ndx, ndy;
      if(al){ ndx = dy; ndy = -dx; }          // поворот ліворуч
      else if(ar){ ndx = dx; ndy = dy; }      // прямо
      else { ndx = -dy; ndy = dx; }           // поворот праворуч
      dx = ndx; dy = ndy;
    } while(!(x1===sx0 && y1===sy0 && dx===1 && dy===0) && ++guard < maxG);
    // лишаємо тільки вершини зі зміною напрямку
    var cor = [];
    for(var q=0; q<pts.length; q++){
      var p0 = pts[(q+pts.length-1)%pts.length], p1 = pts[q], p2 = pts[(q+1)%pts.length];
      if((p1.x-p0.x)*(p2.y-p1.y) - (p1.y-p0.y)*(p2.x-p1.x) !== 0) cor.push({x:p1.x*cell, y:p1.y*cell});
    }
    return cor.length >= 3 ? cor : null;
  }
  function simplifyClosed(pts, eps){
    if(pts.length <= 4) return pts;
    // розрізаємо замкнений контур у двох найвіддаленіших вершинах і спрощуємо обидві половини
    var ia = 0, ib = 0, bd = -1;
    for(var i=1; i<pts.length; i++){ var d = Math.hypot(pts[i].x-pts[0].x, pts[i].y-pts[0].y); if(d>bd){ bd = d; ib = i; } }
    function dp(arr){
      if(arr.length < 3) return arr;
      var A = arr[0], B = arr[arr.length-1], idx = -1, md = 0, L = Math.hypot(B.x-A.x, B.y-A.y) || 1;
      for(var j=1; j<arr.length-1; j++){
        var dd = Math.abs((B.x-A.x)*(A.y-arr[j].y) - (A.x-arr[j].x)*(B.y-A.y)) / L;
        if(dd > md){ md = dd; idx = j; }
      }
      if(md <= eps) return [A, B];
      var l = dp(arr.slice(0, idx+1)), r = dp(arr.slice(idx));
      return l.slice(0, -1).concat(r);
    }
    var h1 = pts.slice(ia, ib+1), h2 = pts.slice(ib).concat([pts[0]]);
    var r1 = dp(h1), r2 = dp(h2);
    return r1.slice(0, -1).concat(r2.slice(0, -1));
  }
  function polyArea(pts){ var s2 = 0; for(var i=0,j=pts.length-1; i<pts.length; j=i++) s2 += (pts[j].x+pts[i].x)*(pts[j].y-pts[i].y); return Math.abs(s2)/2; }
  function opaqueWorldPoly(p, feet){
    var tile = project.tiles[p.tileId];
    if(!tile || !tile.img || !tile.img.complete || !tile.img.naturalWidth) return null;
    var ent = tileAlpha(tile, p.tileId); if(!ent || !ent.a) return null;
    var r = opaqueFrameRect(tile, p.tileId, 0); if(!r) return null;
    var frameW, sx = 0;
    if(hasVariableFrames(tile)){ var vf = tileFrameAt(tile, 0); frameW = vf.w; sx = vf.x; }
    else { frameW = tile.animFrames > 1 ? Math.floor(ent.w / tile.animFrames) : ent.w; }
    var fh = ent.h, cell = Math.max(1, Math.ceil(Math.max(frameW, fh) / 128));
    var cont = traceOpaqueContour(ent.a, ent.w, sx, frameW, fh, cell, feet); if(!cont) return null;
    cont = simplifyClosed(cont, Math.max(1.5, Math.max(frameW, fh) / 48));
    if(cont.length < 3) return null;
    // якщо контур майже дорівнює прямокутнику — не ускладнюємо, лишаємо rect
    if(!feet && polyArea(cont) >= 0.94 * (r.u1-r.u0) * (r.v1-r.v0)) return null;
    var bb = placementBBox(p);
    var cx = Math.round(bb.x0) + bb.w*bb.pv.x, cy = Math.round(bb.y0) + bb.h*bb.pv.y;
    var rot = (p.rotation||0) * Math.PI/180, cs = Math.cos(rot), sn = Math.sin(rot);
    return cont.map(function(q){
      var dx = q.x/frameW*bb.w - bb.w*bb.pv.x, dy = q.y/fh*bb.h - bb.h*bb.pv.y;
      if(p.skewX) dx = dx + p.skewX*dy;
      if(p.flipX) dx = -dx; if(p.flipY) dy = -dy;
      return { x:px(cx + dx*cs - dy*sn), y:px(cy + dx*sn + dy*cs) };
    });
  }

  // ===== Ізометрична колізія: полігон із 4 вільних вершин (верх, право, низ, ліво)
  function isoPtsFromRect(x0, y0, x1, y1){
    var cx = (x0+x1)/2, cy = (y0+y1)/2;
    return [ {x:Math.round(cx), y:Math.round(y0)}, {x:Math.round(x1), y:Math.round(cy)}, {x:Math.round(cx), y:Math.round(y1)}, {x:Math.round(x0), y:Math.round(cy)} ];
  }
  function pointInPoly(x, y, pts){
    var inside = false;
    for(var i=0, j=pts.length-1; i<pts.length; j=i++){
      var xi=pts[i].x, yi=pts[i].y, xj=pts[j].x, yj=pts[j].y;
      if(((yi>y) !== (yj>y)) && (x < (xj-xi)*(y-yi)/(yj-yi) + xi)) inside = !inside;
    }
    return inside;
  }
  function polyBBox(s){
    var x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
    s.pts.forEach(function(q){ if(q.x<x0)x0=q.x; if(q.x>x1)x1=q.x; if(q.y<y0)y0=q.y; if(q.y>y1)y1=q.y; });
    return { x0:x0, y0:y0, x1:x1, y1:y1 };
  }
  // Індекс вершини під пальцем (екранні координати) або -1
  function hitTestPolyVertex(sx, sy, s){
    var best = -1, bd = 30;
    for(var i=0;i<s.pts.length;i++){
      var q = worldToScreen(s.pts[i].x, s.pts[i].y), d = Math.hypot(sx-q.x, sy-q.y);
      if(d < bd){ bd = d; best = i; }
    }
    return best;
  }

  function hitTestCollision(wx, wy){
    var best = null;
    for(var i=0;i<project.collisions.length;i++){
      var s = project.collisions[i];
      if(s.shape==='circle'){
        var dx=wx-s.x, dy=wy-s.y;
        if(Math.sqrt(dx*dx+dy*dy) <= s.r) best = s;
      } else if(s.shape==='poly'){
        if(pointInPoly(wx, wy, s.pts)) best = s;
      } else if(wx>=s.x0 && wx<=s.x1 && wy>=s.y0 && wy<=s.y1) best = s;
    }
    return best;
  } // радіус точки спавну в світових одиницях — і для малювання, і для хіт-тесту тапу
  function hitTestSpawn(wx, wy){
    var best = null;
    for(var i=0;i<project.spawns.length;i++){
      var sp = project.spawns[i];
      var dx=wx-sp.x, dy=wy-sp.y;
      if(Math.sqrt(dx*dx+dy*dy) <= SPAWN_R) best = sp;
    }
    return best;
  }

  // Тригер/перехід між поверхами: одразу після зміни типу колізії питаємо мінімум
  // додаткових полів через prompt() (той самий патерн, що й "Змінити глибину" для z) —
  // без побудови окремої форми/модалки, які тут крихкі на тач-жестах.
  function promptCollisionMeta(c){
    if(c.type==='trigger'){
      var g = prompt(t('promptGroupHouse'), c.group||'');
      if(g!==null) c.group = g;
      var f = prompt(t('promptEntranceFloor'), (c.floor!=null?c.floor:0));
      if(f!==null){ var fn=parseInt(f); if(!isNaN(fn)) c.floor = fn; }
    } else if(c.type==='floorTransition'){
      var g2 = prompt(t('promptGroupHouse'), c.group||'');
      if(g2!==null) c.group = g2;
      var ff = prompt(t('promptFromFloor'), (c.fromFloor!=null?c.fromFloor:0));
      if(ff!==null){ var ffn=parseInt(ff); if(!isNaN(ffn)) c.fromFloor = ffn; }
      var tf = prompt(t('promptToFloor'), (c.toFloor!=null?c.toFloor:1));
      if(tf!==null){ var tfn=parseInt(tf); if(!isNaN(tfn)) c.toFloor = tfn; }
    }
  }

  function drawDiamondOrSquare(cx0, cy0, w, h){
    if(project.gridType==='iso' || project.gridType==='isoAsym' || project.gridType==='isoPixel'){
      ctx.beginPath();
      ctx.moveTo(cx0.x, cy0.y - h/2); ctx.lineTo(cx0.x + w/2, cy0.y);
      ctx.lineTo(cx0.x, cy0.y + h/2); ctx.lineTo(cx0.x - w/2, cy0.y);
      ctx.closePath();
    }
  }
  function scheduleRender(){
    // pointermove може спрацьовувати частіше за кадр (особливо на миші з високим poll rate) —
    // без цього кожен рух миші під час перетягування/малювання прев'ю викликав render() напряму,
    // і кілька важких render() встигали накопичитись в черзі за один кадр. Тут лишається лише
    // один запланований виклик на кадр, останній стан враховується автоматично.
    // Поки не виконались усі скрипти запуску (повільна мережа: файли приходять по черзі), малювати рано —
    // перемальовування запускається один раз в кінці js/init/27-core.js (twBooted = true).
    if(!twBooted) return;
    if(renderScheduled) return;
    renderScheduled = true;
    requestAnimationFrame(function(){ renderScheduled = false; renderNow(); });
  }
  function gridRgba(){
    var n = parseInt((project.gridColor || '#5a6446').slice(1), 16);
    var c = 'rgba('+((n>>16)&255)+','+((n>>8)&255)+','+(n&255)+',0.9)';
    if(window.gridStampColor !== c){ window.gridStampColor = c; window.isoGridStamp = null; window.isoAsymGridStamp = null; window.isoPixelGridStamp = null; }
    return c;
  }
  // render() тепер ВІДКЛАДЕНИЙ: скільки б разів його не викликали за кадр (подія, тост, onload картинок),
  // карта перемальовується один раз у наступному кадрі. Негайне малювання — renderNow() (лише для замірів).
  function render(){ scheduleRender(); }
  function invalidateWrapRect(){ wrapRectCache = null; }
