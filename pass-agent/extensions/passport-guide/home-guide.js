(() => {
  if (document.querySelector('[data-passport-guide="home-outline"]')) return;
  const host = document.createElement("div"); host.dataset.passportGuide = "home";
  host.style.cssText = "display:block;width:100%;max-width:760px;box-sizing:border-box;margin:12px auto;clear:both";
  const root = host.attachShadow({mode:"open"});
  root.innerHTML = `<style>${PassportInlineTheme}
    .welcome{display:flex;align-items:center;gap:14px;flex-wrap:wrap;padding:12px 14px;border:1px solid #d9d2f3;border-radius:9px;background:#faf9ff}.intro{flex:1;min-width:180px}.intro p{font-size:12px;margin:3px 0;color:#635d78}.actions{display:flex;gap:8px;flex-wrap:wrap}.actions a,.actions .notice{border:0;font:inherit;cursor:pointer;font-size:12px;text-decoration:none;border-radius:6px;padding:9px 12px;background:#6856bf;color:white}.actions a.secondary{background:white;border:1px solid #d9d2f3;color:#594a96}.close{border:0;background:transparent;color:#716887;font-size:12px;padding:5px}.hint{font-size:11px;color:#716887;margin:5px 0 0}
    </style><section class="welcome" aria-label="Passport Coach home page guide"><div class="intro"><strong>✦ Let’s start your passport application</strong><p>First time here? Create an account. Already registered? Sign in to continue.</p><p class="hint" role="status">I have highlighted where to start.</p></div><div class="actions"><button class="notice" type="button" hidden>I’ve read it — continue</button><a class="new">I’m new — create account</a><a class="secondary existing">I already have an account</a></div><button class="close" type="button" aria-label="Hide home page guide">Hide</button></section>`;
  const outline = document.createElement("div"); outline.dataset.passportGuide = "home-outline";
  outline.style.cssText="position:fixed;inset:0;pointer-events:none;z-index:2147483646";
  const ringRoot = outline.attachShadow({mode:"open"});
  ringRoot.innerHTML='<style>.ring{position:fixed;box-sizing:border-box;border:2px solid #8174e6;box-shadow:0 0 0 4px #8174e619;border-radius:7px;pointer-events:none}[hidden]{display:none}</style><div class="ring" hidden></div>';
  document.documentElement.append(outline);
  let target = null, signature = "", dismissed = false, timer, noticeClose = null;
  const isHome = () => /^(?:\/|\/psp\/?)$/.test(location.pathname);
  const visible = el => el.isConnected && el.getBoundingClientRect().width > 1 && el.getBoundingClientRect().height > 1 && (!el.checkVisibility || el.checkVisibility({checkOpacity:true,checkVisibilityCSS:true}));
  function action(pattern) {
    return [...document.querySelectorAll('a[href]')].find(el => {
      if (el.closest('[data-passport-guide],footer') || !visible(el) || !pattern.test(el.textContent.trim())) return false;
      try { const url=new URL(el.href,location.href); return url.protocol==='https:' && /(^|\.)passportindia\.gov\.in$/.test(url.hostname); } catch { return false; }
    });
  }
  function position() {
    const ring=ringRoot.querySelector('.ring');
    if (!isHome() || dismissed || !host.isConnected || !target || !visible(target)) {ring.hidden=true;return;}
    const box=target.getBoundingClientRect();ring.hidden=box.bottom<0||box.top>innerHeight;
    ring.style.cssText=`left:${box.left-4}px;top:${box.top-4}px;width:${box.width+8}px;height:${box.height+8}px`;
  }
  function scan() {
    if (!isHome()) { host.remove(); target=null;signature="";dismissed=false;position();return; }
    if (dismissed) return;
    const dialog=[...document.querySelectorAll('[role=dialog][aria-modal=true],dialog[open]')].find(visible);
    const close=dialog?.querySelector('button[aria-label="Close"],button.btn-close');
    if (dialog && close && visible(close)) {
      const fresh=signature!=="notice" || !host.isConnected;
      signature="notice";noticeClose=close;target=close;
      root.querySelector('strong').textContent="✦ First, read the website’s notice";
      root.querySelector('.intro > p').textContent="Passport Seva has opened an important notice. Read it, then close it to start your application.";
      root.querySelector('.hint').textContent="The highlighted × closes this notice when you are ready.";
      root.querySelector('.new').hidden=root.querySelector('.existing').hidden=true;root.querySelector('.notice').hidden=false;
      const body=dialog.querySelector('.modal-body')||dialog;
      if(host.parentElement!==body) body.prepend(host);
      host.style.marginTop="12px";
      if(fresh) close.focus({preventScroll:true});
      position();return;
    }
    noticeClose=null;root.querySelector('.notice').hidden=true;
    root.querySelector('strong').textContent="✦ Let’s start your passport application";
    root.querySelector('.intro > p').textContent="First time here? Create an account. Already registered? Sign in to continue.";
    root.querySelector('.hint').textContent="I have highlighted where to start.";
    const register=action(/^(?:new user(?: registration)?|register|sign up|new user registration.*)$/i);
    const login=action(/^(?:existing user(?: login)?|login|log in|sign in|existing user login.*)$/i);
    if (!register && !login) {host.remove();target=null;position();return;}
    const nextSignature=[register?.href,login?.href].join('|');
    const fresh=!host.isConnected || signature!==nextSignature;
    signature=nextSignature;
    for(const [selector,link] of [['.new',register],['.existing',login]]) {
      const button=root.querySelector(selector);button.hidden=!link;
      if(link) button.href=link.href;
    }
    if (!host.isConnected || host.closest('[role=dialog],dialog')) {
      const navigation=(register||login).closest('header,nav,[role=navigation]');
      if(navigation) {
        // The live portal uses a fixed navigation header. Mount the note in
        // document flow below it, rather than inside its fixed-height row.
        document.body.prepend(host);
        host.style.marginTop=`${Math.max(12,navigation.getBoundingClientRect().bottom+12)}px`;
      } else {
        let anchor=register||login;
        if(register && login) {while(anchor.parentElement && !anchor.parentElement.matches('body,main') && !anchor.contains(login)) anchor=anchor.parentElement;}
        anchor.after(host);host.style.marginTop="12px";
      }
    }
    if(fresh) {
      target=register||login;
      target.scrollIntoView({behavior:'smooth',block:'center'});
      target.focus({preventScroll:true});
    }
    position();
  }
  root.querySelector('.notice').onclick=()=>{if(noticeClose?.isConnected) noticeClose.click();setTimeout(scan,200);};
  root.querySelector('.close').onclick=()=>{dismissed=true;host.remove();position();};
  for(const selector of ['.new','.existing']) root.querySelector(selector).addEventListener('focus',event=>{
    target=action(selector==='.new'?/^(?:new user(?: registration)?|register|sign up|new user registration.*)$/i:/^(?:existing user(?: login)?|login|log in|sign in|existing user login.*)$/i);position();
  });
  window.addEventListener('scroll',position,{passive:true,capture:true});window.addEventListener('resize',position);window.addEventListener('popstate',scan);
  new MutationObserver(records=>{
    if(records.every(record=>record.target.closest?.('[data-passport-guide]') || [...record.addedNodes,...record.removedNodes].every(node=>node.nodeType===1&&node.hasAttribute('data-passport-guide')))) return;
    clearTimeout(timer);timer=setTimeout(scan,180);
  }).observe(document.body,{childList:true,subtree:true});
  if(globalThis.PassportI18n) PassportI18n.mount(root,root.querySelector('.welcome'));
  scan();
})();
