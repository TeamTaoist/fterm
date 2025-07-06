import { useState, useCallback, useEffect } from "react";
import { v4 as uuidv4 } from 'uuid';
import TerminalComponent from "./components/Terminal";
import "./App.css";
import { exit } from "@tauri-apps/plugin-process";
import { listen } from '@tauri-apps/api/event';

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

  const addTab = useCallback(() => {
    const newTab: Tab = {
      id: uuidv4(),
      title: "Terminal",
    };
    setTabs(prevTabs => [...prevTabs, newTab]);
    setActiveTabId(newTab.id);
  }, []);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prevTabs => {
      if (prevTabs.length <= 1) {
        exit(0);
        return prevTabs;
      }

      const newTabs = prevTabs.filter(tab => tab.id !== tabId);

      setActiveTabId(prevActiveTabId => {
        if (prevActiveTabId === tabId) {
          const tabIndex = prevTabs.findIndex(tab => tab.id === tabId);
          const newActiveIndex = Math.max(0, tabIndex - 1);
          return newTabs[newActiveIndex]?.id || null;
        }
        return prevActiveTabId;
      });

      return newTabs;
    });
  }, []);

  const handleTitleChange = useCallback((tabId: string, title: string) => {
    setTabs(prevTabs =>
      prevTabs.map(tab =>
        tab.id === tabId ? { ...tab, title: title } : tab
      )
    );
  }, []);

  useEffect(() => {
    const unlisten = listen('new_tab', () => {
      addTab();
    });
    return () => {
      unlisten.then(f => f());
    };
  }, [addTab]);

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
             <TerminalComponent id={tab.id} onTitleChange={handleTitleChange} />
          </div>
        ))}
      </div>
    </main>
  );
}

export default App;
