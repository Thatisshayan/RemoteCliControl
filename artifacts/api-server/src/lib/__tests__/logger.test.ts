import { Writable } from "stream";
import pino from "pino";
import { describe, expect, it } from "vitest";
import { loggerOptions } from "../logger.js";

describe("logger credential redaction", () => {
  it("never serializes authentication credentials carried by pino-http request logs", () => {
    let output = "";
    const stream = new Writable({
      write(chunk, _encoding, callback) {
        output += chunk.toString();
        callback();
      },
    });
    const log = pino(loggerOptions, stream);
    const bearerToken = "audit-bearer-token-must-not-appear";
    const apiKey = "audit-api-key-must-not-appear";

    log.info({
      req: {
        headers: {
          authorization: `Bearer ${bearerToken}`,
          "x-api-key": apiKey,
          accept: "application/json",
        },
      },
    }, "request completed");

    expect(output).not.toContain(bearerToken);
    expect(output).not.toContain(apiKey);
    expect(output).toContain("application/json");
  });
});
