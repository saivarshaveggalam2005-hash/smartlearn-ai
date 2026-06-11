import mongoose from "mongoose";

/** Prefer direct mongodb:// URI on Windows when SRV DNS fails (querySrv ECONNREFUSED). */
function getMongoUri(): string {
  const direct = process.env.MONGODB_URI_DIRECT;
  if (direct) return direct;

  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error("Please define MONGODB_URI in .env.local");
  }

  if (uri.startsWith("mongodb+srv://")) {
    console.warn(
      "[SmartLearn] mongodb+srv:// may fail on some networks. Use a direct mongodb:// URI from Atlas → Connect → Drivers → \"Standard connection string\"."
    );
  }

  return uri;
}

interface MongooseCache {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCache: MongooseCache | undefined;
}

const cached: MongooseCache = global.mongooseCache ?? {
  conn: null,
  promise: null,
};

if (!global.mongooseCache) {
  global.mongooseCache = cached;
}

export async function connectDB(): Promise<typeof mongoose> {
  const uri = getMongoUri();

  if (cached.conn) return cached.conn;

  if (!cached.promise) {
    cached.promise = mongoose.connect(uri, {
      bufferCommands: false,
      serverSelectionTimeoutMS: 15000,
      connectTimeoutMS: 15000,
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (err) {
    cached.promise = null;
    throw err;
  }

  return cached.conn;
}
