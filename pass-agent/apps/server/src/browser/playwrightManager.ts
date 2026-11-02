import {
  chromium,
  type Browser,
  type BrowserContext,
  type CDPSession,
  type Locator,
  type Page,
} from "playwright";
import {
  isAllowedPortalUrl,
  VIEWPORT,
  type CanvasInput,
  type Frame,
} from "@pass-agent/shared";

export interface PlaywrightManagerOptions {
  headless: boolean;
  onFrame: (frame: Frame) => void;
  onBlockedNavigation?: (url: string) => void;
}

/**
 * Owns one Chromium instance + page for a session, streams CDP screencast
 * frames to the UI, and enforces the portal navigation allowlist.
 */
export class PlaywrightManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private pageRef: Page | null = null;
  private cdp: CDPSession | null = null;

  constructor(private readonly opts: PlaywrightManagerOptions) {}

  get page(): Page {
    if (!this.pageRef) throw new Error("Browser not launched");
    return this.pageRef;
  }

  get isLaunched(): boolean {
    return this.pageRef !== null;
  }

  async launch(): Promise<void> {
    if (this.pageRef) return;
    this.browser = await chromium.launch({ headless: this.opts.headless });
    this.context = await this.browser.newContext({
      viewport: { width: VIEWPORT.width, height: VIEWPORT.height },
      locale: "en-IN",
      timezoneId: "Asia/Kolkata",
      acceptDownloads: false,
    });

    // Block top-level navigations away from the portal. Sub-resources
    // (scripts, fonts, images) are left alone so the portal renders normally.
    await this.context.route("**/*", async (route) => {
      const request = route.request();
      const isTopLevelNav =
        request.isNavigationRequest() &&
        request.frame() === request.frame().page().mainFrame();
      if (isTopLevelNav && !isAllowedPortalUrl(request.url())) {
        this.opts.onBlockedNavigation?.(request.url());
        await route.abort("blockedbyclient");
        return;
      }
      await route.continue();
    });

    this.pageRef = await this.context.newPage();
    this.pageRef.on("popup", (popup) => {
      // Keep the session single-tab: close popups and replay allowed ones in place.
      const url = popup.url();
      void popup.close();
      if (isAllowedPortalUrl(url)) void this.navigate(url);
    });
    this.pageRef.on("dialog", (dialog) => {
      // Native alert()/confirm() would freeze the page; accept alerts, dismiss confirms.
      void (dialog.type() === "alert" ? dialog.accept() : dialog.dismiss());
    });

    await this.startScreencast();
  }

  private async startScreencast(): Promise<void> {
    if (!this.context || !this.pageRef) return;
    this.cdp = await this.context.newCDPSession(this.pageRef);
    this.cdp.on("Page.screencastFrame", (params) => {
      this.opts.onFrame({
        data: params.data,
        width: VIEWPORT.width,
        height: VIEWPORT.height,
        url: this.pageRef?.url() ?? "",
      });
      void this.cdp
        ?.send("Page.screencastFrameAck", { sessionId: params.sessionId })
        .catch(() => undefined);
    });
    await this.cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality: 60,
      maxWidth: VIEWPORT.width,
      maxHeight: VIEWPORT.height,
      everyNthFrame: 1,
    });
  }

  async navigate(url: string): Promise<void> {
    if (!isAllowedPortalUrl(url)) {
      throw new Error(`Navigation outside the Passport Seva portal is blocked: ${url}`);
    }
    await this.page.goto(url, { waitUntil: "domcontentloaded", timeout: 45_000 });
    await this.settle();
  }

  /** Wait for the page to quiet down after an action, without failing on slow portals. */
  async settle(): Promise<void> {
    try {
      await this.page.waitForLoadState("domcontentloaded", { timeout: 15_000 });
    } catch {
      // Slow or partial loads are reported via the next observation instead.
    }
    try {
      await this.page.waitForLoadState("networkidle", { timeout: 4_000 });
    } catch {
      // Long-polling pages never reach networkidle.
    }
  }

  locator(elementId: string): Locator {
    return this.page.locator(`[data-pa-id="${elementId.replace(/"/g, "")}"]`).first();
  }

  async screenshotBase64(sensitiveIds: string[] = []): Promise<string> {
    const buf = await this.page.screenshot({ type: "jpeg", quality: 55,
      mask: [this.page.locator('input[type="password"]'), ...sensitiveIds.map((id) => this.locator(id))],
    });
    return buf.toString("base64");
  }

  /** Forward human input from the canvas into the live page. */
  async dispatchInput(input: CanvasInput): Promise<void> {
    const page = this.page;
    switch (input.kind) {
      case "click":
        await page.mouse.click(input.x, input.y);
        break;
      case "scroll":
        await page.mouse.move(input.x, input.y);
        await page.mouse.wheel(0, input.deltaY);
        break;
      case "type":
        await page.keyboard.type(input.text);
        break;
      case "key":
        await page.keyboard.press(input.shift ? `Shift+${input.key}` : input.key);
        break;
    }
  }

  async close(): Promise<void> {
    try {
      await this.cdp?.send("Page.stopScreencast");
    } catch {
      // Page may already be gone.
    }
    await this.context?.close().catch(() => undefined);
    await this.browser?.close().catch(() => undefined);
    this.cdp = null;
    this.pageRef = null;
    this.context = null;
    this.browser = null;
  }
}
