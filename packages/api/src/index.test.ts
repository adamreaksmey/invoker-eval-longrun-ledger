import { afterEach, describe, expect, it } from "vitest";
import { createApiServer } from "./index";

describe("ledger API", () => {
  const servers: ReturnType<typeof createApiServer>[] = [];
  afterEach(async () => {
    await Promise.all(servers.splice(0).map((server) => new Promise<void>((resolve, reject) => {
      server.close((error) => error ? reject(error) : resolve());
    })));
  });

  it("creates accounts and transactions, reports balances, and updates/deletes records", async () => {
    const server = createApiServer();
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    const base = `http://127.0.0.1:${address.port}`;
    const send = (path: string, method = "GET", body?: unknown) => fetch(`${base}${path}`, {
      method,
      ...(body === undefined ? {} : { headers: { "content-type": "application/json" }, body: JSON.stringify(body) }),
    });

    const account = await send("/accounts", "POST", { id: "cash", name: "Cash" });
    expect(account.status).toBe(201);
    expect(await account.json()).toEqual({ id: "cash", name: "Cash" });
    const transaction = await send("/transactions", "POST", {
      id: "opening", accountId: "cash", amountCents: 1250, description: "Opening balance",
    });
    expect(transaction.status).toBe(201);
    expect(await transaction.json()).toMatchObject({ id: "opening", amountCents: 1250 });
    expect(await (await send("/accounts/cash/balance")).json()).toEqual({ accountId: "cash", balanceCents: 1250 });
    expect((await send("/accounts/cash", "PATCH", { name: "Wallet" })).status).toBe(200);
    expect(await (await send("/accounts")).json()).toEqual([{ id: "cash", name: "Wallet" }]);
    expect((await send("/transactions/opening", "DELETE")).status).toBe(204);
    expect((await send("/accounts/cash", "DELETE")).status).toBe(204);
    expect(await (await send("/accounts")).json()).toEqual([]);
  });

  it("uses status responses for duplicate ids and invalid account references", async () => {
    const server = createApiServer();
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    const base = `http://127.0.0.1:${address.port}`;
    const post = (path: string, body: unknown) => fetch(`${base}${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    await post("/accounts", { id: "a", name: "A" });
    expect((await post("/accounts", { id: "a", name: "Duplicate" })).status).toBe(409);
    expect((await post("/transactions", { id: "t", accountId: "missing", amountCents: 1 })).status).toBe(404);
  });

  it("exports transactions as escaped CSV and supports account filtering", async () => {
    const server = createApiServer();
    servers.push(server);
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
    const address = server.address();
    if (!address || typeof address === "string") throw new Error("Expected TCP server address");
    const base = `http://127.0.0.1:${address.port}`;
    const post = (path: string, body: unknown) => fetch(`${base}${path}`, {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body),
    });
    await post("/accounts", { id: "cash", name: "Cash" });
    await post("/accounts", { id: "bank", name: "Bank" });
    await post("/transactions", { id: "one", accountId: "cash", amountCents: -250, description: 'Lunch, "downtown"' });
    await post("/transactions", { id: "two", accountId: "bank", amountCents: 500, description: "=HYPERLINK(\"bad\")" });

    const response = await fetch(`${base}/export.csv`);
    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition")).toContain("transactions.csv");
    expect(await response.text()).toBe(
      'id,accountId,amountCents,description\r\n"one","cash","-250","Lunch, ""downtown"""\r\n"two","bank","500","\'=HYPERLINK(""bad"")"\r\n',
    );
    const filtered = await fetch(`${base}/export.csv?accountId=cash`);
    expect(await filtered.text()).toBe('id,accountId,amountCents,description\r\n"one","cash","-250","Lunch, ""downtown"""\r\n');
    expect((await fetch(`${base}/export.csv?accountId=missing`)).status).toBe(404);
  });
});
