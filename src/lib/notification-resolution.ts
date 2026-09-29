export type NotificationTask = {
  id: string;
  project_id: string;
  title?: string;
  status?: string;
  is_archived?: boolean;
  project_name?: string;
};

export type Notification = {
  id: string;
  chat_id?: string | null;
  dedupe_key?: string;
  title: string;
  message: string;
  created_at: string;
  is_read: boolean;
  task?: NotificationTask | null;
  actor_name?: string | null;
};

export type NotificationCategory = 'all' | 'action' | 'mentions' | 'updates';

export type CategoryCounts = {
  all: number;
  action: number;
  mentions: number;
  updates: number;
};

export type ResolutionContext = {
  badge: string;
  variant: 'action' | 'success' | 'muted' | 'info' | 'warn';
  explanation?: string;
  isStaleAction: boolean;
};

export function getNotificationResolution(n: Notification): ResolutionContext {
  const task = n.task;
  const title = n.title;
  const dedupe = n.dedupe_key || '';

  // 1. Review submission requests:
  if (title === 'Ready for review') {
    if (!task) {
      return { badge: 'Task removed', variant: 'muted', explanation: 'The referenced task is no longer available.', isStaleAction: true };
    }
    if (task.is_archived) {
      return { badge: 'Task archived', variant: 'muted', explanation: 'This task was archived.', isStaleAction: true };
    }
    if (task.status === 'done') {
      return { badge: 'Already completed', variant: 'success', explanation: 'This task has already been completed and approved.', isStaleAction: true };
    }
    if (task.status === 'in_review') {
      return { badge: 'Action needed', variant: 'action', explanation: 'Review is awaiting action.', isStaleAction: false };
    }
    return { badge: 'Review withdrawn', variant: 'muted', explanation: 'The review is no longer pending — task was returned to progress.', isStaleAction: true };
  }

  // 2. Task assignments:
  if (title === 'Task assigned') {
    if (!task) {
      return { badge: 'Task removed', variant: 'muted', explanation: 'The referenced task is no longer available.', isStaleAction: true };
    }
    if (task.is_archived) {
      return { badge: 'Task archived', variant: 'muted', explanation: 'This task was archived.', isStaleAction: true };
    }
    if (task.status === 'done') {
      return { badge: 'Already completed', variant: 'success', explanation: 'This assigned task is complete.', isStaleAction: true };
    }
    if (task.status === 'in_review') {
      return { badge: 'In review', variant: 'info', explanation: 'This task has been submitted for review.', isStaleAction: false };
    }
    return { badge: 'Assigned', variant: 'action', explanation: 'Active task assigned to you.', isStaleAction: false };
  }

  // 3. Deadline notices:
  if (title === 'Due today' || title === 'Task overdue' || title === 'Due tomorrow' || dedupe.endsWith(':deadline')) {
    if (!task) {
      return { badge: 'Task removed', variant: 'muted', isStaleAction: true };
    }
    if (task.is_archived) {
      return { badge: 'Task archived', variant: 'muted', isStaleAction: true };
    }
    if (task.status === 'done') {
      return { badge: 'Already completed', variant: 'success', explanation: 'Work on this task is complete.', isStaleAction: true };
    }
    if (task.status === 'in_review') {
      return { badge: 'In review', variant: 'info', explanation: 'Task is awaiting review.', isStaleAction: false };
    }
    return { badge: 'Deadline pending', variant: 'action', explanation: 'Task deadline requires attention.', isStaleAction: false };
  }

  // 4. Mentions:
  if (title === 'You were mentioned' || dedupe.startsWith('mention:')) {
    if (task?.status === 'done') {
      return { badge: 'Task completed', variant: 'muted', isStaleAction: false };
    }
    return { badge: 'Mention', variant: 'info', isStaleAction: false };
  }
  if (title === 'Chat mention') {
    return { badge: 'Chat mention', variant: 'info', isStaleAction: false };
  }
  if (title === 'Chat message') {
    return { badge: 'Chat', variant: 'info', isStaleAction: false };
  }

  // 5. Review outcomes:
  if (title === 'Task approved') {
    return { badge: 'Approved', variant: 'success', isStaleAction: false };
  }
  if (title === 'Changes requested') {
    if (task?.status === 'done') {
      return { badge: 'Already completed', variant: 'success', explanation: 'Revisions completed; task is now approved.', isStaleAction: true };
    }
    if (task?.status === 'in_review') {
      return { badge: 'Resubmitted', variant: 'info', explanation: 'Task resubmitted for review.', isStaleAction: false };
    }
    return { badge: 'Changes requested', variant: 'warn', explanation: 'Changes requested on your submission.', isStaleAction: false };
  }
  if (title === 'Review invalidated') {
    return { badge: 'Invalidated', variant: 'muted', explanation: 'Review invalidated due to task changes.', isStaleAction: true };
  }
  if (title === 'Task review updated') {
    return { badge: 'Review updated', variant: 'muted', isStaleAction: false };
  }
  if (title === 'Task accepted') {
    return { badge: 'Accepted', variant: 'info', isStaleAction: false };
  }

  return { badge: 'Update', variant: 'muted', isStaleAction: false };
}
