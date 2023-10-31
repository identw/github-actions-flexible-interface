const fs = require('fs');


const manifests = [`${__dirname}/google/manifest.json`, `${__dirname}/mozilla/manifest.json`];

try {
    const version = fs.readFileSync(`${__dirname}/version`, 'utf8');
    for (m of manifests) {
        const data = fs.readFileSync(m, 'utf8');
        const jsonData = JSON.parse(data);
        jsonData.version = version;
        const updatedJson = JSON.stringify(jsonData, null, 2);
        fs.writeFileSync(m, updatedJson, 'utf8');
    }
} catch (err) {
    console.error('Error patch version:', err);
    process.exit(1);
}


const sourceMap = process.env.SOURCE_MAP === 'true' || false;
let exportConfig = {};

if (sourceMap) {
    console.log(`Source map enabled`);
    Object.assign(exportConfig, {
        devtool: 'inline-source-map',
    });
}

module.exports = exportConfig;