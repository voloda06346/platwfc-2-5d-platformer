/* PLATWFC legacy client: ES3-compatible DOM renderer for Opera 9.x. */
(function () {
  var stage;
  var hero;
  var cursor;
  var message;
  var heroX = 70;
  var heroY = 304;
  var velocityX = 0;
  var velocityY = 0;
  var grounded = true;
  var heldKeys = {};
  var dragging = null;
  var dragOffsetX = 0;
  var dragOffsetY = 0;
  var targetWall = null;
  var bots = [];
  var tick = 0;
  var walls = [];
  var platforms = [
    { left: 20, top: 350, width: 324 },
    { left: 375, top: 280, width: 174 },
    { left: 585, top: 215, width: 154 }
  ];

  function byId(id) {
    return document.getElementById(id);
  }

  function stagePoint(event) {
    var rect = stage.getBoundingClientRect ? stage.getBoundingClientRect() : null;
    var x;
    var y;
    if (rect) {
      x = event.clientX - rect.left;
      y = event.clientY - rect.top;
    } else {
      x = event.clientX - stage.offsetLeft;
      y = event.clientY - stage.offsetTop;
    }
    return { x: x, y: y };
  }

  function setMessage(text) {
    message.innerHTML = text;
  }

  function moveHero() {
    var oldBottom = heroY + 48;
    var newBottom;
    var i;
    var platform;
    var wasGrounded = grounded;

    if (heldKeys.left) velocityX -= 0.65;
    if (heldKeys.right) velocityX += 0.65;
    if (!heldKeys.left && !heldKeys.right) velocityX *= 0.78;
    if (velocityX > 4.5) velocityX = 4.5;
    if (velocityX < -4.5) velocityX = -4.5;

    heroX += velocityX;
    if (heroX < 5) { heroX = 5; velocityX = 0; }
    if (heroX > 725) { heroX = 725; velocityX = 0; }

    velocityY += 0.58;
    if (velocityY > 12) velocityY = 12;
    heroY += velocityY;
    newBottom = heroY + 48;
    grounded = false;

    if (velocityY >= 0) {
      for (i = 0; i < platforms.length; i++) {
        platform = platforms[i];
        if (oldBottom <= platform.top && newBottom >= platform.top &&
            heroX + 27 > platform.left && heroX < platform.left + platform.width) {
          heroY = platform.top - 48;
          velocityY = 0;
          grounded = true;
          break;
        }
      }
    }

    if (!grounded && heroY > 420) {
      heroX = 70;
      heroY = 302;
      velocityX = 0;
      velocityY = 0;
      grounded = true;
      setMessage("ВОЗВРАТ НА СТАРТОВУЮ ПЛАТФОРМУ");
    }

    hero.style.left = Math.round(heroX) + "px";
    hero.style.top = Math.round(heroY) + "px";
    if (grounded && !wasGrounded) hero.style.height = "44px";
    else if (!grounded) hero.style.height = "42px";
  }

  function findWallAt(x, y) {
    var i;
    var wall;
    for (i = 0; i < walls.length; i++) {
      wall = walls[i];
      if (!wall.fallen && x >= wall.x && x <= wall.x + 44 &&
          y >= wall.y && y <= wall.y + 94) return wall;
    }
    return null;
  }

  function updateWalls() {
    var i;
    var wall;
    for (i = 0; i < walls.length; i++) {
      wall = walls[i];
      if (!wall.falling) continue;
      wall.fall += 1;
      wall.element.style.left = (wall.x + wall.fall * 2) + "px";
      wall.element.style.top = (wall.y + wall.fall * 2) + "px";
      if (wall.fall > 22) {
        wall.fallen = true;
        wall.falling = false;
        wall.element.style.display = "none";
      }
    }
  }

  function activateWall(wall) {
    if (!wall || wall.fallen || wall.falling) return;
    wall.falling = true;
    wall.fall = 0;
    setMessage("СТЕНА ПАДАЕТ! ПРОХОД ОТКРЫВАЕТСЯ");
  }

  function makeDraggable(element) {
    element.onmousedown = function (event) {
      var point = stagePoint(event || window.event);
      dragging = element;
      dragOffsetX = point.x - element.offsetLeft;
      dragOffsetY = point.y - element.offsetTop;
      setMessage("ОБЪЕКТ ВЗЯТ — ПЕРЕТАЩИ ЕГО");
      return false;
    };
  }

  function updateCursor(event) {
    var point = stagePoint(event || window.event);
    var wall = findWallAt(point.x, point.y);
    cursor.style.left = (point.x - 8) + "px";
    cursor.style.top = (point.y - 8) + "px";
    if (wall) {
      cursor.style.backgroundColor = "#ffe18b";
      targetWall = wall;
      setMessage("НАЖМИ F ИЛИ КЛИКНИ ПО СТЕНЕ");
    } else {
      cursor.style.backgroundColor = "#35d7e8";
      targetWall = null;
    }
    if (dragging) {
      dragging.style.left = Math.max(0, Math.min(710, point.x - dragOffsetX)) + "px";
      dragging.style.top = Math.max(0, Math.min(355, point.y - dragOffsetY)) + "px";
    }
  }

  function onKeyDown(event) {
    var code = event.keyCode || event.which;
    if (code === 37 || code === 65 || code === 175) heldKeys.left = true;
    if (code === 39 || code === 68 || code === 177) heldKeys.right = true;
    if (code === 38 || code === 87 || code === 172 || code === 13) {
      if (grounded) { velocityY = -10.5; grounded = false; }
    }
    if (code === 32) {
      if (grounded) { velocityY = -10.5; grounded = false; }
    }
    if (code === 70 || code === 102) activateWall(targetWall);
    if (code === 40 || code === 83) heldKeys.down = true;
    if (event.preventDefault) event.preventDefault();
    event.returnValue = false;
  }

  function onKeyUp(event) {
    var code = event.keyCode || event.which;
    if (code === 37 || code === 65 || code === 175) heldKeys.left = false;
    if (code === 39 || code === 68 || code === 177) heldKeys.right = false;
    if (code === 40 || code === 83) heldKeys.down = false;
  }

  function bindButton(id, key) {
    var button = byId(id);
    button.onmousedown = function () { heldKeys[key] = true; return false; };
    button.onmouseup = function () { heldKeys[key] = false; };
    button.onmouseout = function () { heldKeys[key] = false; };
  }

  function update() {
    tick += 1;
    moveHero();
    updateWalls();
    if (window.PLATWFCLegacyBots) window.PLATWFCLegacyBots.update(bots, tick);
  }

  function boot() {
    stage = byId("stage");
    hero = byId("hero");
    cursor = byId("helper-cursor");
    message = byId("message");

    walls.push({ element: byId("wall1"), x: 280, y: 260, fall: 0, falling: false, fallen: false });
    walls.push({ element: byId("wall2"), x: 445, y: 190, fall: 0, falling: false, fallen: false });

    byId("wall1").onclick = function () { activateWall(walls[0]); };
    byId("wall2").onclick = function () { activateWall(walls[1]); };
    makeDraggable(byId("crate1"));
    makeDraggable(byId("crate2"));

    stage.onmousemove = updateCursor;
    stage.onmouseup = function () { dragging = null; };
    stage.onclick = function (event) {
      var point = stagePoint(event || window.event);
      var wall = findWallAt(point.x, point.y);
      if (wall) activateWall(wall);
    };

    document.onmousemove = function (event) {
      if (dragging) updateCursor(event || window.event);
    };
    document.onmouseup = function () { dragging = null; };
    document.onkeydown = onKeyDown;
    document.onkeyup = onKeyUp;

    bindButton("leftButton", "left");
    bindButton("rightButton", "right");
    byId("jumpButton").onclick = function () {
      if (grounded) { velocityY = -10.5; grounded = false; }
    };
    byId("wallButton").onclick = function () { activateWall(targetWall); };

    if (window.PLATWFCLegacyBots) bots = window.PLATWFCLegacyBots.create(stage);
    window.setInterval(update, 35);
  }

  if (window.addEventListener) window.addEventListener("load", boot, false);
  else window.onload = boot;
}());
