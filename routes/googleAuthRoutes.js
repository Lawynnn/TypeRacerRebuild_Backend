const { Router } = require('express');
const router = Router();
const passport = require("../server/passport");
require("dotenv").config();

router.get("/", passport.authenticate("google", {
    scope: ["profile", "email"]
}))

router.get('/callback',
    passport.authenticate('google', { failureRedirect: '/error?msg=google_auth_callback' }),
    (req, res) => {
        res.cookie("token", req.user.token, {
            httpOnly: process.env.SECURE === "false" ? true : false,
            secure: process.env.SECURE === "false" ? false : true,
            sameSite: "lax",
            maxAge: 1000 * 60 * 60 * 24 // 1 day
        })

        res.redirect(`${process.env.FRONTEND_URL}/play`);
    }
);

module.exports = router;