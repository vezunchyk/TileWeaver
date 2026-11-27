/* js/minimap.js — Мінімапа та модалка «вся карта» (зум і панорамування).
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function getTileAvgColor(tileId){
    if(tileAvgColorCache[tileId]) return tileAvgColorCache[tileId];
    var tile = project.tiles[tileId];
    var fallback = 'rgba(150,170,110,0.9)';
    if(!tile || !tile.img || !tile.img.complete || !tile.img.naturalWidth) return fallback;
    try{
      var sc = document.createElement('canvas'); sc.width=8; sc.height=8;
      var sctx = sc.getContext('2d');
      sctx.drawImage(tile.img, 0, 0, 8, 8);
      var data = sctx.getImageData(0,0,8,8).data;
      var r=0,g=0,b=0,n=0;
      for(var i=0;i<data.length;i+=4){
        if(data[i+3] < 20) continue; // прозорі пікселі не рахуємо в середнє
        r+=data[i]; g+=data[i+1]; b+=data[i+2]; n++;
      }
      var color = n===0 ? fallback : ('rgba('+Math.round(r/n)+','+Math.round(g/n)+','+Math.round(b/n)+',0.95)');
      tileAvgColorCache[tileId] = color;
      return color;
    }catch(e){ return fallback; } // напр. якщо картинка чомусь "брудна" для getImageData
  }

  function resizeMinimapCanvas(){
    var dpr = devicePixelRatio || 1;
    var px2 = Math.round(MINIMAP_CSS_SIZE*dpr);
    minimapEl.width = px2; minimapEl.height = px2;
    minimapContent.width = px2; minimapContent.height = px2;
    minimapDirty = true;
  }
  // Обчислює переклад світ<->мінімапа для заданого розміру канваси (спільна логіка для малої
  // постійної мінімапи і великої модалки — розмір різний, формула та сама).
  function computeMinimapBounds(W, H){
    if(!project.placements.length) return null;
    var minX=Infinity,minY=Infinity,maxX=-Infinity,maxY=-Infinity;
    for(var i=0;i<project.placements.length;i++){
      var b = placementBBox(project.placements[i]);
      if(b.x0<minX)minX=b.x0; if(b.x1>maxX)maxX=b.x1;
      if(b.y0<minY)minY=b.y0; if(b.y1>maxY)maxY=b.y1;
    }
    var pad = Math.max(40, (maxX-minX)*0.06);
    minX-=pad; minY-=pad; maxX+=pad; maxY+=pad;
    var worldW = Math.max(1, maxX-minX), worldH = Math.max(1, maxY-minY);
    var scale = Math.min(W/worldW, H/worldH);
    var offX = (W - worldW*scale)/2, offY = (H - worldH*scale)/2;
    return { minX:minX, minY:minY, scale:scale, offX:offX, offY:offY };
  }
  // Малює крапки-обʼєкти РЕАЛЬНИМ середнім кольором їхньої текстури (не одним узагальненим
  // кольором на все) — так будинок/дерево видно окремо від суцільної трави.
  function drawMinimapDots(targetCtx, bounds, dotSize){
    for(var j=0;j<project.placements.length;j++){
      var p = project.placements[j];
      var mx = bounds.offX + (p.x-bounds.minX)*bounds.scale, my = bounds.offY + (p.y-bounds.minY)*bounds.scale;
      targetCtx.fillStyle = getTileAvgColor(p.tileId);
      targetCtx.fillRect(mx-dotSize/2, my-dotSize/2, dotSize, dotSize);
    }
  }
  function rebuildMinimapContent(){
    var W = minimapContent.width, H = minimapContent.height;
    minimapContentCtx.clearRect(0,0,W,H);
    minimapBounds = computeMinimapBounds(W,H);
    minimapDirty = false;
    if(!minimapBounds) return; // порожня карта — нема що малювати
    drawMinimapDots(minimapContentCtx, minimapBounds, 2.5*(devicePixelRatio||1));
  }
  function renderMinimap(){
    minimapEl.style.display = showMinimap ? 'block' : 'none';
    if(!showMinimap) return;
    if(minimapDirty) rebuildMinimapContent();
    var W = minimapEl.width, H = minimapEl.height;
    minimapCtx.clearRect(0,0,W,H);
    if(!minimapBounds) return; // порожня карта — нема що показувати, крім самого фону
    minimapCtx.drawImage(minimapContent, 0, 0);
    var mb = minimapBounds;
    var rr = wrap.getBoundingClientRect();
    var tl = screenToWorld(0,0), br = screenToWorld(rr.width, rr.height);
    var vx0 = mb.offX + (tl.x-mb.minX)*mb.scale, vy0 = mb.offY + (tl.y-mb.minY)*mb.scale;
    var vx1 = mb.offX + (br.x-mb.minX)*mb.scale, vy1 = mb.offY + (br.y-mb.minY)*mb.scale;
    minimapCtx.strokeStyle = '#e8b84b';
    minimapCtx.lineWidth = Math.max(1, 1.5*(devicePixelRatio||1));
    minimapCtx.strokeRect(Math.min(vx0,vx1), Math.min(vy0,vy1), Math.abs(vx1-vx0), Math.abs(vy1-vy0));
  } // {x,y} world-координата, яка зараз по центру прев'ю модалки
  function getZoomedModalBounds(W, H){
    if(!minimapModalBaseBounds) return null;
    var base = minimapModalBaseBounds;
    if(!minimapModalCenter){
      minimapModalCenter = { x: base.minX + (W/2-base.offX)/base.scale, y: base.minY + (H/2-base.offY)/base.scale };
    }
    var scale = base.scale * minimapModalZoom;
    var offX = W/2 - (minimapModalCenter.x-base.minX)*scale;
    var offY = H/2 - (minimapModalCenter.y-base.minY)*scale;
    return { minX:base.minX, minY:base.minY, scale:scale, offX:offX, offY:offY };
  }
  function redrawMinimapModal(){
    var W = minimapModalCanvas.width, H = minimapModalCanvas.height;
    minimapModalCtx.clearRect(0,0,W,H);
    var mb = getZoomedModalBounds(W,H);
    if(!mb) return;
    drawMinimapDots(minimapModalCtx, mb, Math.max(2, 3*(devicePixelRatio||1)));
    // рамка ПОТОЧНОГО (реального) viewport основної карти — не міняється при перегляді/зумі прев'ю
    var rr = wrap.getBoundingClientRect();
    var tl = screenToWorld(0,0), br = screenToWorld(rr.width, rr.height);
    var vx0 = mb.offX+(tl.x-mb.minX)*mb.scale, vy0 = mb.offY+(tl.y-mb.minY)*mb.scale;
    var vx1 = mb.offX+(br.x-mb.minX)*mb.scale, vy1 = mb.offY+(br.y-mb.minY)*mb.scale;
    minimapModalCtx.strokeStyle = '#e8b84b';
    minimapModalCtx.lineWidth = Math.max(1, 2*(devicePixelRatio||1));
    minimapModalCtx.strokeRect(Math.min(vx0,vx1), Math.min(vy0,vy1), Math.abs(vx1-vx0), Math.abs(vy1-vy0));
  }
  function openMinimapModal(){
    var dpr = devicePixelRatio || 1;
    minimapModal.style.display = 'flex';
    // getBoundingClientRect() дає 0 до показу — тому міряємо ПІСЛЯ виставлення display:flex
    var cssRect = minimapModalCanvas.getBoundingClientRect();
    var cssW = Math.max(100, Math.round(cssRect.width)), cssH = Math.max(100, Math.round(cssRect.height));
    minimapModalCanvas.width = cssW*dpr; minimapModalCanvas.height = cssH*dpr;
    minimapModalZoom = 1;
    minimapModalCenter = null; // скидаємо — заново відцентрується на всю карту при першому кадрі
    minimapModalBaseBounds = computeMinimapBounds(minimapModalCanvas.width, minimapModalCanvas.height);
    redrawMinimapModal();
  }
  function zoomMinimapModal(factor){
    if(!minimapModalBaseBounds) return;
    minimapModalZoom = Math.max(1, Math.min(20, minimapModalZoom*factor));
    redrawMinimapModal();
  }
