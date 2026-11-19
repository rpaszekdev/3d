#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const HOME = path.join(require('os').homedir(), '.voxi-studio', 'projects');
const RENDERER = '/Users/robertpaszek/Desktop/Research/spatial-reasoning-dsl/2d-sketches/ui-sketch.html';

// Ensure storage exists
fs.mkdirSync(HOME, { recursive: true });

const [,, cmd, ...args] = process.argv;

const commands = {
  new: cmdNew,
  add: cmdAdd,
  list: cmdList,
  show: cmdShow,
  open: cmdOpen,
  diff: cmdDiff,
  delete: cmdDelete,
  export: cmdExport,
  import: cmdImport,
};

if (!cmd || !commands[cmd]) {
  console.log(`Usage: voxi <command> [args]

Commands:
  new <project> [description]    Create a new project
  add <project> [variation]      Add variation (from stdin or clipboard)
  list [project]                 List projects or variations
  show <project> [variation]     Print DSL to stdout
  open <project> [variation]     Copy to clipboard & open renderer
  diff <project> <v1> <v2>       Diff two variations
  delete <project> [variation]   Delete project or variation
  export <project>               Export all variations
  import <file>                  Import from file with == SKETCH headers`);
  process.exit(cmd ? 1 : 0);
}

commands[cmd](...args);

// --- Commands ---

function cmdNew(project, ...descParts) {
  if (!project) return fatal('Usage: voxi new <project> [description]');
  const dir = projDir(project);
  if (fs.existsSync(dir)) return fatal(`Project "${project}" already exists`);
  fs.mkdirSync(dir, { recursive: true });
  const meta = {
    name: project,
    description: descParts.join(' ') || '',
    created: today(),
    variations: [],
  };
  writeMeta(project, meta);
  console.log(`Created project: ${project}`);
}

function cmdAdd(project, variationName) {
  if (!project) return fatal('Usage: voxi add <project> [variation-name]');
  ensureProject(project);
  const meta = readMeta(project);
  const content = readInput();
  if (!content.trim()) return fatal('No input. Pipe content or have it in clipboard.');

  const name = variationName || autoName(meta);
  const filename = `${name}.voxi`;
  fs.writeFileSync(path.join(projDir(project), filename), content);
  if (!meta.variations.includes(name)) {
    meta.variations.push(name);
  }
  writeMeta(project, meta);
  console.log(`Added ${name} to ${project}`);
}

function cmdList(project) {
  if (project) {
    ensureProject(project);
    const meta = readMeta(project);
    console.log(`\n  ${meta.name}  ${meta.description ? '— ' + meta.description : ''}\n`);
    const dir = projDir(project);
    for (const v of meta.variations) {
      const fp = path.join(dir, `${v}.voxi`);
      const stat = fs.existsSync(fp) ? fs.statSync(fp) : null;
      const size = stat ? `${Math.ceil(stat.size / 1024)}KB` : '?';
      const modified = stat ? stat.mtime.toISOString().slice(0, 10) : '?';
      console.log(`  ${v.padEnd(30)} ${size.padStart(5)}  ${modified}`);
    }
    console.log();
    return;
  }

  const entries = listProjects();
  if (!entries.length) return console.log('No projects yet. Run: voxi new <name>');

  console.log(`\n  ${'PROJECT'.padEnd(20)} ${'VARIATIONS'.padStart(10)}  ${'LAST MODIFIED'.padStart(12)}\n`);
  for (const name of entries) {
    const meta = readMeta(name);
    const dir = projDir(name);
    let lastMod = meta.created;
    for (const v of meta.variations) {
      const fp = path.join(dir, `${v}.voxi`);
      if (fs.existsSync(fp)) {
        const d = fs.statSync(fp).mtime.toISOString().slice(0, 10);
        if (d > lastMod) lastMod = d;
      }
    }
    console.log(`  ${name.padEnd(20)} ${String(meta.variations.length).padStart(10)}  ${lastMod.padStart(12)}`);
  }
  console.log();
}

function cmdShow(project, variation) {
  if (!project) return fatal('Usage: voxi show <project> [variation]');
  ensureProject(project);
  const meta = readMeta(project);
  const name = variation || meta.variations[meta.variations.length - 1];
  if (!name) return fatal('No variations in this project');
  const fp = path.join(projDir(project), `${name}.voxi`);
  if (!fs.existsSync(fp)) return fatal(`Variation "${name}" not found`);
  process.stdout.write(fs.readFileSync(fp, 'utf-8'));
}

function cmdOpen(project, variation) {
  if (!project) return fatal('Usage: voxi open <project> [variation]');
  ensureProject(project);
  const meta = readMeta(project);
  const name = variation || meta.variations[meta.variations.length - 1];
  if (!name) return fatal('No variations in this project');
  const fp = path.join(projDir(project), `${name}.voxi`);
  if (!fs.existsSync(fp)) return fatal(`Variation "${name}" not found`);
  const content = fs.readFileSync(fp, 'utf-8');
  execSync('pbcopy', { input: content });
  console.log(`Copied ${name} to clipboard`);
  execSync(`open "${RENDERER}"`);
  console.log(`Opened renderer — paste the DSL into the editor`);
}

