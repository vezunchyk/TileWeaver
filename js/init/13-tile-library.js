/* js/init/13-tile-library.js — Код запуску теми: Палітра тайлів, папки й підпапки текстур, переміщення між папками, теги. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- palette ----------
  paletteEl = document.getElementById('palette');
  addTileBtn = document.getElementById('addTileBtn');
  tileFileInput = document.getElementById('tileFileInput');
  addTileBtn.addEventListener('click', function(){ tileFileInput.click(); });
  tileFileInput.addEventListener('change', function(e){
    var files = Array.from(e.target.files);
    var remaining = files.length;
    files.forEach(function(file){
      var reader = new FileReader();
      reader.onload = function(){
        addTileFromDataURL(file.name.replace(/\.[^.]+$/,''), reader.result);
        remaining--;
        if(remaining<=0) saveActiveProject();
      };
      reader.readAsDataURL(file);
    });
    tileFileInput.value = '';
  });
  groundFracCache = {};

  // ---------- Папки текстур ----------
  tileFoldersEl = document.getElementById('tileFolders');
  folderMenuModal = document.getElementById('folderMenuModal');
  folderMenuTargetId = null;
  // ---------- Режим переміщення текстур між папками ----------
  // "⇄" у стрічці папок вмикає режим вибору: тап по тайлу більше не ставить його активним
  // для малювання, а ставить/знімає галочку. Поки режим активний, замінюємо звичайну
  // навігацію папками на панель "Скасувати / Вибрано N / Перемістити" — вибір діє лише в
  // МЕЖАХ поточної папки (щоб перемістити з кількох папок одразу — заходь і вибирай у
  // кожній по черзі, це і простіше, і безпечніше за "вибір крізь усе дерево папок").
  moveMode = false;
  moveSelected = {};
  document.getElementById('moveModeCancel').addEventListener('click', exitMoveMode);
  document.getElementById('moveModeGo').addEventListener('click', function(){
    var ids = Object.keys(moveSelected);
    if(!ids.length){ toast('Спершу познач хоч одну текстуру галочкою'); return; }
    openMoveToFolderPicker(ids);
  });
  document.getElementById('moveToFolderCancel').addEventListener('click', function(){
    document.getElementById('moveToFolderModal').style.display = 'none';
  });
  document.getElementById('folderMenuClose').addEventListener('click', function(){ folderMenuModal.style.display='none'; });
  document.getElementById('folderMenuRename').addEventListener('click', function(){
    var f = project.tileFolders.find(function(x){return x.id===folderMenuTargetId;});
    if(!f) return;
    var nn = prompt(t('promptRenameFolderName'), f.name);
    if(nn){ f.name = nn.trim() || f.name; saveActiveProject(); renderTileFolders(); }
    folderMenuModal.style.display = 'none';
  });
  document.getElementById('folderMenuDelete').addEventListener('click', function(){
    var f = project.tileFolders.find(function(x){return x.id===folderMenuTargetId;});
    if(!f) return;
    // Збираємо папку + УСІ її підпапки (на будь-яку глибину)
    var delFolders = {}; delFolders[f.id] = true;
    var grew = true;
    while(grew){
      grew = false;
      project.tileFolders.forEach(function(x){
        if(x.parentId && delFolders[x.parentId] && !delFolders[x.id]){ delFolders[x.id] = true; grew = true; }
      });
    }
    // Тайли з цих папок
    var delTiles = {};
    Object.keys(project.tiles).forEach(function(tid){
      if(delFolders[project.tiles[tid].folderId]) delTiles[tid] = true;
    });
    var nTiles = Object.keys(delTiles).length;
    var nSub = Object.keys(delFolders).length - 1;
    var nPlaced = project.placements.filter(function(p){ return delTiles[p.tileId]; }).length;
    var msg = 'Видалити папку "' + f.name + '" разом з усім вмістом?\n\n' +
      'Тайлів: ' + nTiles + (nSub ? '\nПідпапок: ' + nSub : '') +
      '\nОбʼєктів на карті: ' + nPlaced + '\n\nЦе не можна скасувати.';
    if(!confirm(msg)) { folderMenuModal.style.display='none'; return; }
    // Видаляємо розміщення на карті, потім самі тайли
    project.placements = project.placements.filter(function(p){ return !delTiles[p.tileId]; });
    Object.keys(delTiles).forEach(function(tid){ delete project.tiles[tid]; });
    // Прибираємо видалені тайли з груп автотайлінгу
    (project.autotileGroups || []).forEach(function(g){
      ['corners','edges'].forEach(function(k){
        if(!g[k]) return;
        Object.keys(g[k]).forEach(function(slot){ if(delTiles[g[k][slot]]) g[k][slot] = null; });
      });
    });
    // Видаляємо самі папки
    project.tileFolders = project.tileFolders.filter(function(x){ return !delFolders[x.id]; });
    if(activeTileId && delTiles[activeTileId]) activeTileId = null;
    if(activeFolderId && delFolders[activeFolderId]) activeFolderId = f.parentId || null;
    selected = null;
    saveActiveProject();
    renderTileFolders();
    refreshPalette();
    render();
    folderMenuModal.style.display = 'none';
  });

  // ---------- Теги (ярлики) + База даних груп ----------
  tagTarget = null; // {kind:'placement'|'tile'|'folder', id}
  tagModalEl = document.getElementById('tagModal'), tagInputEl = document.getElementById('tagInput');
  document.getElementById('tagOk').addEventListener('click', function(){ applyTag(tagInputEl.value); });
  document.getElementById('tagClear').addEventListener('click', function(){ applyTag(''); });
  document.getElementById('tagCancel').addEventListener('click', closeTagModal);
  tagModalEl.addEventListener('click', function(e){ if(e.target===tagModalEl) closeTagModal(); });
  tagInputEl.addEventListener('keydown', function(e){ if(e.key==='Enter'){ e.preventDefault(); applyTag(tagInputEl.value); } });
  document.getElementById('renameTagBtn').addEventListener('click', function(){ if(renameTargetId) openTagModal('tile', renameTargetId); });
  document.getElementById('folderMenuTag').addEventListener('click', function(){ openTagModal('folder', folderMenuTargetId); });

  // База даних: таблиця існуючих груп (будинків) — назва, координати центру, кнопка «Перенести»
  dbRows = [];
  document.getElementById('dbGroupsBody').addEventListener('click', function(e){
    var b = e.target.closest('button[data-goto]'); if(!b) return;
    var g = dbRows[parseInt(b.dataset.goto, 10)]; if(!g) return;
    var r = wrap.getBoundingClientRect();
    view.panX = Math.round(r.width/2 - g.cx*view.zoom);
    view.panY = Math.round(r.height/2 - g.cy*view.zoom);
    document.getElementById('dbModal').style.display = 'none';
    toast('Група «'+g.name+'»');
    render();
  });
  document.getElementById('dbClose').addEventListener('click', function(){ document.getElementById('dbModal').style.display = 'none'; });
  document.getElementById('menuDb').addEventListener('click', function(){ document.getElementById('menuSheet').style.display = 'none'; openDb(); });

  renameModal = document.getElementById('renameModal');
  renameInput = document.getElementById('renameInput');
  renameTargetId = null;
  pendingPivotX = 0.5, pendingPivotY = 0.5;
  pendingVariableFrames = null; // масив {x,w,pivotX,pivotY} під час редагування тайла в renameModal — комітиться в tile.frames лише по "OK"
  pivotPickerImg = document.getElementById('pivotPickerImg');
  pivotPickerDot = document.getElementById('pivotPickerDot');
  pivotPickerWrap = document.getElementById('pivotPickerWrap');
