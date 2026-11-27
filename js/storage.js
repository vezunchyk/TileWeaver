/* js/storage.js — Збереження: IndexedDB, картинки окремо, завантаження, проєкти, експорт у файл, імпорт.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function escHtml(v){ return String(v==null?'':v).replace(/[&<>"']/g,function(c){ return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]; }); }
  function getIndex(){ try{ return JSON.parse(localStorage.getItem(IDX_KEY))||[]; }catch(e){ return []; } }
  function setIndex(idx){ localStorage.setItem(IDX_KEY, JSON.stringify(idx)); }
  function projectKey(id){ return 'zone-edit-project-'+id; }
  function idbOpen(){
    if(idbPromise) return idbPromise;
    idbPromise = new Promise(function(resolve, reject){
      if(!window.indexedDB){ reject(new Error('IndexedDB недоступний у цьому браузері')); return; }
      // Відкриваємо БЕЗ жорсткої версії: якщо база вже має вищу версію (помилка "requested version (1)
      // is less than the existing version (2)"), просто береться поточна. Якщо сховища нема — піднімаємо версію на 1.
      function openAt(ver){
        var req = ver ? indexedDB.open(IDB_NAME, ver) : indexedDB.open(IDB_NAME);
        req.onupgradeneeded = function(e){
          var db = e.target.result;
          if(!db.objectStoreNames.contains(IDB_STORE)) db.createObjectStore(IDB_STORE);
        };
        req.onsuccess = function(e){
          var db = e.target.result;
          if(!db.objectStoreNames.contains(IDB_STORE)){ var v = db.version+1; db.close(); openAt(v); return; }
          db.onversionchange = function(){ db.close(); idbPromise = null; };
          resolve(db);
        };
        req.onerror = function(e){ reject(e.target.error || new Error('IndexedDB open failed')); };
      }
      openAt(0);
    });
    idbPromise.catch(function(){ idbPromise = null; }); // щоб наступна спроба могла відкрити заново
    return idbPromise;
  }
  function idbSet(key, value){
    return idbOpen().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).put(value, key);
        tx.oncomplete = function(){ resolve(); };
        tx.onerror = function(){ reject(tx.error); };
        tx.onabort = function(){ reject(tx.error || new Error('transaction aborted')); };
      });
    });
  }
  function idbGet(key){
    return idbOpen().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(IDB_STORE, 'readonly');
        var req = tx.objectStore(IDB_STORE).get(key);
        req.onsuccess = function(){ resolve(req.result); };
        req.onerror = function(){ reject(req.error); };
      });
    });
  }
  function idbDelete(key){
    return idbOpen().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(IDB_STORE, 'readwrite');
        tx.objectStore(IDB_STORE).delete(key);
        tx.oncomplete = function(){ resolve(); };
        tx.onerror = function(){ reject(tx.error); };
      });
    });
  }
  function imgKey(pid, tid){ return IMG_PREFIX + pid + ':' + tid; } // projectId -> { tileId: dataURL, що вже лежить у сховищі окремим записом }
  // Один запис за одну транзакцію: нові/змінені картинки + прибирання видалених + сам проєкт (все або нічого)
  function idbSaveProjectSplit(pid, main, puts, dels){
    return idbOpen().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(IDB_STORE, 'readwrite'), st = tx.objectStore(IDB_STORE);
        puts.forEach(function(x){ st.put(x[1], x[0]); });
        dels.forEach(function(k){ st.delete(k); });
        st.put(main, pid);
        tx.oncomplete = function(){ resolve(); };
        tx.onerror = function(){ reject(tx.error); };
        tx.onabort = function(){ reject(tx.error || new Error('transaction aborted')); };
      });
    });
  }
  // Видалення проєкту разом з усіма його картинками
  function idbDeleteProject(pid){
    return idbOpen().then(function(db){
      return new Promise(function(resolve, reject){
        var tx = db.transaction(IDB_STORE, 'readwrite'), st = tx.objectStore(IDB_STORE);
        st.delete(pid);
        st.delete(IDBKeyRange.bound(IMG_PREFIX + pid + ':', IMG_PREFIX + pid + ':\uffff'));
        tx.oncomplete = function(){ resolve(); };
        tx.onerror = function(){ reject(tx.error); };
      });
    }).then(function(){ delete imgSavedByProject[pid]; });
  }
  // Перейменування БЕЗ перезапису картинок: чіпаємо лише основний запис
  function idbRenameProject(pid, name){
    return idbGet(pid).then(function(raw){
      if(raw){ raw.name = name; return idbSet(pid, raw); }
      return loadProjectDataById(pid).then(function(d2){ if(d2){ d2.name = name; return idbSet(pid, d2); } });
    });
  }
  // Повертає дані проєкту в ПОВНОМУ вигляді (з dataURL у tiles), як і раніше — решта коду не знає про розділення
  // Сумісність: формат зі сховищем `textures` (ключ "<проєкт>|<тайл>" → dataURL, прапор tilesSplit) — так описано
  // в README-DEV.md. Читаємо його, якщо такі дані є в браузері; перший же запис переводить проєкт на поточний формат.
  function hydrateTexturesStore(id, data){
    var tids = Object.keys(data.tiles || {});
    return idbOpen().then(function(db){
      return new Promise(function(resolve){
        var res = {};
        if(!db.objectStoreNames.contains('textures')){ resolve(res); return; }
        var tx = db.transaction('textures', 'readonly'), rq = tx.objectStore('textures').openCursor(IDBKeyRange.bound(id + '|', id + '|\uffff'));
        rq.onsuccess = function(){ var c = rq.result; if(c){ res[String(c.key).slice(id.length + 1)] = c.value; c.continue(); } };
        tx.oncomplete = function(){ resolve(res); };
        tx.onerror = tx.onabort = function(){ resolve(res); };
      });
    }).then(function(res){
      tids.forEach(function(tid){
        var du = res[tid];
        if(typeof du === 'string' && du.indexOf('data:image/') === 0) data.tiles[tid].dataURL = du;
        else if(!data.tiles[tid].dataURL){ console.error('TileWeaver: немає картинки тайла', tid, 'проєкту', id); data.tiles[tid].dataURL = BLANK_PNG; }
      });
      delete data.tilesSplit;
      imgSavedByProject[id] = {}; // наступне збереження запише картинки у поточному форматі
      return data;
    });
  }
  function hydrateProjectData(id, data){
    if(data && data.tilesSplit && !data.split) return hydrateTexturesStore(id, data);
    if(!data || !data.split){ imgSavedByProject[id] = {}; return Promise.resolve(data); }
    var tids = Object.keys(data.tiles || {});
    return idbOpen().then(function(db){
      return new Promise(function(resolve, reject){
        var res = {}, tx = db.transaction(IDB_STORE, 'readonly'), st = tx.objectStore(IDB_STORE);
        tids.forEach(function(tid){
          var rq = st.get(imgKey(id, tid));
          rq.onsuccess = function(){ res[tid] = rq.result; };
        });
        tx.oncomplete = function(){ resolve(res); };
        tx.onerror = function(){ reject(tx.error); };
        tx.onabort = function(){ reject(tx.error || new Error('transaction aborted')); };
      });
    }).then(function(res){
      var saved = {};
      tids.forEach(function(tid){
        var du = res[tid];
        if(typeof du === 'string' && du.indexOf('data:image/') === 0) saved[tid] = du;
        else { console.error('TileWeaver: немає картинки тайла', tid, 'проєкту', id); du = BLANK_PNG; }
        data.tiles[tid].dataURL = du;
      });
      imgSavedByProject[id] = saved;
      delete data.split;
      return data;
    });
  }
  function loadProjectDataById(id){
    return idbGet(id).then(function(data){
      if(data) return hydrateProjectData(id, data);
      try{
        var raw = localStorage.getItem(projectKey(id));
        if(raw){
          var legacy = JSON.parse(raw);
          idbSet(id, legacy).catch(function(){}); // переносимо у фоні, не чекаємо і не блокуємо
          imgSavedByProject[id] = {};
          return legacy;
        }
      }catch(e){}
      return null;
    });
  }

  // noImages=true — для збереження в IndexedDB: картинки тайлів пишуться окремо (див. flushSaveActiveProject).
  // Для ЕКСПОРТУ у файл викликається без параметра — формат файлу той самий, що й раніше (з dataURL).
  function serializeProject(noImages){
    var tilesOut = {};
    Object.keys(project.tiles).forEach(function(id){
      var t = project.tiles[id];
      tilesOut[id] = noImages ? { name: t.name, folderId: t.folderId } : { name: t.name, dataURL: t.dataURL, folderId: t.folderId };
      if(t.autoShadow) tilesOut[id].autoShadow = true;
      if(t.tag) tilesOut[id].tag = t.tag;
      if(t.animFrames > 1){ tilesOut[id].animFrames = t.animFrames; tilesOut[id].animFrameMs = t.animFrameMs; if(t.animLoop) tilesOut[id].animLoop = true; }
      if(Array.isArray(t.frames) && t.frames.length > 1){ tilesOut[id].frames = t.frames; } // кадри різної ширини (двері тощо) — див. hasVariableFrames
      if(t.pivotX != null && t.pivotY != null){ tilesOut[id].pivotX = t.pivotX; tilesOut[id].pivotY = t.pivotY; }
      else if(t.anchor === 'bottom'){ tilesOut[id].anchor = 'bottom'; } // старі тайли без pivot-редактора
      if(typeof t.edgeAnchorT === 'number'){ tilesOut[id].edgeAnchorT = t.edgeAnchorT; }
      else if(t.gridAnchor){ tilesOut[id].gridAnchor = t.gridAnchor; }
    });
    return { version:5, id:project.id, name:project.name, gridType:project.gridType, cellSize:project.cellSize, gridOver:project.gridOver!==false, lightDir:project.lightDir||'se', gridColor:project.gridColor||'#5a6446',
      tiles:tilesOut, placements:project.placements, collisions:project.collisions, spawns:project.spawns,
      layers:project.layers, activeLayerId:project.activeLayerId, autotileGroups:project.autotileGroups,
      tileFolders:project.tileFolders };
  }
  function saveActiveProject(){
    // Дебаунс: без цього кожна дрібна дія (кожен розміщений тайл, кожен драг) синхронно
    // JSON.stringify-ила ВЕСЬ проєкт разом з base64-картинками всіх тайлів і писала в
    // localStorage — це блокує головний потік і відчувається як "тупить", особливо після
    // великої заливки, коли placements вже великий масив. Тепер реальний запис відкладається
    // на 400мс і схлопує кілька викликів поспіль в один. flushSaveActiveProject() примусово
    // зберігає негайно — виклич його там, де важливо не втратити останній стан синхронно
    // (перед перемиканням/закриттям проєкту, beforeunload).
    if(!project.id) return;
    placementsEpoch++;
    minimapDirty = true; // карта могла змінитись — перемалюємо кеш мінімапи при наступному render()
    clearTimeout(saveDebounceTimer);
    // Через 400 мс після останньої дії — і ще й у «вільний» момент браузера (requestIdleCallback), щоб
    // серіалізація не відбирала час у малювання. Негайні збереження (згортання, експорт) викликають flush напряму.
    saveDebounceTimer = setTimeout(function(){
      if(window.requestIdleCallback){ saveIdleHandle = requestIdleCallback(flushSaveActiveProject, { timeout:1500 }); }
      else flushSaveActiveProject();
    }, 400);
  } // для режиму ?perf
  function flushSaveActiveProject(){
    clearTimeout(saveDebounceTimer); saveDebounceTimer = null;
    if(saveIdleHandle !== null && window.cancelIdleCallback){ cancelIdleCallback(saveIdleHandle); } saveIdleHandle = null;
    if(!project.id) return;
    var tSave0 = performance.now();
    var data = serializeProject(true); data.split = true;
    var savedId = project.id, savedName = project.name; // фіксуємо ЗАРАЗ — до того, як project міг би змінитись асинхронно
    var mySeq = (saveSeqByProject[savedId] = (saveSeqByProject[savedId]||0) + 1);
    var savedImgs = imgSavedByProject[savedId] || (imgSavedByProject[savedId] = {});
    var puts = [], dels = [];
    Object.keys(project.tiles).forEach(function(tid){
      var du = project.tiles[tid].dataURL;
      if(typeof du === 'string' && savedImgs[tid] !== du) puts.push([imgKey(savedId, tid), du, tid]);
    });
    Object.keys(savedImgs).forEach(function(tid){ if(!project.tiles[tid]) dels.push(imgKey(savedId, tid)); });
    idbSaveProjectSplit(savedId, data, puts, dels).then(function(){
      puts.forEach(function(x){ savedImgs[x[2]] = x[1]; });
      dels.forEach(function(k){ delete savedImgs[k.slice((IMG_PREFIX + savedId + ':').length)]; });
      lastSaveMs = performance.now() - tSave0;
      if(saveSeqByProject[savedId] !== mySeq) return; // новіший flush уже стартував/завершився — індекс не чіпаємо
      var idx = getIndex();
      var entry = idx.find(function(p){return p.id===savedId;});
      if(entry){ entry.name = savedName; entry.updatedAt = Date.now(); }
      else idx.push({id:savedId, name:savedName, updatedAt:Date.now()});
      setIndex(idx);
      localStorage.setItem(ACTIVE_KEY, savedId);
    }).catch(function(err){
      console.error('TileWeaver: IndexedDB save failed:', err);
      showStorageFullBanner(err);
    });
  }
  function showStorageFullBanner(err){
    var b = document.getElementById('errBanner');
    if(!b) return;
    b.style.display = 'block';
    b.innerHTML = '';
    var msgEl = document.createElement('span');
    msgEl.style.cursor = 'pointer';
    // "Переповнене" — лише НАЙІМОВІРНІША причина, не єдина можлива: якщо IndexedDB у цьому
    // браузері взагалі недоступна (приватний режим, заборона сховища в налаштуваннях сайту) —
    // це та сама помилка навіть на ПОРОЖНЬОМУ проєкті, і там "переповнене" вводить в оману.
    // Показуємо справжнє повідомлення браузера дрібним текстом під основним — щоб було що
    // написати розробнику, якщо це повториться на порожньому проєкті знову.
    var unavailable = err && /недоступ/i.test(String(err.message||err));
    msgEl.textContent = unavailable
      ? '⚠ Не вдалось зберегти — сховище браузера недоступне в цьому режимі перегляду (приватна вкладка чи заборона в налаштуваннях сайту). Натисни тут, тоді Проєкти → ⬇ Експорт у файл, щоб не втратити роботу.'
      : ((err && (err.name==='QuotaExceededError' || /quota/i.test(String(err.message||'')))) ? t('storageFullBanner') : '⚠ Не вдалось зберегти. Натисни тут, тоді Проєкти → ⬇ Експорт у файл, щоб не втратити роботу.');
    if(err && err.message){
      var detail = document.createElement('div');
      detail.style.cssText = 'font-size:9px; opacity:0.75; margin-top:3px;';
      detail.textContent = String(err.message);
      msgEl.appendChild(document.createElement('br'));
      msgEl.appendChild(detail);
    }
    msgEl.addEventListener('click', function(){ b.style.display='none'; openProjects(); });
    var closeBtn = document.createElement('button');
    closeBtn.className = 'err-close'; closeBtn.textContent = '✕'; closeBtn.type = 'button';
    closeBtn.addEventListener('click', function(ev){ ev.stopPropagation(); b.style.display='none'; });
    b.appendChild(msgEl); b.appendChild(closeBtn);
  }
  function loadProjectData(data){
    if(typeof exitMoveMode==='function') exitMoveMode(); // не тягнути режим вибору тайлів у ІНШИЙ проєкт при перемиканні
    undoMgr.reset(); scheduleUndoWarm(); clipboard = null; currentStamp = null;
    project.id = data.id; project.name = data.name;
    project.gridType = data.gridType || 'iso'; project.cellSize = data.cellSize || 64;
    project.gridOver = data.gridOver !== false;
    project.lightDir = SH_DIRS[data.lightDir] ? data.lightDir : 'se';
    project.gridColor = (typeof data.gridColor==='string' && /^#[0-9a-fA-F]{6}$/.test(data.gridColor)) ? data.gridColor : '#5a6446';
    project.tileFolders = Array.isArray(data.tileFolders) ? data.tileFolders : [];
    project.tiles = {}; tileIdCounter = 1;
    var maxTid=0;
    Object.keys(data.tiles||{}).forEach(function(id){
      var tl = data.tiles[id];
      var img = new Image(); img.onload = render; img.src = tl.dataURL;
      // Старі проєкти (до появи папок) не мають folderId на тайлах — кладемо їх у першу
      // (дефолтну) папку, щоб нічого не загубилось.
      project.tiles[id] = { name:tl.name, img:img, dataURL:tl.dataURL, folderId: (tl.folderId && project.tileFolders.some(function(x){ return x.id===tl.folderId; })) ? tl.folderId : null };
      if(tl.autoShadow) project.tiles[id].autoShadow = true;
      if(tl.tag) project.tiles[id].tag = tl.tag;
      if(tl.animFrames > 1){ project.tiles[id].animFrames = tl.animFrames; project.tiles[id].animFrameMs = tl.animFrameMs||150; if(tl.animLoop) project.tiles[id].animLoop = true; }
      if(Array.isArray(tl.frames) && tl.frames.length > 1){ project.tiles[id].frames = tl.frames; }
      if(tl.pivotX != null && tl.pivotY != null){ project.tiles[id].pivotX = tl.pivotX; project.tiles[id].pivotY = tl.pivotY; }
      else if(tl.anchor === 'bottom'){ project.tiles[id].anchor = 'bottom'; } // старі проєкти без pivot-редактора
      if(typeof tl.edgeAnchorT === 'number'){ project.tiles[id].edgeAnchorT = tl.edgeAnchorT; }
      else if(tl.gridAnchor){ project.tiles[id].gridAnchor = tl.gridAnchor; }
      var n = parseInt(id.replace('t',''))||0; if(n>maxTid) maxTid=n;
    });
    tileIdCounter = maxTid+1;
    activeFolderId = project.tileFolders.length ? project.tileFolders[0].id : null;
    if(hasAnyAnimatedTile()) registerAnimatedTile();
    project.placements = data.placements || [];
    project.collisions = data.collisions || [];
    project.spawns = data.spawns || []; // старі проєкти (до появи точок спавну) просто не мають цього поля
    project.autotileGroups = data.autotileGroups || [];
    project.layers = (data.layers && data.layers.length) ? data.layers : [{id:'default', name:t('layerDefaultName')+' 1', visible:true, locked:false, baseZ:LAYER_Z_STEP}];
    project.layers.forEach(function(l, idx){
      if(typeof l.baseZ !== 'number'){ l.baseZ = (idx+1)*LAYER_Z_STEP; }
    });
    project.activeLayerId = data.activeLayerId || project.layers[0].id;
    var validLayerIds = {};
    project.layers.forEach(function(l){ validLayerIds[l.id] = true; });
    project.placements.forEach(function(p){ if(!p.layerId || !validLayerIds[p.layerId]) p.layerId = project.layers[0].id; });
    var maxPid=0, maxCid=0, maxSid=0;
    project.placements.forEach(function(p){ var n=parseInt((p.id||'').replace('p',''))||0; if(n>maxPid)maxPid=n; });
    project.collisions.forEach(function(c){ var n=parseInt((c.id||'').replace('c',''))||0; if(n>maxCid)maxCid=n; });
    project.spawns.forEach(function(sp){ var n=parseInt((sp.id||'').replace('s',''))||0; if(n>maxSid)maxSid=n; });
    placeIdCounter = maxPid+1; colIdCounter = maxCid+1; spawnIdCounter = maxSid+1;
    activeTileId = Object.keys(project.tiles)[0] || null;
    selected = null;
    houseView.enabled = false; houseView.group = null; buildHouseViewBar();
    document.getElementById('projName').textContent = project.name;
    renderTileFolders();
    refreshPalette();
    view.zoom=1; view.panX=0; view.panY=0;
    resizeCanvas();
    updateLayersBtnLabel();
    renderLayersStrip();
  }
  function createProject(name){
    flushSaveActiveProject(); // не втратити останні дебаунснуті зміни попереднього проєкту
    var id = 'proj_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
    project = { id:id, name:name, gridType:'iso', cellSize:64, tiles:{}, placements:[], collisions:[], spawns:[],
      layers:[{id:'default', name:t('layerDefaultName')+' 1', visible:true, locked:false, baseZ:LAYER_Z_STEP}], activeLayerId:'default', autotileGroups:[],
      tileFolders:[] };
    activeFolderId = null;
    undoMgr.reset(); scheduleUndoWarm(); clipboard = null; currentStamp = null;
    activeTileId = null; selected = null; spawnIdCounter = 1;
    houseView.enabled = false; houseView.group = null; buildHouseViewBar();
    document.getElementById('projName').textContent = name;
    renderTileFolders();
    refreshPalette();
    view.zoom=1; view.panX=0; view.panY=0;
    saveActiveProject();
    resizeCanvas();
    updateLayersBtnLabel();
    renderLayersStrip();
  }
  function tryRestoreLast(){
    var activeId = localStorage.getItem(ACTIVE_KEY);
    if(activeId){
      loadProjectDataById(activeId).then(function(data){
        if(data){ loadProjectData(data); } else { createProject('Map 1'); }
      }).catch(function(err){ console.error('TileWeaver: restore failed:', err); createProject('Map 1'); });
      return;
    }
    createProject('Map 1');
  }
  function openProjects(){ flushSaveActiveProject(); renderProjectsList(); projectsModal.style.display='flex'; }
  // ---------- Експорт у файл ----------
  // Прибрав File System Access API (showSaveFilePicker) — на мобільних браузерах (Android/iOS,
  // включно з тим, де це тестувалось) його просто нема, тож код ЗАВЖДИ провалювався у fallback
  // і завжди качав новий файл — тобто "перезапис" ніколи реально не працював на телефоні, а
  // лише додавав складність і ще один шлях, де щось могло піти не так під час запису. Тепер
  // залишився один простий, передбачуваний спосіб: завжди звичайне завантаження через Blob.
  // Чесно кажучи, "перезаписати той самий файл" із звичайної вебсторінки на телефоні без цього
  // API неможливо в принципі — це обмеження браузера, а не щось, що можна обійти кодом.
  function exportToFile(){
    flushSaveActiveProject();
    var data = serializeProject();
    var json = JSON.stringify(data);
    // Перевіряємо сам себе ДО завантаження: якщо серіалізація раптом дала щось, що не
    // парситься назад — краще впасти тут з чіткою помилкою, ніж віддати користувачу файл,
    // який потім "пошкоджений" без жодного пояснення чому.
    try{ JSON.parse(json); }
    catch(selfErr){ alert('Внутрішня помилка серіалізації проєкту: '+selfErr.message+'. Файл НЕ збережено, напиши про це.'); return; }
    var safeName = (project.name||'project').replace(/[^a-zA-Zа-яА-Яіїєґ0-9_-]+/gi,'_');
    var blob = new Blob([json], {type:'application/json'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = 'tileweaver_'+safeName+'.json';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 4000);
    toast(t('toastFileSavedCheck'));
  }
  function renderProjectsList(){
    var idx = getIndex().sort(function(a,b){return b.updatedAt-a.updatedAt;});
    projList.innerHTML = '';
    idx.forEach(function(p){
      var row = document.createElement('div'); row.className='proj-item';
      var d = new Date(p.updatedAt);
      row.innerHTML = '<div><div class="pname">'+escHtml(p.name)+(p.id===project.id?' •':'')+'</div><div class="pdate">'+d.toLocaleDateString()+'</div></div>'+
        '<button data-act="open">'+t('openBtn')+'</button><button data-act="ren">'+t('renameBtn')+'</button><button data-act="del">'+t('delProjBtn')+'</button>';
      row.querySelector('[data-act="open"]').addEventListener('click', function(){
        loadProjectDataById(p.id).then(function(data){
          if(data){ loadProjectData(data); projectsModal.style.display='none'; }
        });
      });
      row.querySelector('[data-act="ren"]').addEventListener('click', function(){
        var nn = prompt(t('nameLabel'), p.name);
        if(nn){
          p.name = nn; setIndex(idx);
          if(p.id===project.id){ project.name=nn; document.getElementById('projName').textContent=nn; }
          idbRenameProject(p.id, nn);
          renderProjectsList();
        }
      });
      row.querySelector('[data-act="del"]').addEventListener('click', function(){
        if(!confirm(t('confirmDelProj'))) return;
        idbDeleteProject(p.id);
        localStorage.removeItem(projectKey(p.id)); // прибираємо й старий (до-IndexedDB) запис, якщо був
        setIndex(getIndex().filter(function(x){return x.id!==p.id;}));
        if(p.id===project.id) tryRestoreOrNew();
        renderProjectsList();
      });
      projList.appendChild(row);
    });
  }
  function tryRestoreOrNew(){
    var idx = getIndex();
    if(idx.length){
      loadProjectDataById(idx[0].id).then(function(data){
        if(data){ loadProjectData(data); } else { createProject('Map 1'); }
      });
      return;
    }
    createProject('Map 1');
  }
