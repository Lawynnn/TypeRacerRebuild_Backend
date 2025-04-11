const mongoose = require("mongoose");
const { generateToken } = require("../../server/utils");

const userSchema = new mongoose.Schema({
    userId: {
        type: String,
        required: true,
        unique: true
    },
    username: {
        type: String,
        required: true,
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    avatar: {
        type: String,
    },
    token: {
        type: String,
        unique: true,
        required: true,
    },
    provider: {
        type: String,
        required: true,
    },
})

const User = mongoose.model("User", userSchema);
module.exports = User;