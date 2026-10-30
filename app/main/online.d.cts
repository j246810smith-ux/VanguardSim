// Types for online.cjs (the main-process transport, D-032), for tests that use it directly.
export interface OnlineTransport {
  host(port: number): Promise<{
    ok: boolean;
    error?: string;
    port?: number;
    addresses?: { name: string; address: string }[];
  }>;
  join(address: string, port: number): Promise<{ ok: boolean; error?: string }>;
  send(line: string): boolean;
  drop(): void;
  stop(): void;
}
export function createOnline(emit: (kind: string, data: unknown) => void): OnlineTransport;
export function lineReader(
  maxBytes: number,
  onLine: (line: string) => void,
  onTooLong: () => void,
): (chunk: string) => void;
