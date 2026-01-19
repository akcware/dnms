#!/usr/bin/env bun

import { join, resolve } from "path";
import { readdir } from "node:fs/promises";
import { Glob } from "bun";

/** Megabyte constant (1024 * 1024 bytes) */
const MB = 1024 * 1024;

/** Gigabyte constant (1024 * 1024 * 1024 bytes) */
const GB = 1024 * MB;

/**
 * Command-line options for the node_modules cleaner
 */
interface Options {
  /** Scan only mode - find node_modules without deleting */
  scan: boolean;
  /** Dry run mode - show what would be deleted without actually deleting */
  dryRun: boolean;
  /** Display help message */
  help: boolean;
  /** Enable verbose output with detailed progress */
  verbose: boolean;
  /** Prompt for confirmation before each deletion */
  confirm: boolean;
}

/**
 * Information about a discovered node_modules directory
 */
interface NodeModuleInfo {
  /** Full path to the node_modules directory */
  path: string;
  /** Size of the directory in bytes */
  size: number;
  /** Parent project directory path */
  project: string;
}

/**
 * Information about an error encountered during operations
 */
interface ErrorInfo {
  /** Path where the error occurred */
  path: string;
  /** Error message description */
  error: string;
}

/**
 * Accumulator for tracking scan/deletion results
 */
interface Accumulator {
  /** Total bytes found/deleted */
  totalBytes: number;
  /** Number of node_modules directories found */
  count: number;
  /** List of discovered node_modules directories */
  found: NodeModuleInfo[];
  /** List of errors encountered during operations */
  errors: ErrorInfo[];
}

/**
 * ANSI color codes for terminal output styling
 */
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  red: '\x1b[31m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  blue: '\x1b[34m',
  magenta: '\x1b[35m',
  cyan: '\x1b[36m',
  white: '\x1b[37m'
};

/** Valid color keys for terminal output */
type ColorKey = keyof typeof colors;

/**
 * Wraps text with ANSI color codes for terminal output
 * @param text - The text to colorize
 * @param color - The color to apply
 * @returns Colorized text with ANSI codes
 */
function colorize(text: string, color: ColorKey): string {
  return `${colors[color]}${text}${colors.reset}`;
}

/**
 * Formats a byte count into a human-readable string with appropriate units
 * @param bytes - The number of bytes to format
 * @returns Formatted string with units (B, KB, MB, or GB)
 * @example
 * formatBytes(1024) // returns "1.00 KB"
 * formatBytes(1048576) // returns "1.00 MB"
 */
function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < MB) return `${(bytes / 1024).toFixed(2)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(2)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

/**
 * Displays the application banner to the console
 */
function printBanner() {
  console.log(colorize(`
