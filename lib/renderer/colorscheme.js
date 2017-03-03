'use strict';
var define = typeof define === 'function' ? define : (dep, def) => { module.exports = def.apply(null, dep.map(d => require(d))) };

/*
 * Color Schemes
 *
 */
define([], function() {
    return {
        DARK_CLASSIC: {
            'title': 'FFFF00',
            'text': 'FFFFFF',
            'copyright': 'FFFF00',
            'background': '000000'
        },
        LIGHT: {
            'title': '000000',
            'text': '000000',
            'copyright': '999999',
            'background': 'FFFFFF'
        }
    }
});
