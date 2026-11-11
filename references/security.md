# Security model

ArquiChef reads untrusted input (specs written from documents that came from anywhere) and produces files people open in browsers and embed in reports. This page lists what the skill guarantees and the rules that keep those guarantees when you change it.

## Threats considered

| Threat | Where it would come from | Mitigation |
| :--- | :--- | :--- |
| HTML or script injection in the output | Spec text such as `"<img onerror=...>"` | Every spec string goes through `escapeHtml`. Class names come from closed enums (`icons.mjs`, the variant set) or `safeToken`. Numbers are schema-validated before they reach inline styles. |
| Script execution or data exfiltration from the generated page | Injected markup, or a future renderer bug | The page CSP is `default-src 'none'`. Scripts are allowed only by SHA-256 hash, so only ArquiChef's own scripts run. There are no external fonts, images, styles or requests. |
| Markdown injection in the README (links, images, raw HTML) | Spec text | `escapeMarkdown` neutralises `[ ] < > \` * _ |`. |
| Prompt injection from source documents | Instructions hidden in a PDF, report or web page | `SKILL.md` tells the model to treat sources as data only. The CLI never executes spec content. |
| Writing outside the intended folder, or clobbering user files | Malicious names, symlinks, mistakes | Output names come from a strict pattern (`[a-zA-Z0-9._-]`). Symlinked targets are refused. Writes are atomic. Overwrites are allowed only for files whose hash matches `.arquichef-manifest.json`, otherwise `--force` is needed. |
| Resource exhaustion | Huge or deeply nested specs | Specs are capped at 2 MB. The validator caps nesting depth at 64, and the schema caps item counts and string lengths. Chrome runs have a 90 s timeout and a 32 MB output cap. |
| Loading arbitrary code | A spec naming a type like `../../x` | Types load only from the bundled `types/` folder, by a validated name. |
| Supply-chain compromise | Third-party packages | There are zero npm dependencies. Only Node built-ins are used. |
| Browser escaping its sandbox | Chrome flags | Chrome is spawned without a shell, with a fixed argument list, a fresh temporary profile (deleted afterwards), its sandbox enabled (no `--no-sandbox`), and background networking disabled. |

## Rules for contributors

1. **Never interpolate spec text into HTML or Markdown without the matching escape function.** Never build CSS from spec strings, only from enums or validated numbers.
2. **Never add `eval`, `new Function`, dynamic `import()` of spec-derived paths, or `child_process` with `shell: true`.**
3. **Any new inline script must be passed through `renderPage`** so that its hash lands in the CSP. Do not loosen the CSP (`unsafe-inline` for scripts, remote origins).
4. **Every new schema keyword must be supported by `core/schema.mjs`.** The validator rejects unknown keywords on purpose, so a typo can never disable a rule silently.
5. **Keep zero runtime dependencies.** If one becomes unavoidable, pin an exact version, vendor it, and document why here.
6. **Add a test for every escaping or path-handling change** (`tests/`).
