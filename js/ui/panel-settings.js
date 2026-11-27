/* js/ui/panel-settings.js — Налаштування панелі дій (порядок значків у сітці 3×5).
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function poCell(k){ return '<button class="po-cell'+(poPick===k?' pick':'')+'" data-k="'+k+'"><span class="pi">'+(PANEL_ACTION_ICONS[k]||'•')+'</span><span class="pn">'+PANEL_ACTION_NAMES[k]+'</span></button>'; }
  function poLists(){
    var allKeys = Object.keys(PANEL_ACTION_NAMES), hidden = getPanelHidden().filter(function(k){ return allKeys.indexOf(k) >= 0; });
    var order = getPanelOrder().filter(function(k){ return allKeys.indexOf(k) >= 0 && hidden.indexOf(k) < 0; });
    allKeys.forEach(function(k){ if(order.indexOf(k) < 0 && hidden.indexOf(k) < 0) order.push(k); });
    return { order:order, hidden:hidden };
  }
  function renderPanelSettings(){
    var L = poLists();
    document.getElementById('poSize').value = getPanelSize(); document.getElementById('poSizeV').textContent = getPanelSize();
    document.getElementById('poStatus').textContent = poPick ? 'Обрано: '+PANEL_ACTION_NAMES[poPick]+'. Тапни місце, куди поставити (на іншу кнопку — поміняються місцями; у «Сховані» — сховати).' : 'Тапни кнопку, потім тапни місце, куди її поставити.';
    document.getElementById('poGrid').innerHTML = L.order.map(poCell).join('') + '<button class="po-cell po-end" data-k="__end"><span class="pi">＋</span><span class="pn">в кінець</span></button>';
    document.getElementById('poHidden').innerHTML = L.hidden.map(poCell).join('') + '<button class="po-cell po-end" data-k="__hide"><span class="pi">🙈</span><span class="pn">сюди — сховати</span></button>';
  }
  function poTap(k){
    var L = poLists(), order = L.order, hidden = L.hidden;
    if(!poPick){ if(k.indexOf('__') !== 0) poPick = k; renderPanelSettings(); return; }
    var pk = poPick, pIn = order.indexOf(pk) >= 0, kIn = order.indexOf(k) >= 0;
    if(pk === k){ poPick = null; renderPanelSettings(); return; }
    function removeEverywhere(){ order = order.filter(function(x){ return x !== pk; }); hidden = hidden.filter(function(x){ return x !== pk; }); }
    if(k === '__end'){ removeEverywhere(); order.push(pk); }
    else if(k === '__hide'){ if(pk === 'eye' || pk === 'del'){ toast('Цю кнопку не можна ховати'); poPick = null; renderPanelSettings(); return; } removeEverywhere(); hidden.push(pk); }
    else if(pIn && kIn){ var i1 = order.indexOf(pk), i2 = order.indexOf(k); order[i1] = k; order[i2] = pk; }
    else if(!pIn && kIn){ removeEverywhere(); order.splice(order.indexOf(k), 0, pk); }
    else if(pIn && !kIn){ if(pk === 'eye' || pk === 'del'){ toast('Цю кнопку не можна ховати'); poPick = null; renderPanelSettings(); return; } removeEverywhere(); hidden.push(pk); }
    else { poPick = k; renderPanelSettings(); return; }
    setPanelOrder(order); setPanelHidden(hidden); poPick = null; renderPanelSettings();
  }
