require("dotenv").config();

const express = require("express");
const cors = require("cors");
const { createConnection } = require("./salesforce");

const app = express();
const port = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

app.get("/health", (_req, res) => {
  res.status(200).json({
    status: "ok",
    service: "investigation-trend-backend"
  });
});

app.get("/api/salesforce/connect-test", async (_req, res) => {
  try {
    const conn = await createConnection();
    const identity = await conn.identity();
    const orgResult = await conn.query("SELECT Id, Name FROM Organization LIMIT 1");
    const org = orgResult.records[0] || null;

    res.status(200).json({
      connected: true,
      userId: identity.user_id,
      username: identity.username,
      org
    });
  } catch (error) {
    res.status(500).json({
      connected: false,
      error: error.message
    });
  }
});