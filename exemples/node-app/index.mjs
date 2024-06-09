// Import Fastify using ESM syntax
import Fastify from 'fastify';

// Initialize the Fastify server instance
const fastify = Fastify({
  logger: true
});

// Define a route
fastify.get('/', async (request, reply) => {
  return { hello: 'world' };
});

// Run the server!
const start = async () => {
  try {
    await fastify.listen({ host: "0.0.0.0", port: 3000 });
    console.log(`Server is running at http://localhost:3000/`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();