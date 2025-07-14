you : i have generate google Meet it https://meet.google.com/dgu-csby-noa?id=%272322%27&courseId=23343&batchId=4342 this no i have screenity chrome extenstion to record the video and some api call to my backend from the google meet url get  id, courseId, batchId so how to do that it it posible to set this value to localstorage or session storage then get value form save in chrome extension

Below is one straightforward pattern that Screenity (or any Chrome Extension) can use to grab the query‑string values from a Google Meet tab, cache them, and later read them when it’s time to upload your recording. — The same flow works for **id**, **courseId**, **batchId**, or any other parameter you add to the Meet link.

---

## 1 .  Tell Chrome when (and where) your content script should run

```json
// manifest.json  (excerpt)
{
  "manifest_version": 3,
  "name": "Screenity (custom build)",
  "version": "1.0.0",
  "permissions": ["storage", "tabs"],
  "host_permissions": ["https://meet.google.com/*"],
  "background": { "service_worker": "background.js" },

  "content_scripts": [
    {
      "matches": ["https://meet.google.com/*"],
      "js": ["inject.js"],          // runs inside every Meet tab
      "run_at": "document_start"    // earliest chance to read the URL
    }
  ]
}
```

* **`host_permissions`** lets the extension reach the Meet page.
* **`content_scripts`** ensures `inject.js` executes in the tab context where the URL bar contains your `?id=...&courseId=...` string.

---

\## 2 .  In the Meet tab, read the query‑string and store it

```js
// inject.js  (content script)
(function () {
  // 1.  Safely parse the visible URL
  const params = new URLSearchParams(window.location.search);

  const payload = {
    id:        params.get("id"),
    courseId:  params.get("courseId"),
    batchId:   params.get("batchId"),
  };

  // 2.  Filter out null values (e.g. if user joined without params)
  Object.keys(payload).forEach(
    (key) => payload[key] === null && delete payload[key]
  );

  // 3.  Persist into Chrome’s extension storage
  if (Object.keys(payload).length) {
    chrome.storage.local.set({ meetMetadata: payload });
    // Optional: let the background/service‑worker know immediately
    chrome.runtime.sendMessage({ type: "MEET_METADATA", payload });
  }
})();
```

Why **`chrome.storage.local`** instead of `localStorage` or `sessionStorage`?

| API                     | Survives page reload? | Accessible in service worker? | Scoped to your extension? |
| ----------------------- | --------------------- | ----------------------------- | ------------------------- |
| `window.localStorage`   | ✅                     | ❌                             | ❌ (belongs to the page)   |
| `window.sessionStorage` | Until tab close       | ❌                             | ❌                         |
| `chrome.storage.local`  | ✅                     | ✅                             | ✅                         |

Using the Chrome storage API keeps your data inside the extension and available to all extension contexts (background, popup, content scripts, etc.).

---

\## 3 .  Later in the extension (popup, recording logic, background) read the data

```js
// background.js  (or wherever you need it)
async function getMeetMetadata() {
  return new Promise((resolve) => {
    chrome.storage.local.get("meetMetadata", (res) => {
      resolve(res.meetMetadata);      // { id, courseId, batchId } or undefined
    });
  });
}

// Example: before uploading recording
async function uploadRecording(blob) {
  const meta = await getMeetMetadata();

  const body = new FormData();
  body.append("video", blob);
  Object.entries(meta || {}).forEach(([k, v]) => body.append(k, v));

  await fetch("https://your‑backend.example.com/api/upload", {
    method: "POST",
    body
  });
}
```

---

\## 4 .  Keeping the metadata fresh (optional but recommended)

If users hop between meets (or open multiple tabs), listen for tab updates and overwrite old data:

```js
// background.js
chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type === "MEET_METADATA" && sender.tab) {
    chrome.storage.local.set({ meetMetadata: msg.payload });
  }
});

// Clean up when the tab with the metadata closes
chrome.tabs.onRemoved.addListener(async (tabId) => {
  const { meetMetadata } = await chrome.storage.local.get("meetMetadata");
  if (!meetMetadata) return;

  // If you stored the originating tab ID alongside the metadata,
  // you could remove it here when that tab closes.
});
```

