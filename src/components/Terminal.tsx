import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

interface TerminalComponentProps {
    id: string;
}

const TerminalComponent = ({ id }: TerminalComponentProps) => {
    const termRef = useRef<HTMLDivElement>(null);
    const term = useRef<Terminal | null>(null);
    useEffect(() => {
        if (!termRef.current) return;

        // 1. Initialize xterm.js
        const xterm = new Terminal({
            cursorBlink: true,
            fontFamily: 'monospace',
        });
        const fitAddon = new FitAddon();
        xterm.loadAddon(fitAddon);
        xterm.open(termRef.current);
        term.current = xterm;

        // 2. Setup resizing
        const handleResize = () => {
            try {
                fitAddon.fit();
                const { rows, cols } = xterm;
                invoke('pty_resize', { id, size: { rows, cols } });
            } catch (e) {
                console.error('Error during resize:', e);
            }
        };

        const resizeObserver = new ResizeObserver(handleResize);
        if (termRef.current) {
            resizeObserver.observe(termRef.current);
        }
        window.addEventListener('resize', handleResize);
        handleResize(); // Initial resize

        // 3. Setup PTY communication
        let unlisten: (() => void) | undefined;
        let ptyReady = false;

        invoke('pty_spawn', { id })
            .then(() => {
                if (!term.current) return; // Component might have been unmounted
                ptyReady = true;

                // Listen for data from the backend
                const eventName = `pty_data_${id}`;
                listen<string>(eventName, (event) => {
                    xterm.write(event.payload);
                }).then(cleanupFn => {
                    unlisten = cleanupFn;
                });

                // Send data to the backend
                xterm.onData((data) => {
                    invoke('pty_write', { id, data });
                });
            })
            .catch(e => {
                console.error('pty_spawn failed:', e);
                if (term.current) {
                    xterm.write(`\r\n\x1b[31mError: Failed to spawn PTY.\x1b[0m`);
                }
            });

        // 4. Return cleanup function
        return () => {
            resizeObserver.disconnect();
            window.removeEventListener('resize', handleResize);
            unlisten?.();
            if (ptyReady) {
                invoke('pty_kill', { id });
            }
            xterm.dispose();
            term.current = null;
        };
    }, [id]);

    return <div ref={termRef} style={{ width: '100%', height: '100%' }} />;
};

export default TerminalComponent;
