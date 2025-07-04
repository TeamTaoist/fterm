# Getting Started

This guide will walk you through setting up the FTerm development environment on your local machine.

## Prerequisites

Before you begin, ensure you have the following installed on your system:

- [Node.js](https://nodejs.org/en/) (LTS version recommended)
- [Rust](https://www.rust-lang.org/tools/install)
- [Tauri Prerequisites](https://tauri.app/v1/guides/getting-started/prerequisites) for your specific operating system.

## Development Setup

1.  **Clone the Repository**

    First, clone the FTerm repository from GitHub to your local machine:

    ```bash
    git clone https://github.com/TeamTaoist/fterm.git
    cd fterm
    ```

2.  **Install Dependencies**

    Next, install the required npm packages for the frontend and development tools:

    ```bash
    npm install
    ```

3.  **Run the Application**

    Finally, run the development command to launch the FTerm application. This will start the Vite development server and the Tauri application in parallel.

    ```bash
    npm run tauri dev
    ```

    The application window should open automatically. Any changes you make to the source code will trigger a live reload.
