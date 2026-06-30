# Changelog

## [10.0.1] - 2026-06-30

### Changed
- AGENTS.md: added rule to bump `package.json` version after every code change (patch for fixes, minor for features, major only on explicit request)

## [10.0.0] - 2026-06-30

### Changed
- Bumped version to 10.0.0 — marks Marlowe's first major independent release as a Nostr-native fork of Shakespeare

## [9.14.0] - 2026-06-30

### Added
- **NostrReadCustomNipTool**: AI agents can now read kind 30817 custom NIPs published on Nostr by passing an `naddr1` bech32 or a `pubkey:d-tag` pair
- **ReadBipTool**: AI agents can read Bitcoin BIP (Bitcoin Improvement Proposal) specifications from GitHub (`bitcoin/bips`)
- **ReadBoltTool**: AI agents can read Lightning Network BOLT (Basis of Lightning Technology) specifications from GitHub (`lightning/bolts`)
- **ReadBudTool**: AI agents can read Blossom BUD (Blossom Upgrade Document) specifications from GitHub (`hzrd149/blossom/buds`)
- **ReadMipTool**: AI agents can read Marmot MIP (Marmot Implementation Proposal) specifications from GitHub (`marmot-protocol/marmot`)
- **ReadNutTool**: AI agents can read Cashu NUT (Notation, Usage, and Terminology) specifications from GitHub (`cashubtc/nuts`)
- **Marlowe fork**: Full rebrand from Shakespeare — teal/amber color scheme, Marlowe logo (teal quill), updated system prompt, new `marlowe-badge.svg` for "Edit with Marlowe" buttons
- `public/llms.txt` — LLM-friendly project documentation following the llms.txt spec
- Version number displayed in the homepage header, auto-updating from `package.json`
- Status bars in project view showing storage usage and AI context window fill
- Root site support for nsite deployment (NIP-5A kind 15128) alongside named sites (kind 35128)
- Additional Instructions field in AI Settings — user-controlled instructions appended to every system prompt, never overwritten by updates
- `wss://purplepag.es` added as default read relay for reliable Nostr profile resolution
- Persistent storage request on Android to reduce risk of IndexedDB eviction

### Changed
- System prompt rebranded: AI introduces itself as Marlowe, describes the platform as a Shakespeare fork, removed "best coding platform" claim, softened the "NEVER suggest other tools" directive
- Deploy popover and provider config dialogs now cap height with scroll so buttons are always visible on small screens
- Showcase author profiles now use `useAuthor` per card with `retry: 3` (matching Shakespeare) and `JSON.parse` instead of `NSchema.metadata()` for Zod v3 compatibility

### Fixed
- `updateField` TDZ crash in AppDialog when opening projects
- `toJSONSchema()` TypeError — replaced with `zod-to-json-schema` for Zod v3 compatibility
- NIP-07 signer extension "Receiving end does not exist" error on first deploy — now retries automatically
- Static OG meta tags added to `index.html` so social media scrapers see correct og:image
- VFS image display in code view (ENOENT) — now constructs absolute path correctly
- Browser tab title no longer flickers back to "Shakespeare" — removed per-page `useSeoMeta` overrides
- Showcase "Anonymous" author — fixed relay query and Zod parsing

## [9.14.0] - 2026-06-05

### Added
- Log in with a remote signer by scanning a QR code — connect your NIP-46 mobile signer to Shakespeare without copying and pasting bunker strings

### Changed
- Unified the login dialog into a single, streamlined experience across sign-in methods

### Fixed
- Custom fonts now load correctly in previews instead of triggering a runtime error
- Builds no longer fail when a project depends on types-only packages
- Resolved all known security vulnerabilities in dependencies

## [9.13.2] - 2026-04-29

### Changed
- Preview pane now uses the new iframe.diy sandboxing service for a faster, more reliable preview experience

## [9.13.1] - 2026-04-27

