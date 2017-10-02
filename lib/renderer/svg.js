'use strict';

/*
 * Canvas renderer: Render slide into canvas
 *
 */
define(['../h'], function(h) {
    let exports = function render(spec, resolveColor) {
        return spec.pages.map(function(pspec) {
            return renderPage(pspec, spec.pagewidth, spec.pageheight, resolveColor);
        });
    };

    function renderPage(pspec, pagewidth, pageheight, resolveColor) {
        let pel = h('svg', {
            'class': 'page',
            'width': pagewidth,
            'height': pageheight,
            'xmlns': 'http://www.w3.org/2000/svg',
            'viewBox': '0 0 ' + pagewidth + ' ' + pageheight
        });

        // background
        if (pspec.bgcolor) {
            pel.appendChild(h('rect', {
                'x': 0,
                'y': 0,
                'width': pagewidth,
                'height': pageheight,
                'fill': '#' + resolveColor(pspec.bgcolor)
            }));
        }

        pspec.shapes.forEach(function handleShape(sspec) {
            if (sspec.type == 'text') {
                let nspec = {
                    type: 'textbox',
                    paragraphs: [
                        {
                            runs: [
                                {}
                            ]
                        }
                    ]
                };

                for (var i in sspec) {
                    if (['x','y','w','h','valign'].indexOf(i) >= 0)
                        nspec[i] = sspec[i];
                    else if (['align', 'lineheight'].indexOf(i) >= 0)
                        nspec.paragraphs[0][i] = sspec[i];
                    else
                        nspec.paragraphs[0].runs[0][i] = sspec[i];
                }

                handleShape(nspec);
            } else if (sspec.type == 'textbox') {
                pel.appendChild(generateSvgTextbox(sspec, resolveColor));
            }
        });
        return pel;
    }

    function generateSvgTextbox(boxspec, resolveColor) {
        let group = h('svg', {'x': boxspec.x});

        // lay them out below each other
        let y = 0;

        for (let pspec of boxspec.paragraphs) {
            let p = generateSvgParagraph(pspec, boxspec.w, boxspec.y + y, resolveColor);

            y += estimateParagraphHeight(pspec);

            group.appendChild(p);
        }

        // vertical alignment
        if (boxspec.valign == 'bottom') {
            group.attributes.y = boxspec.h - y;
        } else if (boxspec.valign == 'center') {
            group.attributes.y = (boxspec.h - y)/2;
        }

        return group;
    }

    function estimateParagraphHeight(pspec) {
        let lines = splitParagraphInLines(pspec);
        let tally = 0;

        let lineheight = pspec.lineheight || 1.2;

        for (let i = 0; i < lines.length; ++i) {
            // TODO: font size should be paragraph property
            tally += lines[i][0].fontsize * lineheight;
        }

        return tally;
    }

    function generateSvgParagraph(pspec, width, y, resolveColor) {
        let lineheight = 1.2;
        let align = 'left';
        let margin = 0;
        let indent = 0;

        if (pspec.align)
            align = pspec.align;
        if (pspec.lineheight)
            lineheight = pspec.lineheight;
        if (pspec.marginleft)
            margin = pspec.marginleft;
        if (pspec.indent)
            indent = pspec.indent;

        let text = h('text', {});

        // number
        // TODO: This is pretty hacky, make this right!
        if (pspec.number) {
            let numspan = h('tspan', {
                'font-family': pspec.runs[0].fontface,
                'font-size': pspec.runs[0].fontsize,
                'fill': '#' + resolveColor(pspec.runs[0].color),
                'x': 0,
                'y': pspec.runs[0].fontsize + y
            }, pspec.number + '.');
            text.appendChild(numspan);
        }

        // text lines
        let lines = splitParagraphInLines(pspec);
        for (let lineno = 0; lineno < lines.length; ++lineno) {
            let line = lines[lineno];

            // outer tspan is for alignment
            // HACK we need the font for the veritcal align to work.
            // TODO make font a paragraph-level attribute
            let linespan = h('tspan', {
                'font-family': line[0].fontface,
                'font-size': line[0].fontsize
            });

            if (align == 'center') {
                linespan.attributes['x'] = width/2;
                linespan.attributes['text-anchor'] = 'middle';
            } else if (align == 'right') {
                linespan.attributes['x'] = width;
                linespan.attributes['text-anchor'] = 'end';
            } else {
                // left alignment - supports margin and indent
                linespan.attributes['x'] = margin + (lineno == 0 ? indent : 0);
                linespan.attributes['text-anchor'] = 'start';
            }

            // FIXME! vertical positioning like this craps out once multiple font sizes
            // are in play. Perhaps the font should be a paragraph attribute.
            linespan.attributes['y'] = y + line[0].fontsize + lineheight * lineno * line[0].fontsize;

            text.appendChild(linespan);

            for (let runno = 0; runno < line.length; ++runno) {
                let run = line[runno];

                let runspan = h('tspan', {}, run.content);

                if (run.fontface)
                    runspan.attributes['font-family'] = run.fontface;
                if (run.fontsize)
                    runspan.attributes['font-size'] = run.fontsize;
                if (run.color)
                    runspan.attributes['fill'] = '#' + resolveColor(run.color);
                if (run.underline)
                    runspan.attributes['text-decoration'] = 'underline';
                if (run.italic)
                    runspan.attributes['font-style'] = 'italic';

                linespan.appendChild(runspan);
            }
        }

        return text;
    }

    // returns: SVGRect
    let measureEl = null;
    function measureSvg(eltree) {
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

        let svg = h('svg', {'xmlns':'http://www.w3.org/2000/svg', 'width': 1000, 'height': 1000 }, eltree);

        let node = svg.toDomNode();
        measureEl.appendChild(node);

        let bbox = node.getBBox();

        measureEl.removeChild(node);

        return bbox;
    }

    // Returns: Array of Array of runs
    function splitParagraphInLines(pspec) {
        let retval = [[]];

        let curline = retval[0];

        // runs
        if (pspec.runs) {
            for (let rspec of pspec.runs) {
                let lines = rspec.content.split('\n').map(function(text) {
                    let clone = Object.assign({}, rspec);
                    clone.content = text;
                    return clone;
                });

                curline.push(lines[0]);

                for (let i = 1; i < lines.length; ++i) {
                    curline = [];
                    retval.push(curline);
                    curline.push(lines[i]);
                }
            }
        }

        return retval;
    }

    exports.generateSvgParagraph = generateSvgParagraph;
    exports.estimateParagraphHeight = estimateParagraphHeight;
    exports.renderPage = renderPage;
    return exports;
});
