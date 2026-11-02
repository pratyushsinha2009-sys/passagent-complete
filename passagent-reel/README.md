# PassAgent reel

A 36-second vertical product reel, 1080 × 1920, 30 fps.

## Preview

Run `npm run dev` and open the exact URL printed by Remotion Studio. Select **PassAgent-Reel** and press Play. Every substantial scene also has its own composition under Editable-Scenes. Keep the project folder open while editing; Studio updates automatically.

## Story

- 0–3s: Confusing passport forms → meet PassAgent.
- 3–8s: Real public home page, with an enlarged version of the guide.
- 8–13s: Plain-language explanation beside a highlighted name box.
- 13–18s: Typing focus moves from given name to surname.
- 18–23s: Employment follow-up → suggestion → user confirmation.
- 23–27s: Invalid email → clear correction.
- 27–32s: Section review and the user's final responsibility.
- 32–36s: Chrome extension end card.

## Editing and assets

`src/scenes/` contains the independently editable scenes. `src/design.tsx` contains common typography, browser chrome, captions, cursor and field graphics. Caption arrays sit directly in each scene for easy editing. `captions.json` and `captions.srt` are portable companions with full-reel timings.

The public homepage image comes from the verified PassAgent project. Other form views are recreated demonstrations with fictional details, labeled on screen. No real application was submitted, and authenticated portal steps are not presented as a recorded live submission. Focus timing is shortened for the reel.

`public/passagent-flow.wav` is a locally synthesized original backing track made with `scripts/make-audio.py`. It contains no third-party music or cloned voice. The reel uses kinetic captions and music, without narration.

The final card accurately says Chrome extension with local Developer-mode installation. It does not claim a Chrome Web Store listing.

## Checks

`npm run lint` checks TypeScript and lint rules. `qa/` contains inspected still frames. `scripts/check-frames.cjs` uses this machine's existing browser installation; update its browser path on another computer. It generates still-frame checks, not an MP4.

The reel is prepared as an editable Studio preview. Export an MP4 using Studio's Render button when desired. No full video export is included by default.

Revision: the opener says passport guide; empty inter-scene fades were removed. BGM is an original stereo 120 BPM major-key track with beat-aligned edit accents. Moving flight paths, route-step chips, caption animation and browser tilt add motion without covering the form.
