export enum COLUMNS {
  PROJECT = "project",
  TASK = "task",
  ESTIMATE = "estimate",
  ACTUAL = "actual",
  NOTES = "notes",
  COMPLETED = "completed",
  ID = "id"
};

export type Row = {
  project: string,
  task: string,
  estimate: number,
  actual: number,
  notes: string,
  completed: boolean
  projectId: string | null,
  taskId: string | null,
};
