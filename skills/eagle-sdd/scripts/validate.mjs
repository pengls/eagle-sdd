#!/usr/bin/env node
/**
 * validate.mjs — the command-line front end for the eagle-sdd validator.
 *
 *   node scripts/validate.mjs [root]
 *
 * With no argument the root comes from `eagle-sdd.yml`, found by searching
 * upward from the current directory; without that file it falls back to
 * `docs/eagle-sdd`. An explicit argument always wins, so the config can never
 * make the validator impossible to point somewhere else.
 *
 * Exits 1 on any error, 0 otherwise; warnings never change the exit code.
 *
 * This file runs whenever it is executed. An earlier version kept the logic and
 * the CLI together and decided whether to run by comparing `import.meta.url`
 * against `process.argv[1]`. Node resolves symlinks for the former and not the
 * latter, and this skill is normally installed as a junction into a harness's
 * skill root — so through the installed path the comparison said "imported",
 * ran nothing, and exited 0. On a deliberately broken tree that is a silent
 * false pass, which is worse than any error it could have printed.
 *
 * The check is therefore gone rather than fixed, not merely corrected: the
 * logic lives in ./lib/validate.mjs where importing has no side effects, and
 * this file has no condition left to get wrong.
 */

import { relative } from 'node:path';
import { validate, resolveProject } from './lib/validate.mjs';

function main(argv) {
  if (argv.includes('--help') || argv.includes('-h')) {
    console.log('Usage: node scripts/validate.mjs [root]');
    console.log('  root  overrides the `docs` setting in eagle-sdd.yml');
    return 0;
  }

  const explicit = argv.find((a) => !a.startsWith('-'));
  const project = resolveProject({ explicit });

  // Config problems are reported alongside the document problems: a config the
  // validator silently ignores is a config that gets edited forever with no
  // effect, which is worse than being told it is wrong.
  const { errors, warnings } = validate(project.root, { projectRoot: project.projectRoot });
  errors.unshift(...project.errors);

  const shown = project.configFile
    ? relative(process.cwd(), project.configFile).split('\\').join('/')
    : null;

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
    console.log(`\nFAIL  ${project.root}`);
    return 1;
  }

  const suffix = warnings.length ? ` (${warnings.length} warning(s))` : '';
  const from = shown && !explicit ? `  [${shown}]` : '';
  console.log(`\nOK    ${project.root}${suffix}${from}`);
  return 0;
}

process.exit(main(process.argv.slice(2)));
