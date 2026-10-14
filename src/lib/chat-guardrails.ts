export interface PollingConditions {
  isOpen: boolean;
  hasActiveThread: boolean;
  isVisible: boolean;
  isIdle: boolean;
}

/**
 * Calculates adaptive polling interval (in milliseconds) with idle backoff
 * and background tab suppression to protect client CPU and server connection pools.
 * Returns null when polling should be suspended (e.g. tab hidden).
 */
export function computePollingInterval(conditions: PollingConditions): number | null {
  if (!conditions.isVisible) {
    return null;
  }

  // Active chat thread is currently open
  if (conditions.isOpen && conditions.hasActiveThread) {
    return conditions.isIdle ? 10000 : 3500;
  }

  // Conversation list is open
  if (conditions.isOpen) {
    return conditions.isIdle ? 15000 : 5000;
  }

  // Chat popup is closed (background unread badge polling)
  return conditions.isIdle ? 60000 : 30000;
}

/**
 * Bounds client memory and DOM node count by retaining the most recent messages.
 * Prevents memory leaks in high-volume channels while preserving pagination via "Load older".
 */
export function trimMessageHistory<T extends { id: string }>(
  messages: T[],
  maxCapacity = 150
): T[] {
  if (!messages || messages.length <= maxCapacity) {
    return messages || [];
  }
  return messages.slice(messages.length - maxCapacity);
}

/**
 * Determines whether member list and project status should be refreshed from database.
 * Eliminates redundant member and permission queries during quiet intervals.
 */
export function shouldFetchThreadMetadata(
  isInitialLoad: boolean,
  hasNewMessages: boolean,
  pollIterationCount: number
): boolean {
  if (isInitialLoad || hasNewMessages) {
    return true;
  }
  return pollIterationCount > 0 && pollIterationCount % 10 === 0;
}
