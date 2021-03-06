/* This Source Code Form is subject to the terms of the Mozilla Public
 * License, v. 2.0. If a copy of the MPL was not distributed with this
 * file, You can obtain one at http://mozilla.org/MPL/2.0/.
 *
 * Owner: felix@famo.us
 * @license MPL 2.0
 * @copyright Famous Industries, Inc. 2014
 */

define(function(require, exports, module) {
    var PhysicsEngine = require('famous/physics/PhysicsEngine');
    var Particle = require('famous/physics/bodies/Particle');
    var Drag = require('famous/physics/forces/Drag');
    var Spring = require('famous/physics/forces/Spring');

    var EventHandler = require('famous/core/EventHandler');
    var OptionsManager = require('famous/core/OptionsManager');
    var ViewSequence = require('famous/core/ViewSequence');
    var CoverflowScroller = require('views/CoverflowScroller');
    var Utility = require('famous/utilities/Utility');

    var Modifier = require('famous/core/Modifier');
    var Transform = require('famous/core/Transform');
    var Easing = require('famous/transitions/Easing');
    var Transitionable = require('famous/transitions/Transitionable');

    var GenericSync = require('famous/inputs/GenericSync');
    var ScrollSync = require('famous/inputs/ScrollSync');
    var TouchSync = require('famous/inputs/TouchSync');
    GenericSync.register({scroll : ScrollSync, touch : TouchSync});

    /** @const */
    var TOLERANCE = 0.5;

    /** @enum */
    var SpringStates = {
        NONE: 0,
        EDGE: 1,
        PAGE: 2
    };

    /** @enum */
    var EdgeStates = {
        TOP:   -1,
        NONE:   0,
        BOTTOM: 1
    };

    /**
     * Coverflow will lay out a collection of renderables sequentially in the specified direction, and will
     * allow you to scroll through them with mousewheel or touch events.
     * @class Coverflow
     * @constructor
     * @param {Options} [options] An object of configurable options.
     * @param {Number} [options.direction=Utility.Direction.Y] Using the direction helper found in the famous Utility
     * module, this option will lay out the Coverflow instance's renderables either horizontally
     * (x) or vertically (y). Utility's direction is essentially either zero (X) or one (Y), so feel free
     * to just use integers as well.
     * @param {Boolean} [options.rails=true] When true, Coverflow's genericSync will only process input in it's primary access.
     * @param {Number} [clipSize=undefined] The size of the area (in pixels) that Coverflow will display content in.
     * @param {Number} [margin=undefined] The size of the area (in pixels) that Coverflow will process renderables' associated calculations in.
     * @param {Number} [friction=0.001] Input resistance proportional to the velocity of the input.
     * Controls the feel of the Coverflow instance at low velocities.
     * @param {Number} [drag=0.0001] Input resistance proportional to the square of the velocity of the input.
     * Affects Coverflow instance more prominently at high velocities.
     * @param {Number} [edgeGrip=0.5] A coefficient for resistance against after-touch momentum.
     * @param {Number} [egePeriod=300] Sets the period on the spring that handles the physics associated
     * with hitting the end of a Coverflow.
     * @param {Number} [edgeDamp=1] Sets the damping on the spring that handles the physics associated
     * with hitting the end of a Coverflow.
     * @param {Boolean} [paginated=false] A paginated Coverflow will scroll through items discretely
     * rather than continously.
     * @param {Number} [pagePeriod=500] Sets the period on the spring that handles the physics associated
     * with pagination.
     * @param {Number} [pageDamp=0.8] Sets the damping on the spring that handles the physics associated
     * with pagination.
     * @param {Number} [pageStopSpeed=Infinity] The threshold for determining the amount of velocity
     * required to trigger pagination. The lower the threshold, the easier it is to scroll continuosly.
     * @param {Number} [pageSwitchSpeed=1] The threshold for momentum-based velocity pagination.
     * @param {Number} [speedLimit=10] The highest scrolling speed you can reach.
     */
    function Coverflow(options) {
        // patch options with defaults
        this.options = Object.create(Coverflow.DEFAULT_OPTIONS);
        this._optionsManager = new OptionsManager(this.options);

        // create sub-components
        this._scroller = new CoverflowScroller(this.options);

        this.sync = new GenericSync(
            ['scroll', 'touch'],
            {
                direction : this.options.direction,
                scale : this.options.syncScale,
                rails: this.options.rails
            }
        );

        this._physicsEngine = new PhysicsEngine();
        this._particle = new Particle();
        this._physicsEngine.addBody(this._particle);

        this.spring = new Spring({
            anchor: [0, 0, 0],
            period: this.options.edgePeriod,
            dampingRatio: this.options.edgeDamp
        });
        this.drag = new Drag({
            forceFunction: Drag.FORCE_FUNCTIONS.QUADRATIC,
            strength: this.options.drag
        });
        this.friction = new Drag({
            forceFunction: Drag.FORCE_FUNCTIONS.LINEAR,
            strength: this.options.friction
        });

        // state
        this._node = null;
        this._touchCount = 0;
        this._springState = SpringStates.NONE;
        this._onEdge = EdgeStates.NONE;
        this._pageSpringPosition = 0;
        this._edgeSpringPosition = 0;
        this._touchVelocity = 0;
        this._earlyEnd = false;
        this._needsPaginationCheck = false;
        this._displacement = 0;
        this._totalShift = 0;
        this._cachedIndex = 0;

        // subcomponent logic
        this._scroller.positionFrom(this.getPosition.bind(this));

        // setting up transitionables for custom animations
        this._scrollTransitionable = new Transitionable(0);
        this._scrollModifier = new Modifier({
            transform: undefined
        });
        this._scroller.group.add(this._scrollModifier);
        this._scrollAnimation = function(){
            this.setPosition(this._scrollTransitionable.get());
            this._displacement = this.getAbsolutePosition();
        }.bind(this)

        // eventing
        this._eventInput = new EventHandler();
        this._eventOutput = new EventHandler();

        this._eventInput.pipe(this.sync);
        this.sync.pipe(this._eventInput);

        EventHandler.setInputHandler(this, this._eventInput);
        EventHandler.setOutputHandler(this, this._eventOutput);

        _bindEvents.call(this);

        // override default options with passed-in custom options
        if (options) this.setOptions(options);
    }

    Coverflow.DEFAULT_OPTIONS = {
        direction: Utility.Direction.X,
        rails: true,
        friction: 0.005,
        drag: 0.0001,
        edgeGrip: 0.2,
        edgePeriod: 300,
        edgeDamp: 1,
        margin: 1000,       // mostly safe
        paginated: false,
        pagePeriod: 500,
        pageDamp: 0.8,
        pageStopSpeed: 10,
        pageSwitchSpeed: 0.5,
        speedLimit: 5,
        groupScroll: false,
        syncScale: 1,
        screenCenter: 0,
        coverCenter: 0,
        snapSpeed: 250,
        snapCurve: Easing.outCubic
    };

    function _handleStart(event) {
        this._touchCount = event.count;
        if (event.count === undefined) this._touchCount = 1;

        _detachAgents.call(this);

        this.setVelocity(0);
        this._touchVelocity = 0;
        this._earlyEnd = false;
    }

    function _handleMove(event) {
        var velocity = -event.velocity;
        var delta = -event.delta;

        if (this._onEdge !== EdgeStates.NONE && event.slip) {
            if ((velocity < 0 && this._onEdge === EdgeStates.TOP) || (velocity > 0 && this._onEdge === EdgeStates.BOTTOM)) {
                if (!this._earlyEnd) {
                    _handleEnd.call(this, event);
                    this._earlyEnd = true;
                }
            }
            else if (this._earlyEnd && (Math.abs(velocity) > Math.abs(this.getVelocity()))) {
                _handleStart.call(this, event);
            }
        }
        if (this._earlyEnd) return;
        this._touchVelocity = velocity;

        if (event.slip) {
            var speedLimit = this.options.speedLimit;
            if (velocity < -speedLimit) velocity = -speedLimit;
            else if (velocity > speedLimit) velocity = speedLimit;

            this.setVelocity(velocity);

            var deltaLimit = speedLimit * 16;
            if (delta > deltaLimit) delta = deltaLimit;
            else if (delta < -deltaLimit) delta = -deltaLimit;
        }

        this.setPosition(this.getPosition() + delta);
        this._displacement += delta;

        if (this._springState === SpringStates.NONE) _normalizeState.call(this);
    }

    function _handleEnd(event) {
        this._touchCount = event.count || 0;
        if (!this._touchCount) {
            _detachAgents.call(this);
            if (this._onEdge !== EdgeStates.NONE) _setSpring.call(this, this._edgeSpringPosition, SpringStates.EDGE);
            _attachAgents.call(this);
            var velocity = -event.velocity;
            var speedLimit = this.options.speedLimit;
            if (event.slip) speedLimit *= this.options.edgeGrip;
            if (velocity < -speedLimit) velocity = -speedLimit;
            else if (velocity > speedLimit) velocity = speedLimit;
            this.setVelocity(velocity);
            this._touchVelocity = 0;
            this._needsPaginationCheck = true;
        }
    }

    function _bindEvents() {
        this._eventInput.bindThis(this);
        this._eventInput.on('start', _handleStart);
        this._eventInput.on('update', _handleMove);
        this._eventInput.on('end', _handleEnd);

        this._eventInput.on('trueSizeChange', function() {
            this._node._.getSize();
        }.bind(this));

        this._scroller.on('onEdge', function(data) {
            this._edgeSpringPosition = data.position;
            _handleEdge.call(this, this._scroller.onEdge());
            this._eventOutput.emit('onEdge');
        }.bind(this));

        this._scroller.on('offEdge', function() {
            this.sync.setOptions({scale: this.options.syncScale});
            this._onEdge = this._scroller.onEdge();
            this._eventOutput.emit('offEdge');
        }.bind(this));

        this._particle.on('start', function() {
            var index = this.getCurrentIndex();
            this._eventOutput.emit('scrollStart', {bookIndex: index});
        }.bind(this));

        this._particle.on('update', function(particle) {
            if (this._springState === SpringStates.NONE) _normalizeState.call(this);
            this._displacement = particle.position.x - this._totalShift;
        }.bind(this));

        this._particle.on('end', function() {
            if (!this.options.paginated || (this.options.paginated && this._springState !== SpringStates.NONE))
                var index = this.getCurrentIndex();
                this.goToPage(index);
                this._eventOutput.emit('snap', {bookIndex: index});
        }.bind(this));
    }

    function _attachAgents() {
        if (this._springState) this._physicsEngine.attach([this.spring], this._particle);
        else this._physicsEngine.attach([this.drag, this.friction], this._particle);
    }

    function _detachAgents() {
        this._springState = SpringStates.NONE;
        this._physicsEngine.detachAll();
    }

    function _nodeSizeForDirection(node) {
        var direction = this.options.direction;
        var nodeSize = node.getSize();
        return (!nodeSize) ? this._scroller.getSize()[direction] : nodeSize[direction];
    }

    function _handleEdge(edge) {
        this.sync.setOptions({scale: this.options.edgeGrip});
        this._onEdge = edge;

        if (!this._touchCount && this._springState !== SpringStates.EDGE) {
            _setSpring.call(this, this._edgeSpringPosition, SpringStates.EDGE);
        }

        if (this._springState && Math.abs(this.getVelocity()) < 0.001) {
            // reset agents, detaching the spring
            _detachAgents.call(this);
            _attachAgents.call(this);
        }
    }

    function _handlePagination() {
        if (this._touchCount) return;
        if (this._springState === SpringStates.EDGE) return;

        var velocity = this.getVelocity();
        if (Math.abs(velocity) >= this.options.pageStopSpeed) return;

        var position = this.getPosition();
        var velocitySwitch = Math.abs(velocity) > this.options.pageSwitchSpeed;

        // parameters to determine when to switch
        var nodeSize = _nodeSizeForDirection.call(this, this._node);
        var positionNext = position > 0.5 * nodeSize;
        var positionPrev = position < 0.5 * nodeSize;

        var velocityNext = velocity > 0;
        var velocityPrev = velocity < 0;

        this._needsPaginationCheck = false;

        if ((positionNext && !velocitySwitch) || (velocitySwitch && velocityNext)) {
            this.goToNextPage();
        }
        else if (velocitySwitch && velocityPrev) {
            this.goToPreviousPage();
        }
        else _setSpring.call(this, 0, SpringStates.PAGE);
    }

    function _setSpring(position, springState) {
        var springOptions;
        if (springState === SpringStates.EDGE) {
            this._edgeSpringPosition = position;
            springOptions = {
                anchor: [this._edgeSpringPosition, 0, 0],
                period: this.options.edgePeriod,
                dampingRatio: this.options.edgeDamp
            };
        }
        else if (springState === SpringStates.PAGE) {
            this._pageSpringPosition = position;
            springOptions = {
                anchor: [this._pageSpringPosition, 0, 0],
                period: this.options.pagePeriod,
                dampingRatio: this.options.pageDamp
            };
        }

        this.spring.setOptions(springOptions);
        if (springState && !this._springState) {
            _detachAgents.call(this);
            this._springState = springState;
            _attachAgents.call(this);
        }
        this._springState = springState;
    }

    function _normalizeState() {
        var offset = 0;
        var position = Math.round(this.getPosition()) + this.options.coverCenter;
        var nodeSize = _nodeSizeForDirection.call(this, this._node);
        var nextNode = this._node.getNext();

        while (offset + position >= nodeSize && nextNode) {
            offset -= nodeSize;
            this._scroller.sequenceFrom(nextNode);
            this._node = nextNode;
            nextNode = this._node.getNext();
            nodeSize = _nodeSizeForDirection.call(this, this._node);
        }

        var previousNode = this._node.getPrevious();
        var previousNodeSize;

        while (offset + position <= 0 && previousNode) {
            previousNodeSize = _nodeSizeForDirection.call(this, previousNode);
            this._scroller.sequenceFrom(previousNode);
            this._node = previousNode;
            offset += previousNodeSize;
            previousNode = this._node.getPrevious();
        }

        if (offset) _shiftOrigin.call(this, offset);

        if (Math.abs(this.getVelocity()) < 0.025) {
            this.setVelocity(0);
        }
    }

    function _shiftOrigin(amount) {
        this._edgeSpringPosition += amount;
        this._pageSpringPosition += amount;
        this.setPosition(this.getPosition() + amount);
        this._totalShift += amount;

        if (this._springState === SpringStates.EDGE) {
            this.spring.setOptions({anchor: [this._edgeSpringPosition, 0, 0]});
        }
        else if (this._springState === SpringStates.PAGE) {
            this.spring.setOptions({anchor: [this._pageSpringPosition, 0, 0]});
        }
    }

    /**
     * Returns the index of the first visible renderable
     *
     * @method getCurrentIndex
     * @return {Number} The current index of the ViewSequence
     */
    Coverflow.prototype.getCurrentIndex = function getCurrentIndex() {
        return this._node.index;
    };

    /**
     * goToPreviousPage paginates your Coverflow instance backwards by one item.
     *
     * @method goToPreviousPage
     * @return {ViewSequence} The previous node.
     */
    Coverflow.prototype.goToPreviousPage = function goToPreviousPage() {
        if (!this._node || this._onEdge === EdgeStates.TOP) return null;

        // if moving back to the current node
        if (this.getPosition() > 1 && this._springState === SpringStates.NONE) {
            _setSpring.call(this, 0, SpringStates.PAGE);
            return this._node;
        }

        // if moving to the previous node
        var previousNode = this._node.getPrevious();
        if (previousNode) {
            var previousNodeSize = _nodeSizeForDirection.call(this, previousNode);
            this._scroller.sequenceFrom(previousNode);
            this._node = previousNode;
            _shiftOrigin.call(this, previousNodeSize);
            _setSpring.call(this, 0, SpringStates.PAGE);
        }
        return previousNode;
    };

    /**
     * goToNextPage paginates your Coverflow instance forwards by one item.
     *
     * @method goToNextPage
     * @return {ViewSequence} The next node.
     */
    Coverflow.prototype.goToNextPage = function goToNextPage() {
        if (!this._node || this._onEdge === EdgeStates.BOTTOM) return null;
        var nextNode = this._node.getNext();
        if (nextNode) {
            var currentNodeSize = _nodeSizeForDirection.call(this, this._node);
            this._scroller.sequenceFrom(nextNode);
            this._node = nextNode;
            _shiftOrigin.call(this, -currentNodeSize);
            _setSpring.call(this, 0, SpringStates.PAGE);
        }
        return nextNode;
    };

    Coverflow.prototype.snapCurrentPage = function snapCurrentPage() {
        this._scrollTransitionable.set(this.getPosition());
        this._scrollModifier.transformFrom(this._scrollAnimation);
        this._scrollTransitionable.set(0, {
            duration: this.options.snapSpeed,
            easing: this.options.snapCurve
        }, function(){
            this._scrollModifier.transformFrom(undefined);
        }.bind(this));
    }

    /**
     * Paginates the Coverflow to an absolute page index.
     *
     * @method goToPage
     */
    Coverflow.prototype.goToPage = function goToPage(index) {
        var currentIndex = this.getCurrentIndex();
        var i;

        if (currentIndex > index) {
            for (i = 0; i < currentIndex - index; i++)
                this.goToPreviousPage();
        }

        if (currentIndex < index) {
            for (i = 0; i < index - currentIndex; i++)
                this.goToNextPage();
        }

        if (currentIndex === index) {
            this.snapCurrentPage();
        }
    };

    Coverflow.prototype.outputFrom = function outputFrom() {
        return this._scroller.outputFrom.apply(this._scroller, arguments);
    };

    /**
     * Returns the position associated with the Coverflow instance's current node
     *  (generally the node currently at the top).
     *
     * @deprecated
     * @method getPosition
     * @param {number} [node] If specified, returns the position of the node at that index in the
     * Coverflow instance's currently managed collection.
     * @return {number} The position of either the specified node, or the Coverflow's current Node,
     * in pixels translated.
     */
    Coverflow.prototype.getPosition = function getPosition() {
        return this._particle.getPosition1D();
    };

    /**
     * Returns the absolute position associated with the Coverflow instance
     *
     * @method getAbsolutePosition
     * @return {number} The position of the Coverflow's current Node,
     * in pixels translated.
     */
    Coverflow.prototype.getAbsolutePosition = function getAbsolutePosition() {
        return this._node._.cumulativeSizes[this.getCurrentIndex()][this.options.direction] + this.getPosition();
    };

    /**
     * Returns the offset associated with the Coverflow instance's current node
     *  (generally the node currently at the top).
     *
     * @method getOffset
     * @param {number} [node] If specified, returns the position of the node at that index in the
     * Coverflow instance's currently managed collection.
     * @return {number} The position of either the specified node, or the Coverflow's current Node,
     * in pixels translated.
     */
    Coverflow.prototype.getOffset = Coverflow.prototype.getPosition;

    /**
     * Sets the position of the physics particle that controls Coverflow instance's "position"
     *
     * @deprecated
     * @method setPosition
     * @param {number} x The amount of pixels you want your Coverflow to progress by.
     */
    Coverflow.prototype.setPosition = function setPosition(x) {
        this._particle.setPosition1D(x);
    };

    /**
     * Sets the offset of the physics particle that controls Coverflow instance's "position"
     *
     * @method setPosition
     * @param {number} x The amount of pixels you want your Coverflow to progress by.
     */
    Coverflow.prototype.setOffset = Coverflow.prototype.setPosition;

    /**
     * Returns the Coverflow instance's velocity.
     *
     * @method getVelocity
     * @return {Number} The velocity.
     */

    Coverflow.prototype.getVelocity = function getVelocity() {
        return this._touchCount ? this._touchVelocity : this._particle.getVelocity1D();
    };

    /**
     * Sets the Coverflow instance's velocity. Until affected by input or another call of setVelocity
     *  the Coverflow instance will scroll at the passed-in velocity.
     *
     * @method setVelocity
     * @param {number} v The magnitude of the velocity.
     */
    Coverflow.prototype.setVelocity = function setVelocity(v) {
        this._particle.setVelocity1D(v);
    };

    /**
     * Patches the Coverflow instance's options with the passed-in ones.
     *
     * @method setOptions
     * @param {Options} options An object of configurable options for the Coverflow instance.
     */
    Coverflow.prototype.setOptions = function setOptions(options) {
        // preprocess custom options
        if (options.direction !== undefined) {
            if (options.direction === 'x') options.direction = Utility.Direction.X;
            else if (options.direction === 'y') options.direction = Utility.Direction.Y;
        }

        // patch custom options
        this._optionsManager.setOptions(options);

        // propagate options to sub-components

        // scroller sub-component
        this._scroller.setOptions(options);
        if (options.groupScroll)
            this.subscribe(this._scroller);
        else
            this.unsubscribe(this._scroller);

        // physics sub-components
        if (options.drag !== undefined) this.drag.setOptions({strength: options.drag});
        if (options.friction !== undefined) this.friction.setOptions({strength: options.friction});
        if (options.edgePeriod !== undefined || options.edgeDamp !== undefined) {
            this.spring.setOptions({
                period: options.edgePeriod,
                dampingRatio: options.edgeDamp
            });
        }

        // sync sub-component
        if (options.rails || options.direction !== undefined || options.syncScale !== undefined) {
            this.sync.setOptions({
                rails: options.rails,
                direction: (options.direction === Utility.Direction.X) ? GenericSync.DIRECTION_X : GenericSync.DIRECTION_Y,
                scale: options.syncScale
            });
        }
    };

    /**
     * Sets the collection of renderables under the Coverflow instance's control, by
     *  setting its current node to the passed in ViewSequence. If you
     *  pass in an array, the Coverflow instance will set its node as a ViewSequence instantiated with
     *  the passed-in array.
     *
     * @method sequenceFrom
     * @param {Array|ViewSequence} node Either an array of renderables or a Famous viewSequence.
     */
    Coverflow.prototype.sequenceFrom = function sequenceFrom(node) {
        if (node instanceof Array) node = new ViewSequence({array: node, trackSize: true});
        this._node = node;
        return this._scroller.sequenceFrom(node);
    };

    /**
     * Returns the width and the height of the Coverflow instance.
     *
     * @method getSize
     * @return {Array} A two value array of the Coverflow instance's current width and height (in that order).
     */
    Coverflow.prototype.getSize = function getSize() {
        return this._scroller.getSize.apply(this._scroller, arguments);
    };

    /**
     * Generate a render spec from the contents of this component.
     *
     * @private
     * @method render
     * @return {number} Render spec for this component
     */
    Coverflow.prototype.render = function render() {
        if (this.options.paginated && this._needsPaginationCheck)
            _handlePagination.call(this);

        if (this._node) {
            if (this._cachedIndex < this._node.index) {
                this._eventOutput.emit('pageChange', {direction: 1, index: this._node.index});
                this._cachedIndex = this._node.index;
            } else if (this._cachedIndex > this._node.index) {
                this._eventOutput.emit('pageChange', {direction: -1, index: this._node.index});
                this._cachedIndex = this._node.index;
            }
        }

        return this._scroller.render();
    };

    module.exports = Coverflow;
});
