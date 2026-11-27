/* js/ui/menu.js — Нижнє меню (bottom sheet).
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function populateSpriteImportFolderSelect(){
    var sel = document.getElementById('spriteImportFolder');
    sel.innerHTML = '';
    project.tileFolders.forEach(function(f){
      var opt = document.createElement('option'); opt.value=f.id; opt.textContent=folderPathLabel(f.id);
      if(f.id===activeFolderId) opt.selected = true;
      sel.appendChild(opt);
    });
  }
