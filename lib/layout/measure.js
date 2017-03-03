'use strict';
var define = typeof define === 'function' ? define : (dep, def) => { module.exports = def.apply(null, dep.map(d => require(d))) };

/*
 * Measures layout sizes
 *
 */
define(['../renderer/html'], function(htmlRenderer) {
    let exports = {};

    const POINT_PX = 0.5;
    function toCssUnits(len) {
        return (len * POINT_PX) + 'px';
    }

    let measureEl = null;
    function doMeasure(subject) {
        if (!measureEl) {
            measureEl = document.createElement('div');
            measureEl.style.position = 'absolute';
            measureEl.style.top = '0';
            measureEl.style.left = '-100000px';
            measureEl.style.overflow = 'hidden';
            document.getElementsByTagName('body')[0].appendChild(measureEl);
        }

        measureEl.innerHTML = '';
        measureEl.appendChild(subject);

        let r = measureEl.getBoundingClientRect();
        return {
            height: r.height / POINT_PX,
            width: r.width / POINT_PX
        };
    }

    exports.measureParagraph = function(p) {
        let htmlel = htmlRenderer.renderParagraph(toCssUnits, p).toDomNode();
        return doMeasure(htmlel);
    };

    return exports;
});
