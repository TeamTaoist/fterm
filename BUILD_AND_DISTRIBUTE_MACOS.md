# Building and Distributing the Fterm macOS Application

This guide provides the complete step-by-step process for signing, notarizing, and distributing the Fterm application for macOS.

## 1. Prerequisites

- You must be enrolled in the **Apple Developer Program** ($99/year).
- You must be working on a Mac computer.

## 2. Certificate Generation

This process requires generating two unique certificates: one for the application (`.app`) and one for the installer (`.dmg`).

### Step 2a: Create Certificate Signing Requests (CSRs)

Apple requires a unique CSR for each certificate.

1.  **Create the Application CSR:**
    - Open **Keychain Access** (`Applications/Utilities`).
    - Go to `Keychain Access > Certificate Assistant > Request a Certificate From a Certificate Authority...`.
    - Enter your Apple ID email and name.
    - Select **"Saved to disk"** and save the file as `Application.certSigningRequest`.

2.  **Create the Installer CSR:**
    - Repeat the process above exactly.
    - Save the second file as `Installer.certSigningRequest`.

### Step 2b: Generate and Download Certificates

1.  Log in to the **"Certificates, Identifiers & Profiles"** section of the [Apple Developer Portal](https://developer.apple.com/account/resources/certificates/list).
2.  **Generate Developer ID Application Certificate:**
    - Click `+` to create a new certificate.
    - Select **"Developer ID Application"** and click Continue.
    - Upload your `Application.certSigningRequest` file.
    - Download the generated `.cer` certificate file.
3.  **Generate Developer ID Installer Certificate:**
    - Click `+` again.
    - Select **"Developer ID Installer"** and click Continue.
    - Upload your `Installer.certSigningRequest` file.
    - Download the generated `.cer` certificate file.

### Step 2c: Install Certificates

- Find the two `.cer` files you downloaded and double-click each one. They will be automatically installed into your Keychain.

## 3. Notarization Setup

1.  Go to [appleid.apple.com](https://appleid.apple.com) and sign in.
2.  Navigate to **"Sign-In and Security"** and click on **"App-Specific Passwords"**.
3.  Generate a new password. Give it a label like `Fterm Notarization`.
4.  **Copy and save this password immediately.** You will not see it again.

## 4. Project Configuration

In `src-tauri/tauri.conf.json`, ensure the following values are set correctly:

- **`identifier`**: Set to your unique bundle ID (e.g., `com.taoist.fterm`).
- **`signingIdentity`**: Set to your application certificate name. You can find this by running `security find-identity -v -p codesigning`. It will look like `"Developer ID Application: Your Name (TEAMID)"`.

## 5. Build, Sign, and Notarize

Run the following command in your project's root directory. Replace the placeholder values with your actual credentials.

```sh
APPLE_ID="your_apple_id@example.com" \
APPLE_PASSWORD="xxxx-xxxx-xxxx-xxxx" \
APPLE_TEAM_ID="YOUR_TEAM_ID" \
npm run tauri build
```

- `APPLE_ID`: Your Apple ID email.
- `APPLE_PASSWORD`: The app-specific password you generated.
- `APPLE_TEAM_ID`: Your Team ID from the Apple Developer portal.

This command will build the app, sign it, notarize it with Apple, and bundle it into a `.dmg` installer.

## 6. Distribution

1.  The final, distributable installer file is located at:
    `src-tauri/target/release/bundle/dmg/Fterm_[version]_aarch64.dmg`

2.  The recommended way to distribute the app is to create a new **GitHub Release** and upload this `.dmg` file as a release asset.
