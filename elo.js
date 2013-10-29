/*!
 * elo 1.6.0 cross-browser JavaScript events and data module
 * @link http://elo.airve.com
 * @license MIT
 * @author Ryan Van Etten
 */

/*jshint expr:true, sub:true, supernew:true, debug:true, node:true, boss:true, devel:true, evil:true, 
  laxcomma:true, eqnull:true, undef:true, unused:true, browser:true, jquery:true, maxerr:100 */

(function(root, name, make) {
    if (typeof module != 'undefined' && module['exports']) module['exports'] = make();
    else root[name] = make();
}(this, 'elo', function() {

    // elo takes much inspiration from:
    // jQuery (jquery.com)
    // Bean   (github.com/fat/bean)
    // Bonzo  (github.com/ded/bonzo)

    // Array notation is used on property names that we don't want the
    // Google Closure Compiler to rename in advanced optimization mode. 
    // developers.google.com/closure/compiler/docs/api-tutorial3
    // developers.google.com/closure/compiler/docs/js-for-compiler

    var domReady, eloReady
      , root = this
      , name = 'elo'
      , win = window
      , doc = document
      , docElem = doc.documentElement
      , slice = [].slice
      , push = [].push

        // Data objects are organized by unique identifier:
        // Use null objects so we don't need to do hasOwnProperty checks
      , eventMap = {} // event data cache
      , dataMap = {} // other data cache
      , uidProp = 'uidElo' // property name
      , uidAttr = 'data-uid-elo' // elements are identified via data attribute
      , uid = 4 // unique identifier
      , queryEngine = function(s, root) {
            return s ? (root || doc).querySelectorAll(s) : [];
        }

        // Feature detection:
      , W3C = !!doc.addEventListener
      , FIX = !('onblur' in docElem) // Detect whether to fix event detection in hasEvent()

        // Normalize the native add/remove-event methods:
      , add = W3C ? function(node, type, fn) { node.addEventListener(type, fn, false); }
                  : function(node, type, fn) { node.attachEvent('on' + type, fn); }
      , rem = W3C ? function(node, type, fn) { node.removeEventListener(type, fn, false); }
                  : function(node, type, fn) { node.detachEvent('on' + type, fn); }

        // Local vars specific to domReady:
      , readyStack = [] // stack of functions to fire when the DOM is ready
      , isReady = /^loade|c/.test(doc.readyState) // test initial state
      , needsHack = !!docElem.doScroll
      , readyType = needsHack ? 'onreadystatechange' : 'DOMContentLoaded';

    // Temporary local version of hook allows for the actual
    // $.hook to be added after the api has been created. If $.hook 
    // is added, then this local version becomes a ref to $.hook
    // See the source of @link github.com/ryanve/dj
    // It's the best kind of magic.
    function hook(k) {
        var realHook = api['hook'];
        if (!realHook || !realHook['remix'])
            return 'select' === k ? queryEngine : 'api' === k ? eloReady : void 0;
        // send the default hooks
        realHook('select', queryEngine);
        realHook('api', eloReady);
        realHook(name, api) && realHook(name, false);
        hook = realHook; // redefine self
        return realHook.apply(this, arguments);
    }

    /**
     * api is the export (all public methods are added to it)
     * @param {*} item
     * @param {Object=} root 
     */
    function api(item, root) {
        return new Api(item, root);
    }

   /**
    * @constructor
    * @param {*=} item 
    * @param {Object=} root 
    * adapted from jQuery and ender
    */
    function Api(item, root) {
        var i;
        this.length = 0;
        item = typeof item == 'string' ? hook('select')(this['selector'] = item, root) : item;
        if (typeof item == 'function') {
            hook('api')(item); // designed to be closure or ready shortcut
        } else if (null != item) {        
            if (item.nodeType || typeof (i = item.length) != 'number' || item.window == item)
                this[this.length++] = item;
            else for (this.length = i = i > 0 ? i >> 0 : 0; i--;) // ensure positive integer
                this[i] = item[i]; 
        }
    }
    
    // jQuery-inspired magic to make `api() instanceof api` be `true` and to make
    // it so that methods added to api.fn map back to the prototype and vice versa.
    api.prototype = api['fn'] = Api.prototype;

    // Create top-level reference to self:
    // This makes it possible to bridge into a host, destroy the global w/ noConflict, 
    // and still access the entire api from the host (not just the bridged methods.)
    // It is also useful for other modules that may want to detect this module, it can be
    // used to check if an method on the host is from the api, e.g. `($.each === $.elo.each)`
    // and similarly it can be used for assigning methods even after the global is gone.
    api[name] = api;

    // Create reference to self in the chain:
    api['fn'][name] = api;

    /** 
     * Function that returns false for compat w/ jQuery's false shorthand.
     */
    function returnFalse() {
        return false;
    }

    /**
     * A hella' ballistic iterator: jQuery had sex with Underscore. This was the offspring.
     * @param {*} ob is the array|object|string|function to iterate over.
     * @param {Function} fn is the callback - it receives (value, key, ob)
     * @param {*=} scope thisArg (defaults to current item)
     * @param {*=} breaker value for which if fn returns it, the loop stops (default: false)
     */
    function each(ob, fn, scope, breaker) {
        // Opt out of the native forEach here b/c we want to:
        // - Default the scope to the current item.
        // - Return the object for chaining.
        // - Be able to break out of the loop if the fn returns the breaker.
        // - Be able to iterate strings. (Avoid `in` tests.)
        if (null == ob) return ob;
        var i = 0, l = ob.length;
        breaker = void 0 !== breaker && breaker; // default: false
        if (typeof ob != 'function' && l === +l) {
            while (i < l) if (fn.call(scope || ob[i], ob[i], i++, ob) === breaker) break;
        } else {
            for (i in ob) if (fn.call(scope || ob[i], ob[i], i, ob) === breaker) break;
        }
        return ob;
    }

    /**
     * Iterate space-separated values. Optimized for internal use.
     * @link http://jsperf.com/eachssv
     * @param {Array|string|*} list to iterate over
     * @param {Function} fn callback
     */
    function eachSSV(list, fn) {
        var l, i = 0;
        list = list instanceof Array ? list : list.split(' ');
        for (l = list.length; i < l; i++) {
            list[i] && fn(list[i], i, list);
        }
    }

    /**
     * Augment an object with the properties of another object.
     * @param {Object|Array|Function} r receiver
     * @param {Object|Array|Function} s supplier
     */
     function aug(r, s) {
        for (var k in s) r[k] = s[k]; 
        return r;
    }

    /**
     * Apply every function in a stack using the specified scope and args.
     * @param {{length:number}} fns stack of functions to fire
     * @param {*=} scope thisArg
     * @param {(Array|Arguments)=} args
     * @param {*=} breaker unless undefined
     * @return {boolean} true if none return the breaker
     */
    function applyAll(fns, scope, args, breaker) {
        if (!fns) return true;
        var i = 0, l = fns.length;
        breaker = void 0 === breaker ? {} : breaker; // disregard if none
        for (args = args || []; i < l; i++)
            if (typeof fns[i] == 'function' && fns[i].apply(scope, args) === breaker) return false;
        return true;
    }

    /**
     * Get the unique id associated with the specified item. If an id has not
     * yet been created, then create it. Return `undefined` for invalid types.
     * To have an id, the item must be truthy and either an object or function.
     * @param {*} item
     * @return {number|undefined}
     */
    function getId(item) {
        var id;
        if (!item) return;
        if (typeof item != 'object' && typeof item != 'function') return;
        if (item.nodeType && item.getAttribute && item.setAttribute) {
            id = item.getAttribute(uidAttr);
            id || item.setAttribute(uidAttr, (id = uid++));
            return id;
        }
        if (item === doc) return 3;
        if (item === win) return 2;
        if (item === root) return 1;
        return item[uidProp] = item[uidProp] || uid++; // other objects/funcs
    }

    /**
     * Get or set arbitrary data associated with an object.
     * @param {Object|Array|Function} obj
     * @param {(string|Object)=} key
     * @param {*=} val
     */    
    function data(obj, key, val) {
        var id = getId(obj), hasVal = arguments.length > 2;
        if (!id || (hasVal && key == null)) throw new TypeError('@data'); 
        dataMap[id] = dataMap[id] || {};
        if (key == null) return key === null ? void 0 : dataMap[id]; // GET invalid OR all
        if (hasVal) return dataMap[id][key] = val; // SET (single)
        if (typeof key != 'object') return dataMap[id][key]; // GET (single)
        return aug(dataMap[id], key); // SET (multi)
    }

    /**
     * Remove data associated with an object that was added via data()
     * Remove data by key, or if no key is provided, remove all.
     * @param {*=} ob
     * @param {(string|number)=} keys
     */
    function removeData(ob, keys) {
        var id = ob && getId(ob);
        if (id && dataMap[id]) {
            if (2 > arguments.length) delete dataMap[id]; // Remove all data.
            else if (typeof keys == 'number') delete dataMap[id][keys]; 
            else keys && eachSSV(keys, function(k) {
                delete dataMap[id][k]; 
            });
        }
        return ob;
    }

    /**
     * Remove event handlers from the internal eventMap. If `fn` is not specified,
     * then remove all the event handlers for the specified `type`. If `type` is 
     * not specified, then remove all the event handlers for the specified `node`.
     * @param {Object|*} node
     * @param {(string|null)=} type
     * @param {Function=} fn
     */
    function cleanEvents(node, type, fn) {
        if (!node) return;
        var fid, typ, key, updated = [], id = getId(node);
        if (id && eventMap[id]) {
            if (!type) {
                // Remove all handlers for all event types
                delete eventMap[id];
            } else if (eventMap[id][key = 'on' + type]) {
                if (!fn) {
                    // Remove all handlers for a specified type
                    delete eventMap[id][key]; 
                } else if (fid = fn[uidProp]) {
                    // Remove a specified handler
                    eachSSV(eventMap[id][key], function(handler) {
                        fid !== handler[uidProp] && updated.push(handler);
                    });
                    if (updated.length) eventMap[id][key] = updated;
                    else delete eventMap[id][key];
                    // If an `fn` was specified and the event name is namespaced, then we
                    // also need to remove the `fn` from the non-namespaced handler array:
                    typ = type.split('.')[0]; // type w/o namespace
                    typ === type || cleanEvents(node, 'on' + typ, fn);
                }
            }
        }
    }

    /**
     * Delete **all** the elo data associated with the specified item(s)
     * @param {Object|Node|Function} item or collection of items to purge
     */
    function cleanData(item) {
        var deleted, l, i = 0;
        if (!item) return;
        removeData(item);
        if (typeof item == 'object') {
            cleanEvents(item);
            if (item.nodeType) item.removeAttribute && item.removeAttribute(uidAttr);
            else for (l = item.length; i < l;) cleanData(item[i++]); // Deep.
        } else if (typeof item != 'function') { return; }
        if (uidProp in item) {
            try {
                deleted = delete item[uidProp];
            } catch(e) {}
            if (!deleted) item[uidProp] = void 0;
        }
    }

    /**
     * Test if the specified node supports the specified event type.
     * This function uses the same signature as Modernizr.hasEvent, 
     * @link http://bit.ly/event-detection
     * @link http://github.com/Modernizr/Modernizr/pull/636
     * @param {string|*} eventName an event name, e.g. 'blur'
     * @param {(Object|string|*)=} node a node, window, or tagName (defaults to div)
     * @return {boolean}
     */
    function hasEvent(eventName, node) {
        var isSupported;
        if (!eventName) return false;
        eventName = 'on' + eventName;

        if (!node || typeof node == 'string') node = doc.createElement(node || 'div');
        else if (typeof node != 'object') return false; // `node` was invalid type

         // Technique for modern browsers and IE:
        isSupported = eventName in node;

        // We're done unless we need the fix:              
        if (!isSupported && FIX) {
            // Hack for old Firefox - bit.ly/event-detection
            node.setAttribute || (node = doc.createElement('div'));
            if (node.setAttribute && node.removeAttribute) {
                // Test via hack
                node.setAttribute(eventName, '');
                isSupported = typeof node[eventName] == 'function';
                // Cleanup
                null == node[eventName] || (node[eventName] = void 0);
                node.removeAttribute(eventName);
            }
        }
        // Nullify node references to prevent memory leaks
        node = null; 
        return isSupported;
    }

    /**
     * Adapter for handling 'event maps' passed to on|off|one
     * @param {Object|*} list events map (event names as keys and handlers as values)
     * @param {Function} fn method (on|off|one) to call on each pair
     * @param {(Node|Object|*)=} node or object to attach the events to
     */
    function eachEvent(list, fn, node) {
        for (var name in list) fn(node, name, list[name]);
    }
    
    /**
     * Get a new function that calls the specified `fn` with the specified `scope`.
     * We use this to normalize the scope passed to event handlers in non-standard browsers.
     * In modern browsers the value of `this` in the listener is the node.
     * In old IE, it's the window. We normalize it here to be the `node`.
     * @param {Function} fn function to normalize
     * @param {*=} scope thisArg (defaults to `window`)
     * @return {Function}
     */
    function normalizeScope(fn, scope) {
        function normalized() {
            return fn.apply(scope, arguments); 
        }
        // Technically we should give `normalized` its own uid (maybe negative or
        // underscored). But, for our internal usage, cloning the original is fine, 
        // and it simplifies removing event handlers via off() (see cleanEvents()).
        if (fn[uidProp]) normalized[uidProp] = fn[uidProp]; 
        return normalized;
    }

    /**
     * on() Attach an event handler function for one or more event types to the specified node.
     * @param {Node|Object} node object to add events to
     * @param {string|Object} types space-separated event names, or an events map
     * @param {Function=} fn handler to add
     */    
    function on(node, types, fn) {
        // Don't deal w/ text/comment nodes for jQuery-compatibility.
        // jQuery's `false` "shorthand" has no effect here.            
        var id, isMap = !fn && typeof types == 'object';
        if (!node || 3 === node.nodeType || 8 === node.nodeType) return;
        if (null == types || typeof node != 'object')
            throw new TypeError('@on'); 
        if (isMap) {
            eachEvent(types, on, node); 
        } else if (fn = false === fn ? returnFalse : fn) {
            if (id = getId(node)) {
                fn[uidProp] = fn[uidProp] || uid++; // add identifier
                eventMap[id] = eventMap[id] || []; // initialize if needed
                fn = W3C ? fn : normalizeScope(fn, node);
                eachSSV(types, function(type) {
                    var typ = type.split('.')[0] // w/o namespace
                      , key = 'on' + type // w/ namespace if any
                      , prp = 'on' + typ  // w/o namespace
                      , hasNamespace = typ !== type;
                    // Add native events via the native method.
                    hasEvent(typ, node) && add(node, typ, fn);
                    // Update our internal eventMap's handlers array.
                    eventMap[id][key] ? eventMap[id][key].push(fn) : eventMap[id][key] = [fn];
                    // Update the non-namespaced array for firing when non-namespaced events trigger.
                    hasNamespace && (eventMap[id][prp] ? eventMap[id][prp].push(fn) : eventMap[id][prp] = [fn]);
                });
            }
        }
    }

    /**
     * off() Remove an event handlers added via on() from the specified node. If `fn` is
     * not specified, then remove all the handlers for the specified types. If `types`
     * is not specfied, then remove *all* the handlers from the specified node.
     * @param {Node|Object} node object to remove events from
     * @param {string|Object} types space-separated event names, or an events map
     * @param {Function=} fn handler to remove
     */
    function off(node, types, fn) {
        if (!node || 3 === node.nodeType || 8 === node.nodeType) return;
        if (typeof node != 'object')
            throw new TypeError('@off');
        fn = false === fn ? returnFalse : fn;
        if (types == null) cleanEvents(node, types, fn); // Remove all.
        else if (!fn && typeof types == 'object') eachEvent(types, off, node); // Map.
        else eachSSV(types, function(type) {
            var typ = type.split('.')[0];
            typeof fn == 'function' && hasEvent(typ, node) && rem(node, typ, fn);
            cleanEvents(node, type, fn);
        }); 
    }

    /**
     * one() Add an event handler that only runs once and is then removed.
     * @param {Node|Object} node object to add events to
     * @param {string|Object} types space-separated event names, or an events map
     * @param {Function=} fn handler to add
     */
    function one(node, types, fn) {
        if (null == fn && typeof types == 'object') {
            eachEvent(types, one, node);
        } else {
            var actualHandler;
            on(node, types, (actualHandler = function() {
                off(node, types, actualHandler);
                return fn !== false && fn.apply(node, arguments);
            }));
        }
    }

    /**
     * Trigger handlers registered via .on() for the specifed event type. This works for
     * native and custom events, but unlike jQuery.fn.trigger it does *not* fire the
     * browser's native actions for the event. To do so would take a lot more code. 
     * In that respect it works like jQuery.fn.triggerHandler, but elo.fn.trigger
     * works like jQuery.fn.trigger otherwise (e.g. it operates on the whole set). 
     * @param {Node|Object} node object to remove events from
     * @param {string} type is an event name to trigger
     * @param {(Array|*)=} extras extra parameters to pass to the handler
     * Handlers receive (eventData, extras[0], extras[1], ...)
     */
    function trigger(node, type, extras) {
        if (!type || !node || 3 === node.nodeType || 8 === node.nodeType) return;
        if (typeof node != 'object') throw new TypeError('@trigger');
        var eventData = {}, id = getId(node);
        if (!id || !eventMap[id]) return;
        // Emulate the native and jQuery arg signature for event listeners,
        // supplying an object as first arg, but only supply a few props.
        // The `node` becomes the `this` value inside the handler.
        eventData['type'] = type.split('.')[0]; // w/o namespace
        eventData['isTrigger'] = true;
        applyAll(eventMap[id]['on' + type], node, null == extras ? [eventData] : [eventData].concat(extras));
    }

    // START domReady
    // Make the standalone domReady function 
    // Adapated from github.com/ded/domready

    /** 
     * Push the readyStack or, if the DOM is already ready, fire the `fn`
     * @param  {Function}  fn         the function to fire when the DOM is ready
     * @param  {Array=}    argsArray  is an array of args to supply to `fn` (defaults to [api])
     */
    function pushOrFire(fn, argsArray) {
        if (isReady) fn.apply(doc, argsArray || [api]);
        else readyStack.push({f: fn, a: argsArray});
    }

    // Fire all funcs in the readyStack and clear each from the readyStack as it's fired
    function flush(ob) {// voided arg
        // When the hack is needed, we prevent the flush from
        // running until the readyState regex passes:
        if (needsHack && !(/^c/).test(doc.readyState)) return;
        // Remove the listener.
        rem(doc, readyType, flush);
        // The flush itself only runs once.
        isReady = 1; // Record that the DOM is ready (needed in pushOrFire)
        while (ob = readyStack.shift())
            ob.f && ob.f.apply(doc, ob.a || [api]);
        // Fire handlers added via .on() too. These get an eventData object as
        // the arg and are fired after the ones above. (jQuery works the same.)
        trigger(doc, 'ready');
    }

    // Add the ready listener:
    add(doc, readyType, flush);

    /** 
     * Define our local `domReady` method:
     * The `argsArray` parameter is for internal use (but extendable via domReady.remix())
     * The public methods are created via remixReady()
     * @param {Function}  fn         the function to fire when the DOM is ready
     * @param {Array=}    argsArray  is an array of args to supply to `fn` (defaults to [api])
     */
    domReady = !needsHack ? pushOrFire : function(fn, argsArray) {
        if (self != top) {
            pushOrFire(fn, argsArray);
        } else {
            try {
                docElem.doScroll('left'); 
            } catch (e) {
                return setTimeout(function() { 
                    domReady(fn, argsArray); 
                }, 50); 
            }
            fn.apply(doc, argsArray || [api]);
        }
    };
    
    /** 
     * Utility for making the public version(s) of the ready function. This gets
     * exposed as a prop on the outputted ready method itself so that devs have a
     * way to bind the ready function to a host lib and/or customize (curry) the
     * args supplied to the ready function.
     * @param  {...}   args   are zero or more args that fns passed to ready will receive
     * @return {Function}
     */    
    function remixReady(args) {
        // The `args` are supplied to the remixed ready function:
        args = slice.call(arguments);
        function ready(fn) {
            domReady(fn, args); // call the local (private) domReady method, which takes args
            if (this !== win) return this; // chain instance or parent but never window
        }
        // Put the remix function itself as method on the method.
        ready['remix'] = remixReady; 
        ready['relay'] = function($) { 
            return remixReady($ || void 0); 
        };
        return ready; // the actual domReady/.ready method that elo exposes
    }

    // Build the public domReady/.ready methods. (We include a top-level .ready alias.
    // Keep that in mind when integrating w/ libs that aim to be jQuery-compatible b/c
    // jQuery uses jQuery.ready privately for something else and here all 3 are aliased.)
    //api['ready'] = api['domReady'] = api['fn']['ready'] = remixReady(api);
    api['domReady'] = api['fn']['ready'] = eloReady = remixReady(api);

    // END domReady
    
    // Top-level only
    api['applyAll'] = applyAll;
    api['hasEvent'] = hasEvent;
    api['qsa'] = queryEngine;   

    // Top-level + chainable
    // The top-level version are the simple (singular) versions defined above. (They 
    // operate directly on a node or object). The effin versions of these are 'built'
    // below via wrapperize() and they operate on each object in a matched set.
    api['removeData'] = removeData;
    api['cleanData'] = cleanData;
    api['addEvent'] = add;
    api['removeEvent'] = rem;
    api['on'] = on;
    api['off'] = off;
    api['one'] = one; 
    api['trigger'] = trigger;

    // Top-level + chainable (more)
    // The effin versions of these are made manually below
    api['each'] = each;
    api['data'] = data;

    /** 
     * Utility for converting simple static methods into their chainable effin versions.
     * @link   jsperf.com/wrapperized-methods/3
     * @param  {Function}  fn
     * @return {Function}
     */
    function wrapperize(fn) {
        return function() {
            var i = 0, args = [0], l = this.length;
            for (push.apply(args, arguments); i < l;)
                null != (args[0] = this[i++]) && fn.apply(this, args);
            return this;
        };
    }

    // Build effin versions of these static methods.
    eachSSV('addEvent removeEvent on off one trigger removeData', function(methodName) {
        api['fn'][methodName] = wrapperize(api[methodName]);
    });

    /**
     * @param {Function} fn callback receives (value, key, ob)
     * @param {*=} scope thisArg (defaults to current item)
     * @param {*=} breaker defaults to `false`
     */
    api['fn']['each'] = function(fn, scope, breaker) {
        return each(this, fn, scope, breaker); 
    };

    // In elo 1.4+ the cleanData method is only directly avail on the top-level.
    // api['fn']['cleanData'] = function (inclInstance) {
    //    return true === inclInstance ? cleanData(this) : each(this, cleanData);
    // };

    /**
     * @this {{length:number}} stack of functions to fire
     * @param {*=} scope
     * @param {(Array|Arguments)=} args
     * @param {*=} breaker
     * @return {boolean}
     */
    api['fn']['applyAll'] = function(scope, args, breaker) {
        return applyAll(this, scope, args, breaker); 
    };
    
    // Handle data separately so that we can return the value on gets
    // but return the instance on sets. This sets the val on each elem
    // in the set vs. the lower-level method that only sets one object.
    api['fn']['data'] = function(key, val) {
        var i, n, count = arguments.length, hasVal = 1 < count;
        if (!count) return this[0] ? data(this[0]) : void 0; // GET-all
        // We have to make sure `key` is not an object (in which case it'd be set, not get)
        // Strings created by (new String()) are treated as objects. ( bit.ly/NPuVIr )
        // Also remember that `key` can be a `number` too.
        if (!hasVal && typeof key != 'object')
            // Expedite simple gets by directly grabbing from the dataMap.
            // Return the value (if it exists) or else undefined:
            return (i = getId(this[0])) && dataMap[i] ? dataMap[i][key] : void 0; // GET
        for (i = 0, n = this.length; i < n; i++)
            // Iterate thru the truthy items, setting data on each of them.
            this[i] && (hasVal ? data(this[i], key, val) : data(this[i], key)); // SET
        return this;
    };
    
    // Include this b/c of it relates to internal data.
    // adapted from jQuery.fn.empty
    api['fn']['empty'] = function() {
        for (var node, i = 0; null != (node = this[i]); i++) {
            1 === node.nodeType && cleanData(node.getElementsByTagName('*'));
            while (node.firstChild) node.removeChild(node.firstChild);
        }
        return this;
    };
    
    /**
     * @param {string} type event name
     * @return {Function}
     */
    function shorthand(type) {
        return function() {
            var use = [type], method = 1 < push.apply(use, arguments) ? 'on' : 'trigger';
            return this[method].apply(this, use);
        };
    }

    /**
     * Add event shorthands to the chain or a specified object.
     * @param {Array|string} list of shortcut names
     * @param {*=} dest destination defaults to `this`
     * @link http://developer.mozilla.org/en/DOM_Events
     * @example $.dubEvent('resize scroll focus')
     */
    function dubEvent(list, dest) {
        dest = dest === Object(dest) ? dest : this === win ? {} : this;
        return eachSSV(list, function(n) {
            dest[n] = shorthand(n);
        }), dest;
    }
    api['fn']['dubEvent'] = dubEvent;

    /**
     * Integrate applicable methods|objects into a host.
     * @link http://github.com/ryanve/submix
     * @this {Object|Function} supplier
     * @param {Object|Function} r receiver
     * @param {boolean=} force whether to overwrite existing props (default: false)
     * @param {(Object|Function|null)=} $ the top-level of the host api (default: `r`)
     */
    function bridge(r, force, $) {
        var v, k, relay, custom, s = this; // s is the supplier
        if (!r || !s || s === win) return;
        custom = s['bridge']; // supplier may have custom bridge
        if (typeof custom == 'function' && custom['relay'] === false) {
            custom.apply(this, arguments);
            return r;
        }
        force = true === force; // require explicit true to force
        $ = typeof $ == 'function' || typeof $ == 'object' ? $ : r; // allow null
        for (k in s) {
            v = s[k];
            if (typeof v == 'function' || typeof v == 'object' && v) {
                if ('fn' === k && v !== s) {
                    // 2nd check above prevents infinite loop 
                    // from `.fn` having ref to self on it.
                    bridge.call(v, r[k], force, $);
                } else if (force ? r[k] !== r && r[k] !== $ : r[k] == null) {
                    // The check above prevents overwriting receiver's refs to
                    // self (even if forced). Now handle relays and the transfer:
                    relay = v['relay'];
                    if (typeof relay == 'function') {
                        // Fire relay functions. I haven't fully solidified the
                        // relay call sig. Considering: .call(v, $, r[k], k, r)
                        // This passes the essentials:
                        relay = relay.call(v, $, r[k]);
                    }
                    if (relay !== false) {// Provides a way to bypass non-agnostic props.
                        // Transfer the value. Default to the orig supplier value:
                        r[k] = relay || v;
                    }
                }
            }
        }
        return r;
    }
    
    // signify that this bridge() is module agnostic
    bridge['relay'] = true;
    api['bridge'] = bridge;

    /**
     * @param {Object|Function} api
     * @param {Object|Function} root
     * @param {string} name
     * @param {string=} alias
     */
    function noConflictRemix(api, root, name, alias) {
        if (!root || !name || !api ) return;
        var old = root[name], viejo;
        alias = typeof alias == 'string' && alias;
        viejo = alias && root[alias];

        function noConflict(fn) {
            alias && api === root[alias] && (root[alias] = viejo);
            (fn || !alias) && api === root[name] && (root[name] = old);
            typeof fn == 'function' && fn.call(root, api, name, alias); 
            return api;
        }

        noConflict['relay'] = false;
        noConflict['remix'] = noConflictRemix;
        return noConflict;
    }
    api['noConflict'] = noConflictRemix(api, root, name, '$');

    // api.eventMap = eventMap; // only for testing
    // api.dataMap = dataMap;   // only for testing
    return api;
}));