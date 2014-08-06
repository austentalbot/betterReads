define(function(require, exports, module){
  'use strict'
  var View = require('famous/core/View');
  var Surface = require('famous/core/Surface');
  var ImageSurface = require('famous/surfaces/ImageSurface');
  var StateModifier = require('famous/modifiers/StateModifier');
  var ScrollView = require('famous/views/ScrollView');

  var betterReads = require('../utils/BetterReads');

  function LogInView(){
    View.apply(this, arguments);

    _addSurface.call(this);
    _addButton.call(this);
  }

  LogInView.prototype = Object.create(View.prototype);
  LogInView.prototype.constructor = LogInView;

  LogInView.DEFAULT_OPTIONS = {};

  function _addSurface(){
    var surface = new Surface({
      content: "<font size='50px'>Log In With Goodreads</font>",
      size: [undefined, undefined],
      properties: {
        textAlign: 'center',
        backgroundColor: '#E5EBEB'
      }
    });

    this.add(surface);
  }
  function _addButton(){
    var button = new ImageSurface({
      size: [100, 100]
    });
    button.setContent('./resources/goodreads-icon.png');

    var modifier = new StateModifier({
      align: [0.5, 0.6],
      origin: [0.5, 0.5]
    });

    button.on('click', function() {
      console.log('clicked');
      betterReads.authenticate();
    });

    this.add(modifier).add(button);
  }

  module.exports = LogInView;
});
