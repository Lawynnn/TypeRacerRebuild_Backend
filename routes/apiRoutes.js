const { Router } = require('express');
const router = Router();

router.get("/", (req, res) => {
    res.json({
        message: "Welcome to the API"
    })
})

router.get("/login", (req, res) => {
    res.send("Login Page")
})

router.get("/register", (req, res) => {
    res.json({
        message: "Register Page"
    })
})

module.exports = router;