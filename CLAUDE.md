# CLAUDE.md

This file provides guidance to Claude Code and other AI assistants when working
with code in this repository.

## Repository status

**This repository is currently empty.** As of the last update to this file, the
repository contains only a `.gitkeep` placeholder and an initial
"Initialize repository" commit. There is no source code, build tooling,
dependency manifest, tests, or CI configuration yet.

- **Remote:** `https://github.com/drjinfit-ship-it/jinkim`
- **Default branch:** `main`

Because there is no code to describe, this file establishes conventions to
follow and is intended to be **updated as soon as the codebase takes shape**.
When real structure exists (a language/framework is chosen, source directories
are created, tooling is added), replace the placeholder sections below with
concrete, accurate documentation.

## What to do first when code is added

When the project gains actual content, update this file to document:

1. **Project purpose** — what the application/library does.
2. **Tech stack** — language(s), framework(s), package manager, runtime
   versions.
3. **Directory layout** — where source, tests, config, and assets live.
4. **Build / run / test commands** — the exact commands to install
   dependencies, run the app locally, run tests, and lint/format. Prefer
   copy-pasteable commands.
5. **Architecture** — the main components and how they interact, plus any
   non-obvious design decisions worth knowing before making changes.
6. **Conventions** — naming, formatting, commit style, testing expectations.

Read the actual manifest files (e.g. `package.json`, `pyproject.toml`,
`go.mod`, `Cargo.toml`, `Makefile`) to derive commands rather than guessing.

## Git workflow and conventions

- **Do not commit directly to `main`.** Create a feature branch for changes.
- Keep commits focused with clear, descriptive messages that explain the *why*.
- Push with `git push -u origin <branch-name>`.
- **Do not open a pull request unless explicitly asked.**
- Before deleting or overwriting files you did not create, inspect them first
  and surface anything unexpected instead of proceeding blindly.

## Guidance for AI assistants

- **Verify before asserting.** This repo has almost no content today; do not
  assume the presence of frameworks, scripts, or files. Check the filesystem
  and manifests before acting.
- **Keep this file current.** Whenever you add meaningful structure — a build
  system, a source tree, tests, CI — update the relevant section here in the
  same change so the documentation never drifts from reality.
- **Match the surrounding code** once it exists: mirror its style, naming, and
  patterns rather than importing external conventions.
- **Prefer minimal, reversible changes** and confirm before anything hard to
  undo or outward-facing.
