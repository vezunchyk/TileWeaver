/* js/init/23-clipboard.js — Код запуску теми: Копіювати / вставити. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- Копіювати / Вставити ----------
  pasteBtn = document.getElementById('pasteBtn');
  if(pasteBtn) pasteBtn.addEventListener('click', doPaste);
  updatePasteBtn();
