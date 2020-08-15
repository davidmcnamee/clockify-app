import { GoogleSpreadsheetWorksheet, GoogleSpreadsheetCell } from "google-spreadsheet";
import { COLUMNS, Row } from "./types";
import axios from "axios";
import { RateLimiter } from 'limiter';

const MAX_CELLS_TO_CHECK = 30;
const CLOCKIFY_BASE_URL = 'https://api.clockify.me/api/v1';


class NoColumnFoundError extends Error {
  constructor(key: string) {
    super(`No column found with key ${key}`);
    this.name = "NoColumnFoundError";
  }
}

class WrongCellTypeError extends Error {
  constructor(rowIndex: number, key: string, type: string) {
    super(`${key} at row ${rowIndex + 1} is not of type ${type}`);
    this.name = 'WrongCellTypeError';
  }
}

export function findIndex(sheet: GoogleSpreadsheetWorksheet, key: string): number {
  for (let i = 0; i < MAX_CELLS_TO_CHECK; ++i) {
    const cell = sheet.getCell(0, i);
    if (cell.value == key) return i;
  }
  throw new NoColumnFoundError(key);
}

export function fetchRows(sheet: GoogleSpreadsheetWorksheet, colToIndex: { [key in keyof typeof COLUMNS]: number }): Array<Row> {
  let i = 0;
  const rows = [];
  const numRows = sheet.rowCount;
  while (++i < numRows && sheet.getCell(i, colToIndex[COLUMNS.TASK])) {
    const idCell = sheet.getCell(i, colToIndex[COLUMNS.ID]);
    if (idCell.valueType !== 'stringValue') throw new WrongCellTypeError(i, COLUMNS.ID, 'string');
    let projectId: string | null, taskId: string | null;
    if (idCell.value) {
      const matches = (idCell.value as string).match(/^(.*)-(.*)$/);
      const [projectIdVal, taskIdVal] = [matches[1], matches[2]];
      if (!projectIdVal || taskIdVal) throw Error(`unexpected id value ${idCell.value}`);
      projectId = projectIdVal, taskId = taskIdVal;
    } else {
      projectId = null, taskId = null;
    }

    const row = {
      project: sheet.getCell(i, colToIndex[COLUMNS.PROJECT]),
      task: sheet.getCell(i, colToIndex[COLUMNS.TASK]),
      estimate: sheet.getCell(i, colToIndex[COLUMNS.ESTIMATE]),
      actual: sheet.getCell(i, colToIndex[COLUMNS.ACTUAL]),
      notes: sheet.getCell(i, colToIndex[COLUMNS.NOTES]),
      completed: sheet.getCell(i, colToIndex[COLUMNS.COMPLETED]),
      projectId,
      taskId
    };
    if (row.project.valueType !== 'stringValue') throw new WrongCellTypeError(i, COLUMNS.PROJECT, 'string');
    if (row.task.valueType !== 'stringValue') throw new WrongCellTypeError(i, COLUMNS.PROJECT, 'string');
    if (row.notes.valueType !== 'stringValue') throw new WrongCellTypeError(i, COLUMNS.PROJECT, 'string');
    if (row.completed.valueType !== 'boolValue') throw new WrongCellTypeError(i, COLUMNS.PROJECT, 'boolean');
    if (row.estimate.valueType !== 'numberValue') throw new WrongCellTypeError(i, COLUMNS.PROJECT, 'number');
    if (row.actual.valueType !== 'numberValue') throw new WrongCellTypeError(i, COLUMNS.PROJECT, 'number');
    Object.keys(row).forEach(k => {
      row[k] = row[k].value
    });
    rows.push(row as any as Row);
  }
  return rows;
}

export class ClockifyService {
  private limiter: RateLimiter;
  private workspaceId: string;

  constructor(workspaceId) {
    this.limiter = new RateLimiter(10, 'second');
    this.workspaceId = workspaceId;
  }

  async fetchTasks(projectId: string) {
    return await this.sendReq(`/workspaces/${this.workspaceId}/projects/${projectId}/tasks`, axios.get);
  }

  async deleteTask(projectId: string, taskId: string) {
    return await this.sendReq(`/workspaces/${this.workspaceId}/projects/${projectId}/tasks/${taskId}`, axios.delete);
  }

  async updateTask(projectId: string, taskId: string, data: object) {
    return await this.sendReq(`/workspaces/${this.workspaceId}/projects/${projectId}/tasks/${taskId}`, axios.put, data);
  }

  async createTask(projectId: string, data: object) {
    return await this.sendReq(`/workspaces/${this.workspaceId}/projects/${projectId}/tasks`, axios.post, data);
  }

  async fetchProjects() {
    return await this.sendReq(`/workspaces/${this.workspaceId}/projects`, axios.get);
  }

  async createProject(name: string) {
    return await this.sendReq(`/workspaces/${this.workspaceId}/projects`, axios.post, { name });
  }

  async updateProject(id: string, name: string) {
    return await this.sendReq(`/workspaces/${this.workspaceId}/projects/${id}`, axios.put, { name });
  }

  async deleteProject(id: string) {
    return await this.sendReq(`/workspaces/${this.workspaceId}/projects/${id}`, axios.delete);
  }

  private async sendReq(url: string, operation: (s: string, d?: object) => Promise<{ data: any }>, dataObj?: object) {
    await new Promise(res => this.limiter.removeTokens(1, res));
    if (dataObj) {
      const { data } = await operation(`${CLOCKIFY_BASE_URL}${url}`, dataObj);
      return data;
    } else {
      const { data } = await operation(`${CLOCKIFY_BASE_URL}${url}`);
      return data;
    }
  }
}