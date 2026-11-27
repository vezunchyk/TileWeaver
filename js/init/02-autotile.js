/* js/init/02-autotile.js — Код запуску теми: Автотайлінг: групи, редактор, застосування до виділеної площі. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- Автотайлінг ----------
  var autotileEditingId = null; // id групи, яку редагуємо (null = нова)
  var autotileEditingSlots = {}; // {TL,TR,BR,BL,N,E,S,W} -> tileId, стан поточної сесії редагування
  var autotilePickerTarget = null;
  var autotileListModal = document.getElementById('autotileListModal');
  var autotileGroupsList = document.getElementById('autotileGroupsList');
  var autotileEditorModal = document.getElementById('autotileEditorModal');
  var autotileGrid3x3 = document.getElementById('autotileGrid3x3');
  var autotileTilePickerModal = document.getElementById('autotileTilePickerModal');
  var autotileTilePickerGrid = document.getElementById('autotileTilePickerGrid');

  // Позиції клітинок 3x3 у порядку рендеру зліва-направо, згори-вниз. Кути = 4 матеріали,
  // краї = перехід між двома СУСІДНІМИ ПО КОЛУ кутами (N між TL/TR, E між TR/BR, S між BR/BL,
  // W між BL/TL), центр — декоративний, нікуди не використовується.
  var AUTOTILE_SLOTS = [
    {key:'TL', label:'TL', type:'corner'}, {key:'N', label:'N', type:'edge'}, {key:'TR', label:'TR', type:'corner'},
    {key:'W', label:'W', type:'edge'}, {key:null, label:'', type:'center'}, {key:'E', label:'E', type:'edge'},
    {key:'BL', label:'BL', type:'corner'}, {key:'S', label:'S', type:'edge'}, {key:'BR', label:'BR', type:'corner'}
  ];
  document.getElementById('menuAutotile').addEventListener('click', function(){ menuSheet.style.display='none'; openAutotileList(); });
