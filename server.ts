import fastify from 'fastify';
import { AddressInfo } from 'net';
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { findIndex, fetchRows, ClockifyService } from './utils';
import axios from 'axios';
import { COLUMNS } from './types';

const SHEET_ID = '1Ct7hto3iN6iP-hxy-rXe7H3Gm3xWXQ3KZRCjUt7wOgw';
const WORKSPACE_ID = '5ea7052fafefd1251bc24861';

const clockify = new ClockifyService();

const app = fastify({ logger: false });

app.all('/', async (req, res) => {
  console.log("request received:\n", req.body);
  return { hello: 'world' };
});

const start = async () => {

  try {
    await app.listen(8080);
    const { port } = app.server.address() as AddressInfo;
    console.log(`server listening on ${port}`);
    // app.log.info()
  } catch (err) {
    console.log(err);
    // app.log.error(err);
    process.exit(1);
  }
};

app.all('/syncClockify', async (req, res) => {
  const doc = new GoogleSpreadsheet(SHEET_ID);
  await doc.useServiceAccountAuth({
    client_email: process.env.SERVICE_ACC_CLIENT_EMAIL,
    private_key: process.env.SERVICE_ACC_PRIVATE_KEY,
  });

  await doc.loadInfo();
  const sheet = doc.sheetsByIndex[0];
  const colToIndex = Object.fromEntries(Object.entries(COLUMNS).map(([col, key]) => {
    return [col, findIndex(sheet, key)];
  })) as { [key in keyof typeof COLUMNS]: number };
  const rows = fetchRows(sheet, colToIndex);

  // first, change project names if necessary
  const projectData = await clockify.fetchProjects();
  const pDataIdsToNames = new Map<string, string>(projectData.map(p => [p.id, p.name]));
  const addingProjects = new Map<string, number[]>();
  const projectIdsToNames = rows.reduce((m, r, idx) => {
    if (r.projectId === null) {
      const prev = addingProjects.has(r.project) ? addingProjects.get(r.project) : [];
      addingProjects.set(r.project, [idx, ...prev]);
      return m;
    }
    if (m.has(r.projectId) && m.get(r.projectId) !== r.project) {
      throw Error(`There is a project that has multiple names: ${r.project}/${m.get(r.projectId)}. Either fix them, or delete the id column to indicate that they are separate projects.`);
    }
    m.set(r.projectId, r.project);
    return m;
  }, new Map<string, string>());
  const changingProjects = [];
  projectIdsToNames.forEach((projectName, projectId) => {
    if (!pDataIdsToNames.has(projectId)) {
      // error of some kind
    } else if (pDataIdsToNames.get(projectId) !== projectName) {
      changingProjects.push([projectId, projectName]);
    }
  });
  const removingProjects = [];
  pDataIdsToNames.forEach((_name, id) => {
    if (!projectIdsToNames.has(id)) {
      removingProjects.push(id);
    }
  });

  const newlyCreatedIdxToId = new Map<number, string>();
  await Promise.all([...removingProjects.map(p => clockify.deleteProject(p)),
  ...changingProjects.map(([id, name]) => clockify.updateProject(id, name)),
  ...[...addingProjects.entries()].map(async ([name, indices]) => {
    const { id } = await clockify.createProject(name)
    indices.forEach(i => newlyCreatedIdxToId[i] = id);
  })
  ]);

  // then, change task data if necessary

  const taskUpdates = [];
  const taskCreates = [];
  const taskDeletes = [];

  const clockifyTasks = new Map<string, string>();

  await rows.reduce((p, r, idx) => {
    return p.then(async () => {
      if (newlyCreatedIdxToId.has(idx)) {
        taskCreates.push([idx, newlyCreatedIdxToId.get(idx), r]);
      } else if (!r.taskId && r.projectId) {
        taskCreates.push([idx, r.projectId, r]);
      } else {

      }
    });
  }, Promise.resolve());

  return { success: true };
});

start();
