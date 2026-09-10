#!/usr/bin/env node
/**
 * validate.mjs — zero-dependency structural validator for the eagle-sdd
 * spec-driven-development workflow.
 *
 *   node scripts/validate.mjs [root]
 *
 * `root` defaults to `docs/eagle-sdd` and is resolved against the current
 * working directory, so run this from the repository root.
 *
 * Exits 1 when any error is reported, 0 otherwise. Warnings never change the
 * exit code.
 *
 * The error codes this reports are documented in ../references/artifacts.md.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep, resolve, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = 'docs/eagle-sdd';
const DELTA_SECTIONS = ['ADDED', 'MODIFIED', 'REMOVED', 'RENAMED'];
const KEBAB = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const TASK_ID = /^\d+\.\d+$/;

// ---------------------------------------------------------------- utilities

/** HTML comments are guidance, never content. Strip before parsing. */
const stripComments = (text) => text.replace(/<!--[\s\S]*?-->/g, '');

const norm = (s) => s.replace(/\s+/g, ' ').trim().toLowerCase();

const readIfFile = (path) => {
  try {
    return statSync(path).isFile() ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
};

const dirsIn = (path) => {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((e) => e.isDirectory())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
};

const filesIn = (path) => {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((e) => e.isFile())
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
};

const rel = (root, p) => relative(root, p).split(sep).join('/');

/** Minimal YAML frontmatter reader: flat `key: value` pairs only. */
function parseFrontmatter(text) {
  const m = /^---\r?\n([\s\S]*?)\r?\n---\r?\n?/.exec(text);
  if (!m) return { data: {}, body: text, present: false };
  const data = {};
  for (const line of m[1].split(/\r?\n/)) {
    if (!line.trim() || line.trim().startsWith('#')) continue;
    const kv = /^([A-Za-z0-9_-]+)\s*:\s*(.*)$/.exec(line);
    if (!kv) continue;
    let value = kv[2].trim();
    if (
      (value.startsWith('"') && value.endsWith('"') && value.length > 1) ||
      (value.startsWith("'") && value.endsWith("'") && value.length > 1)
    ) {
      value = value.slice(1, -1);
    }
    data[kv[1]] = value;
  }
  return { data, body: text.slice(m[0].length), present: true };
}

const isTrue = (v) => v === true || /^(true|yes|on|1)$/i.test(String(v ?? ''));

/** Collect `- \`path\`` bullets under a `### <title>` subsection of a section. */
function bulletsUnder(text, sectionTitle, subTitle) {
  const lines = stripComments(text).split(/\r?\n/);
  const found = [];
  let inSection = false;
  let inSub = false;
  for (const line of lines) {
    const h2 = /^##\s+(.+?)\s*$/.exec(line);
    if (h2) {
      inSection = norm(h2[1]) === norm(sectionTitle);
      inSub = false;
      continue;
    }
    const h3 = /^###\s+(.+?)\s*$/.exec(line);
    if (h3) {
      inSub = inSection && norm(h3[1]) === norm(subTitle);
      continue;
    }
    if (!inSub) continue;
    const bullet = /^\s*[-*]\s+(.+?)\s*$/.exec(line);
    if (!bullet) continue;
    const item = bullet[1];
    const ticked = /^`([^`]+)`/.exec(item);
    const value = (ticked ? ticked[1] : item).trim();
    if (value) found.push(value);
  }
  return found;
}

// ------------------------------------------------------------ spec parsing

/**
 * Parse a spec file into requirements.
 * Returns { purpose, sections: { ADDED: [req], ... }, errors: [{code, msg}] }
 * where req = { name, text, scenarios: [name] }.
 *
 * mode 'delta'     — legal `##` sections are the four delta operations.
 * mode 'canonical' — `## Purpose` / `## Requirements`; requirements may sit
 *                    anywhere at `###` level. All requirements land in ADDED.
 */
function parseSpec(text, mode = 'delta') {
  const isDelta = mode === 'delta';
  const errors = [];
  const purpose = (() => {
    const lines = stripComments(text).split(/\r?\n/);
    const i = lines.findIndex((l) => /^##\s+Purpose\s*$/.test(l));
    if (i === -1) return null;
    const buf = [];
    for (let j = i + 1; j < lines.length; j++) {
      if (/^#{1,2}\s+/.test(lines[j])) break;
      buf.push(lines[j]);
    }
    return buf.join('\n').trim();
  })();

  const sections = {};
  const seenSection = new Set();
  let current = null; // current section key, null outside a delta section
  let req = null;
  let scenario = null;

  const closeReq = () => {
    if (!req) return;
    if (req.scenarios.length === 0 && isDelta) {
      errors.push({ code: 'D006', msg: `Requirement "${req.name}" has no scenarios` });
    }
    if (!/\b(SHALL|MUST)\b/.test(req.text)) {
      errors.push({
        code: 'D008',
        msg: `Requirement "${req.name}" text contains no SHALL or MUST`,
      });
    }
    sections[current].requirements.push(req);
    req = null;
    scenario = null;
  };
  const closeSection = () => {
    if (current) closeReq();
    current = null;
  };
  for (const key of DELTA_SECTIONS) sections[key] = { requirements: [], renames: [] };

  // Canonical specs have no delta sections; park their requirements in ADDED.
  current = isDelta ? null : 'ADDED';

  for (const raw of stripComments(text).split(/\r?\n/)) {
    // Requirement and scenario headers are matched at ANY hash depth, before
    // the section-header rule, so a wrong-depth header reports the depth
    // problem rather than masquerading as an illegal `##` section.
    const anyReq = /^(#+)\s*Requirement\s*:/i.exec(raw);
    if (anyReq) {
      if (anyReq[1].length !== 3) {
        errors.push({
          code: 'D004',
          msg: `Requirement header uses ${anyReq[1].length} hashes; exactly 3 required: ${raw.trim()}`,
        });
        continue;
      }
      if (!current) {
        errors.push({
          code: 'D004',
          msg: `Requirement outside a delta section: ${raw.trim()}`,
        });
        continue;
      }
      closeReq();
      req = { name: raw.replace(/^###\s*Requirement\s*:\s*/i, '').trim(), text: '', scenarios: [] };
      continue;
    }

    const anyScen = /^(#+)\s*Scenario\s*:/i.exec(raw);
    if (anyScen) {
      if (anyScen[1].length !== 4) {
        errors.push({
          code: 'D005',
          msg: `Scenario header uses ${anyScen[1].length} hashes; exactly 4 required: ${raw.trim()}`,
        });
        continue;
      }
      if (!req) {
        errors.push({ code: 'D005', msg: `Scenario outside a requirement: ${raw.trim()}` });
        continue;
      }
      scenario = raw.replace(/^####\s*Scenario\s*:\s*/i, '').trim();
      req.scenarios.push(scenario);
      continue;
    }

    const h2 = /^##\s+(.+?)\s*$/.exec(raw);
    if (h2) {
      if (!isDelta) {
        closeReq();
        continue;
      }
      closeSection();
      const title = h2[1].trim();
      if (/^Purpose$/i.test(title)) continue;
      const m = /^(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements$/i.exec(title);
      if (!m) {
        errors.push({ code: 'D003', msg: `Illegal section header "## ${title}"` });
        continue;
      }
      const key = m[1].toUpperCase();
      if (seenSection.has(key)) {
        errors.push({ code: 'D003', msg: `Section "## ${title}" appears more than once` });
        continue;
      }
      seenSection.add(key);
      current = key;
      continue;
    }

    if (req && !scenario) req.text += raw + '\n';
  }
  closeSection();

  // RENAMED bullets live in the RENAMED section, not as requirements.
  let inRenamed = false;
  for (const raw of stripComments(text).split(/\r?\n/)) {
    const h2 = /^##\s+(.+?)\s*$/.exec(raw);
    if (h2) {
      inRenamed = /^RENAMED\s+Requirements$/i.test(h2[1].trim());
      continue;
    }
    if (!inRenamed) continue;
    const b = /^\s*[-*]\s+(.+?)\s*$/.exec(raw);
    if (!b) continue;
    const arrow = /^`?([^`→]+?)`?\s*(?:→|->)\s*`?([^`]+?)`?$/.exec(b[1].trim());
    if (!arrow) {
      errors.push({ code: 'D003', msg: `Malformed RENAMED entry: ${b[1].trim()}` });
      continue;
    }
    sections.RENAMED.renames.push({ from: arrow[1].trim(), to: arrow[2].trim() });
  }

  // Duplicate requirement names inside a section, and across sections.
  for (const key of DELTA_SECTIONS) {
    const seen = new Set();
    for (const r of sections[key].requirements) {
      const n = norm(r.name);
      if (seen.has(n)) {
        errors.push({ code: 'D007', msg: `Duplicate requirement "${r.name}" in ## ${key}` });
      }
      seen.add(n);
    }
  }
  const across = new Map();
  for (const key of DELTA_SECTIONS) {
    for (const r of sections[key].requirements) {
      const n = norm(r.name);
      if (across.has(n) && across.get(n) !== key) {
        errors.push({
          code: 'D007',
          msg: `Requirement "${r.name}" appears in both ## ${across.get(n)} and ## ${key}`,
        });
      } else {
        across.set(n, key);
      }
    }
  }

  return { purpose, sections, errors };
}

/** Removed requirements must carry **Reason** and **Migration**. */
function checkRemovedAnnotations(text) {
  const errors = [];
  const lines = stripComments(text).split(/\r?\n/);
  let current = null;
  let buf = [];
  const flush = () => {
    if (!current) return;
    const body = buf.join('\n');
    if (!/\*\*Reason\*\*\s*:/.test(body)) {
      errors.push({ code: 'D012', msg: `REMOVED "${current}" has no **Reason**` });
    }
    if (!/\*\*Migration\*\*\s*:/.test(body)) {
      errors.push({ code: 'D012', msg: `REMOVED "${current}" has no **Migration**` });
    }
  };
  let inRemoved = false;
  for (const raw of lines) {
    const h2 = /^##\s+(.+?)\s*$/.exec(raw);
    if (h2) {
      flush();
      current = null;
      buf = [];
      inRemoved = /^REMOVED\s+Requirements$/i.test(h2[1].trim());
      continue;
    }
    if (!inRemoved) continue;
    const h3 = /^###\s*Requirement\s*:\s*(.+?)\s*$/i.exec(raw);
    if (h3) {
      flush();
      current = h3[1].trim();
      buf = [];
      continue;
    }
    if (current) buf.push(raw);
  }
  flush();
  return errors;
}

// ----------------------------------------------------------- task parsing

function parseTasks(text) {
  const errors = [];
  const warnings = [];
  const tasks = [];
  const lines = stripComments(text).split(/\r?\n/);
  let inGroup = false;
  let current = null;

  const flush = () => {
    if (!current) return;
    for (const tag of ['Covers', 'Depends', 'Verify']) {
      if (!current[tag.toLowerCase()]) {
        errors.push({ code: 'T003', msg: `Task ${current.id} is missing "${tag}:"` });
      }
    }
    tasks.push(current);
    current = null;
  };

  for (const raw of lines) {
    if (/^##\s+\d+\.\s*/.test(raw)) {
      flush();
      inGroup = true;
      continue;
    }
    if (/^##\s+/.test(raw)) {
      flush();
      inGroup = false;
      continue;
    }

    const task = /^-\s*\[([ xX])\]\s*(\d+\.\d+)\s+(.+?)\s*$/.exec(raw);
    if (task) {
      flush();
      current = { id: task[2], done: task[1] !== ' ', desc: task[3].trim().replace(/\s+$/, '') };
      continue;
    }

    if (inGroup && /^[-*]\s+/.test(raw)) {
      errors.push({ code: 'T002', msg: `Not a checkbox: ${raw.trim()}` });
      continue;
    }

    const tag = /^\s{4,}(Covers|Depends|Verify)\s*:\s*(.+?)\s*$/.exec(raw);
    if (tag && current) {
      current[tag[1].toLowerCase()] = tag[2].trim();
    }
  }
  flush();

  if (tasks.length === 0) warnings.push({ code: 'T000', msg: 'tasks.md contains no tasks' });
  for (const t of tasks) {
    if (t.covers && !/^none$/i.test(t.covers)) {
      t.coverList = t.covers.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      t.coverList = [];
    }
    if (t.depends && !/^none$/i.test(t.depends)) {
      t.dependsList = t.depends.split(',').map((s) => s.trim()).filter(Boolean);
    } else {
      t.dependsList = [];
    }
  }
  return { tasks, errors, warnings };
}

// ------------------------------------------------------ plan-format checks

const DATED_PLAN = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const DATED_DESIGN = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*-design\.md$/;

/** The `format:` key of config.yaml, or null when absent/unreadable. */
function readConfigFormat(root) {
  const text = readIfFile(join(root, 'config.yaml'));
  if (text === null) return null;
  const m = /^\s*format\s*:\s*["']?([A-Za-z_-]+)["']?\s*$/m.exec(text);
  return m ? m[1].toLowerCase() : null;
}

/**
 * Resolve a `**Spec:**` reference. Documents carry a repository-relative path,
 * but the validator may be pointed at a tree anywhere, so try the plausible
 * bases rather than assuming one.
 */
function resolveSpecRef(root, ref) {
  const cleaned = ref.replace(/`/g, '').trim();
  if (!cleaned) return null;
  const candidates = [
    resolve(process.cwd(), cleaned),
    resolve(root, '..', '..', cleaned),
    resolve(root, '..', cleaned),
    resolve(root, cleaned),
  ];
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

/**
 * Split a plan document into its task blocks.
 *
 * Task headings are `Task N: <title>` at ANY level from `##` to `####` — real
 * plans use both `##` and `###`. A non-task heading at or above the current
 * task's level closes it, so a trailing "known risks" section is not absorbed
 * into the last task.
 */
function splitTasks(text) {
  const tasks = [];
  let current = null;
  for (const line of text.split(/\r?\n/)) {
    const heading = /^(#{2,4})\s+(.*)$/.exec(line);
    if (heading) {
      const level = heading[1].length;
      if (/^Task\b/i.test(heading[2])) {
        if (current) tasks.push(current);
        current = {
          level,
          title: heading[2].replace(/^Task\b\s*\d*\s*:?\s*/i, '').trim() || '(untitled)',
          // A string, not an array: RegExp.test() coerces an array by joining on
          // commas, which erases every line boundary and defeats `^`-anchored checks.
          body: '',
        };
        continue;
      }
      if (current && level <= current.level) {
        tasks.push(current);
        current = null;
        continue;
      }
    }
    if (current) current.body += line + '\n';
  }
  if (current) tasks.push(current);
  return tasks;
}

/**
 * Validate the `plan` document set: designs/<date>-<slug>-design.md paired with
 * plans/<date>-<slug>.md. Both directories are optional — a repository using
 * only the `spec` format has neither, and that is not an error.
 */
function validatePlanFormat(root, err, warn) {
  const designsDir = join(root, 'designs');
  const plansDir = join(root, 'plans');
  const schemaDir = join(root, 'specs');

  const designFiles = filesIn(designsDir).filter((f) => f.toLowerCase().endsWith('.md'));
  const planFiles = filesIn(plansDir).filter((f) => f.toLowerCase().endsWith('.md'));
  const pairedSlugs = new Set();

  for (const name of designFiles) {
    const file = join(designsDir, name);
    const here = rel(root, file);
    if (!DATED_DESIGN.test(name)) {
      err(here, 'F101', `Design filename should be <YYYY-MM-DD>-<slug>-design.md, got "${name}"`);
    }
    const text = stripComments(readIfFile(file) ?? '');
    if (!/^#\s+\S/m.test(text)) {
      err(here, 'F121', 'Design document has no "# " title');
    }
    const sections = (text.match(/^##\s+\S/gm) || []).length;
    if (sections < 3) {
      err(here, 'F122', `Design document has ${sections} "## " section(s); at least 3 expected`);
    }
  }

  for (const name of planFiles) {
    const file = join(plansDir, name);
    const here = rel(root, file);
    if (!DATED_PLAN.test(name)) {
      err(here, 'F101', `Plan filename should be <YYYY-MM-DD>-<slug>.md, got "${name}"`);
    }
    const text = stripComments(readIfFile(file) ?? '');

    if (!/^#\s+\S/m.test(text)) err(here, 'F105', 'Plan document has no "# " title');
    if (!/\*\*Goal:\*\*/.test(text)) err(here, 'F106', 'Plan document is missing **Goal:**');
    if (!/\*\*Architecture:\*\*/.test(text)) {
      warn(here, 'F112', 'Plan document is missing **Architecture:**');
    }

    // **Spec:** is a convenience link, not the join key. Plenty of real plans
    // omit it, so the pair is identified by the shared <date>-<slug> and the
    // link is only checked when it is there.
    const specLine = /\*\*Spec:\*\*\s*(.+)/.exec(text);
    if (specLine && !resolveSpecRef(root, specLine[1])) {
      err(here, 'F108', `**Spec:** does not resolve to an existing file: ${specLine[1].trim()}`);
    }
    pairedSlugs.add(name.replace(/\.md$/i, '').toLowerCase());

    const tasks = splitTasks(text);
    if (tasks.length === 0) {
      err(here, 'F109', 'Plan document has no "Task N:" heading');
    }
    for (const task of tasks) {
      if (!/^\s*-\s*\[[ xX]\]/m.test(task.body)) {
        err(here, 'F110', `Task "${task.title}" has no "- [ ]" step`);
      }
      // Hand-written plans state the observation in Expected: and only add Run:
      // when there is a command to run. A task that states neither is worth
      // flagging, but it is a warning rather than an error: front-end tasks are
      // routinely covered by a later end-to-end checklist rather than their own.
      if (!/Expected:|Verify:/i.test(task.body)) {
        warn(here, 'F111', `Task "${task.title}" states no Expected: or Verify:`);
      }
    }
  }

  for (const name of designFiles) {
    const slug = name.replace(/-design\.md$/i, '').toLowerCase();
    if (!pairedSlugs.has(slug)) {
      warn(
        rel(root, join(designsDir, name)),
        'F130',
        'Design document with no plan document of the same slug',
      );
    }
  }

  // A repository can migrate between formats, so a mix is a warning, not a
  // failure — but two live descriptions of the system is worth being told about.
  const hasSpecFormat =
    dirsIn(plansDir).some((d) => d !== 'archive') || dirsIn(schemaDir).length > 0;
  const hasPlanFormat = planFiles.length > 0 || designFiles.length > 0;
  if (hasSpecFormat && hasPlanFormat) {
    warn('.', 'F131', 'Repository contains both the spec and the plan document sets');
  }

  const declared = readConfigFormat(root);
  if (declared === 'spec' && hasPlanFormat) {
    warn(
      rel(root, join(root, 'config.yaml')),
      'F132',
      'config.yaml declares format: spec, but plan-format documents exist',
    );
  }
  if (declared === 'plan' && hasSpecFormat) {
    warn(
      rel(root, join(root, 'config.yaml')),
      'F132',
      'config.yaml declares format: plan, but spec-format documents exist',
    );
  }
}

// --------------------------------------------------------------- the check

function validate(root) {
  const errors = [];
  const warnings = [];
  const err = (where, code, msg) => errors.push({ where, code, msg });
  const warn = (where, code, msg) => warnings.push({ where, code, msg });

  const specsDir = join(root, 'specs');
  const plansDir = join(root, 'plans');

  // Canonical specs: capability path -> Map(normalized requirement -> req)
  const canonical = new Map();
  const canonicalCaps = [];
  const collectCanonical = (dir, prefix) => {
    for (const name of dirsIn(dir)) {
      const capPath = prefix ? `${prefix}/${name}` : name;
      const file = join(dir, name, 'spec.md');
      const text = readIfFile(file);
      if (text === null) {
        collectCanonical(join(dir, name), capPath);
        continue;
      }
      const here = rel(root, file);
      const parsed = parseSpec(text, 'canonical');
      for (const e of parsed.errors) err(here, e.code, e.msg);
      const reqs = new Map();
      for (const key of DELTA_SECTIONS) {
        for (const r of parsed.sections[key].requirements) reqs.set(norm(r.name), r);
      }
      if (/^##\s+(ADDED|MODIFIED|REMOVED|RENAMED)\s+Requirements\s*$/im.test(stripComments(text))) {
        err(here, 'C001', 'Canonical spec contains a delta section header');
      }
      for (const r of reqs.values()) {
        if (r.scenarios.length === 0) {
          err(here, 'C002', `Canonical requirement "${r.name}" has no scenarios`);
        }
      }
      canonical.set(capPath, reqs);
      canonicalCaps.push(capPath);
      collectCanonical(join(dir, name), capPath);
    }
  };
  if (existsSync(specsDir)) collectCanonical(specsDir, '');

  const allCanonicalNames = new Set();
  for (const reqs of canonical.values()) for (const n of reqs.keys()) allCanonicalNames.add(n);

  // Plans
  const planNames = dirsIn(plansDir).filter((n) => n !== 'archive');
  if (!existsSync(root)) {
    console.log(`No ${root}/ directory found — nothing to validate.`);
    return { errors, warnings };
  }

  for (const planName of planNames) {
    const planDir = join(plansDir, planName);
    const where = rel(root, planDir);

    // ---- proposal
    const proposalText = readIfFile(join(planDir, 'proposal.md'));
    if (proposalText === null) {
      err(where, 'P001', 'No proposal.md');
      continue;
    }
    const { data } = parseFrontmatter(proposalText);
    if (!data.change) {
      err(where, 'P002', 'proposal.md frontmatter is missing the "change" key');
    } else if (data.change !== planName) {
      err(where, 'P003', `frontmatter change "${data.change}" does not match directory "${planName}"`);
    }
    const skipSpecs = isTrue(data.skip_specs);
    const declared = [
      ...bulletsUnder(proposalText, 'Capabilities', 'New Capabilities'),
      ...bulletsUnder(proposalText, 'Capabilities', 'Modified Capabilities'),
    ];
    const declaredSet = new Set(declared);
    for (const cap of declared) {
      if (!cap.split('/').every((seg) => KEBAB.test(seg))) {
        err(where, 'P006', `Capability path is not kebab-case: ${cap}`);
      }
    }
    if (declared.length === 0 && !skipSpecs) {
      err(
        where,
        'P004',
        'No capabilities declared. If no observable behavior changes, set skip_specs: true.',
      );
    }
    if (skipSpecs && declared.length > 0) {
      err(where, 'P005', 'skip_specs: true but capabilities are declared');
    }

    // ---- deltas
    const deltaDir = join(planDir, 'specs');
    const deltaCaps = [];
    const collectDeltas = (dir, prefix) => {
      for (const name of dirsIn(dir)) {
        const capPath = prefix ? `${prefix}/${name}` : name;
        if (readIfFile(join(dir, name, 'spec.md')) !== null) deltaCaps.push(capPath);
        else collectDeltas(join(dir, name), capPath);
      }
    };
    if (existsSync(deltaDir)) collectDeltas(deltaDir, '');
    if (skipSpecs && deltaCaps.length > 0) {
      err(where, 'P005', `skip_specs: true but delta specs exist: ${deltaCaps.join(', ')}`);
    }

    // Normalized requirement name -> display name, for requirements this
    // change introduces or renames to.
    const changedNames = new Map();

    for (const cap of declared) {
      if (!deltaCaps.includes(cap)) {
        err(where, 'D001', `Declared capability "${cap}" has no delta at specs/${cap}/spec.md`);
      }
    }
    for (const cap of deltaCaps) {
      if (!declaredSet.has(cap)) {
        err(where, 'D002', `Delta exists for undeclared capability "${cap}"`);
      }
    }

    for (const cap of deltaCaps) {
      const file = join(deltaDir, cap, 'spec.md');
      const here = rel(root, file);
      const text = readIfFile(file);
      const parsed = parseSpec(text, 'delta');
      for (const e of parsed.errors) err(here, e.code, e.msg);
      for (const e of checkRemovedAnnotations(text)) err(here, e.code, e.msg);

      const canon = canonical.get(cap);
      const isNew = !canon;

      if (isNew && (!parsed.purpose || parsed.purpose.length < 50)) {
        err(here, 'D009', 'New capability needs a "## Purpose" of at least 50 characters');
      }

      const added = parsed.sections.ADDED.requirements;
      const modified = parsed.sections.MODIFIED.requirements;
      const removed = parsed.sections.REMOVED.requirements;
      const renames = parsed.sections.RENAMED.renames;

      if (added.length + modified.length + removed.length + renames.length === 0) {
        warn(here, 'D000', 'Delta declares no changes');
      }

      for (const r of added) changedNames.set(norm(r.name), r.name);

      for (const r of modified) {
        if (!canon) {
          err(here, 'D010', `MODIFIED "${r.name}" but capability "${cap}" has no canonical spec`);
          continue;
        }
        const existing = canon.get(norm(r.name));
        if (!existing) {
          err(here, 'D010', `MODIFIED "${r.name}" is not in the canonical spec`);
          continue;
        }
        const after = new Set(r.scenarios.map(norm));
        for (const s of existing.scenarios) {
          if (!after.has(norm(s))) {
            err(
              here,
              'D011',
              `MODIFIED "${r.name}" drops scenario "${s}", still present in the canonical spec`,
            );
          }
        }
        changedNames.set(norm(r.name), r.name);
      }

      for (const r of removed) {
        if (!canon || !canon.has(norm(r.name))) {
          err(here, 'D012', `REMOVED "${r.name}" is not in the canonical spec`);
        }
      }

      for (const { from, to } of renames) {
        if (!canon || !canon.has(norm(from))) {
          err(here, 'D013', `RENAMED source "${from}" is not in the canonical spec`);
        }
        const target = canon ? canon.get(norm(to)) : null;
        if (target && norm(to) !== norm(from)) {
          err(here, 'D013', `RENAMED target "${to}" already exists in the canonical spec`);
        }
        changedNames.set(norm(to), to);
      }
    }

    // ---- tasks
    const tasksText = readIfFile(join(planDir, 'tasks.md'));
    if (tasksText === null) {
      if (!skipSpecs) err(where, 'T001', 'No tasks.md');
      continue;
    }
    const tasksHere = rel(root, join(planDir, 'tasks.md'));
    const { tasks, errors: tErrs, warnings: tWarns } = parseTasks(tasksText);
    for (const e of tErrs) err(tasksHere, e.code, e.msg);
    for (const w of tWarns) warn(tasksHere, w.code, w.msg);

    const byId = new Map(tasks.map((t) => [t.id, t]));
    const covered = new Set();

    for (const t of tasks) {
      for (const name of t.coverList) {
        const n = norm(name);
        if (changedNames.has(n)) {
          covered.add(n);
        } else if (allCanonicalNames.has(n)) {
          warn(tasksHere, 'T008', `Task ${t.id} covers "${name}", which this change does not alter`);
        } else {
          err(tasksHere, 'T004', `Task ${t.id} covers "${name}", which resolves to no requirement`);
        }
      }
      for (const dep of t.dependsList) {
        if (!TASK_ID.test(dep)) {
          err(tasksHere, 'T005', `Task ${t.id} depends on "${dep}", which is not a task id`);
        } else if (!byId.has(dep)) {
          err(tasksHere, 'T005', `Task ${t.id} depends on "${dep}", which does not exist`);
        }
      }
    }

    // Cycles
    const state = new Map();
    const visit = (id, stack) => {
      const s = state.get(id);
      if (s === 'done') return;
      if (s === 'open') {
        err(tasksHere, 'T006', `Dependency cycle: ${[...stack, id].join(' -> ')}`);
        return;
      }
      state.set(id, 'open');
      for (const dep of byId.get(id)?.dependsList ?? []) {
        if (byId.has(dep)) visit(dep, [...stack, id]);
      }
      state.set(id, 'done');
    };
    for (const t of tasks) visit(t.id, []);

    // Coverage
    for (const [n, display] of changedNames) {
      if (!covered.has(n)) {
        err(tasksHere, 'T007', `Requirement "${display}" is covered by no task`);
      }
    }
  }

  validatePlanFormat(root, err, warn);

  return { errors, warnings };
}

// -------------------------------------------------------------------- main

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: node scripts/validate.mjs [root]');
    console.log(`  root  defaults to "${DEFAULT_ROOT}", relative to the current directory`);
    return 0;
  }

  const root = (argv.find((a) => !a.startsWith('-')) ?? DEFAULT_ROOT).replace(/[\\/]+$/, '');
  const { errors, warnings } = validate(root);

  const group = (items) => {
    const byWhere = new Map();
    for (const it of items) {
      if (!byWhere.has(it.where)) byWhere.set(it.where, []);
      byWhere.get(it.where).push(it);
    }
    for (const [where, list] of [...byWhere].sort()) {
      console.log(`\n${where}`);
      for (const it of list.sort((a, b) => a.code.localeCompare(b.code))) {
        console.log(`  ${it.code}  ${it.msg}`);
      }
    }
  };

  if (warnings.length) {
    console.log(`\n--- ${warnings.length} warning(s) ---`);
    group(warnings);
  }

  if (errors.length) {
    console.log(`\n--- ${errors.length} error(s) ---`);
    group(errors);
    console.log(`\nFAIL  ${root}`);
    return 1;
  }

  console.log(`\nOK    ${root}${warnings.length ? ` (${warnings.length} warning(s))` : ''}`);
  return 0;
}

/** True when this file is the process entry point, not an import. */
function isEntryPoint() {
  const argv1 = process.argv[1];
  if (!argv1) return false;
  try {
    const self = fileURLToPath(import.meta.url).replace(/\\/g, '/').toLowerCase();
    const entry = resolve(argv1).replace(/\\/g, '/').toLowerCase();
    return self === entry;
  } catch {
    return false;
  }
}

export { validate };

if (isEntryPoint()) process.exit(main(process.argv.slice(2)));
