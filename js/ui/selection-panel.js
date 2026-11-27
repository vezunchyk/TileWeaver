/* js/ui/selection-panel.js — Плаваюча панель виділеного.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Містить лише оголошення функцій — безпечно завантажувати до решти коду. */

  // Тінь = тайл, створений кнопками 🌑/⬭ (назва починається з «тінь_», «shadow_» тощо). Для неї — вільна трансформація кутами.
  function isShadowTile(tile){ return !!tile && (tile.isShadow || /^(тінь|shadow|그림자|影|阴影|sombra)_/i.test(tile.name || '')); }
  function lightDir(){ return SH_DIRS[project.lightDir] ? project.lightDir : 'se'; }
  function mkCanvas(w,h){ var c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
  // Крупніші «пікселі» тіні (soft) + жорсткий поріг прозорості: без мильного розмиття; колір — теплий сіро-коричневий
  function finishShadow(c, soft, opacity){
    var w = c.width, h = c.height, f = 1 + Math.max(0, soft|0);
    if(f > 1){
      var sm = mkCanvas(Math.ceil(w/f), Math.ceil(h/f)), smx = sm.getContext('2d');
      smx.imageSmoothingEnabled = true; smx.drawImage(c, 0,0,w,h, 0,0,sm.width,sm.height);
      var c2 = mkCanvas(w,h), x2 = c2.getContext('2d'); x2.imageSmoothingEnabled = false;
      x2.drawImage(sm, 0,0,sm.width,sm.height, 0,0,w,h); c = c2;
    }
    var ctx2 = c.getContext('2d'), id = ctx2.getImageData(0,0,w,h), d = id.data, a = Math.round(255*opacity);
    for(var i=0; i<d.length; i+=4){ var al = d[i+3]; d[i]=24; d[i+1]=18; d[i+2]=14; d[i+3] = al > 100 ? a : 0; }
    ctx2.putImageData(id,0,0);
    return c;
  }
  function tileFrameW(tile){ var w = tile.img.naturalWidth; if(hasVariableFrames(tile)) return tile.frames[0].w; return tile.animFrames > 1 ? w/tile.animFrames : w; }
  function spriteTouchesRect(p, bb, x0, y0, x1, y1){
    var tile = project.tiles[p.tileId];
    if(!tile || !tile.img.complete || !tile.img.naturalWidth) return true;
    var W = Math.max(1, Math.min(256, Math.round(x1-x0))), H = Math.max(1, Math.min(256, Math.round(y1-y0)));
    if(!spriteHitCanvas) spriteHitCanvas = document.createElement('canvas');
    spriteHitCanvas.width = W; spriteHitCanvas.height = H;
    var c = spriteHitCanvas.getContext('2d', { willReadFrequently:true }); c.imageSmoothingEnabled = false;
    var fw = tileFrameW(tile), fh = tile.img.naturalHeight;
    var u0 = (x0-bb.x0)/bb.w*fw, u1 = (x1-bb.x0)/bb.w*fw, v0 = (y0-bb.y0)/bb.h*fh, v1 = (y1-bb.y0)/bb.h*fh;
    if(p.flipX){ var tu = fw-u1; u1 = fw-u0; u0 = tu; }
    if(p.flipY){ var tv = fh-v1; v1 = fh-v0; v0 = tv; }
    u0 = Math.max(0,u0); v0 = Math.max(0,v0); u1 = Math.min(fw,u1); v1 = Math.min(fh,v1);
    if(u1 <= u0 || v1 <= v0) return false;
    try{
      c.drawImage(tile.img, u0, v0, u1-u0, v1-v0, 0, 0, W, H);
      var d = c.getImageData(0,0,W,H).data;
      for(var i=3; i<d.length; i+=4){ if(d[i] > 16) return true; }
    }catch(e){ return true; }
    return false;
  }
  function drawPlacementSprite(c, p, ox, oy){
    var tile = project.tiles[p.tileId], bb = placementBBox(p);
    c.save();
    c.translate(bb.x0 - ox + (p.flipX ? bb.w : 0), bb.y0 - oy + (p.flipY ? bb.h : 0));
    c.scale(p.flipX ? -1 : 1, p.flipY ? -1 : 1);
    c.drawImage(tile.img, 0,0,tileFrameW(tile),tile.img.naturalHeight, 0,0,bb.w,bb.h);
    c.restore();
  }
  // Склеює один обʼєкт або кілька (будинок) в одну картинку-силует
  function shadowSprite(list){
    var x0=1e9, y0=1e9, x1=-1e9, y1=-1e9, ok=[];
    list.forEach(function(p){
      var tile = project.tiles[p.tileId]; if(!tile || !tile.img.complete || !tile.img.naturalWidth) return;
      var bb = placementBBox(p); ok.push(p);
      if(bb.x0<x0)x0=bb.x0; if(bb.y0<y0)y0=bb.y0; if(bb.x1>x1)x1=bb.x1; if(bb.y1>y1)y1=bb.y1;
    });
    if(!ok.length) return null;
    x0 = Math.floor(x0); y0 = Math.floor(y0);
    var W = Math.ceil(x1)-x0, H = Math.ceil(y1)-y0;
    if(W < 1 || H < 1 || W > 4096 || H > 4096) return null;
    var src = mkCanvas(W,H), c = src.getContext('2d'); c.imageSmoothingEnabled = false;
    ok.slice().sort(comparePlacements).forEach(function(p){ drawPlacementSprite(c, p, x0, y0); });
    return { src:src, sw:W, sh:H, bx0:x0, by0:y0 };
  }
  function buildShadow(list, cfg){
    var sp0 = shadowSprite(list); if(!sp0) return null;
    var src = sp0.src, sw = sp0.sw, sh = sp0.sh, sctx = src.getContext('2d'), b = { x0: sp0.bx0, y0: sp0.by0 };
    var mx0=sw, my0=sh, mx1=-1, my1=-1;
    try{
      var dd = sctx.getImageData(0,0,sw,sh).data;
      for(var y=0; y<sh; y++){ for(var x=0; x<sw; x++){ if(dd[(y*sw+x)*4+3] > 10){ if(x<mx0)mx0=x; if(x>mx1)mx1=x; if(y<my0)my0=y; if(y>my1)my1=y; } } }
    }catch(e){}
    if(mx1<mx0 || my1<my0){ mx0=0; my0=0; mx1=sw-1; my1=sh-1; }
    var cw = mx1-mx0+1, ch = my1-my0+1;
    var dir = SH_DIRS[lightDir()], sx = dir[0], sy = dir[1], k = cfg.len;
    var out, cx, cy;
    if(cfg.shape === 'diamond' || cfg.shape === 'circle'){
      // тінь-«п'ятно» на землі: ізометричний ромб (квадрат на землі) або еліпс 2:1 (коло на землі)
      var fW = Math.max(4, Math.round(cw*(0.3 + k*0.9))), fH = Math.max(2, Math.round(fW/2));
      out = mkCanvas(fW,fH); var o = out.getContext('2d'); o.fillStyle = '#000'; o.beginPath();
      if(cfg.shape === 'diamond'){ o.moveTo(fW/2,0); o.lineTo(fW,fH/2); o.lineTo(fW/2,fH); o.lineTo(0,fH/2); o.closePath(); }
      else { o.ellipse(fW/2, fH/2, fW/2, fH/2, 0, 0, Math.PI*2); }
      o.fill();
      cx = b.x0 + mx0 + cw/2 + sx*cw*0.06*k; cy = b.y0 + my1 + 1 - fH*0.15 + sy*fH*0.1*k;
    } else {
      // силует/блок: піксель на висоті h над основою зсувається по землі на h·k вздовж діагоналі сітки (по x — h·k, по y — h·k/2)
      var srcC = mkCanvas(cw,ch), cc = srcC.getContext('2d'); cc.imageSmoothingEnabled = false;
      if(cfg.shape === 'rect'){ cc.fillStyle = '#000'; cc.fillRect(0,0,cw,ch); } else { cc.drawImage(src, mx0,my0,cw,ch, 0,0,cw,ch); }
      var minX=1e9, minY=1e9, maxX=-1e9, maxY=-1e9;
      [[0,0],[cw,0],[0,ch],[cw,ch]].forEach(function(q){
        var X = q[0] - k*sx*(q[1]-ch), Y = ch - 0.5*k*sy*(q[1]-ch);
        if(X<minX)minX=X; if(X>maxX)maxX=X; if(Y<minY)minY=Y; if(Y>maxY)maxY=Y;
      });
      out = mkCanvas(Math.ceil(maxX-minX)+1, Math.ceil(maxY-minY)+1);
      var oc = out.getContext('2d'); oc.imageSmoothingEnabled = false;
      oc.setTransform(1, 0, -k*sx, -0.5*k*sy, k*sx*ch - minX, ch*(1+0.5*k*sy) - minY);
      oc.drawImage(srcC, 0, 0);
      cx = b.x0 + mx0 + minX + out.width/2; cy = b.y0 + my0 + minY + out.height/2;
    }
    return { canvas: finishShadow(out, cfg.soft, cfg.opacity), cx:cx, cy:cy };
  }
  function dropShadowTile(tid){
    var tl = project.tiles[tid];
    if(tl && tl.autoShadow && !project.placements.some(function(x){ return x.tileId === tid; })) delete project.tiles[tid];
  }
  // Створює або ПЕРЕГЕНЕРОВУЄ тінь обʼєкта par (або спільну тінь будинку, якщо members>1).
  // cache: для масового застосування — однакові текстури діляться одним тайлом тіні.
  function applyShadowTo(par, cfg, members, cache){
    var list = (members && members.length > 1) ? members : [par];
    var key = list.length === 1 ? [par.tileId, par.scaleX, par.scaleY, par.flipX?1:0, par.flipY?1:0, cfg.shape, cfg.len, cfg.opacity, cfg.soft, lightDir()].join('|') : null;
    var ent = (cache && key) ? cache[key] : null;
    if(!ent){
      var res = buildShadow(list, cfg); if(!res) return false;
      ent = { url: res.canvas.toDataURL('image/png'), dx: Math.round(res.cx - par.x), dy: Math.round(res.cy - par.y), tid: null };
      if(cache && key) cache[key] = ent;
    }
    var sp = project.placements.find(function(x){ return x.shadowOf === par.id; });
    var oldTid = sp ? sp.tileId : null, tid = null;
    if(ent.tid && project.tiles[ent.tid]) tid = ent.tid;
    else {
      var im = new Image(); im.onload = render; im.src = ent.url;
      var own = oldTid && project.tiles[oldTid] && project.tiles[oldTid].autoShadow && project.placements.filter(function(x){ return x.tileId === oldTid; }).length <= 1;
      if(own){ tid = oldTid; project.tiles[tid].img = im; project.tiles[tid].dataURL = ent.url; }
      else {
        tid = 't'+(tileIdCounter++);
        var pt = project.tiles[par.tileId];
        project.tiles[tid] = { name: t('shadowTileName')+'_'+(list.length > 1 ? 'house' : ((pt && pt.name) || par.tileId)), img: im, dataURL: ent.url, folderId: null, autoShadow: true };
      }
      ent.tid = tid;
    }
    if(!sp){
      sp = { id:'p'+(placeIdCounter++), tileId:tid, x:par.x+ent.dx, y:par.y+ent.dy, z:par.z, layerId:par.layerId, scaleX:1, scaleY:1, flipX:false, flipY:false, rotation:0, shadowOf:par.id, sdx:ent.dx, sdy:ent.dy, defDx:ent.dx, defDy:ent.dy };
      project.placements.push(sp);
    } else {
      sp.tileId = tid;
      sp.sdx = ent.dx + ((sp.sdx||0) - (sp.defDx||0)); sp.sdy = ent.dy + ((sp.sdy||0) - (sp.defDy||0));
      sp.defDx = ent.dx; sp.defDy = ent.dy; sp.scaleX = 1; sp.scaleY = 1;
    }
    if(list.length > 1) sp.shadowMembers = list.map(function(o){ return o.id; }); else delete sp.shadowMembers;
    sp.shadowCfg = { shape:cfg.shape, len:cfg.len, opacity:cfg.opacity, soft:cfg.soft };
    sp.x = par.x + sp.sdx; sp.y = par.y + sp.sdy;
    if(oldTid && oldTid !== tid) dropShadowTile(oldTid);
    return true;
  }
  function syncShadows(){
    var arr = project.placements;
    if(shCache.arr !== arr || shCache.len !== arr.length || shCache.epoch !== placementsEpoch){
      var m0 = {}, sh0 = [];
      arr.forEach(function(p){ m0[p.id] = p; if(p.shadowOf) sh0.push(p); });
      shCache = { arr:arr, len:arr.length, epoch:placementsEpoch, map:m0, shadows:sh0 };
    }
    if(!shCache.shadows.length) return;
    var map = shCache.map, shadows = shCache.shadows;
    var orphan = shadows.some(function(p){ return !map[p.shadowOf]; });
    if(orphan){
      var gone = [];
      project.placements = project.placements.filter(function(p){ if(p.shadowOf && !map[p.shadowOf]){ gone.push(p.tileId); return false; } return true; });
      gone.forEach(dropShadowTile);
      if(selected && selected.type === 'placement' && !project.placements.some(function(p){ return p.id === selected.id; })) selected = null;
      shadows = shadows.filter(function(p){ return map[p.shadowOf]; });
      saveActiveProject();
    }
    var regen = [];
    shadows.forEach(function(p){
      var par = map[p.shadowOf]; if(!par) return;
      var active = (mode === 'dragMove' && dragTarget === p) || (resizeData && resizeData.target === p);
      if(active){ p.sdx = p.x - par.x; p.sdy = p.y - par.y; } else { p.x = par.x + (p.sdx||0); p.y = par.y + (p.sdy||0); }
      // z тіні = z обʼєкта + власне зміщення. Якщо z тіні змінили вручну (кнопки ▲/▼), запамʼятовуємо різницю
      if(p.lastZ !== undefined && p.z !== p.lastZ) p.zOff = p.z - par.z;
      p.z = par.z + (p.zOff || 0); p.lastZ = p.z;
      p.layerId = par.layerId; p.sortY = par.y - 0.5;
      var mem = null;
      if(p.shadowMembers){
        mem = p.shadowMembers.map(function(id){ return map[id]; }).filter(Boolean);
        if(mem.length !== p.shadowMembers.length && p.shadowCfg) regen.push([par, p.shadowCfg, mem]); // частину будинку видалено — тінь перераховується
      }
      if(!project.tiles[p.tileId] && p.shadowCfg) regen.push([par, p.shadowCfg, mem]); // тайл тіні втрачено (напр. після Undo)
    });
    regen.forEach(function(r){ applyShadowTo(r[0], r[1], r[2]); });
  }
  function shadowSelObjs(){
    var objs = shadowSel.map(function(id){ return placementById(id); }).filter(Boolean);
    shadowSel = objs.map(function(o){ return o.id; });
    return objs;
  }
  function shadowOfObj(o){ return project.placements.find(function(x){ return x.shadowOf === o.id || (x.shadowMembers && x.shadowMembers.indexOf(o.id) >= 0); }); }
  function shSlider(key, label, min, max, step, val, fmt){
    return '<label class="shp-sl"><span>'+label+' <b id="shv_'+key+'">'+fmt(val)+'</b></span><input type="range" data-sl="'+key+'" min="'+min+'" max="'+max+'" step="'+step+'" value="'+val+'"></label>';
  }
