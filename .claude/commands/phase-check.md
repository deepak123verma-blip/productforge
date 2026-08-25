---
description: Read the current phase from CLAUDE.md, list its tasks from the implementation plan, and report done vs outstanding.
---

Run a phase audit:

1. Read the `## Current phase` line in `CLAUDE.md`.
2. Open `docs/06-Implementation-Plan.md` and extract that phase's task table and its **exit test**.
3. For each task, check the repository for evidence it's done (files exist, tests exist and pass, screens render). Be sceptical: a stub file is not "done"; done means the exit-test behaviour works.
4. Report three lists: **Done** (with the evidence), **In progress**, **Not started**.
5. State whether the phase's exit test can currently pass, and what the single next task should be.
6. Flag anything built *ahead* of the current phase — building ahead of the phase order is a violation, not initiative.
