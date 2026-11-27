/* js/ui/layers.js — Шари та стрічка шарів.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  // ---------- ШАРИ (незалежні від z, лише видимість/блокування/організація) ----------
  function updateLayersBtnLabel(){ /* стрічка сама показує активний шар підсвіткою, окремий напис не потрібен */ }
  function hideLayerPopup(){ layerPopup.style.display='none'; }
  function renderLayersStrip(){
    layersStrip.innerHTML = '';
    var displayLayers = project.layers.slice().sort(function(a,b){ return (a.baseZ||0)-(b.baseZ||0); }); // зростання: перший створений шар — зліва, нові шари додаються ПРАВІШЕ (як у більшості редакторів)
    displayLayers.forEach(function(lyr){
      
      var btn = document.createElement('button');
      btn.className = 'layer-btn' + (lyr.id===project.activeLayerId ? ' active':'') + (!lyr.visible ? ' hidden-layer':'');
      btn.innerHTML = '<span class="lv-eye">'+(lyr.visible?'👁':'✖')+'</span>'+(lyr.locked?'<span class="lv-lock">🔒</span>':'')+'<div style="margin-top:10px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">'+escHtml(lyr.name)+'</div>';
            var moved = false, startX=0, startY=0; // Видалили lastTapT
      btn.addEventListener('pointerdown', function(e){ moved=false; startX=e.clientX; startY=e.clientY; });
      btn.addEventListener('pointermove', function(e){ if(Math.hypot(e.clientX-startX,e.clientY-startY)>8) moved=true; });
      btn.addEventListener('pointerup', function(e){
        e.preventDefault();
        if(moved) return;
        var now = Date.now();
        // Беремо таймер прямо з об'єкта шару!
        if(now - (lyr._lastTap || 0) < 350){
          pushUndo();
          lyr.visible = !lyr.visible;
          if(selected && selected.type==='placement'){ var pp=placementById(selected.id); if(pp && pp.layerId===lyr.id) selected=null; }
          lyr._lastTap = 0; // Скидаємо таймер
          saveActiveProject(); render(); renderLayersStrip();
        } else {
          project.activeLayerId = lyr.id;
          lyr._lastTap = now; // Записуємо час кліку в об'єкт
          saveActiveProject(); renderLayersStrip();
        }
      });

      layersStrip.appendChild(btn);
    });
    var addBtn = document.createElement('button');
    addBtn.className = 'add-btn'; addBtn.textContent = '+';
    addBtn.addEventListener('click', function(){
      pushUndo();
      var n = project.layers.length+1;
      var id = 'layer_'+Date.now();
      // baseZ нового шару = максимум серед ІСНУЮЧИХ ЗАРАЗ шарів + LAYER_Z_STEP. Рахується
      // щоразу наново від актуального стану — якщо, наприклад, 3-й шар (baseZ 30) видалили,
      // а лишились 1 і 2 (10, 20), новий шар отримає 30, а НЕ якесь "успадковане" число.
      var lyr = {id:id, name:t('layerDefaultName')+' '+n, visible:true, locked:false, baseZ:nextLayerBaseZ()};
      project.layers.push(lyr);
      project.activeLayerId = id;
      saveActiveProject(); renderLayersStrip();
      layersStrip.scrollLeft = layersStrip.scrollWidth; // прокрутити праворуч, щоб одразу було видно новий шар
    });
    layersStrip.appendChild(addBtn);
    var gearBtn = document.createElement('button');
    gearBtn.className = 'add-btn'; gearBtn.textContent = '⚙';
    gearBtn.addEventListener('click', function(){ showLayerGearMenu(gearBtn); });
    layersStrip.appendChild(gearBtn);
  }
    function showLayerGearMenu(btnEl){
    var lyr = project.layers.find(function(l){return l.id===project.activeLayerId;});
    if(!lyr) return;
    var rect = btnEl.getBoundingClientRect();
    layerPopup.innerHTML =
      '<button data-a="lock">'+(lyr.locked ? '🔓 '+t('unlockBtn') : '🔒 '+t('lockBtn'))+'</button>'+
      '<button data-a="rename">'+t('renameBtn2')+'</button>'+
      '<button data-a="up">'+t('moveUpBtn')+'</button>'+
      '<button data-a="down">'+t('moveDownBtn')+'</button>'+
      '<button data-a="depth">'+t('changeDepthBtn')+'</button>'+
      '<button data-a="merge">'+t('mergeVisibleBtn')+'</button>'+
      '<button class="del" data-a="del">'+t('delLayerFullBtn')+'</button>';
    layerPopup.style.left = Math.max(4, Math.min(window.innerWidth-160, rect.left-100)) + 'px';
    layerPopup.style.top = (rect.top - 270) + 'px';
    layerPopup.style.display = 'block';
    
    layerPopup.onclick = function(e){
      var b = e.target.closest('button'); if(!b) return;
      var a = b.dataset.a;
            if(a==='lock'){
        pushUndo(); lyr.locked = !lyr.locked;
        if(lyr.locked && selected) { selected = null; } // Скидаємо виділення при блокуванні
        saveActiveProject(); render(); renderLayersStrip();
      } else if(a==='rename'){
        var nn = prompt(t('renameLayerPrompt'), lyr.name);
        if(nn){ pushUndo(); lyr.name = nn; saveActiveProject(); renderLayersStrip(); }
      } else if(a==='up'){
        pushUndo();
        // baseZ тепер впливає ТІЛЬКИ на те, з якого z почнуться НОВІ обʼєкти на цьому шарі
        // (newPlacementZ = baseZ+1). Вже розміщені обʼєкти не перемальовуються — їхній z
        // абсолютний і незмінний, "Підняти/Опустити" на них заднім числом не діє.
        lyr.baseZ = (lyr.baseZ||0) + LAYER_Z_STEP;
        saveActiveProject(); render(); renderLayersStrip();
      } else if(a==='down'){
        pushUndo();
        lyr.baseZ = (lyr.baseZ||0) - LAYER_Z_STEP;
        saveActiveProject(); render(); renderLayersStrip();
      } else if(a==='depth'){
        var dv = prompt('Порядок шару зараз: '+(lyr.baseZ||0)+'. Введи нове число:', String(lyr.baseZ||0));
        if(dv!==null){
          var delta = parseInt(dv);
          if(!isNaN(delta)){
            pushUndo();
            lyr.baseZ = delta;
            saveActiveProject(); render(); renderLayersStrip();
          }
        }
      } else if(a==='merge'){
        var visLayers = project.layers.filter(function(l){ return l.visible && !l.locked; });
        if(visLayers.length < 2){ toast(t('toastNeedTwoLayers')); hideLayerPopup(); return; }
        if(confirm(t('confirmMergeLayers'))){
          pushUndo();
          // z ТЕПЕР АБСОЛЮТНИЙ і не залежить від baseZ шару — тому merge більше НЕ рахує
          // жодної арифметики над p.z. Просто перепризначаємо layerId, усі z лишаються
          // такими, якими були. Обʼєкти зберігають свій візуальний порядок автоматично,
          // бо comparePlacements сортує тільки за p.z (і y), а не за шаром.
          var targetLayer = visLayers.reduce(function(best,l){ return (best===null || (l.baseZ||0)>(best.baseZ||0)) ? l : best; }, null);
          visLayers.forEach(function(l){
            if(l.id === targetLayer.id) return;
            project.placements.forEach(function(p){
              if(p.layerId === l.id) p.layerId = targetLayer.id;
            });
          });
          project.layers = project.layers.filter(function(l){ return !l.visible || l.id === targetLayer.id; });
          project.activeLayerId = targetLayer.id;
          selected = null;
          saveActiveProject(); render(); renderLayersStrip();
          toast(t('toastLayersMerged'));
        }
      } else if(a==='del'){
        if(project.layers.length<=1){ toast(t('cantDelLastLayer')); }
        else if(confirm("Увага: це видалить сам шар і ВСІ тайли, які на ньому стоять! Продовжити?")){
          pushUndo();
          // ПРАВИЛЬНО: Фільтруємо і ВИДАЛЯЄМО всі тайли, які належать цьому шару
          project.placements = project.placements.filter(function(p){ return p.layerId !== lyr.id; });
          // Видаляємо сам шар. baseZ ІНШИХ шарів НЕ чіпаємо — вони так і лишаються зі своїми
          // числами (шар 1=10, шар 3=30 — видалили шар 2 — лишається 10 і 30, без жодного
          // "стиснення").
          project.layers = project.layers.filter(function(l){return l.id!==lyr.id;});
          project.activeLayerId = project.layers[0].id;
          selected = null; saveActiveProject(); render(); renderLayersStrip();
        }
      }
      hideLayerPopup();

      
    };
  }
