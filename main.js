const inputDir = 'input/';

let fs = require('fs');
let inputFiles = fs.readdirSync(inputDir);
let xlsx = require('node-xlsx');

console.log(inputFiles);

let relnoteEntries = inputFiles.map(element => {
    console.log(element);
    let relnoteData = xlsx.parse(inputDir + element);
    relnoteData.forEach(tab => console.log(tab));
    validateRelnoteData(relnoteData);
    return relnoteEntry = extract(relnoteData);
});

console.log(relnoteEntries);

//var obj = xlsx.parse(__dirname + '/myFile.xlsx'); // parses a file

function extract(relnoteData) {
    let relnoteEntry = {};
    relnoteEntry.version = getVersionFromRelnoteData(relnoteData);
    relnoteData[0].data.shift();
    relnoteData[0].data.shift();
    relnoteEntry.items = relnoteData[0].data.map(e => extractLine(e));
    //console.log(relnoteEntry);
    return relnoteEntry;
}

function extractLine(relnoteDataLine) {
    let relnoteLine = {}
    relnoteLine.ref = relnoteDataLine[1];
    relnoteLine.cat = relnoteDataLine[3];
    relnoteLine.summary = relnoteDataLine[4];
    relnoteLine.details = relnoteDataLine[5];
    relnoteLine.impact = relnoteDataLine[6];
    //console.log(relnoteLine);
    return relnoteLine;
}

function validateRelnoteData(relnoteData) {
    if (relnoteData.length != 1) throw new Error('invalid Relnote XLSX - File should have only one worksheet.');
}

function getVersionFromRelnoteData(relnoteData) {
    const versionField = relnoteData[0].data[0][0];
    //console.log(`getVersionFromRelnoteData: ${versionField}`);
    return versionField.replace('AFP Web Banking Release Notes ', '');
}