function cmdDiff(project, v1, v2) {
  if (!project || !v1 || !v2) return fatal('Usage: voxi diff <project> <v1> <v2>');
  ensureProject(project);
  const f1 = path.join(projDir(project), `${v1}.voxi`);
  const f2 = path.join(projDir(project), `${v2}.voxi`);
  if (!fs.existsSync(f1)) return fatal(`Variation "${v1}" not found`);
  if (!fs.existsSync(f2)) return fatal(`Variation "${v2}" not found`);
  try {
    const out = execSync(`diff --unified "${f1}" "${f2}"`, { encoding: 'utf-8' });
    process.stdout.write(out);
  } catch (e) {
    // diff exits 1 when files differ — that's normal
    if (e.stdout) process.stdout.write(e.stdout);
    else console.log('Files are identical');
  }
}

function cmdDelete(project, variation) {
  if (!project) return fatal('Usage: voxi delete <project> [variation]');
  ensureProject(project);
  if (!variation) {
    fs.rmSync(projDir(project), { recursive: true, force: true });
    console.log(`Deleted project: ${project}`);
    return;
  }
  const meta = readMeta(project);
  const fp = path.join(projDir(project), `${variation}.voxi`);
  if (fs.existsSync(fp)) fs.unlinkSync(fp);
  meta.variations = meta.variations.filter(v => v !== variation);
  writeMeta(project, meta);
  console.log(`Deleted ${variation} from ${project}`);
}

function cmdExport(project) {
  if (!project) return fatal('Usage: voxi export <project>');
  ensureProject(project);
  const meta = readMeta(project);
  for (const v of meta.variations) {
    const fp = path.join(projDir(project), `${v}.voxi`);
    if (!fs.existsSync(fp)) continue;
    process.stdout.write(`== SKETCH: ${project} — ${v} ==\n`);
    process.stdout.write(fs.readFileSync(fp, 'utf-8'));
    process.stdout.write('\n');
  }
}

function cmdImport(file) {
  if (!file) return fatal('Usage: voxi import <file>');
  const resolved = path.resolve(file);
  if (!fs.existsSync(resolved)) return fatal(`File not found: ${resolved}`);
  const raw = fs.readFileSync(resolved, 'utf-8');
  const sections = raw.split(/^== SKETCH.*?:\s*(.*?)\s*(?:—|--)\s*(.*?)\s*==\s*$/m);

  // sections: [preamble, project1, varName1, content1, project2, varName2, content2, ...]
  // But the split with capture groups gives: [before, cap1, cap2, between, cap1, cap2, ...]
  // Let's re-parse more robustly
  const re = /^== SKETCH.*?(?::\s*(.*?))?\s*(?:—|--)\s*(.*?)\s*==\s*$/gm;
  const matches = [];
  let m;
  while ((m = re.exec(raw)) !== null) {
    matches.push({ idx: m.index, end: m.index + m[0].length, project: m[1], variant: m[2] });
  }

  if (!matches.length) return fatal('No == SKETCH headers found in file');

  let imported = 0;
  for (let i = 0; i < matches.length; i++) {
    const start = matches[i].end;
    const end = i + 1 < matches.length ? matches[i + 1].idx : raw.length;
    const content = raw.slice(start, end).trim();
    if (!content) continue;

    // Derive project name from first match group or filename
    const projectRaw = matches[i].project || path.basename(file, path.extname(file));
    const project = projectRaw.trim().toLowerCase().replace(/\s+/g, '-');
    const variantRaw = matches[i].variant.trim();
    const variant = `v${i + 1}-${variantRaw.toLowerCase().replace(/\s+/g, '-')}`;

    // Ensure project
    const dir = projDir(project);
    let meta;
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      meta = { name: project, description: '', created: today(), variations: [] };
    } else {
      meta = readMeta(project);
    }

    fs.writeFileSync(path.join(dir, `${variant}.voxi`), content + '\n');
    if (!meta.variations.includes(variant)) {
      meta.variations.push(variant);
    }
    writeMeta(project, meta);
    imported++;
  }
  console.log(`Imported ${imported} variation(s)`);
}

// --- Helpers ---

function projDir(name) { return path.join(HOME, name); }

function readMeta(project) {
  const fp = path.join(projDir(project), 'meta.json');
  return JSON.parse(fs.readFileSync(fp, 'utf-8'));
}

function writeMeta(project, meta) {
  fs.writeFileSync(path.join(projDir(project), 'meta.json'), JSON.stringify(meta, null, 2) + '\n');
}

function ensureProject(name) {
  if (!fs.existsSync(path.join(projDir(name), 'meta.json'))) {
    fatal(`Project "${name}" not found. Run: voxi new ${name}`);
  }
}

function listProjects() {
  return fs.readdirSync(HOME).filter(d =>
    fs.existsSync(path.join(HOME, d, 'meta.json'))
  );
}

function autoName(meta) {
  const nums = meta.variations.map(v => {
    const m = v.match(/^v(\d+)/);
    return m ? parseInt(m[1], 10) : 0;
  });
  const next = nums.length ? Math.max(...nums) + 1 : 1;
  return `v${next}`;
}

function readInput() {
  try {
    if (!process.stdin.isTTY) {
      return fs.readFileSync('/dev/stdin', 'utf-8');
    }
  } catch (_) {}
  // Fall back to clipboard
  try {
    return execSync('pbpaste', { encoding: 'utf-8' });
  } catch (_) {
    return '';
  }
}

function today() { return new Date().toISOString().slice(0, 10); }

function fatal(msg) {
  console.error(`Error: ${msg}`);
  process.exit(1);
}
