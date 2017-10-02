'use strict';
var define = typeof define === 'function' ? define : (dep, def) => { module.exports = def.apply(null, dep.map(d => require(d))) };

/*
 * Color Schemes
 *
 */
define([], function() {
    let repo = function resolve(colorscheme, color) {
        if (repo[colorscheme] && repo[colorscheme][color])
            return repo[colorscheme][color];
        else
            return color;
    }

    repo.DARK_CLASSIC = {
        'title': 'FFFF00',
        'text': 'FFFFFF',
        'copyright': 'FFFF00',
        'background': '000000'
    };

    repo.LIGHT = {
        'title': '000000',
        'text': '000000',
        'copyright': '999999',
        'background': 'FFFFFF'
    }

    return repo;
});
