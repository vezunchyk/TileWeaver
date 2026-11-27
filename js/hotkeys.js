/* js/hotkeys.js — Гарячі клавіші.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  // ---------- Гарячі клавіші (Delete/Ctrl+C/Ctrl+V/стрілки/Ctrl+Z/Esc) ----------
  function copySelected(){
    if(!selected) return;
    if(selected.type==='multi'){
      var cx = (selected.minX+selected.maxX)/2, cy = (selected.minY+selected.maxY)/2;
      var items = [];
      selected.ids.forEach(function(id){
        var p = placementById(id);
        if(p) items.push({ tileId:p.tileId, z:p.z, scaleX:p.scaleX, scaleY:p.scaleY, flipX:p.flipX, flipY:p.flipY, rotation:p.rotation, skewX:p.skewX, group:p.group, floor:p.floor, isRoof:p.isRoof, dx:p.x-cx, dy:p.y-cy });
      });
      clipboard = { type:'multi', items:items };
    } else if(selected.type==='placement'){
      var p = placementById(selected.id);
      if(!p) return;
      clipboard = { type:'single', tileId:p.tileId, z:p.z, scaleX:p.scaleX, scaleY:p.scaleY, flipX:p.flipX, flipY:p.flipY, rotation:p.rotation, skewX:p.skewX, group:p.group, floor:p.floor, isRoof:p.isRoof };
    } else {
      return; // колізії поки не копіюються
    }
    clipboard.srcKey = selKey();
    updatePasteBtn();
    toast(t('toastCopied'));
    tool = 'pan'; updateToolButtons();
    render();
  }
  function deleteSelected(){
    if(!selected) return;
    pushUndo();
    if(selected.type==='multi'){
      var delIds = new Set(selected.ids); project.placements = project.placements.filter(function(p){ return !delIds.has(p.id); });
    } else if(selected.type==='placement'){
      project.placements = project.placements.filter(function(p){ return p.id!==selected.id; });
    } else if(selected.type==='collision'){
      project.collisions = project.collisions.filter(function(c){ return c.id!==selected.id; });
    } else {
      return;
    }
    selected = null;
    toast(t('toastDeleted'));
    render(); saveActiveProject();
  }
  function nudgeSelected(dx, dy){
    if(!selected || selected.type==='collision') return; // колізії поки не рухаються стрілками
    var actLyr = getLayer(project.activeLayerId);
    if(actLyr.locked) { toast(t('toastLayerLocked')); return; }
    pushUndo();
    if(selected.type==='placement'){
      var p = placementById(selected.id);
      if(!p) return;
      p.x = px(p.x+dx); p.y = px(p.y+dy);
    } else if(selected.type==='multi'){
      selected.ids.forEach(function(id){
        var p = placementById(id);
        if(p){ p.x = px(p.x+dx); p.y = px(p.y+dy); }
      });
      selected.minX += dx; selected.maxX += dx; selected.minY += dy; selected.maxY += dy;
    }
    render(); saveActiveProject();
  }
