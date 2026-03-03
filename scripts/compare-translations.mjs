#!/usr/bin/env node
/**
 * Translation Comparison Script
 * Compares en.json with zh.json to find missing translations
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.resolve(__dirname, '..');

// Read translation files
const enPath = path.join(rootDir, 'src', 'locales', 'en.json');
const zhPath = path.join(rootDir, 'src', 'locales', 'zh.json');

const enContent = JSON.parse(fs.readFileSync(enPath, 'utf-8'));
const zhContent = JSON.parse(fs.readFileSync(zhPath, 'utf-8'));

// Function to flatten nested object to dot-notation keys
function flattenObject(obj, prefix = '') {
  const result = {};
  
  for (const key in obj) {
    const newKey = prefix ? `${prefix}.${key}` : key;
    
    if (obj[key] !== null && typeof obj[key] === 'object' && !Array.isArray(obj[key])) {
      Object.assign(result, flattenObject(obj[key], newKey));
    } else {
      result[newKey] = obj[key];
    }
  }
  
  return result;
}

// Flatten both objects
const enFlat = flattenObject(enContent);
const zhFlat = flattenObject(zhContent);

// Find missing keys in zh.json
const missingKeys = [];
const enKeys = Object.keys(enFlat);
const zhKeys = Object.keys(zhFlat);

for (const key of enKeys) {
  if (!zhKeys.includes(key)) {
    missingKeys.push({
      key,
      enValue: enFlat[key]
    });
  }
}

// Find extra keys in zh.json (not in en.json)
const extraKeys = [];
for (const key of zhKeys) {
  if (!enKeys.includes(key)) {
    extraKeys.push({
      key,
      zhValue: zhFlat[key]
    });
  }
}

// Group missing keys by section
const groupedMissing = {};
for (const { key, enValue } of missingKeys) {
  const section = key.split('.')[0];
  if (!groupedMissing[section]) {
    groupedMissing[section] = [];
  }
  groupedMissing[section].push({ key, enValue });
}

// Output results
console.log('=== Translation Comparison Report ===\n');
console.log(`Total keys in en.json: ${enKeys.length}`);
console.log(`Total keys in zh.json: ${zhKeys.length}`);
console.log(`Missing in zh.json: ${missingKeys.length}`);
console.log(`Extra in zh.json: ${extraKeys.length}\n`);

if (missingKeys.length > 0) {
  console.log('=== Missing Translations (grouped by section) ===\n');
  
  for (const [section, items] of Object.entries(groupedMissing)) {
    console.log(`\n[${section}] - ${items.length} missing keys:`);
    for (const { key, enValue } of items) {
      const valuePreview = String(enValue).substring(0, 60).replace(/\n/g, '\\n');
      console.log(`  ${key}`);
      console.log(`    EN: "${valuePreview}${String(enValue).length > 60 ? '...' : ''}"`);
    }
  }
}

if (extraKeys.length > 0) {
  console.log('\n\n=== Extra Keys in zh.json (not in en.json) ===\n');
  for (const { key, zhValue } of extraKeys) {
    const valuePreview = String(zhValue).substring(0, 60).replace(/\n/g, '\\n');
    console.log(`  ${key}`);
    console.log(`    ZH: "${valuePreview}${String(zhValue).length > 60 ? '...' : ''}"`);
  }
}

// Export missing keys to JSON for easy processing
const outputPath = path.join(rootDir, 'scripts', 'missing-translations.json');
fs.writeFileSync(outputPath, JSON.stringify({
  missing: missingKeys,
  extra: extraKeys,
  summary: {
    totalEn: enKeys.length,
    totalZh: zhKeys.length,
    missingCount: missingKeys.length,
    extraCount: extraKeys.length
  }
}, null, 2));

console.log(`\n\nDetailed report saved to: ${outputPath}`);
