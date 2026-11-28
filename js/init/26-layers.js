/* js/init/26-layers.js — Код запуску теми: Шари та стрічка шарів. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- Стрічка шарів (як в Pixel Studio) ----------
  layersStrip = document.getElementById('layersStrip');
  layerPopup = document.getElementById('layerPopup');

  document.addEventListener('click', function(e){
    if(layerPopup.style.display==='block' && !layerPopup.contains(e.target) && e.target.textContent!=='⚙' && e.target.id!=='langBtn') hideLayerPopup();
  });
