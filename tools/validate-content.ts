import { readFileSync, readdirSync, existsSync } from 'fs';
import { join, resolve } from 'path';

const CONTENT_DIR = resolve(import.meta.dirname ?? '.', '..', 'content');

interface ValidationResult {
  file: string;
  errors: string[];
}

function validateJson(filePath: string): string[] {
  const errors: string[] = [];
  try {
    const raw = readFileSync(filePath, 'utf-8');
    JSON.parse(raw);
  } catch (e) {
    errors.push(`JSON parse error: ${(e as Error).message}`);
  }
  return errors;
}

function findJsonFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;

  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory() && !entry.name.startsWith('_')) {
      files.push(...findJsonFiles(full));
    } else if (entry.isFile() && entry.name.endsWith('.json')) {
      files.push(full);
    }
  }
  return files;
}

function main(): void {
  console.log('Validating content/ JSON files...\n');

  const files = findJsonFiles(CONTENT_DIR);
  if (files.length === 0) {
    console.log('No JSON files found in content/');
    return;
  }

  const results: ValidationResult[] = [];
  let hasErrors = false;

  for (const file of files) {
    const relative = file.replace(CONTENT_DIR + '/', '');
    const errors = validateJson(file);
    results.push({ file: relative, errors });
    if (errors.length > 0) hasErrors = true;
  }

  for (const r of results) {
    if (r.errors.length === 0) {
      console.log(`  OK  ${r.file}`);
    } else {
      console.log(`  NG  ${r.file}`);
      for (const e of r.errors) {
        console.log(`      -> ${e}`);
      }
    }
  }

  console.log(`\n${files.length} files checked.`);
  if (hasErrors) {
    console.error('\nValidation FAILED.');
    process.exit(1);
  } else {
    console.log('\nAll valid.');
  }
}

main();
