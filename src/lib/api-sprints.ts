/**
 * api-sprints.ts — Sprint operations via .NET backend
 *
 * All Supabase calls removed.  Routes through the shared netFetch helper
 * (which attaches the stored JWT and converts body keys to snake_case).
 */

import { sprintsApi, tasksApi } from '@/lib/apiClient';

export const listSprints = async () => sprintsApi.getAll();

export const saveSprint = async (sprint: any) => {
  if (sprint.id) {
    return sprintsApi.update(sprint.id, sprint);
  }
  return sprintsApi.create(sprint);
};

export const deleteSprint = async (id: string) => sprintsApi.delete(id);

/**
 * Assign a task to a sprint (or unassign by passing null).
 * Uses PUT /tasks/{taskId} because the SprintsController assign-task
 * endpoint requires an existing sprint ID.  Passing null removes the
 * task from its sprint.
 */
export const assignTaskToSprint = async (taskId: string, sprintId: string | null) =>
  tasksApi.update(taskId, { sprintId });

/** Update the story-point estimate for a task. */
export const updateTaskStoryPoints = async (taskId: string, storyPoints: number) =>
  tasksApi.update(taskId, { storyPoints });
