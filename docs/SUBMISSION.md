# Community submission notes

## Entry

- Name: Selection AI Button
- ID: `selection-ai-button`
- Repository: https://github.com/DLf2001/selection-ai-button-for-obsidian
- Author: DLf2001
- License: MIT
- Desktop only; Quick Ask runs in Live Preview. Reading view offers an explicit switch-to-Live-Preview shortcut, followed by a new selection.
- Minimum app version: 1.11.4. Declarative settings are used on 1.13+ with an imperative fallback on older versions.
- Description: Open Copilot Quick Ask from a floating selection button, with optional selected-text prefill.

## Review disclosures

This is an independent companion plugin for Copilot by Logan Yang. Copilot is not bundled or modified. This plugin does not read credentials, make network requests, send messages automatically, or change the system clipboard. Copilot and the model provider handle requests only after the user sends a message.

Compatibility is based on Copilot 4.0.15. The integration uses its command ID, Quick Ask controller, and Lexical input DOM. It also uses CodeMirror through the Markdown editor. These integration details are not guaranteed public extension APIs. Feature checks and input guards are included, but updates to Copilot may require corresponding changes. Passing ESLint or local tests is not a guarantee of community acceptance.

## Pre-submission checks

- Public source, Chinese and English README, MIT LICENSE.
- Matching manifest/package version, release tag, and release attachments.
- `npm test` and `npm run lint` using the official Obsidian ESLint recommended configuration.
- CommonJS import-style exception in ESLint: this repository directly ships a JavaScript entry point without a transpilation step.
- No vault data, plugin data.json, API tokens, CC Switch configuration, or other plugins are included in Git.
- The official published plugin registry was checked for this ID/name during preparation; check again at submission time.

## Manual verification checklist

Use a non-sensitive Markdown test note. No API message needs to be sent for these checks.

- Reload the plugin; ensure only one button appears for a selection.
- Switch Chinese → English → Chinese; check settings, button text, notices, and saved language.
- Confirm an existing enabled prefill option survives an update and language changes.
- Select text, open Quick Ask, and check that only the latest selection is prefilled.
- Type a custom question; verify prefill never overwrites it.
- Click outside Quick Ask and confirm it closes; confirm model dropdown menus remain usable.
- Turn prefill off and confirm the question box stays blank.
- Open and close a popout window; repeat selection and confirm window cleanup.
- Disable the plugin; confirm its buttons disappear and do not return on selection.
- Confirm Reading view shows a switch-to-Live-Preview button only for selections within the note body; clicking it changes mode without editing the note or sending a message.
- Confirm no button is shown in Source mode or a PDF.

Automated mocks cover the corresponding state transitions, but do not replace checking the real Copilot editor. Record actual UI results separately; do not report checklist items as passed solely because the mocks passed.

### Recorded local UI verification — 2026-10-16

On Obsidian Desktop 1.14.4 with Copilot 4.0.15 installed:

- Disabled and re-enabled the installed plugin to load the updated entry point.
- Opened its settings through Obsidian's settings search.
- Switched English → Simplified Chinese and confirmed that both settings rows, including the focused language row, updated immediately.
- Confirmed that the saved language was `zh` and the previously enabled selection-prefill setting remained enabled.

The complete Quick Ask interaction checklist, popout-window behavior, and the older-app settings fallback have not been re-tested in the real UI for this release. Automated tests exercise those code paths with mocks; they are not equivalent to end-to-end verification. No API message was sent during the language-setting check.

## Submit

Sign in at https://community.obsidian.md with an Obsidian account, link the repository owner's GitHub account, then use Plugins → New plugin. The owner must read and accept the developer policies and maintenance commitment. This repository release is not itself a community submission or approval.
