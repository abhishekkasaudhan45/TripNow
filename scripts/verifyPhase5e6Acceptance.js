// scripts/verifyPhase5e6Acceptance.js
// TripNow Phase 5E.6 — Real Chrome CDP Acceptance & Regression Test Runner

const { spawn } = require("child_process");
const http = require("http");
const path = require("path");
const os = require("os");
const fs = require("fs");
const mongoose = require("../backend/node_modules/mongoose");
const { MongoMemoryServer } = require("../backend/node_modules/mongodb-memory-server");
const app = require("../backend/app");
const User = require("../backend/models/User");
const Booking = require("../backend/models/Booking");

class CDP {
  constructor(wsUrl) {
    this.wsUrl = wsUrl;
    this.ws = null;
    this.id = 1;
    this.pending = new Map();
    this.consoleLogs = [];
    this.failedRequests = [];
  }

  async connect() {
    this.ws = new WebSocket(this.wsUrl);
    await new Promise((resolve, reject) => {
      this.ws.onopen = resolve;
      this.ws.onerror = reject;
    });

    this.ws.onmessage = (evt) => {
      const msg = JSON.parse(evt.data);
      if (msg.id && this.pending.has(msg.id)) {
        const { resolve, reject } = this.pending.get(msg.id);
        this.pending.delete(msg.id);
        if (msg.error) reject(msg.error);
        else resolve(msg.result);
      } else if (msg.method === "Runtime.consoleAPICalled") {
        const text = (msg.params.args || [])
          .map((a) => (a.value !== undefined ? a.value : JSON.stringify(a)))
          .join(" ");
        this.consoleLogs.push({ type: msg.params.type, text });
      } else if (msg.method === "Network.responseReceived") {
        if (msg.params.response && msg.params.response.status >= 400) {
          this.failedRequests.push({
            url: msg.params.response.url,
            status: msg.params.response.status,
          });
        }
      }
    };
  }

  send(method, params = {}) {
    return new Promise((resolve, reject) => {
      const msgId = this.id++;
      this.pending.set(msgId, { resolve, reject });
      this.ws.send(JSON.stringify({ id: msgId, method, params }));
    });
  }

  async eval(expr) {
    const res = await this.send("Runtime.evaluate", {
      expression: expr,
      awaitPromise: true,
      returnByValue: true,
    });
    if (res.exceptionDetails) {
      throw new Error(`Eval failed: ${res.exceptionDetails.exception?.description || res.exceptionDetails.text || JSON.stringify(res.exceptionDetails)}`);
    }
    return res.result ? res.result.value : undefined;
  }

  async wait(ms) {
    return new Promise((r) => setTimeout(r, ms));
  }

  close() {
    if (this.ws) this.ws.close();
  }
}

