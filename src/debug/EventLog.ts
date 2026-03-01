/**
 * Lightweight event log for measuring game feel.
 * Zero dependencies — game modules import logEvent(); DebugBridge reads getEventLog().
 * Uses performance.now() for accurate timing even in headless Chrome.
 */

export interface GameEvent {
  type: string;
  timestamp: number;
  data?: Record<string, unknown>;
}

const MAX_EVENTS = 500;
const _log: GameEvent[] = [];

export function logEvent(type: string, data?: Record<string, unknown>): void {
  _log.push({ type, timestamp: performance.now(), data });
  if (_log.length > MAX_EVENTS) _log.shift();
}

export function getEventLog(): readonly GameEvent[] {
  return _log;
}

export function clearEventLog(): void {
  _log.length = 0;
}
