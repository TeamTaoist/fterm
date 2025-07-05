import { useState, useEffect, useLayoutEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import { listen } from "@tauri-apps/api/event";
import { v4 as uuidv4 } from 'uuid';
import "./App.css";
import logo from "/logo.png";

// Interfaces for our state
interface SystemInfo {
  username: string;
  hostname: string;
}

interface Tab {
  id: string;
  title: string;
  output: string[];
  command: string;
  cwd: string;
  showWelcome: boolean;
}

const createInitialTab = (): Tab => ({
  id: uuidv4(),
  title: "Terminal",
  output: [],
  command: "",
  cwd: "", // Will be populated by useEffect
  showWelcome: true,
});

function App() {
  const [tabs, setTabs] = useState<Tab[]>([createInitialTab()]);
  const [activeTabId, setActiveTabId] = useState<string | null>(tabs[0]?.id || null);
  const [homeDir, setHomeDir] = useState("");
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);

  const endOfOutputRefs = useRef<{ [key: string]: HTMLDivElement | null }>({});
  const inputRefs = useRef<{ [key: string]: HTMLInputElement | null }>({});
  const activeTab = tabs.find(tab => tab.id === activeTabId);

  // Scroll to bottom of the active tab's output
  const scrollToBottom = (tabId: string) => {
    endOfOutputRefs.current[tabId]?.scrollIntoView({ behavior: "auto" });
  };

  // Focus the active tab's input
  const focusInput = (tabId: string) => {
    inputRefs.current[tabId]?.focus();
  };

  // Update a specific tab's state
  const updateTab = (tabId: string, updates: Partial<Tab>) => {
    setTabs(prevTabs =>
      prevTabs.map(tab => (tab.id === tabId ? { ...tab, ...updates } : tab))
    );
  };

  // Add a new tab
  const addTab = async (makeActive = true) => {
    const newTabId = uuidv4();
    const initialCwd = await invoke<string>("get_current_dir");

    const newTab: Tab = {
      id: newTabId,
      title: "Terminal",
      output: [],
      command: "",
      cwd: initialCwd.trim(),
      showWelcome: false, // No welcome on subsequent tabs
    };

    setTabs(prevTabs => [...prevTabs, newTab]);
    if (makeActive) {
      setActiveTabId(newTabId);
    }
  };

  // Close a tab
  const closeTab = (tabId: string) => {
    if (tabs.length <= 1) return; // Prevent closing the last tab

    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const newActiveIndex = Math.max(0, tabIndex - 1);
      setActiveTabId(newTabs[newActiveIndex]?.id || null);
    }
  };

  // Get display path for prompt
  const getDisplayPath = (path: string) => {
    if (homeDir && path === homeDir) {
      return "~";
    }
    const lastPart = path.split('/').filter(Boolean).pop();
    return lastPart || '/';
  };

  // Get prompt HTML
  const getPromptHtml = (path: string) => {
    const displayPath = getDisplayPath(path);
    const userHost = systemInfo
      ? `<span class="prompt-info">${systemInfo.username}@${systemInfo.hostname}</span>`
      : "";
    const dir = `<span class="prompt-path">${displayPath}</span>`;
    const symbol = `<span class="prompt-symbol">%</span>`;
    return `${userHost}&nbsp;${dir}&nbsp;${symbol}`;
  };

  // Command execution logic
  async function execute(tabId: string) {
    const tab = tabs.find(t => t.id === tabId);
    if (!tab) return;

    const promptHtml = getPromptHtml(tab.cwd);
    const commandToExecute = tab.command;

    const newOutput = [...tab.output, `${promptHtml} ${commandToExecute}`];
    updateTab(tabId, { command: "", showWelcome: false, output: newOutput });

    if (!commandToExecute.trim()) {
      return;
    }

    try {
      const result: string = await invoke("execute_command", { command: commandToExecute });
      let finalOutput = [...newOutput];
      if (result) {
        finalOutput.push(result.trim());
      }

      if (commandToExecute.trim().startsWith("cd ")) {
        const newCwd: string = await invoke("get_current_dir");
        updateTab(tabId, { cwd: newCwd.trim(), output: finalOutput });
      } else {
        updateTab(tabId, { output: finalOutput });
      }
    } catch (err) {
      updateTab(tabId, { output: [...newOutput, String(err)] });
    }
  }

  // Effect for initial setup and event listeners
  useEffect(() => {
    const initializeApp = async () => {
      try {
        const [initialHomeDir, sysInfo, initialCwd] = await Promise.all([
          invoke<string>("get_home_dir"),
          invoke<SystemInfo>("get_system_info"),
          invoke<string>("get_current_dir"),
        ]);
        setHomeDir(initialHomeDir.trim());
        setSystemInfo(sysInfo);
        // Update the first tab with the fetched CWD
        if (tabs[0]) {
          updateTab(tabs[0].id, { cwd: initialCwd.trim() });
        }
      } catch (e) {
        console.error("Failed to get initial data:", e);
      }
    };

    initializeApp();

    const unlisten = listen("new_tab", () => {
      addTab();
    });

    return () => {
      unlisten.then(f => f());
    };
  }, []); // Run only once

  // Effect to scroll and focus when active tab changes or its output updates
  // Using useLayoutEffect to prevent flicker/shake when commands are executed
  useLayoutEffect(() => {
    if (activeTab) {
      scrollToBottom(activeTab.id);
      focusInput(activeTab.id);
    }
  }, [activeTab?.output, activeTabId]); // Re-run only when output or active tab changes

  return (
    <main className="container">
      <div className="tab-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span>{getDisplayPath(tab.cwd)}</span>
            <button className="close-tab" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>×</button>
          </div>
        ))}
        <button className="new-tab" onClick={() => addTab()}>+</button>
      </div>
      <div className="terminal-content">
        {tabs.map(tab => (
          <div key={tab.id} className="terminal-instance" style={{ display: tab.id === activeTabId ? 'flex' : 'none' }}>
            <div className="terminal" onClick={() => focusInput(tab.id)}>
              <div className="output-area">
                {tab.showWelcome && (
                  <div className="welcome">
                    <img src={logo} alt="FTerm Logo" className="logo" />
                    <h1>Welcome to FTerm</h1>
                    <p>Your friendly neighborhood terminal.</p>
                  </div>
                )}
                {tab.output.map((line, index) => (
                  <div key={index} dangerouslySetInnerHTML={{ __html: line.replace(/\n/g, '<br/>') }} />
                ))}
                <div ref={el => (endOfOutputRefs.current[tab.id] = el)} />
              </div>
              <form
                className="row"
                onSubmit={(e) => {
                  e.preventDefault();
                  execute(tab.id);
                }}
              >
                <label
                  htmlFor={`command-input-${tab.id}`}
                  dangerouslySetInnerHTML={{ __html: getPromptHtml(tab.cwd) }}
                />
                <input
                  ref={el => (inputRefs.current[tab.id] = el)}
                  id={`command-input-${tab.id}`}
                  autoFocus={tab.id === activeTabId}
                  value={tab.command}
                  onChange={(e) => updateTab(tab.id, { command: e.currentTarget.value })}
                  placeholder=""
                />
              </form>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
