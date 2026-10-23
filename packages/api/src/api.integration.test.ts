import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./db";
import { createApp } from "./index";

describe("ledger API integration", () => {
  let db: DatabaseSync | undefined;

  afterEach(() => {
    db?.close();
    db = undefined;
  });

  it("registers and logs in, then persists account and transaction data", async () => {
    db = openDatabase(":memory:");
    const server = createApp({ db, sessionSecret: "integration-secret" });

    const registered = await request(server)
      .post("/auth/register")
      .send({ username: "alice", password: "correct horse" })
      .expect(201);
    const registeredCookie = registered.headers["set-cookie"][0].split(";")[0];

    const login = await request(server)
      .post("/auth/login")
      .send({ username: "alice", password: "correct horse" })
      .expect(200);
    const loginCookie = login.headers["set-cookie"][0].split(";")[0];
    expect(login.body.user).toEqual(registered.body.user);

    await request(server)
      .post("/accounts")
      .set("Cookie", loginCookie)
      .send({ id: "checking", name: "Checking" })
      .expect(201, { id: "checking", name: "Checking" });
    await request(server)
      .post("/transactions")
      .set("Cookie", loginCookie)
      .send({ id: "payday", accountId: "checking", amountCents: 2500, description: "Payday" })
      .expect(201, {
        id: "payday", accountId: "checking", amountCents: 2500, description: "Payday",
      });

    await request(server).get("/accounts").set("Cookie", registeredCookie).expect(200, [
      { id: "checking", name: "Checking" },
    ]);
    await request(server).get("/transactions").set("Cookie", loginCookie).expect(200, [
      { id: "payday", accountId: "checking", amountCents: 2500, description: "Payday" },
    ]);
    await request(server).get("/transactions?accountId=checking").set("Cookie", loginCookie)
      .expect(200, [{ id: "payday", accountId: "checking", amountCents: 2500, description: "Payday" }]);
    await request(server).get("/accounts/checking/balance").set("Cookie", loginCookie)
      .expect(200, { balanceCents: 2500 });

    const restartedServer = createApp({ db, sessionSecret: "integration-secret" });
    await request(restartedServer).get("/accounts").set("Cookie", loginCookie).expect(200, [
      { id: "checking", name: "Checking" },
    ]);
    await request(restartedServer).get("/accounts/checking/balance").set("Cookie", loginCookie)
      .expect(200, { balanceCents: 2500 });
  });
});
