/* js/init/16-toolbar.js — Код запуску теми: Панелі режимів, інструменти, налаштування сітки. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- mode bars ----------
  modeBar = document.getElementById('modeBar');
  cloneLineBar = document.getElementById('cloneLineBar');
  DIRS = [ ['↖',-1,-1],['↑',0,-1],['↗',1,-1],['←',-1,0],['→',1,0],['↙',-1,1],['↓',0,1],['↘',1,1] ];
  cloneCount = 5;
  cloneBlockW = 4, cloneBlockH = 10;

  // ---------- tools ----------
    toolPlace = document.getElementById('toolPlace'), toolPan = document.getElementById('toolPan'), toolCollision = document.getElementById('toolCollision'), toolClone = document.getElementById('toolClone'), toolSelect = document.getElementById('toolSelect'), toolSpawn = document.getElementById('toolSpawn'); // НОВА ЗМІННА
  
  areaSelect = null; // Для малювання рамки
  dragOrigins = null;

  // СЛУХАЧ ДЛЯ НОВОЇ КНОПКИ
  toolSelect.addEventListener('click', function(){ tool='select'; selected=null; cloneAnchor=null; updateToolButtons(); render(); });
  
  toolPlace.addEventListener('click', function(){ tool='place'; selected=null; cloneAnchor=null; updateToolButtons(); render(); });
  toolPan.addEventListener('click', function(){ tool='pan'; selected=null; cloneAnchor=null; updateToolButtons(); render(); });
  toolCollision.addEventListener('click', function(){ tool='collision'; selected=null; cloneAnchor=null; updateToolButtons(); render(); });
  toolClone.addEventListener('click', function(){ tool='clone'; selected=null; updateToolButtons(); render(); });
  toolSpawn.addEventListener('click', function(){ tool='spawn'; selected=null; cloneAnchor=null; showCollisions=true; updateToolButtons(); render(); });
  helpModal = document.getElementById('helpModal');
  
  document.getElementById('helpClose').addEventListener('click', function(){ helpModal.style.display='none'; });
  helpModal.addEventListener('click', function(e){ if(e.target===helpModal) helpModal.style.display='none'; });
  document.getElementById('btnUndo').addEventListener('click', undo);
  document.getElementById('btnRedo').addEventListener('click', redo);
  document.getElementById('gridToggle').addEventListener('click', function(e){ showGrid=!showGrid; e.currentTarget.classList.toggle('active', showGrid); render(); });
  document.getElementById('colViewToggle').addEventListener('click', function(e){ showCollisions=!showCollisions; e.currentTarget.classList.toggle('active', showCollisions); render(); });
  document.getElementById('snapToggle').addEventListener('click', function(e){ snapOn=!snapOn; e.currentTarget.classList.toggle('active', snapOn); });
  document.getElementById('zoomIn').addEventListener('click', function(){ view.zoom=Math.min(32, view.zoom*1.2); render(); });
  document.getElementById('zoomOut').addEventListener('click', function(){ view.zoom=Math.max(0.15, view.zoom/1.2); render(); });
  document.getElementById('fitBtn').addEventListener('click', fitToScreen);
  

  // ---------- grid settings ----------
  gridSettingsModal = document.getElementById('gridSettingsModal');
  document.querySelectorAll('.grid-type-row button').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.grid-type-row button').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active');
      b.dataset.selectedType = b.dataset.type;
    });
  });
  document.getElementById('gridSettingsOk').addEventListener('click', function(){
    var chosen = document.querySelector('.grid-type-row button.active');
    project.gridType = chosen ? chosen.dataset.type : project.gridType;
    project.cellSize = parseInt(document.getElementById('cellSizeInput').value)||64;
    project.gridOver = document.getElementById('gridOverInput').checked;
    project.gridColor = document.getElementById('gridColorInput').value || '#5a6446';
    gridSettingsModal.style.display='none';
    render(); saveActiveProject();
  });