### Changed
- AI agents now run commands through a real POSIX-style shell with proper quoting, pipes, redirects, and glob expansion, making multi-step project edits more reliable
- Overhauled the built-in `git` commands used by AI agents, adding `ls-files`, `merge`, `mv`, `restore`, `rev-parse`, `revert`, `rm`, and `switch` alongside improvements across existing git operations
- Overhauled core shell commands (`cat`, `cp`, `find`, `grep`, `ls`, `sed`, `sort`, and more) for closer POSIX behavior and better ergonomics when AI agents work on your project

## [9.13.0] - 2026-04-26

### Added
- Build projects with Tailwind CSS v4, including `@import "tailwindcss"` entry files and third-party v4 plugins like `tw-animate-css`

## [9.12.0] - 2026-04-25

### Added
- Build support for module workers and static asset URLs — projects using `new Worker(new URL('./w.ts', import.meta.url), { type: 'module' })`, `SharedWorker`, and `new URL('./logo.svg', import.meta.url)` now build and run correctly in the preview
- Preview pane grants microphone, ambient-light-sensor, and other device permissions so richer apps can run inside the preview

## [9.11.4] - 2026-04-17

### Fixed
- Preview pane no longer gets stuck on stale builds during rapid edits

### Changed
- Reduce AI costs for Anthropic models via OpenRouter by caching tool definitions across turns

## [9.11.3] - 2026-04-12

### Fixed
- App publish dialog now appears on mobile devices
- Changelog available offline via ServiceWorker precache

## [9.11.2] - 2026-04-06

### Fixed
- Derive private preview subdomains with HMAC to prevent cross-project origin collisions on iframe.diy

## [9.11.1] - 2026-04-05

### Changed
- Switch preview pane to iframe.diy for improved reliability and compatibility
- New users start with OpenCode Zen pre-configured for a zero-setup first experience
- Default nsite gateway changed to shakespeare.to with vanity subdomain support
- Update default Blossom servers and relay lists across deployments and uploads

### Fixed
- Default settings no longer override existing users' recently used models
- Showcase card clone URLs now use proper Nostr URI encoding
- Service worker no longer blocks SvelteKit nsite routes

## [9.11.0] - 2026-04-03

### Added
- Upload a banner image for your app directly from the App dialog
- T-tag editor in the App dialog Advanced section for tagging your app by category
- Delete App button in the App dialog Advanced section when editing an existing app
- Ngit repo and nsite deployment address fields in the App dialog Advanced section
- Auto-fill app name, description, and images from your project's OG tags and web manifest on first publish

### Changed
- Redesigned App dialog with an overlapping banner and avatar card layout
- Reorganized App dialog Advanced section into General, Handlers, and Tags tabs
- Showcase cards now show banner and icon images, and require both to appear in the showcase
- Validation summary above the Save button replaces per-field "Required" labels
- Updated showcase curator to the Shakespeare Builders community list

### Fixed
- Upgrade Nostrify to fix bunker connection issues

## [9.10.4] - 2026-04-02

### Fixed
- Fix Android splash screen showing logo masked to white silhouette instead of full color

## [9.10.3] - 2026-04-02

### Fixed
- Fix Android app showing default Capacitor splash screen and icon colors

## [9.10.2] - 2026-04-02

### Fixed
- Fix Android app showing default Capacitor icon instead of Shakespeare logo in app drawer

## [9.10.1] - 2026-04-02

### Fixed
- Replace default Capacitor vector drawable icons with Shakespeare logo

## [9.10.0] - 2026-04-02

### Added
- Android app powered by Capacitor with deep links, splash screen, and signed release builds
- CI pipeline for building APKs, publishing to GitLab releases, and distributing via Zapstore
- Nsite deployment for decentralized hosting via Nostr

### Changed
- Make version number on mobile settings a clickable link to the changelog with build date

## [9.9.2] - 2026-04-02

### Changed
- Simplify nsite deployment to always use named sites, removing the root site option

### Fixed
- Fix crash in "What's new" toast when used outside the router context
- Truncate long changelog excerpts in update notifications so they fit neatly in the toast
- Left-align changelog page content for better readability

## [9.9.1] - 2026-04-02

### Added
- Changelog page and versioning system with "What's new" toast notifications on updates
- Release skill for managing versioned releases with changelog generation and git tagging
