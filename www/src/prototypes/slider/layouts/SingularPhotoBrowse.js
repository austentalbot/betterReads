define(function(require, exports, module) {
  var Transform = require('famous/core/Transform');
  var SingularHelper = require('./SingularHelper');

  function getTransformFromDirection (dir, val, depth) {
    if (dir == 'x') return Transform.multiply(Transform.translate(0, 0, depth), Transform.rotateY(val) );
    else return Transform.multiply(Transform.translate(0, 0, depth), Transform.rotateX(val) );
  }

  /**
   *  Singular twist. Rotate around X or Y axes, with a given curve.
   *  @param {Options} [options] An object of configurable options.
   *  @param {Object} [options.curve] Valid Famo.us curve definition
   *  @param {String} [options.direction] Direction to choose: 'x', or 'y' are valid directions.
   *  @param {Boolean} [options.flipDirection] 
   *    Along the chosen axis direction, on next or previous, flip the item in 
   *    the opposite direction than the default.
   *  @method grid
   */
  module.exports = {
    defaultOptions: {
      curve: { 
        method: 'spring',
        dampingRatio: 0.85,
        period : 600
      },
      direction: 'x',
      flipDirection: false,
      depth: -1500
    },
    activate: function () {
      for (var i = 0; i < this.data.items.length; i++) {
        this.data.childOrigins[i].set([0.5, 0.5]);
        this.data.childAligns[i].set([0.5, 0.5]);
      };
    },
    layout: function (options) {
      var flip = options.flipDirection ? 1 : -1;
      options.direction = options.direction.toLowerCase();

      function current (item, containerSize, index, lastIndex) {
        item.trans.halt();
        item.opacity.set(1);
        if (index > lastIndex) { 
          var trans = getTransformFromDirection(options.direction, Math.PI * 0.99 * flip, options.depth);
          item.trans.set(trans);
          item.trans.set(Transform.identity, options.curve);
        } 
        else {
          var trans = getTransformFromDirection(options.direction, -Math.PI * 0.99 * flip, options.depth);
          item.trans.set(trans);
          item.trans.set(Transform.identity, options.curve);
        }
      }

      function last (item, containerSize, index, lastIndex) {
        item.trans.halt();
        item.opacity.set(1);
        if (index > lastIndex) { 
          item.trans.set(Transform.identity);
          var trans = getTransformFromDirection(options.direction, -Math.PI * 0.99 * flip, options.depth);
          item.trans.set(trans, options.curve);
        }
        else { 
          item.trans.set(Transform.identity);
          var trans = getTransformFromDirection(options.direction, Math.PI * 0.99 * flip, options.depth);
          item.trans.set(trans, options.curve);
        }
      }

      function other (item, containerSize) {
        item.opacity.set(0);
      }

      SingularHelper.layout.call(this, current, last, other);
    },
    deactivate: function () {
      SingularHelper.cleanup.call(this);
    }
  }
});
