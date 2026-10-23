import { afterEach, describe, expect, it } from "vitest";
import request from "supertest";
import type { DatabaseSync } from "node:sqlite";
import { openDatabase } from "./db";
import { createApp } from "./index";

describe("budget API", () => {
  let db: DatabaseSync | undefined;
  afterEach(() => { db?.close(); db = undefined; });

  function app() {
    db = openDatabase(":memory:");
    return createApp({ db, sessionSecret: "test-session-secret" });
  }

  async function register(server: ReturnType<typeof createApp>, username: string) {
    const response = await request(server).post("/auth/register").send({ username, password: "secret" }).expect(201);
    return response.headers["set-cookie"][0].split(";")[0] as string;
  }

  it("requires auth on every budget route", async () => {
    const server = app();
    await request(server).get("/api/budgets").expect(401);
    await request(server).post("/api/budgets").send({ categoryId: "food", month: "2026-01", limitCents: 5000 }).expect(401);
    await request(server).get("/api/budgets/summary?month=2026-01").expect(401);
    await request(server).get("/api/budgets/example").expect(401);
    await request(server).get("/api/budgets/example/status").expect(401);
    await request(server).patch("/api/budgets/example").send({ limitCents: 1000 }).expect(401);
    await request(server).delete("/api/budgets/example").expect(401);
  });

  it("persists CRUD, status, and summary with per-user isolation", async () => {
    const server = app();
    const alice = await register(server, "alice");
    const bob = await register(server, "bob");

    const created = await request(server).post("/api/budgets").set("Cookie", alice)
      .send({ categoryId: "food", month: "2026-01", limitCents: 45000 }).expect(201);
    expect(created.body).toMatchObject({ userId: expect.any(String), categoryId: "food", month: "2026-01", limitCents: 45000 });
    const id = created.body.id as string;
    await request(server).post("/api/budgets").set("Cookie", alice)
      .send({ categoryId: "food", month: "2026-01", limitCents: 100 }).expect(409);
    await request(server).get("/api/budgets").set("Cookie", alice).expect(200, [created.body]);
    await request(server).get("/api/budgets").set("Cookie", bob).expect(200, []);
    await request(server).get(`/api/budgets/${id}`).set("Cookie", bob).expect(404);

    await request(server).patch(`/api/budgets/${id}`).set("Cookie", alice)
      .send({ limitCents: 50000 }).expect(200, { ...created.body, limitCents: 50000 });
    await request(server).get(`/api/budgets/${id}/status`).set("Cookie", alice).expect(200, {
      ...created.body, limitCents: 50000, spentCents: 0, remainingCents: 50000, percentUsed: 0,
    });
    await request(server).get("/api/budgets/summary?month=2026-01").set("Cookie", alice).expect(200, {
      month: "2026-01", budgetCount: 1, limitCents: 50000, spentCents: 0, remainingCents: 50000,
      budgets: [{ ...created.body, limitCents: 50000, spentCents: 0, remainingCents: 50000, percentUsed: 0 }],
    });
    await request(server).delete(`/api/budgets/${id}`).set("Cookie", alice).expect(204);
    await request(server).get(`/api/budgets/${id}`).set("Cookie", alice).expect(404);
  });

  it("validates cents and months", async () => {
    const server = app();
    const cookie = await register(server, "alice");
    await request(server).post("/api/budgets").set("Cookie", cookie)
      .send({ categoryId: "food", month: "2026-13", limitCents: 100 }).expect(400);
    await request(server).post("/api/budgets").set("Cookie", cookie)
      .send({ categoryId: "food", month: "2026-01", limitCents: 1.5 }).expect(400);
    await request(server).get("/api/budgets/summary").set("Cookie", cookie).expect(400);
  });
});
