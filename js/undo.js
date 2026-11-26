/* undo.js — undo/redo на ПАТЧАХ (замість повних JSON-знімків усього проєкту).
   Раніше кожна дія робила JSON.stringify усіх розміщень і тримала до 40 таких рядків у памʼяті.
   Тепер зберігається лише те, що змінилось: які розміщення змінені / додані / видалені (до і після),
   плюс порядок масиву, якщо він змінився. Поведінка для користувача та сама:
   ліміт 40 кроків, «назад/вперед», порожні кроки пропускаються, після нової дії «вперед» скидається.
   Звичайний скрипт (не модуль): дає глобальний об'єкт TWUndo. Логіка не залежить від решти редактора,
   тому її можна перевіряти окремо. */
(function(root){
  var LIMIT = 40;
  var COLS = ['placements', 'collisions', 'spawns', 'layers'];

  // Копія обʼєкта, яка поводиться як після JSON-циклу (без undefined і функцій, NaN→null, вкладене клонується).
  // Додатково запамʼятовуємо список ключів і значень (ks/vs) — для дуже швидкого порівняння у same().
  var OBJ = {}; // позначка «тут вкладений обʼєкт» (такі значення порівнюємо повільним шляхом)
  function cpItem(o){
    var c = {}, n = 0, ks = Object.keys(o), vs = new Array(ks.length);
    for(var j = 0; j < ks.length; j++){
      var k = ks[j], v = o[k];
      if(typeof v === 'object' && v !== null){ vs[j] = OBJ; v = JSON.parse(JSON.stringify(v)); }
      else vs[j] = v;
      if(v === undefined || typeof v === 'function') continue;
      if(typeof v === 'number' && !isFinite(v)) v = null;
      c[k] = v; n++;
    }
    return { v:c, n:n, ks:ks, vs:vs, mark:0 };
  }
  // Повільне, але точне порівняння за правилами JSON (undefined/функції ігноруються, NaN = null)
  function slowSame(o, e){
    var c = e.v, n = 0;
    for(var k in o){
      var v = o[k];
      if(v === undefined || typeof v === 'function') continue;
      n++;
      var cv = c[k];
      if(typeof v === 'object' && v !== null){
        if(typeof cv !== 'object' || cv === null || JSON.stringify(v) !== JSON.stringify(cv)) return false;
      } else if(typeof v === 'number' && !isFinite(v)){
        if(cv !== null) return false;
      } else if(v !== cv) return false;
    }
    return n === e.n;
  }
  // Швидкий шлях: ті самі ключі, ті самі прості значення → однакові. Інакше — повільна перевірка.
  function same(o, e){
    var ks = e.ks, vs = e.vs, len = ks.length;
    if(Object.keys(o).length === len){
      var ok = true;
      for(var j = 0; j < len; j++){ if(o[ks[j]] !== vs[j]){ ok = false; break; } }
      if(ok) return true;
    }
    return slowSame(o, e);
  }
  // Ключ елемента: сам id (рядок) без зайвих алокацій; дубль або відсутній id — ключ за позицією «#i».
  function idKey(id){
    if(typeof id === 'string'){ var c = id.charCodeAt(0); return (c === 35 || c === 126) ? '~s' + id : id; }
    if(typeof id === 'number') return '~n' + id;
    return null;
  }
  function keyOf(item, i, seen){
    var id = item && item.id, k = idKey(id);
    if(k !== null && !seen.has(k)){ seen.add(k); return k; }
    var pk = '#' + i; seen.add(pk);
    return pk;
  }
  function buildCol(arr){
    var keys = new Array(arr.length), map = new Map(), seen = new Set();
    for(var i = 0; i < arr.length; i++){
      var k = keyOf(arr[i], i, seen);
      keys[i] = k; map.set(k, cpItem(arr[i]));
    }
    return { keys:keys, map:map };
  }
  function buildState(p){
    var s = { cols:{}, act:p.activeLayerId };
    COLS.forEach(function(c){ s.cols[c] = buildCol(p[c] || []); });
    return s;
  }
  function cloneState(s){
    var r = { cols:{}, act:s.act };
    COLS.forEach(function(c){ r.cols[c] = { keys:s.cols[c].keys, map:new Map(s.cols[c].map) }; });
    return r;
  }
  function keysEqual(a, b){
    if(a.length !== b.length) return false;
    for(var i = 0; i < a.length; i++) if(a[i] !== b[i]) return false;
    return true;
  }
  var EPOCH = 0;
  // Різниця «стан sc → поточний проєкт». null — однакові.
  function diffCol(sc, arr){
    var ep = ++EPOCH, map = sc.map, skeys = sc.keys, sl = skeys.length;
    var mods = [], adds = [], addSeen = null, orderSame = (arr.length === sl), matched = 0;
    for(var i = 0; i < arr.length; i++){
      var item = arr[i], k = idKey(item && item.id), e;
      if(k !== null && (e = map.get(k)) !== undefined && e.mark !== ep){ /* перше входження id */ }
      else if(k !== null && e === undefined && !(addSeen && addSeen.has(k))){ e = undefined; }
      else { k = '#' + i; e = map.get(k); if(e !== undefined && e.mark === ep) e = undefined; }
      if(e !== undefined){
        e.mark = ep; matched++;
        if(!same(item, e)) mods.push([k, e, cpItem(item)]);
      } else {
        (addSeen || (addSeen = new Set())).add(k);
        adds.push([k, cpItem(item)]);
      }
      if(orderSame && skeys[i] !== k) orderSame = false;
    }
    var rems = [];
    if(sl - matched > 0){
      for(var j = 0; j < sl; j++){ var oe = map.get(skeys[j]); if(oe.mark !== ep) rems.push([skeys[j], oe]); }
    }
    var seq = null, append = false;
    if(!orderSame){
      // порядок змінився: відновлюємо повний список ключів нового стану
      var nk = new Array(arr.length), seen = new Set();
      for(var q = 0; q < arr.length; q++) nk[q] = keyOf(arr[q], q, seen);
      if(rems.length === 0 && nk.length > sl){
        append = true;
        for(var r = 0; r < sl; r++) if(nk[r] !== skeys[r]){ append = false; break; }
      }
      if(!append) seq = { o:skeys, n:nk };
    }
    if(!mods.length && !adds.length && !rems.length && !seq) return null;
    return { mods:mods, adds:adds, rems:rems, seq:seq, append:append };
  }
  function diffState(s, p){
    var patch = { cols:{}, act:null }, any = false;
    COLS.forEach(function(c){
      var d = diffCol(s.cols[c], p[c] || []);
      if(d){ patch.cols[c] = d; any = true; }
    });
    if(p.activeLayerId !== s.act){ patch.act = { o:s.act, n:p.activeLayerId }; any = true; }
    return any ? patch : null;
  }
  // Застосувати патч до збереженого стану (dir: 'back' — повернути старе, 'forward' — нове).
  function applyToState(s, patch, dir){
    var back = dir === 'back';
    COLS.forEach(function(c){
      var cp = patch.cols[c]; if(!cp) return;
      var sc = s.cols[c];
      (back ? cp.adds : cp.rems).forEach(function(x){ sc.map.delete(x[0]); });
      (back ? cp.rems : cp.adds).forEach(function(x){ sc.map.set(x[0], x[1]); });
      cp.mods.forEach(function(x){ sc.map.set(x[0], back ? x[1] : x[2]); });
      if(cp.seq) sc.keys = back ? cp.seq.o : cp.seq.n;
      else if(cp.append){
        sc.keys = back ? sc.keys.slice(0, sc.keys.length - cp.adds.length)
                       : sc.keys.concat(cp.adds.map(function(x){ return x[0]; }));
      }
    });
    if(patch.act) s.act = back ? patch.act.o : patch.act.n;
  }
  // Привести ЖИВИЙ проєкт до стану dest: змінені елементи — свіжі копії, решта лишається тими самими обʼєктами.
  function restoreLive(p, patch, dest){
    COLS.forEach(function(c){
      var cp = patch.cols[c]; if(!cp) return;
      var cur = p[c] || [], seen = new Set(), liveMap = new Map();
      for(var i = 0; i < cur.length; i++) liveMap.set(keyOf(cur[i], i, seen), cur[i]);
      var changed = new Set();
      cp.mods.forEach(function(x){ changed.add(x[0]); });
      cp.adds.forEach(function(x){ changed.add(x[0]); });
      cp.rems.forEach(function(x){ changed.add(x[0]); });
      var dc = dest.cols[c], out = new Array(dc.keys.length);
      for(var j = 0; j < dc.keys.length; j++){
        var k = dc.keys[j], o = changed.has(k) ? undefined : liveMap.get(k);
        out[j] = o !== undefined ? o : cpItem(dc.map.get(k).v).v;
      }
      p[c] = out;
    });
    if(dest.act) p.activeLayerId = dest.act; // як і раніше: порожній activeLayerId не відновлюємо
  }

  function create(opts){
    var getProject = opts.project;
    var U = { T:null, patches:[], redo:[], B:null, lastMs:0 };

    function push(){
      var t0 = performance.now(), p = getProject();
      if(!U.T){ U.T = buildState(p); U.patches = []; }
      else {
        var d = diffState(U.T, p);
        if(d){
          U.patches.push(d); applyToState(U.T, d, 'forward');
          while(U.patches.length + 1 > LIMIT) U.patches.shift();
        }
      }
      U.lastMs = performance.now() - t0;
    }
    function undo(){
      var p = getProject(), d = null;
      while(U.T){
        d = diffState(U.T, p);
        if(d) break;
        if(!U.patches.length){ U.T = null; break; }
        applyToState(U.T, U.patches.pop(), 'back'); // крок, однаковий з поточним станом, пропускаємо
      }
      if(!U.T || !d) return false;
      // «Вперед» чинне лише для стану, куди ми прийшли попереднім «назад»; після нової дії воно застаріло
      if(U.B && diffState(U.B, p)){ U.redo.length = 0; U.B = null; }
      U.redo.push(d); if(U.redo.length > LIMIT) U.redo.shift();
      var dest = cloneState(U.T);
      restoreLive(p, d, dest);
      U.B = dest;
      if(U.patches.length) applyToState(U.T, U.patches.pop(), 'back'); else U.T = null;
      return true;
    }
    function redo(){
      var p = getProject();
      if(U.B && diffState(U.B, p)) U.redo.length = 0;
      if(!U.redo.length) return false;
      var r = U.redo.pop();
      // поточний стан стає новим кроком «назад»
      if(!U.T){ U.T = buildState(p); U.patches = []; }
      else {
        var d2 = diffState(U.T, p) || { cols:{}, act:null };
        U.patches.push(d2); applyToState(U.T, d2, 'forward');
        while(U.patches.length + 1 > LIMIT) U.patches.shift();
      }
      if(!U.B) U.B = buildState(p);
      applyToState(U.B, r, 'forward');
      restoreLive(p, r, U.B);
      return true;
    }
    function reset(){ U.T = null; U.patches = []; U.redo = []; U.B = null; }
    // Підготувати початковий стан у вільний момент (після відкриття проєкту), щоб ПЕРША дія користувача
    // не платила за повну копію. Те саме, що зробив би перший push(): знімок поточного стану.
    function warm(){ if(!U.T){ U.T = buildState(getProject()); U.patches = []; } }
    return { push:push, undo:undo, redo:redo, reset:reset, warm:warm,
             _U:U, stats:function(){ return { steps:U.patches.length + (U.T ? 1 : 0), redo:U.redo.length, lastPushMs:U.lastMs }; } };
  }
  root.TWUndo = { create:create };
})(typeof window !== 'undefined' ? window : globalThis);
