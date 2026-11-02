import { useEffect, useState } from "react";
import OperatorApp from "./OperatorApp";
import "./guide.css";

export default function App() {
  const [ready, setReady] = useState<boolean | null>(null);
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch("/health", { signal: controller.signal }).then((response) => response.json()).then((status: { modelConfigured?: boolean }) => setReady(status.modelConfigured === true)).catch(() => {});
    return () => controller.abort();
  }, []);
  if (new URLSearchParams(window.location.search).get("mode") === "operator") return <OperatorApp />;
  const extensionPath = "C:\\Users\\Asus-PC\\Documents\\PRATYUSH SINHA\\passagent\\pass-agent\\extensions\\passport-guide";
  return (
    <div className="guide-home">
      <nav className="guide-nav"><a href="/" className="guide-logo">✦ <strong>PassAgent</strong><span>YOUR PASSPORT COMPANION</span></a><span className="guide-pill"><i /> {ready === true ? "Coach ready · AI key saved" : ready === false ? "Coach ready · AI setup optional" : "Local coach ready"}</span></nav>
      <main className="guide-main">
        <section className="guide-hero">
          <div className="guide-kicker">A LITTLE GUIDANCE. A BIG NEXT STEP.</div>
          <h1>Your passport journey,<br /><em>with someone beside you.</em></h1>
          <p>Meet the agent that understands where you are, explains what to fill, and guides you to the next step — right on the real Passport Seva website.</p>
          <a className="guide-open" href="https://www.passportindia.gov.in/">Start guided journey <span>↗</span></a>
          <div className="guide-under">Install the guide once below. Then open the portal and it comes with you.</div>
          <div className="guide-traits"><span>◎ One question at a time</span><span>✧ Explains in plain language</span><span>↻ You confirm the next step</span></div>
        </section>
        <section className="guide-preview" aria-label="Example of the guidance experience">
          <div className="guide-preview-top"><span>YOUR JOURNEY</span><span>Applicant details · Step 3</span></div>
          <div className="guide-preview-field"><span>Given name</span><div>Aarav Kumar <span>✦</span></div><small>Fictional example</small></div>
          <div className="guide-preview-agent"><div className="guide-agent-label">✦ YOUR AGENT <span>Observing → Planning → Guiding</span></div><h2>Let’s get your name right.</h2><p>This is your first and middle name. Enter it as it appears in your supporting documents.</p><div className="guide-preview-plan"><span>✓ Find your application section</span><strong>● Explain the current field</strong><span>○ Check for missing details</span></div><div className="guide-preview-next">Next, we’ll look at your surname. <span>→</span></div></div>
          <div className="guide-preview-note">You fill the form. Your agent stays with you.</div>
        </section>
        <section className="guide-setup" id="install"><div><div className="guide-kicker">ONE-TIME SETUP</div><h2>Bring your guide onto the real website.</h2><p>Chrome and Edge need your permission to add a guide to another website. This takes about a minute.</p></div><ol><li><b>1</b><div><strong>Open your browser’s extensions page</strong><p>Type <code>chrome://extensions</code> in Chrome, or <code>edge://extensions</code> in Edge. Turn on <strong>Developer mode</strong>.</p></div></li><li><b>2</b><div><strong>Choose “Load unpacked”</strong><p>Select the Passport Guide folder:</p><button className="guide-copy" onClick={() => { void navigator.clipboard.writeText(extensionPath).then(() => setCopied(true)).catch(() => setCopied(false)); }}>{copied ? "✓ Folder path copied" : "Copy extension folder path"}</button><code className="guide-path">{extensionPath}</code></div></li><li><b>3</b><div><strong>Open Passport Seva and start your journey</strong><p>The coach explains one question at a time. It starts automatically. Type an answer, then press Enter to continue; choices move on automatically. Use Help me choose for supported dropdowns; you confirm every suggestion.</p></div></li></ol></section>
      </main>
      <footer className="guide-footer"><span>Independent assistant · Works on passportindia.gov.in</span><span>You control your answers, declarations and submission.</span></footer>
    </div>
  );
}
