'use strict';
var define = typeof define === 'function' ? define : (dep, def) => { module.exports = def.apply(null, dep.map(d => require(d))) };

/*
 * Kuemmel layouter: Creates the author's preferred layout
 *
 */
define(['../parser', './measure'], function(parser, measure) {
    function genParagraph(text) {
        // TODO: indent, bullets, ...
        let p = {
            runs: [{
                content: text.text,
                color: 'text',
                fontsize: 32,
                fontface: 'Calibri'
            }],
            align: 'left',
            marginleft: 48
        };

        if (text.name) {
            if (text.name.match(/^\d+$/)) {
                // EmK-style numbererd verse
                p.number = text.name;
            } else {
                // Freely-named verse
                p.runs.unshift({
                    content: text.name + ': ',
                    color: 'text',
                    italic: true,
                    fontsize: 32,
                    fontface: 'Calibri'
                });
                p.indent = -p.marginleft;
            }
        }

        return p;
    }

    function genMeasuredParagraph(part) {
        let p = genParagraph(part)
        let bbox = measure.measureParagraph(p);
        return {
            text: part.text,
            name: part.name,
            paragraph: p,
            width: bbox.width + p.marginleft,
            height: bbox.height
        };
    }

    function measuredParagraphListWidth(list) {
        return Math.max.apply(null, list.map(p => p.width));
    }

    function measuredParagraphListHeight(list) {
        return list.map(p => p.height).reduce((a,b) => a+b);
    }

    function combineMeasuredParagraphs(list, newp) {
        if (list.length) {
            return list.concat([
                genMeasuredParagraph({ text: ' ', name: '' }), // ghetto blank line
                newp // new paragraph
            ]);
        } else {
            return [newp];
        }
    }

    return function(song_) {
        const PAGE_W = 10*72;
        const PAGE_H = 7.5*72;

        let song = parser.validateOrder(song_);

        let ret = {
            algorithm: 'kuemmel',
            pagewidth: PAGE_W,
            pageheight: PAGE_H,
            pages: []
        };

        // title page
        var page = {
            bgcolor: 'background',
            shapes: [{
                type: 'text',
                content: song.title,
                color: 'title',
                align: 'center',
                valign: 'bottom',
                fontsize: 44,
                fontface: 'Calibri',
                x: 0,
                y: 0,
                w: PAGE_W,
                h: 0.48 * PAGE_H
            }, {
                type: 'text',
                content: song.copyright,
                color: 'copyright',
                align: 'center',
                fontsize: 20,
                fontface: 'Calibri',
                x: 0,
                y: 0.5 * PAGE_H,
                w: PAGE_W,
                h: 0.5 * PAGE_H
            }]
        };
        ret.pages.push(page);

        // Combination magic: Merge parts that fit on one slide
        let parts = parser.orderedParts(song).map(genMeasuredParagraph)
        .reduce((a, c) => {
            // Empty parts are merge breakers
            if (c.text.trim() == '')
                return a.concat([[]]);

            // Regular Part - Check if it can be merged
            if (a.length > 0 && a[a.length-1].length > 0) {
                let last = a[a.length-1];

                let candidate = combineMeasuredParagraphs(last, c);

                if (measuredParagraphListHeight(candidate) < PAGE_H * 0.9) {
                    return a.slice(0,-1).concat([candidate]);
                }
            }

            // no merging - append to list
            return a.concat([[c]]);
        }, [])
        .filter(plist => plist.length > 0);

        let max_w = Math.max.apply(null, parts.map(l => measuredParagraphListWidth(l)));
        let max_h = Math.max.apply(null, parts.map(l => measuredParagraphListHeight(l)));
        let top = (PAGE_H - max_h) / 2;
        let left = (PAGE_W - max_w) / 2;

        parts.forEach(function(part) {
            var page = {
                bgcolor: 'background',
                width: PAGE_W,
                height: PAGE_H,
                shapes: [{
                    type: 'textbox',
                    paragraphs: part.map(p => p.paragraph),
                    x: left,
                    y: top,
                    w: max_w * 1.25,
                    h: max_h * 1.25
                }]
            };

            ret.pages.push(page);
        });

        return ret;
    }
});
