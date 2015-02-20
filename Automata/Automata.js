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
 */
Phaser.Plugin.Automata = function (game, parent) {

  Phaser.Plugin.call(this, game, parent);

  this._sprite = null;
  this._edges = null; // set by setOptions
  this._radius = null; // set by setSprite
  this._options = {};
  this._debugGraphics = null; // only set if debug is enabled

  this._debugGraphics = game.add.graphics(0,0);
  this.renderDebug = new Phaser.Plugin.Automata.debug(this._debugGraphics);
};

//	Extends the Phaser.Plugin template, setting up values we need
Phaser.Plugin.Automata.prototype = Object.create(Phaser.Plugin.prototype);
Phaser.Plugin.Automata.prototype.constructor = Phaser.Plugin.Automata;


/**
 * Add a Sprite reference to this Plugin.
 * @type {Phaser.Sprite}
 */
Phaser.Plugin.Automata.prototype.setSprite = function (sprite) {

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

        accel = behavior.method.call(this, behavior.target, behavior.viewDistance);
        if (accel.getMagnitude() > 0) {
          this.applyForce(accel, behavior.strength);
        }
      }
    }

    if (this._options.game.rotateToVelocity) {
      this._sprite.rotation = Math.atan2(this._sprite.body.velocity.y, this._sprite.body.velocity.x);
    }

    this._sprite.body.velocity.setMagnitude(Math.min(
        this._options.forces.maxSpeed,
        this._sprite.body.velocity.getMagnitude()
    ));

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
    var limit = this._options.forces.maxForce * strength;
    force.setMagnitude(Math.min(limit, force.getMagnitude()));
    var velocity = Phaser.Point.add(this._sprite.body.velocity, force);
    this._sprite.body.velocity.add(velocity.x, velocity.y);
  }
};


/********************* Helper functions *********************/

Phaser.Plugin.Automata.prototype.getAllInRange = function(targets, viewDistance) {
  var inRange = [], difference;

  targets.forEachExists(function(target) {
    difference = Phaser.Point.subtract(target.position, this._sprite.position);
    if(difference.getMagnitude() < viewDistance) {
      inRange.push(target);
    }
  }, this);

  return inRange;
};

Phaser.Plugin.Automata.prototype.getClosestInRange = function(targetGroup, viewDistance) {
  var closestTarget = null;
  var closestDistance = viewDistance;

  if(!targetGroup) {
    return null;
  }

  targetGroup.forEachExists(function(target) {
    if(target instanceof Phaser.Group) {
      target = this.getClosestInRange(target);
    }
    var d;
    d = this._sprite.position.distance(target.position);

    if(d < closestDistance) {
      closestDistance = d;
      closestTarget = target;
    }
  }, this);

  return closestTarget;
};

Phaser.Plugin.Automata.prototype.getFuturePosition = function(target) {
  var difference, distance, time, targetPosition,
    tpos = target.position, pos = this._sprite.position;

  difference = Phaser.Point.subtract(tpos, pos);
  distance = difference.getMagnitude();
  if (!!target.body.velocity.getMagnitude()) {
    time = distance / target.body.velocity.getMagnitude();
    targetPosition = Phaser.Point.multiply(target.body.velocity, new Phaser.Point(time,time));
    targetPosition.add(tpos.x, tpos.y);
  } else {
    targetPosition = tpos;
  }

  return targetPosition;
};



/********************* Behaviors ****************************/


