# CHANGELOG | [current](https://github.com/ryanve/elo/blob/master/elo.js)

## 1.5 (2013-02-26)
- Add `elo.fn.empty()`

## 1.4 (2012-09-20)
- Data hashes now use null objects (property-less) objects so as not to retrieve methods from `Object.prototype`
- `elo.data(ob, key, val)` now returns the `val` that was set.
- `elo.each` now foregoes the `hasOwnProperty`, and has additional breaker capabilities. (See the source.)
- Removed `.length` and `.selector` from `elo.fn`. They get added as applicable in the constructor.
- Replace `elo.mixinEvent` with `elo.fn.dubEvent`.
- Don't auto-bridge in the closure. But add an [ender](http://ender.no.de) bridge file to the repo.
- Remove `elo.hook` and `elo.mixin`. But prepare internals for [dj](http://github.com/ryanve/dj) integration to have a way achieve the same capabilities in a more modular fashion.
