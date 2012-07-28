/*!
 * elo          Lo-fi events and lo-fi data in a compact JavaScript module that
 *              works as a standalone library or integrates into a host like ender.
 *
 * @author      Ryan Van Etten (c) 2012
 * @link        http://github.com/ryanve/elo
 * @license     MIT
 * @version     1.3.1
 */

/*jslint browser: true, devel: true, node: true, passfail: false, bitwise: true, continue: true
, debug: true, eqeq: true, es5: true, forin: true, newcap: true, nomen: true, plusplus: true
, regexp: true, undef: true, sloppy: true, stupid: true, sub: true, vars: true, white: true
, indent: 4, maxerr: 80 */

(function(factory) {
    if (typeof exports !== 'undefined' && typeof module !== 'undefined') {
        module.exports = factory(); // node server
    } else { this['elo'] = factory(); } // browser
}(function(host) { // factory:

    // Allow a host to be passed to the factory for use with bridge()
    // e.g. If `factory(myHost)` or `define(name, ['myhost'], factory)` were
    // used in the logic above, then the api's methods would automatically
    // be added to myHost. Otherwise check for ender (ender.no.de) as a host.

    host = host || this['ender'];
    
    // Elo takes much inspiration from:
    // jQuery (jquery.com)
    // Bean   (github.com/fat/bean)
    // Bonzo  (github.com/ded/bonzo)

    // Array notation is used on property names that we don't want the
    // Google Closure Compiler to rename in advanced optimization mode. 
    // developers.google.com/closure/compiler/docs/api-tutorial3
    // developers.google.com/closure/compiler/docs/js-for-compiler

    var root = this
      , name = 'elo'
      , FN = 'fn' // inlined @ minification
      , win = window
      , doc = document
      , docElem = doc.documentElement
      , slice = [].slice // jsperf.com/arrayify-slice/3

        // Data objects are organized by unique identifier:
      , eventMap = {} // event data cache
      , dataMap = {} // other data cache
      , uidProp = 'uidElo' // property name
      , uidAttr = 'data-uid-elo' // elements are identified via data attribute
      , uid = 1 // unique identifier
      
        // Feature detection:
      , W3C = !!doc.addEventListener
      , QSA = !!doc.querySelectorAll
      , FIX = !('onblur' in docElem) // Detect whether we need to fix event detection in hasEvent()

        // Normalize the native add/remove-event methods:
      , add = W3C ? function (node, type, fn) { node.addEventListener(type, fn, false); }
                  : function (node, type, fn) { node.attachEvent('on' + type, fn); }
      , rem = W3C ? function (node, type, fn) { node.removeEventListener(type, fn, false); }
                  : function (node, type, fn) { node.detachEvent('on' + type, fn); }

        // Simple query engine:
      , qsa = QSA // caniuse.com/#feat=queryselector
            ? function (s, root) { return s ? (root || doc).querySelectorAll(s) : []; }
            : function (s, root) { return s ? (root || doc).getElementsByTagName(s) : []; }
            
        // Local vars specific to hooks:
      , $hook       // recycled `Hook` instance - see api['hook'] and `Hook` and `Api`
      , burned = {} // once a hook is burned it cannot be modified

        // Local vars specific to domReady:
      , readyStack = [] // stack of functions to fire when the DOM is ready
      , isReady = /^loade|c/.test(doc.readyState) // test initial state
      , needsHack = !!docElem.doScroll
      , readyType = needsHack ? 'onreadystatechange' : 'DOMContentLoaded'
      , domReady // defined later
    ;

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
     */
    function Api(item, root) {
        var i;
        if ( !item ) { return this; }
        if ( typeof item === 'function' ) {
            // The default 'api' hook is a ready shortcut that passes the `api` as the
            // first arg and the `document` as `this`:
            $hook['api'](item);
        } else if ( item.nodeType || typeof (i = item.length) !== 'number' || item === win ) {
            // Handle DOM elems/nodes and anything w/o a length *number* ( jsperf.com/isnumber-ab )
            // The window has length in it and must be checked too. ( jsperf.com/iswindow-prop )
            this[0] = item; 
            this['length'] = 1;
        } else {// Array-like:
            if ( typeof item === 'string' ) {
                this['selector'] = item;
                item = $hook['select'](item, root);
                i = item.length;
            }
            // Ensure length is 0 or a positive finite integer:
            this['length'] = i = i > 0 ? i >> 0 : 0;
            while ( i-- ) {// make array-like:
                this[i] = item[i];
            }
        }// implicitly returns `this` when called via `new`
    }
    
    // jQuery-inspired magic to make `api() instanceof api` be `true` and to make
    // it so that methods added to api.fn map back to the prototype and vice versa.
    api.prototype = api[FN] = Api.prototype = {};

    // Default props:
    api[FN]['length'] = 0;
    api[FN]['selector'] = '';

    // Create top-level reference to self:
    // This makes it possible to bridge into a host, destroy the global w/ noConflict, 
    // and still access the entire api from the host (not just the bridged methods.)
    // It is also useful for other modules that may want to detect this module, it can be
    // used to check if an method on the host is from the api, e.g. `($.each === $.elo.each)`
    // and similarly it can be used for assigning methods even after the global is gone.
    api[name] = api;

    /**
     * Object iterator - call a function for each value in the specified object.
     * @param  {Object|function(...)|*} ob     is the object to iterate over
     * @param  {function(...)}          fn     is the callback - it receives (value, key, ob)
     * @param  {*=}                     scope  thisArg (defaults to current item)
     */
    function eachOwn(ob, fn, scope) {
        var n;
        for (n in ob) {
            if (ob.hasOwnProperty(n) && fn.call(scope || ob[n], ob[n], n, ob) === false) {
                // Be able to break out of the loop by returning `false` in the `fn`
                break;
            }
        }
        return ob; // chain
    }

    /**
     * A hella' ballistic iterator. jQuery had sex w/ Underscore and this was the offspring.
     * @param  {*}              ob     is the array|object|string|function to iterate over.
     * @param  {function(...)}  fn     is the callback - it receives (value, key, ob)
     * @param  {*=}             scope  thisArg (defaults to current item)
     */
    function each(ob, fn, scope) {
        if ( !ob ) { return ob; }
        var i = 0, l = ob.length;

        // Opt out of the native forEach here b/c we want to:
        // * support arr-like objects and strings
        // * default the scope to the current item (or `false` if the item == null)
        // * return the object for chaining
        // * be able to break out of the loop by returning `false` in the `fn`
        // * enable specifying a starting index via the `i` param

        // Array-like: 
        // Anything other than funcs that have a length *number* incl. 0 but not NaN:
        if (typeof l === 'number' && typeof ob !== 'function' && l === l) {// last check stuffs NaN
            while ( i < l ) {// minifies to `for(;i<l;)`, iterates via the `i++` below
                // If there is no `scope` and `ob[i]` is null or undefined, then send `false` as the
                // scope to prevent `this` in the callback from unexpectedly resolving to `window`.
                // If an `i in ob` were to be added here, then "string" types would needed to be
                // converted to string objects (e.g. Object(ob)) in order to not throw an error. 
                // Bypassing it makes the loop faster and more capable:
                if (fn.call(scope || ob[i] || false, ob[i], i++, ob) === false) {
                    break; // jsperf.com/each-breaker/2
                }
            }
            return ob; // chain
        }

        // NOT array-like: 
        // functions|plain objects|NaN length|true|number:
        return eachOwn(ob, fn, scope);

    }

    /**
     * Convert SSV string to array (if not already) and iterate thru its values.
     * We want this local to be fast and furious. It gets called each time on, 
     * off, one, is called, among other internal usages.
     * @link   jsperf.com/eachssv
     * @param  {Array|string|*}  list   is a space-separated string or array to iterate over
     * @param  {function(...)}   fn     is the callback - it receives (value, key, ob)
     */
    function eachSSV(list, fn) {
        var l, i = 0;
        list instanceof Array || (list = list.split(' '));
        for (l = list.length; i < l; i++) {
            // Only iterate truthy values.
            // Omit thisArg support (no .call) as a minor optimization
            list[i] && fn(list[i], i, list);
        }
    }

    /**
     * Local mixin function. See api['mixin'] for the public method.
     * It augments an object with the properties of another object.
     * If the `force` param is truthy, props from the `supplier` 
     * will overwrite existing props on the `receiver`.
     * @param  {Object|Array|function(...)}  receiver
     * @param  {Object|Array|function(...)}  supplier
     * @param  {(boolean|number|*)=}         force
     */
    function mixin(receiver, supplier, force) {
        receiver && supplier && eachOwn(supplier, function(v, k){
            (force || void 0 === receiver[k]) && (receiver[k] = v);
        });
        return receiver;
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
        for (args = args || []; i < l; i++) {
            if (typeof fns[i] === 'function' && fns[i].apply(scope, args) === breaker && stop) {
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
        if (!item) { return id; }
        if (item.nodeType && item.getAttribute && item.setAttribute ) {// DOM elements:
            (id = item.getAttribute(uidAttr)) || item.setAttribute(uidAttr, (id = uid++));
            return id;
        }
        return (typeof item !== 'object' && typeof item !== 'function' ? id // undefined
                : (item === doc ? 'd' : item === win ? 'w' : item === root ? 'r' // document|window|root
                : (item[uidProp] = item[uidProp] || uid++))); // other objects/funcs
    }

    /**
     * Get or set arbitrary data associated with an object.
     * @param  {(Object|Array|function(...))}  obj
     * @param  {(string|Object)=}              key
     * @param  {*=}                            val
     */    
    function data(obj, key, val) {
        var id = getId(obj), hasVal = arguments.length > 2;
        if ( !id || (hasVal && key == null) ) {
            throw new TypeError('@data'); 
        }
        dataMap[id] = dataMap[id] || {}; // initialize if needed
        if ( key == null ) {// GET invalid OR all
            return key === null ? void 0 : mixin({}, dataMap[id], 1);
        }
        if ( hasVal ) {
            dataMap[id][key] = val; // SET (single)
            return obj;
        }
        if ( typeof key !== 'object' ) {
            return dataMap[id][key]; // GET (single)
        }
        mixin(dataMap[id], key, 1); // SET (multi)
        return obj;
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
                } else if ( typeof keys === 'number' ) {// numbers:
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
     * @param  {Object|*}          node
     * @param  {(string|null)=}    type
     * @param  {function(...)=}    fn
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
        if ( !item ) { 
            return item; 
        }
        removeData(item);
        if (typeof item === 'object') {
            cleanEvents(item);
            if (item.nodeType && item.removeAttribute) {
                item.removeAttribute(uidAttr);
            } else if (item.length && typeof item.length === 'number') {
                each(item, cleanData); // Go deep. . .
            }
        }
        void 0 === item[uidProp] || (delete item[uidProp]) || (item[uidProp] = void 0);
        return item;
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

        if ( !node || typeof node === 'string' ) {
            node = doc.createElement(node || 'div');
        } else if ( typeof node !== 'object' ) {
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
                isSupported = typeof node[eventName] === 'function';

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
     * @param {Object|*}      list   an events map (event names as keys and handlers as values)
     * @param {function(...)} method the function to call on each event event pair (`on`, `off`, or `one`)
     * @param {(Object|*)=}   node   is the element or object to attach the events to
     */
    function eachEvent(list, method, node) {
        eachOwn(list, function(handler, type){
            handler && method(node, type, handler);
        });
    }
    
    /**
     * Get a new function that calls the specified `fn` with the specified `scope`. We 
     * use this to normalize event handlers in non-standard browsers. It is similar to 
     * the native .bind()'s simplest usage.
     * @param  {function(...)} fn     is the function to normalize
     * @param  {*=}            scope  is the thisArg (defaults to `window` if not provided)
     * @return {function(...)}
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
     * @param  {Object}           node    is the element|document|window|object to attach events to
     * @param  {string|Object}    types   one or more space-separated event names, or an events map
     * @param  {function(...)=}   fn      the callback to fire when the event occurs
     */    
    function on(node, types, fn) {
        // jQuery bans text/comment nodes, which makes sense, so we do the same:
        // The false "shorthand" has no effect here.
        if ( !node || node.nodeType === 3 || node.nodeType === 8 || false === fn ) { return; }
        var id, isMap = !fn && typeof types === 'object';

        if (types == null 
         || typeof node !== 'object'
         || (typeof fn !== 'function' && !isMap)
         ){ throw new TypeError('@on'); }

        if ( isMap ) {
            eachEvent(types, on, node); 
        } else if (id = getId(node)) {

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
     * @param  {Object}            node     is the element|document|window|object to remove events from
     * @param  {(string|Object)=}  types    one or more space-separated event names, or an events map
     * @param  {function(...)=}    fn       the event handler to remove
     */
    function off(node, types, fn) {
        if ( !node || node.nodeType === 3 || node.nodeType === 8 || false === fn ) { return; }
        if (typeof node !== 'object') { 
            throw new TypeError('@off'); 
        }
        if ( types == null ) {// Remove all:
            cleanEvents(node, types, fn); 
        } else {
            if ( !fn && typeof types === 'object' ) {// Map: 
                eachEvent(types, off, node); 
            } else {
                eachSSV(types, function(type) {
                    var typ = type.split('.')[0]; // w/o namespace
                    if (typeof fn === 'function' && hasEvent(typ, node)) {
                        rem(node, typ, fn);
                    }
                    cleanEvents(node, type, fn);
                });
            }
        }
    }

    /**
     * one()   Add an event handler that only runs once and is then removed.
     * @param  {Object}           node   is the element|document|window|object to add events to
     * @param  {string|Object}    types  one or more space-separated event names, or an events map
     * @param  {function(...)=}   fn     the event handler to add (runs only once)
     */
    function one(node, types, fn) {
        if (!fn && typeof types === 'object') {
            eachEvent(types, one, node);
        } else {
            var actualHandler;
            on(node, types, actualHandler = function(){
                off(node, types, actualHandler);
                fn.apply(node, arguments);
            });
        }
    }

    /**
     * Trigger handlers registered via .on() for the specifed event type. This works for
     * native and custom events, but unlike jQuery.fn.trigger it does *not* fire the
     * browser's native actions for the event. To do so would take a lot more code. 
     * In that respect it works like jQuery.fn.triggerHandler, but elo.fn.trigger
     * works like jQuery.fn.trigger otherwise (e.g. it operates on the whole set). 
     * @param  {Object}  node  is the element or object to trigger the event for
     * @param  {string}  type  is an event name to trigger (namespaces are supported)
     * @param  {Array=}  args  is an array of extra parameters to provide to the handler.
     *                         The handlers receive (eventData, args[0], args[1], ...)
     */
    function trigger(node, type, args) {
        if ( !node || node.nodeType === 3 || node.nodeType === 8 ) { return; }
        if ( type == null || typeof node !== 'object' ) { throw new TypeError('@trigger'); }
        var id = getId(node), typ = type.split('.')[0], key = 'on' + type, eventData = {};
        // Emulate the native and jQuery arg signature for event listeners
        // (supplying an object as first arg) but only supply a few props
        // (The `node` becomes the `this` value inside the handler.)
        eventData['type'] = typ; // type w/o namespace
        eventData['isTrigger'] = true;
        // eventData['data'] = $hook['trigger-data'] ? $hook['trigger-data'].call(node, type) : false;
        if (args){
            args.unshift(eventData);  // (`args` *must* be an array)
        } else { args = [eventData]; }
        eventMap[id] && applyAll(eventMap[id][key], node, args);
    }

    // START domReady
    // Make the standalone domReady function 
    // Adapated from github.com/ded/domready

    /* 
     * Push the readyStack or, if the DOM is already ready, fire the `fn`
     * @param {function(...)}  fn   the function to fire when the DOM is ready
     * @param {Array=}  argsArray   is an array of args to supply to `fn` (defaults to [api])
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
     * @param {function(...)}  fn   the function to fire when the DOM is ready
     * @param {Array=}  argsArray   is an array of args to supply to `fn` (defaults to [api])
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
     * @param  {...}  args   are zero or more args that fns passed to ready will receive
     * @return {function(...)}
     */    
    function remixReady(args) {
        
        // The `args` are supplied to the remixed ready function:
        // We default to [this] for integration purposes (see mixout)
        args = arguments.length ? slice.call(arguments) : [this];

        function ready(fn) {
            domReady(fn, args); // call the local (private) domReady method, which takes args
            return this !== win && this; // chain an instance or a parent but never the window
        }

        ready['remix'] = remixReady; // add the remix function itself as method on the method
        return ready; // the actual domReady/.ready method that elo exposes
    }

    // Build the public domReady/.ready methods. (We include a top-level .ready alias.
    // Keep that in mind when integrating w/ libs that aim to be jQuery-compatible b/c
    // jQuery uses jQuery.ready privately for something else and here all 3 are aliased.)
    api['ready'] = api['domReady'] = api[FN]['ready'] = remixReady(api);

    // END domReady
    
    // Top-level only
    // Also see bridge() / noConflict() / mixin() / mixinEvent() defined below.
    api['applyAll'] = applyAll;
    api['hasEvent'] = hasEvent; // if we made an effin, it'd probably be a filter, but nah
    api['qsa'] = qsa;   // not bridged (but expose so other modules can use it)

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
     * @param  {function(...)}  fn
     * @return {function(...)}
     */
    function wrapperize(fn) {
        return function () {
            var i = 0, l = this.length, args = [0];
            args.push.apply(args, arguments);
            while ( i < l ) {
                null == (args[0] = this[i++]) || fn.apply(this, args); 
            }
            return this;
        };
    }

    // AddToWrapper
    // Build effin versions of these static methods. (This must happen before bridge() is called.)
    eachSSV('addEvent removeEvent on off one trigger removeData', function (methodName) {
        api[FN][methodName] = wrapperize(api[methodName]);
    });

    // It's easier to convert the rest manually:
    
    /**
     * .each()
     * @param  {function(...)}  fn     is the callback - it receives (value, key, ob)
     * @param  {*=}             scope  thisArg (defaults to current item)
     */
    api[FN]['each'] = function (fn, scope) { 
        return each(this, fn, scope); 
    };
    
    api[FN]['cleanData'] = function (inclInstance) {
        return true === inclInstance ? cleanData(this) : each(this, cleanData);
    };

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
    api[FN]['applyAll'] = function(scope, args, breaker, outerContinue) {
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

    api[FN]['data'] = function(key, val) {
        var i, n, count = arguments.length, hasVal = 1 < count;
        if ( !count ) {
            // GET-all (return the entire data object if it exists) or else undefined
            return this[0] ? data(this[0]) : void 0;
        }

        // We have to make sure `key` is not an object (in which case it'd be set, not get)
        // Strings created by (new String()) are treated as objects. ( bit.ly/NPuVIr )
        // Also remember that `key` can be a `number` too.
        if ( !hasVal && typeof key !== 'object' ) { // GET
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

    
    // START Hook 
    /** @constructor */ function Hook() {} // empty constructor
    Hook.prototype = {}; // = default hooks =
    Hook.prototype['api'] = domReady;
    Hook.prototype['select'] = qsa;
    $hook = new Hook; // initialize (make empty object that inherits the defaults)

    /** 
     * Method for setting/getting hooks:
     * @param  {*=}  key
     * @param  {*=}  val
     * @param  {*=}  iter
     */
    function hook(key, val, iter) {
        var temp, clone; 
        if (iter) {// flip args for (v, k, ob)
            temp = key;
            key = val;
            val = temp;
        }
        if (arguments.length < 2) {
            if (typeof key === 'object' && key) {//SET-multi
                each(key, hook);
            } else if (typeof key !== 'boolean'){// GET-all or GET-simple
                return void 0 === key ? mixin(new Hook, $hook) : $hook[key];
            }
            // HANDLE `hook(true)` and `hook(false)`:
            if (key) {// RESTORE defaults
                each(Hook.prototype, function(v, k){ delete $hook[k]; });
            } else {// BURN all:
                each($hook, function(v, k){ hook(k, false); }); 
            }
        } else {
            if (typeof val === 'function') {
                // update the hook, provided it has not been "burned"
                true === burned[key] || ($hook[key] = val);
            } else if (typeof val === 'boolean' && $hook[key]) {
                // true  => restore the default hook
                // false => burn the hook at its current state
                val ? (delete $hook[key]) : (burned[key] = true);
            }
        }
        return this;
    }
    // expose the hook() method:
    hook['mute'] = true;
    api['hook'] = hook;
    // END Hook

    /**
     * mixin()   Augment `this` with methods from an object.
     * @param    {Object}               ob     an object containing methods to mixin
     * @param    {(boolean|number|*)=}  force  whether to overwrite existing methods
     */
    api['mixin'] = api[FN]['mixin'] = function (ob, force) {
        if (!ob || !this || this === win) { throw new TypeError('@mixin'); }
        return mixin(this, ob, force); // Delegate to the local mixin func.
    };

    /**
     * mixinEvent()  Add event shortcut methods to the chain (specified in a SSV list or array)
     *
     * @param    {Array|string} list     array or SSV string of shortcut names
     * @param    {boolean=}     force    whether to overwrite existing methods (default: false)
     * @example  $.mixinEvent('resize scroll focus')  // creates $.fn.resize, ...
     */
    api['mixinEvent'] = function (list, force) {
        if (!list || !this || this === win) { throw new TypeError('@mixinEvent'); }
        var receiver = typeof this === 'function' ? this[FN] || this : this;
        eachSSV(list, function(name) {
            if (force || void 0 === receiver[name]) {
                receiver[name] = function (handler) {// event shortcut
                    return arguments.length ? this['on'](name, handler) : this['trigger'](name);
                };
            }
        });
        return this;
    };

    // Utility for augmenting a host with the api's methods. This private mixout func
    // prevents mixing out anything that's not a function. Our 'fn', 'selector', 'length'
    // etc. props are caught by that. There are a few others that we blacklist via
    // the 'mute' prop. See usage from bridge()
    
    function mixout(supplier, receiver, force, scope) {
        // signature of this is the reverse of local mixin
        // when converted to a method, `this` => supplier,

        var n;
        scope = scope || (typeof receiver === 'function' ? receiver : api);
        // the `scope` should be the host api func ($), for use w/ remix props

        for (n in supplier) {
            (supplier.hasOwnProperty(n)
            && typeof supplier[n] === 'function' // methods only
            && (force || void 0 === receiver[n])
            && true !== supplier[n]['mute']      // filter out "muted" methods
            && (receiver[n] = supplier[n]['remix'] ? supplier[n]['remix'].call(scope) : supplier[n]));
        }

        return this;
    }

    api['mixout'] = api[FN]['mixout'] = function(receiver, force, scope) {
        if ( !receiver || !this || this === win ){ throw new TypeError('@mixout'); }
        mixout(this, receiver, force, scope);
        return this;
    };

    /**
     * bridge()       Handler for integrating (mixing out) methods into a host. It
     *                augments the host with only the intended methods. If the host is
     *                jQuery-compatible, then it'll also get the chainable methods.
     *                Existing methods on the host are not overwritten unless the
     *                `force` param is set to a truthy value.
     * 
     * @param {Object|function()}   host    any object or function
     * @param {boolean=}            force   indicates whether existing methods on the host 
     *                                      should be overwritten (default: false)
     * @param {number=}             flag    1: top-level only, 2: effins only
     */
    function bridge(host, force, flag) {
        var supplier = typeof this === 'function' ? this : api; // allow binding
        if (host instanceof Object) {
            2 !== flag && mixout(supplier, host, force, host); // top-level
            1 !== flag && typeof host === 'function' && host[FN] && mixout(supplier[FN], host[FN], force, host);
        }
        return supplier;
    }
    bridge['mute'] = true;
    api['bridge'] = bridge;
    

    /**
     * @param   {Object=}             root
     * @param   {(Object|Function)=}  api
     * @param   {string=}             name
     * @param   {string=}             alias
     * @return  {Function|boolean}
     */
    function noConflictRemix(root, api, name, alias) {

        if ( !root || !name || !api ) { return false; }
        var old = root[name], viejo;
        alias = typeof alias === 'string' && alias;
        viejo = alias && root[alias];

        /**
         * noConflict()  Destroy the global and return the api. Optionally call 
         *               a function that gets the api supplied as the first arg.
         * @param        {Function=}  fn   optional callback function
         */
        function noConflict(fn) {
            alias && api === root[alias] && (root[alias] = viejo);
            (fn || !alias) && api === root[name] && (root[name] = old);
            typeof fn === 'function' && fn.call(root, api, name, alias); 
            return api;
        }

        noConflict['mute'] = true;
        noConflict['remix'] = noConflictRemix;

        return noConflict;
    }
    api['noConflict'] = noConflictRemix(root, api, name);

    // api.eventMap = eventMap; // only for testing
    // api.dataMap = dataMap;   // only for testing

    // Bridge into a host like ender if avail
    return bridge(host);

})); // factory and closure