# FTerm

<p align="center">
  <img src="./public/logo.png" alt="FTerm Logo" width="128">
</p>

<h3 align="center">A modern, cross-platform terminal application built with Tauri and React.</h3>

---

FTerm is a simple yet powerful desktop terminal emulator designed for a clean, native-like experience. It provides a consistent and professional command-line interface with essential features for developers.

## ✨ Key Features

- **Cross-Platform:** Runs on macOS, Windows, and Linux.
- **Professional Prompt:** Displays `user@hostname`, current directory, and a `$` prompt symbol.
- **Dynamic Path Shortening:** Automatically shortens long directory paths for a clean look (e.g., `~/d/my-project` instead of `/Users/user/Documents/my-project`).
- **Core Command Support:** Handles essential shell commands like `ls`, `cd`, `pwd`, and more.
- **Automated Releases:** Continuous integration with GitHub Actions to build and release new versions automatically.

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/en/)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites)

### Development

1.  **Clone the repository:**
    ```bash
    git clone https://github.com/TeamTaoist/fterm.git
    cd fterm
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the development server:**
    ```bash
    npm run tauri dev
    ```

## 📦 Release Process

This project uses GitHub Actions to automate the release process. To create a new release, simply run the `release.sh` script with a new version tag.

```bash
# Example: Create a new release for version v0.1.0
./release.sh v0.1.0
```

This will push a new tag to the repository, which triggers the GitHub Actions workflow to build the application for all platforms and create a new GitHub Release with the downloadable files.
