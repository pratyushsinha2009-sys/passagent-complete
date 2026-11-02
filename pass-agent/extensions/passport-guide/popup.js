if(globalThis.PassportI18n) PassportI18n.mount(document,document.body);
document.getElementById("open").addEventListener("click", async () => {
  await chrome.tabs.create({ url: "https://www.passportindia.gov.in/" });
  window.close();
});
