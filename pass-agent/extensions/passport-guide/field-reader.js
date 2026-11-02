(() => {
  const clean = (value, max = 240) => String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
  let labelCache = new WeakMap(), candidates = null;
  const choiceMeta = new WeakMap(), groupsByRoot = new WeakMap();
  let customGroups = [];
  function text(node) {
    if (!node) return "";
    if (node.nodeType === Node.TEXT_NODE) return clean(node.textContent);
    const copy = node.cloneNode(true);
    copy.querySelectorAll?.("input,select,textarea,button,script,style,[data-passport-guide]").forEach((child) => child.remove());
    return clean(copy.textContent);
  }
  function references(element, attribute) {
    return clean((element.getAttribute(attribute) || "").split(/\s+/).filter(Boolean).map((id) => text(document.getElementById(id))).join(" "));
  }
  function sectionFor(element) {
    const group = element.closest("fieldset,section,[role=group],[role=radiogroup],.form-section,.accordion-item,.panel,.card");
    let container = group;
    if (!container) for (let parent = element.parentElement; parent && parent !== document.body; parent = parent.parentElement) {
      if (parent.querySelector(":scope > h2,:scope > h3,:scope > legend") || parent.tagName === "FORM") { container = parent; break; }
    }
    return { element: container, label: clean(text(container?.querySelector("legend,h2,h3,.panel-title,.card-title")) || (container && references(container, "aria-labelledby")) || container?.getAttribute("aria-label") || text(document.querySelector("main h1,h1")) || document.title, 180) };
  }
  function spatialLabel(element) {
    const box = element.getBoundingClientRect();
    if (!candidates) candidates = [...document.querySelectorAll("label,span,p,div")].filter((node) => !node.closest("[data-passport-guide]") && !node.querySelector("input,select,textarea") && node.children.length < 5);
    let best = "", score = Infinity;
    for (const node of candidates) {
      if (node.contains(element) || element.contains(node)) continue;
      const rect = node.getBoundingClientRect(), value = text(node);
      if (!value || /^[*:\s]+$/.test(value) || value.length > 220 || rect.width < 4 || rect.height < 4 || rect.height > 90 || getComputedStyle(node).visibility === "hidden") continue;
      const distance = box.top - rect.bottom;
      if (distance < -8 || distance > 115 || rect.right < box.left - 5 || rect.left > box.right) continue;
      const weight = Math.max(0, distance) * 2 + Math.abs(rect.left - box.left) * 0.25 - (/\*|\?$/.test(value) ? 65 : 0);
      if (weight < score) { score = weight; best = value; }
    }
    return best;
  }
  function labelFor(element) {
    if (choiceMeta.has(element)) return choiceMeta.get(element).label;
    if (labelCache.has(element)) return labelCache.get(element);
    const result = findLabel(element);
    labelCache.set(element, result);
    return result;
  }
  function findLabel(element) {
    const accessible = references(element, "aria-labelledby") || clean(element.getAttribute("aria-label"));
    if (accessible) return accessible;
    const linked = [...(element.labels || [])].map(text).filter(Boolean).join(" ");
    if (linked) return clean(linked);
    const wrapper = element.closest("label");
    if (wrapper && text(wrapper)) return text(wrapper);
    if (element.matches('[role="radio"],[role="checkbox"]') && text(element)) return text(element).replace(/[\uE000-\uF8FF]/g, "").trim();
    if (element.matches("button,a,[role=button],input[type=submit],input[type=button]")) return clean(text(element) || element.getAttribute("value") || element.getAttribute("title"));
    const cell = element.closest("td,th");
    if (cell?.previousElementSibling && text(cell.previousElementSibling)) return text(cell.previousElementSibling);
    // Many portal forms use a span/div instead of a label linked with 'for'.
    for (let current = element, depth = 0; current && depth < 3; current = current.parentElement, depth++) {
      let previous = current.previousSibling;
      for (let count = 0; previous && count < 3; count++, previous = previous.previousSibling) {
        if (previous.nodeType === Node.ELEMENT_NODE && previous.matches("input,select,textarea,button,[data-passport-guide]")) continue;
        const candidate = text(previous);
        if (candidate && candidate.length <= 220 && !/^[*:\s]+$/.test(candidate)) return candidate;
      }
      const direct = current.parentElement?.querySelector(":scope > label,:scope > .control-label,:scope > .field-label,:scope > .form-label");
      if (direct && text(direct)) return text(direct);
      if (current.parentElement?.matches("form,fieldset,table,body")) break;
    }
    const identity = (element.getAttribute("name") || element.id || "").replace(/([a-z])([A-Z])/g, "$1 $2").replace(/[_:.-]+/g, " ");
    return clean(spatialLabel(element) || element.getAttribute("placeholder") || element.getAttribute("title") || identity || "Question needs clarification");
  }
  function radioGroup(element) {
    if (choiceMeta.has(element)) return choiceMeta.get(element).group.members;
    if (element.getAttribute("role") === "radio") {
      const group = element.closest('[role="radiogroup"]');
      if (group) return [...group.querySelectorAll('[role="radio"]')];
      for (let parent = element.parentElement, depth = 0; parent && depth < 4; parent = parent.parentElement, depth++) {
        const peers = [...parent.querySelectorAll('[role="radio"]')];
        if (peers.length > 1 && peers.length <= 8 && parent.getBoundingClientRect().height < 200) return peers;
      }
      return [element];
    }
    if (element.type !== "radio" || !element.name) return [element];
    return [...document.querySelectorAll('input[type="radio"]')].filter((other) => other.name === element.name && other.form === element.form);
  }
  function read(element, id) {
    const section = sectionFor(element);
    const group = radioGroup(element);
    const custom = choiceMeta.get(element);
    const type = custom ? "radio" : clean(element.type || element.getAttribute("role") || element.tagName.toLowerCase(), 40);
    const radioContainer = type === "radio" ? element.closest("[role=radiogroup],fieldset,.form-group,.form-field") : null;
    const radioQuestion = radioContainer && (references(radioContainer, "aria-labelledby") || text(radioContainer.querySelector(":scope > legend,:scope > .control-label,:scope > .field-label")) || radioContainer.getAttribute("aria-label"));
    const label = clean(custom?.group.question || radioQuestion || (element.getAttribute("role") === "radio" ? spatialLabel(group[0]) : "") || labelFor(element));
    // Only static hint elements, never input values or validation messages that may echo them.
    const describedIds = (element.getAttribute("aria-describedby") || "").split(/\s+/).filter((name) => /hint|help|instruction/i.test(name) && !/error|valid/i.test(name));
    const help = clean(describedIds.map((name) => text(document.getElementById(name))).join(" ") || element.getAttribute("aria-description") || element.getAttribute("placeholder"), 500);
    const isControl = element.matches("button,a,[role=button],input[type=submit],input[type=button]");
    const customChosen = custom && (custom.group.selected?.isConnected || custom.group.members.some((member) => {
      const indicator = choiceMeta.get(member)?.circle?.firstElementChild;
      return indicator && indicator.getBoundingClientRect().width > 2 && indicator.getBoundingClientRect().height > 2 && getComputedStyle(indicator).display !== "none";
    }));
    const filled = isControl ? false : custom ? customChosen : type === "radio" ? group.some((other) => other.checked || other.getAttribute("aria-checked") === "true") : type === "checkbox" ? element.checked || element.getAttribute("aria-checked") === "true" : type === "file" ? Boolean(element.files?.length) : Boolean(element.value?.trim());
    return { id, label, section: section.label, name: clean(element.getAttribute("name") || element.id, 180), help, type,
      required: group.some((other) => other.required) || element.getAttribute("aria-required") === "true" || /\*/.test(label),
      options: element.tagName === "SELECT" ? [...element.options].slice(0, 40).map((option) => clean(option.textContent, 160)) : type === "radio" ? group.slice(0, 40).map((other) => clean(labelFor(other), 160)) : [],
      filled: Boolean(filled), invalid: element.getAttribute("aria-invalid") === "true" || Boolean(element.validity && !element.validity.valid && (filled || element.dataset.paTouched === "true")),
    };
  }
  function customChoices() {
    const options = [];
    // The live registration form uses small circular pressable divs without radio roles.
    // Restrict adaptation to the observed question labels and circular control structure.
    for (const node of document.querySelectorAll('[data-focusable="true"][tabindex="0"]')) {
      if (node.closest("[data-passport-guide]")) continue;
      const label = text(node);
      if (!["CPV Delhi", "Passport Office", "Yes", "No"].includes(label)) continue;
      const container = node.parentElement;
      const circle = [...container.querySelectorAll('[data-focusable="true"]')].find((candidate) => { const r = candidate.getBoundingClientRect(); return r.width >= 10 && r.width <= 28 && r.height >= 10 && r.height <= 28 && parseFloat(getComputedStyle(candidate).borderRadius) > 3; });
      if (circle) options.push({ node, label, container, circle });
    }
    const roots = new Map();
    for (const option of options) for (let parent = option.container.parentElement, depth = 0; parent && depth < 4; parent = parent.parentElement, depth++) {
      const peers = options.filter((other) => parent.contains(other.node));
      if (peers.length >= 2 && peers.length <= 8 && !parent.querySelector("input,select,textarea") && parent.getBoundingClientRect().height < 200) { roots.set(parent, peers); break; }
    }
    customGroups = [];
    for (const [element, peers] of roots) {
      const officeChoice = peers.some((option) => option.label === "CPV Delhi") && peers.some((option) => option.label === "Passport Office");
      const officeLabel = officeChoice ? [...document.querySelectorAll("div,span,label")].map((node) => text(node)).find((value) => /^register to apply at\s*\*?$/i.test(value)) : "";
      const question = officeChoice ? officeLabel || "Register to apply at" : spatialLabel(element);
      if (!/register.*apply|login.*same.*mail/i.test(question)) continue;
      const group = groupsByRoot.get(element) || { element, selected: null };
      group.members = peers.map((option) => option.node); group.question = question; groupsByRoot.set(element, group); customGroups.push(group);
      for (const option of peers) choiceMeta.set(option.node, { ...option, group });
    }
    return customGroups.flatMap((group) => group.members);
  }
  function recordChoice(target) {
    for (const group of customGroups) for (const member of group.members) if (choiceMeta.get(member).container.contains(target)) { group.selected = member; return member; }
    return null;
  }
  globalThis.PassportFieldReader = Object.freeze({ read, labelFor, sectionFor, radioGroup, customChoices, recordChoice, customGroupFor: (element) => choiceMeta.get(element)?.group, invalidate: () => { labelCache = new WeakMap(); candidates = null; } });
})();
