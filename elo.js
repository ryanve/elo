/*!
 * elo          elo is lo-fi cross-browser Javascript events and data module
 *              designed for extendabilty. It can be used as standalone lib  
 *              or integrated into a jQuery-like host such as ender.no.de.
 * @author      Ryan Van Etten (c) 2012
 * @link        http://github.com/ryanve/elo
 * @license     MIT
 * @version     1.4.1
 */

/*jslint browser: true, devel: true, node: true, passfail: false, bitwise: true, continue: true
, debug: true, eqeq: true, es5: true, forin: true, newcap: true, nomen: true, plusplus: true
, regexp: true, undef: true, sloppy: true, stupid: true, sub: true, vars: true, white: true
, indent: 4, maxerr: 180 */

(function (root, name, factory) {
    if (typeof module != 'undefined' && module['exports']) { module['exports'] = factory(); } // node
    else { root[name] = factory(); } // browser
}(this, 'elo', function () { // factory:

    // elo takes much inspiration from:
    // jQuery (jquery.com)
    // Bean   (github.com/fat/bean)
    // Bonzo  (github.com/ded/bonzo)

    // Array notation is used on property names that we don't want the
    // Google Closure Compiler to rename in advanced optimization mode. 
    // developers.google.com/closure/compiler/docs/api-tutorial3
    // developers.google.com/closure/compiler/docs/js-for-compiler

    var root = this
      , name = 'elo'
      , alias = '$'
      , win = window
      , doc = document
      , docElem = doc.documentElement
      , slice = [].slice
      , owns = {}.hasOwnProperty

        // Data objects are organized by unique identifier:
        // Use null objects so we don't need to do hasOwnProperty checks
      , eventMap = { "__proto__": null } // event data cache
      , dataMap = { "__proto__": null } // other data cache
      , uidProp = 'uidElo' // property name
      , uidAttr = 'data-uid-elo' // elements are identified via data attribute
      , uid = 1 // unique identifier
      
        // simple query engine - use QSA or fallback to byTag
      , queryMethod = 'querySelectorAll' // caniuse.com/#feat=queryselector
      , QSA = !!doc[queryMethod] || !(queryMethod = 'getElementsByTagName')
      , queryEngine = function (s, root) {
            return s ? (root || doc)[queryMethod](s) : []; 
        }

        // Feature detection:
      , W3C = !!doc.addEventListener
      , FIX = !('onblur' in docElem) // Detect whether to fix event detection in hasEvent()

        // Normalize the native add/remove-event methods:
      , add = W3C ? function (node, type, fn) { node.addEventListener(type, fn, false); }
                  : function (node, type, fn) { node.attachEvent('on' + type, fn); }
      , rem = W3C ? function (node, type, fn) { node.removeEventListener(type, fn, false); }
                  : function (node, type, fn) { node.detachEvent('on' + type, fn); }

        // Local vars specific to domReady:
      , readyStack = [] // stack of functions to fire when the DOM is ready
      , isReady = /^loade|c/.test(doc.readyState) // test initial state
      , needsHack = !!docElem.doScroll
      , readyType = needsHack ? 'onreadystatechange' : 'DOMContentLoaded'
      , domReady // defined later
      , eloReady // defined later
    ;

    // Temporary local version of hook allows for the actual
    // $.hook to be added after the api has been created. If $.hook 
    // is added, then this local version becomes a ref to $.hook
    // See the source of @link github.com/ryanve/dj
    // It's the best kind of magic.
    function hook (k) {
        var realHook = api['hook'];
        if ( !realHook || !realHook['remix'] ) {
            return 'select' === k ? queryEngine : 'api' === k ? eloReady : void 0;
        }
        // send the default hooks
        realHook('select', queryEngine); 
        realHook('api', eloReady);
        realHook(name, api) && realHook(name, false);
        hook = realHook; // redefine self
        return realHook.apply(this, arguments);        
    }

    /**
     * api is the export (all public methods are added to it)
     * @param  {*}        item
     * @param  {Object=}  root 
     */
    function api(item, root) {
        return new Api(item, root);
    }

   /**
    * @constructor
    * @param  {*=}       item 
    * @param  {Object=}  root 
    * adapted from jQuery and ender.no.de
    */
    function Api (item, root) {
        var i = 0;
        this['length'] = 0;
        if ( typeof item == 'function' ) {
            // The default 'api' closure is a ready shortcut that passes the `api` as the
            // first arg and the `document` as `this`:
            hook('api')(item); // < designed to be closure or ready shortcut
        } else if (item && (item.nodeType || typeof (i = item.length) != 'number' || item === win)) {
            // Handle DOM elems/nodes and anything w/o a length *number* ( jsperf.com/isnumber-ab )
            // The window has length in it and must be checked too. ( jsperf.com/iswindow-prop )
            this[0] = item; 
            this['length'] = 1;
        } else {// Array-like:
            if ( typeof item == 'string' ) {
                this['selector'] = item;
                item = hook('select')(item, root);
                i = item.length;
            }
            // Ensure length is 0 or a positive finite "number" and not NaN:
            this['length'] = i = i > 0 ? i >> 0 : 0;
            while ( i-- ) {// make array-like:
                this[i] = item[i]; 
            }
        }
    }
    
    // jQuery-inspired magic to make `api() instanceof api` be `true` and to make
    // it so that methods added to api.fn map back to the prototype and vice versa.
    api.prototype = api['fn'] = Api.prototype = {};

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
     * Function that returns false (for compat w/ jQuery's false shorthand)
     */
    function returnFalse() {
        return false;
    }

    /**
     * $.each()                    A hella' ballistic iterator: jQuery had sex
     *                             with Underscore. This was the offspring.
     * @param  {*}        ob       is the array|object|string|function to iterate over.
     * @param  {Function} fn       is the callback - it receives (value, key, ob)
     * @param  {*=}       scope    thisArg (defaults to current item)
     * @param  {*=}       breaker  value for which if fn returns it, the loop stops (default: false)
     */
    function each(ob, fn, scope, breaker) {

        if ( null == ob ) { return ob; }
        var i = 0, l = ob.length;
        breaker = void 0 === breaker ? false : breaker; // (default: false)
        
        // Opt out of the native forEach here b/c we want to:
        // * have abilty to iterate strings (cannot use `in` on "string")
        // * default the scope to the current item
        // * return the object for chaining
        // * be able to break out of the loop if the fn returns the breaker

        if (typeof l == 'number' && typeof ob != 'function' && l === l) {// last part stuffs NaN
            while ( i < l ) {// Array-like: 
                // bypass `i in ob` to make common loops faster and to allow string iteration
                if ( fn.call( scope || ob[i], ob[i], i++, ob ) === breaker ) { break; }
            }
        } else {
            for ( i in ob ) {// NOT array-like:
                // bypass "owns" check to maximize capabilty and performance
                if ( fn.call( scope || ob[i], ob[i], i, ob ) === breaker ) { break; }
            }
        }
        return ob;
    }// each

    /**
     * Convert SSV string to array (if not already) and iterate thru its values.
     * We want this local to be fast and furious. It gets called each time on, 
     * off, one, is called, among other internal usages.
     * @link   jsperf.com/eachssv
     * @param  {Array|string|*}  list   is a space-separated string or array to iterate over
     * @param  {Function}        fn     is the callback - it receives (value, key, ob)
     */
    function eachSSV (list, fn) {
        var l, i = 0;
        list instanceof Array || (list = list.split(' '));
        for (l = list.length; i < l; i++) {
            // Only iterate truthy values.
            // Omit thisArg support (no .call) as a minor optimization
            list[i] && fn(list[i], i, list);
        }
    }

    /**
     * Augment an object with the properties of another object.
     * @param  {Object|Array|Function}  r   receiver
     * @param  {Object|Array|Function}  s   supplier
     */
     function aug (r, s) {
        var k;
        for ( k in s ) { 
            r[k] = s[k]; 
        }
        return r;
    }

    /**
     * Fire every function in an array (or arr-like object) using the 
     * specified scope and args.
     * @param  {Array|Object}  fns      array of functions to fire
     * @param  {Object|*}      scope    the value of `this` in each fn
     * @param  {Array=}        args     optional args to pass to each fn
     * @param  {*=}            breaker  optional value for which if any of the fns return
     *                                  that value, the loop will stop
     */
    function applyAll(fns, scope, args, breaker) {
        if ( !fns ) { return true; } // ensures the only way to return falsey is via the breaker
        var i = 0, l = fns.length, stop = void 0 !== breaker;
        stop || (breaker = 0); // breaker is disregarded w/o stop - do this to simplify the loop
        for ( args = args || []; i < l; i++ ) {
            if (typeof fns[i] == 'function' && fns[i].apply(scope, args) === breaker && stop) {
                // break by returning `false` so that `applyAll` can be used to break out of `each`
                return false;
            }
        }
        return fns;
    }

    /**
     * Get the unique id associated with the specified item. If an id has not
     * yet been created, then create it. Return `undefined` for invalid types.
     * To have an id, the item must be truthy and either an object or function.
     * @param  {*}                 item
     * @return {number|undefined}
     */
    function getId(item) {
        var id; // initially undefined
        if ( !item ) { return id; }
        if ( item.nodeType && item.getAttribute && item.setAttribute ) {// DOM elements:
            (id = item.getAttribute(uidAttr)) || item.setAttribute(uidAttr, (id = uid++));
            return id;
        }
        return (typeof item != 'object' && typeof item != 'function' ? id // undefined
                : (item === doc ? 'd' : item === win ? 'w' : item === root ? 'r' // document|window|root
                : (item[uidProp] = item[uidProp] || uid++))); // other objects/funcs
    }

    /**
     * Get or set arbitrary data associated with an object.
     * @param  {Object|Array|Function}  obj
     * @param  {(string|Object)=}       key
     * @param  {*=}                     val
     */    
    function data(obj, key, val) {
        var id = getId(obj), hasVal = arguments.length > 2;
        if ( !id || (hasVal && key == null) ) {
            throw new TypeError('@data'); 
        }
        dataMap[id] = dataMap[id] || { "__proto__": null }; // initialize if needed
        if ( key == null ) {// GET invalid OR all
            return key === null ? void 0 : aug({}, dataMap[id]);
        }
        if ( hasVal ) {
            dataMap[id][key] = val; // SET (single)
            return val; // return the current val
        }
        if ( typeof key != 'object' ) {
            return dataMap[id][key]; // GET (single)
        }
        aug(dataMap[id], key); // SET (multi)
    }

    /**
     * Remove data associated with an object that was added via data()
     * Remove data by key, or if no key is provided, remove all.
     * @param  {*=}                obj
     * @param  {(string|number)=}  keys
     */
    function removeData(obj, keys) {
        var id;
        if (obj) {
            id = getId(obj);
            if (id && dataMap[id]) {
                if ( arguments.length < 2 ) {// delete all data:
                    delete dataMap[id]; 
                } else if ( typeof keys == 'number' ) {// numbers:
                    delete dataMap[id][keys]; 
                } else if ( keys ) {// strings:
                    eachSSV(keys, function(k){
                        delete dataMap[id][k]; 
                    });
                }
            }
        }
        return obj;
    }

    /**
     * Remove event handlers from the internal eventMap. If `fn` is not specified,
     * then remove all the event handlers for the specified `type`. If `type` is 
     * not specified, then remove all the event handlers for the specified `node`.
     * @param  {Object|*}         node
     * @param  {(string|null)=}   type
     * @param  {Function=}        fn
     */
    function cleanEvents(node, type, fn) {
        if (!node) { return; }
        var fid, typ, key, updated = [], id = getId(node);
        if (id && eventMap[id]) {
            if (!type) {// remove all of node's handlers for all event types:
                delete eventMap[id];
            } else if ( eventMap[id][key = 'on' + type] ) {
                if ( !fn ) {// remove all of node's handlers for the type:
                    delete eventMap[id][key];
                } else if (fid = fn[uidProp]) {// remove the specified handler:
                    eachSSV(eventMap[id][key], function(handler) {
                        // Push all of 'em except the one we want to remove:
                        fid !== handler[uidProp] && updated.push(handler);
                    });
                    eventMap[id][key] = updated;
                    if ( !updated[0] ) {
                        delete eventMap[id][key];
                    }
                    // If an `fn` was specified and the event name is namespaced, then we
                    // also need to remove the `fn` from the non-namespaced handler array:
                    typ = type.split('.')[0]; // type w/o namespace
                    typ === type || cleanEvents(node, 'on' + typ, fn);
                }
            }
        }
    }

    /**
     * Delete **all** the elo data associated with the specified item(s).
     * @param {*}  item  is the item or collection of items whose data you want to purge.
     */
    function cleanData (item) {
        var i;
        if ( !item ) { return; }
        removeData(item);
        if (typeof item == 'object') {
            cleanEvents(item);
            if (item.nodeType && item.removeAttribute) {
                item.removeAttribute(uidAttr);
            } else {
                i = item.length;
                if (typeof i == 'number') {// Go deep. . .
                    while ( i-- ) { cleanData(item[i]); }
                }
            }
        }
        void 0 === item[uidProp] || (delete item[uidProp]) || (item[uidProp] = void 0);
    }

    /**
     * hasEvent()   Test if the specified node supports the specified event type.
     *              This function uses the same signature as Modernizr.hasEvent, 
     *              which is very simliar but not exactly the same. The Modernizr one
     *              has some baked in default elements for certain event types. This 
     *              version defaults to a div, but is overall more capable b/c it allows
     *              devs to pass a tagName as the node param.
     *
     * @link    bit.ly/event-detection
     * @param   {string|*}            eventName  the event name, e.g. 'blur'
     * @param   {(Object|string|*)=}  node       a node, window, or tagName (defaults to div)
     * @return  {boolean}
     */
    function hasEvent(eventName, node) {

        if ( !eventName ) { return false; }
        var isSupported;
        eventName = 'on' + eventName;

        if ( !node || typeof node == 'string' ) {
            node = doc.createElement(node || 'div');
        } else if ( typeof node != 'object' ) {
            return false; // `node` was invalid type
        }

         // Technique for modern browsers and IE:
        isSupported = eventName in node;

        // We're done unless we need the fix:              
        if ( !isSupported && FIX ) {
            // Hack for old Firefox - bit.ly/event-detection
            if ( !node.setAttribute ) {
                // Switch to generic element:
                node = doc.createElement('div'); 
            }
            if (node.setAttribute && node.removeAttribute) {
                // Test via hack:
                node.setAttribute(eventName, '');
                isSupported = typeof node[eventName] == 'function';

                // Cleanup:
                if (node[eventName] != null) {
                    node[eventName] = void 0; 
                }
                node.removeAttribute(eventName);
            }
        }

        // Nullify node references to prevent memory leaks:
        node = null; 
        return isSupported;
    }

    /**
     * Adapter for handling 'event maps' passed to `on`, `off`, and `one`
     * @param {Object|*}     list   an events map (event names as keys and handlers as values)
     * @param {Function}     method the function to call on each event event pair (`on`, `off`, or `one`)
     * @param {(Object|*)=}  node   is the element or object to attach the events to
     */
    function eachEvent(list, method, node) {
        var name;
        for ( name in list ) {
            method(node, name, list[name]);
        }
    }
    
    /**
     * Get a new function that calls the specified `fn` with the specified `scope`. We 
     * use this to normalize event handlers in non-standard browsers. It is similar to 
     * the native .bind()'s simplest usage.
     * @param  {Function}   fn      is the function to normalize
     * @param  {*=}         scope   is the thisArg (defaults to `window` if not provided)
     * @return {Function}
     */
    function normalizeScope(fn, scope) {
        function normalized() {
            return fn.apply(scope, arguments); 
        }
        if (fn[uidProp]) {
            // Technically we should give `normalized` its own uid (maybe negative or
            // underscored). But, for our internal usage, cloning the original is fine, 
            // and it simplifies removing event handlers via off() (see cleanEvents()).
            normalized[uidProp] = fn[uidProp]; 
        }
        return normalized;
    }

    /**
     * on()    Attach an event handler function for one or more event types to the specified node.
     * @param  {Object}          node    is the element|document|window|object to attach events to
     * @param  {string|Object}   types   one or more space-separated event names, or an events map
     * @param  {Function=}       fn      the callback to fire when the event occurs
     */    
    function on(node, types, fn) {
    
        // Don't deal w/ text/comment nodes (for jQuery-compatibility)
        // jQuery's `false` "shorthand" has no effect here.            
        if ( !node || 3 === node.nodeType || 8 === node.nodeType ) { return; }
        var id, isMap = !fn && typeof types == 'object';
        if ( null == types || typeof node != 'object' ) { 
            throw new TypeError('@on'); 
        }

        if ( isMap ) {
            eachEvent(types, on, node); 
        } else {
            if ( false === fn ) { 
                fn = returnFalse; 
            } else if ( !fn ) { 
                return; 
            }
            id = getId(node);
            if ( !id ) { return; }

            fn[uidProp] = fn[uidProp] || uid++; // add identifier
            eventMap[id] = eventMap[id] || []; // initialize if needed

            // In modern browsers the value of `this` in the listener is the node.
            // In old IE, it's the window. We normalize it here to make it so that
            // the `this` value in the listener is always the `node`.
            if ( !W3C ) {
                fn = normalizeScope(fn, node);
            }

            eachSSV(types, function(type) {
                var typ = type.split('.')[0] // w/o namespace
                  , key = 'on' + type // w/ namespace (if any)
                  , prp = 'on' + typ  // w/o namespace
                  , hasNamespace = typ !== type;
                
                if (hasEvent(typ, node)) {
                    // Add native events via the native method:
                    add(node, typ, fn);
                }

                // Update our internal eventMap's handlers array:
                if (eventMap[id][key]) { 
                    eventMap[id][key].push(fn);
                } else { eventMap[id][key] = [fn]; }
                
                if (hasNamespace) {
                    // Also update the non-namespaced array (to make sure the handler fires
                    // when the non-namespaced event is triggered).
                    if (eventMap[id][prp]) {
                        eventMap[id][prp].push(fn);
                    } else { eventMap[id][prp] = [fn]; }
                }
            });
        }
    }

    /**
     * off()   Remove an event handlers added via on() from the specified node. If `fn` is
     *         not specified, then remove all the handlers for the specified types. If `types`
     *         is not specfied, then remove *all* the handlers from the specified node.
     * @param  {Object}           node    is the element|document|window|object to remove events from
     * @param  {(string|Object)=} types   one or more space-separated event names, or an events map
     * @param  {Function=}        fn      the event handler to remove
     */
    function off(node, types, fn) {
        if ( !node || 3 === node.nodeType || 8 === node.nodeType ) { return; }
        if ( false === fn ) { fn = returnFalse; }
        if ( typeof node != 'object' ) { 
            throw new TypeError('@off'); 
        }
        if ( types == null ) {// Remove all:
            cleanEvents(node, types, fn); 
        } else {
            if ( !fn && typeof types == 'object' ) {// Map: 
                eachEvent(types, off, node); 
            } else {
                eachSSV(types, function(type) {
                    var typ = type.split('.')[0]; // w/o namespace
                    if (typeof fn == 'function' && hasEvent(typ, node)) {
                        rem(node, typ, fn);
                    }
                    cleanEvents(node, type, fn);
                });
            }
        }
    }

    /**
     * one()   Add an event handler that only runs once and is then removed.
     * @param  {Object}         node   is the element|document|window|object to add events to
     * @param  {string|Object}  types  one or more space-separated event names, or an events map
     * @param  {Function=}      fn     the event handler to add (runs only once)
     */
    function one(node, types, fn) {
        if ( null == fn && typeof types == 'object' ) {
            eachEvent(types, one, node);
        } else {
            var actualHandler;
            on(node, types, (actualHandler = function(){
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
     * @param  {Object}  node   is the element or object to trigger the event for
     * @param  {string}  type   is an event name to trigger (namespaces are supported)
     * @param  {Array=}  extras is an array of extra parameters to provide to the handler.
     *                          The handlers receive (eventData, extras[0], extras[1], ...)
     */
    function trigger (node, type, extras) {
    
        if ( !type || !node || 3 === node.nodeType || 8 === node.nodeType ) { return; }
        if ( typeof node != 'object' ) { throw new TypeError('@trigger'); }
        var eventData = {}, id = getId(node), args;
        if ( !id || !eventMap[id] ) { return; }
        
        // Emulate the native and jQuery arg signature for event listeners,
        // supplying an object as first arg, but only supply a few props.
        // The `node` becomes the `this` value inside the handler.

        eventData['type'] = type.split('.')[0]; // w/o namespace
        eventData['isTrigger'] = true;
        args = [eventData];
        extras && args.push.apply(args, extras);

        applyAll(eventMap[id]['on' + type], node, args);

    }

    // START domReady
    // Make the standalone domReady function 
    // Adapated from github.com/ded/domready

    /* 
     * Push the readyStack or, if the DOM is already ready, fire the `fn`
     * @param  {Function}  fn         the function to fire when the DOM is ready
     * @param  {Array=}    argsArray  is an array of args to supply to `fn` (defaults to [api])
     */
    function pushOrFire(fn, argsArray) {
        if (isReady) {
            // Make is so that `this` refers to the `document` inside the `fn`
            fn.apply(doc, argsArray || [api]); // < supply args (see remixReady())
        } else {
            // Push an object onto the readyStack that includes the
            // func to fire and the arguments array so that the 
            // arguments are accessible inside flush().
            readyStack.push({f: fn, a: argsArray});
        }
    }

    // Fire all funcs in the readyStack and clear each from the readyStack as it's fired
    function flush(ob) {// voided arg
        // When the hack is needed, we prevent the flush from
        // running until the readyState regex passes:
        if (needsHack && !(/^c/).test(doc.readyState)) { return; }
        
        // Remove the listener: 
        rem(doc, readyType, flush);

        // The flush itself only runs once:
        isReady = 1; // Record that the DOM is ready (needed in pushOrFire)
        while (ob = readyStack.shift()) {// each object added via pushOrFire
            ob.f && ob.f.apply(doc, ob.a || [api]); 
        }

        // Fire handlers added via .on() too. These get an eventData object as
        // the arg and are fired after the ones above. (jQuery works the same.)
        trigger(doc, 'ready');
    }

    // Add the ready listener:
    add(doc, readyType, flush);

    /* 
     * Define our local `domReady` method:
     * The `argsArray` parameter is for internal use (but extendable via domReady.remix())
     * The public methods are created via remixReady()
     * @param {Function}  fn         the function to fire when the DOM is ready
     * @param {Array=}    argsArray  is an array of args to supply to `fn` (defaults to [api])
     */
    domReady = !needsHack ? pushOrFire : function(fn, argsArray) {
        if ( self != top) {
            pushOrFire(fn, argsArray);
        } else {
            try { docElem.doScroll('left'); }
            catch (e) { return setTimeout(function() { domReady(fn, argsArray); }, 50); }
            fn.apply(doc, argsArray || [api]);
        }
    };
    
    /* 
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

        function ready (fn) {
            domReady(fn, args); // call the local (private) domReady method, which takes args
            if (this !== win) { return this; } // chain instance or parent but never window
        }

        // put the remix function itself as method on the method
        ready['remix'] = remixReady; 
        ready['relay'] = function ($) { 
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
        return function () {
            var i = 0, args = [0], l = this.length;
            args.push.apply(args, arguments);
            while ( i < l ) {
                null == (args[0] = this[i++]) || fn.apply(this, args); 
            }
            return this;
        };
    }

    // Build effin versions of these static methods.
    eachSSV('addEvent removeEvent on off one trigger removeData', function (methodName) {
        api['fn'][methodName] = wrapperize(api[methodName]);
    });

    // Convert the rest manually:
    
    /**
     * .each()
     * @param  {Function}  fn       is the callback - it receives (value, key, ob)
     * @param  {*=}        scope    thisArg (defaults to current item)
     * @param  {*=}        breaker  defaults to `false`
     */
    api['fn']['each'] = function (fn, scope, breaker) {
        return each(this, fn, scope, breaker); 
    };

    // In elo 1.4+ the cleanData method is only directly avail on the top-level.
    // api['fn']['cleanData'] = function (inclInstance) {
    //    return true === inclInstance ? cleanData(this) : each(this, cleanData);
    // };

    /**
     * Fire every function in `this` **OR** fire one or more 
     * functions for each item in `this` -- using the supplied args.
     * Syntax 1: $(fnsArray).applyAll(scope [, args, breaker])
     * Syntax 2: $(els).applyAll(fnsArray [, args, breaker, outerContinue])
     * In syntax 2, the scope in the apply'd fn will be the current elem.
     * Syntax 1 used *unless* the first arg is an *array*.
     * $(els).applyAll(fnsArray, args, false) //< able to break firing on current el and move onto the next el
     * $(els).applyAll(fnsArray, args, false, false) //< able to break "hard" (break out of both loops)
     */
    api['fn']['applyAll'] = function(scope, args, breaker, outerContinue) {
        if (scope instanceof Array) {// Syntax 2:
            // HANDLE: $(els).applyAll([function(a, b, c){   }], [a, b, c]);
            outerContinue = outerContinue !== false; // convert to `each` breaker
            return each(this, function(el) {// `el` goes to the scope of the apply'd fn:
                return applyAll(this, el, args, breaker) ? true : outerContinue;
            }, scope); // < pass `scope` (array of fns) as `this` in iterator
        }
        // Syntax 1:
        // HANDLE: $(fns).applyAll(thisArg, [a, b, c]); 
        // (thisArg can be anything but an array in this syntax)
        return applyAll(this, scope, args, breaker); 
    };
    
    // Handle data separately so that we can return the value on gets
    // but return the instance on sets. This sets the val on each elem
    // in the set vs. the lower-level method that only sets one object.

    api['fn']['data'] = function(key, val) {
        var i, n, count = arguments.length, hasVal = 1 < count;
        if ( !count ) {
            // GET-all (return the entire data object if it exists) or else undefined
            return this[0] ? data(this[0]) : void 0;
        }

        // We have to make sure `key` is not an object (in which case it'd be set, not get)
        // Strings created by (new String()) are treated as objects. ( bit.ly/NPuVIr )
        // Also remember that `key` can be a `number` too.
        if ( !hasVal && typeof key != 'object' ) { // GET
            // Expedite simple gets by directly grabbing from the dataMap.
            // Return the value (if it exists) or else undefined:
            return (i = getId(this[0])) && dataMap[i] ? dataMap[i][key] : void 0;
        }
        
        for (i = 0, n = this.length; i < n; i++) { // SET
            // Iterate thru the truthy items, setting data on each of them.
            this[i] && (hasVal ? data(this[i], key, val) : data(this[i], key));
        }
        return this;
    };
    
    // I'm debating including this b/c of its ties to internal data.
    // It's commented out now, but may be added in the future.
    // Let me know if you think it should be added @ryanve
    /*api['fn']['empty'] = function() {// adapted from jQuery.fn.empty
        var i, node;
        for ( i = 0; (node = this[i]) || i < this.length; i++ ) {
            if ( node ) {
                if ( 1 === node.nodeType ) {
                    // clean child elems to prevent memory leaks
                    cleanData(node.getElementsByTagName('*'));
                }
                while ( node.firstChild ) {
                    // remove child elems
                    node.removeChild( node.firstChild );
                }
            }
        }
        return this;
    };*/

    /**
     * dubEvent()  Add event shortcut methods to the chain (specified in a SSV list or array)
     * @since      1.4 (formerly mixinEvent()) 
     * @param      {Array|string}  list   array or SSV string of shortcut names
     * @param      {boolean=}      force  whether to overwrite existing methods (default: false)
     * @link       developer.mozilla.org/en/DOM_Events
     * @example    $.dubEvent('resize scroll focus')  // creates $.fn.resize, ...
     */
    function dubEvent (list, force) {
        if ( this === win ) { return; }
        var receiver = this;
        force = true === force;
        list && eachSSV(list, function (n) {
            (force || void 0 === receiver[n]) && (receiver[n] = function (fn) {
                return arguments.length ? this['on'](n, fn) : this['trigger'](n);
            });
        });
        return receiver;
    }
    api['fn']['dubEvent'] = dubEvent;

    /**
     * **** $.bridge comes from @link github.com/ryanve/dj *****
     * $.bridge()    Integrate applicable methods|objects into a host. Other 
     *               types (number|string|undefined|boolean|null) are not bridged. 
     *               `this` augments the receiver `r`. `bridge()` is designed for
     *               merging jQueryish modules, thus `.fn` props bridge one level deep.
     *
     *               Methods|objects whose `.relay` property is set to `false` get
     *               skipped. If the `.relay` property is a function, it is fired 
     *               with `this` being the method|object and the 1st arg being the 
     *               main scope (e.g. $ function) of the receiving api. This provides
     *               a way for the method|object to be adapted to the receiving api.
     *
     *               If the `.relay` returns a truthy value (such as new func) then that 
     *               value is transferred instead of the orig. If the relay returns `false` 
     *               then the method|ob is skipped. If it returns any other falsey value 
     *               then the transferred method will default back to the orig. So in effect, 
     *               the `.relay` prop defaults to `true` and it is not necessary to define 
     *               it for methods|obs that are to be transferred as is.
     *       
     * @this  {Object|Function}                supplier
     * @param {Object|Function}         r      receiver
     * @param {boolean=}                force  whether to overwrite existing props (default: false)
     * @param {(Object|Function|null)=} $      the top-level of the host api (default: `r`)
     *                                         For default behavior `$` should be omitted or set to 
     *                                         `undefined`. This param allows you to bridge to a receiver, 
     *                                         but relay methods based on a another host, for example 
     *                                         `someModule.bridge({}, false, jQuery)`. Set `$` explicity
     *                                         to `null` *only* if you want to communicate to relays that
     *                                         there should be *no* main api.                                   
     */
    function bridge ( r, force, $ ) {

        var v, k, relay, custom, s = this; // s is the supplier
        if ( !r || !s || s === win ) { return; }
        custom = s['bridge']; // supplier may have custom bridge

        if ( typeof custom == 'function' && custom['relay'] === false ) {
            custom.apply(this, arguments);
            return r;
        }
        
        force = true === force; // require explicit true to force
        $ = typeof $ == 'function' || typeof $ == 'object' ? $ : r; // allow null

        for ( k in s ) {
            v = s[k];
            if ( typeof v == 'function' || typeof v == 'object' && v ) {
                if ( 'fn' === k && v !== s ) {
                    // 2nd check above prevents infinite loop 
                    // from `.fn` having ref to self on it.
                    bridge.call(v, r[k], force, $);
                } else if ( force ? r[k] !== r && r[k] !== $ : r[k] == null ) {
                    // The check above prevents overwriting receiver's refs to
                    // self (even if forced). Now handle relays and the transfer:
                    relay = v['relay'];
                    if ( typeof relay == 'function' ) {
                        // Fire relay functions. I haven't fully solidified the
                        // relay call sig. Considering: .call(v, $, r[k], k, r)
                        // This passes the essentials:
                        relay = relay.call(v, $, r[k]);
                    }
                    if ( relay !== false ) {// Provides a way to bypass non-agnostic props.
                        // Transfer the value. Default to the orig supplier value:
                        r[k] = relay || v;
                    }
                }
            }
        }
        
        return r; // receiver

    }// bridge
    
    // signify that this bridge() is module agnostic
    bridge['relay'] = true;
    api['bridge'] = bridge;

    /**
     * @param  {Object|Function}  api
     * @param  {Object|Function}  root
     * @param  {string}           name
     * @param  {string=}          alias
     */
    function noConflictRemix(api, root, name, alias) {

        if ( !root || !name || !api ) { return; }
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

})); // factory and closure