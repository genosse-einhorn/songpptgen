'use strict';

/*
 * HTML Renderer: renders layouted song into html
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

            let pel = h('div', {
                'class': 'page',
                'style': {
                    height: toCssUnits(spec.pageheight),
                    width:  toCssUnits(spec.pagewidth),
                    position: 'relative',
                    margin: '1em',
                    whiteSpace: 'pre-wrap',
                    float: 'left',
                    overflow: 'hidden'
                }
            });

            if (pspec.bgcolor)
                pel.style.backgroundColor = resolveColor(colorscheme, pspec.bgcolor);

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
                    let box = h('div');
                    let wrap = h('div', {}, box);

                    // box properties
                    wrap.style.position = 'absolute';
                    for (let i in sspec) {
                        if (i == 'x')
                            wrap.style.left = toCssUnits(sspec.x);
                        if (i == 'y')
                            wrap.style.top = toCssUnits(sspec.y);
                        if (i == 'w')
                            wrap.style.width = toCssUnits(sspec.w);
                        if (i == 'h')
                            wrap.style.height = toCssUnits(sspec.h);
                        if (i == 'valign') {
                            if (sspec.valign == 'center') {
                                box.style.position = 'absolute';
                                box.style.top = '50%';
                                box.style.width = '100%';
                                box.style.transform = 'translateY(-50%)';
                            }
                            if (sspec.valign == 'bottom') {
                                box.style.position = 'absolute';
                                box.style.bottom = '0';
                                box.style.width = '100%';
                            }
                        }
                    }

                    // paragraphs
                    if (sspec.paragraphs) {
                        for (let parspec of sspec.paragraphs) {
                            box.appendChild(exports.renderParagraph(toCssUnits, parspec, colorscheme));
                        }
                    }

                    pel.appendChild(wrap);
                }
            });

            ret.appendChild(pel);
        });

        return ret.toDomNode();
    };

    exports.renderParagraph = function(toCssUnits, pspec, colorscheme) {
        let p = h('div', {
            style: {
                textAlign: 'left',
                lineHeight: 1.2,
                whiteSpace: 'pre-wrap',
                fontWeight: 'normal'
            }
        });

        // paragraph styles
        for (let i in pspec) {
            if (i == 'align')
                p.style.textAlign = pspec.align;
            if (i == 'lineheight')
                p.style.lineHeight = pspec.lineheight;
            if (i == 'marginleft')
                p.style.marginLeft = toCssUnits(pspec.marginleft);
            if (i == 'indent')
                p.style.textIndent = toCssUnits(pspec.indent);
        }

        // runs
        if (pspec.runs) {
            for (let rspec of pspec.runs) {
                let r = h('span', {}, rspec.content);

                // run styles
                for (let i in rspec) {
                    if (i == 'color')
                        r.style.color = resolveColor(colorscheme, rspec.color);
                    if (i == 'underline' && rspec.underline)
                        r.style.textDecoration = 'underline';
                    if (i == 'italic' && rspec.italic)
                        r.style.fontStyle = 'italic';
                    if (i == 'fontsize')
                        r.style.fontSize = toCssUnits(rspec.fontsize);
                    if (i == 'fontface')
                        r.style.fontFamily = rspec.fontface;
                }

                p.appendChild(r);
            }
        }

        // numbering
        if (pspec.number) {
            let num = h('div', {
                style: {
                    position: 'absolute',
                    //marginLeft: toCssUnits(pspec.marginleft ? -pspec.marginleft : 0)
                    left: 0
                }
            }, pspec.number + '.');

            if (p.children.length)
                p.children[0].prependChild(num);
        }

        return p;
    }

    return exports;
});
