'use strict';

/**
 * @author       Jeremy Dowell <jeremy@codevinsky.com>
 * @author       Matthias Steinböck <grillen@abendstille.at>
 * @license      {@link http://www.wtfpl.net/txt/copying/|WTFPL}
 */

/**
 * Creates a new `Automata` object.
 *
 * @class Phaser.Plugin.Automata
 * @constructor
 *
 * @param {Phaser.Game} game Current game instance.
 * @param {any} parent - The object that owns this plugin, usually Phaser.PluginManager.
 * @param {object} options
 */
Phaser.Plugin.Automata = function (game, parent, options) {

  Phaser.Plugin.call(this, game, parent);

  this._sprite = null;
  this._edges = null; // set by setOptions
  this._radius = null; // set by setSprite
  this._options = {};
  this._debugGraphics = null; // only set if debug is enabled

  this.setOptions(options);

  if (this._options.game.debug)  {
    this._debugGraphics = game.add.graphics(0,0);
    this.renderDebug = new Phaser.Plugin.Automata.debug(this._debugGraphics);
  }

};

//	Extends the Phaser.Plugin template, setting up values we need
Phaser.Plugin.Automata.prototype = Object.create(Phaser.Plugin.prototype);
Phaser.Plugin.Automata.prototype.constructor = Phaser.Plugin.Automata;


Phaser.Plugin.Automata.defaultOptions = Object.freeze({
  game: {
    wrapWorldBounds: true,
    rotateToVelocity: true,
    edgeWidth: 25,
    debug: false
  },

  forces: {
    maxSpeed: 100.0,
    maxForce: 100.0
  },

  checkBounds: {
    name: 'checkBounds',
    enabled: true,
    priority: 0,
    strength: 1,
    method: Phaser.Plugin.Automata.prototype.checkBounds
  },

  flocking: {
    name: 'flocking',
    enabled: false,
    maxDistance: 200.0,
    minDistance: 50.0,
    separation: {
      strength: 1.0,
      desiredSeparation: 50.0
    },
    alignment: {
      strength: 1.0
    },
    cohesion: {
      strength: 1.0
    },
    flock: null,
    priority: 1,
    method: Phaser.Plugin.Automata.prototype.flock
  },

  seek: {
    name: 'seek',
    enabled: false,
    target: null,
    strength: 1.0,
    slowArrial: false,
    slowingRadius: 10,
    viewDistance: Number.MAX_VALUE,
    priority: 2,
    method: Phaser.Plugin.Automata.prototype.seek
  },

  flee: {
    name: 'flee',
    enabled: false,
    target: null,
    strength: 1.0,
    viewDistance: Number.MAX_VALUE,
    priority: 1,
    method: Phaser.Plugin.Automata.prototype.flee
  },

  pursue: {
    name: 'pursue',
    enabled: false,
    target: null,
    strength: 1.0,
    viewDistance: Number.MAX_VALUE,
    priority: 1,
    method: Phaser.Plugin.Automata.prototype.pursue
  },

  evade: {
    name: 'evade',
    enabled: false,
    target: null,
    strength: 1.0,
    viewDistance: Number.MAX_VALUE,
    priority: 1,
    method: Phaser.Plugin.Automata.prototype.evade
  },

  wander: {
    name: 'wander',
    enabled: false,
    strength: 1.0,
    distance: 3.5,
    radius: 3.0,
    theta: 0,
    change: 0.3,
    priority: 6,
    method: Phaser.Plugin.Automata.prototype.wander
  }
});

/**
 * Add a Sprite reference to this Plugin.
 * @type {Phaser.Sprite}
 */
Phaser.Plugin.Automata.prototype.addSprite = function (sprite) {

  this._sprite = sprite;
  this._radius = Math.sqrt(this._sprite.height * this._sprite.height + this._sprite.width * this._sprite.width) / 2;
};

/**
 * This is run when the plugins update during the core game loop.
 */