╔══════════════════════════════════════════════════════════╗
║               🗑️  Node Modules Cleaner 🗑️                ║
║              Clean up disk space efficiently             ║
╚══════════════════════════════════════════════════════════╝
`, 'cyan'));
}

/**
 * Displays the help message with usage instructions and examples
 */
function printHelp() {
  console.log(colorize('\nUsage:', 'bright'));
  console.log('  bun delete-node-modules.js [options] [directory]');
  console.log('\nOptions:');
  console.log('  --scan, -s      Scan only (don\'t delete)');
  console.log('  --dry-run, -d   Show what would be deleted');
  console.log('  --help, -h      Show this help message');
  console.log('  --verbose, -v   Verbose output');
  console.log('  --confirm, -c   Ask for confirmation before each deletion');
  console.log('\nExamples:');
  console.log('  bun delete-node-modules.js --scan');
  console.log('  bun delete-node-modules.js --dry-run ~/projects');
  console.log('  bun delete-node-modules.js --confirm');
  console.log('  bun delete-node-modules.js --verbose /path/to/projects');
}

/**
 * Calculates the total size of a directory by recursively scanning all files
 * Uses Bun shell with `du` command for fast size calculation
 * @param dir - The directory path to calculate size for
 * @returns Total size in bytes, or 0 if the directory cannot be accessed
 */
async function getDirectorySize(dir: string): Promise<number> {
  try {
    // Use Bun shell with du command for fast directory size calculation
    // -sk: summarize (-s) and output in kilobytes (-k)
    // Note: macOS du doesn't support -b flag, so we use -k and convert
    const result = await Bun.$`du -sk ${dir}`.text();
    
    // Parse the output: "12345\t/path/to/dir"
    const sizeStr = result.split('\t')[0];
    if (!sizeStr) return 0;
    
    const sizeInKB = parseInt(sizeStr.trim(), 10) || 0;
    
    // Convert kilobytes to bytes
    return sizeInKB * 1024;
  } catch {
    return 0;
  }
}

/**
 * Prompts the user for yes/no confirmation in the terminal
 * @param message - The confirmation message to display
 * @returns Promise resolving to true if user confirms (y/yes), false otherwise
 */
async function promptConfirmation(message: string): Promise<boolean> {
  return new Promise((resolve) => {
    Bun.write(Bun.stdout, colorize(`${message} (y/N): `, 'yellow'));
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.once('data', (data) => {
      const answer = data.toString().toLowerCase();
      process.stdin.setRawMode(false);
      process.stdin.pause();
      console.log(answer);
      resolve(answer === 'y' || answer === 'yes');
    });
  });
}

/**
 * Recursively scans a directory tree for node_modules directories
 * Either reports findings or deletes them based on options
 * @param dir - The directory to scan
 * @param options - Command-line options controlling behavior
 * @param accumulator - Accumulator object for tracking results and errors
 */
async function scanNodeModules(dir: string, options: Options, accumulator: Accumulator) {
  try {
    // Use Node.js readdir (optimized by Bun) for reliable directory traversal
    const entries = await readdir(dir, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = join(dir, entry.name);

      if (entry.isDirectory()) {
        if (entry.name === "node_modules") {
          let sizeBytes = 0;
          try {
            if (options.verbose) {
              await Bun.write(Bun.stdout, colorize('Calculating size... ', 'yellow'));
            }
            sizeBytes = await getDirectorySize(fullPath);
            if (options.verbose) {
              console.log(colorize('✓', 'green'));
            }
          } catch {
            sizeBytes = 0;
          }

          accumulator.found.push({
            path: fullPath,
            size: sizeBytes,
            project: dir
          });

          accumulator.totalBytes += sizeBytes;
          accumulator.count++;

          if (options.scan || options.dryRun) {
            console.log(
              `${colorize('Found:', 'blue')} ${fullPath} ${colorize(`(${formatBytes(sizeBytes)})`, 'green')}`
            );
          } else {
            if (options.confirm) {
              const shouldDelete = await promptConfirmation(
                `Delete ${fullPath} (${formatBytes(sizeBytes)})?`
              );
              if (!shouldDelete) {
                console.log(colorize('Skipped', 'yellow'));
                accumulator.totalBytes -= sizeBytes;
                accumulator.count--;
                continue;
              }
            }

            try {
              if (options.verbose) {
                await Bun.write(Bun.stdout, colorize('Deleting... ', 'red'));
              }
              // Use Bun's shell command for fast, efficient deletion
              await Bun.$`rm -rf ${fullPath}`.quiet();
              if (options.verbose) {
                console.log(colorize('✓', 'green'));
              }
              console.log(
                `${colorize('Deleted:', 'red')} ${fullPath} ${colorize(`(freed ${formatBytes(sizeBytes)})`, 'green')}`
              );
            } catch (err: any) {
              console.error(colorize(`Failed to delete ${fullPath}: ${err.message}`, 'red'));
              accumulator.errors.push({ path: fullPath, error: err.message });
            }
          }
        } else {
          await scanNodeModules(fullPath, options, accumulator);
        }
      }
    }
  } catch {
    return;
  }
}

/**
 * Checks if a path is a directory
 * @param path - The path to check
 * @returns True if the path is a directory, false otherwise
 */
async function isDir(path: string): Promise<boolean> {
  try {
    // Try to scan the directory - if successful, it's a directory
    const glob = new Glob(".");
    glob.scanSync({ cwd: path, onlyFiles: false });
    return true;
  } catch {
    return false;
  }
}

/**
 * Checks if a path exists (either as a directory or file)
 * @param path - The path to check
 * @returns True if the path exists, false otherwise
 */
async function pathExists(path: string): Promise<boolean> {
  try {
    // Try to access the path as a directory first
    if (await isDir(path)) {
      return true;
    }
    // Try as a file
    const file = Bun.file(path);
    return await file.exists();
  } catch {
    return false;
  }
}

/**
 * Prints a summary of the scan/deletion operation
 * @param accumulator - Results and statistics from the operation
 * @param options - Command-line options that were used
 */
function printSummary(accumulator: Accumulator, options: Options) {
  console.log('\n' + colorize('='.repeat(60), 'cyan'));
  console.log(colorize('📊 SUMMARY', 'bright'));
  console.log(colorize('='.repeat(60), 'cyan'));
  
  if (accumulator.count === 0) {
    console.log(colorize('✨ No node_modules directories found!', 'green'));
    return;
  }

  console.log(`${colorize('Found:', 'blue')} ${accumulator.count} node_modules directories`);
  console.log(`${colorize('Total size:', 'blue')} ${formatBytes(accumulator.totalBytes)}`);
  
  if (options.scan) {
    console.log(colorize('\n💡 Run without --scan to delete these directories', 'yellow'));
  } else if (options.dryRun) {
    console.log(colorize('\n💡 This was a dry run. Add --confirm or remove --dry-run to actually delete', 'yellow'));
  } else {
    console.log(colorize(`\n✅ Successfully freed ${formatBytes(accumulator.totalBytes)} of disk space!`, 'green'));
  }

  if (accumulator.errors.length > 0) {
    console.log(colorize(`\n❌ Errors encountered: ${accumulator.errors.length}`, 'red'));
    if (options.verbose) {
      accumulator.errors.forEach(error => {
        console.log(colorize(`  • ${error.path}: ${error.error}`, 'red'));
      });
    }
  }
}

/**
 * Main application entry point
 * Parses command-line arguments, validates inputs, and orchestrates the scan/deletion process
 */
async function main() {
  const args = process.argv.slice(2);
  
  const options = {
    scan: args.includes('--scan') || args.includes('-s'),
    dryRun: args.includes('--dry-run') || args.includes('-d'),
    help: args.includes('--help') || args.includes('-h'),
    verbose: args.includes('--verbose') || args.includes('-v'),
    confirm: args.includes('--confirm') || args.includes('-c')
  };

  printBanner();

  if (options.help) {
    printHelp();
    return;
  }

  // Get target directory (last non-flag argument or current directory)
  const target = resolve(args.find(arg => !arg.startsWith('-')) || process.cwd());

  // Validate target directory
  const exists = await pathExists(target);
  if (!exists) {
    console.error(colorize(`❌ Directory not found: ${target}`, 'red'));
    process.exit(1);
  }

  // Verify it's accessible as a directory
  const accessible = await isDir(target);
  if (!accessible) {
    console.error(colorize(`❌ Cannot access directory: ${target}`, 'red'));
    process.exit(1);
  }

  const mode = options.scan ? 'SCAN' : options.dryRun ? 'DRY RUN' : 'DELETE';
  console.log(colorize(`Mode: ${mode}`, 'magenta'));
  console.log(colorize(`Target: ${target}`, 'blue'));
  console.log(colorize(`Verbose: ${options.verbose ? 'ON' : 'OFF'}`, 'blue'));
  
  if (!options.scan && !options.dryRun && !options.confirm) {
    console.log(colorize('\n⚠️  WARNING: This will permanently delete all node_modules directories!', 'yellow'));
    const shouldContinue = await promptConfirmation('Continue?');
    if (!shouldContinue) {
      console.log(colorize('Operation cancelled.', 'yellow'));
      return;
    }
  }

  console.log('\n' + colorize('🔍 Searching for node_modules directories...', 'cyan'));

  const accumulator = {
    totalBytes: 0,
    count: 0,
    found: [],
    errors: []
  };

  const startTime = Date.now();

  try {
    await scanNodeModules(target, options, accumulator);
    const endTime = Date.now();
    const duration = ((endTime - startTime) / 1000).toFixed(2);
    
    printSummary(accumulator, options);
    console.log(colorize(`\n⏱️  Operation completed in ${duration}s`, 'magenta'));
  } catch (err: any) {
    const errorMessage = err?.message || String(err);
    console.error(colorize(`❌ Error during operation: ${errorMessage}`, 'red'));
    process.exit(1);
  }
}

// Handle Ctrl+C gracefully
process.on('SIGINT', () => {
  console.log(colorize('\n\n👋 Operation cancelled by user', 'yellow'));
  process.exit(0);
});

main().catch(console.error);

