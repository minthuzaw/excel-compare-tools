const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const app = express();
const port = 3000;

const outputDir = path.join(__dirname, "output");
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);

const upload = multer({ dest: "uploads/" });
app.use(express.static("public"));

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

function generateCsvOutput(data) {
  const csvOutput = stringify(data);
  const outputPath = path.join(outputDir, `result_${Date.now()}.csv`);
  fs.writeFileSync(outputPath, csvOutput);
  return outputPath;
}

function cleanupUploads() {
  fs.readdirSync(uploadDir).forEach(file => {
    const filePath = path.join(uploadDir, file);
    try {
      fs.unlinkSync(filePath);
    } catch (err) {
      console.warn("Failed to delete upload file:", filePath, err.message);
    }
  });
}

app.post("/upload", upload.array("files", 10), async (req, res) => {
  const option = req.body.option;
  const dataArrays = [];

  try {
    for (const file of req.files) {
      const ext = path.extname(file.originalname);
      const content = parseFile(file.path, ext);
      dataArrays.push(content);
    }

    let compareCols = null;
    if (req.body.columns) {
      compareCols = resolveCompareCols(dataArrays[0][0], req.body.columns);
    }

    let result;
    switch (option) {
      case "same":
        result = dataArrays.reduce((a, b) =>
          a.filter(rowA =>
            b.some(rowB =>
              getComparisonKey(rowA, compareCols) === getComparisonKey(rowB, compareCols)
            )
          )
        );
        break;

      case "unique":
        if (dataArrays.length !== 2) {
          return res.status(400).send("Unique mode supports exactly 2 files.");
        }
        const [u1, u2] = dataArrays;
        const headerRow = u1[0];
        const data1Rows = u1.slice(1);
        const data2Rows = u2.slice(1);
        const set1Keys = new Set(data1Rows.map(row => getComparisonKey(row, compareCols)));
        const uniqueToSecond = data2Rows.filter(row => !set1Keys.has(getComparisonKey(row, compareCols)));
        result = [headerRow, ...uniqueToSecond];
        break;

      default:
        return res.status(400).send("Invalid option");
    }

    const outputPath = generateCsvOutput(result);

    res.download(outputPath, () => {
      cleanupUploads();
      fs.unlinkSync(outputPath);
    });

  } catch (err) {
    console.error(err);
    res.status(500).send("Error processing files: " + err.message);
  }
});

app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
});
