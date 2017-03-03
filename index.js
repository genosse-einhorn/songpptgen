require.config({
    paths: {
        'text': '3rdparty/require_text',
        'domReady': '3rdparty/require_domReady'
    }
});
define(['lib/parser', 'lib/renderer/html', 'lib/util/urlparams', 'domReady!'],
       function(parser, renderer_html, urlparams) {
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
            output.replaceChild(renderer_html(layouter(parser.parse(textarea.value)), 'DARK_CLASSIC'), output.firstChild);
        });
    }

    function pptx() {
        require(['lib/layout/' + renderer.value, 'lib/renderer/powerpoint', '3rdparty/FileSaver'], function(layouter, renderer, saveAs) {
            renderer(layouter(parser.parse(textarea.value)), 'DARK_CLASSIC')
            .generateAsync({type: 'blob'}).then(function(content) { window.saveAs(content, 'TODO.pptx') });
        });
    }

    function zoom(diff) {
        let f = output.style.fontSize ? parseFloat(output.style.fontSize.replace('rem', '')) : 1;
        f = Math.max(0.6, Math.min(100, f + diff));
        output.style.fontSize = f + 'rem';
    }

    textarea.addEventListener('input', render);
    renderer.addEventListener('input', render);
    document.querySelector('#pptxbutton').addEventListener('click', pptx);
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