---

### Key take‑aways

1. **Parse in a content script** because only it can see `window.location` of the Meet tab.
2. **Use `chrome.storage.local`** (or `sync`) instead of the page’s `localStorage/sessionStorage` so every part of your extension can access the data.
3. **Pass the metadata with every upload** (or add it to your backend’s auth token, as suits your architecture).

You can now record with Screenity, grab the video blob when recording stops, call `uploadRecording(blob)` (or similar in Screenity’s code), and your backend will receive the file plus the **id / courseId / batchId** that came from the original Google Meet URL.


you:but i want when visit the link store the all param value in storage and remove the param form url i think this process take only some second so user not get all the information about it id pass in url

Below is the minimal pattern most teams use when they want to **capture the query‑string once, hide it immediately, yet still keep the data**.

---

### 1 .  Content‑script runs at the very first tick

```jsonc
// manifest.json  (only the parts that matter here)
{
  "manifest_version": 3,
  "permissions": ["storage", "tabs"],
  "host_permissions": ["https://meet.google.com/*"],

  "content_scripts": [
    {
      "matches": ["https://meet.google.com/*"],
      "js": ["stripper.js"],
      "run_at": "document_start"   // <── important
    }
  ]
}
```

### 2 .  `stripper.js` — grab, save, wipe

```js
// stripper.js  — injected into every Meet page
(function () {
  /** STEP 1: Read the visible URL (it still has ?id=…&courseId=…&batchId=…) */
  const qs = new URLSearchParams(location.search);
  const id       = qs.get("id");
  const courseId = qs.get("courseId");
  const batchId  = qs.get("batchId");

  // Nothing to do if there were no params
  if (!(id || courseId || batchId)) return;

  /** STEP 2: Persist them for the rest of the extension */
  chrome.storage.local.set({
    meetMetadata: { id, courseId, batchId }
  });

  /** STEP 3: Remove the query‑string instantly */
  const cleanURL =
    location.origin + location.pathname + location.hash; // (keeps #fragment)
  history.replaceState(null, "", cleanURL);

  /** Optional STEP 4: Let other parts of the extension know right away */
  chrome.runtime.sendMessage({
    type: "MEET_METADATA",
    payload: { id, courseId, batchId }
  });
})();
```

*Because it runs at **`document_start`**, this whole routine executes **before** the Google Meet UI (or the human) can render—usually in well under a millisecond.*

---

### Why `history.replaceState` is the safest wipe

* **No network redirect** – the page isn’t re‑fetched, so you can steal the parameters first.
* **No visual flash** – the address bar updates immediately, usually before the first paint.
* **Preserves SPA history** – Meet (and your extension) keep functioning as if nothing happened.

---

### 3 .  Reading the values later

Any context in the extension—popup, background/service‑worker, Screenity’s recording logic—can retrieve the same object:

```js
chrome.storage.local.get("meetMetadata", ({ meetMetadata }) => {
  console.log(meetMetadata);   // { id: "2322", courseId: "23343", batchId: "4342" }
});
```

---

## Edge‑cases & Tips

| Scenario                                                             | Handling                                                                                                                                                 |
| -------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| User opens multiple Meet tabs, each with different params            | Include `tabId` when you save:<br>`chrome.storage.local.set({ meetMetadata: { tabId: sender.tab.id, ... }})` and overwrite only if the same tab updates. |
| Reload after you stripped the params                                 | Meet will load fine (it never needed those params itself); your data remains in `chrome.storage.local`.                                                  |
| Need to pass the params to the *page* too                            | Dispatch a custom event **before** wiping:<br>`window.dispatchEvent(new CustomEvent("screenity:meet-params", { detail: { id, courseId, batchId }}));`    |
| Want to protect against users pasting links that already lack params | Nothing to do—your script simply finds no params and exits.                                                                                              |

---

### That’s it

1. **Capture** → 2. **Store** → 3. **Strip** — all inside a content‑script that fires at `document_start`.
   From the user’s perspective the address bar never exposes `?id=…&courseId=…&batchId=…`, yet Screenity (and your backend upload) still gets every parameter it needs.




