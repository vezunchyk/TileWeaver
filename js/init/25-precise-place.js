/* js/init/25-precise-place.js — Код запуску теми: Панель точного розміщення (🎯). Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- Панель точного розміщення (🎯) ----------
  // Два режими руху, як просив користувач:
  //  · "Клітинка" — крок = рівно одна клітинка активної сітки (той самий вектор, що й
  //    cellToWorld(1,0)/(0,1) — тобто справжня ізо-клітинка, а не квадрат на екрані).
  //  · "Піксель" — крок = 1/2/4/8 world-пікселів НАПРЯМУ, як snapPoint уже округлює
  //    координати розміщення — тобто узгоджено з тим, як узагалі зберігаються placements.
  // Довге утримання кнопки повторює крок кожні 90мс (після невеликої затримки), короткий тап — один крок.
  precisionOpen = false;
  precMode = 'cell'; // 'cell' | 'pixel'
  precStep = 2;
  precisionPanelEl = document.getElementById('precisionPanel');
  document.getElementById('precClose').addEventListener('click', closePrecisionPanel);
  document.getElementById('precModeMagnet').addEventListener('click', function(){
    precMode = 'cell';
    this.classList.add('active'); document.getElementById('precModePixel').classList.remove('active');
    document.getElementById('precStepRow').style.display = 'none';
  });
  document.getElementById('precModePixel').addEventListener('click', function(){
    precMode = 'pixel';
    this.classList.add('active'); document.getElementById('precModeMagnet').classList.remove('active');
    document.getElementById('precStepRow').style.display = 'flex';
  });
  Array.prototype.forEach.call(document.querySelectorAll('.prec-step'), function(btn){
    btn.addEventListener('click', function(){
      precStep = parseInt(btn.dataset.step);
      Array.prototype.forEach.call(document.querySelectorAll('.prec-step'), function(b){ b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });
  precRepeatTimer = null, precRepeatDelay = null;
  precBindDpad('precUp','up'); precBindDpad('precDown','down');
  precBindDpad('precLeft','left'); precBindDpad('precRight','right');
  window.addEventListener('keydown', function(e){
    var tag = (e.target && e.target.tagName) || '';
    if(tag==='INPUT' || tag==='TEXTAREA' || (e.target && e.target.isContentEditable)) return; // не заважати вводу тексту
    var mod = e.ctrlKey || e.metaKey;
    if(mod && e.key.toLowerCase()==='z'){ e.preventDefault(); if(e.shiftKey) redo(); else undo(); return; }
    if(mod && e.key.toLowerCase()==='y'){ e.preventDefault(); redo(); return; }
    if(mod && e.key.toLowerCase()==='c'){ e.preventDefault(); copySelected(); return; }
    if(mod && e.key.toLowerCase()==='v'){ e.preventDefault(); doPaste(); return; }
    if(e.key==='Delete' || e.key==='Backspace'){ e.preventDefault(); deleteSelected(); return; }
    if(e.key==='Escape'){ selected = null; render(); return; }
    var step = e.shiftKey ? 10 : 1;
    if(e.key==='ArrowLeft'){ e.preventDefault(); nudgeSelected(-step, 0); return; }
    if(e.key==='ArrowRight'){ e.preventDefault(); nudgeSelected(step, 0); return; }
    if(e.key==='ArrowUp'){ e.preventDefault(); nudgeSelected(0, -step); return; }
    if(e.key==='ArrowDown'){ e.preventDefault(); nudgeSelected(0, step); return; }
  });
