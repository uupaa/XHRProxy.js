(function(global) {
"use strict";

// --- dependency modules ----------------------------------
var EventListener = global["EventListener"] || require("uupaa.eventListener.js");
var DataType      = global["DataType"]      || require("uupaa.datatype.js");
var URI           = global["URI"]           || require("uupaa.uri.js");

// --- define / local variables ----------------------------
//var _runOnNode = "process" in global;
//var _runOnWorker = "WorkerLocation" in global;
var _runOnBrowser = "document" in global;

// readyState code -> http://www.w3.org/TR/XMLHttpRequest/
var READY_STATE_UNSENT           = 0;
var READY_STATE_OPENED           = 1;
var READY_STATE_HEADERS_RECEIVED = 2;
var READY_STATE_LOADING          = 3;
var READY_STATE_DONE             = 4;

// --- class / interfaces ----------------------------------
function XHRProxy() {
    this._event = new EventListener().types(
        "loadstart,load,loadend,progress,readystatechange,error,timeout".split(","));

    this._xhr = new XMLHttpRequest();
    this._lv2 = "onload" in this._xhr &&
                "responseType" in this._xhr &&
                "withCredentials" in this._xhr;
    this._lastURL = "";
    this._lastReadyState = READY_STATE_UNSENT;

    // setup getter and setter.
    Object.defineProperties(this, {
        "readyState":     { "get": getReadyState                                },
        "response":       { "get": getResponse                                  },
        "responseText":   { "get": getResponseText                              },
        "responseType":   { "get": getResponseType,   "set": setResponseType    },
        "responseXML":    { "get": getResponseXML                               },
        "status":         { "get": getStatus                                    },
        "statusText":     { "get": getStatusText                                },
        "upload":         { "get": getUpload,         "set": setUpload          },
        "withCredentials":{ "get": getWithCredentials,"set": setWithCredentials }
    });
}

//{@dev
XHRProxy["repository"] = "https://github.com/uupaa/XHRProxy.js";
//}@dev

XHRProxy["prototype"] = {
    "constructor":          XHRProxy,                      // new XHRProxy(options:Object = null)
    "get":                  XHRProxy_get,                  // XHRProxy.get(url:URLString, callback:Function):void
    "abort":                XHRProxy_abort,                // XHRProxy#abort():void
    "getAllResponseHeaders":XHRProxy_getAllResponseHeaders,// XHRProxy#getAllResponseHeaders():String
    "getResponseHeader":    XHRProxy_getResponseHeader,    // XHRProxy#getResponseHeader(name:String):String
    "open":                 XHRProxy_open,                 // XHRProxy#open(method:String, url:URLString, async:Boolean = true,
                                                        //            user:String = "", password:String = ""):void
    "overrideMimeType":     XHRProxy_overrideMimeType,     // XHRProxy#overrideMimeType():void
    "send":                 XHRProxy_send,                 // XHRProxy#send(data:Any = null):void
    "setRequestHeader":     XHRProxy_setRequestHeader,     // XHRProxy#setRequestHeader():void
    "addEventListener":     XHRProxy_addEventListener,     // XHRProxy#addEventListener(type:EventTypeString, callback:Function):this
    "removeEventListener":  XHRProxy_removeEventListener,  // XHRProxy#removeEventListener(type:EventTypeString, callback:Function):this
    "clearEventListener":   XHRProxy_clearEventListener,   // XHRProxy#clearEventListener():this
    "on":                   XHRProxy_addEventListener,     // XHRProxy#on(type:EventTypeString, callback:Function):this
    "off":                  XHRProxy_removeEventListener,  // XHRProxy#off(type:EventTypeString, callback:Function):this
    "level":                XHRProxy_level,                // XHRProxy#level():Number
    "convert":              XHRProxy_convert,              // XHRProxy#convert():Any
    // --- internal ---
    "handleEvent":          XHRProxy_handleEvent
};

// --- implements ------------------------------------------
function getReadyState()        { return this._xhr["readyState"]; }
function getResponse()          { return this._xhr["response"]; }
function getResponseText()      { return this._xhr["responseText"]; }
function getResponseType()      { return this._xhr["responseType"]; }
function setResponseType(v)     {        this._xhr["responseType"] = v; }
function getResponseXML()       { return this._xhr["responseXML"]; }
function getStatus()            { return this._xhr["status"]; }
function getStatusText()        { return this._xhr["statusText"]; }
function getUpload()            { return this._xhr["upload"] || null; }
function setUpload(v)           {        this._xhr["upload"] = v; }
function getWithCredentials()   { return this._xhr["withCredentials"] || false; }
function setWithCredentials(v)  {        this._xhr["withCredentials"] = v;  }
function XHRProxy_abort()          { this._xhr["abort"](); }
function XHRProxy_level()          { return this._lv2 ? 2 : 1; }

function XHRProxy_get(url,        // @arg URLString
                      callback) { // @arg Function - callback(error, responseText, xhr):void
                                  // @desc convenient method.
//{@dev
    $valid($type(url,      "String") && !URI.parse(url).error, XHRProxy_get, "url");
    $valid($type(callback, "Function"),                        XHRProxy_get, "callback");
//}@dev

    var proxy = new XHRProxy();

    proxy["on"]("load", function() {
        if ( _isSuccess(this["status"], /^file\:/.test(url)) ) {
            callback(null, this["responseText"], this);
        } else {
            callback(new Error(this["status"]), "", this);
        }
    });
    proxy["open"]("GET", url);
    proxy["send"]();
}

function XHRProxy_getAllResponseHeaders() { // @ret String
    return this._xhr["getAllResponseHeaders"]();
}

function XHRProxy_getResponseHeader(name) { // @arg String
                                            // @ret String
//{@dev
    $valid($type(name, "String"), XHRProxy_getResponseHeader, "name");
//}@dev

    return this._xhr["getResponseHeader"](name);
}

function XHRProxy_open(method,     // @arg String - "GET" or "POST", ...
                       url,        // @arg URLString
                       async,      // @arg Boolean = true
                       user,       // @arg String = ""
                       password) { // @arg String = ""
//{@dev
    $valid(this._xhr["readyState"] === READY_STATE_UNSENT, XHRProxy_open, "sequence error");
    $valid($type(method, "String") && /^(GET|POST)$/.test(method), XHRProxy_open, "method");
    $valid($type(url,    "String") && !URI.parse(url).error, XHRProxy_open, "url");
    $valid($type(async,  "Boolean|omit"),                  XHRProxy_open, "async");
    $valid($type(user,   "String|omit"),                   XHRProxy_open, "user");
    $valid($type(password, "String|omit"),                 XHRProxy_open, "password");
//}@dev

    async = async === undefined ? true : async;

    this._lastURL = url;
    this._lastReadyState = READY_STATE_UNSENT;

    if (!this._lv2) {
        this._xhr["addEventListener"]("readystatechange", this); // call handleEvent
    }
    this._xhr["open"](method, url, async, user, password);
}

function XHRProxy_overrideMimeType(mimeType) { // @arg String
//{@dev
    $valid($type(mimeType, "String"), XHRProxy_overrideMimeType, "mimeType");
//}@dev

    this._xhr["overrideMimeType"](mimeType);
}

function XHRProxy_send(data) { // @arg Any = null - POST request body
//{@dev
    $valid(this._xhr["readyState"] === READY_STATE_OPENED, XHRProxy_send, "sequence error");
//}@dev

    // XHR Lv1 && binary -> overrideMimeType
    if (!this._lv2) {
        if ( /arraybuffer|blob/.test(this._xhr["responseType"]) ) {
            this._xhr["overrideMimeType"]("text/plain; charset=x-user-defined");
        }
    }
    this._xhr["send"](data);
}

function XHRProxy_setRequestHeader(name,    // @arg String - header name
                                   value) { // @arg String - header value
//{@dev
    $valid($type(name,  "String"), XHRProxy_setRequestHeader, "name");
    $valid($type(value, "String"), XHRProxy_setRequestHeader, "value");
//}@dev

    this._xhr["setRequestHeader"](name, value);
}

function XHRProxy_addEventListener(type,       // @arg EventTypeString - "readystatechange"
                                   callback) { // @arg Function
                                               // @ret this
    this._event["add"](this._lv2 ? this._xhr : null, type, callback);
    return this;
}

function XHRProxy_removeEventListener(type,       // @arg EventTypeString - "readystatechange"
                                      callback) { // @arg Function
                                                  // @ret this
    this._event["remove"](this._lv2 ? this._xhr : null, type, callback);
    return this;
}

function XHRProxy_clearEventListener() { // @ret this
    this._event["clear"](this._lv2 ? this._xhr : null);
    return this;
}

function XHRProxy_handleEvent(event) { // @arg EventObject|null
                                       // @desc simulate XHR Lv2 events
    var xhr = this._xhr;
    var status = xhr["status"];
    var readyState = xhr["readyState"];

    if (this._lastReadyState !== readyState) {
        this._lastReadyState = readyState;
        _fireEvent(this, "readystatechange", event);
    }

    switch (readyState) {
    case READY_STATE_OPENED:
        _fireEvent(this, "loadstart", event);
        break;
    case READY_STATE_HEADERS_RECEIVED:
    case READY_STATE_LOADING:
        _fireEvent(this, "progress", event);
        break;
    case READY_STATE_DONE:
        if ( _isSuccess(status, /^file\:/.test(this._lastURL)) ) {
            try {
                xhr["response"] = _convertDataType(xhr["responseText"],
                                                   xhr["responseType"]);
            } catch (o_O) {
            }
            _fireEvent(this, "load", event);
        }
        _fireEvent(this, "loadend", event);
        xhr.removeEventListener("readystatechange", this);
    }
}

function XHRProxy_convert() { // @ret Any
    var xhr = this._xhr;
    var status = xhr["status"];
    var readyState = xhr["readyState"];

    if (readyState === READY_STATE_DONE) {
        if ( _isSuccess(status, /^file\:/.test(this._lastURL)) ) {
            return _convertDataType(xhr["responseText"],
                                    xhr["responseType"]);
        }
    }
    return "";
}

function _convertDataType(text, type) {
    switch (type) {
    case "json":    return JSON.parse(text);                      // -> Object
    case "document":return _createHTMLDocument(text);             // -> Document|String
    case "arraybuffer":
    case "blob":    return DataType["Array"]["fromString"](text); // -> ByteArray
    }
    return text;
}

function _createHTMLDocument(text) {
    if (_runOnBrowser) {
        var body = document.createElement("body");

        body["innerHTML"] = text;
        return body;
    }
    return text;
}

function _isSuccess(status,       // @arg Integer - HTTP_STATUS_CODE
                    isFilePath) { // @arg Boolean - true is file://path
                                  // @ret Boolean
    var ok = status >= 200 && status < 300;

    return isFilePath ? (status === 0 || ok)
                      : ok;
}

function _fireEvent(that,    // @arg this
                    type,    // @arg EventTypeString - "readystatechange", "loadstart", "progress", "load", "error", "loadend"
                    event) { // @arg EventObject - { type, ... }
    if ( that._event["has"](type) ) {
        that._event["get"](type).forEach(function(callback) {
            callback.call(that._xhr, event);
        });
    }
}

// --- validate / assertions -------------------------------
//{@dev
function $valid(val, fn, hint) { if (global["Valid"]) { global["Valid"](val, fn, hint); } }
function $type(obj, type) { return global["Valid"] ? global["Valid"].type(obj, type) : true; }
//function $keys(obj, str) { return global["Valid"] ? global["Valid"].keys(obj, str) : true; }
//function $some(val, str, ignore) { return global["Valid"] ? global["Valid"].some(val, str, ignore) : true; }
//function $args(fn, args) { if (global["Valid"]) { global["Valid"].args(fn, args); } }
//}@dev

// --- exports ---------------------------------------------
if ("process" in global) {
    module["exports"] = XHRProxy;
}
global["XHRProxy" in global ? "XHRProxy_" : "XHRProxy"] = XHRProxy; // switch module. http://git.io/Minify

})((this || 0).self || global); // WebModule idiom. http://git.io/WebModule

