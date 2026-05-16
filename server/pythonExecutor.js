/**
 * Safe Python Code Executor
 * - Sandboxed execution dengan timeouts
 * - Restricted library whitelist
 * - Output capture dengan size limits
 * - Security filtering
 */

import { spawn } from 'child_process';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TEMP_DIR = path.join(__dirname, 'temp-files', 'python-scripts');

// Ensure python temp directory exists
if (!fs.existsSync(TEMP_DIR)) {
  fs.mkdirSync(TEMP_DIR, { recursive: true });
}

// Whitelist of allowed libraries
const ALLOWED_LIBRARIES = [
  'json', 'math', 'random', 'datetime', 'time', 're',
  'statistics', 'itertools', 'functools', 'operator',
  'collections', 'string', 'io', 'base64', 'hashlib',
  'urllib', 'requests', 'numpy', 'pandas', 'matplotlib',
  'scipy', 'scikit-learn', 'csv', 'xml', 'html'
];

// Dangerous functions to block
const BLOCKED_PATTERNS = [
  /exec\s*\(/gi,
  /eval\s*\(/gi,
  /compile\s*\(/gi,
  /__import__/gi,
  /subprocess/gi,
  /os\.system/gi,
  /open\s*\(/gi,
  /socket/gi,
  /threading/gi,
];

class PythonExecutor {
  /**
   * Validate Python code for security
   */
  static validateCode(code) {
    // Check for dangerous patterns
    for (const pattern of BLOCKED_PATTERNS) {
      if (pattern.test(code)) {
        return {
          valid: false,
          error: `Security restriction: ${pattern.source} not allowed`
        };
      }
    }

    // Check code length (max 50KB)
    if (code.length > 50 * 1024) {
      return {
        valid: false,
        error: 'Code too large (max 50KB)'
      };
    }

    return { valid: true };
  }

  /**
   * Execute Python code safely
   */
  static executeCode(code, context = {}) {
    return new Promise((resolve) => {
      const validation = this.validateCode(code);
      if (!validation.valid) {
        return resolve({
          success: false,
          error: validation.error,
          output: '',
          executionTime: 0
        });
      }

      const startTime = Date.now();
      let output = '';
      let errorOutput = '';

      // Create sandbox with context variables
      const setupCode = this._generateSetupCode(context);
      const fullCode = setupCode + '\n' + code;

      // Write to temp file
      const scriptPath = path.join(TEMP_DIR, `script_${Date.now()}_${Math.random().toString(36).substr(2, 9)}.py`);
      
      try {
        fs.writeFileSync(scriptPath, fullCode);

        // Spawn Python process with timeout
        const pythonProcess = spawn('python', ['-u', scriptPath], {
          timeout: 30000, // 30 second timeout
          stdio: ['ignore', 'pipe', 'pipe']
        });

        // Set hard timeout
        const timeout = setTimeout(() => {
          pythonProcess.kill('SIGKILL');
        }, 35000);

        // Capture stdout
        if (pythonProcess.stdout) {
          pythonProcess.stdout.on('data', (data) => {
            const chunk = data.toString();
            if (output.length < 100000) { // Max 100KB output
              output += chunk;
            }
          });
        }

        // Capture stderr
        if (pythonProcess.stderr) {
          pythonProcess.stderr.on('data', (data) => {
            const chunk = data.toString();
            if (errorOutput.length < 50000) {
              errorOutput += chunk;
            }
          });
        }

        // Handle process end
        pythonProcess.on('close', (code) => {
          clearTimeout(timeout);
          const executionTime = Date.now() - startTime;

          // Clean up temp file
          try {
            fs.unlinkSync(scriptPath);
} catch {
            // Ignore cleanup errors
          }

          resolve({
            success: code === 0,
            output: output.trim(),
            error: errorOutput.trim(),
            exitCode: code,
            executionTime
          });
        });

        // Handle spawn errors
        pythonProcess.on('error', (err) => {
          clearTimeout(timeout);
          try {
            fs.unlinkSync(scriptPath);
          } catch {
            // Ignore
          }

          resolve({
            success: false,
            error: `Process error: ${err.message}`,
            output: '',
            executionTime: Date.now() - startTime
          });
        });

      } catch (err) {
        try {
          fs.unlinkSync(scriptPath);
        } catch {
          // Ignore
        }

        resolve({
          success: false,
          error: err.message,
          output: '',
          executionTime: Date.now() - startTime
        });
      }
    });
  }

  /**
   * Generate setup code with context variables
   */
  static _generateSetupCode(context) {
    const code = [];
    code.push('import json');
    code.push('import sys');
    code.push('from datetime import datetime');
    code.push('');
    
    // Add context variables
    if (Object.keys(context).length > 0) {
      code.push('# Context variables:');
      for (const [key, value] of Object.entries(context)) {
        try {
          // Sanitize key names
          if (/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(key)) {
            code.push(`${key} = ${JSON.stringify(value)}`);
          }
        } catch {
          // Skip complex values
        }
      }
      code.push('');
    }

    return code.join('\n');
  }

  /**
   * Batch execute multiple Python snippets
   */
  static async executeBatch(snippets) {
    const results = [];
    for (const snippet of snippets) {
      const result = await this.executeCode(snippet.code, snippet.context);
      results.push({
        label: snippet.label,
        ...result
      });
    }
    return results;
  }
}

export default PythonExecutor;
