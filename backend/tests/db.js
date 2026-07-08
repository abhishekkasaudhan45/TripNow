// Shared in-memory MongoDB lifecycle helpers for tests.
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongo;

const connect = async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri());
};

const clearDatabase = async () => {
  const { collections } = mongoose.connection;
  for (const key of Object.keys(collections)) {
    await collections[key].deleteMany({});
  }
};

const closeDatabase = async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
  if (mongo) await mongo.stop();
};

module.exports = { connect, clearDatabase, closeDatabase };
