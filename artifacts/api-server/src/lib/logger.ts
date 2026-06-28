import pino from "pino";

const logger = pino({
  level: "info",
  redact: {
    paths: ["password", "privateKey", "passphrase"],
    remove: true,
  },
});

export default logger;
