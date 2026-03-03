#!/usr/bin/env node
/**
 * JSON Validation Script
 * Validates that all JSON files are properly formatted
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

const filesToValidate = [
  'src/locales/en.json',
  'src/locales/zh.json'
];

let hasErrors = false;

for (const file of filesToValidate) {
  const filePath = path.join(rootDir, file);
  try {
    const content = fs.readFileSync(filePath, 'utf-8');
    const parsed = JSON.parse(content);
    console.log(`✓ ${file} - Valid JSON (${Object.keys(parsed).length} top-level keys)`);
  } catch (error) {
    console.error(`✗ ${file} - Invalid JSON:`);
    console.error(`  ${error.message}`);
    hasErrors = true;
  }
}

if (hasErrors) {
  process.exit(1);
} else {
  console.log('\n✓ All JSON files are valid!');
}
