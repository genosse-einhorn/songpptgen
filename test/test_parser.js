// run with mocha

'use strict';

const assert = require('assert');
const fs = require('fs');
const parser = require('../lib/parser');

describe('Parser', function() {
    let files = fs.readdirSync(__dirname + '/parser');
    for (let f of files) {
        if (f.endsWith('.txt')) {
            let txt = __dirname + '/parser/' + f;
            let json = txt.replace('.txt', '.json');

            it('should handle ' + f, function() {
                let parsed = parser.validateOrder(parser.parse(fs.readFileSync(txt, 'utf-8')));

                // only check some properties
                for (let i in parsed) {
                    if (['title', 'copyright', 'verses', 'order'].indexOf(i) == -1) {
                        delete parsed[i];
                    }
                }

                assert.deepEqual(parsed, JSON.parse(fs.readFileSync(json, 'utf-8')));
            });
        }
    }
})
