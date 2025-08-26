// Type declarations for packages without bundled types
declare module 'memory-cache' {
  function get(key: string): any;
  function put(key: string, value: any, timeout?: number): boolean;
  function del(key: string): boolean;
  function clear(): boolean;
  function size(): number;
  function memsize(): number;
  function keys(): string[];
}

declare module 'node-cron' {
  export function schedule(cronExpression: string, task: () => void | Promise<void>): any;
  export function validate(cronExpression: string): boolean;
  export function getTasks(): Map<string, any>;
}
