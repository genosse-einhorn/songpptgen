'use strict';
var define = typeof define === 'function' ? define : (dep, def) => { module.exports = def.apply(null, dep.map(d => require(d))) };

/*
 * Kuemmel-Arial layouter: Modified Kümmel layout based on alternate layouts
 *
 */
define(['../parser', './measure'], function(parser, measure) {
    function genParagraph(text) {
        let p = {
            runs: [{
                content: text.text,
                color: 'text',
                fontsize: 28,
                fontface: 'Arial'
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
                    fontsize: 28,
                    fontface: 'Arial'
                });
                p.indent = -p.marginleft;
            }
        }

        return p;
    }

    function genMeasuredParagraph(part) {
        let p = genParagraph(part)
        let h = measure.estimateParagraphHeight(p);
        return {
            text: part.text,
            name: part.name,
            paragraph: p,
            height: h
        };
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
            algorithm: 'kuemmel-arial',
            pagewidth: PAGE_W,
            pageheight: PAGE_H,
            pages: []
        };

        // title page
        var page = {
            bgcolor: 'background',
            shapes: [{
                type: 'text',
                content: song.title || 'Unknown Song',
                color: 'title',
                align: 'left',
                valign: 'top',
                fontsize: 28,
                fontface: 'Arial',
                bold: true,
                x: 42,
                y: 439,
                w: PAGE_W-42,
                h: PAGE_H-439
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

                if (measuredParagraphListHeight(candidate) < PAGE_H*0.8) {
                    return a.slice(0,-1).concat([candidate]);
                }
            }

            // no merging - append to list
            return a.concat([[c]]);
        }, [])
        .filter(plist => plist.length > 0);

        let max_h = Math.max.apply(null, parts.map(l => measuredParagraphListHeight(l)));
        let y = (PAGE_H - max_h) / 2;

        parts.forEach(function(part, i, a) {
            var page = {
                bgcolor: 'background',
                width: PAGE_W,
                height: PAGE_H,
                shapes: [{
                    type: 'textbox',
                    paragraphs: part.map(p => p.paragraph),
                    x: 42,
                    y: y,
                    w: PAGE_W,
                    h: max_h * 1.5
                }]
            };

            if (i == parts.length-1 && song.copyright) {
                page.shapes.push({
                    type: 'text',
                    content: song.copyright,
                    color: 'copyright',
                    align: 'right',
                    fontsize: 14,
                    fontface: 'Arial',
                    x: 0,
                    y: 0,
                    w: ret.pagewidth - 10,
                    h: ret.pageheight - 10,
                    valign: 'bottom'
                });
            }

            ret.pages.push(page);
        });

        return ret;
    }
});
