const User = require("../database/models/User");
const jwt = require("jsonwebtoken");
require("dotenv").config();

module.exports = async (req, res, next) => {
    const token = req.cookies.token;
    if (!token) {
        return res.status(401).json({
            success: false,
            message: "Unauthorized",
            error: "No token provided"
        });
    }

    jwt.verify(token, process.env.JWT_SECRET, (err, decoded) => {
        if(err) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized",
                error: "Invalid token"
            });
        }

        User.findOne({ token }, {__v: 0, token: 0, _id: 0}).then(user => {
            if (!user) {
                return res.status(401).json({
                    success: false,
                    message: "Unauthorized"
                });
            }
            req.user = user.toObject();
            next();
        }).catch(err => {
            return res.status(500).json({
                success: false,
                message: "Internal Server Error",
                error: err.message
            });
        });
    })
}