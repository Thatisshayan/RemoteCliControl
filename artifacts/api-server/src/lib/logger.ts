import pino from "pino";

// fast-redact (pino's redaction engine) only matches wildcards one level
// deep — there's no recursive "**" — so nested credential fields need an
// explicit path per nesting level actually used in the codebase. Add a path
// here if a future call site logs a connection/profile object under a new
// key name.
const CREDENTIAL_KEYS = ["password", "privateKey", "passphrase"];
const NESTED_UNDER = ["conn", "connection", "profile", "body", "req.body"];
export const redactPaths = [
  ...CREDENTIAL_KEYS,
  ...NESTED_UNDER.flatMap((parent) => CREDENTIAL_KEYS.map((key) => `${parent}.${key}`)),
  // pino-http's default request serializer includes all request headers.
  // These credentials must never be recoverable from normal access logs.
  "req.headers.authorization",
  "req.headers.proxy-authorization",
  "req.headers.cookie",
  'req.headers["x-api-key"]',
  'req.headers["x-auth-token"]',
];

export const loggerOptions = {
  level: "info",
  redact: {
    paths: redactPaths,
    remove: true,
  },
};

const logger = pino(loggerOptions);

export default logger;
