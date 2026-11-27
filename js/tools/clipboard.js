/* js/tools/clipboard.js — Копіювати / вставити.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function updatePasteBtn(){ if(pasteBtn) pasteBtn.disabled = !clipboard; }
  function doPaste(){
    if(!clipboard) return;
    var actLyr = getLayer(project.activeLayerId);
    if(actLyr.locked) { toast(t('toastLayerLocked')); return; }
    var r = wrap.getBoundingClientRect();
    var center = screenToWorld(r.width/2, r.height/2);
    if(snapOn){ var sp = snapPoint(center.x, center.y); center = sp; }
    pushUndo();
    if(clipboard.type==='single'){
      var np = { id:'p'+(placeIdCounter++), tileId:clipboard.tileId, x:px(center.x), y:px(center.y), z:clipboard.z, layerId:project.activeLayerId, scaleX:clipboard.scaleX, scaleY:clipboard.scaleY, flipX:clipboard.flipX, flipY:clipboard.flipY, rotation:clipboard.rotation, skewX:clipboard.skewX };
      if(clipboard.group!=null) np.group = clipboard.group;
      if(clipboard.floor!=null) np.floor = clipboard.floor;
      if(clipboard.isRoof) np.isRoof = true;
      project.placements.push(np);
      selected = {type:'placement', id:np.id};
    } else if(clipboard.type==='multi'){
      var newIds = [];
      // Та сама причина, що й у штампі вище: кожна вставка — це нова копія будинку, не той
      // самий будинок. Свіжа мапа старе→нове ім'я групи на кожен doPaste(), інакше друга
      // вставка того самого буфера обміну знову приклеїлась б до групи попередньої вставки.
      var groupRemap = {};
      clipboard.items.forEach(function(it){
        var np2 = { id:'p'+(placeIdCounter++), tileId:it.tileId, x:px(center.x+it.dx), y:px(center.y+it.dy), z:it.z, layerId:project.activeLayerId, scaleX:it.scaleX, scaleY:it.scaleY, flipX:it.flipX, flipY:it.flipY, rotation:it.rotation, skewX:it.skewX };
        if(it.group!=null){
          if(!groupRemap[it.group]) groupRemap[it.group] = 'house_'+Date.now()+'_'+Math.random().toString(36).slice(2,7);
          np2.group = groupRemap[it.group];
        }
        if(it.floor!=null) np2.floor = it.floor;
        if(it.isRoof) np2.isRoof = true;
        project.placements.push(np2); newIds.push(np2.id);
      });
      var xs = clipboard.items.map(function(it){return center.x+it.dx;});
      var ys = clipboard.items.map(function(it){return center.y+it.dy;});
      // groupRemap має рівно один ключ, якщо всі вставлені тайли належали ОДНІЙ спільній
      // групі — тоді одразу позначаємо це як будинок, і Поверх/Дах будуть видні одразу
      // після вставки, а не тільки після ручного повторного натискання "Група".
      var remapKeys = Object.keys(groupRemap);
      var pastedHouseGroup = (remapKeys.length===1 && newIds.length===clipboard.items.length) ? groupRemap[remapKeys[0]] : null;
      selected = {type:'multi', ids:newIds, minX:Math.min.apply(null,xs), maxX:Math.max.apply(null,xs), minY:Math.min.apply(null,ys), maxY:Math.max.apply(null,ys), houseGroup:pastedHouseGroup};
    }
    render(); saveActiveProject(); toast(t('toastPasted'));
    tool = 'pan'; updateToolButtons();
  }
