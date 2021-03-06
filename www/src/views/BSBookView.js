define(function(require, exports, module){
  'use strict';

  var View = require('famous/core/View');
  var Surface = require('famous/core/Surface');
  var ImageSurface = require('famous/surfaces/ImageSurface');
  var StateModifier = require('famous/modifiers/StateModifier');
  var ScrollView = require('famous/views/Scrollview');
  var Transform = require('famous/core/Transform');
  var Easing = require('famous/transitions/Easing');
  var Modifier = require('famous/core/Modifier');


  var betterReads = require('../utils/BetterReads');

  function BSBookView(data, autoload) {
    View.apply(this, arguments);
    _addDetail.call(this, data.ISBN, data.URL, data.Amazon, data, autoload);
  }

  BSBookView.prototype = Object.create(View.prototype);
  BSBookView.prototype.constructor = BSBookView;

  BSBookView.DEFAULT_OPTIONS = {};

  function _addDetail(isbn, picUrl, link, details, autoload){
    betterReads.getBookDetail({isbn: isbn}).then(function(response) {
      var that = this;
      //handle bad requests
      if (response==='book not found' || response==='Bad Request') {
        console.log('book not found');

        var image = new ImageSurface({
          size: [320, 480],
          origin: [0, 0],
          align: [0, 0]
        });
        image.setContent(picUrl);

        var opacityMod = new Modifier({
          opacity: 0.15
        });
        this.add(opacityMod).add(image);

        var text = new Surface({
          content: '<div style="font-size: 18px; font-weight: bold; color: #0096B3; text-decoration: underline;" onClick="javascript: window.open(\'' + link + '\', \'_system\'); event.stopPropagation();">' + details.Title + '</div><br>' + details.Author + '<br><br>' + details.BriefDescription + '<br><br>Additional Goodreads book detail not found',
          properties: {
            size: [undefined, undefined],
            textAlign: 'center',
            padding: '20px'
          }
        });

        var textMod = new Modifier({
          opacity: 1.0,
          transform: Transform.translate(0, 0, 1)
        });
        this.add(textMod).add(text);        

      } else {        
        var bookData = JSON.parse(response);

        var image = new ImageSurface({
          size: [320, 480],
          origin: [0, 0],
          align: [0, 0]
        });
        image.setContent(picUrl);

        var opacityMod = new Modifier({
          opacity: 0.2
        });
        this.add(opacityMod).add(image);

        // console.log(bookData);

        var shareView = new View ({
          size: [undefined, true]
        });
        var buttonView = new View({
          size: [undefined, true]
        });
        var view = new View({
          size: [undefined, true]
        });

        var scroll = new ScrollView();

        var share = new Surface({
          content: '<b>Share this book</b>',
          size: [undefined, true],
          classes: ['clickButton'],
          properties: {
            backgroundColor: '#0096B3',
            color: 'white',
            textAlign: 'center',
            padding: '10px 10px',
            border: '1px solid white'
          }
        });
        var shareMod = new Modifier({
          transform: Transform.translate(0, 0, 3)
        });
        shareView.add(shareMod).add(share);

        var button = new Surface({
          content: '<b>Add to "To Read" shelf</b>',
          size: [undefined, true],
          classes: ['clickButton'],
          properties: {
            backgroundColor: '#0096B3',
            color: 'white',
            textAlign: 'center',
            padding: '10px 10px',
            border: '1px solid white'
          }
        });
        var buttonMod = new Modifier({
          transform: Transform.translate(0, 0, 2)
        });
        buttonView.add(buttonMod).add(button);

        var text = new Surface({
          size: [undefined, true],
          content: '<div style="font-size: 18px; font-weight: bold; color: #0096B3; text-decoration: underline; text-align: center;" onClick="javascript: window.open(\'' + link + '\', \'_system\'); event.stopPropagation();">' + bookData.title[0] + '</div><br><div style="text-align: center">' + bookData.authors[0].author[0].name[0] + '</div><br><div style="text-align: center">' + bookData.average_rating[0] + '/5</div><br><br>' + bookData.description[0],
          properties: {
            // textAlign: 'center',
            padding: '20px'
          }
        });
        var textMod = new Modifier({
          opacity: 1.0,
          transform: Transform.translate(0, 0, 1)
        });
        view.add(textMod).add(text);

        that.grId = bookData.id[0];
        button.on('click', function() {
          console.log('clicked the button');
          var _this = this;
          betterReads.addBook({bookId: that.grId, shelf: 'to-read'}).then(function(response) {
            console.log(response);
            _this.setContent('Added to shelf');
            _this.setProperties({backgroundColor: '#2ecc71'});
          });
        });

        share.on('click', function() {
          console.log('clicked share');
          window.plugins.socialsharing.share('Check out this book on Better Reads!', null, that.options.URL, that.options.Amazon);
        });

        scroll.sequenceFrom([buttonView, shareView, view]);

        text.pipe(scroll);
        this.add(scroll);
      }
      text.on('click', function() {
        console.log('reload best sellers');
        that._eventOutput.emit('loadBestSellers');

      });
      if (autoload) {
        this._eventOutput.emit('bookLoaded');
      }

    }.bind(this));

  }

  module.exports = BSBookView;
});
