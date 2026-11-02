(() => {
  if (document.querySelector('[data-passport-guide="highlight"]')) return;
  const entries = new Map(), ids = new WeakMap(), cache = new Map();
  let counter = 0, active = null, goal = "fresh", stage = "welcome", ai = false, autoMove = true, hidden = false, showAll = false;
  let scanTimer, advanceTimer, pageTimer, explainTimer, requestVersion = 0, busy = false, queued = null, scanRunning = false;
  const reader = PassportFieldReader;
  const clean = (value, max = 240) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  const idFor = (element) => { if (!ids.has(element)) ids.set(element, `f${++counter}`); return ids.get(element); };
  const visible = (element) => { const rect = element.getBoundingClientRect(); return rect.width > 1 && rect.height > 1 && !element.disabled && !element.readOnly && element.getAttribute("aria-disabled") !== "true" && !element.closest('[aria-hidden="true"],[inert]') && (!element.checkVisibility || element.checkVisibility({ checkOpacity: true, checkVisibilityCSS: true })) && getComputedStyle(element).visibility !== "hidden"; };
  const toolbar = document.createElement("div"); toolbar.dataset.passportGuide = "toolbar";
  const bar = toolbar.attachShadow({ mode: "open" });
  bar.innerHTML = `<style>${PassportInlineTheme}</style><div class="toolbar"><strong>✦ Passport Coach</strong><span class="count"></span><button type="button" id="start">Start guide</button><details class="settings"><summary>More help</summary><div class="settings-body"><select aria-label="Application goal"><option value="fresh">First passport</option><option value="reissue">Re-issue</option><option value="understand">Understand form</option></select><button type="button" id="ai">AI help: off</button><button type="button" id="all">Show all tips</button><small>Your guide starts here. Type your answer. After a 4-second pause, the guide moves to the next box. Keep typing to wait, or choose Stay here. Enter also continues. You can pause at any time.</small><details class="review"><summary>Review this section</summary><ul></ul></details></div></details><button type="button" id="auto">Auto guide: on</button><button type="button" id="hide">Hide tips</button><button type="button" id="continue" hidden>Continue on website</button></div>`;
  toolbar.hidden = true;
  if (globalThis.PassportI18n) {
    PassportI18n.mount(bar, bar.querySelector('.toolbar'));
    PassportI18n.subscribe(() => {
      requestVersion++; queued=null; cache.clear(); clearTimeout(advanceTimer);
      for (const entry of new Set(entries.values())) {
        const field=fieldFor(entry), help=PassportKnowledge.lookup(field);
        render(entry, help, help.source); setupFollowUp(entry, field);
      }
    });
  }
  const highlightHost = document.createElement("div"); highlightHost.dataset.passportGuide = "highlight";
  highlightHost.style.cssText = "position:fixed;inset:0;pointer-events:none;z-index:2147483646";
  const overlay = highlightHost.attachShadow({ mode: "open" });
  overlay.innerHTML = `<style>.ring,.section{box-sizing:border-box}.ring{position:fixed;border:2px solid #8174e6;box-shadow:0 0 0 3px #8174e619;border-radius:5px;pointer-events:none}.section{position:fixed;border:1px dashed #b5ace5;border-radius:8px;pointer-events:none}[hidden]{display:none}</style><div class="section" hidden></div><div class="ring" hidden></div>`;
  document.documentElement.append(highlightHost);
  // Ignore site navigation, search, and the coach's own controls on every route.
  function eligible(element) {
    if (!visible(element) || element.closest('[data-passport-guide],header,nav,[role=navigation],[role=search],footer')) return false;
    const identity = [element.type, element.id, element.name, element.getAttribute("placeholder"), element.getAttribute("aria-label"), element.getAttribute("autocomplete")].join(" ");
    if (/\b(search|searchbox)\b|site.?search|search.?site/i.test(identity)) return false;
    const field = reader.read(element, idFor(element));
    if (/\bsearch\b/i.test(field.label)) return false;
    // Known application questions work on the portal's nonsemantic pages too.
    return !!element.closest('form,main,[role=main]') || PassportKnowledge.lookup(field).recognized;
  }
  const unique = () => [...new Set(entries.values())].filter((entry) => entry.element.isConnected && eligible(entry.element)).sort((a, b) => a.element === b.element ? 0 : a.element.compareDocumentPosition(b.element) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1);
  const fieldFor = (entry) => ({ ...reader.read(entry.element, entry.id), confirmed: entry.done === true, skipped: entry.skipped === true });
  const actionLabel = (element) => element.matches('[data-focusable="true"]') && !element.matches('input,button,a,[role=button]') ? clean(element.textContent).replace(/[\uE000-\uF8FF]/g, "").trim() : reader.labelFor(element);
  function updateVisibility(entry) {
    const hide = hidden || !eligible(entry.element) || (!showAll && active !== entry);
    entry.host.hidden = hide; entry.host.style.display = hide ? "none" : "block";
    if (entry.wrapper) entry.wrapper.hidden = hide;
  }
  function position() {
    const ring = overlay.querySelector(".ring"), sectionRing = overlay.querySelector(".section");
    if (!active?.element.isConnected || hidden || !eligible(active.element)) { ring.hidden = sectionRing.hidden = true; return; }
    const rect = (active.navigationTarget?.isConnected ? active.navigationTarget : reader.customGroupFor(active.element)?.element || active.element).getBoundingClientRect();
    ring.hidden = rect.bottom < 0 || rect.top > innerHeight;
    ring.style.cssText = `left:${rect.left - 4}px;top:${rect.top - 4}px;width:${rect.width + 8}px;height:${rect.height + 8}px`;
    const section = reader.sectionFor(active.element).element?.getBoundingClientRect();
    sectionRing.hidden = !section || section.bottom < 0 || section.top > innerHeight;
    if (section) { const top = Math.max(3, section.top - 5), left = Math.max(3, section.left - 5); sectionRing.style.cssText = `left:${left}px;top:${top}px;width:${Math.max(0, Math.min(innerWidth - 3, section.right + 5) - left)}px;height:${Math.max(0, Math.min(innerHeight - 3, section.bottom + 5) - top)}px`; }
  }
  let frame = 0;
  function schedulePosition() { if (!frame) frame = requestAnimationFrame(() => { frame = 0; position(); }); }
  function status(entry, message) { entry.root.querySelector(".status").textContent = message; }
  function check(entry) {
    const field = fieldFor(entry);
    let matchingValue;
    if (/confirm|re.?enter|repeat|retype/i.test(`${field.label} ${field.name}`) && /password|e.?mail/i.test(`${field.label} ${field.name}`)) {
      const password = /password/i.test(`${field.label} ${field.name}`);
      const original = unique().find((item) => item !== entry && (password ? item.element.type === "password" : /email|e.mail/i.test(`${fieldFor(item).label} ${fieldFor(item).name}`)) && !/confirm|re.?enter|repeat|retype/i.test(`${fieldFor(item).label} ${fieldFor(item).name}`));
      if (original) matchingValue = original.element.value || "";
    }
    return PassportCoach.checkAnswer({ field, value: entry.element.value, nativeValid: !entry.element.validity || entry.element.validity.valid, matchingValue });
  }
  function progress() {
    const list = unique(), reviewed = list.filter((entry) => entry.done || entry.skipped).length;
    for (const entry of list) entry.root.querySelector(".badge").textContent = entry.done ? "Reviewed" : entry.skipped ? "Skipped" : fieldFor(entry).required ? "Required" : "Check if this applies to you";
    const journeyStage = PassportCoach.stageFor(list.map(fieldFor));
    if (journeyStage !== "other") stage = journeyStage;
    bar.querySelector(".count").textContent = `${stage === "account" ? "Account setup" : stage === "applicant" ? "Applicant details" : "Current section"} · ${reviewed}/${list.length} reviewed`;
    bar.querySelector(".review ul").replaceChildren(...list.map((entry) => {
      const item = document.createElement("li"), button = document.createElement("button");
      button.type = "button"; button.textContent = `${fieldFor(entry).label} — ${entry.done ? "reviewed" : entry.skipped ? "skipped" : "needs checking"}`; button.onclick = () => select(entry, true); item.append(button); return item;
    }));
    bar.querySelector("#continue").hidden = !list.length || reviewed !== list.length;
    bar.querySelector("#continue").textContent = stage === "account" ? "Finish on Passport Seva" : "Continue on website";
  }
  function setupFollowUp(entry, field) {
    const followUp = PassportCoach.followUp(field), area = entry.root.querySelector(".follow-up");
    area.hidden = !followUp; entry.suggested = null;
    if (!followUp) return;
    area.querySelector(".follow-question").textContent = followUp.question;
    area.querySelector(".follow-note").textContent = followUp.note;
    const answer = area.querySelector("select");
    answer.replaceChildren(new Option("Choose a description…", ""), ...followUp.choices.map((choice) => new Option(choice.label, choice.id)));
    const use = area.querySelector(".use-suggestion"), suggestion = area.querySelector(".suggestion");
    use.hidden = true; suggestion.textContent = "";
    answer.onchange = () => {
      const choice = followUp.choices.find((item) => item.id === answer.value);
      entry.suggested = choice?.option || null; use.hidden = !entry.suggested;
      suggestion.textContent = entry.suggested ? `Suggested option: ${entry.suggested}. Check that this describes you.` : "I cannot map that to one unique option on this page. Read the choices or ask for help.";
      use.textContent = entry.suggested ? `Use “${entry.suggested}”` : "Use this option";
    };
    use.onclick = () => {
      const current = fieldFor(entry), offered = PassportCoach.followUp(current)?.choices.find((choice) => choice.id === answer.value)?.option;
      if (!offered || offered !== entry.suggested) { status(entry, "The choices changed. Please answer the follow-up again."); return; }
      if (entry.element.tagName === "SELECT") {
        const matches = [...entry.element.options].filter((option) => option.textContent.trim() === offered && !option.disabled);
        if (matches.length !== 1) { status(entry, "This option is not uniquely available. Please choose directly on the form."); return; }
        entry.element.value = matches[0].value;
        entry.element.dispatchEvent(new Event("input", { bubbles: true })); entry.element.dispatchEvent(new Event("change", { bubbles: true }));
      } else if (current.type === "radio") {
        const matches = reader.radioGroup(entry.element).filter((member) => reader.labelFor(member).trim() === offered && visible(member));
        if (matches.length !== 1) { status(entry, "Choose the option directly on the form so you can check it."); return; }
        matches[0].click();
      } else { status(entry, "Please choose this option directly on the form."); return; }
      status(entry, `Selected ${offered} after your confirmation. Check it on the form, then choose Done—next.`);
    };
  }
  function render(entry, guidance, source = "") {
    const root = entry.root;
    root.querySelector("strong").textContent = guidance.title;
    root.querySelector(".explanation").textContent = globalThis.PassportI18n ? PassportI18n.guidance(guidance, fieldFor(entry)).explanation : guidance.explanation;
    root.querySelector(".full-explanation").textContent = guidance.explanation;
    root.querySelector(".example").textContent = guidance.example ? `Example only: ${guidance.example}` : "";
    root.querySelector(".example").hidden = !guidance.example;
    root.querySelector(".caution").textContent = guidance.caution || "";
    root.querySelector(".caution").hidden = !guidance.caution;
    root.querySelector(".badge").textContent = entry.done ? "Reviewed" : fieldFor(entry).required ? "Required" : "Check if this applies to you";
    root.querySelector("a").href = source || PassportKnowledge.sources.form;
  }
  function select(entry, moveFocus = false) {
    clearTimeout(advanceTimer); clearTimeout(pageTimer);
    if (active !== entry) { requestVersion++; if (active) active.root.querySelector(".note").classList.remove("active"); }
    active = entry; entry.root.querySelector(".note").classList.add("active");
    entry.navigationTarget = null;
    for (const item of unique()) updateVisibility(item);
    if (moveFocus) { entry.element.scrollIntoView({ behavior: "smooth", block: "center" }); entry.element.focus({ preventScroll: true }); }
    position();
    if (ai && !PassportKnowledge.lookup(fieldFor(entry)).recognized) {
      clearTimeout(explainTimer);
      explainTimer = setTimeout(() => { if (active === entry && ai) void ask(entry, "Identify and explain this exact question using its label, internal name, section and on-page help.", "focus"); }, 650);
    }
  }
  function context(entry, question, event) {
    const field = fieldFor(entry);
    let fields = unique().slice(0, 60).map((item) => ({ ...fieldFor(item), help: fieldFor(item).help.slice(0, 120), options: fieldFor(item).options.slice(0, 8) }));
    if (!fields.some((item) => item.id === field.id)) fields = [field, ...fields.slice(0, 59)];
    return { url: `${location.origin}${location.pathname}`.slice(0, 500), heading: field.section, field, fields, goal, stage, question, event, language: globalThis.PassportI18n?.language || "en" };
  }
  async function ask(entry, question, event = "question") {
    if (!ai) { ai = true; chrome.storage.local.set({ guideAIEnabled: true }); bar.querySelector("#ai").textContent = "AI help: on"; }
    const version = ++requestVersion;
    if (busy) { queued = { entry, question, event }; return; }
    busy = true;
    const data = context(entry, question, event), fingerprint = PassportGuideState.observationKey(data), key = JSON.stringify(data);
    status(entry, "Checking the question and its official guidance…");
    try {
      const response = cache.has(key) ? { ok: true, guide: cache.get(key) } : await chrome.runtime.sendMessage({ type: "passport_guide", context: data });
      if (version !== requestVersion || !entry.element.isConnected) return;
      if (fingerprint !== PassportGuideState.observationKey(context(entry, question, event))) { status(entry, "The question changed. Ask again using the new wording."); return; }
      if (!response?.ok) throw new Error(response?.error || "AI is unavailable.");
      const guide = response.guide;
      if (typeof guide?.explanation !== "string" || !guide.explanation.trim()) throw new Error("AI could not explain this question clearly.");
      cache.set(key, guide); if (cache.size > 60) cache.delete(cache.keys().next().value);
      const target = event === "next_step" ? unique().find((item) => item.id === guide.targetId) || entry : entry;
      render(target, guide, PassportKnowledge.lookup(fieldFor(target)).source); status(target, "AI explanation. Check the official help if unsure.");
      if (guide.stage) stage = guide.stage;
      if (target !== entry) select(target, true);
    } catch (error) { if (version === requestVersion) status(entry, `Field guide remains available. ${error.message || "Try AI again later."}`); }
    finally { busy = false; if (queued && ai) { const next = queued; queued = null; void ask(next.entry, next.question, next.event); } }
  }
  function nextInput(entry) {
    const list = unique(), nextId = PassportCoach.nextQuestion(list.map(fieldFor), entry.id);
    return list.find((item) => item.id === nextId);
  }
  function navigateNext(entry) {
    const section = fieldFor(entry).section;
    if (/declaration|review|verification|payment|appointment/i.test(section)) { status(entry, "Review these details and use the website's own button when ready. I will not submit or pay for you."); return; }
    if (stage === "account") {
      const action = [...document.querySelectorAll('button,[role=button],input[type=submit],a[href],[data-focusable="true"][tabindex="0"]')].filter(visible).find((element) => /^(sign\s*up|register|sign\s*in|log\s*in)$/i.test(actionLabel(element)));
      status(entry, "Check these account details and complete the CAPTCHA. Use Sign Up or Sign In on Passport Seva yourself when ready.");
      if (action) { entry.navigationTarget = action; action.scrollIntoView({ behavior: "smooth", block: "center" }); schedulePosition(); }
      return;
    }
    const next = [...document.querySelectorAll('button,[role=button],input[type=button],input[type=submit],a[href],[data-focusable="true"][tabindex="0"]')].filter(visible).find((element) => /^(next|continue|save\s*(and|&)\s*(next|continue))\s*[>›»→]*$/i.test(actionLabel(element).replace(/[<>«»]/g, "").trim()));
    if (!next) { status(entry, "This section is ready to review. Use the website's Next button when you are ready."); return; }
    const form = next.form || entry.element.form;
    if (form && (!form.checkValidity() || /final|payment|submitapplication/i.test(form.getAttribute("action") || ""))) { status(entry, "Check the form's messages before continuing."); return; }
    for (const item of unique()) {
      const result = check(item);
      if ((!item.skipped && !result.valid) || (!item.done && !item.skipped)) { select(item, true); status(item, result.message || "Review this question before continuing."); return; }
    }
    status(entry, "Opening the next section after your confirmation.");
    next.click();
  }
  function advance(entry, automatic = false) {
    clearTimeout(advanceTimer);
    if (!entry.element.isConnected || (automatic && (!autoMove || active !== entry))) return;
    const field = fieldFor(entry);
    const result = check(entry);
    if (!result.valid) { entry.done = false; progress(); select(entry, true); status(entry, result.message); entry.root.querySelector(".note").classList.add("needs-check"); return; }
    if (!field.filled && !field.required && !entry.skipped) { status(entry, "Fill this question, or use Skip optional if it does not apply to you."); return; }
    entry.done = !entry.skipped; entry.root.querySelector(".note").classList.remove("needs-check"); progress();
    const next = nextInput(entry);
    if (next) { select(next, true); status(next, "Type your answer. I will move on after a short pause. Choose Stay here if you need more time."); }
    else { progress(); bar.querySelector(".settings").open = true; bar.querySelector(".review").open = true; status(entry, "This section is reviewed. Check the website's answers, then choose Continue on website."); }
  }
  function scheduleAdvance(entry, delay = 4000) {
    clearTimeout(advanceTimer);
    if (!autoMove || hidden || entry.stay || entry.composing || document.hidden) return;
    const choice = /^(select-one|radio)$/.test(fieldFor(entry).type);
    const field = fieldFor(entry);
    if (!PassportKnowledge.lookup(field).recognized) { status(entry, "Please clarify this question first. Auto move will wait here; open Explain this question for help."); return; }
    if (!field.filled || /password|captcha|otp|one.?time|aadhaar|aadhar|\bpan\b|card|bank|declar|agree|consent/i.test(`${field.type} ${field.label}`) || entry.element.tagName === "TEXTAREA") return;
    if (field.invalid) { status(entry, "Check the website's message. I will stay on this question until it is valid."); return; }
    if (!check(entry).valid) return;
    status(entry, choice ? "Moving to the next question…" : delay === 0 ? "Moving to the next box…" : "Next box in 4 seconds. Keep typing or choose Stay here to wait.");
    advanceTimer = setTimeout(() => {
      if (document.hidden || entry.stay || entry.composing || !eligible(entry.element)) return;
      if (!choice && delay !== 0 && document.activeElement !== entry.element) return;
      advance(entry, true);
    }, choice ? 700 : delay);
  }
  function attach(element) {
    const field = reader.read(element, idFor(element));
    const host = document.createElement("div"); host.dataset.passportGuide = "note";
    host.style.cssText = "display:block;clear:both;flex-basis:100%;grid-column:1/-1;width:100%;min-width:0;max-width:100%;contain:inline-size;margin:6px 0 12px";
    const root = host.attachShadow({ mode: "open" });
    root.innerHTML = `<style>${PassportInlineTheme}</style><div class="note"><div class="heading"><strong data-pa-english></strong><span class="badge"></span></div><div class="copy"><p class="explanation"></p><details class="follow-up" hidden><summary>Help me choose</summary><p class="follow-question"></p><select aria-label="Describe your situation"></select><p class="follow-note"></p><p class="suggestion" role="status"></p><button type="button" class="use-suggestion" hidden>Use this option</button></details><details class="question-details"><summary>Details &amp; questions</summary><p class="full-explanation" data-pa-english></p><p class="example" data-pa-english hidden></p><p class="caution" data-pa-english hidden></p><form class="ask"><input aria-label="Question for this answer" maxlength="1200" placeholder="Paste the question or say what is confusing"><button type="submit">Ask AI</button></form></details></div><div class="links"><button type="button" class="link next">Done—next →</button><button type="button" class="link stay">Stay here</button><button type="button" class="link skip" hidden>Skip optional</button><a target="_blank" rel="noopener noreferrer">Official help ↗</a></div><div class="status" role="status"></div></div>`;
    const entry = { element, host, root, id: field.id, fingerprint: "", done: false, skipped: false };
    const group = reader.radioGroup(element);
    const last = group[group.length - 1] || element;
    let anchor = reader.customGroupFor(last)?.element || last.closest("label") || last;
    if (!reader.customGroupFor(last) && last.matches('[data-testid="text-input-outlined"],[role="radio"],[role="combobox"]')) {
      for (let parent = last.parentElement, depth = 0; parent && depth < 6; parent = parent.parentElement, depth++) {
        if (parent.matches("form,main,body,fieldset,section") || parent.getBoundingClientRect().height > 240) break;
        const count = parent.querySelectorAll('input:not([type=hidden]),select,textarea,[role=combobox]').length;
        if (last.getAttribute("role") === "radio") {
          if (count || parent.querySelectorAll('[role=radio]').length > group.length) break;
        } else if (count !== 1) break;
        anchor = parent;
      }
    }
    const row = last.closest("tr");
    if (row && last.closest("td,th")) {
      const noteRow = document.createElement("tr"); noteRow.dataset.passportGuide = "row";
      const cell = document.createElement("td"); cell.colSpan = [...row.cells].reduce((sum, item) => sum + item.colSpan, 0); cell.style.padding = "0 6px";
      cell.append(host); noteRow.append(cell); row.after(noteRow); entry.wrapper = noteRow;
    } else anchor.after(host);
    for (const member of group) entries.set(member, entry);
    root.querySelector(".next").onclick = () => { entry.stay = false; advance(entry); };
    root.querySelector(".stay").onclick = () => { entry.stay = true; clearTimeout(advanceTimer); status(entry, "Take your time. Choose Done—next when ready."); };
    root.querySelector(".skip").onclick = () => { if (fieldFor(entry).required) return; entry.skipped = true; advance(entry); };
    root.querySelector(".ask").onsubmit = (event) => { event.preventDefault(); const question = root.querySelector("input").value.trim(); if (question) { select(entry); void ask(entry, question); } };
    if (globalThis.PassportI18n) PassportI18n.observe(root);
    host.hidden = hidden;
    return entry;
  }
  function scan() {
    if (scanRunning) return; scanRunning = true;
    reader.invalidate();
    try {
      for (const [element, entry] of entries) if (!element.isConnected || !entry.element.isConnected || !eligible(entry.element)) { entries.delete(element); if (!entry.element.isConnected || !eligible(entry.element)) (entry.wrapper || entry.host).remove(); }
      const controls = [...reader.customChoices(), ...document.querySelectorAll('input:not([type=hidden]):not([type=submit]):not([type=button]):not([type=reset]),select,textarea,[role=combobox],[role=radio],[role=checkbox]')].filter((element) => eligible(element) && (!element.matches("[role=combobox],[role=radio],[role=checkbox]") || !element.querySelector("input,select"))).slice(0, 150);
      for (const element of controls) {
        const entry = entries.get(element) || attach(element);
        const field = fieldFor(entry), fingerprint = JSON.stringify({ label: field.label, name: field.name, section: field.section, help: field.help, options: field.options, required: field.required });
        if (fingerprint !== entry.fingerprint) {
          entry.fingerprint = fingerprint; const guidance = PassportKnowledge.lookup(field); render(entry, guidance, guidance.source); setupFollowUp(entry, field);
          entry.root.querySelector(".skip").hidden = field.required || /^(radio|checkbox)$/.test(field.type) || /password|captcha|otp|citizenship|non.?ecr|legal|declar|consent|agree/i.test(`${field.type} ${field.label}`);
        }
        updateVisibility(entry);
      }
      for (const entry of new Set(entries.values())) updateVisibility(entry);
      const list = unique(); progress();
      toolbar.hidden = !list.length;
      if (list.length && !toolbar.isConnected) {
        const first = list[0];
        const anchor = first.wrapper || first.host;
        // Keep the compact controls alongside the form, never in the site header.
        (anchor.closest("form,fieldset,main,[role=main]") || anchor.parentElement).prepend(toolbar);
      }
      if (!list.length) toolbar.remove();
      if (active && (!active.element.isConnected || !eligible(active.element))) active = null;
      if (!active && list.length) { const first = list.find((entry) => !entry.done && !entry.skipped) || list[0]; select(first, autoMove && !hidden); }
      position();
    } finally { scanRunning = false; }
  }
  function changed(event, committed) {
    const entry = entries.get(event.target); if (!entry) return;
    entry.done = false; entry.skipped = false; entry.root.querySelector(".note").classList.remove("needs-check");
    select(entry); event.target.dataset.paTouched = "true";
    entry.root.querySelector(".badge").textContent = fieldFor(entry).required ? "Required" : "Check if this applies to you";
    progress();
    scheduleAdvance(entry, /^(select-one|radio)$/.test(fieldFor(entry).type) ? 700 : 4000);
  }
  document.addEventListener("focusin", (event) => { const entry = entries.get(event.target); if (entry) select(entry); }, true);
  document.addEventListener("compositionstart", (event) => { const entry = entries.get(event.target); if (entry) { entry.composing = true; clearTimeout(advanceTimer); } }, true);
  document.addEventListener("compositionend", (event) => { const entry = entries.get(event.target); if (entry) { entry.composing = false; changed(event, false); } }, true);
  document.addEventListener("pointerdown", (event) => { if (active && event.target !== active.element) clearTimeout(advanceTimer); }, true);
  document.addEventListener("visibilitychange", () => { if (document.hidden) clearTimeout(advanceTimer); });
  document.addEventListener("input", (event) => changed(event, false), true);
  document.addEventListener("change", (event) => changed(event, true), true);
  document.addEventListener("focusout", (event) => {
    const entry = entries.get(event.target);
    if (!entry || !autoMove || hidden || entry.done || !event.target.dataset.paTouched) return;
    // Never steal focus from someone explicitly selecting another question or help.
    if (event.relatedTarget && entries.has(event.relatedTarget)) {
      const field = fieldFor(entry);
      if (field.filled && check(entry).valid && PassportKnowledge.lookup(field).recognized && !/password|captcha|otp|one.?time|declar|agree|consent/i.test(`${field.type} ${field.label}`)) { entry.done = true; progress(); }
      return;
    }
    if (event.relatedTarget?.closest?.('[data-passport-guide]')) return;
    scheduleAdvance(entry, 0);
  }, true);
  document.addEventListener("click", (event) => { const member = reader.recordChoice(event.target); if (member) changed({ target: member }, true); }, true);
  document.addEventListener("invalid", (event) => { const entry = entries.get(event.target); if (entry) { clearTimeout(advanceTimer); select(entry); status(entry, "The website needs you to check this answer. Read its message and the explanation above."); } }, true);
  document.addEventListener("keydown", (event) => { if (!event.isComposing && event.key === "Enter" && entries.has(event.target) && event.target.tagName !== "TEXTAREA" && !/password/.test(event.target.type)) { event.preventDefault(); advance(entries.get(event.target)); } }, true);
  bar.querySelector("#start").onclick = () => { const first = unique().find((entry) => !entry.done && !entry.skipped) || unique()[0]; if (first) { hidden = false; bar.querySelector("#hide").textContent = "Hide tips"; select(first, true); } };
  bar.querySelector("#all").onclick = () => { showAll = !showAll; bar.querySelector("#all").textContent = showAll ? "One question at a time" : "Show all tips"; for (const entry of unique()) updateVisibility(entry); };
  bar.querySelector("#continue").onclick = () => { if (active) navigateNext(active); };
  bar.querySelector("#auto").onclick = () => { autoMove = !autoMove; clearTimeout(advanceTimer); clearTimeout(pageTimer); chrome.storage.local.set({ guideAutoEnabled: autoMove }); bar.querySelector("#auto").textContent = `Auto guide: ${autoMove ? "on" : "off"}`; if (autoMove && active && !hidden) { active.stay = false; select(active, true); } };
  bar.querySelector("#ai").onclick = () => { ai = !ai; requestVersion++; queued = null; chrome.storage.local.set({ guideAIEnabled: ai }); bar.querySelector("#ai").textContent = `AI help: ${ai ? "on" : "off"}`; if (ai && active) void ask(active, "Explain this exact question using its section, choices and official guidance.", "focus"); };
  bar.querySelector("select").onchange = (event) => { goal = event.target.value; cache.clear(); chrome.storage.local.set({ guideGoal: goal }); };
  bar.querySelector("#hide").onclick = () => { hidden = !hidden; clearTimeout(advanceTimer); clearTimeout(pageTimer); bar.querySelector("#hide").textContent = hidden ? "Show tips" : "Hide tips"; for (const entry of unique()) updateVisibility(entry); position(); };
  window.addEventListener("scroll", schedulePosition, { passive: true, capture: true }); window.addEventListener("resize", schedulePosition);
  new MutationObserver((records) => {
    if (records.every((record) => record.target.closest?.("[data-passport-guide]") || (record.type === "childList" && [...record.addedNodes, ...record.removedNodes].length && [...record.addedNodes, ...record.removedNodes].every((node) => node.nodeType === 1 && node.hasAttribute("data-passport-guide"))))) return;
    clearTimeout(scanTimer); scanTimer = setTimeout(scan, 180);
  }).observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["disabled", "hidden", "aria-label", "aria-labelledby", "aria-invalid", "aria-checked", "class", "style"] });
  chrome.storage.local.get(["guideAIEnabled", "guideGoal", "guideAutoEnabled"]).then(async (settings) => {
    await globalThis.PassportI18n?.ready;
    ai = settings.guideAIEnabled === true; autoMove = settings.guideAutoEnabled !== false;
    goal = ["fresh", "reissue", "understand"].includes(settings.guideGoal) ? settings.guideGoal : "fresh";
    bar.querySelector("select").value = goal;
    bar.querySelector("#auto").textContent = `Auto guide: ${autoMove ? "on" : "off"}`; bar.querySelector("#ai").textContent = `AI help: ${ai ? "on" : "off"}`; scan();
  }).catch(scan);
})();
