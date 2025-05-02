
## Getting Started

Install dependencies and run the development server:

```bash
npm install
node server.js
# or
nodemon server.js
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

---

## API Documentation

### POST `/upload`

Compares two CSV files based on a specific column.

#### Request

- **Method**: POST
- **Content-Type**: `multipart/form-data`
- **Payload**:
  - `files`: `file_name1.csv` (First CSV file)
  - `files`: `file_name2.csv` (Second CSV file)
  - `option`: `same` or `unique`
    - `same`: Returns records that exist in both files
    - `unique`: Returns records that are different between the files
  - `columns`: The column name to compare (e.g., `Username or something`)

#### Example

Using `curl`:

```bash
curl -X POST http://localhost:3000/upload \
  -F "files=@file_name1.csv" \
  -F "files=@file_name2.csv" \
  -F "option=same" \
  -F "columns=Username"
```
