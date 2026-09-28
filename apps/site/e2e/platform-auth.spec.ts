import { expect, test, type Page } from "@playwright/test";

const AUTH_PAGE = "/e2e/fixtures/platform-auth.html";
const GRANT_ID = "67d59575-e0ac-48f7-b92d-a449c9057c78";
const REPLACEMENT_GRANT_ID = "61fa840b-fd3f-4e31-87a2-986ae3f5921e";
const CAPABILITY = "memory_only_capability_123456789012345678901";

const interceptAuthorizationPage = async (page: Page) => {
  await page.context().route("https://mesurer.dev/**", (route) => route.fulfill({
    contentType: "text/html",
    body: "<!doctype html><title>Mesurer authorization</title>",
  }));
};

const capturePopup = async (page: Page) => {
  await page.addInitScript(() => {
    const originalOpen = window.open.bind(window);
    Object.assign(window, { __mesurerAuthPopup: null });
    window.open = (url?: string | URL, target?: string, features?: string) => {
      const popup = originalOpen("about:blank", target, features);
      Object.assign(window, { __mesurerAuthPopup: popup });
      return popup;
    };
  });
};

test("Settings connects and signs out of the Mesurer platform", async ({ page }) => {
  let codeVerifier = "";
  await interceptAuthorizationPage(page);
  await capturePopup(page);
  await page.route("https://api.mesurer.dev/api/oauth/token", async (route) => {
    const body = route.request().postDataJSON() as Record<string, unknown>;
    expect(body.clientId).toBe("mesurer-npm-toolbar");
    expect(body.callbackOrigin).toBe("https://mesurer.dev");
    expect(body.codeVerifier).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]{43,128}$/));
    codeVerifier = body.codeVerifier as string;
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        capability: CAPABILITY,
        expiresIn: 120,
        grantId: GRANT_ID,
        user: { id: "user-1", name: "Ada Lovelace", email: "ada@example.com", image: null },
        project: { id: "9f7d95e9-cd44-4162-b12d-c964cab42aa7", name: "Analytical Engine" },
      }),
    });
  });

  await page.goto(AUTH_PAGE);
  await page.getByRole("button", { name: /Settings/ }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect to Mesurer" }).click();
  const popupPage = await popupPromise;
  await popupPage.waitForURL(/^https:\/\/mesurer\.dev\/toolbar\/authorize/);
  const authorizationUrl = new URL(popupPage.url());
  expect(authorizationUrl.origin).toBe("https://mesurer.dev");
  expect(authorizationUrl.pathname).toBe("/toolbar/authorize");
  expect(authorizationUrl.searchParams.get("clientId")).toBe("mesurer-npm-toolbar");
  expect(authorizationUrl.searchParams.get("callbackOrigin")).toBe("https://mesurer.dev");
  expect(authorizationUrl.searchParams.get("declaredOrigin")).toBe("http://127.0.0.1:4173");
  expect(authorizationUrl.searchParams.get("state")).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]{32,}$/));
  expect(authorizationUrl.searchParams.get("codeChallenge")).toEqual(expect.stringMatching(/^[A-Za-z0-9_-]{43}$/));

  await page.evaluate(({ state }) => {
    const authWindow = window as Window & { __mesurerAuthPopup?: Window };
    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://mesurer.dev",
      source: window,
      data: { type: "mesurer:authorization", code: "ignored-code-that-is-long-enough-123456789", state },
    }));
    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://mesurer.dev",
      source: authWindow.__mesurerAuthPopup ?? null,
      data: { type: "mesurer:authorization", code: "valid-authorization-code-12345678901234567890", state },
    }));
  }, { state: authorizationUrl.searchParams.get("state") });

  const status = page.locator('[data-mesurer-platform-status="connected"]');
  await expect(status).toContainText("Ada Lovelace");
  await expect(status).toContainText("ada@example.com");
  await expect(status).toContainText("Analytical Engine");
  const expectedChallenge = await page.evaluate(async (verifier) => {
    const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(verifier));
    let value = "";
    for (const byte of new Uint8Array(digest)) value += String.fromCharCode(byte);
    return btoa(value).replace(/\+/g, "-").replace(/\//g, "_").replace(/=/g, "");
  }, codeVerifier);
  expect(authorizationUrl.searchParams.get("codeChallenge")).toBe(expectedChallenge);
  expect(await page.evaluate(() => ({
    grant: localStorage.getItem("mesurer-toolbar-grant"),
    values: Object.values(localStorage),
  }))).toEqual({
    grant: GRANT_ID,
    values: expect.not.arrayContaining([CAPABILITY]),
  });

  await page.getByRole("button", { name: "Sign out from toolbar" }).click();
  await expect(page.locator('[data-mesurer-platform-status="disconnected"]')).toBeVisible();
  await expect(page.getByRole("button", { name: "Connect to Mesurer" })).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("mesurer-toolbar-grant"))).toBeNull();
});

