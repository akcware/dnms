# 🗑️ Node Modules Cleaner

A fast and efficient CLI tool to find and delete `node_modules` directories recursively, helping you reclaim valuable disk space from your development projects.

Built with [Bun](https://bun.sh) for maximum performance.

## ✨ Features

- 🚀 **Blazing Fast**: Leverages Bun's native APIs for optimal performance
- 🔍 **Recursive Scanning**: Automatically finds all `node_modules` directories in a given path
- 📊 **Size Calculation**: Shows how much disk space each directory occupies
- 🛡️ **Safe by Default**: Multiple safety modes to prevent accidental deletions
- 🎨 **Beautiful CLI**: Colorful, intuitive terminal interface
- ⚡ **Efficient Deletion**: Uses optimized methods for fast removal

## 📦 Installation

```bash
bun install
```

## 🚀 Usage

### Run Without Install

**With Bun:**
```bash
bunx dnms --scan
```

**With npm:**
```bash
npx dnms --scan
```

### Basic Commands

**Scan directories without deleting:**
```bash
bunx dnms --scan
```

**Scan a specific directory:**
```bash
bunx dnms --scan ~/projects
```

**Dry run (see what would be deleted):**
```bash
bunx dnms --dry-run
```

**Delete with confirmation prompts:**
```bash
bunx dnms --confirm
```

**Verbose output:**
```bash
bunx dnms --verbose --scan
```

### Command-Line Options

| Option | Short | Description |
|--------|-------|-------------|
| `--scan` | `-s` | Scan only mode - finds `node_modules` without deleting |
| `--dry-run` | `-d` | Shows what would be deleted without actually deleting |
| `--help` | `-h` | Display help message with usage instructions |
| `--verbose` | `-v` | Enable detailed output with progress indicators |
| `--confirm` | `-c` | Ask for confirmation before each deletion |

### Examples

**Find all node_modules in your projects directory:**
```bash
bunx dnms --scan ~/Documents/projects
```

**Find all node_modules using the CLI name:**
```bash
bunx dnms --scan ~/Documents/projects
```

**Delete all node_modules with individual confirmation:**
```bash
bunx dnms --confirm ~/Documents/projects
```

**Preview deletion with detailed output:**
```bash
bunx dnms --dry-run --verbose .
```

## 🔒 Safety Features

1. **Confirmation Prompt**: By default, asks for confirmation before starting deletion
2. **Scan Mode**: Preview what will be found before taking action
3. **Dry Run Mode**: See exactly what would be deleted
4. **Per-Item Confirmation**: Use `--confirm` to approve each deletion individually
5. **Graceful Ctrl+C**: Cleanly exits on keyboard interrupt

## 📊 Output Example

```
╔══════════════════════════════════════════════════════════╗
║               🗑️  Node Modules Cleaner 🗑️                ║
║              Clean up disk space efficiently             ║
╚══════════════════════════════════════════════════════════╝

Mode: SCAN
Target: /Users/you/projects
Verbose: OFF

🔍 Searching for node_modules directories...

Found: /Users/you/projects/app1/node_modules (245.32 MB)
Found: /Users/you/projects/app2/node_modules (512.18 MB)
Found: /Users/you/projects/api/node_modules (189.45 MB)

============================================================
📊 SUMMARY
============================================================
Found: 3 node_modules directories
Total size: 946.95 MB

💡 Run without --scan to delete these directories

⏱️  Operation completed in 2.34s
```

## 🛠️ Technical Details

- Built with **TypeScript** for type safety
- Uses **Bun's native APIs** for file operations
- Recursive directory traversal with `readdir`
- Efficient size calculation using `Bun.file()` and `Glob`
- Cross-platform compatibility

## ⚠️ Important Notes

- This tool permanently deletes directories - use with caution
- Always use `--scan` first to preview what will be found
- You can always reinstall dependencies with `bun install`, `npm install`, etc.
- The tool skips directories it cannot access

## 📝 License

This project was created using `bun init` in bun v1.3.5.

## 🤝 Contributing

Feel free to open issues or submit pull requests for improvements!
