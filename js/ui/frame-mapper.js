/* js/ui/frame-mapper.js — Повноекранний редактор кадрів анімації (fm*).
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function openFrameMark(tile, existing){
    frameMarkTile = tile;
    frameMarkList = (existing && existing.length)
      ? existing.map(function(f){ return {x:f.x, w:f.w, pivotX:f.pivotX, pivotY:f.pivotY}; })
      : [{ x:0, w:tile.img.naturalWidth, pivotX:0.5, pivotY:1 }];
    fmSel = frameMarkList.length - 1;
    fmPointers = {}; fmGesture = null;
    fmPrevZoom = 1; fmPrevPanX = 0; fmPrevPanY = 0; fmPrevPointers = {}; fmPrevGesture = null;
    frameMarkModal.style.display = 'flex';
    // fmCanvasWrap ще не мав layout до display:flex — рахуємо fit-масштаб уже після рендеру кадру
    requestAnimationFrame(function(){ fmFit(); fmPrevResizeCanvas(); renderFrameMark(); });
  }
  function fmBoundaries(){
    // x-координати внутрішніх меж між кадрами (немає межі до першого й після останнього —
    // ті це краї самого файлу, вони не рухаються)
    var arr = [], used = 0;
    for(var i=0;i<frameMarkList.length-1;i++){ used += frameMarkList[i].w; arr.push(used); }
    return arr;
  }
  function fmResizeCanvas(){
    var r = fmCanvasWrap.getBoundingClientRect();
    frameMarkCanvas.width = Math.max(1, Math.round(r.width*devicePixelRatio));
    frameMarkCanvas.height = Math.max(1, Math.round(r.height*devicePixelRatio));
    frameMarkCanvas.style.width = r.width+'px';
    frameMarkCanvas.style.height = r.height+'px';
  }
  function fmFit(){
    fmResizeCanvas();
    var iw = frameMarkTile.img.naturalWidth, ih = frameMarkTile.img.naturalHeight;
    var pad = 28*devicePixelRatio;
    fmFitScale = Math.max(0.05, Math.min((frameMarkCanvas.width-2*pad)/iw, (frameMarkCanvas.height-2*pad)/ih));
    fmFitCenterX = iw/2; fmFitCenterY = ih/2;
    fmZoom = 1; fmPanX = 0; fmPanY = 0;
  }
  // Zoom НЕ змінює координати самого PNG — вся математика (межі, pivot) завжди йде в
  // оригінальних пікселях файлу, fmToPx/fmToImg лише переводять між ними й екраном.
  function fmToPx(ix, iy){
    var s = fmFitScale*fmZoom;
    return { x: frameMarkCanvas.width/2 + fmPanX + (ix-fmFitCenterX)*s, y: frameMarkCanvas.height/2 + fmPanY + (iy-fmFitCenterY)*s };
  }
  function fmToImg(sx, sy){
    var s = fmFitScale*fmZoom;
    return { x: fmFitCenterX + (sx-frameMarkCanvas.width/2-fmPanX)/s, y: fmFitCenterY + (sy-frameMarkCanvas.height/2-fmPanY)/s };
  }
  function fmMoveBoundary(i, imgX){
    var left = 0; for(var k=0;k<i;k++) left += frameMarkList[k].w;
    var right = left + frameMarkList[i].w + frameMarkList[i+1].w;
    var nx = Math.max(left+1, Math.min(right-1, Math.round(imgX))); // мінімум 1px на кожен кадр
    frameMarkList[i].w = nx-left;
    frameMarkList[i+1].x = nx;
    frameMarkList[i+1].w = right-nx;
  }
  function fmSetPivotFromImg(ix, iy){
    var f = frameMarkList[fmSel], ih = frameMarkTile.img.naturalHeight;
    var fx = Math.max(0, Math.min(1, (ix-f.x)/f.w));
    var fy = Math.max(0, Math.min(1, iy/ih));
    // прилипання до конкретного пікселя джерела — той самий принцип, що й у звичайному pivot-пікері
    f.pivotX = Math.round(fx*f.w)/f.w;
    f.pivotY = Math.round(fy*ih)/ih;
  }
  function fmAddFrameSplit(){
    var f = frameMarkList[fmSel];
    if(f.w < 2){ toast(t('toastFrameTooNarrow')); return; }
    var w1 = Math.floor(f.w/2), w2 = f.w-w1;
    var newFrame = { x:f.x+w1, w:w2, pivotX:f.pivotX, pivotY:f.pivotY };
    f.w = w1;
    frameMarkList.splice(fmSel+1, 0, newFrame);
    fmSel = fmSel+1;
    renderFrameMark();
  }
  function fmDeleteFrame(){
    if(frameMarkList.length<=1){ toast(t('toastOnlyFrame')); return; }
    if(fmSel>0){
      frameMarkList[fmSel-1].w += frameMarkList[fmSel].w;
      frameMarkList.splice(fmSel,1);
      fmSel = fmSel-1;
    } else {
      frameMarkList[1].x = frameMarkList[0].x;
      frameMarkList[1].w += frameMarkList[0].w;
      frameMarkList.splice(0,1);
      fmSel = 0;
    }
    renderFrameMark();
  }
  function fmAutoDetect(){
    var iw = frameMarkTile.img.naturalWidth;
    var suggested = frameMarkList.length || parseInt(document.getElementById('animFrameCount').value) || 4;
    var nStr = prompt(t('promptFrameCount'), suggested);
    if(nStr===null) return;
    var n = Math.max(1, Math.min(64, parseInt(nStr)||suggested));
    var newList = [], used = 0;
    for(var i=0;i<n;i++){
      var w = Math.round((iw*(i+1))/n) - used;
      var old = frameMarkList[i];
      newList.push({ x:used, w:Math.max(1,w), pivotX: old?old.pivotX:0.5, pivotY: old?old.pivotY:1 });
      used += w;
    }
    frameMarkList = newList;
    fmSel = Math.min(fmSel, frameMarkList.length-1);
    renderFrameMark();
  }
  function renderFmTimeline(){
    var strip = document.getElementById('fmTimeline');
    var addBtn = document.getElementById('fmAddFrame');
    strip.innerHTML = '';
    frameMarkList.forEach(function(f,i){
      var b = document.createElement('button');
      b.type = 'button'; b.className = 'fm-chip'+(i===fmSel?' active':'');
      b.innerHTML = '<span class="fm-chip-n">'+(i+1)+'</span><span class="fm-chip-w">'+f.w+'px</span>';
      b.addEventListener('click', function(){ fmSel=i; renderFrameMark(); });
      strip.appendChild(b);
    });
    strip.appendChild(addBtn);
  }
  function fmGetChecker(){
    if(fmChecker) return fmChecker;
    var c = document.createElement('canvas'); c.width = 2; c.height = 2;
    var cx = c.getContext('2d');
    cx.fillStyle = '#2b3020'; cx.fillRect(0,0,2,2);
    cx.fillStyle = '#1c2015'; cx.fillRect(0,0,1,1); cx.fillRect(1,1,1,1);
    fmChecker = frameMarkCtx.createPattern(c, 'repeat');
    return fmChecker;
  }
  function renderFrameMark(){
    if(fmSel >= frameMarkList.length) fmSel = frameMarkList.length-1;
    if(fmSel < 0) fmSel = 0;
    var tile = frameMarkTile, f = frameMarkList[fmSel];
    var iw = tile.img.naturalWidth, ih = tile.img.naturalHeight;
    var s = fmFitScale*fmZoom;
    frameMarkCtx.setTransform(1,0,0,1,0,0);
    frameMarkCtx.clearRect(0,0,frameMarkCanvas.width, frameMarkCanvas.height);
    frameMarkCtx.imageSmoothingEnabled = false;
    frameMarkCtx.save();
    frameMarkCtx.translate(frameMarkCanvas.width/2+fmPanX, frameMarkCanvas.height/2+fmPanY);
    frameMarkCtx.scale(s, s);
    frameMarkCtx.translate(-fmFitCenterX, -fmFitCenterY);
    frameMarkCtx.fillStyle = fmGetChecker();
    frameMarkCtx.fillRect(0, 0, iw, ih); // чекер рівно під зображенням, піксель-в-піксель
    frameMarkCtx.drawImage(tile.img, 0, 0, iw, ih);
    frameMarkList.forEach(function(fr, i){
      if(i===fmSel) return;
      frameMarkCtx.fillStyle = 'rgba(0,0,0,0.55)';
      frameMarkCtx.fillRect(fr.x, 0, fr.w, ih);
    });
    frameMarkCtx.strokeStyle = '#e2a727'; frameMarkCtx.lineWidth = 2/s;
    frameMarkCtx.strokeRect(f.x, 0, f.w, ih);
    frameMarkCtx.restore();

    // ручки меж кадрів — малюються в ЕКРАННИХ координатах (fmToPx), тому мають однаковий
    // розмір незалежно від zoom, і завжди залишаються зручними для пальця
    var boundaries = fmBoundaries();
    boundaries.forEach(function(bx){
      var top = fmToPx(bx, 0), bot = fmToPx(bx, ih);
      frameMarkCtx.strokeStyle = 'rgba(255,255,255,0.85)';
      frameMarkCtx.lineWidth = 1;
      frameMarkCtx.beginPath(); frameMarkCtx.moveTo(top.x, top.y); frameMarkCtx.lineTo(bot.x, bot.y); frameMarkCtx.stroke();
      var midY = (top.y+bot.y)/2, hr = 11*devicePixelRatio;
      frameMarkCtx.beginPath(); frameMarkCtx.arc(top.x, midY, hr, 0, Math.PI*2);
      frameMarkCtx.fillStyle = '#e2a727'; frameMarkCtx.fill();
      frameMarkCtx.lineWidth = 1.5; frameMarkCtx.strokeStyle = '#12140f'; frameMarkCtx.stroke();
      frameMarkCtx.fillStyle = '#12140f'; frameMarkCtx.font = (12*devicePixelRatio)+'px sans-serif';
      frameMarkCtx.textAlign = 'center'; frameMarkCtx.textBaseline = 'middle';
      frameMarkCtx.fillText('\u2194', top.x, midY+0.5*devicePixelRatio);
    });

    // pivot — малюється ОСТАННІМ, поверх усього (зокрема поверх ліній меж, якщо вони збіглися),
    // фіксованого екранного розміру (13 device px, трохи більший за ручку межі й іншої форми —
    // хрестик у крапці), щоб на телефоні його було видно й можна було вхопити окремо від межі
    var pf = frameMarkList[fmSel];
    var pp = fmToPx(pf.x+pf.pivotX*pf.w, pf.pivotY*ih);
    var pr = 13*devicePixelRatio;
    frameMarkCtx.beginPath(); frameMarkCtx.arc(pp.x, pp.y, pr, 0, Math.PI*2);
    frameMarkCtx.fillStyle = '#c0392b'; frameMarkCtx.fill();
    frameMarkCtx.lineWidth = 2*devicePixelRatio; frameMarkCtx.strokeStyle = '#fff'; frameMarkCtx.stroke();
    frameMarkCtx.strokeStyle = '#fff'; frameMarkCtx.lineWidth = 1.5*devicePixelRatio;
    frameMarkCtx.beginPath();
    frameMarkCtx.moveTo(pp.x-pr*0.5, pp.y); frameMarkCtx.lineTo(pp.x+pr*0.5, pp.y);
    frameMarkCtx.moveTo(pp.x, pp.y-pr*0.5); frameMarkCtx.lineTo(pp.x, pp.y+pr*0.5);
    frameMarkCtx.stroke();

    document.getElementById('fmFrameCountLabel').textContent = frameMarkList.length + ' ' + (frameMarkList.length===1?t('fmFrameWord'):t('fmFramesWord'));
    document.getElementById('fmInfoIdx').textContent = (fmSel+1);
    document.getElementById('fmInfoX').textContent = f.x;
    document.getElementById('fmInfoW').textContent = f.w;
    document.getElementById('fmInfoPX').textContent = Math.round(f.pivotX*f.w);
    document.getElementById('fmInfoPY').textContent = Math.round(f.pivotY*ih);
    document.getElementById('fmZoomLabel').textContent = Math.round(fmZoom*100)+'%';
    document.getElementById('fmDelFrame').style.visibility = frameMarkList.length<=1 ? 'hidden' : 'visible';
    renderFmTimeline();
    if(typeof updateFmPlacementPreview==='function') updateFmPlacementPreview();
  }
  function fmDist(a,b){ return Math.hypot(b.x-a.x, b.y-a.y); }
  function fmCanvasPoint(e){
    var rect = frameMarkCanvas.getBoundingClientRect();
    return { x: (e.clientX-rect.left)*(frameMarkCanvas.width/rect.width), y: (e.clientY-rect.top)*(frameMarkCanvas.height/rect.height) };
  }
  // Раніше межа завжди "вигравала" в hit-тесті навіть коли палець насправді ближче до pivot —
  // якщо вони збігались по X, pivot ставало неможливо схопити окремо від межі. Тепер обираємо
  // РІВНО той елемент, до якого палець фізично ближче (порівнюємо відстані, а не порядок перевірки).
  function fmPointerPick(sp){
    var ih = frameMarkTile.img.naturalHeight;
    var boundaries = fmBoundaries();
    var boundThresh = 26*devicePixelRatio;
    var best = null, bestDist = Infinity;
    boundaries.forEach(function(bx, i){
      var top = fmToPx(bx, 0), bot = fmToPx(bx, ih);
      if(sp.y < Math.min(top.y,bot.y)-boundThresh || sp.y > Math.max(top.y,bot.y)+boundThresh) return;
      var d = Math.abs(sp.x-top.x);
      if(d < boundThresh && d < bestDist){ bestDist = d; best = { type:'boundary', boundaryIdx:i }; }
    });
    var f = frameMarkList[fmSel];
    var pp = fmToPx(f.x+f.pivotX*f.w, f.pivotY*ih);
    var pivotThresh = 24*devicePixelRatio;
    var pd = fmDist(sp, pp);
    if(pd < pivotThresh && pd < bestDist){ best = { type:'pivot' }; bestDist = pd; }
    return best;
  }
  function fmRebaseGesture(){
    var ids = Object.keys(fmPointers);
    if(fmGesture && (fmGesture.type==='boundary'||fmGesture.type==='pivot')) return; // не перебиваємо активне перетягування
    if(ids.length===1){
      fmGesture = { type:'pan', startPan:{x:fmPanX,y:fmPanY}, startPoint:fmPointers[ids[0]] };
    } else if(ids.length>=2){
      var p1=fmPointers[ids[0]], p2=fmPointers[ids[1]];
      var mid = { x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2 };
      fmGesture = { type:'pinch', startDist:fmDist(p1,p2)||1, startZoom:fmZoom, anchorImg:fmToImg(mid.x,mid.y) };
    } else fmGesture = null;
  }
  function fmPointerEnd(e){
    delete fmPointers[e.pointerId];
    try{ frameMarkCanvas.releasePointerCapture(e.pointerId); }catch(err){}
    if(fmGesture && (fmGesture.type==='boundary'||fmGesture.type==='pivot') && fmGesture.pointerId===e.pointerId) fmGesture = null;
    fmRebaseGesture();
  }
  function fmPrevResizeCanvas(){
    fmPrevCanvas.width = Math.max(1, Math.round(fmPrevSize*devicePixelRatio));
    fmPrevCanvas.height = fmPrevCanvas.width;
    fmPrevCanvas.style.width = fmPrevSize+'px';
    fmPrevCanvas.style.height = fmPrevSize+'px';
  }
  function updateFmPlacementPreview(){
    if(!frameMarkTile || !frameMarkList.length) return;
    var f = frameMarkList[fmSel];
    var ih = frameMarkTile.img.naturalHeight;
    var W = fmPrevCanvas.width, H = fmPrevCanvas.height;
    fmPrevCtx.setTransform(1,0,0,1,0,0);
    fmPrevCtx.clearRect(0,0,W,H);

    var origin = cellToWorld(0,0);
    var c10 = cellToWorld(1,0), c01 = cellToWorld(0,1);
    var stepCol = { x:c10.x-origin.x, y:c10.y-origin.y };
    var stepRow = { x:c01.x-origin.x, y:c01.y-origin.y };
    var cellVerts = diamondVertices();

    var ga = (pendingAnchorMode === 'edge') ? pointOnDiamond(pendingEdgeT) : { x:0, y:0 };
    var ax = ga.x, ay = ga.y;
    var x0 = ax - f.w*f.pivotX, y0 = ay - ih*f.pivotY; // ТІЛЬКИ pivot цього конкретного кадру

    var neigh = [ {c:0,r:0}, {c:-1,r:0}, {c:1,r:0}, {c:0,r:-1}, {c:0,r:1} ];
    // Той самий фікс, що й у великому прев'ю: межі кадру рахуємо від НАЙГІРШОГО можливого
    // розміщення (pivot завжди 0..1), а не від поточного x0/y0 — інакше кадр "гуляє" слідом за
    // текстурою щоразу, як тягнеш межу/pivot, і виглядає як мерехтіння/тремтіння.
    var minX=ax-f.w, minY=ay-ih, maxX=ax+f.w, maxY=ay+ih;
    neigh.forEach(function(o){
      var cx = o.c*stepCol.x + o.r*stepRow.x, cy = o.c*stepCol.y + o.r*stepRow.y;
      cellVerts.forEach(function(v){
        minX=Math.min(minX,cx+v.x); maxX=Math.max(maxX,cx+v.x);
        minY=Math.min(minY,cy+v.y); maxY=Math.max(maxY,cy+v.y);
      });
    });
    var pad = 8;
    fmPrevFitScale = Math.min((W-2*pad)/(maxX-minX||1), (H-2*pad)/(maxY-minY||1));
    fmPrevFitScale = Math.min(fmPrevFitScale, 3);
    fmPrevFitCenterX = (minX+maxX)/2; fmPrevFitCenterY = (minY+maxY)/2;
    var dispScale = fmPrevFitScale * fmPrevZoom;

    fmPrevCtx.save();
    fmPrevCtx.translate(W/2 + fmPrevPanX, H/2 + fmPrevPanY);
    fmPrevCtx.scale(dispScale, dispScale);
    fmPrevCtx.translate(-fmPrevFitCenterX, -fmPrevFitCenterY);
    fmPrevCtx.imageSmoothingEnabled = false;

    neigh.forEach(function(o){
      var cx = o.c*stepCol.x + o.r*stepRow.x, cy = o.c*stepCol.y + o.r*stepRow.y;
      var isTarget = (o.c===0 && o.r===0);
      fmPrevCtx.beginPath();
      cellVerts.forEach(function(v,i){
        var wx = cx+v.x, wy = cy+v.y;
        if(i===0) fmPrevCtx.moveTo(wx,wy); else fmPrevCtx.lineTo(wx,wy);
      });
      fmPrevCtx.closePath();
      fmPrevCtx.fillStyle = isTarget ? 'rgba(201,162,39,0.15)' : 'rgba(255,255,255,0.04)';
      fmPrevCtx.fill();
      lpDrawGridStamp(fmPrevCtx, cx, cy, isTarget, dispScale);
    });

    // вирізаємо ЛИШЕ поточний кадр із спрайт-листа (sx=f.x, sw=f.w) — не весь файл
    fmPrevCtx.drawImage(frameMarkTile.img, f.x, 0, f.w, ih, x0, y0, f.w, ih);

    fmPrevCtx.beginPath();
    fmPrevCtx.arc(ax, ay, 4/dispScale, 0, Math.PI*2);
    fmPrevCtx.fillStyle = '#c0392b';
    fmPrevCtx.strokeStyle = '#fff';
    fmPrevCtx.lineWidth = 1.5/dispScale;
    fmPrevCtx.fill(); fmPrevCtx.stroke();
    fmPrevCtx.restore();

    document.getElementById('fmPrevFrameNo').textContent = (fmSel+1);
  }
  function fmPrevDist(a,b){ return Math.hypot(b.x-a.x, b.y-a.y); }
  function fmPrevPoint(e){
    var rect = fmPrevCanvas.getBoundingClientRect();
    return { x:(e.clientX-rect.left)*(fmPrevCanvas.width/rect.width), y:(e.clientY-rect.top)*(fmPrevCanvas.height/rect.height) };
  }
  function fmPrevToImg(sx, sy){
    var s = fmPrevFitScale*fmPrevZoom;
    return { x: fmPrevFitCenterX+(sx-fmPrevCanvas.width/2-fmPrevPanX)/s, y: fmPrevFitCenterY+(sy-fmPrevCanvas.height/2-fmPrevPanY)/s };
  }
  function fmPrevRebase(){
    var ids = Object.keys(fmPrevPointers);
    if(ids.length===1){
      fmPrevGesture = { type:'pan', startPan:{x:fmPrevPanX,y:fmPrevPanY}, startPoint:fmPrevPointers[ids[0]] };
    } else if(ids.length>=2){
      var p1=fmPrevPointers[ids[0]], p2=fmPrevPointers[ids[1]];
      var mid = { x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2 };
      fmPrevGesture = { type:'pinch', startDist:fmPrevDist(p1,p2)||1, startZoom:fmPrevZoom, anchorImg:fmPrevToImg(mid.x,mid.y) };
    } else fmPrevGesture = null;
  }
  function fmPrevEnd(e){
    delete fmPrevPointers[e.pointerId];
    try{ fmPrevCanvas.releasePointerCapture(e.pointerId); }catch(err){}
    fmPrevRebase();
  }
