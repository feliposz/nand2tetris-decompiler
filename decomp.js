const fs = require('fs');
const path = require('path');
const JackDecompiler = require('./JackDecompiler.js');

// TODO: Handle command line errors
const readpath = process.argv[2];
const stat = fs.statSync(readpath);

function decompileFile(readfile) {
    const decomp = new JackDecompiler();
    try {
        const basename = path.basename(readfile, path.extname(readfile));
        const writefile =  path.join(path.dirname(readfile), basename + '.decomp.jack');
        console.log('Decompiling ' + readfile);
        const data = fs.readFileSync(readfile, 'utf8');
        const out = decomp.main(basename, data.replace(/\r\n/g, '\n'));
        console.log('Writing output to ' + writefile);
        fs.writeFileSync(writefile, out);
    } catch (err) {
        console.error('At line ' + decomp.currentLine + ': ' + err.message);
        throw err; // DEBUG
    }
}

if (stat.isDirectory()) {
    console.log('Processing directory ' + readpath);
    const files = fs.readdirSync(readpath).filter(f => path.extname(f) == '.vm');
    files.forEach(function (file) {
        const filepath = path.join(readpath, file);
        decompileFile(filepath);
    });
} else {
    decompileFile(readpath);
}