you:it is posible to set chrome.storage.local form our website so we can access without pass to google meet url?

Short answer: **no—your site’s JavaScript cannot call `chrome.storage.*` directly.**
That API is reserved for extension code (content scripts, background/service‑worker, pop‑up, etc.), and Chrome keeps it sandboxed so that ordinary web pages can’t see or mutate another user’s extensions.

But you *can* hand the data to your extension **indirectly** and let *it* write to `chrome.storage.local`. Below are three patterns teams usually pick from, with ready‑to‑paste snippets.

---

## 1.  Inject a content script on *your* site and let it do the write

**When to pick it** You control the HTML of `https://your‑learning‑portal.example.com`, so adding one hidden element or global variable is easy.

```jsonc
// manifest.json  (excerpt)
{
  "permissions": ["storage"],
  "content_scripts": [
    {
      "matches": ["https://your-learning-portal.example.com/*"],
      "js": ["portal‑bridge.js"],
      "run_at": "document_end"
    }
  ]
}
```

```js
// portal‑bridge.js   (content script runs in your portal)
(function () {
  // Example 1: read from a <meta> tag you inject server‑side
  const meta = document.querySelector('meta[name="screenity-params"]');
  if (meta?.content) {
    const data = JSON.parse(meta.content);   // { id, courseId, batchId }
    chrome.storage.local.set({ meetMetadata: data });
  }

  // Example 2: read a global JS object you place in the page
  if (window.__MEET_PARAMS__) {
    chrome.storage.local.set({ meetMetadata: window.__MEET_PARAMS__ });
  }
})();
```

**Pros**

* Zero cross‑origin worries (content script runs *inside* your origin).
* Hides everything from the address bar.

**Cons**

* Requires adding markup or JS to the page template.

---

## 2.  `window.postMessage` handshake (no server markup changes)

Your own JS sets the data at runtime; a content script listening on the same page picks it up.

```js
// === your portal page, anywhere after load ===
const params = { id: "2322", courseId: "23343", batchId: "4342" };
window.postMessage({ source: "screenity‑portal", params }, "*");
```

```js
// portal‑bridge.js  (content script)
window.addEventListener("message", (e) => {
  if (e.data?.source === "screenity‑portal") {
    chrome.storage.local.set({ meetMetadata: e.data.params });
  }
});
```

**Pros**

* No need for `externally_connectable` (see pattern 3).
* Works even if the page is inside an iframe you don’t fully own.

**Cons**

* You still need a content script on that origin.

---

## 3.  “Externally connectable” messaging (page → extension in one hop)

Chrome lets any web page *send* a message to an extension **only** if you declare its origin in `externally_connectable`. The page need not host a content script at all.

```jsonc
// manifest.json
{
  "permissions": ["storage", "runtime"],
  "externally_connectable": {
    "matches": ["https://your-learning-portal.example.com/*"]
  },
  "background": { "service_worker": "background.js" }
}
```

```html
<!-- portal page (plain <script>) -->
<script>
  // Replace with your extension’s real ID after loading/packaging
  const EXT_ID = "abcdefghijklmnoabcdefhijklmnoabc";

  chrome.runtime.sendMessage(
    EXT_ID,
    { type: "MEET_PARAMS", data: { id: "2322", courseId: "23343", batchId: "4342" } },
    (response) => console.log("ext‑ack:", response)
  );
</script>
```

```js
// background.js  (or service worker)
chrome.runtime.onMessageExternal.addListener((msg, sender, sendResponse) => {
  if (msg.type === "MEET_PARAMS") {
    chrome.storage.local.set({ meetMetadata: msg.data });
    sendResponse({ ok: true });
  }
});
```

**Pros**

* No content script needed on your portal.
* Can originate from any frame (even a same‑origin iframe embed somewhere else).

**Cons**

* You must hard‑code or dynamically fetch the extension’s ID in your page JS.
* Still subject to Chrome’s “one page can’t *read* storage, only *ask* the extension to write.”

