[elo](https://github.com/ryanve/elo)
===

[elo](https://github.com/ryanve/elo) is a lo-fi JavaScript events API that runs cross-browser and gzips <3k. It's an events library for minimalists. It works as a standalone library or can integrate into a host such as [ender](http://ender.no.de).

# elo()

The `elo()` function is a simple OO **wrapper** that works like the jQuery function.

```js
elo(element)       // wrap a DOM element (all browsers)
elo(elementArray)  // wrap NodeList or array of elements  (all browsers)
elo(tagName)       // wrap element(s) matched by tag name (all browsers)
elo(selector)      // wrap element(s) matched by a selector string (uses querySelectorAll)
elo(function(elo){   }); // ready shortcut (receives elo as its 1st arg, this === document)
```

I'm still working on these docs, but the [source](https://github.com/ryanve/elo/blob/master/elo.js) is already documented, and you can see all the methods if you do:

```js
console.log(elo.mixin.call({}, elo));
```
