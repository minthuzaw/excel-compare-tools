const express = require("express");
const multer = require("multer");
const xlsx = require("xlsx");
const fs = require("fs");
const path = require("path");
const { parse } = require("csv-parse/sync");
const { stringify } = require("csv-stringify/sync");

const app = express();
const port = 3000;

// Create output directory if it doesn't exist
const outputDir = path.join(__dirname, "output");
if (!fs.existsSync(outputDir)) {
  fs.mkdirSync(outputDir);
}

const upload = multer({ dest: "uploads/" });
const uploadDir = path.join(__dirname, "uploads");

app.use(express.static("public"));

app.post("/upload", upload.array("files", 10), async (req, res) => {
  const option = req.body.option;

  function normalize(value) {
    if (value === null || value === undefined) return "";
    return String(value).trim().toLowerCase();
  }

  function getComparisonKey(row, cols) {
    if (cols) {
      return JSON.stringify(cols.map(i => normalize(row[i])));
    } else {
		return normalize(row[1]);
    //   return JSON.stringify(row.map(normalize));
    }
  }

  const dataArrays = [];

  try {
    for (const file of req.files) {
      let content;
      const ext = path.extname(file.originalname);

      if (ext === ".csv") {
        const csvContent = fs.readFileSync(file.path);
        content = parse(csvContent, { columns: false, skip_empty_lines: true });
      } else if (ext === ".xlsx") {
        const workbook = xlsx.readFile(file.path);
        const sheetName = workbook.SheetNames[0];
        const sheet = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { header: 1 });
        content = sheet;
      }

      dataArrays.push(content);
    }

    // Determine compareCols from either numeric indices or header names
    let compareCols = null;
    if (req.body.columns) {
      const rawEntries = req.body.columns.split(',').map(s => s.trim());
      const headerRow = dataArrays[0][0];
      const numericCols = rawEntries
        .map(s => parseInt(s, 10))
        .filter(n => !isNaN(n));
      if (numericCols.length === rawEntries.length) {
        compareCols = numericCols;
      } else {
        const nameCols = rawEntries
          .map(name => headerRow.findIndex(h => String(h).trim() === name))
          .filter(idx => idx >= 0);
        if (nameCols.length === rawEntries.length) {
          compareCols = nameCols;
        } else {
          console.warn("Could not resolve columns; defaulting to full-row comparison.");
        }
      }
    }

    // Apply logic based on selected option
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

        // Include headers in the result
        result = [headerRow, ...uniqueToSecond];
        break;
      default:
        return res.status(400).send("Invalid option");
    }

    // Generate CSV file for download
    const csvOutput = stringify(result);
    const outputPath = path.join(outputDir, `result_${Date.now()}.csv`);
    fs.writeFileSync(outputPath, csvOutput);

    res.download(outputPath, () => {
      // Cleanup upload folder
      fs.readdirSync(uploadDir).forEach(file => {
        const filePath = path.join(uploadDir, file);
        try {
          fs.unlinkSync(filePath);
        } catch (err) {
          console.warn("Failed to delete upload file:", filePath, err.message);
        }
      });
      // Cleanup
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
