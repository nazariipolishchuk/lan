# SI use ledger

Where and how super-intelligence (SI) tools were used, for the "Use of SI" form field (rule C6).
The idea of the solution came from the team; see PLAN.md §3 "Idea provenance".

| Where | Tool | What it did | Human role |
|---|---|---|---|
| Logo base image | Google Gemini | Generated a grain image; our script traced and vectorised it into `logo/final-v3` | Team chose the concept, the shape and the final version. The app and the demo deck show only the text name; where the logo image is shown it must carry an "SI-assisted" mark |
| `docs/PLAN.md` | Claude (Anthropic) | Turned the team's decisions into a written plan on 14 Nov, 02:40–03:00, before the 09:00 start (no code, no data) | Team made every product decision listed in §3 |
| Code, pipeline, data processing | Claude Code (Anthropic) | Writes code, tests and pipeline scripts | Team reviews, tests and decides |
| Ideas adopted from SI | Claude (Anthropic) | Suggested in discussion: reconstructing crop history from yearly greenness curves with a classifier, the timeline-lanes comparison, the climate-scenario switch and the "x of N years" wording, the choice of datasets, stack and validation design (full split in PLAN.md §3) | Team weighed each suggestion and adopted these; the product idea and every other decision are the team's |
| Research | Claude (Anthropic) | Read the challenge rules, terms and data documentation; checked dataset access, licences and formats; looked up rotation rules (Resolution No. 164, extension sources for the USA) and published crop maps | Team set the questions and checked what was used; N supplied local farming knowledge (`LOCAL_KNOWLEDGE.md`) |
| Machine-learning models | Claude Code (Anthropic) | Wrote the training and evaluation scripts for our three classifiers (season group, summer crop names, winter crop names) and the validation reports in `VALIDATION.md` | Team decided what ships: crop names only as hints after the plausibility checks |
| Texts | Claude (Anthropic) | Drafted README, About, the project-page draft, UI texts in English and the Ukrainian translations, and these docs | Team reviewed and edited; N checks the Ukrainian wording |
| Testing | Claude Code (Anthropic) | Unit tests; scripted UI passes in headless Chrome at phone and desktop sizes; a survey of the engine's output on samples of real fields | Team tests by hand on phones; a QA teammate ran an independent data check (`BUGS.md`) |
