require.config({
    paths: {
        'text': '3rdparty/require_text',
        'domReady': '3rdparty/require_domReady'
    }
});
define(['lib/parser', 'lib/util/urlparams', 'lib/h', 'lib/renderer/colorscheme',
        '3rdparty/split', 'lib/output/present', 'lib/layout/classic', 'lib/layout/kuemmel',
        'lib/layout/kuemmel-arial', 'lib/renderer/svg', 'domReady!'],
       function(parser, urlparams, h, colorRepo, Split, output_present,
                layout_classic, layout_kuemmel, layout_arial, rendererSvg) {
    let textarea = document.querySelector('#input .editor');
    let renderer = document.querySelector('#renderer');
    let colorscheme = document.querySelector('#colorscheme');
    let output = document.querySelector('#output');

    let layouters = {
        'classic': layout_classic,
        'kuemmel': layout_kuemmel,
        'kuemmel-arial': layout_arial
    };

    function loadExample(example) {
        require(['text!./example/' + example + '.txt'], function(text) {
            textarea.value = text;
            render();
        });
    }

    function render() {
        let layouter = layouters[renderer.value];
        let parsed = parser.parse(textarea.value);
        let layouted = layouter(parsed);
        let svgPages = rendererSvg(layouted, colorRepo.resolver(colorscheme.value));

        let html = h('div', { 'class': 'page-container' });
        for (let page of svgPages) {
            page.style.height = '50em';
            page.style.width = layouted.pagewidth / layouted.pageheight * 50 + 'em';
            page.style.margin = '1em';
            page.style.float = 'left';

            html.appendChild(page);
        }

        output.replaceChild(html.toDomNode(), output.firstChild);
    }

    function pptx() {
        let layouter = layouters[renderer.value];
        require(['lib/output/pptx'],  function(pptx) {
            pptx(parser.parse(textarea.value), layouter, colorRepo.resolver(colorscheme.value));
        });
    }

    function present() {
        let layouter = layouters[renderer.value];
        output_present(parser.parse(textarea.value),
                       layouter,
                       colorRepo.resolver(colorscheme.value));
    }

    function print() {
        // create window right here to work around popup blocker
        let win = window.open('about:blank');

        require(['lib/layout/' + renderer.value, 'lib/output/print'],
                    function(layouter, print) {
            let song = parser.parse(textarea.value);
            print(song, layouter, colorRepo.resolver(colorscheme.value), win);
        });
    }

    function zoom(diff) {
        let f = output.style.fontSize ? parseFloat(output.style.fontSize.replace('rem', '')) : 1;
        f = Math.max(0.6, Math.min(100, f + diff));
        output.style.fontSize = f + 'rem';
    }

    textarea.addEventListener('input', render);
    renderer.addEventListener('input', render);
    colorscheme.addEventListener('input', render);
    document.querySelector('#pptxbtn').addEventListener('click', pptx);
    document.querySelector('#printbtn').addEventListener('click', print);
    document.querySelector('#presentbtn').addEventListener('click', present);
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
