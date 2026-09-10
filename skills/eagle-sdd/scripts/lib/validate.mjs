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
import { join, relative, sep, resolve } from 'node:path';
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

function validate(root) {
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
    } else if (!resolveSpecRef(root, specLine[1])) {
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

export { validate, DEFAULT_ROOT };