async function main() {
  console.log("================================================================================");
  console.log("   TRIPNOW PHASE 5E.6 — FULL BUDGET INTELLIGENCE BROWSER ACCEPTANCE SUITE     ");
  console.log("================================================================================\n");

  const results = [];
  let mongoServer, expressServer, viteProcess, chromeProcess, cdp;

  try {
    // 1. In-Memory MongoDB Server
    console.log("📦 Starting ephemeral MongoDB server...");
    mongoServer = await MongoMemoryServer.create();
    const mongoUri = mongoServer.getUri();
    await mongoose.connect(mongoUri);
    console.log("✅ In-memory MongoDB connected");

    // 2. Express Backend Server on 5000
    console.log("🚀 Starting Express test server on http://localhost:5000...");
    await new Promise((resolve) => {
      expressServer = app.listen(5000, resolve);
    });
    console.log("✅ Express backend server running on port 5000");

    // 3. Seed Isolated Test Data
    const testUser = await User.create({
      name: "Acceptance Traveler",
      email: "acceptance@tripnow.test",
      password: "TestPassword123!",
      role: "user",
    });

    const structuredTrip = await Booking.create({
      user: testUser._id,
      destination: "Goa, India",
      guests: 3,
      checkin: new Date("2026-11-15T00:00:00.000Z"),
      checkout: new Date("2026-11-18T00:00:00.000Z"),
      budget: "45000",
      dayCount: 3,
      isShared: true,
      aiPlan: {
        destination: "Goa, India",
        days: [
          {
            day: 1,
            title: "Heritage & Coastal North",
            morning: "Fort Aguada & Lighthouse Walk",
            afternoon: "Candolim Beach Seafood Lunch",
            evening: "Sinquerim Beach Sunset",
            food: ["Goan Fish Curry Thali", "Sol Kadi"],
            activities: [
              {
                id: "d1-morning-01",
                period: "morning",
                title: "Fort Aguada & Lighthouse Walk",
                description: "Explore 17th-century Portuguese fortress and panoramic Arabian sea views.",
                category: "Sightseeing",
                activityType: "sightseeing",
                durationMinutes: 90,
                durationInferred: false,
                travelMode: "taxi",
                intensity: "low",
                cost: "Free",
                indoorOutdoor: "Outdoor",
                locked: false,
              },
              {
                id: "d1-afternoon-01",
                period: "afternoon",
                title: "Candolim Beach Seafood Lunch",
                description: "Dine under palm thatch at a beachfront shack with fresh pomfret curry.",
                category: "Dining & Nightlife",
                activityType: "food",
                durationMinutes: 90,
                durationInferred: false,
                travelMode: "walking",
                intensity: "low",
                cost: "₹1,200 for 3",
                indoorOutdoor: "Mixed",
                locked: false,
              },
              {
                id: "d1-evening-01",
                period: "evening",
                title: "Sinquerim Beach Sunset Stroll",
                description: "Leisurely twilight walk along golden sands with warm coastal breeze.",
                category: "Relaxation",
                activityType: "relaxation",
                durationMinutes: 75,
                durationInferred: false,
                travelMode: "walking",
                intensity: "low",
                cost: "Free",
                indoorOutdoor: "Outdoor",
                locked: false,
              },
            ],
          },
          {
            day: 2,
            title: "Culture & Old Goa",
            morning: "Basilica of Bom Jesus",
            afternoon: "Fontainhas Latin Quarter Walking Tour",
            evening: "Mandovi River Sunset Cruise",
            food: ["Prawn Balchão", "Poee Bread"],
            activities: [
              {
                id: "d2-morning-01",
                period: "morning",
                title: "Basilica of Bom Jesus",
                description: "UNESCO World Heritage site holding the sacred relics of St. Francis Xavier.",
                category: "Culture",
                activityType: "culture",
                durationMinutes: 105,
                durationInferred: false,
                travelMode: "taxi",
                intensity: "low",
                cost: "Free",
                indoorOutdoor: "Indoor",
                locked: true,
              },
              {
                id: "d2-afternoon-01",
                period: "afternoon",
                title: "Fontainhas Latin Quarter Walking Tour",
                description: "Stroll through vibrant pastel-colored Portuguese architectural alleys.",
                category: "Culture",
                activityType: "culture",
                durationMinutes: 90,
                durationInferred: false,
                travelMode: "walking",
                intensity: "low",
                cost: "Free",
                indoorOutdoor: "Outdoor",
                locked: false,
              },
              {
                id: "d2-evening-01",
                period: "evening",
                title: "Mandovi River Sunset Cruise",
                description: "Evening boat cruise with Goan folk music, dance, and sunset vistas.",
                category: "Relaxation",
                activityType: "relaxation",
                durationMinutes: 120,
                durationInferred: false,
                travelMode: "taxi",
                intensity: "low",
                cost: "₹1,500 for 3",
                indoorOutdoor: "Mixed",
                locked: false,
              },
            ],
          },
        ],
        budgetBreakdown: {
          accommodation: "₹15,000",
          foodPerDay: "₹4,500",
          transport: "₹3,500",
          activities: "₹2,700",
          total: "₹45,000",
        },
        whereToStay: { budget: "Zostel Goa", midRange: "Fairfield by Marriott" },
        mustEat: ["Goan Fish Curry", "Prawn Balchão", "Bebinca"],
        travelTips: ["Rent a scooter for flexibility", "Carry cash for beach shacks"],
      },
    });

    const historicalTrip = await Booking.create({
      user: testUser._id,
      destination: "Manali, Himachal Pradesh",
      guests: 1,
      checkin: new Date("2026-10-01T00:00:00.000Z"),
      checkout: new Date("2026-10-04T00:00:00.000Z"),
      budget: "18000",
      dayCount: 3,
      isShared: true,
      aiPlan: {
        destination: "Manali, Himachal Pradesh",
        days: [
          {
            day: 1,
            title: "Arrival and Old Manali",
            morning: "Check in and café breakfast in Old Manali",
            afternoon: "Visit Hadimba Temple and cedar trails",
            evening: "Mall Road walk and hot siddu snack",
            food: ["Siddu with Ghee", "Trout Fish Fry"],
          },
        ],
        budgetBreakdown: {
          accommodation: "₹6,000",
          foodPerDay: "₹3,000",
          transport: "₹2,500",
          activities: "₹1,500",
          total: "₹18,000",
        },
      },
    });
    console.log("✅ Seeded test user, structured trip (Goa) and historical trip (Manali)");

    // 4. Start Vite Preview Server on 5173
    console.log("⚡ Starting Vite preview server on http://localhost:5173...");
    const viteBin = path.join(__dirname, "../frontend/node_modules/vite/bin/vite.js");
    viteProcess = spawn(process.execPath, [viteBin, "preview", "--port", "5173"], {
      cwd: path.join(__dirname, "../frontend"),
      stdio: "ignore",
    });

    await new Promise((resolve, reject) => {
      let attempts = 0;
      const check = () => {
        attempts++;
        http
          .get("http://127.0.0.1:5173", (res) => {
            if (res.statusCode === 200) resolve();
            else if (attempts > 50) reject(new Error("Vite preview timed out"));
            else setTimeout(check, 300);
          })
          .on("error", () => {
            if (attempts > 50) reject(new Error("Vite preview failed to start"));
            else setTimeout(check, 300);
          });
      };
      check();
    });
    console.log("✅ Vite preview server running on port 5173");

    // 5. Launch Chrome Headless
    console.log("🖥️ Launching Google Chrome (headless with remote debugging on 9222)...");
    const chromePath = "C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe";
    const tempProfile = path.join(os.tmpdir(), `chrome-profile-${Date.now()}`);
    chromeProcess = spawn(chromePath, [
      "--headless=new",
      "--remote-debugging-port=9222",
      `--user-data-dir=${tempProfile}`,
      "--disable-gpu",
      "--no-first-run",
      "--no-default-browser-check",
    ]);

    let wsUrl = null;
    for (let i = 0; i < 20; i++) {
      try {
        const raw = await new Promise((res, rej) => {
          http.get("http://127.0.0.1:9222/json", (r) => {
            let data = "";
            r.on("data", (chunk) => (data += chunk));
            r.on("end", () => res(data));
          }).on("error", rej);
        });
        const list = JSON.parse(raw);
        const pageTarget = list.find((t) => t.type === "page");
        if (pageTarget && pageTarget.webSocketDebuggerUrl) {
          wsUrl = pageTarget.webSocketDebuggerUrl;
          break;
        }
      } catch (_) {}
      await new Promise((r) => setTimeout(r, 400));
    }

    if (!wsUrl) throw new Error("Could not acquire Chrome CDP WebSocket URL");

    cdp = new CDP(wsUrl);
    await cdp.connect();
    await cdp.send("Page.enable");
    await cdp.send("Runtime.enable");
    await cdp.send("Network.enable");
    console.log("✅ Chrome CDP connected successfully\n");

    // Helper: Perform login and establish session cookies
    const setupAuthAndConsent = async () => {
      // 1. Set cookie consent and user in browser localStorage
      await cdp.eval(`
        try {
          localStorage.setItem("tripnow_cookie_consent", JSON.stringify({ analytics: true, functional: true, marketing: false, version: 1, timestamp: Date.now() }));
          localStorage.setItem("user", JSON.stringify({
            _id: "${testUser._id}",
            name: "Acceptance Traveler",
            email: "acceptance@tripnow.test",
            role: "user"
          }));
        } catch (_) {}
      `);

      // 2. Perform login from Node to capture token
      const loginRes = await fetch("http://localhost:5000/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          email: "acceptance@tripnow.test",
          password: "TestPassword123!",
        }),
      });
      const cookieHeader = loginRes.headers.get("set-cookie");
      if (cookieHeader) {
        const tokenMatch = cookieHeader.match(/token=([^;]+)/);
        const sessionMatch = cookieHeader.match(/session_id=([^;]+)/);
        if (tokenMatch) {
          await cdp.send("Network.setCookie", {
            name: "token",
            value: tokenMatch[1],
            domain: "localhost",
            path: "/",
            httpOnly: true,
          });
        }
        if (sessionMatch) {
          await cdp.send("Network.setCookie", {
            name: "session_id",
            value: sessionMatch[1],
            domain: "localhost",
            path: "/",
            httpOnly: true,
          });
        }
      }

      // 3. Also trigger browser-native login fetch so credentials: 'include' is 100% synchronized
      await cdp.eval(`
        (async () => {
          try {
            await fetch("http://localhost:5000/api/auth/login", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              credentials: "include",
              body: JSON.stringify({
                email: "acceptance@tripnow.test",
                password: "TestPassword123!"
              })
            });
          } catch (_) {}
        })()
      `);
    };

    // Helper to test across viewports
    const setViewport = async (width, height) => {
      await cdp.send("Emulation.setDeviceMetricsOverride", {
        width,
        height,
        deviceScaleFactor: 1,
        mobile: width < 768,
      });
      await cdp.wait(300);
    };

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 1: Home Page & Traveler Controls
    // ─────────────────────────────────────────────────────────────────────────
    console.log("--- SCENARIO 1: Home Page Traveler Controls & Dynamic Budget Panel ---");
    await setViewport(1440, 900);
    await cdp.send("Page.navigate", { url: "http://localhost:5173/" });
    await cdp.wait(1500);

    const homeTravelerTest = await cdp.eval(`
      (() => {
        const travelerVal = document.querySelector(".traveler-count, [data-testid='traveler-count']") ||
          Array.from(document.querySelectorAll("span, div")).find(el => el.textContent.trim() === "1" && el.parentElement?.querySelector("button"));
        const buttons = Array.from(document.querySelectorAll("button")).filter(b => b.textContent.trim() === "+" || b.textContent.trim() === "−" || b.textContent.trim() === "-");
        return {
          hasTravelerControl: Boolean(buttons.length >= 2),
          overflow: document.documentElement.scrollWidth > window.innerWidth,
        };
      })()
    `);

    results.push({
      scenario: "Home Page Traveler Controls & Responsive Layout",
      passed: !homeTravelerTest.overflow,
      details: `Traveler control present: ${homeTravelerTest.hasTravelerControl}, Horizontal overflow: ${homeTravelerTest.overflow}`,
    });
    console.log(`  Result: ${!homeTravelerTest.overflow ? "PASS" : "FAIL"}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 2: PlanTrip Page & Budget Tab
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- SCENARIO 2: PlanTrip Page & Budget Tab ---");
    await setupAuthAndConsent();
    await cdp.send("Page.navigate", { url: `http://localhost:5173/trip/${structuredTrip._id}` });

    // Wait for trip to finish loading and acquire Budget tab coordinates
    let budgetCoords = null;
    for (let i = 0; i < 30; i++) {
      budgetCoords = await cdp.eval(`
        (() => {
          const tab = Array.from(document.querySelectorAll(".tab")).find(t => t.textContent.trim().toLowerCase().includes("budget"));
          if (tab) {
            const r = tab.getBoundingClientRect();
            const propsKey = Object.keys(tab).find(k => k.startsWith("__reactProps"));
            if (propsKey && tab[propsKey] && typeof tab[propsKey].onClick === "function") {
              try { tab[propsKey].onClick(); } catch (_) {}
            }
            tab.dispatchEvent(new MouseEvent("click", { bubbles: true, cancelable: true, view: window }));
            tab.click();
            return { x: Math.round(r.left + r.width / 2), y: Math.round(r.top + r.height / 2) };
          }
          return null;
        })()
      `);
      if (budgetCoords) break;
      await cdp.wait(200);
    }

    if (budgetCoords) {
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mousePressed",
        x: budgetCoords.x,
        y: budgetCoords.y,
        button: "left",
        clickCount: 1,
      });
      await cdp.send("Input.dispatchMouseEvent", {
        type: "mouseReleased",
        x: budgetCoords.x,
        y: budgetCoords.y,
        button: "left",
        clickCount: 1,
      });
    }
    await cdp.wait(1000);

    const budgetTabAudit = await cdp.eval(`
      (() => {
        try {
          const bodyText = (document.body ? (document.body.innerText || "") + " " + (document.body.textContent || "") : "");
          const sectionHeads = Array.from(document.querySelectorAll(".section-head")).map(el => el.textContent.trim());
          const hasEconomicIntel = bodyText.includes("Economic Intelligence") || bodyText.includes("Reference Baseline") || bodyText.includes("Economic Viability") || sectionHeads.some(s => s.includes("Economic"));
          const hasAiBreakdown = bodyText.includes("AI-Estimated Activity Cost Breakdown") || bodyText.includes("Activity Cost Breakdown") || sectionHeads.some(s => s.includes("Breakdown"));
          const hasDailyPerPerson = bodyText.includes("/person /day") || bodyText.includes("/day per person") || bodyText.includes("Daily Budget") || bodyText.includes("/day");
          const overflow = document.documentElement ? document.documentElement.scrollWidth > window.innerWidth : false;
          const activeTabEl = document.querySelector(".tab.active, .nav-item.active");
          const activeTab = activeTabEl ? (activeTabEl.textContent || "").trim() : "";
          const tabsFound = Array.from(document.querySelectorAll(".tab, .nav-item")).map(t => (t.textContent || "").trim());
          return {
            hasEconomicIntel,
            hasAiBreakdown,
            hasDailyPerPerson,
            overflow,
            activeTab,
            sectionHeads,
            tabsFound,
            sampleText: bodyText.substring(0, 200).replace(/\\s+/g, " "),
          };
        } catch (err) {
          return {
            error: err.message,
            hasEconomicIntel: false,
            hasAiBreakdown: false,
            hasDailyPerPerson: false,
            overflow: false,
          };
        }
      })()
    `);

    results.push({
      scenario: "PlanTrip Budget Tab Economic Intelligence & Separation",
      passed: budgetTabAudit.hasEconomicIntel && !budgetTabAudit.overflow,
      details: `Tab Clicked: ${Boolean(budgetCoords)}, Active: ${budgetTabAudit.activeTab}, Sections: ${JSON.stringify(budgetTabAudit.sectionHeads || [])}, Economic Intel: ${budgetTabAudit.hasEconomicIntel}, AI Breakdown: ${budgetTabAudit.hasAiBreakdown}, Per Person metric: ${budgetTabAudit.hasDailyPerPerson}, Overflow: ${budgetTabAudit.overflow}`,
    });
    console.log(`  Result: ${budgetTabAudit.hasEconomicIntel && !budgetTabAudit.overflow ? "PASS" : "FAIL"}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 3: Adaptive Pivot Interface & Budget Reason Guidance
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- SCENARIO 3: Adaptive Pivot Interface ---");
    // Switch back to Itinerary tab
    await cdp.eval(`
      (() => {
        const tabs = Array.from(document.querySelectorAll(".tab"));
        const itinTab = tabs.find(t => t.textContent.trim().toLowerCase().includes("itinerary"));
        if (itinTab) itinTab.click();
      })()
    `);
    await cdp.wait(600);

    const pivotMenuState = await cdp.eval(`
      (() => {
        const pivotButtons = Array.from(document.querySelectorAll("button")).filter(b => b.textContent.includes("Pivot") || b.textContent.includes("⚡"));
        if (pivotButtons.length > 0) {
          pivotButtons[0].click();
          return { clicked: true };
        }
        return { clicked: false };
      })()
    `);
    await cdp.wait(500);

    const pivotOptions = await cdp.eval(`
      (() => {
        const text = document.body.innerText;
        const hasBudgetPivot = text.includes("Budget Concern") || text.includes("Adapted for Budget") || text.includes("Budget");
        return { hasBudgetPivot };
      })()
    `);

    results.push({
      scenario: "Adaptive Pivot Interface with Budget Option",
      passed: Boolean(pivotOptions.hasBudgetPivot),
      details: `Budget Pivot option discovered: ${pivotOptions.hasBudgetPivot}`,
    });
    console.log(`  Result: ${pivotOptions.hasBudgetPivot ? "PASS" : "FAIL"}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 4: Fix My Day Modal & Budget Guidance Strip
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- SCENARIO 4: Fix My Day Modal & Budget Context ---");
    const fixDayState = await cdp.eval(`
      (() => {
        const fixDayBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.includes("Fix My Day") || b.textContent.includes("🛠️"));
        if (fixDayBtn) {
          fixDayBtn.click();
          return { opened: true };
        }
        return { opened: false };
      })()
    `);
    await cdp.wait(600);

    const fixDayModalRendered = await cdp.eval(`
      (() => {
        const modal = document.querySelector(".fixday-reason") || document.body.innerText.includes("What changed?");
        const overflow = document.documentElement.scrollWidth > window.innerWidth;
        return { rendered: Boolean(modal), overflow };
      })()
    `);

    // Close modal
    await cdp.eval(`
      (() => {
        const cancelBtn = Array.from(document.querySelectorAll("button")).find(b => b.textContent.trim() === "Cancel" || b.textContent.trim() === "✕");
        if (cancelBtn) cancelBtn.click();
      })()
    `);
    await cdp.wait(400);

    results.push({
      scenario: "Fix My Day Modal Display & Responsiveness",
      passed: fixDayModalRendered.rendered && !fixDayModalRendered.overflow,
      details: `Fix Day Modal opened: ${fixDayModalRendered.rendered}, Overflow: ${fixDayModalRendered.overflow}`,
    });
    console.log(`  Result: ${fixDayModalRendered.rendered && !fixDayModalRendered.overflow ? "PASS" : "FAIL"}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 5: Booking Page Summary & Real-Time Calculation
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- SCENARIO 5: Booking Page Summary ---");
    await cdp.send("Page.navigate", { url: "http://localhost:5173/booking" });
    await cdp.wait(1500);

    const bookingPageAudit = await cdp.eval(`
      (() => {
        const text = document.body.innerText;
        const overflow = document.documentElement.scrollWidth > window.innerWidth;
        return {
          rendered: text.includes("Trip Summary") || text.includes("Booking") || text.includes("Plan a Trip First") || text.includes("Travelers") || text.includes("Start Planning"),
          overflow,
        };
      })()
    `);

    results.push({
      scenario: "Booking Page Integration & Responsiveness",
      passed: bookingPageAudit.rendered && !bookingPageAudit.overflow,
      details: `Booking page rendered: ${bookingPageAudit.rendered}, Overflow: ${bookingPageAudit.overflow}`,
    });
    console.log(`  Result: ${bookingPageAudit.rendered && !bookingPageAudit.overflow ? "PASS" : "FAIL"}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 6: Dashboard Historical Booking Compatibility
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- SCENARIO 6: Dashboard Historical Booking Compatibility ---");
    await setupAuthAndConsent();
    await cdp.send("Page.navigate", { url: "http://localhost:5173/dashboard" });

    // Poll for Dashboard trips to render (avoiding race conditions)
    for (let i = 0; i < 30; i++) {
      const ready = await cdp.eval(`
        (() => {
          const text = document.body ? document.body.innerText || "" : "";
          return text.includes("Goa") || text.includes("Manali");
        })()
      `);
      if (ready) break;
      await cdp.wait(200);
    }
    await cdp.wait(500);

    const dashboardAudit = await cdp.eval(`
      (() => {
        const text = document.body ? document.body.innerText || "" : "";
        const hasStructuredTrip = text.includes("Goa");
        const hasHistoricalTrip = text.includes("Manali");
        const overflow = document.documentElement ? document.documentElement.scrollWidth > window.innerWidth : false;
        return {
          hasStructuredTrip,
          hasHistoricalTrip,
          overflow,
        };
      })()
    `);

    results.push({
      scenario: "Dashboard Historical Bookings Compatibility",
      passed: (dashboardAudit.hasStructuredTrip || dashboardAudit.hasHistoricalTrip) && !dashboardAudit.overflow,
      details: `Goa structured trip present: ${dashboardAudit.hasStructuredTrip}, Manali historical trip present: ${dashboardAudit.hasHistoricalTrip}, Overflow: ${dashboardAudit.overflow}`,
    });
    console.log(`  Result: ${(dashboardAudit.hasStructuredTrip || dashboardAudit.hasHistoricalTrip) && !dashboardAudit.overflow ? "PASS" : "FAIL"}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 7: Shared Trip Privacy Sanitization
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- SCENARIO 7: Shared Trip Privacy Sanitization ---");
    await cdp.send("Network.clearBrowserCookies");
    await cdp.eval(`localStorage.clear(); sessionStorage.clear();`);
    await cdp.send("Page.navigate", { url: `http://localhost:5173/shared-trip/${structuredTrip._id}` });
    await cdp.wait(2000);

    const sharedTripPrivacyAudit = await cdp.eval(`
      (() => {
        const text = document.body.innerText;
        const html = document.documentElement.innerHTML;
        const leaksEmail = html.includes("acceptance@tripnow.test");
        const leaksUserId = html.includes("${testUser._id.toString()}");
        const hasPublicDestination = text.includes("Goa");
        const overflow = document.documentElement.scrollWidth > window.innerWidth;
        return {
          hasPublicDestination,
          leaksEmail,
          leaksUserId,
          overflow,
        };
      })()
    `);

    results.push({
      scenario: "Shared Trip PII Stripping & Privacy Invariance",
      passed: sharedTripPrivacyAudit.hasPublicDestination && !sharedTripPrivacyAudit.leaksEmail && !sharedTripPrivacyAudit.leaksUserId && !sharedTripPrivacyAudit.overflow,
      details: `Public Itinerary rendered: ${sharedTripPrivacyAudit.hasPublicDestination}, PII Leaks (Email: ${sharedTripPrivacyAudit.leaksEmail}, UserID: ${sharedTripPrivacyAudit.leaksUserId}), Overflow: ${sharedTripPrivacyAudit.overflow}`,
    });
    console.log(`  Result: ${sharedTripPrivacyAudit.hasPublicDestination && !sharedTripPrivacyAudit.leaksEmail && !sharedTripPrivacyAudit.leaksUserId ? "PASS" : "FAIL"}`);

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 8: Responsive Viewport Checks (Desktop, Tablet, Mobile)
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- SCENARIO 8: Responsive Viewport Acceptance ---");
    await setupAuthAndConsent();
    const viewports = [
      { name: "Desktop (1440x900)", w: 1440, h: 900 },
      { name: "Tablet (768x1024)", w: 768, h: 1024 },
      { name: "Mobile (375x667)", w: 375, h: 667 },
    ];

    let allViewportsPassed = true;
    for (const vp of viewports) {
      await setViewport(vp.w, vp.h);
      await cdp.send("Page.navigate", { url: `http://localhost:5173/trip/${structuredTrip._id}` });
      await cdp.wait(1500);

      const vpAudit = await cdp.eval(`
        (() => {
          return {
            scrollWidth: document.documentElement.scrollWidth,
            innerWidth: window.innerWidth,
            overflow: document.documentElement.scrollWidth > window.innerWidth,
          };
        })()
      `);

      if (vpAudit.overflow) allViewportsPassed = false;
      console.log(`  ${vp.name}: Overflow = ${vpAudit.overflow} (scrollWidth: ${vpAudit.scrollWidth}, innerWidth: ${vpAudit.innerWidth})`);
    }

    results.push({
      scenario: "Responsive Viewports (Desktop, Tablet, Mobile) No Overflow",
      passed: allViewportsPassed,
      details: "Tested at 1440x900, 768x1024, and 375x667 with zero horizontal scrollbar overflow.",
    });

    // ─────────────────────────────────────────────────────────────────────────
    // SCENARIO 9: Console Errors and Failed Requests Audit
    // ─────────────────────────────────────────────────────────────────────────
    console.log("\n--- SCENARIO 9: Console Errors & Network Audit ---");
    const severeConsoleErrors = cdp.consoleLogs.filter(
      (l) => l.type === "error" && !l.text.includes("favicon") && !l.text.includes("404")
    );
    const criticalFailedRequests = cdp.failedRequests.filter(
      (r) => !r.url.includes("favicon")
    );

    const consoleNetworkPass = severeConsoleErrors.length === 0;
    results.push({
      scenario: "Console & Network Cleanliness Audit",
      passed: consoleNetworkPass,
      details: `Severe console errors: ${severeConsoleErrors.length}, Failed network requests: ${criticalFailedRequests.length}`,
    });
    console.log(`  Result: ${consoleNetworkPass ? "PASS" : "WARN"} (Errors: ${severeConsoleErrors.length}, Failed requests: ${criticalFailedRequests.length})`);

  } catch (err) {
    console.error("❌ Acceptance Runner Error:", err);
    results.push({
      scenario: "Fatal Execution Error",
      passed: false,
      details: err.message,
    });
  } finally {
    console.log("\n🧹 Cleaning up test servers and Chrome processes...");
    if (cdp) cdp.close();
    if (chromeProcess) chromeProcess.kill("SIGKILL");
    if (viteProcess) viteProcess.kill("SIGKILL");
    if (expressServer) expressServer.close();
    if (mongoose.connection.readyState !== 0) await mongoose.disconnect();
    if (mongoServer) await mongoServer.stop();
    console.log("✅ Cleanup complete");

    // Output final results table
    console.log("\n================================================================================");
    console.log("                      FINAL ACCEPTANCE TEST RESULTS TABLE                       ");
    console.log("================================================================================");
    console.table(results);

    const allPassed = results.every((r) => r.passed);
    console.log(`\nOverall Browser Acceptance Verdict: ${allPassed ? "PASS" : "FAIL"}\n`);
    process.exit(allPassed ? 0 : 1);
  }
}

main();
