/* js/tools/scatter.js — Інструмент «Розкидати» (клон → 🌿).
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function openScatterSettings(){
    var sel = document.getElementById('scatterFolder');
    sel.innerHTML = '';
    project.tileFolders.forEach(function(f){
      var opt = document.createElement('option'); opt.value=f.id; opt.textContent=folderPathLabel(f.id);
      if(f.id === (scatterSettings.folderId||activeFolderId)) opt.selected = true;
      sel.appendChild(opt);
    });
    document.getElementById('scatterRadius').value = scatterSettings.radius;
    document.getElementById('scatterFrequency').value = scatterSettings.frequency;
    document.getElementById('scatterRandomFlip').checked = scatterSettings.randomFlip;
    scatterSettingsModal.style.display = 'flex';
  }

  // Заповнює прямокутник (x0,y0)-(x1,y1) випадково розкиданими обʼєктами з обраної папки.
  // Алгоритм — проста "rejection sampling" розстановка: кидаємо випадкові точки, приймаємо
  // тільки ті, що не ближче за scatterSettings.radius до вже прийнятих — це дає природний,
  // не сітчастий розкид без злипання обʼєктів впритул. "Частота" — не точна кількість (як і
  // просив користувач), а приблизна частка від теоретичного максимуму пакування кругів
  // такого радіуса в цій площі.
  function applyScatterFill(x0, y0, x1, y1){
    var folderId = scatterSettings.folderId || activeFolderId;
    var folderTiles = Object.keys(project.tiles).filter(function(id){ return project.tiles[id].folderId === folderId; });
    if(!folderTiles.length){ toast(t('toastFolderEmpty')); return; }
    var actLyr = getLayer(project.activeLayerId);
    if(actLyr.locked){ toast(t('toastLayerLocked')); return; }
    var minX=Math.min(x0,x1), maxX=Math.max(x0,x1), minY=Math.min(y0,y1), maxY=Math.max(y0,y1);
    var w = maxX-minX, h = maxY-minY;
    if(w<4 || h<4) return;
    var radius = scatterSettings.radius;
    var area = w*h;
    var maxPossible = area / (Math.PI*radius*radius); // грубий ліміт пакування кіл радіуса radius в цій площі
    var target = Math.max(1, Math.round(maxPossible * (scatterSettings.frequency/100)));
    var placedPts = [];
    var maxAttempts = target * 40; // запобіжник від зациклення, якщо радіус завеликий для площі й ціль недосяжна
    var tries = 0;
    while(placedPts.length < target && tries < maxAttempts){
      tries++;
      var px2 = minX + Math.random()*w, py2 = minY + Math.random()*h;
      var ok = true;
      for(var i=0;i<placedPts.length;i++){
        var dx = placedPts[i].x-px2, dy = placedPts[i].y-py2;
        if(dx*dx+dy*dy < radius*radius){ ok=false; break; }
      }
      if(ok) placedPts.push({x:px2, y:py2});
    }
    if(!placedPts.length) return;
    pushUndo();
    var fillZ = newPlacementZ(project.activeLayerId); // один z на всю операцію, як і в інших заливках
    placedPts.forEach(function(pt){
      var tileId = folderTiles[Math.floor(Math.random()*folderTiles.length)];
      project.placements.push({
        id:'p'+(placeIdCounter++), tileId:tileId, x:px(pt.x), y:px(pt.y), z:fillZ,
        layerId:project.activeLayerId, scaleX:1, scaleY:1,
        flipX: scatterSettings.randomFlip ? (Math.random()<0.5) : false
      });
    });
    render(); saveActiveProject();
    toast(t('toastScattered').replace('{n}', placedPts.length));
  }


    function worldToScreen(x,y){ 
    // Примусово округлюємо кожну координату, щоб уникнути субпіксельного мила
    return { 
      x: Math.round(x * view.zoom + view.panX), 
      y: Math.round(y * view.zoom + view.panY) 
    }; 
    }
  function worldToOffscreen(x, y, offPanX, offPanY){
    return { x: Math.round(x + offPanX), y: Math.round(y + offPanY) };
  }
  
  function roundDevicePx(v){ return Math.round(v*devicePixelRatio)/devicePixelRatio; }
  function crispLinePx(v){ return (Math.floor(v*devicePixelRatio)+0.5)/devicePixelRatio; }
          function drawPixelLine(wx0,wy0,wx1,wy1){
    wx0=Math.round(wx0); wy0=Math.round(wy0); wx1=Math.round(wx1); wy1=Math.round(wy1);
    var dx = Math.abs(wx1-wx0), sx = wx0<wx1 ? 1 : -1;
    var dy = -Math.abs(wy1-wy0), sy = wy0<wy1 ? 1 : -1;
    var err = dx+dy, e2;
    var guard = 0, maxSteps = dx-dy+10;
    while(true){
      var p0 = worldToScreen(wx0, wy0);
      var qx0 = roundDevicePx(p0.x), qy0 = roundDevicePx(p0.y);
      var qx1 = roundDevicePx(worldToScreen(wx0+1, wy0).x);
      var qy1 = roundDevicePx(worldToScreen(wx0, wy0+1).y);
      ctx.fillRect(qx0, qy0, Math.max(1/devicePixelRatio, qx1-qx0), Math.max(1/devicePixelRatio, qy1-qy0));
      if(wx0===wx1 && wy0===wy1) break;
      if(++guard > maxSteps) break;
      e2 = 2*err;
      if(e2>=dy){ err+=dy; wx0+=sx; }
      if(e2<=dx){ err+=dx; wy0+=sy; }
    }
          }
  
  
  function screenToWorld(x,y){ return { x: (x - view.panX)/view.zoom, y: (y - view.panY)/view.zoom }; }

          function cellFitScale(tileId){
    var tile = project.tiles[tileId];
    var img = tile && tile.img;
    if(!img || !img.naturalWidth) return {x:1, y:1};
    // Динамічно беремо розмір сітки, висота ізометрії = ширина / 2
    var cw = project.cellSize;
    var ch = (project.gridType === 'iso' || project.gridType === 'isoAsym' || project.gridType === 'isoPixel') ? Math.round(project.cellSize / 2) : project.cellSize;
    return { x: cw/img.naturalWidth, y: ch/img.naturalHeight };
  }

  function isoCell(c, r){
    // Чисте співвідношення 2:1 (класична ізометрія: 2px убік на 1px вгору), без магічних
    // "-2"/"-1" — ті значення ніде не пояснювались і не масштабувались коректно зі зміною
    // cellSize (для малого cellSize взагалі йшли б у мінус). Якщо потрібна точна компенсація
    // "shear" з іншого проєкту (isoMask/drawIso3x3) — вона залежить від того, наскільки
    // масштабується КОНКРЕТНА текстура під клітинку, і має рахуватись окремо в момент
    // розміщення/малювання тайла, а не тут, у загальній сітці, якою користуються й курсор,
    // і колізії, і будь-що інше без прив'язки до конкретної картинки.
    var hw = project.cellSize / 2;
    var hh = project.cellSize / 4;
    return { x:(c-r)*hw, y:(c+r)*hh };
  }
  
  function invIso(x, y){
    var hw = project.cellSize / 2;
    var hh = project.cellSize / 4;
    var c = (x/hw + y/hh) / 2;
    var r = (y/hh - x/hw) / 2;
    return { c:c, r:r };
  }
