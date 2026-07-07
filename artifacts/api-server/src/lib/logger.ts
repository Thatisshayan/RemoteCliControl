import pino from "pino";

// fast-redact (pino's redaction engine) only matches wildcards one level
// deep — there's no recursive "**" — so nested credential fields need an
// explicit path per nesting level actually used in the codebase. Add a path
// here if a future call site logs a connection/profile object under a new
// key name.
const CREDENTIAL_KEYS = ["password", "privateKey", "passphrase"];
const NESTED_UNDER = ["conn", "connection", "profile", "body", "req.body"];
const redactPaths = [
  ...CREDENTIAL_KEYS,
  ...NESTED_UNDER.flatMap((parent) => CREDENTIAL_KEYS.map((key) => `${parent}.${key}`)),
];

const logger = pino({
  level: "info",
  redact: {
    paths: redactPaths,
    remove: true,
  },
});

export default logger;
