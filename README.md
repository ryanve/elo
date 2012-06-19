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

# Compatibility

Supports all major browsers. Tested in: Chrome / FF3+ / Opera / IE7+ / Safari. (If you do find a compatibility issue please [report it here](https://github.com/ryanve/elo/issues).)

# License

### [elo](http://github.com/ryanve/elo) is available under the [MIT license](http://en.wikipedia.org/wiki/MIT_License)

Copyright (C) 2012 by [Ryan Van Etten](https://github.com/ryanve)

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.