---

### Which one is best?

| Pattern                              | When it shines                                                                                             |
| ------------------------------------ | ---------------------------------------------------------------------------------------------------------- |
| **Content script reads page markup** | You control the HTML template and prefer to keep page ↔ extension coupling minimal.                        |
| **`postMessage` handshake**          | You already have complex JS in your page and want zero manifest tweaks beyond the content script.          |
| **Externally‑connectable messaging** | You can’t—or don’t want to—inject any extension code into the page (e.g., strict CSP, third‑party portal). |

---

### Bottom line

Chrome deliberately blocks ordinary web pages from touching `chrome.storage.*`.
Let your extension act as a tiny broker—receive the data from your site by one of the three patterns above, then write it to `chrome.storage.local`. From that moment on, every part of Screenity has access to the params without ever exposing them in the Google Meet URL.



You:ok please suggest best one for our EdTech platform how take live session on google meet and record the video through screenity chrome extension  and send recorded video to s3 bucket and we want make one more step like on session ended then show one popup to select completed chapter through screenity chrome extension so we need some information like id, courseId, batchId to submit so what is the best way to handle this scenario 


### Recommended end‑to‑end design for your EdTech + Screenity workflow

| Stage                                               | Where it runs                        | Key API choice                                                                  | What happens                                                                                                                                                                                                                          |
| --------------------------------------------------- | ------------------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **1. Teacher opens “Start Live Class” in your LMS** | Your web portal                      | **Pattern #1**: extension content‑script reads a hidden `<meta>` (or global JS) |  The page already knows `id / courseId / batchId`. The content‑script grabs them and writes them to `chrome.storage.local` **before any Meet tab is opened.**                                                                         |
| **2. One‑click “Launch Meet”**                      | Portal → new tab                     | Plain window\.open() without query‑string                                       | The portal simply opens `https://meet.google.com/abc‑defg‑hij` (no params needed). Meet loads normally.                                                                                                                               |
| **3. Screenity overlay & recording**                | Extension content‑script in Meet tab | `chrome.storage.local.get()`                                                    | Screenity reads the metadata it stored a moment ago, starts the recording UI, and keeps the values in memory while recording.                                                                                                         |
| **4. Detecting “session ended”**                    | Same Meet content‑script             | DOM observer on the red “Leave call” button or `beforeunload`                   | When the teacher clicks “Leave” or closes the tab, Screenity intercepts, pauses the unload, and shows your custom **“Select completed chapter”** modal (React component wrapped in a Shadow DOM so it doesn’t clash with Meet’s CSS). |
| **5. Submit chapter + upload video**                | Extension background/service‑worker  | `fetch()` → your API<br> and → S3 presigned PUT                                 | 1) POST `{ id, courseId, batchId, chapterId }` to your backend.<br>2) Upload the recorded *.webm* to the presigned S3 URL.                                                                                                            |
| **6. Clean‑up**                                     | Extension                            | `chrome.storage.local.remove()`                                                 | After successful upload, wipe the cached metadata so the next class starts clean.                                                                                                                                                     |

---

#### Why this stack is the “least‑surprise” choice

1. **No secrets in the URL bar**
   You never tack `?id=…` onto Google Meet links, so nothing to strip or flash.

2. **Metadata captured where it’s born**
   Your LMS page already has accurate identifiers (and the logged‑in teacher’s JWT). Let the extension’s content‑script harvest them right there—no need for cross‑origin messaging gymnastics.

3. **Single source of truth (`chrome.storage.local`)**
   All extension contexts—popup, Meet tab, background—read the same object. Even if the teacher reloads Meet mid‑class, Screenity re‑hydrates instantly.

4. **Google Meet remains untouched**
   Meet doesn’t care about course IDs, so you keep the integration decoupled and resilient to Google UI changes.

5. **UX matches teacher’s mental model**
   · Starts recording as soon as Meet loads
   · On leaving, shows a native‑looking chapter selector (one final pedagogical step)
   · No extra browser prompts or redirects

---

### Implementation details you’ll appreciate

