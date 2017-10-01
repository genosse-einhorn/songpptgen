'use strict';
var define = typeof define === 'function' ? define : (dep, def) => { module.exports = def.apply(null, dep.map(d => require(d))) };

/* h: poor man's virtual dom */

define([], function() {
    function escapeXml(unsafe) {
        if (unsafe === undefined || unsafe === null)
            return '';
        else
            return ('' + unsafe).replace(/[<>&'"]/g, function (c) {
                switch (c) {
                    case '<': return '&lt;';
                    case '>': return '&gt;';
                    case '&': return '&amp;';
                    case '\'': return '&apos;';
                    case '"': return '&quot;';
                }
            });
    }

    function HElement(name) {
        this.name = '' + name;
        this.attributes = {};
        this.style = {};
        this.children = [];
    }

    HElement.prototype.toXml = function() {
        var ret = '<' + this.name;

        for (var i in this.attributes) {
            ret += ' ' + i + '="' + escapeXml(this.attributes[i]) + '"';
        }

        if (this.children.length) {
            ret += '>';

            for (var i = 0; i < this.children.length; ++i) {
                if (this.children[i] instanceof HElement)
                    ret += this.children[i].toXml();
                else
                    ret += escapeXml(this.children[i]);
            }

            ret += '</' + this.name + '>';
        } else {
            ret += '/>';
        }

        return ret;
    }

    HElement.prototype.toDomNode = function(xmlns) {
        if (this.attributes.xmlns) {
            xmlns = this.attributes.xmlns;
        }

        if (xmlns) {
            var ret = document.createElementNS(xmlns, this.name);
        } else {
            var ret = document.createElement(this.name);
        }

        for (var i in this.attributes) {
            ret.setAttribute(i, this.attributes[i]);
        }

        for (var i = 0; i < this.children.length; ++i) {
            if (this.children[i] instanceof HElement)
                ret.appendChild(this.children[i].toDomNode(xmlns));
            else
                ret.appendChild(document.createTextNode(this.children[i]));
        }

        for (var i in this.style) {
            ret.style[i] = this.style[i];
        }

        return ret;
    }

    HElement.prototype.appendChild = function(c) {
        if (Array.isArray(c)) {
            for (var i = 0; i < c.length; ++i) {
                this.appendChild(c[i]);
            }
        } else {
            this.children.push(c);
        }
    }

    HElement.prototype.prependChild = function(c) {
        this.children.unshift(c);
    }

    HElement.prototype.createChild = function() {
        var el = h.apply(null, arguments);
        this.appendChild(el);
        return el;
    }

    var h = function(el) {
        var ret = new HElement(el);
        var args = [].slice.call(arguments, 1);

        if (typeof args[0] === 'object' && Object.getPrototypeOf(args[0]) === Object.prototype) {
            var attr = args.shift();
            for (var i in attr) {
                if (i == 'style' && typeof attr[i] === 'object') {
                    for (var j in attr.style) {
                        ret.style[j] = attr.style[j];
                    }
                } else {
                    ret.attributes[i] = attr[i];
                }
            }
        }

        args.forEach(function(c) {
            ret.appendChild(c);
        });

        return ret;
    }

    h.createElement = function(name) { return new HElement(name) };
    h.isElement = function(e) { return e instanceof HElement };

    return h;
})
