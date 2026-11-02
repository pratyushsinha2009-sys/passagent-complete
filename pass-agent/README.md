# PassAgent — guidance directly on Passport Seva

A browser extension that explains passport questions **under the actual form fields**, highlights the current question and moves browser typing focus as you finish. There is no separate assistant screen or floating panel.

## Install / update

1. Open `chrome://extensions` or `edge://extensions`.
2. Enable Developer mode. Choose Load unpacked and select `extensions/passport-guide`.
3. If already installed, press Reload on the extension card and refresh the passport tab.
4. Open https://www.passportindia.gov.in/. The home-page guide highlights Register and offers a choice between creating an account and logging in. Guidance appears automatically on forms.

Double-click **Open Passport Guide.cmd** to open the official site and run the optional AI backend. Built-in field explanations work even without the backend. Your Gemini key stays in `apps/server/.env`.

## How it works

On the main home page, a compact welcome note appears beside the actual Login/Register controls. Register is highlighted and focused automatically. Choose “I’m new” or “I already have an account” to follow the corresponding verified official link in the same tab. Hide dismisses the home guide. Informational pages and search inputs receive no welcome note.

- Each recognized question has a plain-language explanation, an example where useful, a relevant caution and an official-help link.
- Labels are read from accessible labels, linked labels, nearby text, table cells, section headings and internal names. Static on-page hints and choices provide extra context.
- A broad local library covers registration, names, birth details, family, education, employment, citizenship, Non-ECR, addresses, emergency contacts, passport history, documents, declarations and appointment/payment steps. It explains the questions; it never knows your personal answers.
- The guide starts automatically on form questions and focuses the first unanswered box. A compact horizontal note explains the active question; other notes remain hidden. Search, headers, navigation and footers are excluded.
- Type your answer. After four seconds without typing, a valid recognized answer advances automatically; typing again restarts that wait. Enter or leaving the box also continues. Dropdown and radio choices advance after a short delay. Stay here stops automatic movement for the current question until Done—next is chosen. Clicking help, switching tabs or composing text pauses pending movement. Passwords, codes, sensitive ID/payment inputs and declarations use Done—next; unknown questions wait for clarification.
- Auto guide can be paused. More help contains the application goal, optional AI, all tips and section review. Hide tips clears the highlights and notes.
- Help me choose asks a simple follow-up for supported questions such as employment. It suggests only a uniquely matching choice actually on the page and applies it only after you select Use this option.
- Local checks catch invalid email, mismatched confirmation passwords and impossible/future birth dates. Answers stay in the webpage.
- After reviewing the questions, choose Continue on website to open an ordinary Next section. Account registration, CAPTCHA, OTP, declarations, payment and final submission remain user actions.
- Details & questions opens examples, cautions and AI help under the active question. The existing Gemini backend receives question context, not entered answers.

The extension moves browser focus (the typing caret), not the physical operating-system mouse pointer.

## Accuracy and references

Reviewed reference pages on 2026-10-31:

- Official application steps: https://www.passportindia.gov.in/psp/Apply
- Form questions: https://www.passportindia.gov.in/psp/FaqApplicationForm
- Instruction booklet: https://www.passportindia.gov.in/AppOnlineProject/pdf/ApplicationformInstructionBooklet-V3.0.pdf
- Document list: https://www.passportindia.gov.in/psp/ListDocuments

The library is a paraphrased field explainer, not a copy of official instructions or a live rules database. Current portal instructions take precedence. It does not decide eligibility, citizenship, legal history or declarations, promise appointment availability, or guarantee every future portal question is recognized. When recognition is uncertain, it asks for the visible wording rather than saying only "this field" or inventing an answer.

## Privacy

Field values, files, screenshots and keystrokes are not sent to Gemini. Only question labels, internal names, static hints, section names, choices, completion/error flags, the URL path and explicit guide questions are sent. Page labels/options can themselves contain personal information. Do not include passwords, OTPs or ID numbers in guide questions. Provider data policies apply. Only the language, goal, AI preference and auto-move preference are stored by the extension.

## Development and checks

```powershell
npm run dev
npm run test:guide
npm run test:guide:browser
npm run typecheck
npm run build
```

`test:guide:browser` uses sample forms and simulated model replies to test inline attachment, table/unlinked labels, family context, mobile layout, automatic focus, invalid-email blocking, ordinary Next navigation and final-submission exclusion. The public registration check recognized all seven expected questions without entering or submitting answers. Authenticated application pages have only been checked with sample forms; they still need a live user walkthrough. The model in the browser/API check is simulated; a model lookup succeeded but live AI generation has not completed reliably in this environment. The full unpacked-extension test is separate and requires the full Chromium executable.

## Guide languages

Choose **Language** on the homepage guide, the form toolbar, or the extension popup. English, Hindi, Bengali, Marathi, Tamil, Telugu and Gujarati are included. The choice is remembered locally and follows you between Passport Seva pages.

Built-in short instructions and common controls are translated without an API call. Official field labels, exact English reference details, examples, and professional option names remain in English. The guide never translates or rewrites the portal or your entered information. It reminds you to enter names, addresses and professional text in English letters, and pauses on non-Latin entries without changing them. Passwords are not subject to this English-entry check.

AI questions include the selected language code, so the backend can explain in that language while keeping field titles and examples in English. Live Gemini remains optional and dependent on provider availability. The bundled translations have automated coverage and functional checks; independent native-speaker review is still recommended before public release.