| Concern                                 | Practical tip                                                                                                                                                                                                                      |
| --------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Injecting data into the portal page** | Easiest: server‑render `<meta name="screenity-params" content='{"id": "...", "courseId": "...", "batchId": "..."}'>`. Extension grabs it in `document_end` and deletes it (`meta.remove()`) for tidiness.                          |
| **Shadow DOM popup**                    | Wrap your React modal in `const root = document.createElement("div"); root.attachShadow({mode:"open"});` so its CSS (Tailwind/shadcn) doesn’t clash with Meet’s classes.                                                           |
| **Detecting “Leave call”**              | Observe `button[aria-label^="Leave"]` with `IntersectionObserver` + `click` listener. As fallback, listen to `beforeunload` so you still intercept tab close or ⌘‑W.                                                               |
| **Pausing the unload while uploading**  | Call `event.preventDefault()` in the `beforeunload` handler and show a “Uploading (12 %)…” toast. Release it when the S3 PUT resolves.                                                                                             |
| **Large files & flaky networks**        | Screenity already chunks by default; if you forked it, ensure the S3 PUT is *multipart* or up to 5 GB (S3 limit).                                                                                                                  |
| **Security**                            | · Keep only opaque IDs client‑side; leave any grade/PII lookup to your backend.<br>· Sign the presigned URL with a *short* TTL (e.g. 15 min).<br>· Verify JWT on your upload endpoint before storing metadata–video linkage in DB. |
| **Multiple Meet tabs**                  | Include the Meet `tabId` when you store `meetMetadata`. On `tabs.onRemoved`, delete the metadata belonging to that tab so a second simultaneous class doesn’t get overwritten.                                                     |

---

### File skeletons

<details>
<summary><code>manifest.json</code> essentials</summary>

```json
{
  "manifest_version": 3,
  "name": "Screenity – EdTech Edition",
  "version": "1.0.0",
  "permissions": ["storage", "tabs", "activeTab"],
  "host_permissions": ["https://meet.google.com/*"],
  "content_scripts": [
    {
      "matches": ["https://your-lms.example.com/*"],
      "js": ["lms-bridge.js"],
      "run_at": "document_end"
    },
    {
      "matches": ["https://meet.google.com/*"],
      "js": ["meet-recorder.js"],
      "run_at": "document_start"
    }
  ],
  "background": { "service_worker": "background.js" },
  "action": { "default_popup": "popup.html" }
}
```

</details>

<details>
<summary><code>lms‑bridge.js</code> (content script on your portal)</summary>

```js
(() => {
  const meta = document.querySelector('meta[name="screenity-params"]');
  if (!meta) return;

  try {
    const params = JSON.parse(meta.content);
    chrome.storage.local.set({ meetMetadata: params });
  } catch (_) {
    console.warn("screenity: malformed meta content");
  }
})();
```

</details>

<details>
<summary><code>meet‑recorder.js</code> (content script on Google Meet)</summary>

```js
(async () => {
  const { meetMetadata } = await chrome.storage.local.get("meetMetadata");
  if (!meetMetadata) return;                     // safety

  // 1. Boot Screenity recorder with metadata
  startRecording(meetMetadata);

  // 2. Hook the “Leave” button + beforeunload
  hookSessionEnd((chapterId, blob) => {
    chrome.runtime.sendMessage({
      type: "UPLOAD_REQUEST",
      meta: { ...meetMetadata, chapterId },
      recording: blob,
    });
  });
})();
```

</details>

<details>
<summary><code>background.js</code> (handles upload)</summary>

```js
chrome.runtime.onMessage.addListener((msg) => {
  if (msg.type !== "UPLOAD_REQUEST") return;

  const { meta, recording } = msg;

  uploadToS3(recording, meta)          // PUT to presigned URL
    .then(() => api.markChapterDone(meta))
    .finally(() => chrome.storage.local.remove("meetMetadata"));
});
```

</details>

---

## TL;DR

1. **Store identifiers in `chrome.storage.local` the moment your portal loads.**
2. **Launch Google Meet *without* query‑strings.**
3. **Let Screenity read those identifiers, record, then on hang‑up show a chapter‑picker modal, upload to S3, and POST completion data to your backend.**
4. **Clean up storage so each class is isolated.**

