'use strict';
var define = typeof define === 'function' ? define : (dep, def) => { module.exports = def.apply(null, dep.map(d => require(d))) };

/*
 * Color Schemes
 *
 */
define([], function() {
    let repo = {
        DARK_CLASSIC: {
            'title': 'FFFF00',
            'text': 'FFFFFF',
            'copyright': 'FFFF00',
            'background': '000000'
        },
        DARK: {
            'title': 'FFC000',
            'text': 'FFFFFF',
            'copyright': '558ED5',
            'background': '000000'
        },
        LIGHT: {
            'title': '000000',
            'text': '000000',
            'copyright': '999999',
            'background': 'FFFFFF'
        },
        resolver: function(colorscheme) {
            return function(color) {
                if (repo[colorscheme] && repo[colorscheme][color])
                    return repo[colorscheme][color];
                else
                    return color;
            }
        }
    };
    return repo;
});
