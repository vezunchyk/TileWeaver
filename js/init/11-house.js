/* js/init/11-house.js — Код запуску теми: Налаштування будинку: поверх, дах, тінь, назва; перегляд будинку. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */

  document.getElementById('houseModalClose').addEventListener('click', function(){ document.getElementById('houseModal').style.display = 'none'; });
  document.getElementById('houseModalBody').addEventListener('click', function(e){
    var b = e.target.closest('button[data-hs]'); if(!b) return;
    var a = b.getAttribute('data-hs'), objs = houseObjsOf(houseTargets()), g = houseGroupName();
    if(!objs.length) return;
    var modal = document.getElementById('houseModal');
    if(a === 'floor'){
      var nf = prompt(t('promptFloorNumEmpty'), objs[0].floor != null ? objs[0].floor : '');
      if(nf === null) return;
      pushUndo();
      objs.forEach(function(o){ if(nf === ''){ delete o.floor; return; } var fn = parseInt(nf); if(!isNaN(fn)){ o.floor = fn; delete o.isRoof; } });
      houseDone();
    } else if(a === 'roof'){
      pushUndo();
      var allRoof = objs.every(function(o){ return !!o.isRoof; });
      objs.forEach(function(o){ if(allRoof){ delete o.isRoof; } else { o.isRoof = true; delete o.floor; } });
      houseDone();
    } else if(a === 'view'){
      var fl = []; project.placements.forEach(function(o){ if(o.group === g && o.floor != null) fl.push(o.floor); });
      houseView.enabled = true; houseView.group = g; houseView.activeFloor = fl.length ? Math.min.apply(null, fl) : 0;
      selected = null; modal.style.display = 'none'; buildHouseViewBar(); render();
    } else if(a === 'selall'){
      var hs = project.placements.filter(function(x){ return x.group === g && !x.shadowOf; });
      var xs = hs.map(function(o){ return o.x; }), ys = hs.map(function(o){ return o.y; });
      selected = { type:'multi', ids:hs.map(function(o){ return o.id; }), minX:Math.min.apply(null,xs), maxX:Math.max.apply(null,xs), minY:Math.min.apply(null,ys), maxY:Math.max.apply(null,ys), houseGroup:g };
      houseDone();
    } else if(a === 'shadow'){
      var hs2 = project.placements.filter(function(x){ return x.group === g && !x.shadowOf; });
      modal.style.display = 'none';
      tool = 'shadow'; selected = null; shadowFolder = null;
      shadowSel = hs2.map(function(o){ return o.id; }); shadowCfg.joint = true;
      updateToolButtons(); render();
    } else if(a === 'rename'){
      var nn = prompt(t('promptGroupNameEmpty'), g);
      if(nn === null || nn === '') return;
      pushUndo();
      project.placements.forEach(function(o){ if(o.group === g) o.group = nn; });
      if(selected && selected.type === 'multi') selected.houseGroup = nn;
      houseDone();
    } else if(a === 'ungroup'){
      if(!confirm('Прибрати групу «'+g+'» у '+objs.length+' вибраних тайлів?')) return;
      pushUndo();
      objs.forEach(function(o){ delete o.group; });
      if(selected && selected.type === 'multi') selected.houseGroup = null;
      modal.style.display = 'none'; saveActiveProject(); render();
    }
  });

  var shadowFolder = null;
  (function(){
    var el = document.getElementById('shadowPanel');
    el.addEventListener('click', function(e){
      var b = e.target.closest('button[data-sh]'); if(!b) return;
      var a = b.getAttribute('data-sh');
      if(a.indexOf('shape:') === 0){ shadowCfg.shape = a.slice(6); if(!shadowFolder) applyShadowSel(true); buildShadowPanel(); }
      else if(a.indexOf('dir:') === 0){ project.lightDir = a.slice(4); regenAllShadows(); buildShadowPanel(); }
      else if(a === 'joint'){ shadowCfg.joint = !shadowCfg.joint; buildShadowPanel(); }
      else if(a === 'folder'){ shadowFolder = { id:null, idx:0 }; buildShadowPanel(); }
      else if(a === 'fback'){ shadowFolder = null; buildShadowPanel(); }
      else if(a === 'fprev' || a === 'fnext'){ var n0 = folderTileIds(shadowFolder.id).length || 1; shadowFolder.idx = (shadowFolder.idx + (a==='fnext' ? 1 : n0-1)) % n0; buildShadowPanel(); }
      else if(a === 'fapply'){
        var fo = folderObjs(shadowFolder.id);
        if(!fo.length){ toast('У цій папці немає обʼєктів на карті'); return; }
        pushUndo();
        var cache = {}, cnt = 0;
        fo.forEach(function(o){ if(applyShadowTo(o, shadowCfg, null, cache)) cnt++; });
        saveActiveProject(); render(); buildShadowPanel(); toast('Тіней: '+cnt);
      }
      else if(a === 'apply'){ applyShadowSel(false); }
      else if(a === 'remove'){
        var objs = shadowSelObjs(); if(!objs.length) return;
        pushUndo();
        var ids = []; objs.forEach(function(o){ ids.push(o.id); var sp = shadowOfObj(o); if(sp) ids.push(sp.shadowOf); });
        removeShadowsOf(ids);
        saveActiveProject(); render(); buildShadowPanel();
      }
      else if(a === 'unlink'){
        pushUndo();
        shadowSelObjs().forEach(function(o){
          var sp = shadowOfObj(o); if(!sp) return;
          delete sp.shadowOf; delete sp.sortY; delete sp.sdx; delete sp.sdy; delete sp.defDx; delete sp.defDy; delete sp.shadowCfg; delete sp.shadowMembers;
          if(project.tiles[sp.tileId]) project.tiles[sp.tileId].autoShadow = false;
        });
        saveActiveProject(); render(); buildShadowPanel(); toast('Тінь відвʼязано — тепер це звичайний обʼєкт');
      }
      else if(a === 'done'){ tool = 'pan'; shadowSel = []; shadowFolder = null; updateToolButtons(); render(); }
    });
    el.addEventListener('input', function(e){
      var r = e.target.closest('input[data-sl]'); if(!r) return;
      var key = r.getAttribute('data-sl'), v = parseFloat(r.value);
      shadowCfg[key] = v;
      var lbl = document.getElementById('shv_'+key);
      if(lbl) lbl.textContent = key==='opacity' ? Math.round(v*100)+'%' : key==='soft' ? (1+v)+'×' : v.toFixed(2);
      if(shadowFolder) renderFolderPreview();
    });
    el.addEventListener('change', function(e){
      if(e.target.closest('select[data-shf]')){ shadowFolder.id = e.target.value || null; shadowFolder.idx = 0; buildShadowPanel(); return; }
      if(e.target.closest('input[data-sl]') && !shadowFolder) applyShadowSel(true);
    });
    document.getElementById('toolShadow').addEventListener('click', function(){ tool = 'shadow'; selected = null; cloneAnchor = null; shadowSel = []; shadowFolder = null; updateToolButtons(); render(); });
  })();

  var handleIds = ['hTL','hTR','hBL','hBR'];
  var extraHandleIds = ['hT','hB','hL','hR','hRatio']; // бокові ручки і замок пропорцій — лише для тіней
  var rotatingId = null;
  // ПРИЧИНА БАГУ «панель не гортається»: updateSelPanel() викликається з кожного render() і щоразу
  // перезаписувала selPanel.innerHTML — DOM кнопок пересоздавався (скрол скидався, елемент під пальцем
  // зникав і жест гортання обривався). Тепер: однаковий вміст — DOM не чіпаємо; поки палець на панелі —
  // оновлення відкладається до відпускання; при справжній зміні вмісту scrollTop зберігається.
  var selPanelTouching = false, selPanelPendingHtml = null;
  (function(){
    var desc = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML'), lastHtml = null;
    Object.defineProperty(selPanel, 'innerHTML', { configurable:true,
      get: function(){ return desc.get.call(this); },
      set: function(v){
        if(v === lastHtml) return;
        if(selPanelTouching){ selPanelPendingHtml = v; return; }
        var g = this.querySelector('.sel-grid'), st = g ? g.scrollTop : 0;
        desc.set.call(this, v); lastHtml = v;
        var ng = this.querySelector('.sel-grid'); if(ng && st) ng.scrollTop = st;
      } });
    function flush(){ selPanelTouching = false; if(selPanelPendingHtml !== null){ var h = selPanelPendingHtml; selPanelPendingHtml = null; selPanel.innerHTML = h; } }
    selPanel.addEventListener('pointerdown', function(){ selPanelTouching = true; }, true);
    ['pointerup','pointercancel'].forEach(function(ev){ document.addEventListener(ev, function(){ if(selPanelTouching) setTimeout(flush, 60); }, true); });
  })();
  var selPanelHidden = false;
  var selPanelCustomPos = (function(){ try{ var v = JSON.parse(localStorage.getItem('tw-selpanel-pos')||'null'); if(v && isFinite(v.left) && isFinite(v.top)) return {left:v.left, top:v.top}; }catch(e){} return null; })(); // {left, top} у px відносно wrap — якщо задано, ігнорує авто-позиціювання під обʼєктом і лишається там для БУДЬ-ЯКОГО наступного виділення, поки користувач не перетягне знову
  var selPanelJustDragged = false; // щоб клік одразу після утримання-перетягування не перемкнув видимість панелі
  var EYE_BTN_HTML = '<button data-act="panelEye" title="Тап — сховати панель. Утримати — перетягнути в інше місце (запамʼятається)">👁</button>';