test("disconnects stale identity without deleting a replacement grant", async ({ page }) => {
  await interceptAuthorizationPage(page);
  await capturePopup(page);
  await page.route("https://api.mesurer.dev/api/oauth/token", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      capability: CAPABILITY,
      expiresIn: 120,
      grantId: GRANT_ID,
      user: { id: "user-1", name: "Ada Lovelace", email: "ada@example.com", image: null },
      project: { id: "9f7d95e9-cd44-4162-b12d-c964cab42aa7", name: "Analytical Engine" },
    }),
  }));

  await page.goto(AUTH_PAGE);
  await page.getByRole("button", { name: /Settings/ }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect to Mesurer" }).click();
  const popupPage = await popupPromise;
  await popupPage.waitForURL(/^https:\/\/mesurer\.dev\/toolbar\/authorize/);
  const state = new URL(popupPage.url()).searchParams.get("state");
  await page.evaluate(({ state }) => {
    const authWindow = window as Window & { __mesurerAuthPopup?: Window };
    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://mesurer.dev",
      source: authWindow.__mesurerAuthPopup ?? null,
      data: { type: "mesurer:authorization", code: "valid-authorization-code-12345678901234567890", state },
    }));
  }, { state });
  await expect(page.locator('[data-mesurer-platform-status="connected"]')).toBeVisible();

  await page.evaluate(({ replacementGrantId }) => {
    localStorage.setItem("mesurer-toolbar-grant", replacementGrantId);
    window.dispatchEvent(new StorageEvent("storage", {
      key: "mesurer-toolbar-grant",
      newValue: replacementGrantId,
      oldValue: null,
    }));
  }, { replacementGrantId: REPLACEMENT_GRANT_ID });

  await expect(page.locator('[data-mesurer-platform-status="disconnected"]')).toBeVisible();
  expect(await page.evaluate(() => localStorage.getItem("mesurer-toolbar-grant"))).toBe(REPLACEMENT_GRANT_ID);
});

test("accepts a callback from a popup that closes immediately", async ({ page }) => {
  await interceptAuthorizationPage(page);
  await capturePopup(page);
  await page.route("https://api.mesurer.dev/api/oauth/token", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      capability: CAPABILITY,
      expiresIn: 120,
      grantId: GRANT_ID,
      user: { id: "user-1", name: "Ada Lovelace", email: "ada@example.com", image: null },
      project: { id: "9f7d95e9-cd44-4162-b12d-c964cab42aa7", name: "Analytical Engine" },
    }),
  }));

  await page.goto(AUTH_PAGE);
  await page.getByRole("button", { name: /Settings/ }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect to Mesurer" }).click();
  const popupPage = await popupPromise;
  await popupPage.waitForURL(/^https:\/\/mesurer\.dev\/toolbar\/authorize/);
  const state = new URL(popupPage.url()).searchParams.get("state");
  await popupPage.evaluate(({ callbackOrigin, state }) => {
    window.opener?.postMessage({
      type: "mesurer:authorization",
      code: "valid-authorization-code-12345678901234567890",
      state,
    }, callbackOrigin);
    window.close();
  }, { callbackOrigin: new URL(page.url()).origin, state });

  await expect(page.locator('[data-mesurer-platform-status="connected"]')).toContainText("Ada Lovelace");
});

