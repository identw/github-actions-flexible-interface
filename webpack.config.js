const sourceMap = process.env.SOURCE_MAP === 'true' || false;

let exportConfig = {};
if (sourceMap) {
    console.log(`Source map enabled`);
    Object.assign(exportConfig, {
        devtool: 'inline-source-map',
    });
}



module.exports = exportConfig;