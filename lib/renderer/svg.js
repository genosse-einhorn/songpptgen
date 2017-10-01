'use strict';

/*
 * Canvas renderer: Render slide into canvas
 *
 */
define(['./colorscheme', '../h'], function(colorscheme_repo, h) {
    function resolveColor(colorscheme, color) {
        if (colorscheme_repo[colorscheme] && colorscheme_repo[colorscheme][color])
            return '#' + colorscheme_repo[colorscheme][color];
        else
            return color;
    }

    const SLIDE_HEIGHT_EM = 50;

    let exports = function render(spec, colorscheme) {
        let ret = h('div', { 'class': 'page-container' });

        spec.pages.forEach(function(pspec) {
            let toCssUnits = function(len) {
                return (len / spec.pageheight * SLIDE_HEIGHT_EM) + 'em';
            };

            let pel = h('svg', {
                'class': 'page',
                'style': {
                    height: toCssUnits(spec.pageheight),
                    width:  toCssUnits(spec.pagewidth),
                    position: 'relative',
                    margin: '1em',
                    whiteSpace: 'pre-wrap',
                    float: 'left',
                    overflow: 'hidden'
                },
                'width': spec.pagewidth,
                'height': spec.pageheight,
                'xmlns': 'http://www.w3.org/2000/svg',
                'viewBox': '0 0 ' + spec.pagewidth + ' ' + spec.pageheight
            });

            // background
            if (pspec.bgcolor) {
                pel.appendChild(h('rect', {
                    'x': 0,
                    'y': 0,
                    'width': spec.pagewidth,
                    'height': spec.pageheight,
                    'fill': resolveColor(colorscheme, pspec.bgcolor)
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
                    pel.appendChild(generateSvgTextbox(sspec, colorscheme));
                }
            });

            ret.appendChild(pel);
        });

        return ret.toDomNode();
    };

    function generateSvgTextbox(boxspec, colorscheme) {
        let group = h('svg', {'x': boxspec.x});

        let svgParagraphs = boxspec.paragraphs.map(function(pspec) {
            return generateSvgParagraph(pspec, boxspec.w, colorscheme);
        });

        // lay them out below each other
        let y = 0;

        for (let i = 0; i < svgParagraphs.length; ++i) {
            let p = svgParagraphs[i];

            p.attributes.x = 0;
            p.attributes.y = boxspec.y + y;

            y += estimateParagraphHeight(boxspec.paragraphs[i]);

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

    function generateSvgParagraph(pspec, width, colorscheme) {
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
                'fill': resolveColor(colorscheme, pspec.runs[0].color),
                'x': 0,
                'dy': '1em'
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
            if (lineno == 0 && pspec.number)
                linespan.attributes['dy'] = 0; // number already set the positon
            else if (lineno == 0)
                linespan.attributes['dy'] = '1em'; // otherwise move to intial baseline
            else
                linespan.attributes['dy'] = lineheight + 'em';

            text.appendChild(linespan);

            for (let runno = 0; runno < line.length; ++runno) {
                let run = line[runno];

                let runspan = h('tspan', {}, run.content);

                if (run.fontface)
                    runspan.attributes['font-family'] = run.fontface;
                if (run.fontsize)
                    runspan.attributes['font-size'] = run.fontsize;
                if (run.color)
                    runspan.attributes['fill'] = resolveColor(colorscheme, run.color);
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
    return exports;
});