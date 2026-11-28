/* js/init/15-frame-mapper.js — Код запуску теми: Повноекранний редактор кадрів анімації (fm*). Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- Повноекранний візуальний редактор кадрів анімації (двері, персонажі тощо) ----------
  // Кадри більше НЕ вводяться числом послідовно. Замість цього: вся спрайтшита показується
  // одразу, з pinch-zoom/pan (та сама схема жестів, що й у lpPointers/lpRebaseGesture для
  // live preview вище), межі між кадрами — це handle'и, які тягнеш пальцем (зона захвату
  // набагато ширша за видиму лінію — 28px в екранних пікселях, бо на телефоні лінію в 1px
  // пальцем не впіймати). Інваріант зберігається завжди: сума f.w усіх кадрів = ширина файлу,
  // тому "перетягнути межу" — це єдина операція редагування ширини (плюс кнопка ✎ для точного
  // числа, коли треба вгадати піксель в піксель). Дані (frameMarkList: {x,w,pivotX,pivotY})
  // лишились ті самі, що й раніше — міняється тільки те, ЯК користувач їх редагує.
  frameMarkModal = document.getElementById('frameMarkModal');
  fmCanvasWrap = document.getElementById('fmCanvasWrap');
  frameMarkCanvas = document.getElementById('frameMarkCanvas');
  frameMarkCtx = frameMarkCanvas.getContext('2d');
  frameMarkTile = null, frameMarkList = [];
  fmSel = 0;
  fmZoom = 1, fmPanX = 0, fmPanY = 0, fmFitScale = 1, fmFitCenterX = 0, fmFitCenterY = 0;
  FM_ZOOM_MIN = 1, FM_ZOOM_MAX = 10;
  // Піксель-акуратний чекер прозорості: 2x2 патерн-канва, що при однаковому transform з самим
  // зображенням (translate/scale/translate) масштабується РІВНО так само, як і сама текстура —
  // тобто одна клітинка чекера = рівно 1 піксель PNG, і зумиш ти саме пікселі, а не випадковий
  // орнамент. Раніше чекер малювався CSS-фоном обгортки й ніяк не був привʼязаний до пікселів файлу.
  fmChecker = null;

  // ---------- Жести на канві: 1 палець поза межею/pivot = pan, 2 пальці = pinch-zoom;
  // 1 палець ПО межі = тягне межу кадру, 1 палець ПО pivot-крапці = тягне pivot.
  // Схема та сама, що й lpPointers/lpRebaseGesture вище (live preview), з додатковими типами жесту.
  fmPointers = {};
  fmGesture = null;
  frameMarkCanvas.addEventListener('pointerdown', function(e){
    e.preventDefault();
    frameMarkCanvas.setPointerCapture(e.pointerId);
    var sp = fmCanvasPoint(e);
    fmPointers[e.pointerId] = sp;
    if(Object.keys(fmPointers).length===1){
      var pick = fmPointerPick(sp);
      if(pick && pick.type==='boundary'){ fmGesture = { type:'boundary', boundaryIdx:pick.boundaryIdx, pointerId:e.pointerId }; return; }
      if(pick && pick.type==='pivot'){ fmGesture = { type:'pivot', pointerId:e.pointerId }; return; }
    }
    fmRebaseGesture();
  });
  frameMarkCanvas.addEventListener('pointermove', function(e){
    if(!(e.pointerId in fmPointers)) return;
    fmPointers[e.pointerId] = fmCanvasPoint(e);
    if(!fmGesture) return;
    if(fmGesture.type==='boundary' && e.pointerId===fmGesture.pointerId){
      var ip = fmToImg(fmPointers[e.pointerId].x, fmPointers[e.pointerId].y);
      fmMoveBoundary(fmGesture.boundaryIdx, ip.x);
    } else if(fmGesture.type==='pivot' && e.pointerId===fmGesture.pointerId){
      var ip2 = fmToImg(fmPointers[e.pointerId].x, fmPointers[e.pointerId].y);
      fmSetPivotFromImg(ip2.x, ip2.y);
    } else if(fmGesture.type==='pan' && Object.keys(fmPointers).length===1){
      var p = fmPointers[e.pointerId];
      fmPanX = fmGesture.startPan.x + (p.x-fmGesture.startPoint.x);
      fmPanY = fmGesture.startPan.y + (p.y-fmGesture.startPoint.y);
    } else if(fmGesture.type==='pinch' && Object.keys(fmPointers).length>=2){
      var ids = Object.keys(fmPointers);
      var p1=fmPointers[ids[0]], p2=fmPointers[ids[1]];
      var newDist = fmDist(p1,p2);
      var mid = { x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2 };
      fmZoom = Math.max(FM_ZOOM_MIN, Math.min(FM_ZOOM_MAX, fmGesture.startZoom*(newDist/fmGesture.startDist)));
      var s = fmFitScale*fmZoom;
      fmPanX = mid.x - frameMarkCanvas.width/2 - (fmGesture.anchorImg.x-fmFitCenterX)*s;
      fmPanY = mid.y - frameMarkCanvas.height/2 - (fmGesture.anchorImg.y-fmFitCenterY)*s;
    }
    renderFrameMark();
  });
  frameMarkCanvas.addEventListener('pointerup', fmPointerEnd);
  frameMarkCanvas.addEventListener('pointercancel', fmPointerEnd);
  window.addEventListener('resize', function(){ if(frameMarkModal.style.display==='flex'){ fmResizeCanvas(); renderFrameMark(); } });

  document.getElementById('fmZoomIn').addEventListener('click', function(){ fmZoom = Math.min(FM_ZOOM_MAX, fmZoom*1.4); renderFrameMark(); });
  document.getElementById('fmZoomOut').addEventListener('click', function(){ fmZoom = Math.max(FM_ZOOM_MIN, fmZoom/1.4); renderFrameMark(); });
  document.getElementById('fmZoomFit').addEventListener('click', function(){ fmFit(); renderFrameMark(); });
  document.getElementById('fmResetPan').addEventListener('click', function(){ fmZoom=1; fmPanX=0; fmPanY=0; renderFrameMark(); });
  document.getElementById('fmAutoDetect').addEventListener('click', fmAutoDetect);
  document.getElementById('fmAddFrame').addEventListener('click', fmAddFrameSplit);
  document.getElementById('fmDelFrame').addEventListener('click', fmDeleteFrame);
  document.getElementById('fmEditWidth').addEventListener('click', function(){
    var f = frameMarkList[fmSel];
    var v = prompt(t('promptExactFrameWidth'), f.w);
    if(v===null) return;
    var nw = Math.max(1, parseInt(v)||f.w);
    if(fmSel < frameMarkList.length-1){
      fmMoveBoundary(fmSel, f.x+nw); // так само, як драг пальцем — сусідній кадр стискається/росте
    } else {
      f.w = Math.min(nw, frameMarkTile.img.naturalWidth-f.x); // останній кадр не може вилізти за файл
    }
    renderFrameMark();
  });
  document.getElementById('fmEditPivot').addEventListener('click', function(){
    var f = frameMarkList[fmSel], ih = frameMarkTile.img.naturalHeight;
    var vx = prompt(t('promptPivotXInFrame')+f.w+'):', Math.round(f.pivotX*f.w));
    if(vx===null) return;
    var vy = prompt(t('promptPivotYInFrame')+ih+'):', Math.round(f.pivotY*ih));
    if(vy===null) return;
    f.pivotX = Math.max(0, Math.min(1, (parseInt(vx)||0)/f.w));
    f.pivotY = Math.max(0, Math.min(1, (parseInt(vy)||0)/ih));
    renderFrameMark();
  });
  document.getElementById('frameMarkCancel').addEventListener('click', function(){
    frameMarkModal.style.display = 'none';
  });
  document.getElementById('frameMarkFinish').addEventListener('click', function(){
    pendingVariableFrames = frameMarkList.map(function(f){ return {x:f.x, w:f.w, pivotX:f.pivotX, pivotY:f.pivotY}; });
    frameMarkModal.style.display = 'none';
    updateFrameMarkSummary();
  });

  // ---------- Міні-превю розміщення ВИБРАНОГО кадру, прямо в куті редактора анімації ----------
  // На відміну від великого прев'ю в модалці текстури (яке малює ВЕСЬ спрайт-лист і orientується
  // на загальний pendingPivotX/Y), тут малюється ЛИШЕ вирізаний прямокутник поточного кадру
  // (f.x, 0, f.w, ih) з ЙОГО ВЛАСНИМ pivot — саме тому, що в кожного кадру свій pivot, і різниця
  // в 1px між кадрами (про яку йшлося) видно лише так. Anchor-на-клітинці (pendingAnchorMode/
  // pendingEdgeT) той самий для всіх кадрів — це властивість тайла, а не кадру.
  // Дві незалежні речі можна міняти: (1) zoom/pan ОБ'ЄКТА всередині панелі (pinch/pan по канві —
  // як і у великому прев'ю), і (2) розмір САМОЇ панелі (кнопки ▾/▴ нижче) — це те, чого не було
  // у великому прев'ю і про що прямо просили.
  fmPrevSize = 160;
  FM_PREV_SIZES = [110,140,160,200,240,280];
  fmPrevZoom = 1, fmPrevPanX = 0, fmPrevPanY = 0;
  fmPrevFitScale = 1, fmPrevFitCenterX = 0, fmPrevFitCenterY = 0;
  fmPrevCanvas = document.getElementById('fmPrevCanvas');
  fmPrevCtx = fmPrevCanvas.getContext('2d');
  // Жести по прев'ю: тільки pan/pinch-zoom ОБ'ЄКТА (тут нема чого перетягувати руками —
  // межі й pivot редагуються на основній канві зліва; ця панель лише "дзеркалить" результат).
  fmPrevPointers = {}, fmPrevGesture = null;
  fmPrevCanvas.addEventListener('pointerdown', function(e){
    e.preventDefault(); e.stopPropagation();
    fmPrevCanvas.setPointerCapture(e.pointerId);
    fmPrevPointers[e.pointerId] = fmPrevPoint(e);
    fmPrevRebase();
  });
  fmPrevCanvas.addEventListener('pointermove', function(e){
    if(!(e.pointerId in fmPrevPointers)) return;
    fmPrevPointers[e.pointerId] = fmPrevPoint(e);
    if(!fmPrevGesture) return;
    if(fmPrevGesture.type==='pan' && Object.keys(fmPrevPointers).length===1){
      var p = fmPrevPointers[e.pointerId];
      fmPrevPanX = fmPrevGesture.startPan.x + (p.x-fmPrevGesture.startPoint.x);
      fmPrevPanY = fmPrevGesture.startPan.y + (p.y-fmPrevGesture.startPoint.y);
    } else if(fmPrevGesture.type==='pinch' && Object.keys(fmPrevPointers).length>=2){
      var ids = Object.keys(fmPrevPointers);
      var p1=fmPrevPointers[ids[0]], p2=fmPrevPointers[ids[1]];
      var newDist = fmPrevDist(p1,p2);
      var mid = { x:(p1.x+p2.x)/2, y:(p1.y+p2.y)/2 };
      fmPrevZoom = Math.max(0.3, Math.min(8, fmPrevGesture.startZoom*(newDist/fmPrevGesture.startDist)));
      var s = fmPrevFitScale*fmPrevZoom;
      fmPrevPanX = mid.x - fmPrevCanvas.width/2 - (fmPrevGesture.anchorImg.x-fmPrevFitCenterX)*s;
      fmPrevPanY = mid.y - fmPrevCanvas.height/2 - (fmPrevGesture.anchorImg.y-fmPrevFitCenterY)*s;
    }
    updateFmPlacementPreview();
  });
  fmPrevCanvas.addEventListener('pointerup', fmPrevEnd);
  fmPrevCanvas.addEventListener('pointercancel', fmPrevEnd);
  document.getElementById('fmPrevResetBtn').addEventListener('click', function(){
    fmPrevZoom = 1; fmPrevPanX = 0; fmPrevPanY = 0; updateFmPlacementPreview();
  });
  document.getElementById('fmPrevSizeUp').addEventListener('click', function(){
    var idx = FM_PREV_SIZES.indexOf(fmPrevSize);
    if(idx < FM_PREV_SIZES.length-1) fmPrevSize = FM_PREV_SIZES[idx+1];
    fmPrevResizeCanvas(); updateFmPlacementPreview();
  });
  document.getElementById('fmPrevSizeDown').addEventListener('click', function(){
    var idx = FM_PREV_SIZES.indexOf(fmPrevSize);
    if(idx > 0) fmPrevSize = FM_PREV_SIZES[idx-1];
    fmPrevResizeCanvas(); updateFmPlacementPreview();
  });

  document.getElementById('renameOk').addEventListener('click', function(){
    if(renameTargetId){
      var tile = project.tiles[renameTargetId];
      tile.name = renameInput.value || tile.name;
      var animOn = document.getElementById('animEnabled').checked;
      var variableOn = document.getElementById('variableFramesEnabled').checked;
      if(animOn && variableOn){
        var totalW = tile.img && tile.img.naturalWidth;
        var markedW = pendingVariableFrames ? pendingVariableFrames.reduce(function(s,f){return s+f.w;},0) : 0;
        if(!pendingVariableFrames || !pendingVariableFrames.length || (totalW && markedW < totalW)){
          toast(t('toastMarkFramesFirst'));
          return;
        }
        var fms2 = Math.max(16, Math.min(5000, parseInt(document.getElementById('animFrameMs').value)||150));
        tile.frames = pendingVariableFrames;
        tile.animFrames = tile.frames.length; tile.animFrameMs = fms2;
        if(document.getElementById('animLoop').checked) tile.animLoop = true; else delete tile.animLoop;
        registerAnimatedTile();
      } else if(animOn){
        var fc = Math.max(2, Math.min(64, parseInt(document.getElementById('animFrameCount').value)||4));
        var fms = Math.max(16, Math.min(5000, parseInt(document.getElementById('animFrameMs').value)||150));
        delete tile.frames; // повертаємось до рівномірних кадрів — стара розмітка різної ширини більше не діє
        tile.animFrames = fc; tile.animFrameMs = fms;
        if(document.getElementById('animLoop').checked) tile.animLoop = true; else delete tile.animLoop;
        registerAnimatedTile(); // запускає тихий цикл перемальовки, якщо ще не запущений
      } else {
        delete tile.animFrames; delete tile.animFrameMs; delete tile.frames; delete tile.animLoop;
      }
      tile.pivotX = pendingPivotX; tile.pivotY = pendingPivotY;
      if(pendingAnchorMode === 'edge'){ tile.edgeAnchorT = pendingEdgeT; delete tile.gridAnchor; }
      else { delete tile.edgeAnchorT; delete tile.gridAnchor; }
      delete tile.anchor; // мігруємо зі старого boolean-прапорця на явний pivot
      var pbtn = paletteEl.querySelector('.tile-btn[data-id="'+renameTargetId+'"]');
      if(pbtn) updatePaletteBtnThumb(pbtn, tile);
      saveActiveProject();
      render();
    }
    livePreviewPanel.style.display = 'none';
    renameModal.style.display='none';
  });
  document.getElementById('anchorApplyFolderBtn').addEventListener('click', function(){
    // Масове застосування ПОТОЧНОЇ точки прив'язки до ВСІХ текстур поточної папки (не тільки
    // цієї однієї) — щоб не тикати pivot на кожній з 50-100 текстур окремо. Бере поточний стан
    // picker'а ПРЯМО ЗАРАЗ (навіть якщо ще не натиснуто "OK" для цього тайла).
    if(!renameTargetId) return;
    var tile = project.tiles[renameTargetId];
    var folderId = tile.folderId || activeFolderId;
    var count = 0;
    Object.keys(project.tiles).forEach(function(id){
      if(project.tiles[id].folderId !== folderId) return;
      project.tiles[id].pivotX = pendingPivotX; project.tiles[id].pivotY = pendingPivotY;
      if(pendingAnchorMode === 'edge'){ project.tiles[id].edgeAnchorT = pendingEdgeT; delete project.tiles[id].gridAnchor; }
      else { delete project.tiles[id].edgeAnchorT; delete project.tiles[id].gridAnchor; }
      delete project.tiles[id].anchor;
      count++;
    });
    var msgEl = document.getElementById('anchorApplyFolderMsg');
    msgEl.textContent = 'Застосовано до ' + count + ' текстур у папці.';
    msgEl.style.display = 'block';
    render();
    saveActiveProject();
  });
  document.getElementById('deleteTileBtn').addEventListener('click', function(){
    if(renameTargetId){
      delete project.tiles[renameTargetId];
      project.placements = project.placements.filter(function(p){return p.tileId!==renameTargetId;});
      var btn = paletteEl.querySelector('.tile-btn[data-id="'+renameTargetId+'"]');
      if(btn) btn.remove();
      if(activeTileId===renameTargetId) activeTileId=null;
      render(); saveActiveProject();
    }
    livePreviewPanel.style.display = 'none';
    renameModal.style.display='none';
  });
