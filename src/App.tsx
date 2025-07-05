import { useState } from "react";
import { v4 as uuidv4 } from 'uuid';
import TerminalComponent from "./components/Terminal";
import "./App.css";
import { exit } from "@tauri-apps/plugin-process";

interface Tab {
  id: string;
  title: string;
}

const createInitialTab = (): Tab => ({
  id: uuidv4(),
  title: "Terminal",
});

function App() {
  const [tabs, setTabs] = useState<Tab[]>([createInitialTab()]);
  const [activeTabId, setActiveTabId] = useState<string | null>(tabs[0]?.id || null);

  const addTab = () => {
    const newTab: Tab = {
      id: uuidv4(),
      title: "Terminal",
    };
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);
  };

  const closeTab = (tabId: string) => {
    if (tabs.length <= 1) {
      exit(0);
      return;
    }

    const tabIndex = tabs.findIndex(tab => tab.id === tabId);
    const newTabs = tabs.filter(tab => tab.id !== tabId);
    setTabs(newTabs);

    if (activeTabId === tabId) {
      const newActiveIndex = Math.max(0, tabIndex - 1);
      setActiveTabId(newTabs[newActiveIndex]?.id || null);
    }
  };

  return (
    <main className="container">
      <div className="tab-bar">
        {tabs.map(tab => (
          <div
            key={tab.id}
            className={`tab-item ${tab.id === activeTabId ? 'active' : ''}`}
            onClick={() => setActiveTabId(tab.id)}
          >
            <span>{tab.title}</span>
            <button className="close-tab" onClick={(e) => { e.stopPropagation(); closeTab(tab.id); }}>×</button>
          </div>
        ))}
        <button className="new-tab" onClick={addTab}>+</button>
      </div>
      <div className="terminal-content">
        {tabs.map(tab => (
          <div key={tab.id} className="terminal-instance" style={{ display: tab.id === activeTabId ? 'flex' : 'none', height: '100%' }}>
             <TerminalComponent id={tab.id} />
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
