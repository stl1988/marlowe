# Marlowe ✒️

[![Edit with Shakespeare](https://shakespeare.diy/badge.svg)](https://shakespeare.diy/clone?url=https://github.com/stl1988/marlowe.git)
[![Edit with Marlowe](https://marlowe.shakespeare.wtf/marlowe-badge.svg)](https://marlowe.shakespeare.wtf/clone?url=https://github.com/stl1988/marlowe.git)

Marlowe is an open-source, Nostr-native AI app builder that runs entirely in your browser. It is a fork of [Shakespeare](https://shakespeare.diy) with its own branding, deploy pipeline, and a growing list of improvements.

https://marlowe.shakespeare.wtf

## Features

- **Use any AI provider** OpenAI, Anthropic, OpenRouter, xAI, ZAI, Deepseek, PayPerQ, and more
- **PayPerQ credits management** — live balance display next to the session cost, and crypto top-ups (Lightning ⚡ with 5% bonus, on-chain BTC, Litecoin, Liquid, Monero) right inside the app
- **Buy credits anonymously** with Nostr and Lightning ⚡
- **Redeem gift cards** with shareable links for instant credits
- **Economy Mode** — a per-project credit saver that works on two levels: prompt instructions for the AI *and* technical enforcement (old tool outputs are elided from the re-sent context, step budget capped). Assistant reasoning traces are never re-sent to providers
- **Live file-writing preview** — watch files grow in the chat while the AI streams `write`/`edit` tool calls, with a blinking cursor and live line counter
- **Syntax-highlighted code view** — Prism-based highlighting for ~20 web languages in the file editor and chat code blocks
- **12 UI languages** — English, German, Spanish, French, Italian, Dutch, Polish, Portuguese, Chinese, Hausa, Yoruba, Igbo
- **Nostr Settings Sync (NIP-78)** — back up and restore all settings across devices, NIP-44 encrypted to your own key
- **Nostr-native deployment** — publish as an nsite or claim a `*.shakespeare.wtf` hostname through the npanel gateway
- **Runs entirely in the browser** No backend required

## How it Works

Marlowe is a React PWA that stores files in IndexedDB with [LightningFS](https://github.com/isomorphic-git/lightning-fs). Your browser connects directly to AI providers and git services (through [isomorphic-git](https://github.com/isomorphic-git/isomorphic-git)) to enable you to build and deploy AI apps entirely from your device.

Marlowe hosts no backend (except for a couple microservices in the `services/` directory; these are fully configurable within Marlowe's settings). All your code and configuration is stored in your browser.

Configure any AI providers and git services you want. Configuration is stored entirely in the browser in localStorage.

You can then push and pull code to synchronize your work across devices.

Marlowe can work on any type of project. But it is specialized to build React applications in TypeScript, which it compiles in the browser with [esbuild-wasm](https://www.npmjs.com/package/esbuild-wasm) and custom plugins. Any codebase can be worked on, but only compatible projects can be previewed directly in Marlowe.

## Open Source

Marlowe is proudly Open Source software licensed under the GNU AGPLv3. The purpose of Marlowe is to provide a free and open platform for building AI applications that respects user privacy and freedom — continuing the mission of its upstream, Shakespeare.

## Mirrors

Marlowe is available on the following URLs:

- [marlowe.shakespeare.wtf](https://marlowe.shakespeare.wtf)
- as an nsite: [47h1rs70oqaspur8bichfzalg0wnassb8d7tslfacl7hwyaxhkmarlowe.nsite.lol](https://47h1rs70oqaspur8bichfzalg0wnassb8d7tslfacl7hwyaxhkmarlowe.nsite.lol)

Upstream Shakespeare is available at:

- [shakespeare.diy](https://shakespeare.diy)
- [shakespeare-diy.github.io](https://shakespeare-diy.github.io)
- [shakespeare-b0b9c8.gitlab.io](https://shakespeare-b0b9c8.gitlab.io)

## Alternatives

- [Shakespeare](https://shakespeare.diy) - the upstream project Marlowe is forked from
- [goose](https://github.com/block/goose) - open-source desktop app and cli utilizing your full computer for AI tasks
- [bolt.diy](https://github.com/stackblitz-labs/bolt.diy) - similar to Marlowe, but built on closed-source WebContainers technology
