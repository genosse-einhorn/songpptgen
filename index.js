require.config({
    paths: {
        'text': '3rdparty/require_text',
        'domReady': '3rdparty/require_domReady'
    }
});
define(['lib/parser', 'lib/renderer/svg', 'lib/util/urlparams', 'lib/h', 'domReady!'],
       function(parser, rendererSvg, urlparams, h) {
    let textarea = document.querySelector('#input .editor');
    let renderer = document.querySelector('#renderer');
    let colorscheme = document.querySelector('#colorscheme');
    let output = document.querySelector('#output');

    function loadExample(example) {
        require(['text!./example/' + example + '.txt'], function(text) {
            textarea.value = text;
            render();
        });
    }

    function render() {
        require(['lib/layout/' + renderer.value], function(layouter) {
            let parsed = parser.parse(textarea.value);
            let layouted = layouter(parsed);
            let svgPages = rendererSvg(layouted, colorscheme.value);

            let html = h('div', { 'class': 'page-container' });
            for (let page of svgPages) {
                page.style.height = '50em';
                page.style.width = layouted.pagewidth / layouted.pageheight * 50 + 'em';
                page.style.margin = '1em';
                page.style.float = 'left';

                html.appendChild(page);
            }

            output.replaceChild(html.toDomNode(), output.firstChild);
        });
    }

    function fixFilename(unsafe) {
        unsafe = '' + unsafe;
        if (unsafe.length < 1)
            return '_unknown_';

        // very conservative attempt at sanitizing a file name
        return unsafe.split('').map(c => {
            let u = c.charCodeAt(0);
            if (u <= 31)
                return ' ';
            if ('<>:"\'/\\|?*'.indexOf(c) != -1)
                return '_';

            return c;
        }).join('');
    }

    function pptx() {
        require(['lib/layout/' + renderer.value, 'lib/renderer/powerpoint', '3rdparty/FileSaver'], function(layouter, renderer, saveAs) {
            let song = parser.parse(textarea.value);
            renderer(layouter(song), colorscheme.value)
            .generateAsync({type: 'blob'}).then(function(content) { window.saveAs(content, fixFilename(song.title) + '.pptx') });
        });
    }

    function print() {
        require(['lib/layout/' + renderer.value, 'lib/renderer/svg', 'lib/renderer/colorscheme'],
                    function(layouter, renderer, color_repo) {
            let song = parser.parse(textarea.value);
            let layout = layouter(song);

            let csswidth = layout.pagewidth/100 + 'in';
            let cssheight = layout.pageheight/100 + 'in';

            let win = window.open('about:blank');
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
                let svgpage = renderer.renderPage(pspec, layout.pagewidth, layout.pageheight, colorscheme.value);
                svgpage.style.width = csswidth;
                svgpage.style.height = cssheight;

                win.document.write(svgpage.toXml());
            }

            win.print();
            //win.close();
        });
    }

    function exportHandler() {
        let m = document.querySelector('#export').value;

        if (m == 'pptx')
            pptx();
        if (m == 'print')
            print();

        document.querySelector('#export').value = 'SELECT';
    }

    function zoom(diff) {
        let f = output.style.fontSize ? parseFloat(output.style.fontSize.replace('rem', '')) : 1;
        f = Math.max(0.6, Math.min(100, f + diff));
        output.style.fontSize = f + 'rem';
    }

    textarea.addEventListener('input', render);
    renderer.addEventListener('input', render);
    colorscheme.addEventListener('input', render);
    document.querySelector('#export').addEventListener('change', exportHandler);
    document.querySelector('#zoominbtn').addEventListener('click', () => zoom(0.1));
    document.querySelector('#zoomoutbtn').addEventListener('click', () => zoom(-0.1));

    Split(['#input', '#rightpane'], { sizes: [ 50, 50 ] });

    var example = 'quickstart';

    if (urlparams.renderer)
        renderer.value = urlparams.renderer;
    if (urlparams.colorscheme)
        colorscheme.value = urlparams.colorscheme;
    if (urlparams.example)
        example = urlparams.example;

    loadExample(example);
});
