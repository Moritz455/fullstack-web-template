import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import readline from 'node:readline/promises';
import { stdin as input, stdout as output } from 'node:process';

const rl = readline.createInterface({ input, output });

const c = {
  green: '\x1b[32m',
  blue: '\x1b[34m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  reset: '\x1b[0m'
};

console.log(`${c.blue}====================================================${c.reset}`);
console.log(`${c.blue}                Project Setup Wizard                ${c.reset}`);
console.log(`${c.blue}====================================================${c.reset}\n`);

const rootPkgPath = path.resolve('package.json');
const rootPkg = JSON.parse(fs.readFileSync(rootPkgPath, 'utf8'));
const oldName = rootPkg.name;
const defaultName = path.basename(process.cwd());

// 1. Prompt for project name
const rawName = await rl.question(`1. Enter project name [${defaultName}]: `);
const projectName = (rawName.trim() || defaultName).toLowerCase().replace(/\s+/g, '-');

// 2. Interactive module selection (Default: all selected)
const modules = [
  { name: 'webapp', selected: true },
  { name: 'server', selected: true },
  { name: 'lib', selected: true }
];

while (true) {
  console.log(`\n${c.yellow}2. Which modules are needed? (Enter number to toggle, Enter = Continue)${c.reset}`);
  modules.forEach((mod, i) => {
    const mark = mod.selected ? `${c.green}[x]${c.reset}` : `${c.red}[ ]${c.reset}`;
    console.log(`   ${i + 1}) ${mark} ${mod.name}`);
  });

  const choice = (await rl.question('   Toggle module (1-3) or press [Enter] to confirm: ')).trim();
  if (!choice) break;

  for (const token of choice.split(/\s+/)) {
    const idx = Number.parseInt(token, 10) - 1;
    if (idx >= 0 && idx < modules.length) {
      modules[idx].selected = !modules[idx].selected;
    } else {
      console.log(`   ${c.red}Invalid input: ${token} (please enter 1, 2, or 3)${c.reset}`);
    }
  }
}

const keepPackages = modules.filter(m => m.selected).map(m => m.name);
const removePackages = modules.filter(m => !m.selected).map(m => m.name);

for (const pkg of keepPackages) {
  console.log(`   ${c.green}✓ Keeping module '${pkg}'${c.reset}`);
}
for (const pkg of removePackages) {
  if (fs.existsSync(pkg)) {
    fs.rmSync(pkg, { recursive: true, force: true });
    console.log(`   ${c.red}✗ Deleted directory '${pkg}'${c.reset}`);
  }
}

// 3. Prompt for CI/CD pipeline
console.log(`\n${c.yellow}3. Which CI/CD pipeline should be used?${c.reset}`);
console.log('   1) GitHub Actions (.github/workflows)');
console.log('   2) GitLab CI (.gitlab-ci.yml)');
console.log('   3) Keep both');
console.log('   4) None (delete both)');

const ciChoice = (await rl.question('   Selection [1-4, default: 1]: ')).trim() || '1';
rl.close();

if (ciChoice === '1') {
  fs.rmSync('.gitlab-ci.yml', { force: true });
  console.log(`   ${c.green}✓ Kept GitHub Actions, deleted .gitlab-ci.yml.${c.reset}`);
} else if (ciChoice === '2') {
  fs.rmSync('.github', { recursive: true, force: true });
  console.log(`   ${c.green}✓ Kept GitLab CI, deleted .github.${c.reset}`);
} else if (ciChoice === '3') {
  console.log(`   ${c.green}✓ Kept both pipelines.${c.reset}`);
} else if (ciChoice === '4') {
  fs.rmSync('.gitlab-ci.yml', { force: true });
  fs.rmSync('.github', { recursive: true, force: true });
  console.log(`   ${c.red}✗ Deleted all pipeline configurations.${c.reset}`);
}

// 4. Clean up JSON files, dependencies, and workspaces
console.log(`\n${c.yellow}4. Cleaning up dependencies and configuration files...${c.reset}`);

function removeModuleDeps (pkgJson, removedList) {
  for (const depField of ['dependencies', 'devDependencies', 'peerDependencies', 'optionalDependencies']) {
    if (!pkgJson[depField]) continue;

    for (const [depName, depVersion] of Object.entries(pkgJson[depField])) {
      for (const removed of removedList) {
        const isRemoved =
          depName === removed ||
          depName === `@${oldName}/${removed}` ||
          depName === `@${projectName}/${removed}` ||
          String(depVersion).includes(`file:./${removed}`) ||
          String(depVersion).includes(`file:../${removed}`);

        if (isRemoved) {
          delete pkgJson[depField][depName];
          console.log(`   ✗ Removed dependency '${depName}' from ${depField}`);
        }
      }
    }
  }
}

// Update remaining sub-packages first & inspect available scripts (e.g., build, test)
const availableSubScripts = new Set();

for (const pkg of keepPackages) {
  const pkgJsonPath = path.resolve(pkg, 'package.json');
  if (fs.existsSync(pkgJsonPath)) {
    const rawContent = fs.readFileSync(pkgJsonPath, 'utf8').replaceAll(oldName, projectName);
    const subPkg = JSON.parse(rawContent);
    removeModuleDeps(subPkg, removePackages);

    if (subPkg.scripts) {
      Object.keys(subPkg.scripts).forEach(s => availableSubScripts.add(s));
    }

    fs.writeFileSync(pkgJsonPath, JSON.stringify(subPkg, null, 2) + '\n', 'utf8');
    console.log(`   ✓ Updated ${pkg}/package.json`);
  }
}

// Update root package.json
rootPkg.name = projectName;
if (keepPackages.length > 0) {
  rootPkg.workspaces = keepPackages;
} else {
  delete rootPkg.workspaces;
}

removeModuleDeps(rootPkg, removePackages);

if (removePackages.includes('webapp') && rootPkg.devDependencies) {
  for (const dep of ['esbuild', 'less', 'lesshint', 'terser', 'http-server']) {
    if (rootPkg.devDependencies[dep]) {
      delete rootPkg.devDependencies[dep];
      console.log(`   ✗ Removed frontend devDependency '${dep}' from root`);
    }
  }
  if (fs.existsSync('.lesshintrc')) {
    fs.rmSync('.lesshintrc', { force: true });
    console.log('   ✗ Deleted .lesshintrc (since webapp was deselected)');
  }
}

const removedRootScripts = [];

if (rootPkg.scripts) {
  for (const initKey of ['init', 'setup', 'init-project']) {
    delete rootPkg.scripts[initKey];
  }

  for (const [scriptName, scriptCmd] of Object.entries(rootPkg.scripts)) {
    // Remove scripts referencing deselected modules
    if (removePackages.some(removed => scriptCmd.includes(removed))) {
      delete rootPkg.scripts[scriptName];
      removedRootScripts.push(scriptName);
      console.log(`   ✗ Removed root script '${scriptName}'`);
      continue;
    }

    // Remove workspace-delegated build/test scripts if no remaining workspace implements them
    if (scriptCmd.includes('--workspaces') && !availableSubScripts.has(scriptName)) {
      delete rootPkg.scripts[scriptName];
      removedRootScripts.push(scriptName);
      console.log(`   ✗ Removed root script '${scriptName}' (not implemented by remaining modules)`);
    }
  }
}

fs.writeFileSync(rootPkgPath, JSON.stringify(rootPkg, null, 2) + '\n', 'utf8');
console.log('   ✓ Updated root package.json');

for (const relPath of ['README.md', 'webapp/src/index.html']) {
  if (fs.existsSync(relPath)) {
    const content = fs.readFileSync(relPath, 'utf8');
    fs.writeFileSync(relPath, content.replaceAll(oldName, projectName), 'utf8');
    console.log(`   ✓ Updated ${relPath}`);
  }
}

// 5. Adapt CI/CD pipeline files to deselected modules
if (removePackages.length > 0 && ciChoice !== '4') {
  console.log(`\n${c.yellow}5. Adapting CI/CD pipelines to selected modules...${c.reset}`);

  // Build list of regex matchers for obsolete commands, paths, and jobs
  const obsoleteMatchers = [
    ...removePackages.map(pkg => new RegExp(`(^|[^a-zA-Z0-9_-])${pkg}(\\/|[^a-zA-Z0-9_-]|$)`)),
    ...removedRootScripts.map(scr => new RegExp(`npm\\s+(run\\s+)?${scr.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}(\\s|$)`))
  ];

  if (removePackages.includes('webapp')) {
    obsoleteMatchers.push(/\b(lesshint|lessc|esbuild|terser|lint[_:-]?less|build[_:-]?webapp)\b/i);
  }
  if (removedRootScripts.includes('build')) {
    obsoleteMatchers.push(/^build$/i);
  }

  const isObsoleteText = (text) => obsoleteMatchers.some(rx => rx.test(text));
  const isSetupOnlyCmd = (line) => /^\s*-\s*(npm\s+(ci|install|i)|echo\b)/i.test(line);

  // Strip optional explicit comment markers: # [<module>:start] ... # [<module>:end]
  const stripMarkerBlocks = (content) => {
    let result = content;
    for (const removed of removePackages) {
      const markerRx = new RegExp(
        `^[ \\t]*#\\s*\\[${removed}:start\\][\\s\\S]*?^[ \\t]*#\\s*\\[${removed}:end\\]\\r?\\n?`,
        'gm'
      );
      result = result.replace(markerRx, '');
    }
    return result;
  };

  // 5a. Adapt GitLab CI (.gitlab-ci.yml)
  if (fs.existsSync('.gitlab-ci.yml')) {
    const rawYaml = stripMarkerBlocks(fs.readFileSync('.gitlab-ci.yml', 'utf8'));
    const lines = rawYaml.split(/\r?\n/);

    // Group into top-level YAML blocks
    const blocks = [];
    let current = [];
    for (const line of lines) {
      if (/^[a-zA-Z0-9_.-]+:/.test(line) && current.length > 0) {
        blocks.push(current);
        current = [line];
      } else {
        current.push(line);
      }
    }
    if (current.length > 0) blocks.push(current);

    const reservedKeys = new Set(['stages', 'variables', 'default', 'image', 'workflow', 'cache', 'include', 'before_script', 'after_script']);
    const activeStages = new Set();
    const keptBlocks = [];

    for (const block of blocks) {
      const headerMatch = block[0].match(/^([a-zA-Z0-9_.-]+):/);
      if (!headerMatch) {
        keptBlocks.push({ key: null, lines: block });
        continue;
      }

      const key = headerMatch[1];
      if (reservedKeys.has(key) || key.startsWith('.')) {
        keptBlocks.push({ key, lines: block });
        continue;
      }

      // Check if job name itself targets a removed module/script
      if (isObsoleteText(key)) {
        console.log(`   ✗ Removed GitLab CI job '${key}'`);
        continue;
      }

      // Filter individual list items inside the job (e.g., script lines or artifact paths)
      const filteredLines = block.filter(line => {
        if (/^\s*-\s+/.test(line) && isObsoleteText(line)) {
          console.log(`   ✗ Removed GitLab CI line: ${line.trim()}`);
          return false;
        }
        return true;
      });

      // Remove empty artifacts block if all artifact paths were deleted
      const cleanedLines = [];
      for (let i = 0; i < filteredLines.length; i++) {
        if (/^\s+artifacts:\s*$/.test(filteredLines[i])) {
          let j = i + 1;
          const artBlock = [filteredLines[i]];
          while (j < filteredLines.length && (/^\s{4,}/.test(filteredLines[j]) || filteredLines[j].trim() === '')) {
            artBlock.push(filteredLines[j]);
            j++;
          }
          const hasPathItems = artBlock.some(l => /^\s*-\s+\S+/.test(l));
          if (hasPathItems) cleanedLines.push(...artBlock);
          i = j - 1;
        } else {
          cleanedLines.push(filteredLines[i]);
        }
      }

      // Check if job still has substantive script commands beyond 'npm ci' / 'npm install'
      const scriptCmds = cleanedLines.filter(l => /^\s*-\s+/.test(l));
      const substantiveCmds = scriptCmds.filter(l => !isSetupOnlyCmd(l));

      if (scriptCmds.length === 0 || substantiveCmds.length === 0) {
        console.log(`   ✗ Removed empty GitLab CI job '${key}'`);
        continue;
      }

      const stageLine = cleanedLines.find(l => /^\s+stage:\s*\S+/.test(l));
      if (stageLine) {
        activeStages.add(stageLine.replace(/^\s+stage:\s*/, '').trim());
      }

      keptBlocks.push({ key, lines: cleanedLines });
    }

    // Filter unused stages from the 'stages:' block
    const finalBlocks = keptBlocks.map(b => {
      if (b.key !== 'stages' || activeStages.size === 0) return b.lines.join('\n');
      return b.lines
        .filter(line => {
          const m = line.match(/^\s*-\s*(\S+)/);
          return !m || activeStages.has(m[1]);
        })
        .join('\n');
    });

    const finalGitlabYaml = finalBlocks.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
    fs.writeFileSync('.gitlab-ci.yml', finalGitlabYaml, 'utf8');
    console.log('   ✓ Updated .gitlab-ci.yml');
  }

  // 5b. Adapt GitHub Actions (.github/workflows/*.yml)
  const workflowsDir = path.resolve('.github', 'workflows');
  if (fs.existsSync(workflowsDir)) {
    const wfFiles = fs.readdirSync(workflowsDir).filter(f => f.endsWith('.yml') || f.endsWith('.yaml'));

    for (const file of wfFiles) {
      const wfPath = path.join(workflowsDir, file);
      const rawWf = stripMarkerBlocks(fs.readFileSync(wfPath, 'utf8'));
      const lines = rawWf.split(/\r?\n/);
      const outLines = [];

      let i = 0;
      while (i < lines.length) {
        const stepMatch = lines[i].match(/^(\s*)-\s+(name|run|uses):/);
        if (!stepMatch) {
          outLines.push(lines[i]);
          i++;
          continue;
        }

        // Collect all lines belonging to this step item
        const stepIndent = stepMatch[1].length;
        const stepLines = [lines[i]];
        let j = i + 1;
        while (j < lines.length) {
          const nextLine = lines[j];
          if (nextLine.trim() === '') {
            stepLines.push(nextLine);
            j++;
            continue;
          }
          const indent = nextLine.match(/^(\s*)/)[1].length;
          if (indent < stepIndent || (indent === stepIndent && /^\s*-\s+/.test(nextLine))) {
            break;
          }
          stepLines.push(nextLine);
          j++;
        }

        const stepText = stepLines.join('\n');
        if (isObsoleteText(stepText)) {
          const nameLine = stepLines.find(l => /^\s*-?\s*name:/.test(l));
          const stepLabel = nameLine ? nameLine.split(':').slice(1).join(':').trim() : stepLines[0].trim();
          console.log(`   ✗ Removed GitHub Actions step '${stepLabel}' from ${file}`);
        } else {
          outLines.push(...stepLines);
        }

        i = j;
      }

      const finalWf = outLines.join('\n').replace(/\n{3,}/g, '\n\n').trim() + '\n';
      fs.writeFileSync(wfPath, finalWf, 'utf8');
      console.log(`   ✓ Updated .github/workflows/${file}`);
    }
  }
}

// 6. Rebuild lockfile and node_modules
console.log(`\n${c.yellow}6. Synchronizing npm workspaces & lockfile (npm install)...${c.reset}`);
fs.rmSync('node_modules', { recursive: true, force: true });
fs.rmSync('package-lock.json', { force: true });
execSync('npm install --silent', { stdio: 'inherit' });

// 7. Self-destruct setup script
console.log(`\n${c.yellow}7. Removing setup script...${c.reset}`);
fs.rmSync('scripts/init-project.mjs', { force: true });
fs.rmSync('setup.sh', { force: true });
fs.rmSync(new URL(import.meta.url), { force: true });

// 8. Commit changes
console.log(`\n${c.yellow}8. Creating initial commit...${c.reset}`);
execSync('git add -A', { stdio: 'inherit' });
execSync(`git commit -m "chore: initialize project ${projectName}"`, { stdio: 'inherit' });

console.log(`\n${c.green}====================================================${c.reset}`);
console.log(`${c.green}Setup complete! Project '${projectName}' is ready.${c.reset}`);
console.log(`${c.green}====================================================${c.reset}`);
