/* js/ui/selection-actions.js — Панель дій: реєстр усіх значків і їх порядок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  // Розмір кнопок панелі дій (px) — змінюється в «Налаштування панелі»
  function getPanelSize(){ var v = parseInt(localStorage.getItem('zone-edit-panel-size')); return (v >= 30 && v <= 72) ? v : 42; }
  function applyPanelSize(){ document.documentElement.style.setProperty('--selBtn', getPanelSize()+'px'); }
  // Приховані значки (окремо від порядку): не показуються в панелі дій, поки користувач їх не поверне
  function getPanelHidden(){ try{ var h = JSON.parse(localStorage.getItem('zone-edit-panel-hidden')); if(Array.isArray(h)) return h; }catch(e){} return []; }
  function setPanelHidden(h){ localStorage.setItem('zone-edit-panel-hidden', JSON.stringify(h)); }
  function getPanelOrder(){
    try{
      var saved = JSON.parse(localStorage.getItem('zone-edit-panel-order'));
      if(Array.isArray(saved) && saved.length){
        if(saved.indexOf('houseSettings') < 0){ var gi = saved.indexOf('group'); saved.splice(gi >= 0 ? gi+1 : saved.length, 0, 'houseSettings'); }
        if(saved.indexOf('anim') < 0){ var ei = saved.indexOf('eye'); saved.splice(ei >= 0 ? ei+1 : 0, 0, 'anim'); }
        return saved;
      }
    }catch(e){}
    return PANEL_DEFAULT_ORDER.slice();
  }
  function setPanelOrder(order){ localStorage.setItem('zone-edit-panel-order', JSON.stringify(order)); }
  // items: [{key, dataAct, icon, title, style, cls}] — тільки ті пункти, що АКТУАЛЬНІ зараз.
  // Розкладає їх у збереженому порядку (ключі, яких зараз нема серед items, просто пропускаються;
  // ключі, яких нема в збереженому порядку — напр. після оновлення застосунку — підуть у кінець).
  // Кнопка "Порядок" — свідомий виняток із "тільки іконка": саме число тут і Є корисною
  // інформацією (щоб бачити поточний z без відкривання діалогу), тому показуємо його
  // безпосередньо на кнопці. Якщо число задовге для 42px кнопки — обрізаємо з "…".
  function fmtZForBtn(z){
    var s = String(z);
    return s.length > 5 ? s.slice(0,4)+'…' : s;
  }
  function renderIconGrid(items){
    var order = getPanelOrder();
    var byKey = {}; items.forEach(function(it){ byKey[it.key] = it; });
    var hiddenKeys = getPanelHidden().filter(function(k){ return k !== 'eye' && k !== 'del'; });
    var ordered = [];
    order.forEach(function(k){ if(byKey[k]){ if(hiddenKeys.indexOf(k) < 0) ordered.push(byKey[k]); delete byKey[k]; } });
    items.forEach(function(it){ if(byKey[it.key]){ if(hiddenKeys.indexOf(it.key) < 0) ordered.push(it); delete byKey[it.key]; } });
    var html = ordered.map(function(it){
      var titleAttr = it.title ? ' title="'+String(it.title).replace(/"/g,'&quot;')+'"' : '';
      var styleAttr = it.style ? ' style="'+it.style+'"' : '';
      var clsAttr = it.cls ? ' class="'+it.cls+'"' : '';
      return '<button data-act="'+it.dataAct+'"'+titleAttr+styleAttr+clsAttr+'>'+it.icon+'</button>';
    }).join('');
    return '<div class="sel-grid">'+html+'</div>';
  }
