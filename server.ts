import fastify from 'fastify';
import { AddressInfo } from 'net';
import { GoogleSpreadsheet } from 'google-spreadsheet';

const app = fastify({ logger: false });

app.all('/oauth2redirect', async (req, res) => {
  console.log('oauth2 redirect');
});

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

app.all('/sheet', async (req, res) => {
  console.log('instantiating doc');
  const doc = new GoogleSpreadsheet('1Ct7hto3iN6iP-hxy-rXe7H3Gm3xWXQ3KZRCjUt7wOgw');
  console.log('authorizing');
  await doc.useServiceAccountAuth({
    client_email: process.env.SERVICE_ACC_CLIENT_EMAIL,
    private_key: process.env.SERVICE_ACC_PRIVATE_KEY,
  });
  console.log('loading info');
  await doc.loadInfo();
  console.log('updating title');
  await doc.updateProperties({ title: 'renamed doc' });

  const sheet = doc.sheetsByIndex[0]; // or use doc.sheetsById[id]
  console.log(sheet.title);
  console.log(sheet.rowCount);

  // adding / removing sheets
  const newSheet = await doc.addSheet({ title: 'hot new sheet!' });
  console.log('all done');
  return { all: 'done' };
});

start();
