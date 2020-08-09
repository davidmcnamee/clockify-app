import fastify from 'fastify';
import { AddressInfo } from 'net';

const app = fastify({ logger: false });

app.post('/', async (req, res) => {
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

start();
