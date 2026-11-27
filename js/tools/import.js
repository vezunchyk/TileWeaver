/* js/tools/import.js — Імпорт спрайтшита та дерева папок / ZIP.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  
    function resetSpriteModal(){
    spriteImg=null; spriteSelRect=null; spriteSel.style.display='none'; document.getElementById('spriteSelLabel').style.display='none';
    document.getElementById('spritePickStep').style.display='block';
    document.getElementById('spriteEditStep').style.display='none';
    
    // Скидаємо нову вкладку розумної нарізки
    var smartPanel = document.getElementById('spriteSmartPanel');
    if (smartPanel) smartPanel.style.display = 'none';
    }
