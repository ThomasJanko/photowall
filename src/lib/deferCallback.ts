/** Schedule work after render — avoids synchronous setState in useEffect. */
export function deferCallback(fn: () => void): void {
  queueMicrotask(fn);
}
