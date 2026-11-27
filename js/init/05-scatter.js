/* js/init/05-scatter.js — Код запуску теми: Інструмент «Розкидати» (клон → 🌿). Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- Розкидати (Клон → 🌿 Розкидати) ----------
  var scatterSettings = { folderId:null, radius:40, frequency:50, randomFlip:true }; // памʼятається між використаннями за сесію
  var scatterSettingsModal = document.getElementById('scatterSettingsModal');
  document.getElementById('scatterSettingsCancel').addEventListener('click', function(){
    scatterSettingsModal.style.display = 'none';
    // Якщо скасував — не лишати "Клон" в режимі, для якого нема підтверджених налаштувань
    tool='place'; cloneMode='line'; updateToolButtons();
  });
  document.getElementById('scatterSettingsOk').addEventListener('click', function(){
    scatterSettings.folderId = document.getElementById('scatterFolder').value;
    scatterSettings.radius = Math.max(8, Math.min(500, parseInt(document.getElementById('scatterRadius').value)||40));
    scatterSettings.frequency = Math.max(1, Math.min(100, parseInt(document.getElementById('scatterFrequency').value)||50));
    scatterSettings.randomFlip = document.getElementById('scatterRandomFlip').checked;
    scatterSettingsModal.style.display = 'none';
    toast(t('toastNowSelectRect'));
  });
