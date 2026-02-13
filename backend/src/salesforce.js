const jsforce = require("jsforce");

function validateConfig() {
  const required = [
    "SF_LOGIN_URL",
    "SF_USERNAME",
    "SF_PASSWORD",
    "SF_SECURITY_TOKEN"
  ];

  const missing = required.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing Salesforce env vars: ${missing.join(", ")}`);
  }
}

async function createConnection() {
  validateConfig();

  const conn = new jsforce.Connection({
    loginUrl: process.env.SF_LOGIN_URL
  });

  await conn.login(
    process.env.SF_USERNAME,
    `${process.env.SF_PASSWORD}${process.env.SF_SECURITY_TOKEN}`
  );

  return conn;
}

module.exports = {
  createConnection
};
