// Shared in-memory MongoDB lifecycle helpers for tests.
const os = require("os");
const mongoose = require("mongoose");
const { MongoMemoryServer } = require("mongodb-memory-server");

let mongo;

const connect = async () => {
  mongo = await MongoMemoryServer.create();
  await mongoose.connect(mongo.getUri(), {
    serverSelectionTimeoutMS: 15000,
    runtimeAdapters: { os },
  });
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

const extractToken = (res) => {
  if (res.body?.data?.token) return res.body.data.token;
  const setCookie = res.headers && res.headers["set-cookie"];
  if (!setCookie) return null;
  const cookies = Array.isArray(setCookie) ? setCookie : [setCookie];
  for (const c of cookies) {
    const match = c.match(/token=([^;]+)/);
    if (match) return match[1];
  }
  return null;
};

module.exports = { connect, clearDatabase, closeDatabase, extractToken };