Phaser.Plugin.Automata.prototype.update = function () {

  if (this._sprite) {
    // write your prefab's specific update code here
    if (this._options.game.debug) {
      this.renderDebug.clear();
    }

    var accel = new Phaser.Point();

    for (var i in this._priorityList) {
      if (
        this._priorityList.hasOwnProperty(i) &&
        this._priorityList[i].hasOwnProperty('enabled') &&
        this._priorityList[i].hasOwnProperty('method') &&
        this._priorityList[i].enabled
      ) {
        var behavior = this._priorityList[i];

        accel.setTo(0, 0);
        accel = behavior.method.call(this, behavior.target, behavior.viewDistance);
        if (accel.getMagnitude() > 0) {
          this.applyForce(accel, behavior.strength);
        }
      }
    }

    if (this._options.game.rotateToVelocity) {
      this._sprite.rotation = Math.atan2(this._sprite.body.velocity.y, this._sprite.body.velocity.x);
    }

    this._sprite.body.velocity.limit(this._options.forces.maxSpeed);

    if (this._options.game.debug) {
      this.renderDebug.velocity(this);
    }
  }
};


Phaser.Plugin.Automata.prototype.setOptions = function (options) {
  this._options = Phaser.Utils.extend(true, Phaser.Plugin.Automata.defaultOptions, options);

  this._priorityList = [];
  for (var i in this._options) {
    if (
      this._options.hasOwnProperty(i) &&
      this._options[i].hasOwnProperty('priority')
    ) {
      this._options[i].priority = parseInt(this._options[i].priority, 10);
      this._priorityList.push(this._options[i]);
    }
  }

  this._priorityList.sort(function (a, b) {
    return a.priority - b.priority;
  });

  if (this._options.game.wrapWorldBounds === false) {
    this._edges = {
      left: this._options.game.edgeWidth,
      right: this.game.width - this._options.game.edgeWidth,
      top: this._options.game.edgeWidth,
      bottom: this.game.height - this._options.game.edgeWidth
    };
  } else {
    this._edges = {
      left: -this.radius,
      right: this.game.width + this.radius,
      top: -this.radius,
      bottom: this.game.height + this.radius
    };
  }
};


Phaser.Plugin.Automata.prototype.applyForce = function (force, strength) {
  if (this._sprite) {
    force.limit(this._options.forces.maxForce * strength);
    var velocity = Phaser.Point.add(this._sprite.body.velocity, force);
    this._sprite.body.velocity.add(velocity.x, velocity.y);
  }
};


Phaser.Plugin.Automata.prototype.checkBounds = function () {
  var steer = new Phaser.Point();
  if (this._options.game.wrapWorldBounds === true) {
    if (this._sprite.position.x < this.edges.left) {
      this._sprite.position.x = this.game.width + this.radius;
    }
    if (this._sprite.position.y < this.edges.top) {
      this._sprite.position.y = this.game.height + this.radius;
    }
    if (this._sprite.position.x > this.edges.right) {
      this._sprite.position.x = -this.radius;
    }
    if (this._sprite.position.y > this.edges.bottom) {
      this._sprite.position.y = -this.radius;
    }
  } else {
    var desired = new Phaser.Point();

    if (this._sprite.position.x < this._options.game.edgeWidth) {
      desired = new Phaser.Point(this._options.forces.maxSpeed, this.body.velocity.y);
    }
    else if (this._sprite.position.x > this.game.width - this._options.game.edgeWidth) {
      desired = new Phaser.Point(-this._options.forces.maxSpeed, this.body.velocity.y);
    }

    if (this._sprite.position.y < this._options.game.edgeWidth) {
      desired = new Phaser.Point(this.body.velocity.x, this._options.forces.maxSpeed);
    }
    else if (this._sprite.position.y > this.game.height - this._options.game.edgeWidth) {
      desired = new Phaser.Point(this.body.velocity.x, -this._options.game.edgeWidth);
    }

    steer = desired;
  }
  return steer;
};




/********************* DEBUG ****************************/

Phaser.Plugin.Automata.debug = function(graphics) {
  this.graphics = graphics;

  this.game = this.graphics.game;

  this.actionLabel = this.game.add.text(0,0,'');
  this.actionLabel.anchor.setTo(0.5, 0.5);
  this.actionLabel.fontSize = 12;
  this.actionLabel.font = 'Helvetica';

  this.distanceLabel = this.game.add.text(0,0,'');
  this.distanceLabel.anchor.setTo(0.5, 0.5);
  this.distanceLabel.fontSize = 12;
  this.distanceLabel.font = 'Helvetica';

};

