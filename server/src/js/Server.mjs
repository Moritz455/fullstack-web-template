import express from 'express';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const port = Number(process.argv[2]) || 8080;
const app = express();

const staticDir = path.resolve(__dirname, '../../../webapp/dist');
app.use(express.static(staticDir));

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
