/* js/init/12-selection-actions.js — Код запуску теми: Панель дій: реєстр усіх значків і їх порядок. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- Панель дій: реєстр УСІХ можливих значків + порядок, який керується користувачем ----------
  // Один спільний реєстр і ОДИН налаштовуваний порядок для геть різних контекстів (один тайл,
  // група/будинок, спавн, колізія) — кожен виклик renderIconGrid() просто передає лише ті
  // пункти, які СТОСУЮТЬСЯ поточного виділення (той самий фільтр, що й раніше був у вигляді
  // умовних (p.group ? ... : '') шматків HTML) — а порядок серед них однаковий скрізь і
  // зберігається в localStorage, тому "Налаштування панелі" в Меню — одне на все, а не окремо
  // для кожного типу виділення.
  PANEL_ACTION_NAMES = {
    eye:'Показати/сховати панель', anim:'Анімація: вкл/викл', copy:'Копіювати → Вставити', move:'Рука — тягнути виділене',
    layer:'Порядок малювання (число)', zUp:'Підняти на 1', zDown:'Опустити на 1',
    stamp:'Зберегти як штамп', autotile:'Автотайлінг', group:'Створити групу/будинок', houseSettings:'Налаштування будинку',
    selectHouse:'Обрати весь будинок', mirror:'Дзеркало ↔', mirrorY:'Дзеркало ↕', rotate:'Повернути',
    precision:'Точне розміщення', shadow:'Тінь-силует', shadowOval:'Тінь-еліпс',
    lock:'Заблокувати', unlockGroup:'Розблокувати групу', dup:'Дублювати',
    spawnEdit:'Тип і шанс спавну', ctype:'Тип колізії', cfloor:'Поверх колізії', del:'Видалити'
  };
  PANEL_ACTION_ICONS = {
    eye:'👁', anim:'🎞', copy:'📋', move:'🖐', layer:'🔢', zUp:'▲', zDown:'▼', stamp:'🖨', autotile:'▦',
    group:'🏠', houseSettings:'🏠', selectHouse:'🔎', mirror:'↔', mirrorY:'↕',
    rotate:'↻', precision:'🎯', shadow:'🌑', shadowOval:'⬭', lock:'🔒', unlockGroup:'🔓',
    dup:'⧉', spawnEdit:'✎', ctype:'⛊', del:'🗑'
  };
  PANEL_DEFAULT_ORDER = ['eye','anim','copy','move','layer','zUp','zDown','group','houseSettings','mirror','mirrorY','rotate',
    'precision','shadow','shadowOval','stamp','autotile','lock','unlockGroup','selectHouse','dup','spawnEdit','ctype','del'];
  applyPanelSize();
  draggingPanelPos = false; // true, поки триває перетягування самої панелі (не обʼєкта) — updateSelPanel() не повинен в цей час перераховувати left/top під обʼєктом
  selPanel.addEventListener('pointerdown', function(e){
    var btn = e.target.closest('button[data-act="panelEye"]'); if(!btn) return;
    e.stopPropagation();
    var startX = e.clientX, startY = e.clientY;
    var r = wrap.getBoundingClientRect();
    var startLeft = parseFloat(selPanel.style.left)||0, startTop = parseFloat(selPanel.style.top)||0;
    var dragging = false;
    var holdTimer = setTimeout(function(){
      dragging = true;
      draggingPanelPos = true;
      selPanel.style.transition = 'none';
    }, 400);
    function onMove(e2){
      e2.stopPropagation();
      if(!dragging){
        if(Math.hypot(e2.clientX-startX, e2.clientY-startY) > 8){
          // тягнеш одразу — починаємо перетягування панелі без очікування утримання
          clearTimeout(holdTimer);
          dragging = true; draggingPanelPos = true; selPanel.style.transition = 'none';
        } else return;
      }
      e2.preventDefault(); // не давати сторінці/канвасу скролитись чи панорамуватись під час перетягування панелі
      var nl = Math.max(4, Math.min(r.width-40, startLeft + (e2.clientX-startX)));
      var nt = Math.max(4, Math.min(r.height-40, startTop + (e2.clientY-startY)));
      selPanel.style.left = nl+'px';
      selPanel.style.top = nt+'px';
    }
    function onUp(e2){
      e2.stopPropagation();
      clearTimeout(holdTimer);
      document.removeEventListener('pointermove', onMove);
      document.removeEventListener('pointerup', onUp);
      draggingPanelPos = false;
      if(dragging){
        selPanelCustomPos = { left: parseFloat(selPanel.style.left), top: parseFloat(selPanel.style.top) };
        try{ localStorage.setItem('tw-selpanel-pos', JSON.stringify(selPanelCustomPos)); }catch(err){}
        selPanelJustDragged = true; // наступний click на цій кнопці — це хвіст жесту, ігноруємо його як тап
      }
    }
    document.addEventListener('pointermove', onMove);
    document.addEventListener('pointerup', onUp);
  });
  selPanel.addEventListener('click', function(e){
    var btn = e.target.closest('button'); if(!btn) return;
    var act = btn.dataset.act; if(!selected) return;
    if(act==='panelEye'){
      if(selPanelJustDragged){ selPanelJustDragged = false; return; } // це був хвіст drag-жесту, не тап
      selPanelHidden = !selPanelHidden;
      render();
      return;
    }
    if(act==='animToggle'){
      animUiOn = !animUiOn;
      try{ localStorage.setItem('zone-edit-anim-on', animUiOn ? '1' : '0'); }catch(e){}
      if(!animUiOn) animPlay = {};
      toast(animUiOn ? 'Анімація увімкнена: тапни рукою по тайлу' : 'Анімація вимкнена');
      render();
      return;
    }
        if(act==='house-settings'){ openHouseSettings(); return; }
    if(act==='tag'){ if(selected.type==='placement') openTagModal('placement', selected.id); return; }
    if(act==='copy'){ copySelected(); return; }
    if(act==='paste'){ doPaste(); return; }
    // --- ДІЇ З ГРУПОЮ ТАЙЛІВ ---
    if (selected.type === 'multi') {
        if (act === 'multi-del') {
            if(!confirm(t('confirmDeleteNObjects').replace('{n}', selected.ids.length))) return;
            pushUndo();
            var delIds = new Set(selected.ids); project.placements = project.placements.filter(function(p){ return !delIds.has(p.id); });
            selected = null; toast(t('toastDeleted'));
        } else if (act === 'multi-copy') {
            var cx = (selected.minX+selected.maxX)/2, cy = (selected.minY+selected.maxY)/2;
            var items = [];
            selected.ids.forEach(function(id){
                var p = placementById(id);
                if(p) items.push({ tileId:p.tileId, z:p.z, scaleX:p.scaleX, scaleY:p.scaleY, flipX:p.flipX, flipY:p.flipY, rotation:p.rotation, skewX:p.skewX, group:p.group, floor:p.floor, isRoof:p.isRoof, dx:p.x-cx, dy:p.y-cy });
            });
            clipboard = { type:'multi', items:items };
            updatePasteBtn();
            toast(t('toastCopied'));
            tool = 'pan'; updateToolButtons();
        } else if (act === 'multi-move') {
            tool = 'pan'; updateToolButtons(); toast(t('toastDragAnySelected'));
        } else if (act === 'multi-zUp' || act === 'multi-zDown') {
            // Групове підняти/опустити на 1 — зсуває z КОЖНОГО виділеного об'єкта на ту саму
            // величину, тому їхній ВІДНОСНИЙ порядок між собою не міняється, міняється лише
            // позиція всієї групи відносно об'єктів ПОЗА виділенням.
            pushUndo();
            var dz = (act==='multi-zUp') ? 1 : -1;
            selected.ids.forEach(function(id){
                var pp = placementById(id);
                if(pp) pp.z = Math.max(-999999, Math.min(999999, pp.z + dz));
            });
            render(); saveActiveProject();
        } else if (act === 'multi-zEdit') {
            // Точне число, а не тільки стрілочки: показуємо/питаємо НАЙМЕНШИЙ z у виділенні
            // (як просто орієнтир, щоб не ламати те, що всередині групи z можуть бути різні) —
            // після вводу зсуваємо ВСІХ на різницю (нове−старий мінімум), тому відносний
            // порядок усередині групи так само зберігається, як і в ▲/▼.
            var curMinZ = selected.ids.reduce(function(m,id){
                var pp = placementById(id);
                return pp ? Math.min(m, pp.z) : m;
            }, Infinity);
            if(curMinZ===Infinity) curMinZ = 0;
            var maxZms = selected.ids.reduce(function(m,id){ var pp0=placementById(id); return pp0 ? Math.max(m, pp0.z) : m; }, -Infinity);
            var nvZ = prompt('Порядок виділених: від '+curMinZ+' до '+maxZms+'. Нове число для ВСІХ:', curMinZ);
            if(nvZ===null) return;
            var nzZ = parseInt(nvZ);
            if(isNaN(nzZ)) return;
            pushUndo();
            var dzEdit = 0;
            selected.ids.forEach(function(id){
                var pp = placementById(id);
                if(pp) pp.z = Math.max(-999999, Math.min(999999, nzZ));
            });
            render(); saveActiveProject();
        } else if (act === 'multi-savestamp') {
            var cxS = (selected.minX+selected.maxX)/2, cyS = (selected.minY+selected.maxY)/2;
            var itemsS = [];
            selected.ids.forEach(function(id){
                var p = placementById(id);
                if(p) itemsS.push({ tileId:p.tileId, z:p.z, scaleX:p.scaleX, scaleY:p.scaleY, flipX:p.flipX, flipY:p.flipY, rotation:p.rotation, skewX:p.skewX, group:p.group, floor:p.floor, isRoof:p.isRoof, dx:p.x-cxS, dy:p.y-cyS });
            });
            currentStamp = { items:itemsS };
            // ВАЖЛИВО: знімаємо виділення зі старої групи одразу. Інакше стара панель і
            // підсвітка лишаються на екрані навіть після переходу в режим штампа — виглядає
            // так, ніби ці 3 обʼєкти й далі "вибрані", і тап/драг по них плутається з режимом
            // штампа (перетягування вже не рухає оригінали, бо тепер тап = створити НОВУ копію
            // деінде, а не перемістити стару).
            selected = null;
            toast(t('toastStampSaved'));
            tool = 'clone'; cloneMode = 'stamp'; updateToolButtons();
        } else if (act === 'multi-autotile') {
            applyAutotiling();
            return; // applyAutotiling() сама робить render()/saveActiveProject() і скидає selected
        } else if (act === 'multi-lock') {
            var allLockedNow = selected.ids.length > 0 && selected.ids.every(function(id){
                var pp = placementById(id);
                return pp && pp.locked;
            });
            if(allLockedNow){
                if(!confirm(t('confirmUnlockNObjects').replace('{n}', selected.ids.length))) return;
                pushUndo();
                selected.ids.forEach(function(id){
                    var pp = placementById(id);
                    if(pp) pp.locked = false;
                });
                toast(t('toastUnlockedWord'));
                render(); saveActiveProject();
            } else {
                pushUndo();
                var lockedCount = 0;
                selected.ids.forEach(function(id){
                    var pp = placementById(id);
                    if(pp){ pp.locked = true; lockedCount++; }
                });
                toast(t('toastLockedCount').replace('{n}', lockedCount));
                selected = null; // як і для одиночного блокування — знімаємо виділення й панель
                render(); saveActiveProject();
            }
        } else if (act === 'multi-group') {
            var firstPg = placementById(selected.ids[0]);
            var ng = prompt(t('promptGroupNameEmpty'), firstPg&&firstPg.group || '');
            if (ng === null) return;
            pushUndo();
            selected.ids.forEach(function(id){
                var pp = placementById(id);
                if(!pp) return;
                if(ng==='') delete pp.group; else pp.group = ng;
            });
            // Без цього панель не оновлювалась одразу — Поверх/Дах не зʼявлялись, поки не
            // перевиділиш обʼєкти заново. Тепер кнопки з'являються одразу після призначення.
            selected.houseGroup = ng==='' ? null : ng;
            toast(ng==='' ? 'Групу знято' : 'Групу призначено: '+ng);
            render(); saveActiveProject();
        } else if (act === 'multi-floor') {
            var firstPf = placementById(selected.ids[0]);
            var nf = prompt(t('promptFloorNumEmpty'), (firstPf&&firstPf.floor!=null) ? firstPf.floor : '');
            if (nf === null) return;
            pushUndo();
            selected.ids.forEach(function(id){
                var pp = placementById(id);
                if(!pp) return;
                if(nf===''){ delete pp.floor; return; }
                var fnum = parseInt(nf);
                if(!isNaN(fnum)){ pp.floor = fnum; delete pp.isRoof; } // поверх і дах — взаємовиключні виміри
            });
            toast(nf==='' ? 'Поверх знято' : 'Поверх призначено: '+nf);
            render(); saveActiveProject();
        } else if (act === 'multi-roof') {
            pushUndo();
            var roofIds = selected.ids.map(function(id){ return placementById(id); }).filter(Boolean);
            var allRoofNow = roofIds.length > 0 && roofIds.every(function(o){ return !!o.isRoof; });
            roofIds.forEach(function(pp){ if(allRoofNow){ delete pp.isRoof; } else { pp.isRoof = true; delete pp.floor; } });
            toast(t('toastRoofToggled'));
        } else if (act === 'multi-shadow' || act === 'multi-shadowOval') {
            // ОДНА тінь для всієї групи: склеюємо всі виділені тайли в один силует і робимо з нього тінь.
            var gsP = [];
            selected.ids.forEach(function(id){
                var gpp = placementById(id);
                var gtt = gpp && project.tiles[gpp.tileId];
                if(gpp && gtt && gtt.img.complete && gtt.img.naturalWidth) gsP.push(gpp);
            });
            if(!gsP.length) return;
            var gx0 = Infinity, gy0 = Infinity, gx1 = -Infinity, gy1 = -Infinity, gZ = Infinity;
            gsP.forEach(function(gpp){
                var gbb = placementBBox(gpp);
                if(gbb.x0 < gx0) gx0 = gbb.x0; if(gbb.y0 < gy0) gy0 = gbb.y0;
                if(gbb.x1 > gx1) gx1 = gbb.x1; if(gbb.y1 > gy1) gy1 = gbb.y1;
                if(gpp.z < gZ) gZ = gpp.z;
            });
            gx0 = Math.floor(gx0); gy0 = Math.floor(gy0);
            var gW = Math.ceil(gx1) - gx0, gH = Math.ceil(gy1) - gy0;
            if(gW < 1 || gH < 1 || gW > 4096 || gH > 4096){ toast('Занадто великий обʼєкт для тіні'); return; }
            pushUndo();
            var gcan = document.createElement('canvas'); gcan.width = gW; gcan.height = gH;
            var gctx = gcan.getContext('2d'); gctx.imageSmoothingEnabled = false;
            gsP.slice().sort(comparePlacements).forEach(function(gpp){
                var gtt = project.tiles[gpp.tileId], gbb = placementBBox(gpp);
                var gsw = gtt.img.naturalWidth, gsh = gtt.img.naturalHeight;
                if(hasVariableFrames(gtt)) gsw = gtt.frames[0].w; else if(gtt.animFrames > 1) gsw = gsw / gtt.animFrames;
                gctx.save();
                gctx.translate(gbb.x0 - gx0 + (gpp.flipX ? gbb.w : 0), gbb.y0 - gy0 + (gpp.flipY ? gbb.h : 0));
                gctx.scale(gpp.flipX ? -1 : 1, gpp.flipY ? -1 : 1);
                gctx.drawImage(gtt.img, 0, 0, gsw, gsh, 0, 0, gbb.w, gbb.h);
                gctx.restore();
            });
            var gMinX = gW, gMinY = gH, gMaxX = -1, gMaxY = -1;
            try{
                var gd = gctx.getImageData(0, 0, gW, gH).data;
                for(var gyy = 0; gyy < gH; gyy++){
                    for(var gxx = 0; gxx < gW; gxx++){
                        if(gd[(gyy*gW + gxx)*4 + 3] > 10){
                            if(gxx < gMinX) gMinX = gxx; if(gxx > gMaxX) gMaxX = gxx;
                            if(gyy < gMinY) gMinY = gyy; if(gyy > gMaxY) gMaxY = gyy;
                        }
                    }
                }
            }catch(gerr){}
            if(gMaxX < gMinX || gMaxY < gMinY){ gMinX = 0; gMinY = 0; gMaxX = gW - 1; gMaxY = gH - 1; }
            var gCw = gMaxX - gMinX + 1, gCh = gMaxY - gMinY + 1;
            var gOutW, gOutH, gDX, gDY;
            var goff = document.createElement('canvas'), goctx;
            if(act === 'multi-shadow'){
                gOutW = gCw; gOutH = Math.max(1, Math.round(gCh * 0.4));
                goff.width = gOutW; goff.height = gOutH;
                goctx = goff.getContext('2d'); goctx.imageSmoothingEnabled = false;
                goctx.filter = 'blur(2px)';
                goctx.drawImage(gcan, gMinX, gMinY, gCw, gCh, 0, 0, gOutW, gOutH);
                goctx.filter = 'none';
                goctx.globalCompositeOperation = 'source-in';
                goctx.fillStyle = 'rgba(10,10,10,0.45)';
                goctx.fillRect(0, 0, gOutW, gOutH);
                gDX = gx0 + gMinX + Math.round(gCw * 0.12);
                gDY = gy0 + gMaxY + 1 - gOutH + Math.round(gOutH * 0.35);
            } else {
                gOutW = Math.max(2, Math.round(gCw * 0.9)); gOutH = Math.max(2, Math.round(gOutW * 0.32));
                goff.width = gOutW; goff.height = gOutH;
                goctx = goff.getContext('2d');
                var ggr = goctx.createRadialGradient(gOutW/2, gOutH/2, 0, gOutW/2, gOutH/2, gOutW/2);
                ggr.addColorStop(0, 'rgba(10,10,10,0.45)');
                ggr.addColorStop(0.75, 'rgba(10,10,10,0.35)');
                ggr.addColorStop(1, 'rgba(10,10,10,0)');
                goctx.fillStyle = ggr;
                goctx.beginPath(); goctx.ellipse(gOutW/2, gOutH/2, gOutW/2, gOutH/2, 0, 0, Math.PI*2); goctx.fill();
                gDX = gx0 + gMinX + Math.round((gCw - gOutW) / 2);
                gDY = gy0 + gMaxY + 1 - Math.round(gOutH * 0.5);
            }
            var gTile0 = project.tiles[gsP[0].tileId];
            var gSid = addTileFromDataURL(t('shadowTileName') + '_' + (act === 'multi-shadow' ? 'house' : 'house_oval'), goff.toDataURL(), gTile0 && gTile0.folderId);
            // новий тайл має pivot (0.5, 0.5) і без привʼязки до сітки → центр тіні = лівий верх + пів розміру
            var gnp = { id:'p'+(placeIdCounter++), tileId:gSid, x:px(gDX + gOutW/2), y:px(gDY + gOutH/2), z:gZ, layerId:gsP[0].layerId, scaleX:1, scaleY:1, flipX:false, flipY:false, rotation:0 };
            project.placements.push(gnp);
            selected = {type:'placement', id:gnp.id};
            tool = 'pan'; updateToolButtons();
            toast(t('toastShadowAdded'));
        } else if (act === 'house-enter') {
            // Стартовий поверх — найнижчий floor серед знайдених елементів будинку (не дах).
            var floors = [];
            selected.ids.forEach(function(id){
                var pp = placementById(id);
                if(pp && pp.floor != null) floors.push(pp.floor);
            });
            houseView.enabled = true;
            houseView.group = selected.houseGroup;
            houseView.activeFloor = floors.length ? Math.min.apply(null, floors) : 0;
            selected = null;
            buildHouseViewBar();
            render(); return;
        }
        render(); saveActiveProject(); return;
    }
    
    if(selected.type==='placement'){
      var p = placementById(selected.id);
      if(!p) return;
      if(act==='unlock'){
        if(!confirm(t('confirmUnlockThisObject'))) return;
        pushUndo();
        p.locked = false;
        render(); saveActiveProject(); toast(t('toastUnlockedWord'));
        return;
      }
      if(act==='unlock-group'){
        if(!p.group) return;
        var groupName = p.group;
        var members = project.placements.filter(function(pp){ return pp.group===groupName; });
        if(!confirm(t('confirmUnlockNObjects').replace('{n}', members.length))) return;
        pushUndo();
        members.forEach(function(pp){ pp.locked = false; });
        selected = null;
        render(); saveActiveProject(); toast(t('toastUnlockedWord'));
        return;
      }
      if(act==='lock'){
        pushUndo();
        p.locked = true;
        selected = null; // після блокування знімаємо виділення — панель заблокованого обʼєкта відкриється заново при наступному тапі
        render(); saveActiveProject(); toast(t('toastLockedWord'));
        return;
      }
      if(act==='layer'){
        var nv = prompt(t('layerPrompt'), p.z);
        if(nv===null) return;
        var nz = parseInt(nv);
        if(isNaN(nz)) return;
        pushUndo();
        p.z = Math.max(-999999, Math.min(999999, nz));
        render(); saveActiveProject(); return;
      }
      if(act==='zUp' || act==='zDown'){
        // Швидке підняти/опустити на 1 текстуру — без діалогу з клавіатурою, для швидкого
        // перебору порядку малювання коли об'єкти перекривають одне одного.
        pushUndo();
        p.z += (act==='zUp' ? 1 : -1);
        p.z = Math.max(-999999, Math.min(999999, p.z));
        render(); saveActiveProject(); return;
      }
      if(act==='group'){
        // Те саме, що й multi-group, але для ОДНОГО обʼєкта — щоб призначити "Дім" можна було
        // просто тапнувши рукою, без рамки виділення (раніше group/floor/roof існували ЛИШЕ
        // в мульти-панелі, тому навіть одну текстуру не можна було позначити дахом інакше, ніж
        // через виділення рамкою навколо неї).
        var ng2 = prompt(t('promptGroupNameEmpty'), p.group || '');
        if(ng2===null) return;
        pushUndo();
        if(ng2==='') delete p.group; else p.group = ng2;
        render(); saveActiveProject(); return;
      }
      if(act==='floor'){
        var nf2 = prompt(t('promptFloorNumEmpty'), p.floor!=null ? p.floor : '');
        if(nf2===null) return;
        pushUndo();
        if(nf2===''){ delete p.floor; }
        else { var fn2 = parseInt(nf2); if(!isNaN(fn2)){ p.floor = fn2; delete p.isRoof; } }
        render(); saveActiveProject(); return;
      }
      if(act==='roof'){
        pushUndo();
        p.isRoof = !p.isRoof;
        if(p.isRoof) delete p.floor;
        render(); saveActiveProject(); return;
      }
      if(act==='select-house'){
        // Навмисно НЕ фільтруємо по activeLayerId (на відміну від area-select рамкою) —
        // будинок свідомо розкладений на кілька шарів (інтер'єр/екстер'єр), тому вибір
        // "весь будинок" мусить зібрати group з усіх шарів одразу, інакше повернеться
        // тільки половина будинку.
        // Заблоковані ТЕЖ включаємо (на відміну від тягнення групи) — інакше повністю
        // заблокований будинок неможливо було б повторно вибрати, щоб розблокувати.
        var houseIds = [];
        project.placements.forEach(function(pp){
          if(pp.group === p.group) houseIds.push(pp.id);
        });
        if(houseIds.length===0) return;
        var hxs=[], hys=[];
        houseIds.forEach(function(id){
          var pp = placementById(id);
          var b = placementBBox(pp);
          hxs.push(b.x0,b.x1); hys.push(b.y0,b.y1);
        });
        selected = { type:'multi', ids:houseIds, minX:Math.min.apply(null,hxs), maxX:Math.max.apply(null,hxs), minY:Math.min.apply(null,hys), maxY:Math.max.apply(null,hys), houseGroup:p.group };
        toast(t('toastHouseSelected').replace('{name}', p.group).replace('{n}', houseIds.length));
        render();
        return;
      }
      if(act==='dup'){
        clipboard = { type:'single', tileId:p.tileId, z:p.z, scaleX:p.scaleX, scaleY:p.scaleY, flipX:p.flipX, flipY:p.flipY, rotation:p.rotation, skewX:p.skewX, group:p.group, floor:p.floor, isRoof:p.isRoof };
        updatePasteBtn();
        toast(t('toastCopied'));
        tool = 'pan'; updateToolButtons();
        return;
      }
      if(act==='shadow'){
        var srcTile = project.tiles[p.tileId];
        if(!srcTile || !srcTile.img.complete){ return; }
        pushUndo();
        var b = placementBBox(p);
        var flatten = 0.4;
        var iw = srcTile.img.naturalWidth, ih = srcTile.img.naturalHeight;
        if(hasVariableFrames(srcTile)) iw = srcTile.frames[0].w; // кадри різної ширини — силует з ПЕРШОГО кадру
        else if(srcTile.animFrames > 1) iw = iw / srcTile.animFrames; // анімований тайл — смуга кадрів, силует беремо тільки з ПЕРШОГО кадру, а не з усієї стрічки
        // Обрізаємо зайві прозорі поля довкола реального малюнка ПЕРЕД стисканням. Багато
        // ізометричних спрайтів мають навколо об'єкта прозорий запас (щоб влізти в
        // однаковий розмір клітинки) — якщо стискати ввесь канвас разом із цим запасом,
        // силует виходить набагато ширшим/іншої форми, ніж сам об'єкт (саме це, схоже, й дає
        // той "ромбовий"/"перетікає в траву" ефект на будинках — крайні прозорі пікселі
        // канви теж стискаються в форму).
        var minCX=iw, minCY=ih, maxCX=-1, maxCY=-1;
        try{
          var srcCanvas = document.createElement('canvas'); srcCanvas.width=iw; srcCanvas.height=ih;
          var srcCtx = srcCanvas.getContext('2d');
          srcCtx.imageSmoothingEnabled = false;
          srcCtx.drawImage(srcTile.img, 0, 0);
          var idata = srcCtx.getImageData(0,0,iw,ih).data;
          for(var yy=0; yy<ih; yy++){
            for(var xx=0; xx<iw; xx++){
              if(idata[(yy*iw+xx)*4+3] > 10){
                if(xx<minCX) minCX=xx; if(xx>maxCX) maxCX=xx;
                if(yy<minCY) minCY=yy; if(yy>maxCY) maxCY=yy;
              }
            }
          }
        }catch(e){ /* canvas недоступний для читання пікселів (напр. CORS) — працюємо з повним кадром */ }
        if(maxCX<minCX || maxCY<minCY){ minCX=0; minCY=0; maxCX=iw-1; maxCY=ih-1; }
        var cw = maxCX-minCX+1, ch = maxCY-minCY+1;
        var scale = b.w/iw;
        var sw = Math.max(1, Math.round(cw*scale));
        var sh = Math.max(1, Math.round(ch*scale*flatten));
        var off = document.createElement('canvas'); off.width = sw; off.height = sh;
        var octx = off.getContext('2d');
        octx.imageSmoothingEnabled = false;
        // Легкий блюр перед вирізанням силуету: без нього дрібні деталі спрайту (вікна, двері,
        // щілини між дошками) лишаються прозорими дірками всередині тіні й впадають в очі —
        // особливо на будинках. Дерева з округлою кроною цим майже не страждають, тому їм і
        // так було норм, а от прямокутні об'єкти виглядали "не так".
        octx.filter = 'blur(2px)';
        octx.drawImage(srcTile.img, minCX, minCY, cw, ch, 0, 0, sw, sh);
        octx.filter = 'none';
        octx.globalCompositeOperation = 'source-in';
        octx.fillStyle = 'rgba(10,10,10,0.45)';
        octx.fillRect(0,0,sw,sh);
        var shadowTileId = addTileFromDataURL(t('shadowTileName')+'_'+(srcTile.name||p.tileId), off.toDataURL(), srcTile.folderId);
        var offX = Math.round(b.w*0.12), offY = Math.round(b.h*0.32);
        var np = { id:'p'+(placeIdCounter++), tileId:shadowTileId, x:px(p.x+offX), y:px(p.y+offY), z:p.z, layerId:p.layerId, scaleX:1, scaleY:1, flipX:false, flipY:false, rotation:0 };
        project.placements.push(np);
        selected = {type:'placement', id:np.id};
        tool = 'pan'; updateToolButtons();
        render(); saveActiveProject(); toast(t('toastShadowAdded'));
        return;
      }
      if(act==='shadowOval'){
        // Проста тінь-еліпс, що ігнорує вміст спрайту (без силуету).
        // Для об'єктів, чия форма зверху не округла (будинки, паркани, скрині) стиснутий
        // силует усього малюнка виглядає як "розплавлена" копія самого об'єкта — реальна тінь
        // так не падає. М'який еліпс під основою читається природніше для таких форм.
        pushUndo();
        var bo = placementBBox(p);
        var ow = Math.max(2, Math.round(bo.w*0.8));
        var oh = Math.max(2, Math.round(bo.w*0.32));
        var offc = document.createElement('canvas'); offc.width = ow; offc.height = oh;
        var octx2 = offc.getContext('2d');
        var grad = octx2.createRadialGradient(ow/2,oh/2,0, ow/2,oh/2, ow/2);
        grad.addColorStop(0, 'rgba(10,10,10,0.45)');
        grad.addColorStop(0.75, 'rgba(10,10,10,0.35)');
        grad.addColorStop(1, 'rgba(10,10,10,0)');
        octx2.fillStyle = grad;
        octx2.beginPath();
        octx2.ellipse(ow/2, oh/2, ow/2, oh/2, 0, 0, Math.PI*2);
        octx2.fill();
        var shadowTileId2 = addTileFromDataURL(t('shadowTileName')+'_oval_'+(project.tiles[p.tileId]&&project.tiles[p.tileId].name||p.tileId), offc.toDataURL(), project.tiles[p.tileId]&&project.tiles[p.tileId].folderId);
        var offX2 = Math.round(bo.w*0.02), offY2 = Math.round(bo.h*0.42);
        var np2 = { id:'p'+(placeIdCounter++), tileId:shadowTileId2, x:px(p.x+offX2), y:px(p.y+offY2), z:p.z, layerId:p.layerId, scaleX:1, scaleY:1, flipX:false, flipY:false, rotation:0 };
        project.placements.push(np2);
        selected = {type:'placement', id:np2.id};
        tool = 'pan'; updateToolButtons();
        render(); saveActiveProject(); toast(t('toastShadowAdded'));
        return;
      }
      if(act==='rotate'){ rotatingId = (rotatingId===p.id) ? null : p.id; render(); return; }
      if(act==='precision'){ openPrecisionPanel(); return; }
      if(act==='del'){
        if(!confirm(t('confirmDeleteThisObject'))) return;
        pushUndo();
        project.placements = project.placements.filter(function(pp){return pp.id!==p.id;}); selected=null; toast(t('toastDeleted'));
        render(); saveActiveProject();
        return;
      }
      pushUndo();
      if(act==='mirror') p.flipX = !p.flipX;
      if(act==='mirrorY') p.flipY = !p.flipY;
    } else if(selected.type==='spawn'){
      var sp = project.spawns.find(function(x){return x.id===selected.id;});
      if(!sp) return;
      if(act==='spawn-edit'){
        var nt = prompt(t('promptSpawnType'), sp.spawnType||'');
        if(nt===null) return;
        var ncStr = prompt(t('promptSpawnChance'), String(sp.chance!=null?sp.chance:100));
        if(ncStr===null) return;
        pushUndo();
        sp.spawnType = nt;
        sp.chance = Math.max(0, Math.min(100, parseInt(ncStr)||0));
        render(); saveActiveProject(); return;
      }
      if(act==='spawn-dup'){
        pushUndo();
        var nsD = {id:'s'+(spawnIdCounter++), x:px(sp.x+16), y:px(sp.y+16), spawnType:sp.spawnType, chance:sp.chance};
        project.spawns.push(nsD);
        selected = {type:'spawn', id:nsD.id};
        tool = 'pan'; updateToolButtons();
        render(); saveActiveProject(); toast(t('toastCopied'));
        return;
      }
      if(act==='spawn-del'){
        if(!confirm(t('confirmDeleteSpawnPoint'))) return;
        pushUndo();
        project.spawns = project.spawns.filter(function(x){return x.id!==sp.id;}); selected=null; toast(t('toastDeleted'));
        render(); saveActiveProject();
        return;
      }
    } else {
      var sc = project.collisions.find(function(cc){return cc.id===selected.id;});
      if(!sc) return;
      if(act==='cfloor'){ pushUndo(); var nfl=parseInt(prompt('Поверх колізії (число):', sc.onFloor||1)); if(!isNaN(nfl)&&nfl>=1) sc.onFloor=nfl; render(); saveActiveProject(); return; }
      if(act==='cunlock'){
        if(!confirm(t('confirmUnlockThisCollision'))) return;
        pushUndo();
        sc.locked = false;
        render(); saveActiveProject(); toast(t('toastUnlockedWord'));
        return;
      }
      if(act==='clock'){
        pushUndo();
        sc.locked = true;
        selected = null; // одразу знімаємо виділення — панель заблокованої колізії відкриється заново при наступному тапі
        render(); saveActiveProject(); toast(t('toastLockedWord'));
        return;
      }
      if(act==='ctype'){
        pushUndo();
        var order = ['solid','trigger','floorTransition'];
        var idx = order.indexOf(sc.type||'solid');
        sc.type = order[(idx+1)%order.length];
        if(sc.type==='solid'){ delete sc.group; delete sc.floor; delete sc.fromFloor; delete sc.toFloor; }
        else promptCollisionMeta(sc);
        render(); saveActiveProject(); toast(t('toastSpawnTypeIs').replace('{name}', sc.type));
        return;
      }
      if(act==='cdup'){
        pushUndo();
        var ns;
        if(sc.shape==='circle'){ ns = {id:'c'+(colIdCounter++), shape:'circle', x:px(sc.x+16), y:px(sc.y+16), r:sc.r}; }
        else if(sc.shape==='poly'){ ns = {id:'c'+(colIdCounter++), shape:'poly', pts:sc.pts.map(function(q){ return {x:px(q.x+16), y:px(q.y+16)}; })}; }
        else { var dw=sc.x1-sc.x0, dh=sc.y1-sc.y0; ns = {id:'c'+(colIdCounter++), shape:'rect', x0:px(sc.x0+16), y0:px(sc.y0+16), x1:px(sc.x0+16+dw), y1:px(sc.y0+16+dh)}; }
        ns.type = sc.type || 'solid';
        if(sc.group!=null) ns.group = sc.group;
        if(sc.floor!=null) ns.floor = sc.floor;
        if(sc.fromFloor!=null) ns.fromFloor = sc.fromFloor;
        if(sc.toFloor!=null) ns.toFloor = sc.toFloor;
        project.collisions.push(ns);
        selected = {type:'collision', id:ns.id};
        tool = 'pan'; updateToolButtons();
        render(); saveActiveProject(); toast(t('toastCopied'));
        return;
      }
      if(act==='del'){
        if(!confirm(t('confirmDeleteThisObject'))) return;
        pushUndo();
        project.collisions = project.collisions.filter(function(cc){return cc.id!==selected.id;}); selected=null; toast(t('toastDeleted'));
        render(); saveActiveProject();
        return;
      }
    }
    render(); saveActiveProject();
  });
