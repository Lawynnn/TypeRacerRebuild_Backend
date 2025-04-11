const mongoose = require("mongoose");
require("dotenv").config();

const connectDB = async () => {
    try {
        const conn = await mongoose.connect(process.env.MONGO_URL, { dbName: process.env.MONGO_DB_NAME });
        console.log(`Connected to ${conn.connection.name} database`);
    } catch (error) {
        console.error("MongoDB connection error:", error.message);
        process.exit(1);
    }
}

connectDB();
module.exports = mongoose;