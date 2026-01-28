import mongoose from "mongoose";

const connectDB = async () => {
  let MONGO_URI = process.env.MONGO_URI;

  if (!MONGO_URI) {
    if (process.env.MONGO_USER && process.env.MONGO_PASS) {
      MONGO_URI = `mongodb+srv://${process.env.MONGO_USER}:${process.env.MONGO_PASS}@cluster0.s0xqnyv.mongodb.net`;
    } else {
      MONGO_URI = `mongodb://127.0.0.1:27017/Looka_Db`;
    }
  }

  try {
    const conn = await mongoose.connect(MONGO_URI, {
      dbName: process.env.DB_NAME,
      serverSelectionTimeoutMS: 5000, // 5 seconds timeout
    });

    console.log(`MongoDB Connected: ${conn.connection.host}`);
  } catch (error) {
    console.log("MongoDB connection failed, but continuing server start for troubleshooting.");
    console.error("MongoDB connection failed:", error.message);
    // process.exit(1);
  }
};

export default connectDB;
