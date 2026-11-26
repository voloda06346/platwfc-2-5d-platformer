/* PLATWFC legacy companion AI: ES3-compatible, DOM-only. */
(function () {
  function makeBot(stage, name, colour, startX, direction, minX, maxX) {
    var root = document.createElement("div");
    root.className = "legacy-bot";
    root.style.left = startX + "px";
    root.style.top = "300px";
    root.style.backgroundColor = colour;

    var head = document.createElement("div");
    head.className = "legacy-bot-head";
    head.style.backgroundColor = colour;
    root.appendChild(head);

    var body = document.createElement("div");
    body.className = "legacy-bot-body";
    body.style.backgroundColor = colour;
    root.appendChild(body);

    var label = document.createElement("div");
    label.className = "legacy-bot-name";
    label.appendChild(document.createTextNode(name));
    root.appendChild(label);

    stage.appendChild(root);
    return {
      element: root,
      x: startX,
      direction: direction,
      minX: minX,
      maxX: maxX,
      phase: Math.random() * 5,
      speed: 1.2 + Math.random() * 0.45
    };
  }

  window.PLATWFCLegacyBots = {
    create: function (stage) {
      var bots = [];
      bots.push(makeBot(stage, "BOT NOVA", "#31b989", 170, 1, 38, 300));
      bots.push(makeBot(stage, "BOT PIXEL", "#4d8fe0", 245, -1, 40, 310));
      bots.push(makeBot(stage, "BOT COMET", "#a777d9", 95, 1, 42, 302));
      return bots;
    },

    update: function (bots, tick) {
      var i;
      for (i = 0; i < bots.length; i++) {
        var bot = bots[i];
        var jump;
        bot.x += bot.direction * bot.speed;
        if (bot.x >= bot.maxX) {
          bot.x = bot.maxX;
          bot.direction = -1;
        } else if (bot.x <= bot.minX) {
          bot.x = bot.minX;
          bot.direction = 1;
        }

        bot.phase += 0.11;
        jump = Math.sin(bot.phase) * 4;
        bot.element.style.left = Math.round(bot.x) + "px";
        bot.element.style.top = Math.round(300 - Math.abs(jump)) + "px";
        bot.element.style.borderBottomWidth = (jump > 0 ? 4 : 2) + "px";
      }
    }
  };
}());
