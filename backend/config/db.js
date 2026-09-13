const mongoose = require("mongoose");

const connectDB = async () => {
  const uri = process.env.MONGO_URI;
  try {
    await mongoose.connect(uri, { serverSelectionTimeoutMS: 4000 });
    console.log("MongoDB Connected ✅");
  } catch (error) {
    console.error("MongoDB Atlas Connection Failed ❌", error.message);

    // In non-production, fall back to local MongoDB service so local backend can run
    if (process.env.NODE_ENV !== "production") {
      console.log("⚠️ Attempting local MongoDB fallback (mongodb://127.0.0.1:27017/travel)...");
      try {
        await mongoose.connect("mongodb://127.0.0.1:27017/travel", { serverSelectionTimeoutMS: 3000 });
        console.log("MongoDB Connected Locally ✅ (mongodb://127.0.0.1:27017/travel)");
        return;
      } catch (localErr) {
        console.error("Local MongoDB fallback also failed ❌", localErr.message);
      }
    }

    console.error("👉 To connect to Atlas, ensure your current IP is whitelisted in MongoDB Atlas: https://www.mongodb.com/docs/atlas/security-whitelist/");

    if (process.env.NODE_ENV === "production") {
      process.exit(1);
    }
  }
};

module.exports = connectDB;