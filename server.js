const express = require("express");
const path = require("path");
const fs = require("fs");

const app = express();
const port = 3000;

// Create necessary directories if they don't exist
const outputDir = path.join(__dirname, "output");
const uploadDir = path.join(__dirname, "uploads");

if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);

// Middleware
app.use(express.static("public"));

// Routes
const uploadRouter = require("./src/routes/upload");
const integrationRouter = require("./src/routes/integration");

app.use("/upload", uploadRouter);
app.use("/integration", integrationRouter);

// Start server
app.listen(port, () => {
    console.log(`Server running at http://localhost:${port}`);
});
