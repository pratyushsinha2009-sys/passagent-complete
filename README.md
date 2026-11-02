# PassAgent

A multilingual Chrome/Edge extension that guides users directly on Passport Seva, plus an editable Remotion promotional reel.

- **pass-agent/**: extension, local Gemini backend, React setup page, tests, extension ZIP and screenshots.
- **passagent-reel/**: 36-second vertical motion-graphics reel, original music, captions and editable scenes.

## Run the application

```sh
cd pass-agent
npm ci
```

Copy `apps/server/.env.example` to `apps/server/.env`, add your own Gemini key if using optional AI, then run `npm run dev:server`. Load `extensions/passport-guide` using Chrome's Load unpacked option. See the project README for the complete setup and current limitations.

## Preview the reel

```sh
cd passagent-reel
npm ci
npm run dev
```

Open the URL printed by Remotion Studio and select PassAgent-Reel.

## Languages

English, Hindi, Bengali, Marathi, Tamil, Telugu and Gujarati guidance. Official labels, personal details and professional option names remain English. Language packs work without an API connection.

## Current status

This is an independent guide, not an official government product. AI currently uses a local backend and is not a publicly hosted service. No Chrome Web Store listing is included. Authenticated passport flows still need live user verification; built-in language packs need independent native-speaker review before public release.

API keys, local settings, Git history and installed dependencies are excluded from this repository snapshot. Original project files remain in their working directories.
