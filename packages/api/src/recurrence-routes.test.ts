import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./db";
import { createApp } from "./index";

describe("recurrence API", () => {
  let db: DatabaseSync | undefined;
  afterEach(() => { db?.close(); db = undefined; });
  function app() { db = openDatabase(":memory:"); return createApp({ db, sessionSecret: "test-session-secret" }); }
  async function register(server: ReturnType<typeof createApp>, username: string) {
    const response = await request(server).post("/auth/register").send({ username, password: "secret" }).expect(201);
    return response.headers["set-cookie"][0].split(";")[0] as string;
  }

  it("requires auth for recurrence operations", async () => {
    const server = app();
    await request(server).get("/api/recurrence").expect(401);
    await request(server).post("/api/recurrence").send({}).expect(401);
    await request(server).post("/api/recurrence/apply-due").send({ asOf: "2026-01-01" }).expect(401);
    await request(server).get("/api/recurrence/rule").expect(401);
    await request(server).patch("/api/recurrence/rule").send({}).expect(401);
    await request(server).delete("/api/recurrence/rule").expect(401);
  });

  it("supports user-scoped CRUD and applies due occurrences exactly once", async () => {
    const server = app();
    const alice = await register(server, "alice");
    const bob = await register(server, "bob");
    const account = await request(server).post("/accounts").set("Cookie", alice).send({ id: "checking", name: "Checking" }).expect(201);
    const input = { accountId: account.body.id, amountCents: -250, description: "Coffee", startDate: "2026-01-01", schedule: { frequency: "weekly", weekdays: [4] } };
    const created = await request(server).post("/api/recurrence").set("Cookie", alice).send(input).expect(201);
    expect(created.body).toMatchObject(input);
    const id = created.body.id as string;
    const listed = await request(server).get("/api/recurrence").set("Cookie", alice).expect(200);
    expect(listed.body).toEqual([{ ...created.body }]);
    await request(server).get("/api/recurrence").set("Cookie", bob).expect(200, []);
    await request(server).get(`/api/recurrence/${id}`).set("Cookie", bob).expect(404);
    await request(server).patch(`/api/recurrence/${id}`).set("Cookie", alice).send({ amountCents: -300 }).expect(200, { ...created.body, amountCents: -300 });

    const first = await request(server).post("/api/recurrence/apply-due").set("Cookie", alice).send({ asOf: "2026-01-16" }).expect(200);
    expect(first.body.applied).toHaveLength(3);
    expect(first.body.applied.map((item: { date: string }) => item.date)).toEqual(["2026-01-01", "2026-01-08", "2026-01-15"]);
    expect((await request(server).get("/transactions").set("Cookie", alice).expect(200)).body).toHaveLength(3);
    await request(server).post("/api/recurrence/apply-due").set("Cookie", alice).send({ asOf: "2026-01-16" }).expect(200, { asOf: "2026-01-16", applied: [] });
    expect((await request(server).get("/transactions").set("Cookie", alice).expect(200)).body).toHaveLength(3);
    await request(server).delete(`/api/recurrence/${id}`).set("Cookie", alice).expect(204);
    await request(server).get(`/api/recurrence/${id}`).set("Cookie", alice).expect(404);
  });

  it("rejects invalid rules and dates", async () => {
    const server = app();
    const cookie = await register(server, "alice");
    await request(server).post("/api/recurrence").set("Cookie", cookie).send({ accountId: "a", amountCents: 0, startDate: "2026-01-01", schedule: { frequency: "weekly", weekdays: [1] } }).expect(400);
    await request(server).post("/api/recurrence/apply-due").set("Cookie", cookie).send({ asOf: "not-a-date" }).expect(400);
  });
});
