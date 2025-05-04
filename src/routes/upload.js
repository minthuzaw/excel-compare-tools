const express = require('express');
const multer = require('multer');
const path = require('path');
const { parseFile, resolveCompareCols, getComparisonKey, generateCsvOutput, cleanupUploads } = require('../utils/fileProcessor');
const fs = require('fs');

const router = express.Router();
const upload = multer({ dest: "uploads/" });

router.post("/", upload.array("files", 10), async (req, res) => {
    const option = req.body.option;
    const dataArrays = [];
    const outputDir = path.join(__dirname, "../../output");
    const uploadDir = path.join(__dirname, "../../uploads");

    try {
        // Validate files
        if (!req.files || req.files.length < 2) {
            return res.status(400).send("At least two files are required for comparison.");
        }

        for (const file of req.files) {
            const ext = path.extname(file.originalname);
            const content = parseFile(file.path, ext);
            if (!content || content.length === 0) {
                return res.status(400).send(`File ${file.originalname} is empty or could not be parsed.`);
            }
            dataArrays.push(content);
        }

        // Validate that all files have the same header structure
        const firstHeader = dataArrays[0][0];
        for (let i = 1; i < dataArrays.length; i++) {
            if (dataArrays[i][0].length !== firstHeader.length) {
                return res.status(400).send("All files must have the same number of columns.");
            }
        }

        let compareCols = null;
        if (req.body.columns) {
            compareCols = resolveCompareCols(dataArrays[0][0], req.body.columns);
        }

        let result;
        switch (option) {
            case "same":
                // Start with the first array and compare with others
                result = dataArrays[0].slice(1);
                for (let i = 1; i < dataArrays.length; i++) {
                    const currentArray = dataArrays[i].slice(1);
                    result = result.filter(rowA =>
                        currentArray.some(rowB =>
                            getComparisonKey(rowA, compareCols) === getComparisonKey(rowB, compareCols)
                        )
                    );
                }
                // Add header back to result
                result = [dataArrays[0][0], ...result];
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

        if (result.length === 1) { // Only header row
            return res.status(400).send("No matching records found.");
        }

        const outputPath = generateCsvOutput(result, outputDir);

        res.download(outputPath, () => {
            cleanupUploads(uploadDir);
            fs.unlinkSync(outputPath);
        });

    } catch (err) {
        console.error(err);
        res.status(500).send("Error processing files: " + err.message);
    }
});

module.exports = router;
