/* js/ui/tile-library.js — Палітра тайлів, папки й підпапки текстур, переміщення між папками, теги.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function findGroundContactFraction(img){
    var key = img.src;
    if(groundFracCache[key] !== undefined) return groundFracCache[key];
    var w = img.naturalWidth, h = img.naturalHeight;
    var frac = 1;
    try{
      var c = document.createElement('canvas'); c.width=w; c.height=h;
      var cx = c.getContext('2d');
      cx.drawImage(img,0,0);
      var data = cx.getImageData(0,0,w,h).data;
      var bottomY = -1;
      for(var y=h-1; y>=0 && bottomY<0; y--){
        for(var x=0; x<w; x++){
          if(data[(y*w+x)*4+3] > 20){ bottomY = y; break; }
        }
      }
      if(bottomY>=0) frac = (bottomY+1)/h;
    }catch(e){ frac = 1; }
    groundFracCache[key] = frac;
    return frac;
  }
  function addTileFromDataURL(name, dataURL, folderId){
    var id = 't'+(tileIdCounter++);
    var img = new Image();
    img.onload = render;
    img.src = dataURL;
    project.tiles[id] = { name:name, img:img, dataURL:dataURL, folderId: folderId || activeFolderId };
    addPaletteBtn(id); // сама перевірить, чи належить відкритій зараз папці, і додасть кнопку лише якщо так
    if(!activeTileId) setActiveTile(id);
    return id;
  }
  function updatePaletteBtnThumb(btn, tile){
    btn.style.backgroundImage='url('+tile.dataURL+')';
    if(tile.animFrames > 1){
      // Показуємо тільки ПЕРШИЙ кадр смуги, вписаний ЦІЛКОМ у квадрат (як contain), а не
      // розтягнутий на всю висоту квадрата — інакше високий/вузький кадр (людина, дерево)
      // обрізався б або спотворювався. Рахуємо масштаб по тій стороні кадру, що впирається
      // в межу квадрата першою, і докладаємо ту саму пропорцію до всієї стрічки кадрів.
      var img = tile.img;
      var boxSize = 48; // має збігатись з .tile-btn width/height у CSS
      if(img && img.naturalWidth){
        var frameW = hasVariableFrames(tile) ? tile.frames[0].w : img.naturalWidth / tile.animFrames, frameH = img.naturalHeight;
        var scale = Math.min(boxSize/frameW, boxSize/frameH);
        var fullW = img.naturalWidth*scale, fullH = frameH*scale;
        var offX = (boxSize - frameW*scale)/2, offY = (boxSize - fullH)/2;
        btn.style.backgroundSize = fullW+'px '+fullH+'px';
        btn.style.backgroundPosition = offX+'px '+offY+'px';
      } else {
        // Картинка ще не завантажилась — старий грубий варіант як тимчасовий запасний варіант.
        btn.style.backgroundSize = (tile.animFrames*100)+'% 100%';
        btn.style.backgroundPosition = '0 0';
      }
    } else {
      // 'contain' замість 'cover' — щоб високий/вузький тайл (паркан, стіна) показувався
      // ЦІЛКОМ, зменшеним, а не обрізаним куском по центру.
      btn.style.backgroundSize = 'contain';
      btn.style.backgroundPosition = 'center';
    }
  }
  function addPaletteBtn(id){
    var tile = project.tiles[id];
    if(tile.autoShadow) return; // тайли тіней із режиму «Тінь» в палітру не потрапляють
    if((tile.folderId||null) !== (activeFolderId||null)) return; // тайл не з відкритої зараз папки — не показуємо
    var btn = document.createElement('button');
    btn.className='tile-btn'; btn.dataset.id=id;
    updatePaletteBtnThumb(btn, tile);
    var timer;
    var tsX=0, tsY=0, tsCancelled=false;
    // Скасовуємо таймер довгого натискання, якщо палець зрушився більше ніж на кілька
    // пікселів — інакше звичайний свайп/скрол по палітрі (який часто триває довше 500мс)
    // сприймався як довге натискання і відкривав вікно перейменування/видалення тайла.
    btn.addEventListener('touchstart', function(e){
      if(moveMode) return; // у режимі вибору довге утримання/перейменування не потрібне
      tsCancelled = false;
      var t0 = e.touches[0];
      tsX = t0.clientX; tsY = t0.clientY;
      timer = setTimeout(function(){ if(!tsCancelled) openRename(id); }, 550);
    });
    btn.addEventListener('touchmove', function(e){
      var t0 = e.touches[0];
      if(Math.abs(t0.clientX-tsX) > 8 || Math.abs(t0.clientY-tsY) > 8){
        tsCancelled = true;
        clearTimeout(timer);
      }
    });
    btn.addEventListener('touchend', function(){ clearTimeout(timer); });
    btn.addEventListener('touchcancel', function(){ clearTimeout(timer); });
    btn.addEventListener('contextmenu', function(e){ e.preventDefault(); if(!moveMode) openRename(id); });
    btn.addEventListener('click', function(){
      if(moveMode){
        if(moveSelected[id]) delete moveSelected[id]; else moveSelected[id] = true;
        updateMoveModeUI();
        return;
      }
      setActiveTile(id);
      // Не збивати інструмент "Клон", якщо ним і так користуються — інакше кожна зміна
      // текстури під час клонування змушувала заново тицяти "Клон" в нижній панелі.
      // Скидаємо на "Ставити" тільки якщо був якийсь інший інструмент (Рука/Колізії/Виділити).
      if(tool!=='clone') tool='place';
      updateToolButtons();
    });
    paletteEl.insertBefore(btn, addTileBtn);
    if(moveMode) btn.classList.add('move-mode'); // щойно відмальований тайл теж має чекбокс, якщо вже в режимі вибору
  }
  function refreshPalette(){
    paletteEl.querySelectorAll('.tile-btn').forEach(function(b){b.remove();});
    Object.keys(project.tiles).forEach(addPaletteBtn);
    if(activeTileId) setActiveTile(activeTileId);
  }
  function setActiveTile(id){
    activeTileId = id;
    document.querySelectorAll('#palette .tile-btn').forEach(function(b){ b.classList.toggle('active', b.dataset.id===id); });
  }
  // ---------- Вкладені папки текстур ----------
  // project.tileFolders лишився ОДНИМ плоским масивом (не деревом об'єктів) — просто в
  // кожної папки зʼявилось поле parentId (null/відсутнє = коренева папка). Це найпростіша
  // міграція: старі проєкти без parentId автоматично трактуються як "усі папки в корені"
  // (той самий вигляд, що й був), нічого не ламається заднім числом.
  // activeFolderId — це і "яку папку зараз переглядаємо" (стрічка показує її ПРЯМІ
  // підпапки), і "куди підуть нові текстури/нова підпапка" — той самий сенс, що й раніше,
  // просто тепер це може бути папка на будь-якій глибині вкладеності.
  function folderPathLabel(folderId){
    // "Будинки / Стіни ліво" — повний шлях, для випадних списків (Розкидати/Спрайт), де
    // всі папки показані одразу плоским списком і треба розуміти вкладеність без навігації.
    var parts = [], id = folderId, guard = 0;
    while(id && guard++ < 20){
      var f = project.tileFolders.find(function(x){return x.id===id;});
      if(!f) break;
      parts.unshift(f.name);
      id = f.parentId || null;
    }
    return parts.join(' / ') || '?';
  }
  function updateMoveModeUI(){
    tileFoldersEl.style.display = moveMode ? 'none' : '';
    document.getElementById('folderCrumbs').style.display = moveMode ? 'none' : '';
    document.getElementById('moveModeBar').style.display = moveMode ? 'flex' : 'none';
    document.getElementById('moveModeCount').textContent = 'Вибрано: '+Object.keys(moveSelected).length;
    document.querySelectorAll('#palette .tile-btn').forEach(function(b){
      b.classList.toggle('move-mode', moveMode);
      b.classList.toggle('move-selected', !!moveSelected[b.dataset.id]);
    });
  }
  function enterMoveMode(){ moveMode = true; moveSelected = {}; updateMoveModeUI(); }
  function exitMoveMode(){ moveMode = false; moveSelected = {}; updateMoveModeUI(); }
  function openMoveToFolderPicker(ids){
    var listEl = document.getElementById('moveToFolderList');
    listEl.innerHTML = '';
    if(activeFolderId){
      var rb = document.createElement('button');
      rb.textContent = 'Усі папки (корінь)'; rb.className = 'move-dest-btn';
      rb.addEventListener('click', function(){
        pushUndo();
        ids.forEach(function(tid){ if(project.tiles[tid]) project.tiles[tid].folderId = null; });
        saveActiveProject();
        document.getElementById('moveToFolderModal').style.display = 'none';
        exitMoveMode(); refreshPalette(); toast('Переміщено: '+ids.length);
      });
      listEl.appendChild(rb);
    }
    project.tileFolders.forEach(function(f){
      if(f.id === activeFolderId) return; // перемістити "в ту саму папку" безглуздо — не показуємо
      var b = document.createElement('button');
      b.textContent = folderPathLabel(f.id);
      b.className = 'move-dest-btn';
      b.addEventListener('click', function(){
        pushUndo();
        ids.forEach(function(tid){ if(project.tiles[tid]) project.tiles[tid].folderId = f.id; });
        saveActiveProject();
        document.getElementById('moveToFolderModal').style.display = 'none';
        exitMoveMode();
        refreshPalette();
        toast('Переміщено: '+ids.length);
      });
      listEl.appendChild(b);
    });
    document.getElementById('moveToFolderModal').style.display = 'flex';
  }
  function renderTileFolders(){
    tileFoldersEl.innerHTML = '';
    // Рядок-шлях: Усі папки / Основна / Дома / Стіни — тап по будь-якому сегменту відкриває цю папку.
    var crumbsEl = document.getElementById('folderCrumbs');
    crumbsEl.innerHTML = '';
    var chain = [], cid = activeFolderId, cg = 0;
    while(cid && cg++ < 20){
      var cf = project.tileFolders.find(function(x){ return x.id===cid; });
      if(!cf) break;
      chain.unshift(cf); cid = cf.parentId || null;
    }
    function addCrumb(label, targetId, isLast){
      var cb = document.createElement('button');
      cb.textContent = label; if(isLast) cb.className = 'active';
      cb.addEventListener('click', function(){ activeFolderId = targetId; renderTileFolders(); refreshPalette(); });
      crumbsEl.appendChild(cb);
    }
    addCrumb('Усі папки', null, chain.length===0);
    chain.forEach(function(cf2, ci){
      var sp = document.createElement('span'); sp.textContent = '/'; crumbsEl.appendChild(sp);
      addCrumb(cf2.name, cf2.id, ci===chain.length-1);
    });
    var current = project.tileFolders.find(function(x){return x.id===activeFolderId;});
    var fixedEl = document.createElement('div'); fixedEl.className = 'folder-fixed'; tileFoldersEl.appendChild(fixedEl);
    var moveBtn = document.createElement('button');
    moveBtn.textContent = '⇄'; moveBtn.className = 'move-mode-btn';
    moveBtn.title = 'Перемістити текстури цієї папки в іншу';
    moveBtn.addEventListener('click', function(){ enterMoveMode(); });
    fixedEl.appendChild(moveBtn);
    var addBtn = document.createElement('button');
    addBtn.textContent = '+'; addBtn.className = 'add-folder-btn';
    addBtn.title = 'Нова підпапка всередині "'+(current?current.name:'Усі папки')+'"';
    addBtn.addEventListener('click', function(){
      var name = prompt(t('promptNewFolderName'), 'Нова папка');
      if(!name) return;
      var f = { id:'folder_'+Date.now(), name:name.trim() || 'Папка', parentId: activeFolderId || null };
      project.tileFolders.push(f);
      activeFolderId = f.id;
      saveActiveProject();
      renderTileFolders();
      refreshPalette();
    });
    fixedEl.appendChild(addBtn);
    if(current && current.parentId){
      var parentF = project.tileFolders.find(function(x){return x.id===current.parentId;});
      var upBtn = document.createElement('button');
      upBtn.textContent = '⬅ ' + (parentF ? parentF.name : '..');
      upBtn.className = 'nav-folder-btn';
      upBtn.addEventListener('click', function(){
        activeFolderId = current.parentId;
        renderTileFolders();
        refreshPalette();
      });
      fixedEl.appendChild(upBtn);
    }
    var childFolders = project.tileFolders.filter(function(f){ return (f.parentId||null) === activeFolderId; });
    childFolders.forEach(function(f){
      var btn = document.createElement('button');
      btn.textContent = '📁 ' + f.name;
      btn.className = '';
      btn.dataset.id = f.id;
      var timer, tsX=0, tsY=0, tsCancelled=false;
      // Довге утримання (2 сек, за проханням користувача — довше, ніж 550мс для тайлів,
      // бо перейменування/видалення ПАПКИ помітніша дія, менше шансів зробити випадково)
      // відкриває меню перейменувати/видалити. Той самий захист від скролу рухом пальця.
      btn.addEventListener('touchstart', function(e){
        tsCancelled = false;
        var t0 = e.touches[0]; tsX=t0.clientX; tsY=t0.clientY;
        timer = setTimeout(function(){ if(!tsCancelled) openFolderMenu(f.id); }, 2000);
      });
      btn.addEventListener('touchmove', function(e){
        var t0 = e.touches[0];
        if(Math.abs(t0.clientX-tsX)>8 || Math.abs(t0.clientY-tsY)>8){ tsCancelled=true; clearTimeout(timer); }
      });
      btn.addEventListener('touchend', function(){ clearTimeout(timer); });
      btn.addEventListener('touchcancel', function(){ clearTimeout(timer); });
      btn.addEventListener('contextmenu', function(e){ e.preventDefault(); openFolderMenu(f.id); });
      btn.addEventListener('click', function(){
        if(tsCancelled) return; // це був хвіст довгого натискання, не звичайний тап
        // Тап по підпапці ЗАХОДИТЬ у неї (стрічка перебудується під ЇЇ дітей) — щоб
        // побачити сусідню підпапку (напр. "Стіни право"), спершу тисни "⬅ Будинки".
        activeFolderId = f.id;
        renderTileFolders();
        refreshPalette();
      });
      tileFoldersEl.appendChild(btn);
    });
  }
  function openFolderMenu(folderId){
    folderMenuTargetId = folderId;
    var f = project.tileFolders.find(function(x){return x.id===folderId;});
    document.getElementById('folderMenuTitle').textContent = f ? f.name : 'Папка';
    folderMenuModal.style.display = 'flex';
    updateTagButtons();
  }
  function tagObj(tg){
    if(!tg) return null;
    if(tg.kind==='placement') return placementById(tg.id) || null;
    if(tg.kind==='tile') return project.tiles[tg.id] || null;
    if(tg.kind==='folder') return project.tileFolders.find(function(f){ return f.id===tg.id; }) || null;
    return null;
  }
  function updateTagButtons(){
    var tb = document.getElementById('renameTagBtn');
    if(tb){ var o1 = renameTargetId ? project.tiles[renameTargetId] : null; tb.textContent = '🏷 Тег' + (o1 && o1.tag ? ': '+o1.tag : ''); }
    var fb = document.getElementById('folderMenuTag');
    if(fb){ var o2 = tagObj({kind:'folder', id:folderMenuTargetId}); fb.textContent = '🏷 Тег' + (o2 && o2.tag ? ': '+o2.tag : ''); }
  }
  function openTagModal(kind, id){
    var o = tagObj({kind:kind, id:id}); if(!o) return;
    tagTarget = {kind:kind, id:id};
    document.getElementById('tagModalTitle').textContent = '🏷 ' + (kind==='tile' ? 'ТЕГ ТЕКСТУРИ' : (kind==='folder' ? 'ТЕГ ПАПКИ' : 'ТЕГ ОБʼЄКТА'));
    tagInputEl.value = o.tag || '';
    tagModalEl.style.display = 'flex';
    setTimeout(function(){ try{ tagInputEl.focus(); tagInputEl.select(); }catch(e){} }, 50);
  }
  function closeTagModal(){ tagModalEl.style.display = 'none'; tagTarget = null; }
  function applyTag(val){
    var o = tagObj(tagTarget); if(!o){ closeTagModal(); return; }
    val = (val || '').trim();
    var kind = tagTarget.kind;
    if(kind==='placement') pushUndo();
    if(val) o.tag = val; else delete o.tag;
    saveActiveProject();
    closeTagModal();
    toast(val ? '🏷 Тег: '+val : 'Тег прибрано');
    if(kind==='folder') renderTileFolders();
    updateTagButtons();
    render();
  }
  function collectGroups(){
    var map = {};
    project.placements.forEach(function(p){
      if(!p.group || p.shadowOf) return;
      var b = placementBBox(p);
      var g = map[p.group] || (map[p.group] = {name:p.group, n:0, x0:Infinity, y0:Infinity, x1:-Infinity, y1:-Infinity});
      g.n++; g.x0 = Math.min(g.x0,b.x0); g.y0 = Math.min(g.y0,b.y0); g.x1 = Math.max(g.x1,b.x1); g.y1 = Math.max(g.y1,b.y1);
    });
    return Object.keys(map).map(function(k){
      var g = map[k]; g.cx = Math.round((g.x0+g.x1)/2); g.cy = Math.round((g.y0+g.y1)/2); return g;
    }).sort(function(a,b){ return a.name.localeCompare(b.name); });
  }
  function openDb(){
    dbRows = collectGroups();
    var body = document.getElementById('dbGroupsBody');
    if(!dbRows.length){
      body.innerHTML = '<div style="color:var(--dim); font-size:12px; padding:8px 0;">Груп ще немає. Створи групу кнопкою 🏠 на виділених обʼєктах.</div>';
    } else {
      body.innerHTML = '<table style="width:100%; border-collapse:collapse; font-size:12px;">' +
        '<thead><tr style="color:var(--amber); text-align:left;"><th style="padding:4px;">Назва групи</th><th style="padding:4px;">Координати</th><th></th></tr></thead><tbody>' +
        dbRows.map(function(g, i){
          return '<tr style="border-top:1px solid var(--line);"><td style="padding:6px 4px;">'+escHtml(g.name)+' <span style="color:var(--dim);">('+g.n+')</span></td>' +
            '<td style="padding:6px 4px; white-space:nowrap;">X '+g.cx+' · Y '+g.cy+'</td>' +
            '<td style="padding:6px 0; text-align:right;"><button type="button" data-goto="'+i+'" style="background:var(--green); color:#fff; border:1px solid var(--line); border-radius:2px; padding:6px 8px; font-family:inherit; font-size:12px;">➡ Перенести</button></td></tr>';
        }).join('') + '</tbody></table>';
    }
    document.getElementById('dbModal').style.display = 'flex';
  }
