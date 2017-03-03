#!/usr/bin/env node

const parser = require('../../lib/parser');
const fs = require('fs');

console.log(JSON.stringify(parser.parse(fs.readFileSync(process.argv[2], 'UTF-8')), null, 4));

