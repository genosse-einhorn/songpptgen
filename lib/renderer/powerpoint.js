// based on PptxGenJS by (C) 2015-2017 Brent Ely -- https://github.com/gitbrent

'use strict';
var define = typeof define === 'function' ? define : (dep, def) => { module.exports = def.apply(null, dep.map(d => require(d))) };

define(['./colorscheme', '../../3rdparty/jszip', '../h'], function(resolveColor, JSZip, h) {
    const SLIDE_HEIGHT_EMU = 6858000;
    const ONE_PT_EMU = 12700;
    const SLDNUMFLDID = '{F7021451-1387-4CA6-816F-3879F97B5CBC}';
    const CRLF = '\r\n';

    function xmlEscape(str) {
        return str.replace(/[<>&'"]/g, function (c) {
            switch (c) {
                case '<': return '&lt;';
                case '>': return '&gt;';
                case '&': return '&amp;';
                case '\'': return '&apos;';
                case '"': return '&quot;';
            }
        });
    }

    function makeXmlContTypes(spec) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
        h('Types', { xmlns: 'http://schemas.openxmlformats.org/package/2006/content-types' }, [
            h('Default', { Extension: 'rels', ContentType: 'application/vnd.openxmlformats-package.relationships+xml' }),
            h('Default', { Extension: 'xml', ContentType: 'application/xml' }),
            h('Default', { Extension: "jpeg", ContentType: "image/jpeg" }),
            h('Default', { Extension: "png", ContentType: "image/png" }),
            h('Default', { Extension: "gif", ContentType: "image/gif" }),
            h('Override', { PartName: "/docProps/app.xml",
                ContentType: "application/vnd.openxmlformats-officedocument.extended-properties+xml" }),
            h('Override', { PartName: "/docProps/core.xml",
                ContentType: "application/vnd.openxmlformats-package.core-properties+xml" }),
            h('Override', { PartName: "/ppt/presProps.xml",
                ContentType: "application/vnd.openxmlformats-officedocument.presentationml.presProps+xml" }),
            h('Override', { PartName: "/ppt/presentation.xml",
                ContentType: "application/vnd.openxmlformats-officedocument.presentationml.presentation.main+xml" }),
            h('Override', { PartName: "/ppt/tableStyles.xml",
                ContentType: "application/vnd.openxmlformats-officedocument.presentationml.tableStyles+xml" }),
            h('Override', { PartName: "/ppt/theme/theme1.xml",
                ContentType: "application/vnd.openxmlformats-officedocument.theme+xml" }),
            h('Override', { PartName: "/ppt/viewProps.xml",
                ContentType: "application/vnd.openxmlformats-officedocument.presentationml.viewProps+xml" })
        ].concat(spec.pages.map(function(slide, i) {
            return [
                h('Override', { PartName: '/ppt/slideMasters/slideMaster'+ (i + 1) +'.xml',
                    ContentType: "application/vnd.openxmlformats-officedocument.presentationml.slideMaster+xml" }),
                h('Override', { PartName: '/ppt/slideLayouts/slideLayout'+ (i + 1) +'.xml',
                    ContentType: "application/vnd.openxmlformats-officedocument.presentationml.slideLayout+xml" }),
                h('Override', { PartName: '/ppt/slides/slide'            + (i + 1) +'.xml',
                    ContentType: "application/vnd.openxmlformats-officedocument.presentationml.slide+xml" })
            ];
        }).reduce(function(a, c) { return a.concat(c); }, []))).toXml();
    }

    function makeXmlRootRels() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
        h('Relationships', { xmlns: "http://schemas.openxmlformats.org/package/2006/relationships" }, [
            h('Relationship', { Id: "rId1",
                Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/extended-properties",
                Target: "docProps/app.xml" }),
            h('Relationship', { Id: "rId2",
                Type: "http://schemas.openxmlformats.org/package/2006/relationships/metadata/core-properties",
                Target: "docProps/core.xml" }),
            h('Relationship', { Id: "rId3",
                Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument",
                Target: "ppt/presentation.xml" })
        ]).toXml();
    }

    function makeXmlApp(spec) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
        + h('Properties', { xmlns: "http://schemas.openxmlformats.org/officeDocument/2006/extended-properties",
            'xmlns:vt': "http://schemas.openxmlformats.org/officeDocument/2006/docPropsVTypes" }, [
            h('TotalTime', 0),
            h('Words', 0),
            h('Application', 'Microsoft Office PowerPoint'),
            h('PresentationFormat', 'On-screen Show (4:3)'),
            h('Paragraphs', 0),
            h('Slides', spec.pages.length),
            h('Notes', 0),
            h('HiddenSlides', 0),
            h('MMClips', 0),
            h('ScaleCrop', 'false'),
            h('HeadingPairs', [
                h('vt:vector', { size: 4, baseType: "variant" }, [
                    h('vt:variant', h('vt:lpstr', 'Theme')),
                    h('vt:variant', h('vt:i4', 1)),
                    h('vt:variant', h('vt:lpstr', 'Slide Titles')),
                    h('vt:variant', h('vt:i4', spec.pages.length))
                ])
            ]),
            h('TitlesOfParts',
                h('vt:vector', { size: (spec.pages.length+1), baseType: "lpstr" }, [
                    h('vt:lpstr', 'Office Theme')
                ].concat(spec.pages.map(function(obj, i) {
                    return h('vt:lpstr', 'Slide ' + (i+1));
                })))
            ),
            h('Company', 'PptxGenJS'),
            h('LinksUpToDate', 'false'),
            h('SharedDoc', 'false'),
            h('HyperlinksChanged', 'false'),
            h('AppVersion', '15.0000')
        ]).toXml();
    }

    function makeXmlCore(spec) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
        h('cp:coreProperties', {
            'xmlns:cp': "http://schemas.openxmlformats.org/package/2006/metadata/core-properties",
            'xmlns:dc': "http://purl.org/dc/elements/1.1/", 'xmlns:dcterms': "http://purl.org/dc/terms/",
            'xmlns:dcmitype': "http://purl.org/dc/dcmitype/", 'xmlns:xsi': "http://www.w3.org/2001/XMLSchema-instance",
        }, [
            h('dc:title', spec.title),
            h('dc:creator', 'PptxGenJS'),
            h('cp:lastModifiedBy', 'PptxGenJS'),
            h('cp:revision', 1),
            h('dcterms:created', { 'xsi:type': "dcterms:W3CDTF" }, new Date().toISOString()),
            h('dcterms:modified', { 'xsi:type': "dcterms:W3CDTF" }, new Date().toISOString())
        ]).toXml();
    }

    function makeXmlPresentationRels(spec) {
        var relid = 1;
        var getRelId = function() {
            return 'rId' + (relid++);
        }
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
        h('Relationships', { xmlns: "http://schemas.openxmlformats.org/package/2006/relationships" },
            h('Relationship', { Id: getRelId(),
                Target: "slideMasters/slideMaster1.xml",
                Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster" }),
            spec.pages.map(function(p, i) {
                return h('Relationship', { Id: getRelId(),
                        Target: 'slides/slide'+ (i + 1) + '.xml',
                        Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slide" });
            }),
            h('Relationship', { Id: getRelId(),
                Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/presProps",
                Target: "presProps.xml" }),
            h('Relationship', { Id: getRelId(),
                Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/viewProps",
                Target: 'viewProps.xml' }),
            h('Relationship', { Id: getRelId(),
                Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme",
                Target: "theme/theme1.xml" }),
            h('Relationship', { Id: getRelId(),
                Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/tableStyles",
                Target: "tableStyles.xml" })
        ).toXml();
    }

    function makeXmlSlideLayout() {
        // this is the minimal layout xml that conforms to the OOXML schema
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n\
            <p:sldLayout xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" \
                xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" \
                xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main" \
                type="title" preserve="1">\r\n \
                <p:cSld> \
                    <p:spTree> \
                        <p:nvGrpSpPr> \
                            <p:cNvPr id="1" name=""/> \
                            <p:cNvGrpSpPr/> \
                            <p:nvPr/> \
                        </p:nvGrpSpPr> \
                        <p:grpSpPr/> \
                    </p:spTree> \
                </p:cSld> \
            </p:sldLayout>';
    }

    function makeXmlShape(shapespec, index, colorscheme, toEmu, toPointPercent) {
        var x = 0, y = 0, cx = (100000), cy = 0;

        // A: positioning
        if (shapespec.x) x = toEmu(shapespec.x);
        if (shapespec.y) y = toEmu(shapespec.y);
        if (shapespec.w) cx = toEmu(shapespec.w);
        if (shapespec.h) cy = toEmu(shapespec.h);

        if (shapespec.type == 'textbox') {
            var sp = h('p:sp');

            sp.appendChild(h('p:nvSpPr',
                h('p:cNvPr', { id: (index + 2), name: 'Object ' + (index + 1) }),
                h('p:cNvSpPr', { txBox: "1" }),
                h('p:nvPr')
            ));
            sp.appendChild(h('p:spPr',
                h('a:xfrm',
                    h('a:off', { x: x, y: y }),
                    h('a:ext', { cx: cx, cy: cy })
                ),
                h('a:prstGeom', { prst: "rect" },
                  h('a:avLst')
                )
            ));

            var txbody = sp.createChild('p:txBody');
            var bodypr = txbody.createChild('a:bodyPr', { wrap: 'square', rtlCol: '0' });

            if (shapespec.valign) {
                if (shapespec.valign == 'center') {
                    bodypr.attributes.anchor = 'ctr';
                }
                if (shapespec.valign == 'bottom') {
                    bodypr.attributes.anchor = 'b';
                }
            }

            txbody.createChild('a:lstStyle');

            shapespec.paragraphs.forEach(function(pspec) {
                var p = txbody.createChild('a:p');
                var pPr = p.createChild('a:pPr');

                if (pspec.marginleft)
                    pPr.attributes.marL = toEmu(pspec.marginleft);

                if (pspec.indent)
                    pPr.attributes.indent = toEmu(pspec.indent);
                else if (pspec.number && pspec.marginleft)
                    pPr.attributes.indent = toEmu(-pspec.marginleft);

                if (pspec.align == 'center')
                    pPr.attributes.algn = 'ctr';
                else if (pspec.align == 'right')
                    pPr.attributes.algn = 'r';

                if (pspec.lineheight)
                    pPr.createChild('a:lnSpc',
                        h('a:spcPct', { val: Math.floor(100000 * pspec.lineheight / 1.2) }));

                if (pspec.number)
                    pPr.createChild('a:buAutoNum', {
                        type: "arabicPeriod", startAt: pspec.number });


                pspec.runs.forEach(function(rspec) {
                    // Powerpoint chokes on newlines in runs, so we have to split
                    // runs at newlines and introduce <a:br> tags between
                    var lines = rspec.content.split('\n');
                    lines.forEach(function(line, i) {
                        if (i != 0)
                            p.createChild('a:br');

                        var r = p.createChild('a:r');
                        var rPr = r.createChild('a:rPr',
                            { lang: "en-US", dirty: "0" });

                        if (rspec.fontsize)
                            rPr.attributes.sz = toPointPercent(rspec.fontsize);

                        if (rspec.italic)
                            rPr.attributes.i = 1;

                        if (rspec.underline)
                            rPr.attributes.u ="sng";

                        if (rspec.color)
                            rPr.appendChild(genXmlColorSelection(rspec.color, null, colorscheme));

                        if (rspec.fontface)
                            rPr.appendChild(h('a:latin', {
                                typeface: rspec.fontface,
                                pitchFamily: 2,
                                charset: 2 }));

                        r.appendChild(h('a:t', line));
                    });
                });

                p.appendChild(h('a:endParaRPr', { lang: "en-US", dirty: 0 }));
            });

            return sp;
        } else if (shapespec.type == 'text') {
            var nspec = {
                type: 'textbox',
                paragraphs: [
                    {
                        runs: [
                            {}
                        ]
                    }
                ]
            };

            for (var i in shapespec) {
                if (['x','y','w','h','valign'].indexOf(i) >= 0)
                    nspec[i] = shapespec[i];
                else if (['align', 'lineheight'].indexOf(i) >= 0)
                    nspec.paragraphs[0][i] = shapespec[i];
                else
                    nspec.paragraphs[0].runs[0][i] = shapespec[i];
            }

            return makeXmlShape(nspec, index, colorscheme, toEmu, toPointPercent);
        }
    }

    function makeXmlSlide(slidespec, spec, colorscheme) {
        var intTableNum = 1;

        function toEmu(len) {
            return Math.floor(len / spec.pageheight * SLIDE_HEIGHT_EMU);
        }

        function toPointPercent(len) {
            return Math.floor(len / spec.pageheight * SLIDE_HEIGHT_EMU / ONE_PT_EMU * 100);
        }

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
        h('p:sld', {
            'xmlns:a': "http://schemas.openxmlformats.org/drawingml/2006/main",
            'xmlns:r': "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
            'xmlns:p': "http://schemas.openxmlformats.org/presentationml/2006/main"
        }, [
            h('p:cSld', { name: slidespec.name },

                // Add background color
                (slidespec.bgcolor)
                    ? genXmlColorSelection(false, slidespec.bgcolor, colorscheme)
                    : genXmlColorSelection(false, 'FFFFFF', colorscheme),


                h('p:spTree',
                    h('p:nvGrpSpPr', [
                        h('p:cNvPr', { id: "1", name: "" }),
                        h('p:cNvGrpSpPr'),
                        h('p:nvPr')
                    ]),
                    h('p:grpSpPr', [
                        h('a:xfrm', [
                            h('a:off', { x: "0", y: "0" }),
                            h('a:ext', { cx: "0", cy: "0" }),
                            h('a:chOff', { x: "0", y: "0" }),
                            h('a:chExt', { cx: "0", cy: "0" })
                        ])
                    ]),

                    // add the actual shapes
                    slidespec.shapes.map(function processShape(shapespec, index) {
                        return makeXmlShape(shapespec, index, colorscheme, toEmu, toPointPercent);
                    })

                )
            ),
            h('p:clrMapOvr', h('a:masterClrMapping'))
        ]).toXml();
    }

    function makeXmlSlideLayoutRel() {
        return  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
                '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\r\n' +
                '  <Relationship Id="rId1" Target="../slideMasters/slideMaster1.xml" ' +
                '      Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideMaster"/>\r\n' +
                '</Relationships>';
    }

    function makeXmlSlideRel(inSlideNum, spec) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
            + '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\r\n'
            + ' <Relationship Id="rId1" Target="../slideLayouts/slideLayout'+ inSlideNum +'.xml"'
            + '     Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"/>\r\n'
            + '</Relationships>';
    }

    function makeXmlSlideMaster(spec) {
        var intSlideLayoutId = 2147483649;

        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
        h('p:sldMaster', {
            'xmlns:a': "http://schemas.openxmlformats.org/drawingml/2006/main",
            'xmlns:r': "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
            'xmlns:p': "http://schemas.openxmlformats.org/presentationml/2006/main"
        }, [
            h('p:cSld', [
                h('p:spTree', [
                    h('p:nvGrpSpPr', [
                        h('p:cNvPr', { id: "1", name: "" }),
                        h('p:cNvGrpSpPr'),
                        h('p:nvPr')
                    ]),
                    h('p:grpSpPr')
                ])
            ]),
            h('p:clrMap', {
                bg1: "lt1", tx1: "dk1", bg2: "lt2", tx2: "dk2",
                accent1: "accent1", accent2: "accent2", accent3: "accent3",
                accent4: "accent4", accent5: "accent5", accent6: "accent6",
                hlink: "hlink", folHlink: "folHlink"
            }),
            h('p:sldLayoutIdLst', [
                spec.pages.map(function(page, i) {
                    return h('p:sldLayoutId', {
                        id: intSlideLayoutId++,
                        'r:id': 'rId' + (i + 1)
                    });
                })
            ])
        ]).toXml();
    }

    function makeXmlSlideMasterRel(spec) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
        h('Relationships', { xmlns: "http://schemas.openxmlformats.org/package/2006/relationships" }, [
            spec.pages.map(function(page, i) {
                return h('Relationship', {
                    Id: 'rId' + (i + 1),
                    Target: '../slideLayouts/slideLayout' + (i + 1) + '.xml',
                    Type: "http://schemas.openxmlformats.org/officeDocument/2006/relationships/slideLayout"
                });
            }),
            h('Relationship', { Id: 'rId' + (spec.pages.length+1),
                Target: "../theme/theme1.xml",
                Type: 'http://schemas.openxmlformats.org/officeDocument/2006/relationships/theme'
            })
        ]).toXml();
    }

    function makeXmlTheme() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
        + '<a:theme xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" name="Office Theme">'
        + '    <a:themeElements>'
        + '        <a:clrScheme name="Office">'
        + '            <a:dk1><a:sysClr val="windowText" lastClr="000000" /></a:dk1>'
        + '            <a:lt1><a:sysClr val="window" lastClr="FFFFFF" /></a:lt1>'
        + '            <a:dk2><a:srgbClr val="1F497D" /></a:dk2>'
        + '            <a:lt2><a:srgbClr val="EEECE1" /></a:lt2>'
        + '            <a:accent1><a:srgbClr val="4F81BD" /></a:accent1>'
        + '            <a:accent2><a:srgbClr val="C0504D" /></a:accent2>'
        + '            <a:accent3><a:srgbClr val="9BBB59" /></a:accent3>'
        + '            <a:accent4><a:srgbClr val="8064A2" /></a:accent4>'
        + '            <a:accent5><a:srgbClr val="4BACC6" /></a:accent5>'
        + '            <a:accent6><a:srgbClr val="F79646" /></a:accent6>'
        + '            <a:hlink><a:srgbClr val="0000FF" /></a:hlink>'
        + '            <a:folHlink><a:srgbClr val="800080" /></a:folHlink>'
        + '        </a:clrScheme>'
        + '        <a:fontScheme name="Office">'
        + '            <a:majorFont>'
        + '                <a:latin typeface="Arial" />'
        + '                <a:ea typeface="" />'
        + '                <a:cs typeface="" />'
        + '            </a:majorFont>'
        + '            <a:minorFont>'
        + '                <a:latin typeface="Arial" />'
        + '                <a:ea typeface="" />'
        + '                <a:cs typeface="" />'
        + '            </a:minorFont>'
        + '        </a:fontScheme>'
        + '        <a:fmtScheme name="Office">'
        + '            <a:fillStyleLst>'
        + '                <a:solidFill><a:schemeClr val="phClr" /></a:solidFill>'
        + '                <a:gradFill rotWithShape="1">'
        + '                    <a:gsLst>'
        + '                        <a:gs pos="0">'
        + '                            <a:schemeClr val="phClr">'
        + '                                <a:tint val="50000" />'
        + '                                <a:satMod val="300000" />'
        + '                            </a:schemeClr>'
        + '                        </a:gs>'
        + '                        <a:gs pos="35000">'
        + '                            <a:schemeClr val="phClr">'
        + '                                <a:tint val="37000" />'
        + '                                <a:satMod val="300000" />'
        + '                            </a:schemeClr>'
        + '                        </a:gs>'
        + '                        <a:gs pos="100000">'
        + '                            <a:schemeClr val="phClr">'
        + '                                <a:tint val="15000" />'
        + '                                <a:satMod val="350000" />'
        + '                            </a:schemeClr>'
        + '                        </a:gs>'
        + '                    </a:gsLst>'
        + '                    <a:lin ang="16200000" scaled="1" />'
        + '                </a:gradFill>'
        + '                <a:gradFill rotWithShape="1">'
        + '                    <a:gsLst>'
        + '                        <a:gs pos="0">'
        + '                            <a:schemeClr val="phClr">'
        + '                                <a:shade val="51000" />'
        + '                                <a:satMod val="130000" />'
        + '                            </a:schemeClr>'
        + '                        </a:gs>'
        + '                        <a:gs pos="80000">'
        + '                            <a:schemeClr val="phClr">'
        + '                                <a:shade val="93000" />'
        + '                                <a:satMod val="130000" />'
        + '                            </a:schemeClr>'
        + '                        </a:gs>'
        + '                        <a:gs pos="100000">'
        + '                            <a:schemeClr val="phClr">'
        + '                                <a:shade val="94000" />'
        + '                                <a:satMod val="135000" />'
        + '                            </a:schemeClr>'
        + '                        </a:gs>'
        + '                    </a:gsLst>'
        + '                    <a:lin ang="16200000" scaled="0" />'
        + '                </a:gradFill>'
        + '            </a:fillStyleLst>'
        + '            <a:lnStyleLst>'
        + '                <a:ln w="9525" cap="flat" cmpd="sng" algn="ctr">'
        + '                    <a:solidFill>'
        + '                        <a:schemeClr val="phClr">'
        + '                            <a:shade val="95000" />'
        + '                            <a:satMod val="105000" />'
        + '                        </a:schemeClr>'
        + '                    </a:solidFill>'
        + '                    <a:prstDash val="solid" />'
        + '                </a:ln>'
        + '                <a:ln w="25400" cap="flat" cmpd="sng" algn="ctr">'
        + '                    <a:solidFill><a:schemeClr val="phClr" /></a:solidFill>'
        + '                    <a:prstDash val="solid" />'
        + '                </a:ln>'
        + '                <a:ln w="38100" cap="flat" cmpd="sng" algn="ctr">'
        + '                    <a:solidFill><a:schemeClr val="phClr" /></a:solidFill>'
        + '                    <a:prstDash val="solid" />'
        + '                </a:ln>'
        + '            </a:lnStyleLst>'
        + '            <a:effectStyleLst>'
        + '                <a:effectStyle>'
        + '                    <a:effectLst>'
        + '                        <a:outerShdw blurRad="40000" dist="20000" dir="5400000" rotWithShape="0">'
        + '                            <a:srgbClr val="000000">'
        + '                                <a:alpha val="38000" />'
        + '                            </a:srgbClr>'
        + '                        </a:outerShdw>'
        + '                    </a:effectLst>'
        + '                </a:effectStyle>'
        + '                <a:effectStyle>'
        + '                    <a:effectLst>'
        + '                        <a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0">'
        + '                            <a:srgbClr val="000000">'
        + '                                <a:alpha val="35000" />'
        + '                            </a:srgbClr>'
        + '                        </a:outerShdw>'
        + '                    </a:effectLst>'
        + '                </a:effectStyle>'
        + '                <a:effectStyle>'
        + '                    <a:effectLst>'
        + '                        <a:outerShdw blurRad="40000" dist="23000" dir="5400000" rotWithShape="0">'
        + '                            <a:srgbClr val="000000">'
        + '                                <a:alpha val="35000" />'
        + '                            </a:srgbClr>'
        + '                        </a:outerShdw>'
        + '                    </a:effectLst>'
        + '                    <a:scene3d>'
        + '                        <a:camera prst="orthographicFront">'
        + '                            <a:rot lat="0" lon="0" rev="0" />'
        + '                        </a:camera>'
        + '                        <a:lightRig rig="threePt" dir="t">'
        + '                            <a:rot lat="0" lon="0" rev="1200000" />'
        + '                        </a:lightRig>'
        + '                    </a:scene3d>'
        + '                    <a:sp3d>'
        + '                        <a:bevelT w="63500" h="25400" />'
        + '                    </a:sp3d>'
        + '                </a:effectStyle>'
        + '            </a:effectStyleLst>'
        + '            <a:bgFillStyleLst>'
        + '                <a:solidFill>'
        + '                    <a:schemeClr val="phClr" />'
        + '                </a:solidFill>'
        + '                <a:gradFill rotWithShape="1">'
        + '                    <a:gsLst>'
        + '                        <a:gs pos="0">'
        + '                            <a:schemeClr val="phClr">'
        + '                                <a:tint val="40000" />'
        + '                                <a:satMod val="350000" />'
        + '                            </a:schemeClr>'
        + '                        </a:gs>'
        + '                        <a:gs pos="40000">'
        + '                            <a:schemeClr val="phClr">'
        + '                                <a:tint val="45000" />'
        + '                                <a:shade val="99000" />'
        + '                                <a:satMod val="350000" />'
        + '                            </a:schemeClr>'
        + '                        </a:gs>'
        + '                        <a:gs pos="100000">'
        + '                            <a:schemeClr val="phClr">'
        + '                                <a:shade val="20000" />'
        + '                                <a:satMod val="255000" />'
        + '                            </a:schemeClr>'
        + '                        </a:gs>'
        + '                    </a:gsLst>'
        + '                    <a:path path="circle">'
        + '                        <a:fillToRect l="50000" t="-80000" r="50000" b="180000" />'
        + '                    </a:path>'
        + '                </a:gradFill>'
        + '                <a:gradFill rotWithShape="1">'
        + '                    <a:gsLst>'
        + '                        <a:gs pos="0">'
        + '                            <a:schemeClr val="phClr">'
        + '                                <a:tint val="80000" />'
        + '                                <a:satMod val="300000" />'
        + '                            </a:schemeClr>'
        + '                        </a:gs>'
        + '                        <a:gs pos="100000">'
        + '                            <a:schemeClr val="phClr">'
        + '                                <a:shade val="30000" />'
        + '                                <a:satMod val="200000" />'
        + '                            </a:schemeClr>'
        + '                        </a:gs>'
        + '                    </a:gsLst>'
        + '                    <a:path path="circle">'
        + '                        <a:fillToRect l="50000" t="50000" r="50000" b="50000" />'
        + '                    </a:path>'
        + '                </a:gradFill>'
        + '            </a:bgFillStyleLst>'
        + '        </a:fmtScheme>'
        + '    </a:themeElements>'
        + '    <a:objectDefaults />'
        + '    <a:extraClrSchemeLst />'
        + '</a:theme>';
    }

    function makeXmlPresentation(spec) {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n' +
        h('p:presentation', {
            'xmlns:a': "http://schemas.openxmlformats.org/drawingml/2006/main",
            'xmlns:r': "http://schemas.openxmlformats.org/officeDocument/2006/relationships",
            'xmlns:p': "http://schemas.openxmlformats.org/presentationml/2006/main",
            'saveSubsetFonts': "1"
        }, [
            h('p:sldMasterIdLst',
                h('p:sldMasterId', { id: "2147483648", 'r:id': "rId1" })),

            h('p:sldIdLst',
                spec.pages.map(function(page, i) {
                    return h('p:sldId', { id: i + 256, 'r:id': 'rId' + (i+2) });
                })
            ),

            h('p:sldSz', {
                cx: Math.floor((spec.pagewidth / spec.pageheight) * SLIDE_HEIGHT_EMU),
                cy: SLIDE_HEIGHT_EMU,
                type: "custom"
            }),

            h('p:notesSz', {
                cx: Math.floor((spec.pagewidth / spec.pageheight) * SLIDE_HEIGHT_EMU),
                cy: SLIDE_HEIGHT_EMU
            })
        ]).toXml();
    }

    function makeXmlPresProps() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
            + '<p:presentationPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
            + '         xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"'
            + '         xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">\r\n'
            + '  <p:extLst>\r\n'
            + '    <p:ext uri="{E76CE94A-603C-4142-B9EB-6D1370010A27}">'
            + '      <p14:discardImageEditData xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="0"/>'
            + '    </p:ext>\r\n'
            + '    <p:ext uri="{D31A062A-798A-4329-ABDD-BBA856620510}">'
            + '      <p14:defaultImageDpi xmlns:p14="http://schemas.microsoft.com/office/powerpoint/2010/main" val="220"/>'
            + '    </p:ext>\r\n'
            + '    <p:ext uri="{FD5EFAAD-0ECE-453E-9831-46B23BE46B34}">'
            + '      <p15:chartTrackingRefBased xmlns:p15="http://schemas.microsoft.com/office/powerpoint/2012/main" val="1"/>'
            + '    </p:ext>\r\n'
            + '  </p:extLst>\r\n'
            + '</p:presentationPr>';
    }

    function makeXmlTableStyles() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
            + '<a:tblStyleLst xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main"'
            + ' def="{5C22544A-7EE6-4342-B048-85BDC9FD1C3A}"/>';
    }

    function makeXmlViewProps() {
        return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\r\n'
            + '<p:viewPr xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships" xmlns:p="http://schemas.openxmlformats.org/presentationml/2006/main">'
            + '<p:normalViewPr><p:restoredLeft sz="15620"/><p:restoredTop sz="94660"/></p:normalViewPr>'
            + '<p:slideViewPr>'
            + '  <p:cSldViewPr>'
            + '    <p:cViewPr varScale="1"><p:scale><a:sx n="64" d="100"/><a:sy n="64" d="100"/></p:scale><p:origin x="-1392" y="-96"/></p:cViewPr>'
            + '    <p:guideLst><p:guide orient="horz" pos="2160"/><p:guide pos="2880"/></p:guideLst>'
            + '  </p:cSldViewPr>'
            + '</p:slideViewPr>'
            + '<p:notesTextViewPr>'
            + '  <p:cViewPr><p:scale><a:sx n="100" d="100"/><a:sy n="100" d="100"/></p:scale><p:origin x="0" y="0"/></p:cViewPr>'
            + '</p:notesTextViewPr>'
            + '<p:gridSpacing cx="78028800" cy="78028800"/>'
            + '</p:viewPr>';
    }

    function genXmlColorSelection(color_info, back_info, colorscheme) {
        var ret = [];

        if (back_info) {
            ret.push(h('p:bg',
                h('p:bgPr',
                  genXmlColorSelection(back_info, false, colorscheme),
                  h('a:effectLst')
                )
            ));
        }

        if (color_info) {
            ret.push(h('a:solidFill',
                h('a:srgbClr', { val: resolveColor(colorscheme, color_info) })
            ));
        }

        return ret;
    }

    return function render(spec, colorscheme) {
        var zip = new JSZip();

        var intSlideNum = 0;
        var intRels = 0;

        // folders
        zip.folder("_rels");
        zip.folder("docProps");
        zip.folder("ppt").folder("_rels");
        zip.folder("ppt/media");
        zip.folder("ppt/slideLayouts").folder("_rels");
        zip.folder("ppt/slideMasters").folder("_rels");
        zip.folder("ppt/slides").folder("_rels");
        zip.folder("ppt/theme");

        // Core files
        zip.file("[Content_Types].xml", makeXmlContTypes(spec));
        zip.file("_rels/.rels", makeXmlRootRels(spec));
        zip.file("docProps/app.xml", makeXmlApp(spec));
        zip.file("docProps/core.xml", makeXmlCore(spec));
        zip.file("ppt/_rels/presentation.xml.rels", makeXmlPresentationRels(spec));

        // Create a Layout/Master/Rel/Slide file for each SLIDE
        for (var idx = 0; idx < spec.pages.length; idx++) {
            intSlideNum++;
            zip.file("ppt/slideLayouts/slideLayout"+ intSlideNum +".xml", makeXmlSlideLayout(intSlideNum, spec));
            zip.file("ppt/slideLayouts/_rels/slideLayout"+ intSlideNum +".xml.rels", makeXmlSlideLayoutRel(intSlideNum, spec));
            zip.file("ppt/slides/slide"+ intSlideNum +".xml", makeXmlSlide(spec.pages[idx], spec, colorscheme));
            zip.file("ppt/slides/_rels/slide"+ intSlideNum +".xml.rels", makeXmlSlideRel(intSlideNum, spec));
        }
        zip.file("ppt/slideMasters/slideMaster1.xml", makeXmlSlideMaster(spec));
        zip.file("ppt/slideMasters/_rels/slideMaster1.xml.rels", makeXmlSlideMasterRel(spec));

        zip.file("ppt/theme/theme1.xml", makeXmlTheme(spec));
        zip.file("ppt/presentation.xml", makeXmlPresentation(spec));
        zip.file("ppt/presProps.xml",    makeXmlPresProps(spec));
        zip.file("ppt/tableStyles.xml",  makeXmlTableStyles(spec));
        zip.file("ppt/viewProps.xml",    makeXmlViewProps(spec));

        // return zip file
        return zip;
    }
})
