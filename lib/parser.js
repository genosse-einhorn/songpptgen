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
        /^CCLI License # \d+$/,
        /^Copyright/,
        /^\(C\)/,
        /^©/
    ];

    const EMK_COPYRIGHT_START_RE = [
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
            } else if (reMatchesAny(line, EMK_COPYRIGHT_START_RE)) {
                typedLines.push({ type: 'emkcopyright', text: line });
            } else if (line.match(SPLIT_MARKER_RE)) {
                typedLines.push({ type: 'split', text: line });
            } else if (reMatchesAny(line, PART_START_RE)) {
                typedLines.push({ type: 'versetitle', text: line });
            } else if (line.match(/^\d+\./)) {
                // EmK-Style Verse
                let match = line.match(/^(\d+)\.\s*(.*)$/);
                typedLines.push({
                    type: 'emkverse',
                    title: match[1],
                    text: line,
                    emktext: match[2]
                });
            } else if (line.match(/^Refrain /)) {
                // EmK-Style Refrain
                let match = line.match(/^(Refrain) \s*(.*)$/);
                typedLines.push({
                    type: 'emkverse',
                    title: match[1],
                    text: line,
                    emktext: match[2]
                });
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
                } else if (command.toUpperCase() == 'MODE') {
                    song.mode = args;
                } else {
                    // HACK really bad error reporting
                    typedLines.push({ type: 'text', text: 'ERROR: UNKNOWN COMMAND ' + line });
                }
            } else {
                typedLines.push({ type: 'text', text: line });
            }
        }

        return typedLines;
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
    function parseEmkTitle(lines) {
        let titlelines = [];

        while (nextNotOfType(lines, 'blank')) {
            // HACK: Single line "Melodie" is equivalent to a blank line
            let line = lines.shift();
            if (line.text == 'Melodie')
                break;

            titlelines.push(line.text);
        }

        // HACK: Copied EmK titles duplicate the song number. Fix that.
        if (titlelines.length >= 2) {
            let m = titlelines[1].match(/(\d+)([^ ]?)\s+(.*)$/);
            if (m) {
                let shortnum = m[1];
                let longnum = ('000' + shortnum).substring(shortnum.length);
                let extension = m[2];
                let title = m[3]
                if (titlelines[0] == 'EM' + longnum + extension) {
                    titlelines[1] = title;
                }
            }
        }

        return titlelines.join('\n').trim();
    }

    // Copyright ::= CopyrightLine { NoSeparatorLine }
    function parseCopyright(lines) {
        let copyright = '';

        while (nextNotOfType(lines, 'split'))
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

    function parseEmkVerse(lines) {
        // EmK verse consists of one line only, but the individual text
        // lines are separated with ' / '
        if (nextOfType(lines, 'emkverse')) {
            let line = lines.shift();
            return { title: line.title, parts: [line.emktext.split(' / ').join('\n')] };
        } else {
            return { title: '', parts: [lines.shift().text.split(' / ').join('\n')] };
        }
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
        if (song.mode == 'emk') {
            song.title = parseEmkTitle(lines);
        } else {
            song.title = parseTitle(lines);
        }

        while (lines.length) {
            if (nextOfType(lines, 'blank')) {
                // eat blank lines that make it up to here
                lines.shift();
            } else if (song.mode == 'emk' && nextOfType(lines, 'emkverse')) {
                saveVerse(song, parseEmkVerse(lines));
            } else if (nextOfType(lines, 'versetitle')) {
                saveVerse(song, parseNumberedVerse(lines));
            } else if (nextOfType(lines, 'copyright')) {
                song.copyright = parseCopyright(lines);
            } else if (song.mode == 'emk' && nextOfType(lines, 'emkcopyright')) {
                song.copyright = parseCopyright(lines);
            } else if (song.mode == 'emk') {
                saveVerse(song, parseEmkVerse(lines));
            } else {
                saveVerse(song, parseAnonVerse(lines));
            }
        }

        return song;
    }

    // Makes an informed decision on whether this is an EmK-Style song
    function detectEmkMode(lines) {
        let confidence = 0;

        // get our own modifiable line array
        lines = [].concat(lines);

        // eat initial blank lines
        while (nextOfType(lines, 'blank')) {
            lines.shift();
        }

        // first indicator: First title line is EM<Number>
        if (lines[0] && lines[0].text.match(/^EM\d+.?$/))
            confidence += 2; // very strong indicator

        // 2nd indicator: EmK-Style verses are present
        if (lines.some(line => line.type == 'emkverse')) {
            confidence += 1;

            // 2.5th indicator: No standard style verses are present
            if (lines.every(line => line.type != 'versetitle'))
                confidence += 1;
        }

        // 3rd indicator: Emk-Style copyright is present
        if (lines.some(line => line.type == 'emkcopyright'))
            confidence += 1;

        // 4th indicator: Emk-Style line splitters are presnet
        if (lines.some(line => line.text.match(/ \/ /)))
            confidence += 1;

        // 5th indicator: 3rd line is 'Melodie'
        if (lines[2] && lines[2].text == 'Melodie')
            confidence += 1;

        return confidence >= 4;
    }

    function parse(content) {
        let song = {
            title: '',
            copyright: '',
            verses: {},
            docorder: [],
            specorder: null,
            mode: 'auto'
        };

        let lines = tokenizeAndProcessCommands(content, song);

        if (song.mode == 'auto') {
            if (detectEmkMode(lines)) {
                song.mode = 'emk';
            }
        }

        parseSong(lines, song);

        return song;
    }

    function validateOrder(song) {
        let ret = Object.assign({}, song);

        if (!ret.order && ret.specorder) {
            ret.order = [];

            for (let e of ret.specorder) {
                // exact match
                if (ret.verses[e]) {
                    ret.order.push(e);
                    continue;
                }

                // case-insensitive match
                let target = Object.keys(ret.verses).find(function(c) {
                    return c.toUpperCase() == e.toUpperCase();
                });
                if (target) {
                    ret.order.push(target);
                    continue;
                }

                // case-insensitive prefix match
                let prefixmatch = Object.keys(ret.verses).find(function(c) {
                    return c.toUpperCase().startsWith(e.toUpperCase());
                });
                if (prefixmatch) {
                    ret.order.push(prefixmatch);
                    continue;
                }

                // For numbers: Search numbered verse
                if (/^[0-9]+$/.test(e)) {
                    let versematch = Object.keys(ret.verses).find(function(c) {
                        c = c.toUpperCase();
                        return c == 'VERSE ' + e || c == 'VERS ' + e
                            || c == 'STROPHE ' + e || c == 'PART ' + e;
                    });
                    if (versematch) {
                        ret.order.push(versematch);
                        continue;
                    }
                }
            }
        }

        if (!ret.order) {
            if (song.mode == 'emk') {
                // HACK: EmK cleverness: Last line of a verse indicates the next part
                ret.order = [];
                for (let i = 0; i < ret.docorder.length; ++i) {
                    ret.order.push(ret.docorder[i]);

                    // check reference
                    let parts = ret.verses[ret.docorder[i]];
                    if (parts) {
                        let lines = parts[parts.length-1].split('\n');
                        if (lines) {
                            let nextverse = lines[lines.length-1];
                            if (ret.verses[nextverse]) {
                                // Jackpot! This is a verse marker
                                if (ret.docorder[i+1] != nextverse)
                                    ret.order.push(nextverse)

                                // Remove it from the verse text
                                delete lines[lines.length-1];
                                parts[parts.length-1] = lines.join('\n');
                            }
                        }
                    }
                }
            } else {
                ret.order = ret.docorder;
            }
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
