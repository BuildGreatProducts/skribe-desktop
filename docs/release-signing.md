# macOS release signing (fix “Skribe is damaged and can’t be opened”)

That error means macOS **does not trust the build** — usually unsigned, not notarized, or downloaded with quarantine. Follow these steps in order.

---

## Step 1 — Apple Developer Program

1. Go to [developer.apple.com/programs](https://developer.apple.com/programs/) and enroll ($99/year) if you are not already.
2. Open [Certificates, IDs & Profiles](https://developer.apple.com/account/resources/certificates/list).
3. Note your **Team ID** (10 characters) — you will need it as `APPLE_TEAM_ID`.

---

## Step 2 — Create a **Developer ID Application** certificate

> **Important:** Your Mac currently only has an **Apple Development** certificate. That works for your machine only. Other people need **Developer ID Application**.

1. On your Mac: **Keychain Access → Certificate Assistant → Request a Certificate From a Certificate Authority**.
   - Email: your Apple ID email
   - Common name: e.g. `Chris Ashby`
   - Save the `.certSigningRequest` file.
2. In [Apple Developer → Certificates → +](https://developer.apple.com/account/resources/certificates/add):
   - Type: **Developer ID Application**
   - Upload the CSR → Download the `.cer`.
3. Double-click the `.cer` to install it in Keychain.
4. Confirm:

```bash
security find-identity -v -p codesigning
```

You should see:

`Developer ID Application: Your Name (TEAMID)`

---

## Step 3 — Export the certificate for GitHub Actions

1. **Keychain Access → My Certificates** → expand **Developer ID Application**.
2. Right-click the **private key** under it → **Export** → save as `DeveloperID.p12` with a strong password.
3. Base64-encode for the `APPLE_CERTIFICATE` secret:

```bash
openssl base64 -A -in ~/Desktop/DeveloperID.p12 -out ~/Desktop/certificate-base64.txt
```

4. Keep `DeveloperID.p12` and the password private; do not commit them.

---

## Step 4 — Notarization credentials (pick one method)

### Option A — App Store Connect API key (recommended)

1. [App Store Connect → Users and Access → Integrations → App Store Connect API](https://appstoreconnect.apple.com/access/integrations/api)
2. Create a key with access that can submit for notarization.
3. Download the `.p8` file once.
4. Note **Issuer ID** and **Key ID**.

GitHub secrets:

| Secret | Value |
|--------|--------|
| `APPLE_API_ISSUER` | Issuer ID from App Store Connect |
| `APPLE_API_KEY` | Key ID |
| `APPLE_API_KEY_PATH` | In CI we write the key to a file; store the **full PEM contents** in a secret named `APPLE_API_KEY_CONTENT` (see workflow) |

### Option B — Apple ID + app-specific password

1. [appleid.apple.com](https://appleid.apple.com) → **App-Specific Passwords** → generate one for “Skribe CI”.
2. GitHub secrets:

| Secret | Value |
|--------|--------|
| `APPLE_ID` | Your Apple ID email |
| `APPLE_PASSWORD` | The app-specific password (not your main password) |
| `APPLE_TEAM_ID` | Your 10-character Team ID |

---

## Step 5 — Add GitHub repository secrets

Repo → **Settings → Secrets and variables → Actions → New repository secret**

**Required for signing + notarization:**

| Secret | Description |
|--------|-------------|
| `APPLE_CERTIFICATE` | Entire contents of `certificate-base64.txt` |
| `APPLE_CERTIFICATE_PASSWORD` | Password for the `.p12` export |
| `KEYCHAIN_PASSWORD` | Any random string (e.g. `openssl rand -base64 32`) — only used in CI |
| `APPLE_TEAM_ID` | Your Team ID |

**Plus either** API key secrets **or** `APPLE_ID` + `APPLE_PASSWORD` (see Step 4).

**Optional (auto-updater later):**

| Secret | Description |
|--------|-------------|
| `TAURI_SIGNING_PRIVATE_KEY` | From `npm run tauri signer generate` |
| `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` | Password for that key |

---

## Step 6 — Cut a signed release

When secrets are set:

```bash
git tag v0.1.1
git push origin v0.1.1
```

GitHub Actions (`.github/workflows/release.yml`) will build, sign, notarize, and attach a **draft** release with the `.dmg`.

1. Open the workflow run on GitHub and confirm it succeeds.
2. Open the draft release → download the `.dmg`.
3. On another Mac (or a test user): open DMG → drag to **Applications** → launch.

Verify trust:

```bash
spctl -a -vv /Applications/Skribe.app
```

Expected: `accepted` and `source=Notarized Developer ID`.

---

## Step 7 — Publish the release

1. Edit the draft release on GitHub → **Publish release**.
2. Point your landing page download link at that release asset.
3. Tell testers to **delete** any old copy and install only from this DMG.

---

## Emergency workaround (testers blocked right now)

Not a substitute for Step 6. Only if they already have a broken copy:

```bash
xattr -cr /Applications/Skribe.app
```

Then **Right-click → Open** once. If that works, wait for the notarized DMG from Step 6.

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| CI fails at codesign | `APPLE_CERTIFICATE` must be Developer ID **Application**, not Development |
| Still “damaged” after release | Download the **new** DMG from GitHub Releases; don’t AirDrop an old `.app` |
| Works on your Mac, not others | You built locally without Developer ID + notarization |
| `spctl` says rejected | Notarization failed — read the Actions log for `notarytool` errors |
| AI broken after install | Separate issue: [Claude Code](https://docs.anthropic.com/en/docs/claude-code) must be installed |

---

## Local signed build (optional)

With **Developer ID Application** in your keychain:

```bash
export APPLE_SIGNING_IDENTITY="Developer ID Application: Your Name (TEAMID)"
npm run sidecar:prepare
npm run tauri build -- --bundles dmg
```

Notarization locally also needs `APPLE_ID` / API key env vars — CI is easier for notarization.
