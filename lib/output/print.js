define(['../renderer/svg'], function(renderer) {
    return function(song, layouter, resolveColor, win) {
        let layout = layouter(song);

        let csswidth = layout.pagewidth + 'pt';
        let cssheight = layout.pageheight + 'pt';

        win.document.write('<title>' + song.title + '</title>');
        win.document.write('<style>'
                + '@page { '
                +     'size: ' + csswidth + ' ' + cssheight + ';'
                +     'margin: 0;'
                + '}'
                + '@media screen {'
                +     '.page {'
                +         'margin: 1em;'
                +     '}'
                +     'body {'
                +         'background-color: gray'
                +     '}'
                + '}'
                + '@media print {'
                +     'html, body {'
                +         'margin: 0;'
                +         'padding: 0;'
                +         'width: ' + csswidth + ';'
                +         'height: ' + cssheight + ';'
                +     '}'
                + '}'

            + '</style>');

        win.document.write('<div class="pagewrapper">');

        for (let pspec of layout.pages) {
            let svgpage = renderer.renderPage(pspec, layout.pagewidth,
                                              layout.pageheight, resolveColor);
            svgpage.style.width = csswidth;
            svgpage.style.height = cssheight;

            win.document.write(svgpage.toXml());
        }

        win.print();
        win.close();
    }
});
