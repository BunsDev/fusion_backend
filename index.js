const express = require("express");
const dotenv = require("dotenv");
const cors = require("cors");

dotenv.config({ path: "./.env" });
const PORT = process.env.PORT || 5000;

const app = express();

app.use(cors());
app.use(express.json());

app.use("/api/deploy", require("./routes/api/deploy"));
app.use("/api/execute", require("./routes/api/execute"));
app.use("/api/executeBatch", require("./routes/api/executeBatch"));
app.use("/api/recovery", require("./routes/api/recovery"));
app.use("/api/change", require("./routes/api/change"));

app.get("/", (req, res) => {
  res.send("API Running");
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
