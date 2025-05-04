const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

function normalize(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim().toLowerCase();
}

function getComparisonKey(row, cols) {
    if (cols) {
        return JSON.stringify(cols.map(i => normalize(row[i])));
    }
    return normalize(row[1]);
}

function parseFile(filePath, ext) {
    if (ext === ".csv") {
        const csvContent = fs.readFileSync(filePath);
        return parse(csvContent, { columns: false, skip_empty_lines: true });
    } else if (ext === ".xlsx") {
        const workbook = xlsx.readFile(filePath);
        const sheetName = workbook.SheetNames[0];
        return xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
    }
    throw new Error(`Unsupported file extension: ${ext}`);
}

function resolveCompareCols(headerRow, columnSpec) {
    const rawEntries = columnSpec.split(',').map(s => s.trim());
    const numericCols = rawEntries.map(s => parseInt(s, 10)).filter(n => !isNaN(n));

    if (numericCols.length === rawEntries.length) return numericCols;

    const nameCols = rawEntries
        .map(name => headerRow.findIndex(h => String(h).trim() === name))
        .filter(idx => idx >= 0);

    if (nameCols.length === rawEntries.length) return nameCols;

    console.warn("Could not resolve columns; defaulting to full-row comparison.");
    return null;
}

function generateCsvOutput(data, outputDir) {
    const csvOutput = stringify(data);
    const outputPath = path.join(outputDir, `result_${Date.now()}.csv`);
    fs.writeFileSync(outputPath, csvOutput);
    return outputPath;
}

function cleanupUploads(uploadDir) {
    fs.readdirSync(uploadDir).forEach(file => {
        const filePath = path.join(uploadDir, file);
        try {
            fs.unlinkSync(filePath);
        } catch (err) {
            console.warn("Failed to delete upload file:", filePath, err.message);
        }
    });
}

module.exports = {
    normalize,
    getComparisonKey,
    parseFile,
    resolveCompareCols,
    generateCsvOutput,
    cleanupUploads
};
