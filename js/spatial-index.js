/* spatial-index.js — просторовий індекс розміщень (сітка клітинок 512×512 світових пікселів).
   Навіщо: render() раніше щокадру перебирав УСІ розміщення, щоб знайти видимі. З індексом береться лише
   те, що лежить у клітинках під екраном — кадр більше не залежить від розміру карти.
   Індекс зберігає для кожної ПОЗИЦІЇ в масиву її межі (x0,y0,x1,y1). Зміни відстежує refresh():
   один прохід порівнює межі з поточними й виправляє лише те, що змінилось (додані, видалені, переміщені,
   переставлені). Тому не потрібно ловити кожну зміну поля в коді редактора.
   Звичайний скрипт: глобальний TWSpatial. Логіка не залежить від решти редактора. */
(function(root){
  var CELL = 512, MAXCELLS = 64; // елемент, що перекриває понад 64 клітинки, вважаємо «широким» і завжди перевіряємо
  function sameNum(a, b){ return a === b || (a !== a && b !== b); }
  function create(){
    var cap = 0, box = new Float64Array(0), st = new Uint8Array(0), stamp = new Uint32Array(0), sc = 0;
    var n = 0, cells = new Map(), wild = new Set(), tmp = new Float64Array(4), out = new Int32Array(1024);
    // st[i]: 0 — порожньо (позиції немає), 1 — у клітинках, 2 — «широкий»/нечисловий (завжди кандидат),
    // 3 — меж немає (напр. картинка тайла не завантажена): теж завжди кандидат — виділити такий тайл (щоб видалити) мусить вдаватися
    function ensureCap(m){
      if(m <= cap) return;
      var nc = Math.max(m, cap * 2, 1024);
      var nb = new Float64Array(nc * 4); nb.set(box); box = nb;
      var ns = new Uint8Array(nc); ns.set(st); st = ns;
      var nt = new Uint32Array(nc); nt.set(stamp); stamp = nt;
      cap = nc;
    }
    function cellKey(cx, cy){ return (cx + 32768) * 65536 + (cy + 32768); }
    function range(i){
      var b = i * 4, x0 = box[b], y0 = box[b+1], x1 = box[b+2], y1 = box[b+3];
      if(!isFinite(x0) || !isFinite(y0) || !isFinite(x1) || !isFinite(y1)) return null;
      var cx0 = Math.floor(x0 / CELL), cx1 = Math.floor(x1 / CELL), cy0 = Math.floor(y0 / CELL), cy1 = Math.floor(y1 / CELL);
      if(cx0 > cx1){ var t = cx0; cx0 = cx1; cx1 = t; }
      if(cy0 > cy1){ var u = cy0; cy0 = cy1; cy1 = u; }
      if((cx1 - cx0 + 1) * (cy1 - cy0 + 1) > MAXCELLS || cx0 < -32768 || cy0 < -32768 || cx1 > 32767 || cy1 > 32767) return null;
      return [cx0, cy0, cx1, cy1];
    }
    function indexItem(i){
      var r = range(i);
      if(!r){ st[i] = 2; wild.add(i); return; }
      st[i] = 1;
      for(var cx = r[0]; cx <= r[2]; cx++) for(var cy = r[1]; cy <= r[3]; cy++){
        var k = cellKey(cx, cy), a = cells.get(k);
        if(a === undefined) cells.set(k, [i]); else a.push(i);
      }
    }
    function unindexItem(i){
      var s = st[i];
      if(s === 2 || s === 3){ wild.delete(i); }
      else if(s === 1){
        var r = range(i);
        for(var cx = r[0]; cx <= r[2]; cx++) for(var cy = r[1]; cy <= r[3]; cy++){
          var k = cellKey(cx, cy), a = cells.get(k);
          if(a === undefined) continue;
          var p = a.indexOf(i);
          if(p >= 0){ a[p] = a[a.length - 1]; a.pop(); if(!a.length) cells.delete(k); }
        }
      }
      st[i] = 0;
    }
    // bboxOf(p, out4) → true і заповнює out4 = [x0,y0,x1,y1], або false (немає меж: тайл не завантажено)
    // Повертає кількість змін. Якщо змінилось понад чверть — простіше перебудувати з нуля (так і робимо).
    function refresh(arr, bboxOf){
      var m = arr.length, changed = 0, old = n;
      ensureCap(m);
      var first = (old === 0);
      for(var i = 0; i < m; i++){
        var has = bboxOf(arr[i], tmp), b = i * 4;
        if(i < old){
          var s = st[i];
          if(has === (s === 1 || s === 2) && (!has || (sameNum(box[b], tmp[0]) && sameNum(box[b+1], tmp[1]) && sameNum(box[b+2], tmp[2]) && sameNum(box[b+3], tmp[3])))) continue;
          unindexItem(i);
        }
        changed++;
        if(has){ box[b] = tmp[0]; box[b+1] = tmp[1]; box[b+2] = tmp[2]; box[b+3] = tmp[3]; indexItem(i); }
        else { st[i] = 3; wild.add(i); }
      }
      for(var j = m; j < old; j++){ if(st[j]) unindexItem(j); }
      n = m;
      return first ? 0 : changed;
    }
    function reset(){ cells.clear(); wild.clear(); st.fill(0); n = 0; }
    // Індекси елементів, що МОЖУТЬ перекривати прямокутник, за зростанням (щоб порядок був як у масиві)
    function query(x0, y0, x1, y1){
      var cx0 = Math.floor(x0 / CELL), cx1 = Math.floor(x1 / CELL), cy0 = Math.floor(y0 / CELL), cy1 = Math.floor(y1 / CELL);
      sc = (sc + 1) >>> 0; if(sc === 0){ stamp.fill(0); sc = 1; }
      var cnt = 0;
      function add(i){
        if(stamp[i] === sc) return;
        stamp[i] = sc;
        if(cnt === out.length){ var no = new Int32Array(out.length * 2); no.set(out); out = no; }
        out[cnt++] = i;
      }
      var cellsInRect = (cx1 - cx0 + 1) * (cy1 - cy0 + 1);
      if(cellsInRect > cells.size){ // екран більший за карту: простіше пройти всі наявні клітинки
        cells.forEach(function(a, k){
          var cx = Math.floor(k / 65536) - 32768, cy = (k % 65536) - 32768;
          if(cx >= cx0 && cx <= cx1 && cy >= cy0 && cy <= cy1) for(var q = 0; q < a.length; q++) add(a[q]);
        });
      } else {
        for(var cx = cx0; cx <= cx1; cx++) for(var cy = cy0; cy <= cy1; cy++){
          var a = cells.get(cellKey(cx, cy));
          if(a !== undefined) for(var q = 0; q < a.length; q++) add(a[q]);
        }
      }
      wild.forEach(add);
      var res = out.subarray(0, cnt); res.sort();
      return res;
    }
    return { refresh:refresh, query:query, reset:reset,
             box:function(){ return box; }, size:function(){ return n; }, cellCount:function(){ return cells.size; } };
  }
  root.TWSpatial = { create:create, same:sameNum };
})(typeof window !== 'undefined' ? window : globalThis);
