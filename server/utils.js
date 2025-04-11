const jwt = require("jsonwebtoken");
require("dotenv").config();

module.exports.generateToken = (userId) => {
    return jwt.sign({ userId }, process.env.JWT_SECRET, {
        expiresIn: "48h",
    });
}

module.exports.integrateToken = user => {
    return jwt.sign(user, process.env.JWT_SECRET);
}

function generateRandomString(length) {
    const characters = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    let result = "";
    for (let i = 0; i < length; i++) {
        result += characters.charAt(Math.floor(Math.random() * characters.length));
    }
    return result;
}

module.exports.generateRoomId = () => {
    return generateRandomString(8);
}

module.exports.generateRoomCode = () => {
    return generateRandomString(6);
}