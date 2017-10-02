define(['../renderer/svg', '3rdparty/bigscreen', 'lib/h'], function(svgRenderer, BigScreen, h) {
    return function(song, layouter, resolveColor) {
        let svgs = []; // we render them later

        // setup the fullscreen div
        let body = document.querySelector('body');
        let el = h('div', {
            'style': {
                position: 'absolute',
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                'background-color': 'black',
                'color': 'white',
                'z-index': 1000
            }
        }, 'FIXME').toDomNode();
        body.appendChild(el);

        // global state and rendering
        let slideno = 0;

        function nextslide() {
            if (slideno + 1 < svgs.length) {
                slideno += 1;
                render();
            }
        }

        function prevslide() {
            if (slideno > 0) {
                slideno -= 1;
                render();
            }
        }

        function render() {
            el.innerHTML = '';

            let node = svgs[slideno].toDomNode();
            node.style.width = "100%";
            node.style.height = "100%";

            el.appendChild(node);
        }

        // event handlers
        function keyListener(e) {
            e.preventDefault();

            if (e.keyCode == 27) {
                // escape
                teardown();
            }

            if (e.keyCode == 40 || e.keyCode == 39) {
                // down / right arrow
                nextslide();
            }

            if (e.keyCode == 37 || e.keyCode == 38) {
                // left / up arrow
                prevslide();
            }
        }

        function setup() {
            document.addEventListener('keydown', keyListener);
            svgs = svgRenderer(layouter(song), resolveColor);
            render();
        }

        function teardown() {
            body.removeChild(el);
            document.removeEventListener('keydown', keyListener);
            BigScreen.exit();
        }

        // enter fullscreen
        BigScreen.request(el, setup, teardown, teardown);
    }
})
