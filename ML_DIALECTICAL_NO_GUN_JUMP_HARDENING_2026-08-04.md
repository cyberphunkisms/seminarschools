# ML* Dialectical and No-Gun-Jump Hardening

Date: 2026-08-04

## Scope

This is a rule-only correction built from
`ss-site-ml-power-scope-corrected-editable-masters-complete-2026-08-04.zip`.
The later homepage business-card redesign was not used as the base and is not
included in this package.

`index.html` and `public/index.html` remain byte-identical to the input package.
Their SHA-256 is
`8f45321ec3ba715bcbff1e147e451440f3b401145f962b9a20202a3009baa26b`.

## Failure traced

The homepage request contained three different speech-acts in one message:

1. A desired future direction: make the top resemble a business-card banner.
2. A constraint on any later design: use the CV picture.
3. Deliberation: think deeply about what the banner should contain and critique
   the current homepage from every point of view.

The AI isolated the outcome verb from the rest of the message and treated it as
permission to choose and implement the unsettled design. It selected the copy,
hierarchy, calls to action, navigation, mobile behavior, checks, packaging, and
Library delivery. It then presented the completed artifact for ratification.

That was a gun-jump. The request for design thinking and critique established
that the creative and structural choices were still open. The picture was a
constraint. It was not authorization to decide everything else.

## Loopholes found in the existing rules

- The charter said pointing at an error means fix it while PM11 said diagnosis
  is not a command.
- The read-the-speech-act rule treated an isolated action verb as a complete
  directive without testing the whole mixed message.
- The PM11 killswitch ended with same-turn action after dialectical exposition.
- The choice-inside-the-fix rule allowed the AI to make a creative choice and
  request ratification afterward.
- The answer-first mirror distinguished questions from builds without defining
  when a design/build request was sufficiently settled to authorize mutation.

## Hardened boundary

- Thinking, critique, audit, comparison, recommendation, exploration, and
  unsettled design authorize read-only analysis only.
- A message that mixes `make`, `change`, or `use` with `what should`, `which`,
  `how`, `critique`, or `figure it out` remains deliberation for mutable work.
- A settled directive names the action and a sufficiently settled object, or
  explicitly delegates the remaining judgment and implementation together.
- A constraint binds later work and does not authorize that work.
- Ambiguity never expands permission.
- A synthesis candidate remains unbuilt until the author rules.
- Agreement precedes mutation. Post-hoc ratification does not count.
- Stop immediately cancels prior, pending, agent, build, packaging, upload, and
  deployment scope.
- A new failure refines the parent rule. No new subtype was created.

## Canonical and enforcement surfaces

- `CHARTER.txt`
- `polymyth/methodologylist/index.html`
- `polymyth/methodologylist.txt`
- `polymyth/methodologylist-methodology.txt`
- `polymyth/methodologylist-coreplus.txt`
- static methodology and CORE+ HTML editions
- public deployment mirrors
- Meaninglib export and search surfaces
- Mephistodata activation surfaces
- `scripts/apply-ml-dialectical-hardening.js`
- `scripts/verify-ml-dialectical-hardening.js`

The correction refines seven existing entries and the always-loaded charter.
It does not create a new doctrine or a new failure subtype.
