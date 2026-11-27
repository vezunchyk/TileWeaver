/* js/init/08-collision.js — Код запуску теми: Вибір тапом по пікселю, колізії «З текстури» (контур), ізометрична колізія. Підписки на події, змінні стану, прив'язка кнопок.
   Звичайний скрипт: спільна глобальна область з рештою файлів. Виконується при запуску (порядок як у вихідному коді). */


  // ===== Вибір тапом: по ПІКСЕЛЮ. Обирається тайл, якому належить піксель під пальцем (навіть якщо він
  // перекритий іншими тайлами, а видно лише кілька пікселів). Прозорі частини тайла не «ловлять» дотик.
  var alphaCache = {};

  // ===== Колізія «З текстури» має брати ТІЛЬКИ непрозорі пікселі, а не весь прямокутник картинки.
  // Рахуємо межі непрозорого контенту у пікселях кадру (кеш на тайл+кадр), потім переводимо у світ
  // з урахуванням масштабу, pivot, віддзеркалення, нахилу і повороту (так само, як pixelHitAt).
  var opqCache = {};

  var SPAWN_R = 14;

  var renderScheduled = false;
  // Розмір області карти кешуємо (getBoundingClientRect щокадру змушує браузер перераховувати розкладку).
  var wrapRectCache = null;
  window.addEventListener('resize', function(){ invalidateWrapRect(); scheduleRender(); });
  window.addEventListener('orientationchange', invalidateWrapRect);
  if(window.ResizeObserver) new ResizeObserver(function(){ invalidateWrapRect(); scheduleRender(); }).observe(wrap);
