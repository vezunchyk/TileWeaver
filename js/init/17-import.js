/* js/init/17-import.js — Код запуску теми: Імпорт спрайтшита та дерева папок / ZIP. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- spritesheet import ----------
  spriteModal = document.getElementById('spriteModal');
  spriteFileInput = document.getElementById('spriteFileInput');
  spriteImg = null;
  document.getElementById('spritePickBtn').addEventListener('click', function(){ spriteFileInput.click(); });
  spriteFileInput.addEventListener('change', function(e){
    var file = e.target.files[0]; if(!file) return;
    var reader = new FileReader();
    reader.onload = function(){
      spriteImg = new Image();
            spriteImg.onload = function(){
        document.getElementById('spritePickStep').style.display='none';
        document.getElementById('spriteEditStep').style.display='block';
        var sc = document.getElementById('spriteCanvas');
        
        // Збільшуємо картинку візуально в 3 рази для зручності тач-керування
        var scale = spriteImg.naturalWidth < 400 ? 3 : 1; 
        
        sc.width = spriteImg.naturalWidth; 
        sc.height = spriteImg.naturalHeight;
        sc.style.width = (spriteImg.naturalWidth * scale) + 'px';
        sc.style.height = (spriteImg.naturalHeight * scale) + 'px';
        sc.dataset.scale = scale;
        
        var sctx = sc.getContext('2d');
        sctx.imageSmoothingEnabled = false; // Вимикаємо мило
        sctx.clearRect(0, 0, sc.width, sc.height);
        sctx.drawImage(spriteImg, 0, 0);
      };
      
      spriteImg.src = reader.result;
      spriteImg._dataURL = reader.result;
    };
    reader.readAsDataURL(file);
    spriteFileInput.value='';
  });
    document.querySelectorAll('.tab-row button').forEach(function(b){
    b.addEventListener('click', function(){
      document.querySelectorAll('.tab-row button').forEach(function(x){x.classList.remove('active');});
      b.classList.add('active');
      document.getElementById('spriteAutoPanel').style.display = b.dataset.tab==='auto' ? 'block':'none';
      document.getElementById('spriteManualPanel').style.display = b.dataset.tab==='manual' ? 'block':'none';
      document.getElementById('spriteSmartPanel').style.display = b.dataset.tab==='smart' ? 'block':'none';
    });
  });
  
  document.getElementById('sAutoSliceBtn').addEventListener('click', function(){
    if(!spriteImg) return;
    var tw = parseInt(document.getElementById('sAutoW').value)||64;
    var th = parseInt(document.getElementById('sAutoH').value)||64;
    var cols = parseInt(document.getElementById('sAutoCols').value)||1;
    var rows = parseInt(document.getElementById('sAutoRows').value)||1;
    var count=0;
    for(var ry=0; ry<rows; ry++){
      for(var cx=0; cx<cols; cx++){
        var sx = cx*tw, sy = ry*th;
        if(sx+tw > spriteImg.naturalWidth || sy+th > spriteImg.naturalHeight) continue;
        var off = document.createElement('canvas'); off.width=tw; off.height=th;
        var offCtx = off.getContext('2d');
        offCtx.imageSmoothingEnabled = false;
        offCtx.drawImage(spriteImg, sx,sy,tw,th, 0,0,tw,th);
        addTileFromDataURL('sprite_'+(ry*cols+cx+1), off.toDataURL(), document.getElementById('spriteImportFolder').value);
        count++;
      }
    }
    saveActiveProject();
    toast(count + ' ' + t('toastSliced'));
    spriteModal.style.display='none';
    resetSpriteModal();
  });
  // manual selection on sprite canvas
  spriteSel = document.getElementById('spriteSel');
  spriteSelRect = null;
  (function(){
    var sc = document.getElementById('spriteCanvas');
    var wrapEl = document.getElementById('spriteCanvasWrap');
    var dragging=false, start=null;
    var spPointers = new Map();
    var panStart = null;
    sc.addEventListener('pointerdown', function(e){
      sc.setPointerCapture(e.pointerId);
      spPointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
      if(spPointers.size===1){
        dragging=true;
        var rect = sc.getBoundingClientRect();
        start = {x:e.clientX-rect.left, y:e.clientY-rect.top};
        spriteSel.style.display='block';
        spriteSel.style.left=start.x+'px'; spriteSel.style.top=start.y+'px'; spriteSel.style.width='0px'; spriteSel.style.height='0px';
      } else if(spPointers.size===2){
        dragging=false; spriteSel.style.display='none'; document.getElementById('spriteSelLabel').style.display='none';
        var pts = Array.from(spPointers.values());
        panStart = { mx:(pts[0].x+pts[1].x)/2, my:(pts[0].y+pts[1].y)/2, scrollLeft:wrapEl.scrollLeft, scrollTop:wrapEl.scrollTop };
      }
    });
    sc.addEventListener('pointermove', function(e){
      if(!spPointers.has(e.pointerId)) return;
      spPointers.set(e.pointerId, {x:e.clientX, y:e.clientY});
      if(spPointers.size===2 && panStart){
        var pts = Array.from(spPointers.values());
        var mx=(pts[0].x+pts[1].x)/2, my=(pts[0].y+pts[1].y)/2;
        wrapEl.scrollLeft = panStart.scrollLeft - (mx-panStart.mx);
        wrapEl.scrollTop = panStart.scrollTop - (my-panStart.my);
        return;
      }
      if(!dragging) return;
      var rect = sc.getBoundingClientRect();
      var cur = {x:e.clientX-rect.left, y:e.clientY-rect.top};
      var x0=Math.min(start.x,cur.x), y0=Math.min(start.y,cur.y);
      var w=Math.abs(cur.x-start.x), h=Math.abs(cur.y-start.y);
      spriteSel.style.left=x0+'px'; spriteSel.style.top=y0+'px'; spriteSel.style.width=w+'px'; spriteSel.style.height=h+'px';
      spriteSelRect = {x0:x0,y0:y0,w:w,h:h};
      var scaleLbl = parseFloat(sc.dataset.scale)||1;
      var lbl = document.getElementById('spriteSelLabel');
      lbl.style.display='block';
      lbl.textContent = Math.round(w/scaleLbl)+' × '+Math.round(h/scaleLbl)+'px';
      lbl.style.left = x0+'px'; lbl.style.top = Math.max(0,y0-20)+'px';
    });
    function spEnd(e){
      spPointers.delete(e.pointerId);
      if(spPointers.size<2) panStart=null;
      if(spPointers.size===0) dragging=false;
    }
    sc.addEventListener('pointerup', spEnd);
    sc.addEventListener('pointercancel', spEnd);
  })();
    document.getElementById('sManualAddBtn').addEventListener('click', function(){
    if(!spriteSelRect || spriteSelRect.w<3 || spriteSelRect.h<3){ toast(t('toastNoSel')); return; }
    var sc = document.getElementById('spriteCanvas');
    var scale = parseFloat(sc.dataset.scale)||1;
    
    // Відкидаємо дробові числа координат, щоб не генерувати розмиті "напівпікселі"
    var sx = Math.floor(spriteSelRect.x0/scale), sy = Math.floor(spriteSelRect.y0/scale);
    var sw = Math.round(spriteSelRect.w/scale), sh = Math.round(spriteSelRect.h/scale);
    
    var off = document.createElement('canvas'); 
    off.width = sw; off.height = sh;
    var offCtx2 = off.getContext('2d');
    
    offCtx2.imageSmoothingEnabled = false; // Жорстка заборона на розмиття фінального тайла
    offCtx2.drawImage(spriteImg, sx, sy, sw, sh, 0, 0, sw, sh);
    
    addTileFromDataURL('sprite_'+tileIdCounter, off.toDataURL(), document.getElementById('spriteImportFolder').value);
    saveActiveProject();
    toast('Вирізано: ' + sw + 'x' + sh);
    spriteSel.style.display='none'; spriteSelRect=null; document.getElementById('spriteSelLabel').style.display='none';
  });
    document.getElementById('sSmartSliceBtn').addEventListener('click', function(){
    if(!spriteImg) return;
    
    var w = spriteImg.naturalWidth;
    var h = spriteImg.naturalHeight;
    
    // Малюємо оригінал у пам'яті, щоб дістати сирі пікселі
    var off = document.createElement('canvas');
    off.width = w; off.height = h;
    var octx = off.getContext('2d');
    octx.drawImage(spriteImg, 0, 0);
    
    // Отримуємо масив усіх пікселів (RGBA)
    var imgData = octx.getImageData(0, 0, w, h);
    var data = imgData.data;
    var visited = new Uint8Array(w * h); // Масив перевірених пікселів
    
    var count = 0;
    
    // Проходимо по кожному пікселю картинки
    for(var y = 0; y < h; y++){
      for(var x = 0; x < w; x++){
        var idx = y * w + x;
        var alpha = data[idx * 4 + 3]; // Прозорість
        
        // Якщо піксель не прозорий і ми його ще не перевіряли — це новий об'єкт!
        // Ігноруємо напівпрозорий пил (альфа менше 100 з 255)
if(alpha > 100 && visited[idx] === 0){
  
        var minX = x, maxX = x, minY = y, maxY = y;
          var queue = [x, y];
          visited[idx] = 1;
          
          // Запускаємо "Заливку" (Алгоритм BFS), щоб знайти всі з'єднані пікселі цього об'єкта
          var head = 0;
          while(head < queue.length){
            var cx = queue[head++];
            var cy = queue[head++];
            
            // Розширюємо рамку об'єкта
            if(cx < minX) minX = cx;
            if(cx > maxX) maxX = cx;
            if(cy < minY) minY = cy;
            if(cy > maxY) maxY = cy;
            
            // Перевіряємо 8 сусідніх пікселів навколо
            for(var dy = -1; dy <= 1; dy++){
              for(var dx = -1; dx <= 1; dx++){
                if(dx === 0 && dy === 0) continue;
                var nx = cx + dx, ny = cy + dy;
                
                if(nx >= 0 && nx < w && ny >= 0 && ny < h){
                  var nidx = ny * w + nx;
                  // Якщо сусід теж не прозорий — додаємо його до нашого об'єкта
                  if(visited[nidx] === 0 && data[nidx * 4 + 3] > 0){
                    visited[nidx] = 1;
                    queue.push(nx, ny);
                  }
                }
              }
            }
          }
          
          // Об'єкт повністю знайдено! Вирізаємо його точно по рамках
                    var sw = maxX - minX + 1;
          var sh = maxY - minY + 1;
          
          // ІГНОРУЄМО об'єкти, які менші за 4х4 пікселі (всяке сміття)
          if(sw < 4 || sh < 4) continue;
          
          
          var subOff = document.createElement('canvas');
          subOff.width = sw; subOff.height = sh;
          var subCtx = subOff.getContext('2d');
          subCtx.imageSmoothingEnabled = false; // Вимикаємо мило
          subCtx.drawImage(off, minX, minY, sw, sh, 0, 0, sw, sh);
          
          // Додаємо в палітру
          addTileFromDataURL('smart_' + Date.now() + '_' + (++count), subOff.toDataURL(), document.getElementById('spriteImportFolder').value);
        }
      }
    }
    
    saveActiveProject();
    toast('Знайдено й вирізано об\'єктів: ' + count);
    spriteModal.style.display = 'none';
    resetSpriteModal();
  });
  
  document.getElementById('spriteModalClose').addEventListener('click', function(){ spriteModal.style.display='none'; resetSpriteModal(); });

  // ---------- імпорт дерева папок / ZIP (із злиттям) ----------
  (function(){
    var modal = document.getElementById('treeModal');
    var destSel = document.getElementById('treeDest');
    var dupSel = document.getElementById('treeDup');
    var sumEl = document.getElementById('treeSummary');
    var goBtn = document.getElementById('treeGoBtn');
    var barWrap = document.getElementById('treeProgressWrap');
    var bar = document.getElementById('treeProgress');
    var folderInput = document.getElementById('treeFolderInput');
    var zipInput = document.getElementById('treeZipInput');
    var pending = null, busy = false;
    var MIME = { png:'image/png', jpg:'image/jpeg', jpeg:'image/jpeg', gif:'image/gif', webp:'image/webp', bmp:'image/bmp' };
    var MAX_TEX = 3000;

    function norm(s){ return String(s).trim().toLowerCase(); }
    // та сама папка = та сама назва (без урахування регістру) під тим самим батьком → вони зливаються
    function findFolder(name, pid){
      var ln = norm(name);
      return project.tileFolders.find(function(f){ return norm(f.name) === ln && (f.parentId || null) === (pid || null); });
    }
    function tileIndex(){      // folderId → { назва → id тайла }
      var idx = {};
      Object.keys(project.tiles).forEach(function(id){
        var tl = project.tiles[id]; if(tl.autoShadow) return;
        var f = tl.folderId || '';
        (idx[f] = idx[f] || {})[norm(tl.name)] = id;
      });
      return idx;
    }
    function fillDest(){
      destSel.innerHTML = '';
      var o0 = document.createElement('option'); o0.value = ''; o0.textContent = t('treeDestRoot'); destSel.appendChild(o0);
      project.tileFolders.forEach(function(f){
        var o = document.createElement('option'); o.value = f.id; o.textContent = folderPathLabel(f.id);
        if(f.id === activeFolderId) o.selected = true;
        destSel.appendChild(o);
      });
    }
    function resetUI(){
      pending = null; busy = false;
      sumEl.textContent = ''; goBtn.disabled = true;
      barWrap.style.display = 'none'; bar.style.width = '0';
    }
    function splitPath(p){
      var segs = String(p).replace(/\\/g, '/').split('/').filter(function(x){ return x && x !== '.'; });
      if(!segs.length) return null;
      for(var i = 0; i < segs.length; i++){ if(segs[i].charAt(0) === '.' || segs[i] === '__MACOSX') return null; }
      return segs;
    }
    function makeEntry(path, reader){
      var segs = splitPath(path); if(!segs) return null;
      var file = segs.pop();
      var m = /\.([a-z0-9]+)$/i.exec(file); if(!m) return null;
      var mime = MIME[m[1].toLowerCase()]; if(!mime) return null;
      return { dir: segs, name: file.slice(0, file.length - m[0].length) || file, mime: mime, read: reader };
    }
    function fileToDataURL(f, mime){
      return new Promise(function(resolve, reject){
        var r = new FileReader();
        r.onload = function(){ resolve(String(r.result).replace(/^data:[^;,]*/, 'data:' + mime)); };
        r.onerror = function(){ reject(r.error); };
        r.readAsDataURL(f);
      });
    }
    // скільки файлів збігаються за назвою з уже наявними тайлами тієї ж папки (або між собою всередині імпорту)
    function countConflicts(){
      if(!pending) return 0;
      var destId = destSel.value || null, idx = tileIndex(), seen = {}, n = 0;
      pending.entries.forEach(function(e){
        var segs = e.dir.length ? e.dir : (destId ? [] : [pending.name]);
        var parent = destId, exists = true, pathKey = '';
        for(var i = 0; i < segs.length; i++){
          pathKey += '/' + norm(segs[i]);
          var f = exists ? findFolder(segs[i], parent) : null;
          if(f) parent = f.id; else exists = false;
        }
        var key = (exists ? 'id:' + (parent || '') : 'new:' + pathKey) + '|' + norm(e.name);
        var hit = (exists && idx[parent || ''] && idx[parent || ''][norm(e.name)]) || seen[key];
        if(hit) n++;
        seen[key] = true;
      });
      return n;
    }
    function renderSummary(){
      if(!pending){ return; }
      var entries = pending.entries, counts = {}, order = [];
      entries.forEach(function(e){
        var k = e.dir.join(' / ') || t('treeLoose');
        if(counts[k] === undefined){ counts[k] = 0; order.push(k); }
        counts[k]++;
      });
      var lines = [t('treeFound').replace('{n}', entries.length).replace('{m}', order.length)];
      var c = countConflicts();
      if(c) lines.push(t('treeConflicts').replace('{n}', c));
      order.slice(0, 12).forEach(function(k){ lines.push('• ' + k + ' — ' + counts[k]); });
      if(order.length > 12) lines.push(t('treeMore').replace('{n}', order.length - 12));
      sumEl.textContent = lines.join('\n');
    }
    function setPending(entries, srcName){
      entries.sort(function(a, b){
        return (a.dir.join('/') + '\u0000').localeCompare(b.dir.join('/') + '\u0000', undefined, { numeric:true }) ||
               a.name.localeCompare(b.name, undefined, { numeric:true });
      });
      if(entries.length > MAX_TEX) entries = entries.slice(0, MAX_TEX);
      if(!entries.length){ pending = null; goBtn.disabled = true; sumEl.textContent = t('treeNone'); return; }
      pending = { entries: entries, name: srcName || 'Import' };
      renderSummary();
      goBtn.disabled = false;
    }

    destSel.addEventListener('change', renderSummary);
    document.getElementById('treePickFolderBtn').addEventListener('click', function(){ if(!busy) folderInput.click(); });
    document.getElementById('treePickZipBtn').addEventListener('click', function(){ if(!busy) zipInput.click(); });

    folderInput.addEventListener('change', function(){
      var files = Array.prototype.slice.call(folderInput.files || []);
      folderInput.value = '';
      if(!files.length) return;
      var rootName = '';
      var entries = [];
      files.forEach(function(f){
        var rp = f.webkitRelativePath || f.name;
        if(!rootName) rootName = String(rp).split('/')[0];
        var e = makeEntry(rp, function(mime){ return fileToDataURL(f, mime); });
        if(e) entries.push(e);
      });
      setPending(entries, rootName);
    });

    zipInput.addEventListener('change', function(){
      var file = zipInput.files && zipInput.files[0];
      zipInput.value = '';
      if(!file) return;
      sumEl.textContent = '…';
      JSZip.loadAsync(file).then(function(zip){
        var entries = [];
        zip.forEach(function(rel, z){
          if(z.dir) return;
          var e = makeEntry(rel, function(mime){ return z.async('base64').then(function(b){ return 'data:' + mime + ';base64,' + b; }); });
          if(e) entries.push(e);
        });
        setPending(entries, file.name.replace(/\.zip$/i, ''));
      }).catch(function(){ pending = null; goBtn.disabled = true; sumEl.textContent = t('treeZipErr'); });
    });

    goBtn.addEventListener('click', async function(){
      if(busy || !pending) return;
      busy = true; goBtn.disabled = true; barWrap.style.display = 'block'; bar.style.width = '0';
      var destId = destSel.value || null, mode = dupSel.value;
      var map = {}, seq = 0, created = 0, added = 0, replaced = 0, skipped = 0;
      var idx = tileIndex();
      function ensureFolder(segs){
        var parent = destId, key = '';
        segs.forEach(function(name){
          key += '/' + norm(name);
          if(map[key] === undefined){
            var pid = parent;
            var ex = findFolder(name, pid);
            if(!ex){ ex = { id:'folder_' + Date.now() + '_' + (++seq), name:String(name).trim() || name, parentId: pid || null }; project.tileFolders.push(ex); created++; }
            map[key] = ex.id;
          }
          parent = map[key];
        });
        return parent;
      }
      var entries = pending.entries, total = entries.length;
      for(var i = 0; i < total; i++){
        var e = entries[i];
        try{
          var fid = e.dir.length ? ensureFolder(e.dir) : (destId || ensureFolder([pending.name]));
          var key = norm(e.name);
          var bucket = idx[fid] || (idx[fid] = {});
          var existId = bucket[key];
          if(existId && project.tiles[existId] && mode !== 'both'){
            if(mode === 'skip'){ skipped++; }
            else {
              var url = await e.read(e.mime);
              var tl = project.tiles[existId];
              if(tl.dataURL === url){ skipped++; }       // та сама картинка — нічого міняти
              else {
                var im = new Image(); im.onload = render; im.src = url;
                tl.img = im; tl.dataURL = url;           // id, назва, pivot, анімація й розміщення на карті лишаються
                replaced++;
              }
            }
          } else {
            var url2 = await e.read(e.mime);
            bucket[key] = addTileFromDataURL(e.name, url2, fid);
            added++;
          }
        }catch(err){ /* пошкоджений файл — пропускаємо */ }
        if(i % 5 === 4 || i === total - 1){
          bar.style.width = Math.round((i + 1) / total * 100) + '%';
          await new Promise(function(r){ setTimeout(r, 0); });
        }
      }
      saveActiveProject();
      renderTileFolders();
      refreshPalette();
      render();
      toast(t('treeDone').replace('{a}', added).replace('{r}', replaced).replace('{s}', skipped).replace('{m}', created));
      modal.style.display = 'none';
      resetUI();
    });

    document.getElementById('treeClose').addEventListener('click', function(){ if(busy) return; modal.style.display = 'none'; resetUI(); });
    document.getElementById('menuImportTree').addEventListener('click', function(){
      document.getElementById('menuSheet').style.display = 'none';
      resetUI(); fillDest(); modal.style.display = 'flex';
    });
  })();
