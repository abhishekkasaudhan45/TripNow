const env = require("./config/env");
const connectDB = require("./config/db");
const app = require("./app");


connectDB();


app.listen(env.port, () => {
  console.log(`Server running on port ${env.port}`);
});