const env = require("./config/env");
const connectDB = require("./config/db");
const app = require("./app");


const startServer = async () => {
  await connectDB();
  app.listen(env.port, () => {
    console.log(`Server running on port ${env.port}`);
  });
};

startServer();