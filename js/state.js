/* js/state.js — Глобальний стан редактора: проєкт, камера (view), інструмент, виділення, налаштування та їх початкові значення.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  document.getElementById('langBtn').addEventListener('click', function(e){
    var popup = document.getElementById('layerPopup');
    popup.innerHTML = Object.keys(LANG_NAMES).map(function(code){
      return '<button data-lang="'+code+'"'+(code===lang?' style="border-color:var(--amber);"':'')+'>'+LANG_NAMES[code]+'</button>';
    }).join('');
    var rect = e.target.getBoundingClientRect();
    popup.style.left = Math.max(4, Math.min(window.innerWidth-160, rect.left-100)) + 'px';
    popup.style.top = (rect.bottom + 6) + 'px';
    popup.style.display = 'block';
    popup.onclick = function(ev){
      var b = ev.target.closest('button'); if(!b) return;
      lang = b.dataset.lang;
      localStorage.setItem('zone-edit-lang', lang);
      applyI18n(); render();
      popup.style.display = 'none';
    };
  });

  // ---------- core state ----------
  var canvas = document.getElementById('mapCanvas');
  var ctx = canvas.getContext('2d');
  var wrap = document.getElementById('canvasWrap');
  var offCanvas = document.createElement('canvas');
  var offCtx = offCanvas.getContext('2d');
  offCtx.imageSmoothingEnabled = false;
  var TILE_W = 64, TILE_H = 32;
  var isoGridCanvas = document.createElement('canvas');
  isoGridCanvas.width = 64; isoGridCanvas.height = 32;
  var gCtx = isoGridCanvas.getContext('2d');
  gCtx.fillStyle = 'rgba(90,100,70,0.9)'; // Колір твоєї сітки
  for (var i = 0; i <= 30; i++) {
    var y = Math.floor((i + 1) / 2);
    gCtx.fillRect(32 + i, y, 1, 1); // Права ідеальна грань
    gCtx.fillRect(31 - i, y, 1, 1); // Ліва ідеальна грань
  }
  
  var LAYER_Z_STEP = 10;
  var project = { id:null, name:'', gridType:'iso', cellSize:64, tiles:{}, placements:[], collisions:[], spawns:[],
    layers:[{id:'default', name:t('layerDefaultName')+' 1', visible:true, locked:false, baseZ:LAYER_Z_STEP}], activeLayerId:'default', autotileGroups:[],
    tileFolders:[] };
  var activeFolderId = null;
  var tileIdCounter = 1, placeIdCounter = 1, colIdCounter = 1, spawnIdCounter = 1;
  var view = { zoom:1, panX:0, panY:0 };
  var showGrid = true, showCollisions = true, snapOn = true;
  var tool = 'place'; // place | pan | collision | clone | spawn
  // Режим перегляду будинку — стан РЕДАКТОРА, а не даних проєкту. Належність до будинку
  // (group/floor/isRoof) зберігається в самих placement, тут лише "що зараз показувати
  // напівпрозорим", щоб можна було бачити крізь поверхи під час розстановки меблів/декору.
  // Свідомо НЕ чіпає p.z і не змінює порядок рендеру — тільки alpha в момент малювання.
  var houseView = { enabled:false, group:null, activeFloor:0 };
  // Режим «Перегляд»: персонаж з pivot у ногах; порядок малювання — ТОЙ САМИЙ, що в грі (див. README гри).
  var PV_ACTOR = { pvActor:true };
  var pvs = { on:false, x:0, y:0, floor:1, savedTool:null, fallback:false, inside:[], info:'' };
  var pvTileGround = null;
  var collisionMode = 'texture';
  var collisionType = 'solid'; var collisionFloor = 1, colSelectMode = false, colMulti = {}; // solid | trigger | floorTransition — ЩО за колізія, окремо від того, ЯКОЮ ФОРМОЮ її малюють (collisionMode)
  var cloneMode = 'line';
  var cloneDir = null; // {dc,dr}
  var cloneAnchor = null; // world point
  var activeTileId = null;
  var selected = null;
  var clipboard = null;
  var currentStamp = null; // {items:[{tileId,dx,dy,z,scaleX,scaleY,flipX,flipY,rotation,skewX}]} — заповнюється кнопкою "Зберегти як штамп" на панелі групового виділення, використовується інструментом Клон → Штамп. Сесійний стан, не зберігається в проєкті (як і clipboard). Раніше сюди не потрапляли flipY/rotation/skewX — тому скопійований/проштампований обʼєкт втрачав поворот/нахил/віддзеркалення по вертикалі при вставці.
  // Undo/redo на патчах — див. js/undo.js (зберігає лише змінене, а не повні знімки проєкту)
  var undoMgr = TWUndo.create({ project: function(){ return project; } });
  var undoWarmHandle = null;
  window.addEventListener('resize', resizeCanvas);
