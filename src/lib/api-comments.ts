/**
 * api-comments.ts — Task comments and subtasks via .NET backend
 *
 * Replaces all Supabase calls.  The .NET backend infers the commenting
 * user from the JWT token, so userId is no longer sent in the body.
 *
 * NOTE: deleteComment / toggleSubtask / deleteSubtask now require taskId
 * because the .NET routes are nested under /tasks/{taskId}/…
 */

import { tasksApi } from '@/lib/apiClient';

// ── Comments ──────────────────────────────────────────────────────────────────

export const listComments = async (taskId: string) =>
  tasksApi.getComments(taskId);

/** userId param kept for call-site compatibility but is ignored — JWT is used. */
export const addComment = async (taskId: string, _userId: string, content: string) =>
  tasksApi.addComment(taskId, content);

export const deleteComment = async (taskId: string, commentId: string) =>
  tasksApi.deleteComment(taskId, commentId);

/** updateComment — not yet supported by the .NET backend (no-op). */
export const updateComment = async (_taskId: string, _id: string, _content: string) => {
  // TODO: add PUT /tasks/{taskId}/comments/{id} endpoint
};

// ── Subtasks ──────────────────────────────────────────────────────────────────

export const listSubtasks = async (taskId: string) =>
  tasksApi.getSubtasks(taskId);

export const addSubtask = async (taskId: string, title: string) =>
  tasksApi.addSubtask(taskId, title);

/** toggleSubtask now requires taskId for the nested route. */
export const toggleSubtask = async (taskId: string, subtaskId: string, completed: boolean) =>
  tasksApi.updateSubtask(taskId, subtaskId, { completed });

/** deleteSubtask now requires taskId for the nested route. */
export const deleteSubtask = async (taskId: string, subtaskId: string) =>
  tasksApi.deleteSubtask(taskId, subtaskId);
