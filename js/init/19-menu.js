/* js/init/19-menu.js — Код запуску теми: Нижнє меню (bottom sheet). Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- file export/import ----------
  // Стара окрема модалка "ФАЙЛ" (fileModal) з власними exportBtn/importBtn/loadFileInput —
  // прибрана: це був дублюючий, менш надійний шлях експорту/імпорту (без чищення BOM, без
  // самоперевірки JSON перед завантаженням), що існував ПАРАЛЕЛЬНО з Проєкти → Експорт/Імпорт.
  // Пункт меню "Файл" тепер веде просто в Проєкти (openProjects) — див. вище, де menuFile.

  // ---------- bottom sheet menu ----------
  menuSheet = document.getElementById('menuSheet');
  document.getElementById('btnMenu').addEventListener('click', function(){ menuSheet.style.display='block'; });
  document.getElementById('menuClose').addEventListener('click', function(){ menuSheet.style.display='none'; });
  menuSheet.addEventListener('click', function(e){ if(e.target===menuSheet) menuSheet.style.display='none'; });
  document.getElementById('menuProjects').addEventListener('click', function(){ menuSheet.style.display='none'; openProjects(); });
  document.getElementById('menuFile').addEventListener('click', function(){ menuSheet.style.display='none'; openProjects(); });
  document.getElementById('menuSprite').addEventListener('click', function(){ menuSheet.style.display='none'; resetSpriteModal(); populateSpriteImportFolderSelect(); spriteModal.style.display='flex'; });
  document.getElementById('menuGrid').addEventListener('click', function(){ menuSheet.style.display='none'; openGridSettings(); });
  document.getElementById('menuMinimap').addEventListener('click', function(){
    showMinimap = !showMinimap;
    document.getElementById('menuMinimapCheck').textContent = showMinimap ? '☑' : '☐';
    if(showMinimap) minimapDirty = true; // щойно ввімкнули — перемалювати кеш з нуля, раптом карта змінювалась поки мінімапа була вимкнена
    render();
    menuSheet.style.display='none';
  });
