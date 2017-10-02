'use strict';
var define = typeof define === 'function' ? define : (dep, def) => { module.exports = def.apply(null, dep.map(d => require(d))) };

/*
 * Measures layout sizes
 *
 */
define(['../renderer/svg', '../h'], function(svgRenderer, h) {
    let exports = {};

    const POINT_PX = 0.5;
    function toCssUnits(len) {
        return (len * POINT_PX) + 'px';
    }

    let measureEl = null;
    function doMeasure(subject) {
        if (!measureEl) {
            measureEl = h('svg', {
                'xmlns':'http://www.w3.org/2000/svg',
                'width': 1000,
                'height': 1000,
                'style': {
                    'position': 'absolute',
                    'top': '0px',
                    'left': '-9999px',
                    'overflow': 'hidden'
                }
            }).toDomNode();
            document.querySelector('body').appendChild(measureEl);
        }

        let svg = h('svg', {'xmlns':'http://www.w3.org/2000/svg', 'width': 1000, 'height': 1000 }, subject);

        let node = svg.toDomNode();
        measureEl.appendChild(node);

        let bbox = node.getBBox();

        measureEl.removeChild(node);

        return bbox;
    }

    exports.measureParagraph = function(p) {
        let svg = svgRenderer.generateSvgParagraph(p, /*FIXME*/9999, 0, function() { return "000000"; });
        let bbox = doMeasure(svg);
        let height = svgRenderer.estimateParagraphHeight(p);

        return { width: bbox.width, height: height };
    };

    return exports;
});
