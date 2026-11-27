/* js/tools/autotile.js — Автотайлінг: групи, редактор, застосування до виділеної площі.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function openAutotileList(){ renderAutotileGroupsList(); autotileListModal.style.display = 'flex'; }
  function renderAutotileGroupsList(){
    autotileGroupsList.innerHTML = '';
    if(!project.autotileGroups || !project.autotileGroups.length){
      autotileGroupsList.innerHTML = '<div style="opacity:0.6; font-size:13px; text-align:center; padding:12px;">Груп ще нема</div>';
      return;
    }
    project.autotileGroups.forEach(function(g){
      var row = document.createElement('div'); row.className = 'autotile-group-row';
      var nameSpan = document.createElement('span'); nameSpan.textContent = g.name;
      var editBtn = document.createElement('button'); editBtn.textContent = 'Редагувати';
      editBtn.addEventListener('click', function(){ openAutotileEditor(g.id); });
      var delBtn = document.createElement('button'); delBtn.textContent = '🗑'; delBtn.style.background='var(--danger)'; delBtn.style.color='#fff';
      delBtn.addEventListener('click', function(){
        if(!confirm(t('confirmDeleteGroupNamed').replace('{name}', g.name))) return;
        project.autotileGroups = project.autotileGroups.filter(function(x){ return x.id!==g.id; });
        saveActiveProject();
        renderAutotileGroupsList();
      });
      row.appendChild(nameSpan); row.appendChild(editBtn); row.appendChild(delBtn);
      autotileGroupsList.appendChild(row);
    });
  }

  function openAutotileEditor(groupId){
    autotileEditingId = groupId;
    var g = groupId ? project.autotileGroups.find(function(x){return x.id===groupId;}) : null;
    autotileEditingSlots = g ? { TL:g.corners.TL, TR:g.corners.TR, BR:g.corners.BR, BL:g.corners.BL, N:g.edges.N, E:g.edges.E, S:g.edges.S, W:g.edges.W } : {};
    document.getElementById('autotileEditorTitle').textContent = g ? 'Редагувати групу' : 'Нова група';
    document.getElementById('autotileGroupName').value = g ? g.name : '';
    document.getElementById('autotileEditorDelete').style.display = g ? 'inline-block' : 'none';
    renderAutotileGrid3x3();
    autotileListModal.style.display = 'none';
    autotileEditorModal.style.display = 'flex';
  }
  function renderAutotileGrid3x3(){
    autotileGrid3x3.innerHTML = '';
    AUTOTILE_SLOTS.forEach(function(slot){
      var cell = document.createElement('div');
      cell.className = 'autotile-cell ' + slot.type;
      if(slot.type==='center'){ cell.textContent='•'; autotileGrid3x3.appendChild(cell); return; }
      var tileId = autotileEditingSlots[slot.key];
      var tile = tileId ? project.tiles[tileId] : null;
      if(tile){ cell.style.backgroundImage = 'url('+tile.dataURL+')'; cell.textContent=''; }
      else { cell.textContent = '+'; }
      cell.title = slot.label;
      cell.addEventListener('click', function(){ openAutotileTilePicker(slot.key); });
      autotileGrid3x3.appendChild(cell);
    });
  }
  function openAutotileTilePicker(slotKey){
    autotilePickerTarget = slotKey;
    autotileTilePickerGrid.innerHTML = '';
    Object.keys(project.tiles).forEach(function(tid){
      var tile = project.tiles[tid];
      var thumb = document.createElement('div'); thumb.className='autotile-tile-thumb';
      thumb.style.backgroundImage = 'url('+tile.dataURL+')';
      thumb.title = tile.name;
      thumb.addEventListener('click', function(){
        autotileEditingSlots[autotilePickerTarget] = tid;
        autotileTilePickerModal.style.display = 'none';
        renderAutotileGrid3x3();
      });
      autotileTilePickerGrid.appendChild(thumb);
    });
    autotileTilePickerModal.style.display = 'flex';
  }

  // ---- Застосування автотайлінгу до виділеної площі ----
  // Знаходить плейсмент, який стоїть РІВНО в клітинці (c,r) на заданому шарі (з допуском
  // 2px на похибку округлення). Якщо їх кілька (стек) — бере ОСТАННІЙ у масиві, як і при
  // звичайному малюванні "останній зверху".
  // Розміщення, чия точка опори збігається з клітинкою (c,r) у межах 2 px, на шарі layerId; береться ОСТАННЄ в масиві.
  // Раніше — перебір усіх розміщень на кожен виклик (автотайлінг викликає це тисячі разів). Тепер — кошики 4×4 px за
  // позицією, що будуються один раз на «епоху»/довжину масиву. Результат той самий.
  var cellBucketCache = { arr:null, len:-1, epoch:-1, map:null };
  function findPlacementAtCellExact(c, r, layerId){
    var wp = cellToWorld(c, r), arr = project.placements, bc = cellBucketCache;
    if(bc.arr !== arr || bc.len !== arr.length || bc.epoch !== placementsEpoch){
      var m = new Map();
      for(var i = 0; i < arr.length; i++){
        var q = arr[i];
        if(!isFinite(q.x) || !isFinite(q.y)) continue;
        var key = q.layerId + '|' + Math.floor(q.x / 4) + '|' + Math.floor(q.y / 4), l = m.get(key);
        if(l === undefined) m.set(key, [i]); else l.push(i);
      }
      bc.arr = arr; bc.len = arr.length; bc.epoch = placementsEpoch; bc.map = m;
    }
    var best = -1, bx0 = Math.floor((wp.x - 2) / 4), bx1 = Math.floor((wp.x + 2) / 4), by0 = Math.floor((wp.y - 2) / 4), by1 = Math.floor((wp.y + 2) / 4);
    for(var bx = bx0; bx <= bx1; bx++) for(var by = by0; by <= by1; by++){
      var list = bc.map.get(layerId + '|' + bx + '|' + by);
      if(list === undefined) continue;
      for(var k = 0; k < list.length; k++){
        var ix = list[k], p = arr[ix];
        if(p.layerId !== layerId) continue;
        if(Math.abs(p.x - wp.x) < 2 && Math.abs(p.y - wp.y) < 2 && ix > best) best = ix;
      }
    }
    return best >= 0 ? arr[best] : null;
  }
  function applyAutotiling(){
    if(!selected || selected.type!=='multi'){ toast(t('toastSelectAreaFirst')); return; }
    if(!project.autotileGroups || !project.autotileGroups.length){ toast(t('toastCreateGroupFirst')); return; }
    var actLyr = getLayer(project.activeLayerId);
    if(actLyr.locked){ toast(t('toastLayerLocked')); return; }
    var c0 = worldToCell(selected.minX, selected.minY), c1 = worldToCell(selected.maxX, selected.maxY);
    var cMin = Math.round(Math.min(c0.c,c1.c)), cMax = Math.round(Math.max(c0.c,c1.c));
    var rMin = Math.round(Math.min(c0.r,c1.r)), rMax = Math.round(Math.max(c0.r,c1.r));
    pushUndo();
    var changes = []; // спершу рахуємо ВСІ зміни від оригінального стану, і лише потім застосовуємо —
                       // інакше сусідня клітинка, оброблена трохи пізніше в тому ж проході,
                       // побачила б уже ЗМІНЕНИЙ (крайовий, не кутовий) тайл замість оригінального
                       // і не розпізнала б у ньому свій "чистий" матеріал.
    project.autotileGroups.forEach(function(group){
      function materialOf(tileId){
        var keys = ['TL','TR','BR','BL'];
        for(var i=0;i<keys.length;i++) if(group.corners[keys[i]]===tileId) return keys[i];
        return null;
      }
      var pairSlots = [ ['TL','TR', group.edges.N], ['TR','BR', group.edges.E], ['BR','BL', group.edges.S], ['BL','TL', group.edges.W] ];
      function edgeTileFor(matA, matB){
        for(var i=0;i<pairSlots.length;i++){
          var s = pairSlots[i];
          if((s[0]===matA && s[1]===matB) || (s[0]===matB && s[1]===matA)) return s[2];
        }
        return null;
      }
      for(var c=cMin; c<=cMax; c++){
        for(var r=rMin; r<=rMax; r++){
          var p = findPlacementAtCellExact(c, r, project.activeLayerId);
          if(!p) continue;
          var myMat = materialOf(p.tileId);
          if(!myMat) continue; // тайл не з цієї групи — не чіпаємо
          var found = [];
          AUTOTILE_DIRS.forEach(function(d){
            var np = findPlacementAtCellExact(c+d[1], r+d[2], project.activeLayerId);
            if(!np) return;
            var nMat = materialOf(np.tileId);
            if(!nMat || nMat===myMat) return;
            var et = edgeTileFor(myMat, nMat);
            if(et) found.push(et);
          });
          // found.length===0 -> чистий кут без сусідньої іншої матерії, лишаємо як є
          // found.length===1 -> рівно одна межа — підставляємо перехідний тайл
          // found.length>1  -> сходяться 2+ межі одразу (варіант A: складний кут не чіпаємо)
          if(found.length===1) changes.push({p:p, tileId:found[0]});
        }
      }
    });
    changes.forEach(function(ch){ ch.p.tileId = ch.tileId; });
    selected = null;
    render(); saveActiveProject();
    toast(changes.length ? ('Автотайлінг: оновлено '+changes.length+' тайлів') : 'Автотайлінг: змін не знайдено (перевір тайли в групі)');
  }
