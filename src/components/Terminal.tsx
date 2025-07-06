import { useEffect, useRef } from 'react';
import { Terminal } from '@xterm/xterm';
import { FitAddon } from '@xterm/addon-fit';
import { invoke } from '@tauri-apps/api/core';
import { listen } from '@tauri-apps/api/event';
import '@xterm/xterm/css/xterm.css';

interface TerminalComponentProps {
    id: string;
    onTitleChange: (id: string, title: string) => void;
}

const TerminalComponent = ({ id, onTitleChange }: TerminalComponentProps) => {
    const termRef = useRef<HTMLDivElement>(null);
    const term = useRef<Terminal | null>(null);
    useEffect(() => {
        if (!termRef.current) {
            return;
        }

        // 1. Initialize Terminal and Addons
        const xterm = new Terminal({
            cursorBlink: true,
            fontFamily: 'monospace',
        });
        const fitAddon = new FitAddon();
        xterm.loadAddon(fitAddon);
        xterm.open(termRef.current);
        term.current = xterm;

        xterm.onTitleChange((title) => {
            onTitleChange(id, title);
        });

        // 2. Calculate Initial Size and Spawn PTY
        // First `fit` is to measure the container.
        fitAddon.fit();
        const initialDimensions = {
            rows: xterm.rows,
            cols: xterm.cols,
        };

        let ptyReady = false;
        let unlisten: (() => void) | undefined;
        let resizeObserver: ResizeObserver | null = null;
        let isInitialResize = true; // Flag to prevent resize on first observer trigger.

        invoke('pty_spawn', {
            id,
            size: {
                rows: initialDimensions.rows,
                cols: initialDimensions.cols,
            },
        })
        .then(() => {
            if (!term.current) return;
            ptyReady = true;

            // 3. Setup Event Listeners
            const eventName = `pty_data_${id}`;
            listen<string>(eventName, (event) => {
                xterm.write(event.payload);
            }).then((cleanupFn) => {
                unlisten = cleanupFn;
            });

            xterm.onData((data) => {
                if (ptyReady) {
                    invoke('pty_write', { id, data });
                }
            });

            // 4. Setup Resize Observer for subsequent resizes
            const handleResize = () => {
                // The observer fires immediately. We skip the first one because
                // we already spawned the PTY with the correct size.
                if (isInitialResize) {
                    isInitialResize = false;
                    return;
                }
                try {
                    fitAddon.fit();
                    invoke('pty_resize', {
                        id,
                        size: { rows: xterm.rows, cols: xterm.cols },
                    });
                } catch (e) {
                    console.error('Error during resize:', e);
                }
            };

            if (termRef.current) {
                resizeObserver = new ResizeObserver(handleResize);
                resizeObserver.observe(termRef.current);
            }
        })
        .catch((e) => {
            console.error('pty_spawn failed:', e);
            if (term.current) {
                xterm.write(`\r\n\x1b[31mError: Failed to spawn PTY: ${e}\x1b[0m`);
            }
        });

        // 5. Cleanup
        return () => {
            resizeObserver?.disconnect();
            unlisten?.();
            if (ptyReady) {
                invoke('pty_kill', { id });
            }
            term.current?.dispose();
            term.current = null;
        };
    }, [id, onTitleChange]);

    return <div ref={termRef} style={{ width: '100%', height: '100%' }} />;
};

export default TerminalComponent;
