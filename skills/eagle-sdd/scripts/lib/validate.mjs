/**
 * The eagle-sdd validator, as a library.
 *
 * `validate(root)` returns `{ errors, warnings }` and has no side effects:
 * importing this file does nothing. The command-line front end is
 * ../validate.mjs, which owns the exit code and the reporting.
 *
 * It checks the two documents the workflow produces:
 *   designs/<YYYY-MM-DD>-<slug>-design.md
 *   plans/<YYYY-MM-DD>-<slug>.md
 *
 * Every code is documented in ../../references/plan-format.md.
 */

import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { join, relative, sep, resolve, dirname, basename } from 'node:path';
import { fileURLToPath } from 'node:url';

const DEFAULT_ROOT = 'docs/eagle-sdd';
const DATED_PLAN = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*\.md$/;
const DATED_DESIGN = /^\d{4}-\d{2}-\d{2}-[a-z0-9]+(?:-[a-z0-9]+)*-design\.md$/;

// ---------------------------------------------------------------- utilities

/** HTML comments are guidance, never content. Strip before parsing. */
const stripComments = (text) => text.replace(/<!--[\s\S]*?-->/g, '');

const readIfFile = (path) => {
  try {
    return statSync(path).isFile() ? readFileSync(path, 'utf8') : null;
  } catch {
    return null;
  }
};

/** Markdown files directly inside `path` — both directories are flat. */
const markdownIn = (path) => {
  try {
    return readdirSync(path, { withFileTypes: true })
      .filter((e) => e.isFile() && e.name.toLowerCase().endsWith('.md'))
      .map((e) => e.name)
      .sort();
  } catch {
    return [];
  }
};

const rel = (root, p) => relative(root, p).split(sep).join('/');

// ------------------------------------------------------------ project config

const CONFIG_FILE = 'eagle-sdd.yml';

/**
 * A deliberately small YAML reader: top-level `key: value` pairs, `#` comments.
 * The config holds two scalar keys, so a dependency-free parser that cannot get
 * more complicated than the file it reads beats pulling in a YAML library.
 */
