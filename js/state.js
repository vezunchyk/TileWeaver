/* js/state.js — Глобальний стан редактора: проєкт, камера (view), інструмент, виділення, налаштування та їх початкові значення.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */

/* Оголошення всіх змінних верхнього рівня (були «підняті» в єдиному скрипті). Присвоєння — на місцях, у порядку запуску.
   Завдяки цьому жоден код, що спрацює між завантаженням файлів, не отримає ReferenceError. */
var ACTIVE_KEY, AUTOTILE_DIRS, AUTOTILE_SLOTS, BLANK_PNG, DIRS, EDGE_ANCHOR_LABELS, EYE_BTN_HTML;
var FM_PREV_SIZES, FM_ZOOM_MAX, FM_ZOOM_MIN, IDB_NAME, IDB_STORE, IDX_KEY, IMG_PREFIX, ISO_ASYM_BASE;
var ISO_ASYM_COL, ISO_ASYM_MASK_H, ISO_ASYM_MASK_RUNS, ISO_ASYM_MASK_W, ISO_ASYM_ROW, ISO_ASYM_TILE_COL;
var ISO_ASYM_TILE_ROW, ISO_PIXEL_BASE, ISO_PIXEL_MASK_H, ISO_PIXEL_MASK_RUNS, ISO_PIXEL_MASK_W, LAYER_Z_STEP;
var LP_ZOOM_MAX, LP_ZOOM_MIN, MINIMAP_CSS_SIZE, PANEL_ACTION_ICONS, PANEL_ACTION_NAMES, PANEL_DEFAULT_ORDER;
var PERF, PIVOT_PAD, PV_ACTOR, PV_H, PV_HALF_W, SH_DIRS, SPAWN_R, THRESH, TILE_H, TILE_W, activeFolderId;
var activeTileId, addTileBtn, alphaCache, animPlay, animStartTime, animTapTarget, animTickTimer, animUiOn;
var areaSelect, autotileEditingId, autotileEditingSlots, autotileEditorModal, autotileGrid3x3;
var autotileGroupsList, autotileListModal, autotilePickerTarget, autotileTilePickerGrid;
var autotileTilePickerModal, canvas, clipboard, cloneAnchor, cloneBlockH, cloneBlockW, cloneCount, cloneDir;
var cloneLineBar, cloneMode, colIdCounter, colMulti, colSelectMode, collisionFloor, collisionMode;
var collisionType, ctx, currentStamp, dbRows, dragOrigin, dragOrigins, dragPts0, dragRectH, dragRectW;
var dragTarget, draggingPanelPos, drawingShape, edgeAnchorCenterDot, edgeAnchorDot, edgeAnchorDragging;
var edgeAnchorPoly, edgeAnchorStatus, edgeAnchorSvg, edgeAnchorUIVerts, extraHandleIds, fmCanvasWrap;
var fmChecker, fmFitCenterX, fmFitCenterY, fmFitScale, fmGesture, fmPanX, fmPanY, fmPointers, fmPrevCanvas;
var fmPrevCtx, fmPrevFitCenterX, fmPrevFitCenterY, fmPrevFitScale, fmPrevGesture, fmPrevPanX, fmPrevPanY;
var fmPrevPointers, fmPrevSize, fmPrevZoom, fmSel, fmZoom, folderMenuModal, folderMenuTargetId;
var frameMarkCanvas, frameMarkCtx, frameMarkList, frameMarkModal, frameMarkTile, gCtx, gridSettingsModal;
var groundFracCache, handleIds, helpModal, houseView, houseViewBarEl, idbPromise, idxState, imgSavedByProject;
var isoGridCanvas, lastSaveMs, layerPopup, layersStrip, livePreviewCanvas, livePreviewCtx, livePreviewPanX;
var livePreviewPanY, livePreviewPanel, livePreviewZoom, lpFitCenterX, lpFitCenterY, lpFitScale, lpGesture;
var lpGridRadius, lpPointers, lpStampCache, menuSheet, minimapBounds, minimapContent, minimapContentCtx;
var minimapCtx, minimapDirty, minimapEl, minimapModal, minimapModalBaseBounds, minimapModalCanvas;
var minimapModalCenter, minimapModalCtx, minimapModalZoom, mmDragging, mmLastX, mmLastY, mmMoved, mode;
var modeBar, moveMode, moveSelected, moved, newProjModal, offCanvas, offCtx, opqCache, paletteEl;
var panelSettingsModal, pasteBtn, pendingAnchorMode, pendingEdgeT, pendingPivotX, pendingPivotY;
var pendingVariableFrames, perfAvg, perfEl, perfFrameMs, perfIdxOn, perfLastShow, perfLastVisible, pinchStart;
var pivotDragging, pivotNudgeRepeatDelay, pivotNudgeRepeatTimer, pivotPickerDot, pivotPickerImg;
var pivotPickerWrap, placeIdCounter, placementsEpoch, poPick, pointers, precMode, precRepeatDelay;
var precRepeatTimer, precStep, precisionOpen, precisionPanelEl, projList, project, projectsModal, pvDrag;
var pvPan, pvPinch, pvPtrs, pvTileGround, pvs, renameInput, renameModal, renameTargetId, renderScheduled;
var resizeData, rotateData, rotatingId, saveDebounceTimer, saveIdleHandle, saveSeqByProject, scatterSettings;
var scatterSettingsModal, selPanel, selPanelCustomPos, selPanelHidden, selPanelJustDragged;
var selPanelPendingHtml, selPanelTouching, selected, shCache, shadowCfg, shadowFolder, shadowKeepRatio;
var shadowSel, showCollisions, showGrid, showMinimap, skewData, snapOn, spawnIdCounter, spriteFileInput;
var spriteHitCanvas, spriteImg, spriteModal, spriteSel, spriteSelRect, startPt, startWorldPt, tagInputEl;
var tagModalEl, tagTarget, tileAvgColorCache, tileFileInput, tileFoldersEl, tileIdCounter, tool, toolClone;
var toolCollision, toolPan, toolPlace, toolSelect, toolSpawn, undoMgr, undoWarmHandle, view, wrap;
var wrapRectCache;
var twBooted = false; // стає true в кінці js/init/27-core.js; до того перемальовування відкладається



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
  canvas = document.getElementById('mapCanvas');
  ctx = canvas.getContext('2d');
  wrap = document.getElementById('canvasWrap');
  offCanvas = document.createElement('canvas');
  offCtx = offCanvas.getContext('2d');
  offCtx.imageSmoothingEnabled = false;
  TILE_W = 64, TILE_H = 32;
  isoGridCanvas = document.createElement('canvas');
  isoGridCanvas.width = 64; isoGridCanvas.height = 32;
  gCtx = isoGridCanvas.getContext('2d');
  gCtx.fillStyle = 'rgba(90,100,70,0.9)'; // Колір твоєї сітки
  for (var i = 0; i <= 30; i++) {
    var y = Math.floor((i + 1) / 2);
    gCtx.fillRect(32 + i, y, 1, 1); // Права ідеальна грань
    gCtx.fillRect(31 - i, y, 1, 1); // Ліва ідеальна грань
  }
  
  LAYER_Z_STEP = 10;
  project = { id:null, name:'', gridType:'iso', cellSize:64, tiles:{}, placements:[], collisions:[], spawns:[],
    layers:[{id:'default', name:t('layerDefaultName')+' 1', visible:true, locked:false, baseZ:LAYER_Z_STEP}], activeLayerId:'default', autotileGroups:[],
    tileFolders:[] };
  activeFolderId = null;
  tileIdCounter = 1, placeIdCounter = 1, colIdCounter = 1, spawnIdCounter = 1;
  view = { zoom:1, panX:0, panY:0 };
  showGrid = true, showCollisions = true, snapOn = true;
  tool = 'place'; // place | pan | collision | clone | spawn
  // Режим перегляду будинку — стан РЕДАКТОРА, а не даних проєкту. Належність до будинку
  // (group/floor/isRoof) зберігається в самих placement, тут лише "що зараз показувати
  // напівпрозорим", щоб можна було бачити крізь поверхи під час розстановки меблів/декору.
  // Свідомо НЕ чіпає p.z і не змінює порядок рендеру — тільки alpha в момент малювання.
  houseView = { enabled:false, group:null, activeFloor:0 };
  // Режим «Перегляд»: персонаж з pivot у ногах; порядок малювання — ТОЙ САМИЙ, що в грі (див. README гри).
  PV_ACTOR = { pvActor:true };
  pvs = { on:false, x:0, y:0, floor:1, savedTool:null, fallback:false, inside:[], info:'' };
  pvTileGround = null;
  collisionMode = 'texture';
  collisionType = 'solid'; collisionFloor = 1, colSelectMode = false, colMulti = {}; // solid | trigger | floorTransition — ЩО за колізія, окремо від того, ЯКОЮ ФОРМОЮ її малюють (collisionMode)
  cloneMode = 'line';
  cloneDir = null; // {dc,dr}
  cloneAnchor = null; // world point
  activeTileId = null;
  selected = null;
  clipboard = null;
  currentStamp = null; // {items:[{tileId,dx,dy,z,scaleX,scaleY,flipX,flipY,rotation,skewX}]} — заповнюється кнопкою "Зберегти як штамп" на панелі групового виділення, використовується інструментом Клон → Штамп. Сесійний стан, не зберігається в проєкті (як і clipboard). Раніше сюди не потрапляли flipY/rotation/skewX — тому скопійований/проштампований обʼєкт втрачав поворот/нахил/віддзеркалення по вертикалі при вставці.
  // Undo/redo на патчах — див. js/undo.js (зберігає лише змінене, а не повні знімки проєкту)
  undoMgr = TWUndo.create({ project: function(){ return project; } });
  undoWarmHandle = null;
  window.addEventListener('resize', resizeCanvas);
