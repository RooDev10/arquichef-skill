# Changelog

All notable changes to ArquiChef. Format: [Keep a Changelog](https://keepachangelog.com/), versioning: [SemVer](https://semver.org/).

## [0.2.0] - 2026-11-09

### Changed (breaking spec change: format "2")
- The enterprise layout is now fixed and reproduces the hand-made Verifish sheet 1:1. Specs fill named slots (`frameworks`, `knowledge`, `change`, `organization.units`, `services.external/internal`, `processes.stages/crossCutting`, `dataGovernance`; `core`, `clients`, `itServices`, `thirdParty`; `nodes`, `risks`, `security`, `governance`) instead of free nested boxes, so a spec can no longer produce a different arrangement.
- ArchiMate palette per layer (actors #FEF9C3, strategy #DBD8F0/#C7C2E8, capabilities #F9F5EB/#F3E8D2, business #FDE6C4/#FAD6A5, application #DCE6F7/#C5D6F0, data #D8F3F6/#E6F8FA, technology #DCFCE7/#C6F6D5).
- Lateral layer cells now fill the whole height of their layer row, with no gaps.
- Process stages are drawn as one horizontal flow with `→` marks between stages.
- Risks are a strip of risk → mitigation elements next to the security strip.
- `core/page.mjs` owns the sheet wrapper (`renderSheet`) and the shared base styles.

### Added
- `arquichef migrate <old> <new>` converts format 1 specs; format 1 specs are refused with that hint.
- Tests for the canonical layout, corner icons on every container and element, and the migration.

## [0.1.0] - 2026-11-09

### Added
- Core pipeline: strict spec validation, quality lint, rendering, layout measurement in headless Chrome, PNG export, and README generation.
- `enterprise` diagram type: layered enterprise architecture map without arrows (actors, strategy, capabilities, demand, value, business/application/data/technology layers, up to two cross-cutting laterals).
- Layout diagnostics tied to spec paths: `sheet-overflow`, `overflow-x`, `word-split`, `icon-overlap`.
- Safe output writing with an ownership manifest, a self-contained HTML with a locked-down CSP, and zero dependencies.
- Method guide, quality rubric, starter template, and the Verifish reference example.
- Test suite (`node --test`).