This pattern keeps URLs clean, UX seamless, and your extension architecture simple and robust. Happy shipping!




you:(() => {
  const meta = document.querySelector('meta[name="screenity-params"]');
  if (!meta) return;

  try {
    const params = JSON.parse(meta.content);
    chrome.storage.local.set({ meetMetadata: params });
  } catch (_) {
    console.warn("screenity: malformed meta content");
  }
})();
ok this is done in my portal not in chrome extension my portal frontend in reactjs ? 



### Where each piece lives

| Part                                                                               | Lives in                                                              | Owned by                 |
| ---------------------------------------------------------------------------------- | --------------------------------------------------------------------- | ------------------------ |
| **`<meta name="screenity-params" …>`** (or a JS global)                            | **Your React portal** – the page the teacher first opens              | **You**                  |
| **Bridge script that reads that meta tag and calls `chrome.storage.local.set(…)`** | **Chrome extension** – a *content‑script* declared in `manifest.json` | **Your extension build** |

So you do **not** paste the bridge script into your React codebase.
Instead, you let the extension inject that bridge script on pages that match your LMS origin.
Your React app’s only job is to *expose* the data (via a meta tag, or a global var); the extension does the storing.

---

## 1 .  Expose the params from your React portal

### Option A – static meta tag (easiest)

If the React build is served from a template like `public/index.html`, just render the meta tag server‑side:

```html
<!-- public/index.html -->
<!DOCTYPE html>
<html lang="en">
  <head>
    …
    <meta
      name="screenity-params"
      content='{"id":"2322","courseId":"23343","batchId":"4342"}'
    />
  </head>
  <body>
    <div id="root"></div>
    …
  </body>
</html>
```

Generate that JSON string from whatever server template language you use (EJS, Django, Rails, etc.).

### Option B – dynamic, from inside React

If the identifiers are fetched after mount, inject them with Helmet:

```bash
npm i react-helmet-async
```

```jsx
import { Helmet } from "react-helmet-async";

function LiveClass({ id, courseId, batchId }) {
  return (
    <>
      <Helmet>
        <meta
          name="screenity-params"
          content={JSON.stringify({ id, courseId, batchId })}
        />
      </Helmet>
      {/* rest of page */}
    </>
  );
}
```

Helmet updates the `<head>` at runtime; the extension’s content‑script (already running) will see it.

*Alternative*: instead of a meta tag you could assign:

```js
window.__MEET_PARAMS__ = { id, courseId, batchId };
```

The bridge script would look for that global instead of a meta tag.

---

## 2 .  Let the extension read and save

In **your extension repo**, declare a content‑script that runs on the portal’s origin:

```jsonc
// manifest.json
{
  …
  "content_scripts": [
    {
      "matches": ["https://your-lms.example.com/*"],
      "js": ["lms-bridge.js"],
      "run_at": "document_end"
    },
    …
  ]
}
```

`lms-bridge.js` stays exactly as you saw:

```js
(() => {
  const meta = document.querySelector('meta[name="screenity-params"]');
  if (!meta) return;

  try {
    const params = JSON.parse(meta.content);
    chrome.storage.local.set({ meetMetadata: params });
  } catch (_) {
    console.warn("screenity: malformed meta content");
  }
})();
```

* It’s **bundled into your extension**, not your React build.
* Because it’s a content‑script, Chrome injects it automatically whenever a page’s URL matches `https://your-lms.example.com/*`.

---

### Quick checklist

| ✅                                                                                                                                                                       | Task |
| ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---- |
| Add meta tag / JS global in the React page that launches the Meet class.                                                                                                |      |
| Build/pack the extension with `lms-bridge.js` listed in `content_scripts`.                                                                                              |      |
| Load the unpacked extension in Chrome → refresh your portal page → open DevTools → **Application → Storage → chrome.storage.local** and confirm you see `meetMetadata`. |      |

Once you see the object stored, the rest of the Screenity flow (recording + upload + chapter modal) can rely on that data.


