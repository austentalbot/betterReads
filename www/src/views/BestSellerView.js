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

  var BookView = require('views/BookView');
  var betterReads = require('../utils/BetterReads');

  function BestSellerView(shelf, autoload){
    View.apply(this, arguments);

    _addBooks.call(this, shelf, autoload);
  }

  BestSellerView.prototype = Object.create(View.prototype);
  BestSellerView.prototype.constructor = BestSellerView;

  BestSellerView.DEFAULT_OPTIONS = {};

  function _addBooks(){
    betterReads.getTopUT()
    .then(function(bookList) {
      console.log(bookList);
      var date = moment(bookList.date.slice(10)).format('LL');
      var books = bookList.books;
      var scrollView = new ScrollView({
        detailSize: [undefined, true],
        margin: 5000
      });
      var listOfItems = [];

      var titleView = new View();
      var titleSurface = new Surface({
        content: '<b>USA Today Weekly Best Sellers<br><div style="font-size: 0.8em">' + date + '</div></b>',
        size: [undefined, true],
        properties: {
          textAlign: 'center',
          padding: '3px',
          color: 'white',
          backgroundColor: '#0096B3'
        }
      });
      titleView.add(titleSurface);
      listOfItems.push(titleView);
      titleSurface.pipe(this);
      titleSurface.pipe(scrollView);

      var colors = ['white', '#EFF9FF'];
      var parent = this;
      for (var i = 0; i < books.length; i++) {
        var bookView = new View();
        var bookMod = new StateModifier({
          size: [undefined, 150]
        });

        var title = books[i].Title;
        if (title.length > 45) {
          title = title.slice(0, 42) + '...';
        }

        var author = books[i].Author;
        if (author.length > 25) {
          author = author.slice(0, 22) + '...';
        }        

        var tab = new Surface({
          content: '<div style="font-weight: bold; color: #F28A75; font-size: 40px">' + books[i].Rank + '</div><div style="font-weight: bold">' + title + '</div>by ' + author,
          size: [undefined, undefined],
          properties: {
            textAlign: 'left',
            padding: '5px 10px 10px 110px',
            backgroundColor: colors[i%2]
          }
        });

        var image = new ImageSurface({
          properties: {
            padding: '2px 4px'
          }
        });
        image.clicked = false;
        image.content = books[i];
        image.setContent(books[i].URL);

        image.imageMod = new Modifier({
          size: [100, 150]
        });

        var _this = this;;
        //fill screen with image
        (function(i) {
          image.on('click', function() {
            if (!this.clicked) {
              _this._eventOutput.emit('bestSellerClick', this);
              this.clicked = true;
              console.log('matrix', this._matrix);
              console.log('scroll', scrollView);
              // console.log('scroll _displacement', scrollView._displacement);
              // console.log('scroll _edgeSpringPosition', scrollView._edgeSpringPosition);
              // console.log('scroll _pageSpringPosition', scrollView._pageSpringPosition);
              // console.log('scroll _springState', scrollView._springState);
              // console.log('scroll _pageSpringPosition', scrollView._pageSpringPosition);

              this.imageMod.transformFrom(Transform.translate(0, 0, 1));
              this.imageMod.setTransform(Transform.translate(-4, -2 + (-1*this._matrix[13]) + (scrollView._displacement + scrollView._pageSpringPosition), 1), {duration: 1500, curve: Easing.inOutCubic});

              this.imageMod.setSize([328, 484], {duration: 1500, curve: Easing.inOutCubic});
              // this.imageMod.setSize([320, 480], {duration: 1500, curve: Easing.inOutCubic});
            } else {
              this.clicked = false;
              this.imageMod.setTransform(Transform.translate(0, 0, 1), {duration: 1500, curve: Easing.inOutCubic});
              this.imageMod.setSize([100, 150], {duration: 1500, curve: Easing.inOutCubic})

              var that = this;
              setTimeout(function() {
                that.imageMod.transformFrom(Transform.translate(0, 0, 0));
              }, 1500);            
            }
          });
        })(i);

        var bookWrapper = bookView.add(bookMod);
        image.textWrapper = bookWrapper.add(image.imageMod);
        image.textWrapper.add(image);
        bookWrapper.add(tab);

        listOfItems.push(bookView);
        image.pipe(scrollView);
        image.pipe(this);
        tab.pipe(scrollView);
        tab.pipe(this);
      }

      scrollView.sequenceFrom(listOfItems);
      this.add(scrollView);
    }.bind(this));
  }

  module.exports = BestSellerView;
});
