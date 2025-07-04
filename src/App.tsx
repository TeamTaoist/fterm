import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";
import logo from "/logo.svg";

interface SystemInfo {
  username: string;
  hostname: string;
}

function App() {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const [cwd, setCwd] = useState("~");
  const [showWelcome, setShowWelcome] = useState(true);
  const [homeDir, setHomeDir] = useState("");
  const [systemInfo, setSystemInfo] = useState<SystemInfo | null>(null);
  const endOfOutputRef = useRef<null | HTMLDivElement>(null);
  const inputRef = useRef<null | HTMLInputElement>(null);

  const scrollToBottom = () => {
    endOfOutputRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  const getDisplayPath = (path: string) => {
    if (homeDir && path === homeDir) {
      return "~";
    }
    if (path === '/') {
        return '/';
    }
    const cleanedPath = path.endsWith('/') ? path.slice(0, -1) : path;
    const lastSlashIndex = cleanedPath.lastIndexOf('/');
    return cleanedPath.substring(lastSlashIndex + 1);
  };

  const getPromptHtml = (path: string) => {
    const displayPath = getDisplayPath(path);
    const userHost = systemInfo
      ? `<span class="prompt-info">${systemInfo.username}@${systemInfo.hostname}</span>`
      : "";
    const dir = `<span class="prompt-path">${displayPath}</span>`;
    const symbol = `<span class="prompt-symbol">%</span>`;
    return `${userHost} ${dir} ${symbol}`;
  };

  useEffect(() => {
    scrollToBottom();
  }, [output]);

  useEffect(() => {
    const getInitialData = async () => {
      try {
        const [initialCwd, initialHomeDir, sysInfo] = await Promise.all([
          invoke<string>("execute_command", { command: "pwd" }),
          invoke<string>("get_home_dir"),
          invoke<SystemInfo>("get_system_info"),
        ]);
        setCwd(initialCwd.trim());
        setHomeDir(initialHomeDir.trim());
        setSystemInfo(sysInfo);
      } catch (e) {
        console.error(e);
        setOutput(prev => [...prev, String(e)]);
      }
    };
    getInitialData();
    focusInput();
  }, []);

  async function execute() {
    if (showWelcome) {
      setShowWelcome(false);
    }

    const promptHtml = getPromptHtml(cwd);
    const commandToExecute = command;

    setOutput(prev => [...prev, `${promptHtml} ${commandToExecute}`]);
    setCommand("");

    if (!commandToExecute.trim()) {
      return;
    }

    try {
      const result: string = await invoke("execute_command", { command: commandToExecute });
      if (result) {
        setOutput(prev => [...prev, result.trim()]);
      }

      if (commandToExecute.trim().startsWith("cd ")) {
        const newCwd: string = await invoke("execute_command", { command: "pwd" });
        setCwd(newCwd.trim());
      }
    } catch (err) {
      setOutput(prev => [...prev, String(err)]);
    }
  }

  return (
    <main className="container" onClick={focusInput}>
      <div className="terminal">
        <div className="output-area">
          {showWelcome && (
            <div className="welcome">
              <img src={logo} alt="FTerm Logo" className="logo" />
              <h1>Welcome to FTerm</h1>
              <p>Your friendly neighborhood terminal.</p>
            </div>
          )}
          {output.map((line, index) => (
            <div key={index} dangerouslySetInnerHTML={{ __html: line.replace(/\n/g, '<br/>') }} />
          ))}
          <div ref={endOfOutputRef} />
        </div>
        <form
          className="row"
          onSubmit={(e) => {
            e.preventDefault();
            execute();
          }}
        >
          <label htmlFor="command-input">
            {systemInfo && (
              <span className="prompt-info">
                {systemInfo.username}@{systemInfo.hostname}
              </span>
            )}
            {' '}
            <span className="prompt-path">{getDisplayPath(cwd)}</span>
            {' '}
            <span className="prompt-symbol">%</span>
          </label>
          <input
            ref={inputRef}
            id="command-input"
            autoFocus
            value={command}
            onChange={(e) => setCommand(e.currentTarget.value)}
            placeholder=""
          />
        </form>
      </div>
    </main>
  );
}

export default App;
