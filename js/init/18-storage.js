/* js/init/18-storage.js — Код запуску теми: Збереження: IndexedDB, картинки окремо, завантаження, проєкти, експорт у файл, імпорт. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ---------- projects ----------
  IDX_KEY = 'zone-edit-projects-index';
  ACTIVE_KEY = 'zone-edit-active-project';

  // ---------- IndexedDB для самих даних проєкту (тайли з base64-картинками) ----------
  // РАНІШЕ все (включно з картинками всіх текстур у base64) писалось у localStorage, а в нього
  // жорсткий ліміт ~5-10МБ на весь сайт — саме тому й лізло "сховище переповнене": кілька
  // текстур середньої якості й ліміт вичерпано, а localStorage.setItem() при переповненні не
  // дописує ЧАСТИНУ даних, він просто кидає виняток і НЕ зберігає нічого. IndexedDB — інше
  // сховище в тому самому браузері, з лімітом не в мегабайтах, а в частці вільного місця на
  // диску (типово сотні МБ і більше) — саме для таких обсягів даних воно й існує. IDX_KEY/
  // ACTIVE_KEY (самі лише id/назви/дати, без картинок) лишились у localStorage — вони крихітні
  // й ніколи не впруться в ліміт, тому їх немає сенсу переносити.
  IDB_NAME = 'tileweaver-db', IDB_STORE = 'projects';
  idbPromise = null;
  // Читає дані проєкту: спочатку з IndexedDB, і якщо там ще нема (старий проєкт з ДО цього
  // переходу з localStorage) — підхоплює зі старого localStorage-ключа й одразу переносить у
  // IndexedDB у фоні, щоб наступного разу читалось вже звідти. Так існуючі проєкти користувачів
  // НЕ губляться при оновленні застосунку — міграція відбувається непомітно, по одному проєкту,
  // саме в момент його відкриття.
  // ---- Збереження: картинки тайлів окремо від самого проєкту ----
  // Раніше кожне збереження клонувало в IndexedDB ВЕСЬ проєкт разом з base64-картинками всіх тайлів
  // (мегабайти), хоча картинки майже не змінюються. Тепер основний запис — це проєкт без картинок
  // (позначка split:true), а кожна картинка лежить під своїм ключем img:<проєкт>:<тайл> і записується
  // лише коли вона нова або змінилась. Старі записи (з dataURL усередині) відкриваються як раніше
  // і при першому ж збереженні непомітно переходять на новий формат.
  IMG_PREFIX = 'img:';
  BLANK_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
  imgSavedByProject = {};
  saveDebounceTimer = null, saveIdleHandle = null;
  // Лічильник збережень ПЕР проєкт — про всяк випадок, навіть попри те, що IndexedDB сама
  // гарантує: транзакції на той самий store виконуються в порядку СТВОРЕННЯ (не завершення),
  // тому новіший idbSet() і так завжди "виграє" останнім значенням. Але саме ОНОВЛЕННЯ
  // ІНДЕКСУ (getIndex/setIndex, окремий крок ПІСЛЯ запису) читає localStorage заново в кожному
  // .then() — якщо два flush підряд (напр. швидке згортання+розгортання) завершаться в
  // неочікуваному порядку, пізніший .then() міг би перезаписати індекс застарілим знімком.
  // Тому кожен flush отримує номер, і індекс оновлює лише НАЙОСТАННІШИЙ.
  saveSeqByProject = {};
  lastSaveMs = 0;
  window.addEventListener('beforeunload', flushSaveActiveProject);
  // beforeunload майже НЕ спрацьовує на мобільних браузерах, коли застосунок просто згортають
  // (свайп додому / перемикання на інший застосунок) — ОС може заморозити чи вбити вкладку без
  // попередження для JS. Саме тому "намалював — згорнув — а будинку нема": останні 400мс
  // дебаунсу так і не встигали записатись. visibilitychange з document.hidden ловить і згортання
  // теж (а не тільки закриття), pagehide — додатковий запасний варіант для деяких браузерів,
  // де visibilitychange поводиться нестабільно. Це головний фікс; кнопка "💾 Зберегти" — це
  // ручний запобіжник поверх нього, а не сам фікс.
  document.addEventListener('visibilitychange', function(){ if(document.hidden) flushSaveActiveProject(); });
  window.addEventListener('pagehide', flushSaveActiveProject);
  document.getElementById('manualSaveBtn').addEventListener('click', function(){
    flushSaveActiveProject();
    toast(t('toastSaved'));
  });

  projectsModal = document.getElementById('projectsModal');
  projList = document.getElementById('projList');
  document.getElementById('projectsClose').addEventListener('click', function(){ projectsModal.style.display='none'; });
  document.getElementById('exportProjectBtn').addEventListener('click', exportToFile);
  document.getElementById('importProjectBtn').addEventListener('click', function(){
    document.getElementById('importFileInput').click();
  });
  document.getElementById('importFileInput').addEventListener('change', function(e){
    var file = e.target.files && e.target.files[0];
    e.target.value = ''; // щоб можна було обрати той самий файл ще раз
    if(!file) return;
    var reader = new FileReader();
    reader.onload = function(ev){
      // Деякі застосунки на Android (файл-менеджери, месенджери, що "перестрибують" файл через
      // власне сховище) дописують на початок файлу невидимий BOM-символ (\uFEFF) — сам файл при
      // цьому валідний JSON, але JSON.parse одразу падає на позиції 0 і показує "пошкоджений",
      // хоча насправді пошкоджень нема. Прибираємо BOM перед парсингом — це найчастіша причина
      // хибного "файл пошкоджений" для файлів, які САМ додаток щойно експортував.
      var raw = ev.target.result;
      var text = raw.charCodeAt(0)===0xFEFF ? raw.slice(1) : raw;
      var data;
      try{ data = JSON.parse(text); }
      catch(err){
        // Показуємо РЕАЛЬНУ причину (а не просто "пошкоджений") — щоб можна було зрозуміти,
        // що саме не так, замість здогадок.
        toast(t('toastFileCorrupt')+': '+err.message);
        console.error('TileWeaver import parse error:', err, 'file size:', raw.length, 'first 80 chars:', raw.slice(0,80));
        return;
      }
      if(!data || typeof data!=='object' || !data.tiles){ toast(t('toastNotProjectFile')); return; }
      data.id = 'proj_'+Date.now()+'_'+Math.random().toString(36).slice(2,7); // новий id — щоб імпорт НЕ перезаписав існуючий проєкт з тим самим id, і щоб два імпорти впритул не зіткнулись
      if(!data.name) data.name = 'Імпортований проєкт';
      data.name = String(data.name);
      if(typeof data.gridType !== 'string') data.gridType = 'iso';
      data.cellSize = (typeof data.cellSize==='number' && data.cellSize>=8 && data.cellSize<=1024) ? data.cellSize : 64;
      Object.keys(data.tiles).forEach(function(k){ var tl = data.tiles[k]; if(!tl || typeof tl.dataURL!=='string' || tl.dataURL.indexOf('data:image/')!==0) delete data.tiles[k]; });
      loadProjectData(data);
      flushSaveActiveProject();
      projectsModal.style.display = 'none';
      toast(t('toastProjectImported').replace('{name}', data.name));
    };
    reader.onerror = function(){ toast(t('toastFileReadFail')); };
    reader.readAsText(file);
  });
  newProjModal = document.getElementById('newProjModal');
  document.getElementById('newProjectBtn').addEventListener('click', function(){
    document.getElementById('newProjName').value = 'Map '+(getIndex().length+1);
    projectsModal.style.display='none'; newProjModal.style.display='flex';
  });
  document.getElementById('newProjCancel').addEventListener('click', function(){ newProjModal.style.display='none'; });
  document.getElementById('newProjOk').addEventListener('click', function(){
    createProject(document.getElementById('newProjName').value || 'Map');
    newProjModal.style.display='none';
  });
