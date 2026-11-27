/* js/ui/toolbar.js — Панелі режимів, інструменти, налаштування сітки.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  function colMultiAct(a){
    var ids=Object.keys(colMulti);
    if(a==='all'){ project.collisions.forEach(function(c){ if((c.onFloor||1)===collisionFloor && !c.locked) colMulti[c.id]=1; }); }
    else if(a==='clr'){ colMulti={}; }
    else if(!ids.length){ toast('Нічого не виділено'); return; }
    else if(a==='del'){ if(!confirm('Видалити колізій: '+ids.length+'?')) return; pushUndo(); project.collisions=project.collisions.filter(function(c){ return !(colMulti[c.id] && !c.locked); }); colMulti={}; saveActiveProject(); }
    else { var nf=parseInt(prompt('На який поверх перенести виділені (число):', collisionFloor)); if(isNaN(nf)||nf<1) return; pushUndo(); project.collisions.forEach(function(c){ if(colMulti[c.id]) c.onFloor=nf; }); saveActiveProject(); }
    buildModeBar(); render();
  }
  function buildModeBar(){
    modeBar.innerHTML='';
    if(tool==='collision'){
      modeBar.style.display='flex';
      [['texture','colTexture'],['feet','colFeet'],['rect','colRect'],['circle','colCircle'],['iso','colIso']].forEach(function(m){
        var b=document.createElement('button'); b.textContent=t(m[1]); b.dataset.mode=m[0];
        b.className = collisionMode===m[0] ? 'active' : '';
        b.addEventListener('click', function(){ collisionMode=m[0]; buildModeBar(); });
        modeBar.appendChild(b);
      });
      var colTypeSep = document.createElement('span'); colTypeSep.style.cssText='align-self:center;opacity:.4;padding:0 2px;'; colTypeSep.textContent='│';
      modeBar.appendChild(colTypeSep);
      [['solid','⛊ Звичайна'],['trigger','🚪 Тригер'],['floorTransition','🪜 Перехід']].forEach(function(m){
        var b=document.createElement('button'); b.textContent=m[1];
        b.className = collisionType===m[0] ? 'active' : '';
        b.title = 'Тип нових колізій, які ти намалюєш далі';
        b.addEventListener('click', function(){ collisionType=m[0]; buildModeBar(); });
        modeBar.appendChild(b);
      });
      var sep2=document.createElement('span'); sep2.style.cssText='align-self:center;opacity:.4;padding:0 2px;'; sep2.textContent='│'; modeBar.appendChild(sep2);
      var maxF=Math.max(2,collisionFloor,project.collisions.reduce(function(m,c){ return Math.max(m,c.onFloor||1); },1)); var flArr=[]; for(var fi=1;fi<=maxF;fi++) flArr.push(fi);
      flArr.forEach(function(n){ var b=document.createElement('button'); b.textContent='Пов.'+n; b.className=collisionFloor===n?'active':''; b.title='Поверх нових колізій'; b.addEventListener('click',function(){ collisionFloor=n; buildModeBar(); render(); }); modeBar.appendChild(b); });
      var bpl=document.createElement('button'); bpl.textContent='＋'; bpl.title='Новий поверх'; bpl.addEventListener('click',function(){ collisionFloor=maxF+1; buildModeBar(); render(); }); modeBar.appendChild(bpl);
      var bs=document.createElement('button'); bs.textContent='▭ Виділити'; bs.className=colSelectMode?'active':''; bs.addEventListener('click',function(){ colSelectMode=!colSelectMode; if(!colSelectMode) colMulti={}; buildModeBar(); render(); }); modeBar.appendChild(bs);
      if(colSelectMode){ [['🗑 Видалити ('+Object.keys(colMulti).length+')','del'],['→ Пов.…','fN'],['Усі','all'],['✕','clr']].forEach(function(m){ var b=document.createElement('button'); b.textContent=m[0]; b.addEventListener('click',function(){ colMultiAct(m[1]); }); modeBar.appendChild(b); }); }
    } else if(tool==='clone'){
      modeBar.style.display='flex';
      [['line','cloneLine'],['fillrect','cloneFillRect'],['filldiamond','cloneFillDiamond'],['stamp','cloneStamp'],['scatter','cloneScatter'],['block','']].forEach(function(m){
        var b=document.createElement('button');
        b.textContent = m[0]==='stamp' ? '🖨 Штамп' : (m[0]==='scatter' ? '🌿 Розкидати' : (m[0]==='block' ? '▦ Площа' : t(m[1])));
        b.dataset.mode=m[0];
        b.className = cloneMode===m[0] ? 'active' : '';
        b.addEventListener('click', function(){
          cloneMode=m[0]; cloneAnchor=null; cloneDir=null; buildModeBar(); buildCloneLineBar(); render();
          if(m[0]==='scatter') openScatterSettings();
        });
        modeBar.appendChild(b);
      });
    } else { modeBar.style.display='none'; }
  }
  function buildCloneLineBar(){
    cloneLineBar.innerHTML='';
    if(tool==='clone' && cloneMode==='line'){
      cloneLineBar.style.display='flex';
      DIRS.forEach(function(d){
        var b=document.createElement('button'); b.className='dir'+(cloneDir && cloneDir.dc===d[1] && cloneDir.dr===d[2] ? ' active':''); b.textContent=d[0];
        b.addEventListener('click', function(){ cloneDir={dc:d[1],dr:d[2]}; buildCloneLineBar(); });
        cloneLineBar.appendChild(b);
      });
      var count = document.createElement('input'); count.type='number'; count.min='1'; count.value=cloneCount; count.id='cloneCountInput';
      count.addEventListener('input', function(){ cloneCount = parseInt(count.value)||1; });
      cloneLineBar.appendChild(count);
      var apply = document.createElement('button'); apply.className='apply'; apply.textContent=t('applyBtn');
      apply.addEventListener('click', applyCloneLine);
      cloneLineBar.appendChild(apply);
      var cancel = document.createElement('button'); cancel.className='cancel'; cancel.textContent='✕';
      cancel.addEventListener('click', function(){ cloneAnchor=null; render(); });
      cloneLineBar.appendChild(cancel);
    } else if(tool==='clone' && cloneMode==='block'){
      cloneLineBar.style.display='flex';
      var lbl = document.createElement('span'); lbl.textContent='Площа:'; lbl.style.cssText='align-self:center;padding:0 6px;font-size:12px;';
      cloneLineBar.appendChild(lbl);
      var szIn = document.createElement('input'); szIn.type='text'; szIn.id='cloneBlockInput'; szIn.setAttribute('inputmode','text');
      szIn.value = cloneBlockW+'/'+cloneBlockH; szIn.style.width='80px'; szIn.placeholder='4/10';
      szIn.addEventListener('change', function(){
        var m = String(szIn.value).match(/(\d+)\D+(\d+)/);
        if(m){ cloneBlockW = Math.max(1,Math.min(60,parseInt(m[1]))); cloneBlockH = Math.max(1,Math.min(60,parseInt(m[2]))); }
        szIn.value = cloneBlockW+'/'+cloneBlockH;
      });
      cloneLineBar.appendChild(szIn);
      var hint = document.createElement('span'); hint.textContent='→ тапни на карті'; hint.style.cssText='align-self:center;padding:0 6px;font-size:12px;opacity:.7;';
      cloneLineBar.appendChild(hint);
    } else { cloneLineBar.style.display='none'; }
  }
  function applyCloneLine(){
    if(!cloneAnchor || !cloneDir || !activeTileId){ toast(t('chooseDir')); return; }
    pushUndo();
    var g = worldToCell(cloneAnchor.x, cloneAnchor.y);
    var c0 = Math.round(g.c), r0 = Math.round(g.r);
    var fs = {x:1, y:1};
    var fillZ = newPlacementZ(project.activeLayerId);
    for(var i=0;i<cloneCount;i++){
      var c = c0 + cloneDir.dc*i, r = r0 + cloneDir.dr*i;
      var wp = cellToWorld(c,r);
      project.placements.push({ id:'p'+(placeIdCounter++), tileId:activeTileId, x:px(wp.x), y:px(wp.y), z:fillZ, layerId:project.activeLayerId, scaleX:fs.x, scaleY:fs.y, flipX:false });
    }
    cloneAnchor=null; render(); saveActiveProject();
  } // Для перетягування групи

  function updateToolButtons(){
    toolPlace.classList.toggle('active', tool==='place');
    toolPan.classList.toggle('active', tool==='pan');
    toolSelect.classList.toggle('active', tool==='select'); // АКТИВАЦІЯ КНОПКИ
    toolCollision.classList.toggle('active', tool==='collision');
    toolClone.classList.toggle('active', tool==='clone');
    toolSpawn.classList.toggle('active', tool==='spawn');
    document.getElementById('toolShadow').classList.toggle('active', tool==='shadow');
    buildShadowPanel();
    if(tool==='collision') showCollisions = true;
    buildModeBar(); buildCloneLineBar();
  }

  function fitToScreen(){
    var r = wrap.getBoundingClientRect();
    if(project.placements.length===0 && project.collisions.length===0){
      view.zoom=1; view.panX=r.width/2; view.panY=r.height/2; render(); return;
    }
    var minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;
    project.placements.forEach(function(p){ var b=placementBBox(p); minX=Math.min(minX,b.x0); maxX=Math.max(maxX,b.x1); minY=Math.min(minY,b.y0); maxY=Math.max(maxY,b.y1); });
    project.collisions.forEach(function(s){
      if(s.shape==='circle'){ minX=Math.min(minX,s.x-s.r); maxX=Math.max(maxX,s.x+s.r); minY=Math.min(minY,s.y-s.r); maxY=Math.max(maxY,s.y+s.r); }
      else if(s.shape==='poly'){ var fb = polyBBox(s); minX=Math.min(minX,fb.x0); maxX=Math.max(maxX,fb.x1); minY=Math.min(minY,fb.y0); maxY=Math.max(maxY,fb.y1); }
      else { minX=Math.min(minX,s.x0); maxX=Math.max(maxX,s.x1); minY=Math.min(minY,s.y0); maxY=Math.max(maxY,s.y1); }
    });
    var w = maxX-minX || 1, h = maxY-minY || 1;
    var pad = 60;
        var z = Math.min((r.width-pad*2)/w, (r.height-pad*2)/h, 4);
    z = Math.max(z, 0.15);
    view.zoom = z;
    // Округлюємо позицію камери при авто-центруванні
    view.panX = Math.round(r.width/2 - (minX+maxX)/2*z);
    view.panY = Math.round(r.height/2 - (minY+maxY)/2*z);
    render();
  }
  function openGridSettings(){
    document.querySelectorAll('.grid-type-row button').forEach(function(b){ b.classList.toggle('active', b.dataset.type===project.gridType); });
    document.getElementById('cellSizeInput').value = project.cellSize;
    document.getElementById('gridOverInput').checked = project.gridOver !== false;
    document.getElementById('gridColorInput').value = project.gridColor || '#5a6446';
    gridSettingsModal.style.display='flex';
  }