test("reuses a grant and rejects an untrusted callback", async ({ page }) => {
  await interceptAuthorizationPage(page);
  await capturePopup(page);
  await page.addInitScript((grantId) => localStorage.setItem("mesurer-toolbar-grant", grantId), GRANT_ID);
  let tokenRequests = 0;
  await page.route("https://api.mesurer.dev/api/oauth/token", async (route) => {
    tokenRequests += 1;
    await route.abort();
  });

  await page.goto(AUTH_PAGE);
  await page.getByRole("button", { name: /Settings/ }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect to Mesurer" }).click();
  const popupPage = await popupPromise;
  await popupPage.waitForURL(/^https:\/\/mesurer\.dev\/toolbar\/authorize/);
  const authorizationUrl = new URL(popupPage.url());
  expect(authorizationUrl.searchParams.get("grantId")).toBe(GRANT_ID);

  await page.evaluate(({ state }) => {
    const authWindow = window as Window & { __mesurerAuthPopup?: Window };
    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://attacker.example",
      source: authWindow.__mesurerAuthPopup ?? null,
      data: { type: "mesurer:authorization", code: "valid-authorization-code-12345678901234567890", state },
    }));
  }, { state: authorizationUrl.searchParams.get("state") });

  await expect(page.getByRole("alert")).toContainText("unexpected origin");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
  expect(tokenRequests).toBe(0);
  expect(await page.evaluate(() => localStorage.getItem("mesurer-toolbar-grant"))).toBe(GRANT_ID);
});

test("rejects a callback with the wrong state", async ({ page }) => {
  await interceptAuthorizationPage(page);
  await capturePopup(page);
  await page.goto(AUTH_PAGE);
  await page.getByRole("button", { name: /Settings/ }).click();
  await page.getByRole("button", { name: "Connect to Mesurer" }).click();
  await page.waitForFunction(() => Boolean((window as Window & { __mesurerAuthPopup?: Window }).__mesurerAuthPopup));
  await page.evaluate(() => {
    const authWindow = window as Window & { __mesurerAuthPopup?: Window };
    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://mesurer.dev",
      source: authWindow.__mesurerAuthPopup ?? null,
      data: { type: "mesurer:authorization", code: "valid-authorization-code-12345678901234567890", state: "wrong-state-value-that-is-long-enough" },
    }));
  });

  await expect(page.getByRole("alert")).toContainText("could not be verified");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});

test("rejects a malformed token response", async ({ page }) => {
  await interceptAuthorizationPage(page);
  await capturePopup(page);
  await page.route("https://api.mesurer.dev/api/oauth/token", (route) => route.fulfill({
    status: 200,
    contentType: "application/json",
    body: JSON.stringify({
      capability: "too-short",
      expiresIn: 0,
      grantId: "not-a-grant-id",
      user: { id: "", name: "", email: "", image: null },
      project: { id: "not-a-project-id", name: "" },
    }),
  }));

  await page.goto(AUTH_PAGE);
  await page.getByRole("button", { name: /Settings/ }).click();
  const popupPromise = page.waitForEvent("popup");
  await page.getByRole("button", { name: "Connect to Mesurer" }).click();
  const popupPage = await popupPromise;
  await popupPage.waitForURL(/^https:\/\/mesurer\.dev\/toolbar\/authorize/);
  const state = new URL(popupPage.url()).searchParams.get("state");
  await page.evaluate(({ state }) => {
    const authWindow = window as Window & { __mesurerAuthPopup?: Window };
    window.dispatchEvent(new MessageEvent("message", {
      origin: "https://mesurer.dev",
      source: authWindow.__mesurerAuthPopup ?? null,
      data: { type: "mesurer:authorization", code: "valid-authorization-code-12345678901234567890", state },
    }));
  }, { state });

  await expect(page.getByRole("alert")).toContainText("invalid authorization response");
  expect(await page.evaluate(() => localStorage.getItem("mesurer-toolbar-grant"))).toBeNull();
});

test("reports a blocked popup", async ({ page }) => {
  await page.addInitScript(() => {
    window.open = () => null;
  });
  await page.goto(AUTH_PAGE);
  await page.getByRole("button", { name: /Settings/ }).click();
  await page.getByRole("button", { name: "Connect to Mesurer" }).click();

  await expect(page.getByRole("alert")).toContainText("Allow popups");
  await expect(page.getByRole("button", { name: "Try again" })).toBeVisible();
});
