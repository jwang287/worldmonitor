#!/usr/bin/env node
/**
 * Security Audit Script
 * 
 * This script performs automated security checks on the codebase,
 * specifically focusing on XSS vulnerabilities.
 */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join, extname } from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Color codes for terminal output
const colors = {
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  green: '\x1b[32m',
  blue: '\x1b[34m',
  reset: '\x1b[0m',
};

// Security patterns to check
const securityPatterns = [
  {
    name: 'Dangerous innerHTML assignment',
    pattern: /\.innerHTML\s*=\s*([^;]+)(?!.*escapeHtml)/,
    severity: 'high',
    description: 'innerHTML assignment without escapeHtml sanitization',
  },
  {
    name: 'Dangerous outerHTML assignment',
    pattern: /\.outerHTML\s*=/,
    severity: 'high',
    description: 'outerHTML can execute scripts',
  },
  {
    name: 'document.write usage',
    pattern: /document\.(write|writeln)\s*\(/,
    severity: 'high',
    description: 'document.write can execute scripts',
  },
  {
    name: 'eval() usage',
    pattern: /\beval\s*\(/,
    severity: 'critical',
    description: 'eval() can execute arbitrary code',
  },
  {
    name: 'new Function() usage',
    pattern: /new\s+Function\s*\(/,
    severity: 'critical',
    description: 'Function constructor can execute arbitrary code',
  },
  {
    name: 'setTimeout with string',
    pattern: /setTimeout\s*\(\s*['"`]/,
    severity: 'medium',
    description: 'setTimeout with string argument is like eval()',
  },
  {
    name: 'setInterval with string',
    pattern: /setInterval\s*\(\s*['"`]/,
    severity: 'medium',
    description: 'setInterval with string argument is like eval()',
  },
  {
    name: 'insertAdjacentHTML usage',
    pattern: /\.insertAdjacentHTML\s*\(/,
    severity: 'medium',
    description: 'insertAdjacentHTML can execute scripts',
  },
  {
    name: 'javascript: URL',
    pattern: /['"]javascript:/i,
    severity: 'medium',
    description: 'javascript: URLs can execute scripts',
  },
  {
    name: 'on* event handler in string',
    pattern: /\s(on\w+)\s*=/i,
    severity: 'low',
    description: 'Inline event handlers can execute scripts',
  },
];

// Safe patterns that are allowed
const safePatterns = [
  /escapeHtml\s*\(/,
  /safeHtml\s*\(/,
  /DOMPurify\.sanitize/,
  /\.textContent\s*=/,
  /createTextNode\s*\(/,
  /innerHTML\s*=\s*['"]\s*['"]/, // Empty assignment
  /innerHTML\s*=\s*['"]<\w+[^>]*>['"]/, // Static HTML
];

// Files to exclude from scanning
const excludedFiles = [
  'node_modules',
  'dist',
  '.git',
  'scripts/security-audit.mjs',
  'src/utils/sanitize.ts',
  'src/utils/dom-utils.ts',
];

// Files that are allowed to use innerHTML (utility files)
const allowedFiles = [
  'src/utils/dom-utils.ts',
  'src/utils/sanitize.ts',
];

function isExcluded(filePath) {
  return excludedFiles.some(excluded => filePath.includes(excluded));
}

function isAllowedFile(filePath) {
  return allowedFiles.some(allowed => filePath.includes(allowed));
}

function scanFile(filePath) {
  const content = readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const findings = [];

  lines.forEach((line, index) => {
    // Skip comments
    if (line.trim().startsWith('//') || line.trim().startsWith('*')) {
      return;
    }

    securityPatterns.forEach(({ name, pattern, severity, description }) => {
      if (pattern.test(line)) {
        // Check if it's a safe usage
        const isSafe = safePatterns.some(safePattern => safePattern.test(line));
        const isAllowed = isAllowedFile(filePath);

        if (!isSafe && !isAllowed) {
          findings.push({
            line: index + 1,
            column: line.search(pattern) + 1,
            severity,
            name,
            description,
            code: line.trim(),
          });
        }
      }
    });
  });

  return findings;
}

function scanDirectory(dir) {
  const results = [];
  const files = readdirSync(dir);

  files.forEach(file => {
    const filePath = join(dir, file);
    const stat = statSync(filePath);

    if (stat.isDirectory()) {
      if (!isExcluded(filePath)) {
        results.push(...scanDirectory(filePath));
      }
    } else if (stat.isFile()) {
      const ext = extname(file);
      if ((ext === '.ts' || ext === '.tsx' || ext === '.js') && !isExcluded(filePath)) {
        const findings = scanFile(filePath);
        if (findings.length > 0) {
          results.push({
            file: filePath,
            findings,
          });
        }
      }
    }
  });

  return results;
}

function printResults(results) {
  console.log('\n' + '='.repeat(80));
  console.log('SECURITY AUDIT RESULTS');
  console.log('='.repeat(80) + '\n');

  let criticalCount = 0;
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;

  if (results.length === 0) {
    console.log(colors.green + '✓ No security issues found!' + colors.reset);
    return;
  }

  results.forEach(({ file, findings }) => {
    console.log(colors.blue + `\n📁 ${file}` + colors.reset);
    console.log('-'.repeat(80));

    findings.forEach(finding => {
      const severityColor = {
        critical: colors.red,
        high: colors.red,
        medium: colors.yellow,
        low: colors.blue,
      }[finding.severity];

      console.log(`\n  ${severityColor}[${finding.severity.toUpperCase()}]${colors.reset} ${finding.name}`);
      console.log(`  Line ${finding.line}, Column ${finding.column}`);
      console.log(`  ${finding.description}`);
      console.log(`  Code: ${finding.code.substring(0, 100)}${finding.code.length > 100 ? '...' : ''}`);

      if (finding.severity === 'critical') criticalCount++;
      else if (finding.severity === 'high') highCount++;
      else if (finding.severity === 'medium') mediumCount++;
      else lowCount++;
    });
  });

  console.log('\n' + '='.repeat(80));
  console.log('SUMMARY');
  console.log('='.repeat(80));
  console.log(`${colors.red}Critical: ${criticalCount}${colors.reset}`);
  console.log(`${colors.red}High: ${highCount}${colors.reset}`);
  console.log(`${colors.yellow}Medium: ${mediumCount}${colors.reset}`);
  console.log(`${colors.blue}Low: ${lowCount}${colors.reset}`);
  console.log(`\nTotal issues: ${criticalCount + highCount + mediumCount + lowCount}`);
  console.log('='.repeat(80) + '\n');

  // Exit with error code if critical or high issues found
  if (criticalCount > 0 || highCount > 0) {
    process.exit(1);
  }
}

function main() {
  const srcDir = join(__dirname, '..', 'src');
  console.log('🔍 Scanning for security vulnerabilities...');
  console.log(`📂 Scanning directory: ${srcDir}`);

  const results = scanDirectory(srcDir);
  printResults(results);
}

main();
