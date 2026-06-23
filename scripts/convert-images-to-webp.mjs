import { execFile } from 'node:child_process';
import { readdir, unlink } from 'node:fs/promises';
import { extname, join } from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const IMAGE_EXT = /\.(jpe?g|png)$/i;

export async function convertToWebp(filePath) {
  if (!IMAGE_EXT.test(filePath)) {
    return null;
  }

  const ext = extname(filePath);
  const webpPath = `${filePath.slice(0, -ext.length)}.webp`;

  await execFileAsync('cwebp', ['-q', '85', filePath, '-o', webpPath]);
  await unlink(filePath);

  console.log(`Converted ${filePath} -> ${webpPath}`);
  return webpPath;
}

async function readStdin() {
  const chunks = [];
  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }
  return Buffer.concat(chunks).toString('utf8');
}

async function collectImages(dir, results = []) {
  const entries = await readdir(dir, { withFileTypes: true });

  for (const entry of entries) {
    const fullPath = join(dir, entry.name);
    if (entry.isDirectory()) {
      await collectImages(fullPath, results);
    } else if (IMAGE_EXT.test(entry.name)) {
      results.push(fullPath);
    }
  }

  return results;
}

async function main() {
  const args = process.argv.slice(2);

  if (args[0] === '--all') {
    const images = await collectImages('public');
    for (const image of images) {
      await convertToWebp(image);
    }
    return;
  }

  if (args.length > 0) {
    for (const filePath of args) {
      await convertToWebp(filePath);
    }
    return;
  }

  if (!process.stdin.isTTY) {
    const input = await readStdin();
    if (!input.trim()) {
      return;
    }

    const data = JSON.parse(input);
    if (data.file_path) {
      await convertToWebp(data.file_path);
    }
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exit(1);
});
