# [elo](../../)

<b>elo</b> is a lo-fi cross-browser JavaScript events API that gzips <3k. It's an events library for minimalists. It works as a standalone library or can integrate into a host such as [ender](https://github.com/ender-js/).

## API

**elo** does not claim the `$` namespace, however it can be used as such in a closure.

### Methods

#### Events

- `$.on(element, eventName, handler)`
- `$.off(element, eventName, handler)`
- `$.one(element, eventName, handler)`
- `$.trigger(element, eventName, extraParamsArray?)`
- `$.domReady(fn)` // call `fn` when the DOM is ready
- `$.hasEvent(eventName, element|tagName?)`
- `$.dubEvent(eventShortcutNamesSSV)`
- `$(stack).on(eventName, handler)`
- `$(stack).off(eventName, handler)`
- `$(stack).one(eventName, handler)`
- `$(stack).trigger(eventName, extraParamsArray?)`
- `$(document).ready(fn)`

#### Data 

- `$.data(object, key?, value?)`
- `$.removeData(object, keys?)`
- `$.cleanData(object)`
- `$(stack).data(key, value?)`
- `$(stack).removeData(keys)`

#### Utils

- `$.each(stack, callback, thisArg?, breaker?)`
- `$(stack).each(callback, thisArg?, breaker?)`

### elo()

The `elo()` function is a simple OO **wrapper** that works very much like the jQuery function.

- `elo(element)` // wrap a DOM element
- `elo(stack)` // wrap NodeList or array
- `elo(selector, context)` // match a selector string via `querySelectorAll`
- `elo(fn)`      // ready shortcut - `fn` calls like `fn.call(document, elo)`

## Compatibility

Supports all major browsers. Tested in: Chrome, FF3+, Opera, IE7+, Safari. <small>Please [report issues here](../../issues).</small>

## [MIT license](http://en.wikipedia.org/wiki/MIT_License)

Copyright (C) 2012 by [Ryan Van Etten](https://github.com/ryanve)