function parseConfig(text) {
  const data = {};
  for (const raw of text.split(/\r?\n/)) {
    const line = raw
      .replace(/^\s*#.*$/, '') // a whole-line comment
      .replace(/\s+#.*$/, '') // a trailing comment
      .trim();
    if (!line) continue;
    const kv = /^([A-Za-z_][\w-]*)\s*:\s*(.*)$/.exec(line);
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
  return data;
}

/** The boolean grammar DSH itself accepts, so the two never disagree. */
const asBoolean = (value) => {
  if (typeof value !== 'string') return null;
  if (/^(true|yes|on|1)$/i.test(value)) return true;
  if (/^(false|no|off|0)$/i.test(value)) return false;
  return null;
};

/**
 * Find `eagle-sdd.yml` at or above `startDir` and turn it into the settings the
 * workflow runs with.
 *
 * The config lives at the project root rather than inside the documents
 * directory, because it is what says where that directory is — a file cannot
 * declare its own location.
 *
 * Returns `{ root, configFile, projectRoot, git, errors }`. With no config the
 * defaults apply and `configFile` is null, which is the state a project is in
 * before its first run.
 */
function resolveProject({ cwd = process.cwd(), explicit } = {}) {
  let dir = resolve(cwd);
  let found = null;
  for (;;) {
    const candidate = join(dir, CONFIG_FILE);
    if (existsSync(candidate)) {
      found = { file: candidate, dir };
      break;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }

  const errors = [];
  const projectRoot = found ? found.dir : resolve(cwd);
  let docs = DEFAULT_ROOT;
  let git = true;

  if (found) {
    const data = parseConfig(readIfFile(found.file) ?? '');
    const here = relative(projectRoot, found.file).split(sep).join('/');

    if (data.docs !== undefined) {
      if (!data.docs) {
        errors.push({ where: here, code: 'F001', msg: '`docs` is empty; give a path or remove the key' });
      } else {
        docs = data.docs;
      }
    }
    if (data.git !== undefined) {
      const parsed = asBoolean(data.git);
      if (parsed === null) {
        errors.push({
          where: here,
          code: 'F001',
          msg: `\`git\` must be true or false, got "${data.git}"`,
        });
      } else {
        git = parsed;
      }
    }
  }

  // An explicit argument still wins, so the config never makes the validator
  // impossible to point somewhere else.
  const root = explicit ? explicit : resolve(projectRoot, docs);

  return {
    root,
    configFile: found ? found.file : null,
    projectRoot,
    git,
    errors,
  };
}

/**
 * Resolve a `**Spec:**` reference. Documents carry a project-relative path, but
 * the validator may be pointed at a tree anywhere, so try every plausible base
 * rather than assuming one.
 */
function resolveSpecRef(root, ref, projectRoot) {
  const cleaned = ref.replace(/`/g, '').trim();
  if (!cleaned) return null;
  const bases = [
    process.cwd(),
    ...(projectRoot ? [projectRoot] : []),
    resolve(root, '..', '..'),
    resolve(root, '..'),
    root,
  ];
  for (const base of bases) {
    const candidate = resolve(base, cleaned);
    if (existsSync(candidate)) return candidate;
  }

  // Last resort: the design of that name, in this tree's designs directory.
  //
  // A project can move its documents directory — that is now a one-line config
  // change — and every plan written before the move still carries the old path.
  // Those pairs are still correct: the slug is the identity, and the link is a
  // courtesy. Accepting the design that is actually sitting next to the plan
  // keeps a moved directory from turning every historical pair into an error.
  const byName = join(root, 'designs', basename(cleaned));
  if (existsSync(byName)) return byName;

  return null;
}

/**
 * Split a plan document into its task blocks.
 *
 * Task headings are `Task N: <title>` at ANY level from `##` to `####` — real
 * plans use both. A non-task heading at or above the current task's level closes
 * it, so a trailing "known risks" section is not absorbed into the last task.
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

// --------------------------------------------------------------- the check

function validate(root, { projectRoot } = {}) {
  const errors = [];
  const warnings = [];
  const err = (where, code, msg) => errors.push({ where, code, msg });
  const warn = (where, code, msg) => warnings.push({ where, code, msg });

  const designsDir = join(root, 'designs');
  const plansDir = join(root, 'plans');

  const designFiles = markdownIn(designsDir);
  const planFiles = markdownIn(plansDir);

  if (!existsSync(root)) {
    err('.', 'F000', `No document tree at ${root}. Pass a path, or run from the repository root.`);
    return { errors, warnings };
  }
  if (designFiles.length === 0 && planFiles.length === 0) {
    err('.', 'F000', `No documents under ${root}/designs or ${root}/plans.`);
    return { errors, warnings };
  }

  // ---- design documents
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

  // ---- plan documents
  const pairedSlugs = new Set();

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

    // The pair is joined on the shared <date>-<slug>, not on this line; the link
    // is expected and a broken one always fails.
    const specLine = /\*\*Spec:\*\*\s*(.+)/.exec(text);
    if (!specLine) {
      warn(here, 'F107', 'Plan document is missing **Spec:**, the link back to its design');
    } else if (!resolveSpecRef(root, specLine[1], projectRoot)) {
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
      // when there is a command to run. A task stating neither is worth flagging,
      // but front-end tasks are routinely covered by a later end-to-end checklist
      // rather than their own, so it is a warning.
      if (!/Expected:|Verify:/i.test(task.body)) {
        warn(here, 'F111', `Task "${task.title}" states no Expected: or Verify:`);
      }
    }
  }

  // ---- across the pair
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

  return { errors, warnings };
}

export { validate, resolveProject, CONFIG_FILE, DEFAULT_ROOT };
