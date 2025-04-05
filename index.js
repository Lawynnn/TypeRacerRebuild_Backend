const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors({
    origin: "*"
}))
app.set("port", process.env.PORT || 3000);

app.use("/api", require("./routes/apiRoutes"));

app.listen(app.get("port"), () => {
    console.log(`Server running on port ${app.get("port")}`);
})