Phaser.Plugin.Automata.prototype.checkBounds = function () {
  var steer = new Phaser.Point();
  if (this._options.game.wrapWorldBounds === true) {
    if (this._sprite.position.x < this._edges.left) {
      this._sprite.position.x = this.game.width + this.radius;
    }
    if (this._sprite.position.y < this._edges.top) {
      this._sprite.position.y = this.game.height + this.radius;
    }
    if (this._sprite.position.x > this._edges.right) {
      this._sprite.position.x = -this.radius;
    }
    if (this._sprite.position.y > this._edges.bottom) {
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


Phaser.Plugin.Automata.prototype.seek = function(target, viewDistance, isSeeking) {
  isSeeking = typeof isSeeking === 'undefined' ? true : isSeeking;

  var steer = new Phaser.Point();

  var tpos, pos, desired, distance;

  viewDistance = viewDistance || this._options.seek.viewDistance;

  if(target instanceof Function) {
    target = target();
  }

  if(target instanceof Phaser.Group || target instanceof Array) {
    target = this.getClosestInRange(target, viewDistance);
  }

  if(!!target) {


    if (target instanceof Phaser.Point) {
      tpos = target;
    } else {
      tpos = target.position;
    }

    pos = this._sprite.position;

    desired = Phaser.Point.subtract(tpos, pos);
    distance = desired.getMagnitude();

    if(distance > 0 && distance < viewDistance) {
      desired.normalize();
      if(isSeeking && this._options.seek.slowArrival && distance < this._options.seek.slowingRadius) {
        var m = Phaser.Math.mapLinear(distance,0, viewDistance,0, this._options.forces.maxSpeed);
        desired.setMagnitude(desired.getMagnitude() * m);
      } else {
        desired.setMagnitude(desired.getMagnitude() * this._options.forces.maxSpeed);
      }



      steer = Phaser.Point.subtract(desired, this._sprite.body.velocity);
    }
  }

  if(this._options.game.debug && isSeeking) {
    this.renderDebug.seek(this._sprite.position, tpos, viewDistance, steer.getMagnitude(), this._options.seek.slowingRadius, distance < this._options.seek.slowingRadius );
  }

  return steer;
};

Phaser.Plugin.Automata.prototype.flee = function(target, viewDistance, isFleeing) {
  isFleeing = typeof isFleeing === 'undefined' ? true : isFleeing;
  viewDistance = viewDistance || this._options.flee.viewDistance;
  var steer = new Phaser.Point(),
    desired;
  if(!!target) {
    if(target instanceof Function) {
      target = target();
    }
    if(target instanceof Phaser.Group || target instanceof Array) {
      target = this.getClosestInRange(target, viewDistance);
    }
    if (!!target) {
      desired = Phaser.Point.subtract(target, this._sprite.position);
      if (desired.getMagnitude() < viewDistance) {
        desired.normalize();

        desired.multiply(-this._options.forces.maxSpeed, -this._options.forces.maxSpeed);

        steer = Phaser.Point.subtract(desired, this._sprite.body.velocity);
      }
      if(this._options.game.debug && isFleeing) {
        this.renderDebug.flee(this._sprite.position, target, viewDistance, steer.getMagnitude());
      }
    }
  }
  return steer;
};

Phaser.Plugin.Automata.prototype.pursue = function(target, viewDistance) {
  var steer = new Phaser.Point(),
    distance;
  if(!!target) {
    if(target instanceof Function) {
      target = target();
    }
    if(target instanceof Phaser.Group || target instanceof Array) {
      target = this.getClosestInRange(target, viewDistance);
    }
    if(!!target) {
      distance = Phaser.Point.distance(target, this._sprite.position);
      if(distance < viewDistance) {
        steer = this.seek(this.getFuturePosition(target), viewDistance, false);
      }
    }
  }

  if (this._options.game.debug) {
    this.renderDebug.pursue(this._sprite.position, !!target ? target.position : new Phaser.Point(), viewDistance, steer.getMagnitude());
  }

  return steer;
};

Phaser.Plugin.Automata.prototype.evade = function(target, viewDistance) {
  var steer = new Phaser.Point(),
    distance, targets, futurePosition;

  function comparator(a, b) {
    var da = Phaser.Point.distance(a, this._sprite.position);
    var db = Phaser.Point.distance(b, this._sprite.position);
    return da - db;
  }

  if(!!target) {
    if(target instanceof Function) {
      target = target();
    }
    if(target instanceof Phaser.Group || target instanceof Array) {
      targets = this.getAllInRange(target, viewDistance);
    } else {
      targets = [target];
    }

    targets.sort(comparator.bind(this));
    var targetCounter = 1;
    var totalDistance = 0;
    targets.forEach(function(t) {
      if (t) {
        distance = Phaser.Point.distance(t, this._sprite.position);
          var fleeTo = this.flee(
            this.getFuturePosition(t), viewDistance, false
          );
          fleeTo.setMagnitude(fleeTo.getMagnitude() * viewDistance / distance);
          steer = Phaser.Point.add(
            steer,
            fleeTo
          );
        totalDistance += distance;
        targetCounter++;
      }
    }, this);

    steer.divide(targetCounter, targetCounter);

  }

  if (this._options.game.debug) {
    this.renderDebug.evade(this._sprite.position, futurePosition ? [futurePosition] : targets, viewDistance, steer.getMagnitude());
  }
  return steer;
};

Phaser.Plugin.Automata.prototype.wander = function() {
  this._options.wander.theta += this.game.rnd.realInRange(-this._options.wander.change, this._options.wander.change);

  var circleLocation, steer, circleOffset;

  circleLocation = this._sprite.body.velocity.clone();
  circleLocation.normalize();
  circleLocation.setMagnitude(
    circleLocation.getMagnitude() * this._options.wander.distance * this._radius
  );

  circleOffset = new Phaser.Point(
    this._options.wander.radius * this._radius * Math.cos(this._options.wander.theta),
    this._options.wander.radius * this._radius * Math.sin(this._options.wander.theta)
  );

  steer = Phaser.Point.add(circleLocation, circleOffset);

  return steer.setMagnitude(steer.getMagnitude() * this._options.wander.strength);

};

/** Flocking **/
Phaser.Plugin.Automata.prototype.flock = function() {
  var steer = new Phaser.Point();
  this.applyForce(this.separate(), this._options.flocking.separation.strength);
  this.applyForce(this.align(), this._options.flocking.alignment.strength);
  this.applyForce(this.cohesion(), this._options.flocking.cohesion.strength);
  return steer;
};

Phaser.Plugin.Automata.prototype.separate = function() {
  var steer = new Phaser.Point();
  var count = 0;

  this._options.flocking.flock.forEachExists(function(automata) {
    var d = this._sprite.position.distance(automata.position);

    if((d > 0) && (d < this._options.flocking.separation.desiredSeparation)) {
      var diff = Phaser.Point.subtract(this._sprite.position, automata.position);
      diff.normalize();
      diff.divide(d,d);
      steer.add(diff.x,diff.y);
      count++;
    }
  }, this);

  if(count > 0) {
    steer.divide(count, count);
  }

  if(steer.getMagnitude() > 0) {
    steer.normalize();
    steer.multiply(this._options.forces.maxSpeed, this._options.forces.maxSpeed);
    steer.subtract(this._sprite.body.velocity.x, this._sprite.body.velocity.y);
    steer.setMagnitude(this._options.flocking.separation.strength);
  }

  return steer;
};

Phaser.Plugin.Automata.prototype.align = function() {
  var sum = new Phaser.Point();
  var steer = new Phaser.Point();
  var count = 0;
  this._options.flocking.flock.forEach(function(automata) {
    var d = this._sprite.position.distance(automata.position);
    if ((d > this._options.flocking.minDistance) && d < this._options.flocking.maxDistance) {
      sum.add(automata.body.velocity.x, automata.body.velocity.y);
      count++;
    }
  }, this);

  if (count > 0) {
    sum.divide(count, count);

    sum.normalize();
    sum.multiply(this._options.forces.maxSpeed, this._options.forces.maxSpeed);
    steer = Phaser.Point.subtract(sum, this._sprite.body.velocity);
    steer.setMagnitude(this._options.flocking.alignment.strength);
  }

  return steer;
};

Phaser.Plugin.Automata.prototype.cohesion = function() {

  var sum = new Phaser.Point();
  var steer = new Phaser.Point();
  var count = 0;

  this._options.flocking.flock.forEach(function(automata) {
    var d = Phaser.Point.distance(this._sprite.position, automata.position);
    if ((d > 0) && d < this._options.flocking.maxDistance) {
      sum.add(automata.position.x, automata.position.y);
      count++;
    }
  }, this);

  if (count > 0) {
    sum.divide(count, count);
    steer = Phaser.Point.subtract(sum, this._sprite.position);
    steer.normalize().setMagnitude(this._options.flocking.cohesion.strength);
    return steer;
    //return this.seek(sum)
  }
  return steer;
};


/******************** OPTIONS ***************************/


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