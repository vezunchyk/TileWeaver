/* js/init/20-pointer.js — Код запуску теми: Взаємодія з канвою: жести, інструменти, перетягування, малювання. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- pointer interaction on main canvas ----------
  pointers = new Map();
  mode = null;
  startPt = null, moved = false, dragTarget = null, pinchStart = null;
  animTapTarget = null; // тайл під пальцем при тапі інструментом «Рука» — після відпускання (без руху) програє анімацію
  resizeData = null;
  rotateData = null;
  skewData = null;
  dragRectW = 0, dragRectH = 0;
  dragOrigin = null, startWorldPt = null;
  THRESH = 8;

    wrap.addEventListener('pointerdown', function(e){
    if(e.target.closest && e.target.closest('#selPanel, #shadowPanel')) return;
    animTapTarget = null; // другий палець (щипок) скасовує тап
    try{ wrap.setPointerCapture(e.pointerId); }catch(err){}
    pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
    if(pointers.size===1){
      startPt = {x:e.clientX, y:e.clientY}; moved=false;
      var r = wrap.getBoundingClientRect();
      var wpt = screenToWorld(e.clientX-r.left, e.clientY-r.top);

      animTapTarget = (tool === 'pan') ? hitTestPlacement(wpt.x, wpt.y) : null;
      if(tool === 'shadow'){ mode = 'tapPending'; return; } // тап = вибір обʼєкта, перетяг = камера
      // 1. ВИДІЛЕННЯ РАМКОЮ (МАЄ БУТИ ПЕРШИМ)
      if (tool === 'select') {
        mode = 'drawArea';
        areaSelect = { x0: wpt.x, y0: wpt.y, x1: wpt.x, y1: wpt.y };
        selected = null;
        return;
      }
      
      // 2. ТЯГНУТИ ГРУПУ (МАЄ БУТИ ПЕРЕД ЗВИЧАЙНИМ ТЯГНЕННЯМ)
      if (tool === 'pan' && selected && selected.type === 'multi') {
         var hitMulti = hitTestPlacement(wpt.x, wpt.y);
         if (hitMulti && selected.ids.includes(hitMulti.id) && !hitMulti.locked){
             mode = 'multiDragMove';
             startWorldPt = wpt;
             dragOrigins = selected.ids.map(function(id){
                 var p = placementById(id);
                 // Заблоковані члени групи лишаються на місці, навіть якщо група вибрана
                 // разом з ними (select-house тепер підхоплює й заблоковані — щоб їх можна
                 // було повторно вибрати й розблокувати, але рухати їх дозволу нема).
                 if(p && p.locked) return null;
                 return p ? { id: id, x: p.x, y: p.y } : null;
             }).filter(function(x){ return x; });
             pushUndo(); return;
         }
      }

      // 3. ЗВИЧАЙНЕ ТЯГНЕННЯ ОДНОГО ТАЙЛА ТА ІНШІ ІНСТРУМЕНТИ
      if(tool==='pan' && selected && selected.type==='placement'){
          var p = placementById(selected.id);
          // Раніше тут стояв return — через що ЦЕЙ САМИЙ return спрацьовував і на ВСІХ наступних
          // тапах (бо selected лишався вказувати на заблокований обʼєкт), і користувач не міг
          // ні панорамувати, ні вибрати інший обʼєкт, доки не перемкне інструмент. Тепер просто
          // "забуваємо" про p (не тягнемо/не resize), і виконання провалюється нижче до звичайного
          // hit-test за НОВОЮ точкою тапу (блок "if(tool==='pan'){...}" нижче) — так інструмент
          // одразу підхоплює або нове панорамування, або новий обʼєкт під пальцем.
          if(p && p.locked){ p = null; }
          if(p){
              var b = placementBBox(p);
              if(rotatingId === p.id){
                  var hRotEl = document.getElementById('hRot');
                  var hrRect = { left: parseFloat(hRotEl.style.left), top: parseFloat(hRotEl.style.top) };
                  var dist = Math.hypot((e.clientX-r.left) - hrRect.left, (e.clientY-r.top) - hrRect.top);
                  if(dist < 26){
                      mode = 'rotateHandle';
                      var ccx=(b.x0+b.x1)/2, ccy=(b.y0+b.y1)/2;
                      rotateData = { target:p, cx:ccx, cy:ccy };
                      pushUndo(); return;
                  }
                  var hSkewEl = document.getElementById('hSkew');
                  var hsRect = { left: parseFloat(hSkewEl.style.left), top: parseFloat(hSkewEl.style.top) };
                  var distS = Math.hypot((e.clientX-r.left) - hsRect.left, (e.clientY-r.top) - hsRect.top);
                  if(distS < 26){
                      mode = 'skewHandle';
                      skewData = { target:p, startSkew:p.skewX||0, startScreenX:e.clientX-r.left, halfH:(b.y1-b.y0)/2 };
                      pushUndo(); return;
                  }
              }
              var shTile = project.tiles[p.tileId];
              if(isShadowTile(shTile) && rotatingId !== p.id){
                  var rEl = document.getElementById('hRatio');
                  if(rEl.style.display !== 'none' && Math.hypot((e.clientX-r.left)-parseFloat(rEl.style.left), (e.clientY-r.top)-parseFloat(rEl.style.top)) < 24){
                      shadowKeepRatio = !shadowKeepRatio; mode = 'ratioTap'; render(); return;
                  }
                  var emx2 = (b.x0+b.x1)/2, emy2 = (b.y0+b.y1)/2;
                  var edgeDefs = [['T',emx2,b.y0,0,-1],['B',emx2,b.y1,0,1],['L',b.x0,emy2,-1,0],['R',b.x1,emy2,1,0]];
                  for(var ei=0; ei<edgeDefs.length; ei++){
                      var ed = edgeDefs[ei], esc = worldToScreen(ed[1], ed[2]);
                      if(Math.hypot((e.clientX-r.left)-esc.x, (e.clientY-r.top)-esc.y) < 26){
                          mode = 'resizeHandle';
                          resizeData = { target:p, free:true, hx:ed[3], hy:ed[4], bx0:b.x0, by0:b.y0, bx1:b.x1, by1:b.y1, pv:b.pv, ga:gridAnchorOffset(shTile), w0:b.w, h0:b.h };
                          pushUndo(); return;
                      }
                  }
              }
              var handleHit = hitTestHandle(e.clientX-r.left, e.clientY-r.top, b);
              if(handleHit){
                  mode='resizeHandle';
                  var cx=(b.x0+b.x1)/2, cy=(b.y0+b.y1)/2;
                  var d0 = Math.hypot(wpt.x-cx, wpt.y-cy) || 1;
                  resizeData = { target:p, cx:cx, cy:cy, d0:d0, sx0:p.scaleX, sy0:p.scaleY };
                  if(isShadowTile(project.tiles[p.tileId])){
                      // вільна трансформація: протилежна сторона/кут стоїть, тягнена іде за пальцем
                      resizeData = { target:p, free:true, hx:(handleHit==='TL'||handleHit==='BL')?-1:1, hy:(handleHit==='TL'||handleHit==='TR')?-1:1, bx0:b.x0, by0:b.y0, bx1:b.x1, by1:b.y1, pv:b.pv, ga:gridAnchorOffset(project.tiles[p.tileId]), w0:b.w, h0:b.h };
                  }
                  pushUndo(); return;
              }
              if(wpt.x>=b.x0 && wpt.x<=b.x1 && wpt.y>=b.y0 && wpt.y<=b.y1){ mode='dragMove'; dragTarget=p; dragOrigin={x:p.x,y:p.y}; startWorldPt=wpt; pushUndo(); return; }
          }
      } else if(tool==='pan' && selected && selected.type==='collision'){
          var s = project.collisions.find(function(cc){return cc.id===selected.id;});
          // Та сама причина, що й для заблокованого placement вище — не return, а падаємо
          // нижче до свіжого hit-test за поточним тапом, інакше застрягаємо назавжди.
          if(s && s.locked){ s = null; }
          if(s && s.shape==='poly'){
              var pvi = hitTestPolyVertex(e.clientX-r.left, e.clientY-r.top, s);
              if(pvi >= 0){ mode='resizePolyVertex'; resizeData = { target:s, idx:pvi }; pushUndo(); return; }
              if(pointInPoly(wpt.x, wpt.y, s.pts)){ beginCollisionDrag(s, wpt); return; }
              s = null; // мимо — падаємо до свіжого hit-test нижче
          }
          if(s){
              var cb = collisionBBox(s);
              var handleHit2 = hitTestHandle(e.clientX-r.left, e.clientY-r.top, cb);
              if(handleHit2){
                  if(s.shape==='circle'){
                      mode='resizeHandle';
                      var d0c = Math.hypot(wpt.x-s.x, wpt.y-s.y) || 1;
                      resizeData = { target:s, cx:s.x, cy:s.y, d0:d0c, r0:s.r };
                  } else {
                      mode='resizeCollisionRect';
                      resizeData = { target:s, corner:handleHit2 };
                  }
                  pushUndo(); return;
              }
              var inBody = s.shape==='circle' ? (Math.hypot(wpt.x-s.x, wpt.y-s.y) <= s.r) : (wpt.x>=s.x0 && wpt.x<=s.x1 && wpt.y>=s.y0 && wpt.y<=s.y1);
              if(inBody){
                  if(s.shape==='circle'){ mode='dragMove'; dragTarget=s; dragOrigin={x:s.x,y:s.y}; startWorldPt=wpt; }
                  else { mode='dragMoveRect'; dragTarget=s; dragRectW=s.x1-s.x0; dragRectH=s.y1-s.y0; dragOrigin={x:s.x0,y:s.y0}; startWorldPt=wpt; }
                  pushUndo(); return;
              }
          }
      }
      if(tool==='pan'){
          var hitAnyS = hitTestSpawn(wpt.x, wpt.y);
          if(hitAnyS){
              selected={type:'spawn', id:hitAnyS.id};
              mode='dragMove'; dragTarget=hitAnyS; dragOrigin={x:hitAnyS.x,y:hitAnyS.y}; startWorldPt=wpt; pushUndo(); return;
          }
          var hitAnyP = hitTestPlacement(wpt.x, wpt.y);
          var hitAnyC = hitTestCollision(wpt.x, wpt.y);
          // Колізії часто малюють ТОЧНО поверх обʼєкта, який вони захищають (будинок/дерево) —
          // якщо завжди пріоритет віддавати плейсменту, колізія під ним стає взагалі
          // недосяжною тапом. Тому коли влучили в ОБИДВА — вибираємо той, у якого МЕНША площа
          // bbox (зазвичай саме він і є "точнішою", навмисно вужчою ціллю тапу).
          if(hitAnyP && hitAnyC){
              var pbb = placementBBox(hitAnyP), cbb = collisionBBox(hitAnyC);
              var pArea = pbb.w*pbb.h, cArea = (cbb.x1-cbb.x0)*(cbb.y1-cbb.y0);
              if(cArea < pArea) hitAnyP = null; else hitAnyC = null;
          }
          if(hitAnyP){
              selected={type:'placement', id:hitAnyP.id};
              if(hitAnyP.locked){ render(); return; } // дозволяємо вибрати заблокований обʼєкт (щоб дістатись кнопки розблокування), але не тягнути
              mode='dragMove'; dragTarget=hitAnyP; dragOrigin={x:hitAnyP.x,y:hitAnyP.y}; startWorldPt=wpt; pushUndo(); return;
          }
          if(hitAnyC){
              selected={type:'collision', id:hitAnyC.id};
              if(hitAnyC.locked){ render(); return; } // дозволяємо вибрати заблоковану колізію (щоб дістатись кнопки розблокування), але не тягнути
              beginCollisionDrag(hitAnyC, wpt); return;
          }
          mode='pan'; return;
      }
      if(tool==='collision' && colSelectMode){ mode='drawShape'; drawingShape={shape:'rect', sel:true, x0:wpt.x,y0:wpt.y,x1:wpt.x,y1:wpt.y}; return; }
      if(tool==='collision' && collisionMode!=='texture' && collisionMode!=='feet'){
          // Спочатку перевіряємо, чи тап влучив у ВЖЕ ІСНУЮЧУ колізію — якщо так, вибираємо й
          // одразу дозволяємо тягнути/змінювати розмір, замість того щоб малювати нову поверх.
          // Без цього єдиний спосіб перемістити/видалити колізію — здогадатись перемкнутись на
          // інструмент "Рука", що неочевидно.
          var hitExistingC = hitTestCollision(wpt.x, wpt.y);
          if(hitExistingC){
              selected = {type:'collision', id:hitExistingC.id};
              tool = 'pan'; updateToolButtons();
              if(!hitExistingC.locked){
                beginCollisionDrag(hitExistingC, wpt);
              } else {
                render();
              }
              return;
          }
          mode='drawShape';
          drawingShape = collisionMode==='circle' ? {shape:'circle', x:wpt.x, y:wpt.y, r:1} : {shape:(collisionMode==='iso' ? 'isoPreview' : 'rect'), x0:wpt.x,y0:wpt.y,x1:wpt.x,y1:wpt.y};
          return;
      }
      if(tool==='clone' && cloneMode!=='line' && cloneMode!=='stamp' && cloneMode!=='block'){
          mode='drawShape';
          if(cloneMode==='fillrect' || cloneMode==='scatter') drawingShape = {shape:'rect', x0:wpt.x,y0:wpt.y,x1:wpt.x,y1:wpt.y};
          else {
              var gg = worldToCell(wpt.x, wpt.y);
              drawingShape = {shape:'diamondPreview', cx:wpt.x, cy:wpt.y, c0:Math.round(gg.c), r0:Math.round(gg.r), radius:0};
          }
          return;
      }
      
      mode='tapPending'; // 'stamp' (як і 'line') теж падає сюди — одна точка дотику, без малювання прямокутника/ромба
        } else if(pointers.size===2){
      mode=null; drawingShape=null;
      var pts = Array.from(pointers.values());
      var dx = pts[0].x - pts[1].x;
      var dy = pts[0].y - pts[1].y;
      
      var r = wrap.getBoundingClientRect();
      var cx = (pts[0].x + pts[1].x) / 2 - r.left; // Рахуємо центр між пальцями
      var cy = (pts[0].y + pts[1].y) / 2 - r.top;
      
      // Запам'ятовуємо координату світу, яка лежить рівно під пальцями
      var wx = (cx - view.panX) / view.zoom;
      var wy = (cy - view.panY) / view.zoom;
      
      pinchStart = { dist: Math.hypot(dx,dy), zoom: view.zoom, cx: cx, cy: cy, wx: wx, wy: wy };
    }

  });
    

  wrap.addEventListener('pointermove', function(e){
    if(!pointers.has(e.pointerId)) return;
    pointers.set(e.pointerId, {x:e.clientX,y:e.clientY});
        if(pointers.size===2 && pinchStart){
      var pts = Array.from(pointers.values());
      var dx = pts[0].x - pts[1].x;
      var dy = pts[0].y - pts[1].y;
      var dist = Math.hypot(dx,dy);
      var newZoom = Math.min(32, Math.max(0.15, pinchStart.zoom * (dist / pinchStart.dist)));
      
      var r = wrap.getBoundingClientRect();
      var currentCx = (pts[0].x + pts[1].x) / 2 - r.left; // Новий центр між пальцями (дозволяє тягнути карту двома пальцями)
      var currentCy = (pts[0].y + pts[1].y) / 2 - r.top;
      
      view.zoom = newZoom;
      // Зсуваємо камеру так, щоб точка світу завжди залишалася примагніченою до центру пальців
      view.panX = Math.round(currentCx - pinchStart.wx * newZoom);
      view.panY = Math.round(currentCy - pinchStart.wy * newZoom);
      
      scheduleRender(); return;
    }

    if(!startPt) return;
    var dx2 = e.clientX-startPt.x, dy2 = e.clientY-startPt.y;
    if(Math.hypot(dx2,dy2) > THRESH) moved = true;
    var r = wrap.getBoundingClientRect();

    if(mode==='dragMove' && dragTarget && dragOrigin && startWorldPt){
      var curWorld = screenToWorld(e.clientX-r.left, e.clientY-r.top);
      var newX = dragOrigin.x + (curWorld.x - startWorldPt.x);
      var newY = dragOrigin.y + (curWorld.y - startWorldPt.y);
      if(snapOn){ var sp = snapPoint(newX,newY); dragTarget.x=px(sp.x); dragTarget.y=px(sp.y); }
      else { dragTarget.x = px(newX); dragTarget.y = px(newY); }
      scheduleRender(); return;
    }
    if(mode==='resizeHandle' && resizeData){
      var wpt2 = screenToWorld(e.clientX-r.left, e.clientY-r.top);
      var d1 = Math.hypot(wpt2.x-resizeData.cx, wpt2.y-resizeData.cy) || 1;
      var factor = d1/resizeData.d0;
      if(resizeData.target.shape==='circle'){
        resizeData.target.r = Math.max(2, px(resizeData.r0*factor));
      } else {
        var img = project.tiles[resizeData.target.tileId].img;
        if(resizeData.free){
          var rd = resizeData, tg = rd.target;
          var fW = rd.w0, fH = rd.h0, fx0 = rd.bx0, fy0 = rd.by0;
          if(rd.hx < 0){ fW = Math.max(2, px(rd.bx1 - wpt2.x)); fx0 = rd.bx1 - fW; }
          else if(rd.hx > 0){ fW = Math.max(2, px(wpt2.x - rd.bx0)); fx0 = rd.bx0; }
          if(rd.hy < 0){ fH = Math.max(2, px(rd.by1 - wpt2.y)); fy0 = rd.by1 - fH; }
          else if(rd.hy > 0){ fH = Math.max(2, px(wpt2.y - rd.by0)); fy0 = rd.by0; }
          if(shadowKeepRatio && rd.hx && rd.hy){ fH = Math.max(2, px(fW * rd.h0 / rd.w0)); fy0 = rd.hy < 0 ? rd.by1 - fH : rd.by0; }
          tg.scaleX = fW / img.naturalWidth; tg.scaleY = fH / img.naturalHeight;
          tg.x = px(fx0 - rd.ga.x + fW*rd.pv.x); tg.y = px(fy0 - rd.ga.y + fH*rd.pv.y);
          scheduleRender(); return;
        }
        var newW = Math.max(2, px(img.naturalWidth*resizeData.sx0*factor));
        var newH = Math.max(2, px(img.naturalHeight*resizeData.sy0*factor));
        resizeData.target.scaleX = newW/img.naturalWidth;
        resizeData.target.scaleY = newH/img.naturalHeight;
      }
      scheduleRender(); return;
    }
    if(mode==='rotateHandle' && rotateData){
      var wptR = screenToWorld(e.clientX-r.left, e.clientY-r.top);
      var angleRad = Math.atan2(wptR.x - rotateData.cx, -(wptR.y - rotateData.cy));
      var deg = angleRad * 180/Math.PI;
      if(deg < 0) deg += 360;
      rotateData.target.rotation = deg;
      scheduleRender(); return;
    }
    if(mode==='skewHandle' && skewData){
      var deltaScreenX = (e.clientX-r.left) - skewData.startScreenX;
      var deltaWorldX = deltaScreenX / view.zoom;
      var newSkew = skewData.startSkew + (skewData.halfH>0 ? deltaWorldX/skewData.halfH : 0);
      newSkew = Math.max(-3, Math.min(3, newSkew));
      skewData.target.skewX = newSkew;
      scheduleRender(); return;
    }
    if(mode==='resizePolyVertex' && resizeData){
      var wpv = screenToWorld(e.clientX-r.left, e.clientY-r.top);
      resizeData.target.pts[resizeData.idx] = { x:px(wpv.x), y:px(wpv.y) };
      scheduleRender(); return;
    }
    if(mode==='dragMovePoly' && dragTarget && dragPts0 && startWorldPt){
      var cwp = screenToWorld(e.clientX-r.left, e.clientY-r.top);
      var pdx = px(cwp.x - startWorldPt.x), pdy = px(cwp.y - startWorldPt.y);
      dragTarget.pts = dragPts0.map(function(q){ return { x:q.x+pdx, y:q.y+pdy }; });
      scheduleRender(); return;
    }
    if(mode==='resizeCollisionRect' && resizeData){
      var wpt3 = screenToWorld(e.clientX-r.left, e.clientY-r.top);
      var s2 = resizeData.target;
      var rx = px(wpt3.x), ry = px(wpt3.y);
      if(resizeData.corner==='TL'){ s2.x0=rx; s2.y0=ry; }
      else if(resizeData.corner==='TR'){ s2.x1=rx; s2.y0=ry; }
      else if(resizeData.corner==='BL'){ s2.x0=rx; s2.y1=ry; }
      else { s2.x1=rx; s2.y1=ry; }
      scheduleRender(); return;
    }
    if(mode==='dragMoveRect' && dragTarget && dragOrigin && startWorldPt){
      var curWorld2 = screenToWorld(e.clientX-r.left, e.clientY-r.top);
      var nx0 = dragOrigin.x + (curWorld2.x - startWorldPt.x);
      var ny0 = dragOrigin.y + (curWorld2.y - startWorldPt.y);
      if(snapOn){ var sp2 = snapPoint(nx0,ny0); nx0=sp2.x; ny0=sp2.y; }
      nx0 = px(nx0); ny0 = px(ny0);
      dragTarget.x0=nx0; dragTarget.y0=ny0; dragTarget.x1=nx0+dragRectW; dragTarget.y1=ny0+dragRectH;
      scheduleRender(); return;
    }
        // МАЛЮВАННЯ РАМКИ
    if (mode === 'drawArea' && areaSelect) {
        var wptA = screenToWorld(e.clientX-r.left, e.clientY-r.top);
        areaSelect.x1 = wptA.x; areaSelect.y1 = wptA.y;
        scheduleRender(); return;
    }
    
    // ПЕРЕМІЩЕННЯ ВСІЄЇ ГРУПИ
    if (mode === 'multiDragMove' && dragOrigins && startWorldPt) {
        var curWorld = screenToWorld(e.clientX-r.left, e.clientY-r.top);
        var ddx = curWorld.x - startWorldPt.x;
        var ddy = curWorld.y - startWorldPt.y;
        
        var snapDx = ddx, snapDy = ddy;
        if (snapOn && dragOrigins.length > 0) {
            // Рахуємо прив'язку до сітки по першому об'єкту групи, щоб група не розпалася
            var first = dragOrigins[0];
            var sp = snapPoint(first.x + ddx, first.y + ddy);
            snapDx = sp.x - first.x; snapDy = sp.y - first.y;
        }
        
        dragOrigins.forEach(function(orig){
            var p = placementById(orig.id);
            if (p) { p.x = px(orig.x + snapDx); p.y = px(orig.y + snapDy); }
        });
        scheduleRender(); return;
    }
    
        if(mode==='pan' || (mode==='tapPending' && moved)){
      mode='pan'; 
      // Жорстко округлюємо рух камери, щоб сітка не "дригалася" між пікселями
      view.panX = Math.round(view.panX + dx2); 
      view.panY = Math.round(view.panY + dy2);
      startPt = {x:e.clientX, y:e.clientY}; 
      scheduleRender(); return;
        }
    
    if(mode==='drawShape' && drawingShape){
      var wpt = screenToWorld(e.clientX-r.left, e.clientY-r.top);
      if(drawingShape.shape==='circle'){
        var ddx=wpt.x-drawingShape.x, ddy=wpt.y-drawingShape.y;
        drawingShape.r = Math.max(2, Math.hypot(ddx,ddy));
      } else if(drawingShape.shape==='diamondPreview'){
        var gg2 = worldToCell(wpt.x, wpt.y);
        var dc = Math.round(gg2.c)-drawingShape.c0, dr = Math.round(gg2.r)-drawingShape.r0;
        drawingShape.radius = Math.max(0, Math.abs(dc)+Math.abs(dr));
      } else { drawingShape.x1 = wpt.x; drawingShape.y1 = wpt.y; }
      scheduleRender(); return;
    }
  });
  wrap.addEventListener('pointerup', endPointer);
  wrap.addEventListener('pointercancel', endPointer);
