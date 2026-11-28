/* js/init/09-render.js — Код запуску теми: Малювання карти: render()/renderNow()/renderCore(), режим ?perf, сітка, оверлеї. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */

  // ---------- Режим ?perf: оверлей із замірами + генератор тестових карт (у звичайному режимі нічого не додає) ----------
  placementsEpoch = 0; // +1 при кожній дії/збереженні/відкаті — привід звірити індекс із масивом
  idxState = { index:TWSpatial.create(), arr:null, len:-1, epoch:-1, loaded:-1, frames:0 }, perfIdxOn = false;
  PERF = /[?&]perf\b/.test(location.search), perfLastVisible = 0, perfFrameMs = 0, perfEl = null, perfAvg = 0, perfLastShow = 0;
  // twPerfFill(n): залити n ромбів першим тайлом палітри (для замірів на 10k/50k/100k). Лише з ?perf.
  if(PERF) window.twPerfFill = function(n){
    var tid = activeTileId || Object.keys(project.tiles)[0]; if(!tid) return 'спочатку додай тайл';
    var side = Math.ceil(Math.sqrt(n)), step = project.cellSize || 64, lid = project.activeLayerId, out = [];
    for(var i = 0; i < n; i++){
      var gx = i % side, gy = (i / side) | 0;
      out.push({ id:'p' + (placeIdCounter++), tileId:tid, x:(gx - gy) * step, y:(gx + gy) * step / 2, z:0, layerId:lid, scaleX:1, scaleY:1 });
    }
    project.placements = project.placements.concat(out); minimapDirty = true; render();
    return project.placements.length;
  };
  houseViewBarEl = document.getElementById('houseViewBar');
  houseViewBarEl.addEventListener('click', function(e){
    var b = e.target.closest('button'); if(!b) return;
    var act = b.dataset.hv;
    if(act==='exit'){ houseView.enabled=false; houseView.group=null; }
    else if(act==='up'){ houseView.activeFloor++; }
    else if(act==='down'){ houseView.activeFloor--; }
    buildHouseViewBar();
    render();
  });
  drawingShape = null;
  dragPts0 = null;
