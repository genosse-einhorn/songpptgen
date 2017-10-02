define(['../renderer/powerpoint', '../../3rdparty/FileSaver'], function(renderer, FileSaver) {
    'use strict';

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

    return function(song, layouter, resolveColor) {
        return renderer(layouter(song), resolveColor)
        .generateAsync({type: 'blob'})
        .then(function(content) { window.saveAs(content, fixFilename(song.title) + '.pptx') });
    };
});
