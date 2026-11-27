/* js/init/03-panel-settings.js — Код запуску теми: Налаштування панелі дій (порядок значків у сітці 3×5). Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */

  // ---------- Налаштування панелі дій (порядок значків у сітці 3×5) ----------
  var panelSettingsModal = document.getElementById('panelSettingsModal');
  var poPick = null;
  document.getElementById('menuPanelSettings').addEventListener('click', function(){
    menuSheet.style.display='none';
    poPick = null; renderPanelSettings();
    panelSettingsModal.style.display='flex';
  });
  document.getElementById('poSize').addEventListener('input', function(e){
    localStorage.setItem('zone-edit-panel-size', e.target.value); document.getElementById('poSizeV').textContent = e.target.value;
    applyPanelSize(); render();
  });
  ['poGrid','poHidden'].forEach(function(id){
    document.getElementById(id).addEventListener('click', function(e){ var b = e.target.closest('button[data-k]'); if(b) poTap(b.getAttribute('data-k')); });
  });
  document.getElementById('panelOrderReset').addEventListener('click', function(){
    setPanelOrder(PANEL_DEFAULT_ORDER.slice()); setPanelHidden([]); poPick = null;
    renderPanelSettings();
  });
  document.getElementById('panelSettingsClose').addEventListener('click', function(){
    panelSettingsModal.style.display='none';
    render(); // якщо зараз щось виділене — одразу перемалювати панель під новий порядок
  });
  document.getElementById('autotileListClose').addEventListener('click', function(){ autotileListModal.style.display='none'; });
  document.getElementById('autotileAddGroup').addEventListener('click', function(){ openAutotileEditor(null); });
  document.getElementById('autotileEditorCancel').addEventListener('click', function(){ autotileEditorModal.style.display='none'; autotileListModal.style.display='flex'; });
  document.getElementById('autotileTilePickerClose').addEventListener('click', function(){ autotileTilePickerModal.style.display='none'; });
  document.getElementById('autotileEditorDelete').addEventListener('click', function(){
    if(!autotileEditingId) return;
    if(!confirm(t('confirmDeleteThisGroup'))) return;
    project.autotileGroups = project.autotileGroups.filter(function(g){ return g.id!==autotileEditingId; });
    saveActiveProject();
    autotileEditorModal.style.display='none';
    openAutotileList();
  });
  document.getElementById('autotileEditorSave').addEventListener('click', function(){
    var name = document.getElementById('autotileGroupName').value.trim() || 'Група';
    var required = ['TL','TR','BR','BL','N','E','S','W'];
    var missing = required.filter(function(k){ return !autotileEditingSlots[k]; });
    if(missing.length){ toast(t('toastFillCorners').replace('{n}', missing.length)); return; }
    var g = {
      id: autotileEditingId || ('at_'+Date.now()),
      name: name, gridType: 'iso',
      corners: { TL:autotileEditingSlots.TL, TR:autotileEditingSlots.TR, BR:autotileEditingSlots.BR, BL:autotileEditingSlots.BL },
      edges: { N:autotileEditingSlots.N, E:autotileEditingSlots.E, S:autotileEditingSlots.S, W:autotileEditingSlots.W }
    };
    if(autotileEditingId){
      var idx = project.autotileGroups.findIndex(function(x){return x.id===autotileEditingId;});
      if(idx>=0) project.autotileGroups[idx] = g; else project.autotileGroups.push(g);
    } else {
      project.autotileGroups.push(g);
    }
    saveActiveProject();
    toast(t('toastGroupSaved'));
    autotileEditorModal.style.display='none';
    openAutotileList();
  });
