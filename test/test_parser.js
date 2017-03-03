// run with mocha

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
                assert.deepEqual(parser.parse(fs.readFileSync(txt, 'utf-8')),
                            JSON.parse(fs.readFileSync(json, 'utf-8')));
            });
        }
    }
})
