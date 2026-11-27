/* js/tools/pointer.js — Взаємодія з канвою: жести, інструменти, перетягування, малювання.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function px(v){ return Math.round(v); }
  function beginCollisionDrag(c, wpt){
    dragTarget = c; startWorldPt = wpt;
    if(c.shape==='circle'){ mode='dragMove'; dragOrigin={x:c.x,y:c.y}; }
    else if(c.shape==='poly'){ mode='dragMovePoly'; dragPts0 = c.pts.map(function(q){ return {x:q.x,y:q.y}; }); }
    else { mode='dragMoveRect'; dragRectW=c.x1-c.x0; dragRectH=c.y1-c.y0; dragOrigin={x:c.x0,y:c.y0}; }
    pushUndo();
  }

  function hitTestHandle(sx, sy, b){
    var names = ['TL','TR','BL','BR'];
    var corners = [ worldToScreen(b.x0,b.y0), worldToScreen(b.x1,b.y0), worldToScreen(b.x0,b.y1), worldToScreen(b.x1,b.y1) ];
    for(var i=0;i<corners.length;i++){
      if(Math.hypot(sx-corners[i].x, sy-corners[i].y) < 26) return names[i];
    }
    return null;
  }
  function collisionBBox(s){
    if(s.shape==='circle') return { x0:s.x-s.r, y0:s.y-s.r, x1:s.x+s.r, y1:s.y+s.r };
    if(s.shape==='poly') return polyBBox(s);
    return { x0:s.x0, y0:s.y0, x1:s.x1, y1:s.y1 };
  }

  function endPointer(e){
    if(pointers.has(e.pointerId)) pointers.delete(e.pointerId);
    if(pointers.size<2) pinchStart=null;
    if(pointers.size===0){
      if(animTapTarget){ var atp = animTapTarget; animTapTarget = null; if(e.type==='pointerup' && !moved && tool==='pan') startPlacementAnim(atp); }
      var r = wrap.getBoundingClientRect();
      if(mode==='dragMove'){ saveActiveProject(); }
      else if(mode==='dragMoveRect'){ saveActiveProject(); }
      else if(mode==='dragMovePoly'){ dragPts0=null; saveActiveProject(); }
      else if(mode==='resizePolyVertex'){ resizeData=null; saveActiveProject(); }
      else if(mode==='resizeCollisionRect'){
        var s3 = resizeData.target;
        var nx0=Math.min(s3.x0,s3.x1), nx1=Math.max(s3.x0,s3.x1), ny0=Math.min(s3.y0,s3.y1), ny1=Math.max(s3.y0,s3.y1);
        s3.x0=nx0; s3.x1=nx1; s3.y0=ny0; s3.y1=ny1;
        resizeData=null; saveActiveProject();
      }
      else if(mode==='resizeHandle'){ resizeData=null; saveActiveProject(); }
      else if(mode==='rotateHandle'){ rotateData=null; saveActiveProject(); }
      else if(mode==='skewHandle'){ skewData=null; saveActiveProject(); }
      else if(mode==='drawShape' && drawingShape && drawingShape.sel){
        var rx0=Math.min(drawingShape.x0,drawingShape.x1), rx1=Math.max(drawingShape.x0,drawingShape.x1), ry0=Math.min(drawingShape.y0,drawingShape.y1), ry1=Math.max(drawingShape.y0,drawingShape.y1);
        if(rx1-rx0<6 && ry1-ry0<6){ var hc=hitTestCollision(drawingShape.x0,drawingShape.y0); if(hc && !hc.locked){ if(colMulti[hc.id]) delete colMulti[hc.id]; else colMulti[hc.id]=1; } }
        else { project.collisions.forEach(function(c){ if(c.locked || (c.onFloor||1)!==collisionFloor) return; var bb=collisionBBox(c); if(bb.x1>=rx0 && bb.x0<=rx1 && bb.y1>=ry0 && bb.y0<=ry1) colMulti[c.id]=1; }); }
        drawingShape=null; buildModeBar(); render();
      }
      else if(mode==='drawShape' && drawingShape && moved){
        if(tool==='collision'){
          pushUndo();
          var newColl = null;
          if(drawingShape.shape==='rect'){
            var x0=px(Math.min(drawingShape.x0,drawingShape.x1)), x1=px(Math.max(drawingShape.x0,drawingShape.x1));
            var y0=px(Math.min(drawingShape.y0,drawingShape.y1)), y1=px(Math.max(drawingShape.y0,drawingShape.y1));
            if(x1-x0>2 && y1-y0>2){ newColl = {id:'c'+(colIdCounter++), shape:'rect', x0:x0,y0:y0,x1:x1,y1:y1}; }
          } else if(drawingShape.shape==='isoPreview'){
            var ix0=Math.min(drawingShape.x0,drawingShape.x1), ix1=Math.max(drawingShape.x0,drawingShape.x1);
            var iy0=Math.min(drawingShape.y0,drawingShape.y1), iy1=Math.max(drawingShape.y0,drawingShape.y1);
            if(ix1-ix0>4 && iy1-iy0>4){ newColl = {id:'c'+(colIdCounter++), shape:'poly', pts:isoPtsFromRect(ix0,iy0,ix1,iy1)}; }
          } else {
            newColl = {id:'c'+(colIdCounter++), shape:'circle', x:px(drawingShape.x), y:px(drawingShape.y), r:Math.max(2,px(drawingShape.r))};
          }
          if(newColl){
            newColl.type = collisionType; newColl.onFloor = collisionFloor;
            project.collisions.push(newColl);
            if(collisionType!=='solid') promptCollisionMeta(newColl);
          }
          saveActiveProject();
        } else if(tool==='clone' && cloneMode==='scatter'){
          if(drawingShape.shape==='rect'){
            applyScatterFill(drawingShape.x0, drawingShape.y0, drawingShape.x1, drawingShape.y1);
          }
        } else if(tool==='clone' && activeTileId){
          var actLyr = getLayer(project.activeLayerId);
          if(actLyr.locked) { toast(t('toastLayerLocked')); drawingShape=null; render(); return; }
          pushUndo();
          var fs2 = {x:1, y:1};
          var fillZ2 = newPlacementZ(project.activeLayerId);
          if(drawingShape.shape==='rect'){
            var c0p = worldToCell(drawingShape.x0, drawingShape.y0), c1p = worldToCell(drawingShape.x1, drawingShape.y1);
            var cMin=Math.round(Math.min(c0p.c,c1p.c)), cMax=Math.round(Math.max(c0p.c,c1p.c));
            var rMin=Math.round(Math.min(c0p.r,c1p.r)), rMax=Math.round(Math.max(c0p.r,c1p.r));
            for(var cc=cMin; cc<=cMax; cc++) for(var rr2=rMin; rr2<=rMax; rr2++){
              var wp = cellToWorld(cc,rr2);
              project.placements.push({ id:'p'+(placeIdCounter++), tileId:activeTileId, x:px(wp.x), y:px(wp.y), z:fillZ2, layerId:project.activeLayerId, scaleX:fs2.x, scaleY:fs2.y, flipX:false });
            }
          } else if(drawingShape.shape==='diamondPreview'){
            var rad = drawingShape.radius;
            for(var ddc=-rad; ddc<=rad; ddc++){
              for(var ddr=-rad; ddr<=rad; ddr++){
                if(Math.abs(ddc)+Math.abs(ddr) <= rad){
                  var wp2 = cellToWorld(drawingShape.c0+ddc, drawingShape.r0+ddr);
                  project.placements.push({ id:'p'+(placeIdCounter++), tileId:activeTileId, x:px(wp2.x), y:px(wp2.y), z:fillZ2, layerId:project.activeLayerId, scaleX:fs2.x, scaleY:fs2.y, flipX:false });
                }
              }
            }
          }
          saveActiveProject();
        }
        drawingShape=null;
      }
      else if(mode==='drawShape'){ drawingShape=null; }
      else if(mode==='pan' && !moved){
        if(selected) selected = null;
      }
      else if(mode==='tapPending' && !moved){
        var wpt = screenToWorld(startPt.x-r.left, startPt.y-r.top);
        if(tool==='shadow'){ shadowTap(wpt.x, wpt.y); }
        else if(tool==='collision' && (collisionMode==='texture' || collisionMode==='feet')){
          var hitP = hitTestPlacement(wpt.x, wpt.y);
          if(hitP){
             pushUndo();
            var b = opaqueWorldBBox(hitP); // лише непрозорий контент, без прозорого фону
            var polyT = opaqueWorldPoly(hitP, collisionMode==='feet');
            var newCollT = polyT ? {id:'c'+(colIdCounter++), shape:'poly', pts:polyT, type:collisionType}
              : {id:'c'+(colIdCounter++), shape:'rect', x0:px(b.x0),y0:px(b.y0),x1:px(b.x1),y1:px(b.y1), type:collisionType};
            newCollT.onFloor = collisionFloor; project.collisions.push(newCollT);
            if(collisionType!=='solid') promptCollisionMeta(newCollT);
            saveActiveProject();
          }
        } else if(tool==='clone' && cloneMode==='line'){
          var actLyr = getLayer(project.activeLayerId);
          if(actLyr.locked) { toast(t('toastLayerLocked')); return; }
          var sp3 = snapPoint(wpt.x, wpt.y);
          cloneAnchor = {x:px(sp3.x), y:px(sp3.y)};
        } else if(tool==='clone' && cloneMode==='block'){
          if(!activeTileId){ toast('Спершу обери тайл'); return; }
          var actLyrB = getLayer(project.activeLayerId);
          if(actLyrB.locked) { toast(t('toastLayerLocked')); return; }
          // прочитати розмір з поля (на випадок, якщо change ще не спрацював)
          var bi = document.getElementById('cloneBlockInput');
          if(bi){
            var bm = String(bi.value).match(/(\d+)\D+(\d+)/);
            if(bm){ cloneBlockW = Math.max(1,Math.min(60,parseInt(bm[1]))); cloneBlockH = Math.max(1,Math.min(60,parseInt(bm[2]))); }
          }
          pushUndo();
          var bg = worldToCell(wpt.x, wpt.y);
          var bc0 = Math.round(bg.c) - Math.floor(cloneBlockW/2), br0 = Math.round(bg.r) - Math.floor(cloneBlockH/2);
          var bz = newPlacementZ(project.activeLayerId);
          var bIds = [], bxs = [], bys = [];
          for(var bcc=0; bcc<cloneBlockW; bcc++) for(var brr=0; brr<cloneBlockH; brr++){
            var bwp = cellToWorld(bc0+bcc, br0+brr);
            var bnp = { id:'p'+(placeIdCounter++), tileId:activeTileId, x:px(bwp.x), y:px(bwp.y), z:bz, layerId:project.activeLayerId, scaleX:1, scaleY:1, flipX:false };
            project.placements.push(bnp); bIds.push(bnp.id); bxs.push(bnp.x); bys.push(bnp.y);
          }
          selected = { type:'multi', ids:bIds, minX:Math.min.apply(null,bxs), maxX:Math.max.apply(null,bxs), minY:Math.min.apply(null,bys), maxY:Math.max.apply(null,bys), houseGroup:null };
          saveActiveProject();
          tool = 'pan'; updateToolButtons(); render();
        } else if(tool==='clone' && cloneMode==='stamp'){
          if(!currentStamp){ toast(t('toastSelectGroupFirst')); return; }
          var actLyrS = getLayer(project.activeLayerId);
          if(actLyrS.locked) { toast(t('toastLayerLocked')); return; }
          pushUndo();
          var stampPt = snapOn ? snapPoint(wpt.x, wpt.y) : wpt;
          var newIdsS = [];
          // Кожна ПОСТАНОВКА штампа — це новий будинок, не той самий. Якщо просто копіювати
          // it.group як є, то всі копії, проштамповані з одного штампа (і сам оригінал),
          // стають ОДНІЄЮ групою — lock/unlock, house mode й вибір будинку тоді зачіпають їх
          // усі одразу. Тому на кожен тап генеруємо НОВУ назву групи (одну на кожну стару
          // назву, що трапляється в штампі — якщо в штампі кілька будинків, зв'язки між ними
          // всередині ОДНІЄЇ постановки зберігаються, а від оригіналу й інших постановок вони
          // тепер незалежні).
          var groupRemapS = {};
          currentStamp.items.forEach(function(it){
            var npS = { id:'p'+(placeIdCounter++), tileId:it.tileId, x:px(stampPt.x+it.dx), y:px(stampPt.y+it.dy), z:it.z, layerId:project.activeLayerId, scaleX:it.scaleX, scaleY:it.scaleY, flipX:it.flipX, flipY:it.flipY, rotation:it.rotation, skewX:it.skewX };
            if(it.group!=null){
              if(!groupRemapS[it.group]) groupRemapS[it.group] = 'house_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
              npS.group = groupRemapS[it.group];
            }
            if(it.floor!=null) npS.floor = it.floor;
            if(it.isRoof) npS.isRoof = true;
            project.placements.push(npS); newIdsS.push(npS.id);
          });
          saveActiveProject();
        } else if(tool==='place' && activeTileId){
          var actLyr = getLayer(project.activeLayerId);
          if(actLyr.locked) { toast(t('toastLayerLocked')); return; }
          pushUndo();
          var placePt = snapOn ? snapPoint(wpt.x, wpt.y) : wpt;
          var fs3 = {x:1,y:1};
          project.placements.push({ id:'p'+(placeIdCounter++), tileId:activeTileId, x:px(placePt.x), y:px(placePt.y), z:newPlacementZ(project.activeLayerId), layerId:project.activeLayerId, scaleX:fs3.x, scaleY:fs3.y, flipX:false });
          saveActiveProject();
        } else if(tool==='spawn'){
          // Точка спавну — один узагальнений інструмент для всього (ящики, гриби, патрони,
          // NPC): конкретний тип — це просто текст, а не окрема кнопка/тайл. Завтра новий
          // тип лута — просто інший текст при розміщенні, редактор не міняється.
          var spawnPt = snapOn ? snapPoint(wpt.x, wpt.y) : wpt;
          var stype = prompt(t('promptSpawnType'), 'ящик');
          if(stype===null) return;
          var schanceStr = prompt(t('promptSpawnChance'), '100');
          if(schanceStr===null) return;
          pushUndo();
          var schance = Math.max(0, Math.min(100, parseInt(schanceStr)||0));
          var newSpawn = { id:'s'+(spawnIdCounter++), x:px(spawnPt.x), y:px(spawnPt.y), spawnType:stype, chance:schance };
          project.spawns.push(newSpawn);
          selected = {type:'spawn', id:newSpawn.id};
          saveActiveProject();
        }
              
        
      }
      else if (mode === 'drawArea' && areaSelect) {
          var minX = Math.min(areaSelect.x0, areaSelect.x1);
          var maxX = Math.max(areaSelect.x0, areaSelect.x1);
          var minY = Math.min(areaSelect.y0, areaSelect.y1);
          var maxY = Math.max(areaSelect.y0, areaSelect.y1);
          
                              var selIds = [];
          project.placements.forEach(function(p){
              // Ігноруємо тайли з інших шарів
              if(p.layerId !== project.activeLayerId) return; 

              var lyr = getLayer(p.layerId);
              if(!lyr.visible || lyr.locked) return;
              // Заблоковані ОБ'ЄКТИ (на відміну від заблокованого ШАРУ вище) тепер НЕ виключаємо
              // з рамки виділення — інакше єдиний спосіб розблокувати купу заблокованих обʼєктів
              // це тикати в кожен окремо. Вони й далі не рухаються при груповому drag (це
              // фільтрується окремо в dragOrigins нижче), але потрапляють у selected.ids, тож
              // "🔒/🔓" на панелі групи бачить їх і може розблокувати всі одразу.

              if(p.shadowOf) return; // тіні їдуть за своїми обʼєктами, окремо їх не виділяємо
              // Тайл виділяється за своїм ТІЛОМ: центр спрайта в рамці, АБО рамка накриває ≥40% спрайта, АБО торкається його видимих пікселів
              var pb = placementBBox(p);
              var ox = Math.min(maxX, pb.x1) - Math.max(minX, pb.x0), oy = Math.min(maxY, pb.y1) - Math.max(minY, pb.y0);
              if(ox > 0 && oy > 0){
                var cxp = (pb.x0+pb.x1)/2, cyp = (pb.y0+pb.y1)/2;
                var inside = cxp >= minX && cxp <= maxX && cyp >= minY && cyp <= maxY;
                if(inside || (ox*oy) / Math.max(1,(pb.x1-pb.x0)*(pb.y1-pb.y0)) >= 0.4 ||
                   spriteTouchesRect(p, pb, Math.max(minX,pb.x0), Math.max(minY,pb.y0), Math.min(maxX,pb.x1), Math.min(maxY,pb.y1))) selIds.push(p.id);
              }
          });


          
          if (selIds.length > 0) {
              // Рамка НЕ рахувала houseGroup взагалі — тому навіть якщо всупередвиділені тайли
              // вже мали спільну group (це існуючий будинок), панель не бачила цього й ховала
              // Поверх/Дах, доки не натиснеш "Група" і не збережеш (навіть ту саму) назву вручну.
              // Тепер рахуємо самі: якщо ВСІ виділені тайли мають ту саму group — це будинок.
              var sharedGroup = null, sgFirst = true, sgMixed = false;
              selIds.forEach(function(sid){
                var spp = placementById(sid);
                if(!spp) return;
                if(sgFirst){ sharedGroup = spp.group || null; sgFirst = false; }
                else if(spp.group !== sharedGroup){ sgMixed = true; }
              });
              var refP0 = placementById(selIds[0]);
              selected = { type: 'multi', ids: selIds, minX: minX, maxX: maxX, minY: minY, maxY: maxY, houseGroup: (sgMixed ? null : sharedGroup),
                           rect: { x0:minX, y0:minY, x1:maxX, y1:maxY }, refId: selIds[0], refX: refP0 ? refP0.x : 0, refY: refP0 ? refP0.y : 0 };
              tool = 'pan'; updateToolButtons();
          } else {
              selected = null;
          }
          areaSelect = null; render();
      }
      else if (mode === 'multiDragMove') {
          saveActiveProject();
      }
      mode=null; startPt=null; moved=false; dragTarget=null; dragOrigin=null; startWorldPt=null;
      render();
    }
  }
