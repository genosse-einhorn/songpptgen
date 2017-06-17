'use strict';
var define = typeof define === 'function' ? define : (dep, def) => { module.exports = def.apply(null, dep.map(d => require(d))) };

/*
 * Parser Module: Parses a SongBeamer-like lyrics file into a structured
 * song definition.
 *
 * Goal: Can parse lyrics from SongSelect without manual intervention
 */
define([], function() {
    function trimArr(a) {
        if (a.length > 0 && a[0].trim() == '')
            return trimArr(a.slice(1));
        else if (a.length > 0 && a[a.length-1].trim() == '')
            return trimArr(a.slice(0, -1));
        else
            return a.slice();
    }

    const PART_START_RE = [
        /^Verse?(\s+\d+.*)?$/,
        /^Strophe(\s+\d+.*)?$/,
        /^Part(\s+\d+.*)?$/,
        /^Refrain(\s+\d+.*)?$/,
        /^Chorus(\s+\d+.*)?$/,
        /^Pre-Chorus(\s+\d+.*)?$/,
        /^Bridge(\s+\d+.*)?$/,
        /^Ending(\s+\d+.*)?$/,
        /^Schluss(\s+\d+.*)?$/
    ];

    const ORDER_START_RE = /^\.[oO]rder\s/;

    const COPYRIGHT_START_RE = [
        /^CCLI Song # \d+$/,
        /^Copyright/,
        /^(C)/,
        /^©/,
    ];

    const SPLIT_MARKER_RE = /(^|\n)--+($|\n)/;

    const EMK_COPYRIGHT_RE = [
        /^T: /, /^M: /, /^TM: /, /^S: /, /^Q: /, /^Dt: /
    ];

    function reMatchesAny(str, re_arr) {
        for (let re of re_arr) {
            if (str.match(re))
                return true;
        }
        return false;
    }

    function parse(content) {
        // TODO: Multiple song support

        content = ('' + content).trim();
        let lines = content.split('\n').map(l => l.trim());

        let song = {
            title: '',
            parts: { '': '' },
            docorder: [''],
            specorder: null
        };

        // title = first lines up to a blank line
        while (lines.length && lines[0].trim() != '')
            song.title += lines.shift().trim() + '\n';
        song.title = song.title.trim();

        // default part
        let curpart = '';

        // split into parts by keywords
        while (lines.length > 0) {
            let l = lines[0];

            if (reMatchesAny(l, PART_START_RE)) {
                // CCLI Verse start
                curpart = l;
                song.docorder.push(curpart);

                lines.shift();
            } else if (reMatchesAny(l, COPYRIGHT_START_RE)) {
                // CCLI Copyright start
                curpart = '';

                song.copyright = lines.join('\n').trim();
                lines = [];
            } else if (l.match(/^\d+\. /)) {
                // EmK verse start
                curpart = l.match(/^(\d+)\./)[1];
                song.docorder.push(curpart)

                song.parts[curpart] = l.replace(/^\d+\. /, '') + '\n';
                lines.shift();
            } else if (l.match(ORDER_START_RE)) {
                let order = l.replace(ORDER_START_RE, '').split(',');

                song.specorder = order.map(e => e.trim());

                lines.shift();
            } else if (lines.every(e => reMatchesAny(e, EMK_COPYRIGHT_RE))) {
                // EmK copyright
                song.copyright = lines.join('\n').trim();
                lines = [];
            } else {
                if (song.parts[curpart])
                    song.parts[curpart] += l + '\n';
                else
                    song.parts[curpart] = l + '\n';

                lines.shift();
            }
        }

        // fixup parts
        for (let i in song.parts) {
            // trim and remove empty parts
            song.parts[i] = song.parts[i].trim();
            if (song.parts[i] === '') {
                delete song.parts[i];
                continue;
            }

            // EmK verses: line break at " / "
            if (i.match(/^\d+$/))
                song.parts[i] = song.parts[i].split(' / ').join('\n');

            // split parts that contain split markers
            if (song.parts[i].match(SPLIT_MARKER_RE))
                song.parts[i] = song.parts[i].split(SPLIT_MARKER_RE).map(e => e.trim()).filter(Boolean);
        }


        return song;
    }

    function validateOrder(song) {
        let ret = Object.assign({}, song);

        if (!ret.order && ret.specorder) {
            ret.order = ret.specorder.map(e => Object.keys(ret.parts).find(c =>
                (/^[0-9]+$/.test(e))
                    // verse numbers get suffix matching
                ? c.endsWith(e)

                    // else: case-insensitive prefix matching
                :   c.toUpperCase().startsWith(e.toUpperCase())
            ))
        }

        if (!ret.order) {
            ret.order = ret.docorder;
            // TODO: be clever for verse-chorus combinations
        }

        ret.order = ret.order.filter(e => e in ret.parts);

        return ret;
    }

    function getOrderedParts(song) {
        song = validateOrder(song);

        return song.order
            .map(o => ({ name: o, text: song.parts[o] }))
            .map(p => (p.text instanceof Array) ?
                    [{ name: p.name, text: p.text[0] }].concat(
                        p.text.slice(1).map(t => ({ name: '', text: t }))
                    ) : p)
            .reduce((a,c) => a.concat(c), []);
    }

    return {
        // function(str) -> object
        // see test data for results
        parse: parse,

        // function(song) -> song
        // ensures that song.order is present and valid
        validateOrder: validateOrder,

        // function(song) -> [string]
        // Gets song parts, correctly split and ordered
        orderedParts: getOrderedParts
    };
})
