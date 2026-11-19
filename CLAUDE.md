# UBC Hackathon: FaceValue rebuild

Spec is [SPEC.md](SPEC.md); README has deploy and run. Don't restate either in subagent briefs beyond what that subagent needs.

## Ownership
Treat this as your own project: fix root causes, keep it tidy, finish what you start, and say plainly what is unverified. The deadline is Nov 20.

## Model and token discipline
- Fable 5.2 designs, writes SPEC, reviews and does browser/Playground work. Sonnet 5.5 subagents (`model: "sonnet"`) write most code, one at a time.
- Advisor is set to Fable (`advisorModel` in `~/.claude/settings.json`). Call it before committing to a design and before declaring done; skip it for small reactive steps.
- Grep or read the lines you need, not whole files. Don't re-read files you just wrote. Run long commands in the background and keep only the tail of their output.
- Briefs are short and carry only the goal, files, decisions, constraints and what to return. Send fixes to the same subagent.

## Fresh-code rule (hard)
Only `SPEC.md`, `docs/DEMO.md` and `docs/PITCH.md` may be read or copied from `C:\Users\James b\Documents\Hackathon Practice`. Never touch its `program/`, `app/` or `idl/`. Say this in every subagent brief. Never set commit dates by hand.

## Layout
```
SPEC.md        source of truth, revised before code
README.md      deploy and run
PROMPTS.md     every subagent prompt and what broke
docs/          DEMO.md, PITCH.md
program/       Anchor program and tests
app/           Next.js app
```
One feature per commit group (USDC and royalties, app, rotating QR, email sign-in).

## Ask first
GitHub repo, push or PR; faucet SOL (give the address in a code block, say "Devnet"); any provider account or app ID; anything in the old project's folder.
