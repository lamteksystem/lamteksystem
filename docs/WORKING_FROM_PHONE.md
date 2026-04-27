# Working on Trade Mouldings from your iPhone

Ways to keep developing when you’re away from your laptop.

---

## Important: What the Cursor app can connect to

**The Cursor app on your iPhone only talks to Cursor running on a Mac.**

- It does **not** connect to Cursor on Windows.
- It does **not** connect to GitHub or Codespaces by itself.

So:

- **If you have a Mac:** Use the steps in **Option 1** below. Your iPhone Cursor app will send prompts to Cursor on that Mac (where this project is open).
- **If you only have a Windows PC:** The Cursor app cannot control your Windows Cursor. Use **Option 2** (GitHub Codespaces in Safari) to code and chat from your phone, or **Option 3** (remote desktop) to use your Windows Cursor from the phone.

---

## Option 1: Cursor app on iPhone → Cursor on a Mac (step-by-step)

**On your Mac (one-time setup):**

1. Install **Cursor** from [cursor.com](https://cursor.com) and sign in with your Cursor account.
2. Clone the project from GitHub so Cursor has the repo:
   - In Terminal: `git clone https://github.com/trademouldingsltd/tml.git` (or open the folder you already have).
   - In Cursor: **File → Open Folder** and open the `tml` project folder.
3. Install the **Cursor CLI** so the mobile app can talk to this machine:
   - In Cursor: open Command Palette (`Cmd+Shift+P`) → run **“Cursor: Install CLI”** (or see [Cursor CLI](https://cursor.com/docs/cli)).
   - In Terminal you should be able to run `cursor .` in the project folder.
4. Use the **same Apple ID** on your Mac and iPhone, with iCloud enabled (required for the app to find your Mac).

**On your iPhone:**

1. Install **Cursor AI Mobile** from the [App Store](https://apps.apple.com/app/cursor-mobile-remote-ide/id6755931330) (iOS 17+).
2. Open the app and sign in with the **same Cursor account** as on the Mac.
3. The app should find your Mac. Select it and the **current Cursor workspace** (the Trade Mouldings project if that’s what’s open on the Mac).
4. Type prompts in the app as you would in Cursor chat. They run in Cursor on the Mac; results and chat sync back to the app.

**Important:** The Mac must be on, awake, and connected to the internet. Cursor on the Mac must have this project open (or at least the workspace the app is linked to).

---

## Option 2: Use your iPhone browser (no Mac needed – works with Windows)

Use GitHub’s cloud IDE from Safari on your iPhone. You’re not using the Cursor app here; you’re coding and using AI chat in the browser. The repo is already at **github.com/trademouldingsltd/tml**.

**On your iPhone:**

1. Open **Safari** and go to **github.com/trademouldingsltd/tml**.
2. Sign in to GitHub (if needed) with the account that owns the repo.
3. Tap the green **Code** button, then tap **Codespaces**.
4. Tap **Create codespace on main** (or “New codespace”). GitHub will open a VS Code–style editor in the browser.
5. In the Codespace you can:
   - Browse and edit files.
   - Open the **Copilot** / AI chat panel (icon in the left sidebar or command palette) and type prompts there – similar to Cursor chat.
   - Run terminals, commit, and push. Changes go to GitHub.
6. When you’re done: commit and push from the Codespace. Back on your Windows laptop, in Cursor run `git pull` in the project folder to get those changes.

**Alternative:** Go to **vscode.dev** in Safari, sign in with GitHub, then **Open Repository** and choose **trademouldingsltd/tml**. You get a lightweight editor and can use Copilot there too.

**Note:** Codespaces may require a GitHub subscription for more than limited free use. If you don’t see Codespaces, check your GitHub plan or use vscode.dev.

---

## Option 3: Remote desktop to your Windows laptop

Use your iPhone as a screen and keyboard for the same machine where Cursor runs.

1. **Leave your laptop on** (and awake, or “wake on LAN” if you set it up).
2. **Install a remote desktop app on the laptop and phone:**
   - **Chrome Remote Desktop**: Install on Windows, enable remote access, then from iPhone install “Chrome Remote Desktop” and connect.
   - **Microsoft Remote Desktop**: Set up your PC for RDP and use the “Microsoft Remote Desktop” app on iPhone.
3. **On the phone:** Open the remote app, connect to your laptop, then open Cursor and continue as usual. Everything runs on the laptop; you’re just controlling it from the phone.

Best when you have a good connection and don’t mind the small screen.

---

## Recommendation

- **Laptop is Windows:** Prefer **Option 2** (GitHub + Codespaces or vscode.dev) for “real” coding from the phone, or **Option 3** (remote desktop) to use Cursor exactly as on the laptop.
- **Laptop is Mac:** Use **Option 1** (Cursor Mobile) for quick prompts, or Option 2/3 as above.

---

## One-time setup that helps all options

1. **Use Git:** Keep the project in a Git repo and push to GitHub (or another remote) regularly so you always have a backup and can open it from anywhere.
2. **Env in one place:** Keep `.env` / Supabase keys only on the laptop (or in a secure place); don’t commit them. Cloud IDEs can use their own env or GitHub Secrets if you add CI later.
3. **Same branch:** When you work from phone (cloud IDE or Cursor Mobile + Mac), use the same branch (e.g. `main`) and pull/push so the laptop and phone stay in sync.

---

## Quick answer: “How do I send commands from my iPhone to this project?”

| You have… | What to do |
|-----------|------------|
| **A Mac** (and Cursor on it) | Use the **Cursor app** on your iPhone. Set up the Mac once (Cursor + CLI + this project open, same Apple ID). Then open the app on the phone, pick your Mac and workspace, and type prompts – they run in Cursor on the Mac. |
| **Only a Windows PC** | The Cursor app **cannot** connect to Windows. Use **Safari** on your iPhone: go to **github.com/trademouldingsltd/tml** → **Code** → **Codespaces** → create a codespace. Code and send AI prompts (Copilot) in the browser. Push changes; pull on your laptop later. |
| **Windows and want to use Cursor exactly** | Use **remote desktop** (e.g. Chrome Remote Desktop) from your iPhone to your Windows PC. Then open Cursor on the PC and use it as usual from the phone screen. |
