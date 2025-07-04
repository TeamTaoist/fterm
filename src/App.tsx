import { useState, useEffect, useRef } from "react";
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import logo from "/logo.svg";

function App() {
  const [command, setCommand] = useState("");
  const [output, setOutput] = useState<string[]>([]);
  const [cwd, setCwd] = useState("~");
  const [showWelcome, setShowWelcome] = useState(true);
  const endOfOutputRef = useRef<null | HTMLDivElement>(null);
  const inputRef = useRef<null | HTMLInputElement>(null);

  const scrollToBottom = () => {
    endOfOutputRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  const focusInput = () => {
    inputRef.current?.focus();
  };

  useEffect(() => {
    scrollToBottom();
  }, [output]);

  useEffect(() => {
    const getInitialCwd = async () => {
      try {
        const initialCwd: string = await invoke("execute_command", { command: "pwd" });
        setCwd(initialCwd.trim());
      } catch (e) {
        console.error(e);
        setOutput(prev => [...prev, String(e)]);
      }
    };
    getInitialCwd();
    focusInput();
  }, []);

  async function execute() {
    if (showWelcome) {
      setShowWelcome(false);
    }

    if (!command.trim()) {
      setOutput(prev => [...prev, `[${cwd}]$ ${command}`]);
      setCommand("");
      return;
    }

    const commandToExecute = command;
    setCommand(""); // Clear input immediately

    setOutput(prev => [...prev, `[${cwd}]$ ${commandToExecute}`]);

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
          <label htmlFor="command-input">[{cwd}]$</label>
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
