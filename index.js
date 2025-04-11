const express = require("express");
const cors = require("cors");
const http = require("http");
const passport = require("./server/passport");
require("dotenv").config();
const session = require("express-session");
const cookieParser = require('cookie-parser');
require("./database")

const app = express();
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: process.env.FRONTEND_URL,
    methods: ["GET", "POST", "PUT", "DELETE"],
    credentials: true
}))
app.set("port", process.env.PORT || 3000);
app.use(session({
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: true,
}));
app.use(passport.initialize());
app.use(passport.session());

app.use("/api", require("./routes/apiRoutes"));
app.use("/api/auth/google", require("./routes/googleAuthRoutes"));
app.use("/api/auth/github", require("./routes/githubAuthRoutes"));

const server = http.createServer(app);
require("./routes/socketRoutes")(server);

server.listen(app.get("port"), () => {
    console.log(`Server running on port ${app.get("port")}`);
});