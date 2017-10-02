'use strict';
var define = typeof define === 'function' ? define : (dep, def) => { module.exports = def.apply(null, dep.map(d => require(d))) };

/*
 * Parser Module: Parses a SongBeamer-like lyrics file into a structured
 * song definition.
 *
 * Goal: Can parse lyrics from SongSelect and from the EmK software with minimal intervention
 *
 * Special constraint: May not fail. Ever.
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
        /^\(C\)/,
        /^©/,
        /* HACK! EmK markers -> Should only work if on same line */
        /^T: /, /^M: /, /^TM: /, /^S: /, /^Q: /, /^Dt: /
    ];

    const SPLIT_MARKER_RE = /^--+$/;

    function reMatchesAny(str, re_arr) {
        for (let re of re_arr) {
            if (str.match(re))
                return true;
        }
        return false;
    }

    // Returns: Array of line objects
    function tokenizeAndProcessCommands(content, song) {
        let lines = content.trim().split('\n');
        let typedLines = [];

        for (let line of lines) {
            line = line.trim();

            if (line == '') {
                typedLines.push({ type: 'blank', text: line });
            } else if (reMatchesAny(line, COPYRIGHT_START_RE)) {
                typedLines.push({ type: 'copyright', text: line });
            } else if (line.match(SPLIT_MARKER_RE)) {
                typedLines.push({ type: 'split', text: line });
            } else if (reMatchesAny(line, PART_START_RE)) {
                typedLines.push({ type: 'versetitle', text: line });
            } else if (line.match(/^\d+\./)) {
                // EmK-Style Verse
                typedLines.push({ type: 'versetitle', text: line.match(/^(\d+)\./)[1] });
                typedLines.push({ type: 'text', text: line.replace(/^\d+\. /, '') });
            } else if (line.match(/^\./)) {
                // Command
                let match = line.match(/^\.([a-zA-Z0-9.]*)\s*(.*)$/);
                let command = '' + match[1];
                let args = '' + match[2];

                if (command == '.') {
                    // Escape command
                    typedLines.push({ type: 'text', text: args });
                } else if (command.toUpperCase() == 'ORDER') {
                    // Order
                    let order = args.split(',');

                    song.specorder = order.map(e => e.trim());
                } else {
                    // HACK really bad error reporting
                    typedLines.push({ type: 'text', text: 'ERROR: UNKNOWN COMMAND ' + line });
                }
            } else {
                typedLines.push({ type: 'text', text: line });
            }
        }

        // postprocess text lines: split at ' / ' markers
        let processedLines = [];
        for (let line of typedLines) {
            if (line.type == 'text') {
                let parts = line.text.split(' / ');
                for (let p of parts)
                    processedLines.push({ type: 'text', text: p });
            } else {
                processedLines.push(line);
            }
        }

        return processedLines;
    }

    function nextOfType(lines, type) {
        return lines[0] && lines[0].type && lines[0].type == type;
    }
    function nextNotOfType(lines, type) {
        return lines[0] && lines[0].type && lines[0].type != type;
    }

    // Title ::= { NoBlankLine }
    function parseTitle(lines) {
        let title = '';

        while (nextNotOfType(lines, 'blank'))
            title += lines.shift().text + '\n';

        return title.trim();
    }

    // Copyright ::= CopyrightLine { NoBlankLine }
    function parseCopyright(lines) {
        let copyright = '';

        while (nextNotOfType(lines, 'blank'))
            copyright += lines.shift().text + '\n';

        return copyright.trim();
    }

    // AnonymousVerse ::= VerseTail
    function parseAnonVerse(lines) {
        return { title: '', parts: parseVerseTail(lines) };
    }

    // NumberedVerse ::= VerseTitleLine VerseTail
    function parseNumberedVerse(lines) {
        let verse = { title: '', parts: [] };

        if (nextOfType(lines, 'versetitle')) {
            verse.title = lines.shift().text;
        }

        verse.parts = parseVerseTail(lines);

        return verse;
    }

    // VerseTail ::= Part { SeparatorLine Part }
    function parseVerseTail(lines) {
        let ret = [];

        ret.push(parsePart(lines));

        while (nextOfType(lines, 'split')) {
            lines.shift();
            ret.push(parsePart(lines));
        }

        return ret;
    }

    // Part ::= { NoBlankSplitLine | BlankLine (TextLine) }
    function parsePart(lines) {
        let retval = [];

        // TODO: hide emk specials behind mode flag
        while (nextNotOfType(lines, 'split') && nextNotOfType(lines, 'versetitle')) {
            let line = lines.shift();
            retval.push(line.text);

            // if this was a blank line, only continue for normal text
            if (line.type == 'blank') {
                if (nextNotOfType(lines, 'blank') && nextNotOfType(lines, 'text')) {
                    break;
                }
            }
        }

        return retval.join('\n').trim();
    }

    function saveVerse(song, verse) {
        if (song.verses[verse.title]) {
            song.verses[verse.title] = song.verses[verse.title].concat(verse.parts);
        } else {
            song.verses[verse.title] = [].concat(verse.parts);
        }

        if (song.docorder.indexOf(verse.title) == -1)
            song.docorder.push(verse.title);
    }

    // Song ::= Title { BlankLine } { AnonymousVerse | NumberedVerse | Copyright }
    function parseSong(lines, song) {
        // eat any blank lines before the title
        while (nextOfType(lines, 'blank'))
            lines.shift();

        // retrieve the title
        song.title = parseTitle(lines);

        // eat blank line after title
        while (nextOfType(lines, 'blank'))
            lines.shift();

        while (lines.length) {
            if (nextOfType(lines, 'versetitle')) {
                saveVerse(song, parseNumberedVerse(lines));
            } else if (nextOfType(lines, 'copyright')) {
                song.copyright = parseCopyright(lines);
            } else {
                saveVerse(song, parseAnonVerse(lines));
            }
        }

        return song;
    }

    function parse(content) {
        let song = {
            title: '',
            copyright: '',
            verses: {},
            docorder: [],
            specorder: null
        };

        let lines = tokenizeAndProcessCommands(content, song);

        parseSong(lines, song);

        return song;
    }

    function validateOrder(song) {
        let ret = Object.assign({}, song);

        if (!ret.order && ret.specorder) {
            ret.order = ret.specorder.map(e => Object.keys(ret.verses).find(c =>
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

        ret.order = ret.order.filter(e => e in ret.verses);

        return ret;
    }

    function getOrderedParts(song) {
        song = validateOrder(song);

        return song.order
            .map(o => ({ name: o, text: song.verses[o] }))
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
