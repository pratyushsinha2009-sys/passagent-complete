(() => {
  const normalize = (text) => String(text || "").toLowerCase().replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim();
  const employment = [
    ["student", "I am studying", /^student$/i],
    ["private", "I work for a private company", /^private( service| sector| employee)?$/i],
    ["self", "I run my own business or work for myself", /^self[ -]?employed$/i],
    ["government", "I work for the government", /^government( service| employee| servant)?$/i],
    ["psu", "I work for a public-sector undertaking", /^(psu|public sector undertaking|public sector)$/i],
    ["home", "I look after the home", /^(homemaker|home maker|housewife)$/i],
    ["unemployed", "I am not currently employed", /^(not employed|unemployed|not working)$/i],
    ["retired-government", "I retired from government service", /^retired government( (servant|employee))?$/i],
    ["retired-other", "I retired from other work", /^retired (private|other)( (service|employee))?$/i],
  ];
  const education = [
    ["below-eight", "I completed class 7 or below", /^(7th pass or less|7th or below|below 8th)$/i],
    ["eight-nine", "I completed class 8 or 9", /^(8th( to| and| &)? 9th( pass)?|between 8th and 9th standard)$/i],
    ["ten-plus", "I passed class 10, 11 or 12", /^(10th( pass)?( and| or)? above|matriculation( and above)?)$/i],
    ["graduate", "I completed a degree or higher qualification", /^(graduate( and| or)? above|graduation and above|graduate and post graduate)$/i],
  ];
  function followUp(field) {
    if (!field.options?.length) return null;
    const topic = PassportKnowledge.lookup(field).id;
    const choices = topic === "employment" ? employment : topic === "education" ? education : topic === "register-office" ? [["ordinary", "An ordinary personal passport", /^passport office$/i], ["official", "A diplomatic or official passport", /^cpv delhi$/i]] : null;
    if (!choices) return null;
    return { question: topic === "employment" ? "Which description matches your current situation?" : topic === "register-office" ? "Which kind of passport are you applying for?" : "What is the highest level you have completed?", choices: choices.map(([id, label, pattern]) => {
      const matches = field.options.filter((option) => pattern.test(normalize(option)));
      return { id, label, option: matches.length === 1 ? matches[0] : null };
    }), note: topic === "employment" ? "I will suggest a choice. You check it before using it. If two descriptions fit, read the official help." : topic === "register-office" ? "The registration page describes CPV Delhi for diplomatic/official applications. Check your service type before confirming." : "Choose a completed qualification, not a course you are still studying." };
  }
  function checkAnswer({ field, value, nativeValid = true, matchingValue, today }) {
    const filled = field.type === "checkbox" || field.type === "radio" ? field.filled : Boolean(String(value || "").trim());
    if (field.required && !filled) return { valid: false, message: "Please answer this question before continuing." };
    const topic = PassportKnowledge.lookup(field).id;
    if (!/^(radio|checkbox|select-one|select-multiple|password|file)$/.test(field.type) && ['father','mother','guardian','spouse','alias','surname','given-name','house','city','district','state','country','emergency-name','employment','education','declaration-place'].includes(topic)) {
      const letters=String(value||'').match(/\p{L}/gu)||[];
      if (letters.some(letter=>!(/\p{Script=Latin}/u).test(letter))) return { valid:false, message:'Enter this name or personal or professional detail in English letters. Your entry has not been changed.' };
    }
    const emailQuestion = field.type === "email" || topic === "email";
    if (emailQuestion && filled && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(value))) return { valid: false, message: "Check the email format, for example name@example.com. Use your own address." };
    if (!nativeValid || field.invalid) return { valid: false, message: emailQuestion ? "Check the email format, for example name@example.com. Use your own address." : "Check the format or message shown by the website for this answer." };
    const label = normalize(`${field.label} ${field.name}`);
    if (/confirm|re ?enter|retype|repeat/.test(label) && /password|e ?mail/.test(label) && filled && matchingValue !== undefined && value !== matchingValue) return { valid: false, message: /password/.test(label) ? "The two passwords do not match. Type the same password in both boxes." : "The two email addresses do not match. Check both boxes." };
    if (PassportKnowledge.lookup(field).id === "birth-date" && /^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      const date = new Date(`${value}T00:00:00Z`);
      if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return { valid: false, message: "Enter a real date of birth." };
      const now = new Date();
      const currentDate = today || `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
      if (value > currentDate) return { valid: false, message: "Your date of birth cannot be in the future. Check the day, month and year." };
    }
    return { valid: true, message: "" };
  }
  function nextQuestion(fields, currentId) {
    const index = fields.findIndex((field) => field.id === currentId);
    const pending = [...fields.slice(index + 1), ...fields.slice(0, index)].filter((field) => !field.confirmed && !field.skipped);
    return pending.find((field) => field.invalid)?.id || pending[0]?.id || null;
  }
  function stageFor(fields) {
    const topics = fields.map((field) => PassportKnowledge.lookup(field).id);
    if (topics.some((topic) => ["password", "confirm-password", "login-id", "same-login-email", "security-question"].includes(topic))) return "account";
    if (topics.some((topic) => ["given-name", "birth-date", "non-ecr", "employment", "education"].includes(topic))) return "applicant";
    return "other";
  }
  globalThis.PassportCoach = Object.freeze({ followUp, checkAnswer, nextQuestion, stageFor });
})();
