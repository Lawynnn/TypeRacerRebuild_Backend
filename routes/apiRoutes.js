const { Router } = require('express');
const router = Router();
const Auth = require("../middleware/auth");
require("dotenv").config();

router.get("/", (req, res) => {
    res.json({
        message: "Welcome to the API"
    })
})

router.get("/profile", Auth, (req, res) => {
    res.json({
        success: true,
        expiresAt: new Date().getTime() + parseInt(process.env.TOKEN_EXPIRY) * 60 * 60 * 1000,
        ...req.user
    });
});

router.post("/logout", Auth, (req, res) => {
    res.clearCookie("token", {
        httpOnly: process.env.SECURE === "false" ? true : false,
        secure: process.env.SECURE === "false" ? false : true,
        sameSite: "lax",
    });
    res.json({
        success: true,
        message: "Logged out successfully"
    });
});

module.exports = router;