you: can you give me step-by-step because i am new in chrome extension build so not able to understand 

Absolutely! Here's a **step-by-step beginner-friendly guide** to help you:

---

## ✅ Goal

You want your **React-based LMS portal** to send data like `id`, `courseId`, and `batchId` to your **Chrome extension**, which will later use that info when the teacher records the Google Meet session.

---

## 🔧 Step 1: Add a `<meta>` tag in your React app

### If your React app uses `public/index.html`:

Add this inside the `<head>`:

```html
<!-- public/index.html -->
<meta
  name="screenity-params"
  content='{"id":"2322","courseId":"23343","batchId":"4342"}'
/>
```

Replace `2322`, `23343`, and `4342` with actual dynamic values from your backend.

### Or use `react-helmet-async` inside a React component:

Install it:

```bash
npm install react-helmet-async
```

Add this in your React page (e.g., LiveClass.jsx):

```jsx
import { Helmet } from "react-helmet-async";

function LiveClass({ id, courseId, batchId }) {
  return (
    <>
      <Helmet>
        <meta
          name="screenity-params"
          content={JSON.stringify({ id, courseId, batchId })}
        />
      </Helmet>

      {/* Your live class page */}
    </>
  );
}
```

---

## 🧩 Step 2: Create your Chrome Extension project

Make a new folder, e.g., `screenity-extension`, and inside that create:

```
screenity-extension/
│
├── manifest.json
├── lms-bridge.js
└── icons/
    └── icon.png
```

---

## 📄 Step 3: Create `manifest.json`

This tells Chrome how your extension works.

```json
{
  "manifest_version": 3,
  "name": "Screenity LMS Bridge",
  "version": "1.0",
  "description": "Stores metadata from LMS page",
  "permissions": ["storage"],
  "host_permissions": ["https://your-lms-domain.com/*"],
  "content_scripts": [
    {
      "matches": ["https://your-lms-domain.com/*"],
      "js": ["lms-bridge.js"],
      "run_at": "document_end"
    }
  ],
  "icons": {
    "48": "icons/icon.png"
  }
}
```

👉 Replace `https://your-lms-domain.com/*` with your real LMS domain.

---

## 🧠 Step 4: Create `lms-bridge.js`

This is your content script. Chrome will run this on your LMS page and store the meta tag data in `chrome.storage`.

```js
(() => {
  const meta = document.querySelector('meta[name="screenity-params"]');
  if (!meta) return;

  try {
    const params = JSON.parse(meta.content);
    chrome.storage.local.set({ meetMetadata: params }, () => {
      console.log("✅ Stored LMS metadata:", params);
    });
  } catch (err) {
    console.warn("⚠️ Invalid screenity-params meta tag");
  }
})();
```

---

## 🧪 Step 5: Load the extension in Chrome

1. Open **Google Chrome**.
2. Go to `chrome://extensions/`.
3. Enable **Developer mode** (top right).
4. Click **Load unpacked**.
5. Select the folder `screenity-extension`.

You should now see your extension listed.

---

## ✅ Step 6: Test it

1. Open your **React LMS page** in Chrome.

2. Right-click → **Inspect** → go to **Console**.

3. Look for a message like:

   ```
   ✅ Stored LMS metadata: { id: "2322", courseId: "23343", batchId: "4342" }
   ```

4. Go to **Application → Storage → Extension Storage** and confirm you see:

   ```
   meetMetadata: {
     id: "2322",
     courseId: "23343",
     batchId: "4342"
   }
   ```

---

## 📦 What’s Next?

You now have the data saved in the extension! 🎉

Your next steps are:

1. In your **Google Meet content script** (e.g., `meet-recorder.js`), retrieve it using:

   ```js
   chrome.storage.local.get("meetMetadata", ({ meetMetadata }) => {
     console.log(meetMetadata); // { id, courseId, batchId }
   });
   ```
2. Use this in your chapter selection popup or upload logic.

---

Would you like a ZIP file or GitHub template to get started quickly?
Or do you want help with the Meet popup/chapter selection next?