Phaser.Plugin.Automata.debug.prototype = Object.create({
  setLabel: function(position, text, distance, color, alpha) {
    // TODO: color = Utils.hexToColorString(color);
    alpha = alpha || 1;

    this.actionLabel.x = position.x;
    this.actionLabel.y = position.y + 50;

    this.actionLabel.x = position.x;
    this.actionLabel.y = position.y + 65;


    this.actionLabel.setText(text);
    this.actionLabel.fill = color;
    this.actionLabel.alpha = alpha;

    this.distanceLabel.setText(distance);
    this.distanceLabel.fill = color;
    this.distanceLabel.alpha = alpha;
  },
  velocity: function(automata) {
    var line = new Phaser.Point(automata.x + automata.body.velocity.x, automata.y + automata.body.velocity.y);
    this.graphics.lineStyle(2, 0x000000,1);
    this.graphics.moveTo(automata.x, automata.y);
    this.graphics.lineTo(line.x, line.y);
    this.fill(0x000000,1, true, function() {
      this.graphics.drawCircle(line.x, line.y, 3);
    });
  },
  seek: function(position, target, viewDistance, active, slowingRadius, slowActive, color, alpha) {

    active = !!active;
    color = color || 0x89b7fd;
    alpha = alpha || 0.25;


    this.drawSensorRange(position, viewDistance, active, color, alpha);
    if (slowingRadius) {
      this.drawSensorRange(position, slowingRadius, slowActive, color, alpha);
    }
    if(active) {
      this.drawLineToTarget(position, target);
      this.setLabel(position, 'seeking', Phaser.Point.distance(position, target).toFixed(2), color, alpha);
    }

  },
  pursue: function(position, target, viewDistance, active, color, alpha) {

    active = !!active;
    color = color || 0x89fdbd;
    alpha = alpha || 0.25;


    this.drawSensorRange(position, viewDistance, active, color, alpha);
    if(active) {
      this.drawLineToTarget(position, target);
      this.setLabel(position, 'pursuing', Phaser.Point.distance(position, target).toFixed(2), color, alpha);
    }

  },
  flee: function(position, target, viewDistance, active, color, alpha) {

    active = !!active;
    color = color || 0xfd89fc;
    alpha = alpha || 0.25;


    this.drawSensorRange(position, viewDistance, active, color, alpha);

    if(active) {
      this.drawLineToTarget(position, target);
      this.setLabel(position, 'fleeing', Phaser.Point.distance(position, target).toFixed(2), color, alpha);
    }
  },
  evade: function(position, targets, viewDistance, active, color, alpha) {

    active = !!active;
    color = color || 0xff0000;
    alpha = alpha || 0.25;


    this.drawSensorRange(position, viewDistance, active, color, alpha);

    if(active) {
      targets.forEach(function(target) {
        this.drawLineToTarget(position, target);
      }, this);

      this.setLabel(position, 'evading', Phaser.Point.distance(position, targets[0]).toFixed(2), color, alpha);
    }

  },
  bounds: function(edgeWidth, active) {
    this.fill(0x999999, 1, active, function() {

      var x1 = edgeWidth;
      var x2 = this.game.width - edgeWidth;
      var y1 = edgeWidth;
      var y2 = this.game.height - edgeWidth;

      this.graphics.moveTo(x1,y1);
      this.graphics.lineTo(x2, y1);
      this.graphics.lineTo(x2, y2);
      this.graphics.lineTo(x1, y2);
      this.graphics.lineTo(x1,y1);
    });
  },
  drawSensorRange: function(position, viewDistance, active, color, alpha) {
    this.fill(color, alpha, active, function() {
      this.graphics.drawCircle(position.x, position.y, viewDistance);
    });
  },
  drawLineToTarget: function(position, target) {
    this.graphics.moveTo(position.x, position.y);
    this.graphics.lineTo(target.x, target.y);
  },
  fill: function(color, alpha, active, method) {
    this.graphics.lineStyle( 1, color, alpha);
    if(active) {
      this.graphics.beginFill(color, alpha);
    }
    method.call(this);
    if(active) {
      this.graphics.endFill();
    }
  },
  clear: function() {
    this.graphics.clear();
    this.actionLabel.setText('');
    this.distanceLabel.setText('');
  }
});

Phaser.Plugin.Automata.debug.constructor = Phaser.Plugin.Automata.debug;