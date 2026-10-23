import { createServer, type IncomingMessage, type Server, type ServerResponse } from "node:http";
import { createDatabase, type LedgerDatabase } from "./db";
import { transactionsToCsv } from "./export";

export { createDatabase, LedgerDatabase } from "./db";

export function createApiServer(database: LedgerDatabase = createDatabase()): Server {
  return createServer((request, response) => {
    void route(request, response, database);
  });
}

async function route(request: IncomingMessage, response: ServerResponse, db: LedgerDatabase): Promise<void> {
  const url = new URL(request.url ?? "/", "http://localhost");
  const method = request.method ?? "GET";
  const parts = url.pathname.split("/").filter(Boolean).map(decodeURIComponent);
  try {
    if (parts.length === 1 && parts[0] === "export.csv" && method === "GET") {
      const accountId = url.searchParams.get("accountId") ?? undefined;
      if (accountId !== undefined && !db.getAccount(accountId)) throw new Error(`Unknown account: ${accountId}`);
      const csv = transactionsToCsv(db.listTransactions(accountId));
      response.statusCode = 200;
      response.setHeader("content-type", "text/csv; charset=utf-8");
      response.setHeader("content-disposition", 'attachment; filename="transactions.csv"');
      response.end(csv);
      return;
    }
    if (parts[0] === "accounts" && parts.length === 1) {
      if (method === "GET") return send(response, 200, db.listAccounts());
      if (method === "POST") {
        const body = await readBody(request);
        return send(response, 201, db.createAccount({ id: body.id, name: body.name }));
      }
    }
    if (parts[0] === "accounts" && parts[2] === "balance" && parts.length === 3 && method === "GET") {
      return send(response, 200, { accountId: parts[1], balanceCents: db.getBalance(parts[1]) });
    }
    if (parts[0] === "accounts" && parts.length === 2) {
      const id = parts[1];
      if (method === "GET") {
        const account = db.getAccount(id);
        return account ? send(response, 200, account) : send(response, 404, { error: "Account not found" });
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await readBody(request);
        const account = db.updateAccount(id, body.name);
        return account ? send(response, 200, account) : send(response, 404, { error: "Account not found" });
      }
      if (method === "DELETE") {
        return db.deleteAccount(id) ? send(response, 204) : send(response, 404, { error: "Account not found" });
      }
    }
    if (parts[0] === "transactions" && parts.length === 1) {
      if (method === "GET") return send(response, 200, db.listTransactions(url.searchParams.get("accountId") ?? undefined));
      if (method === "POST") {
        const body = await readBody(request);
        return send(response, 201, db.createTransaction({
          id: body.id,
          accountId: body.accountId,
          amountCents: body.amountCents,
          description: body.description,
        }));
      }
    }
    if (parts[0] === "transactions" && parts.length === 2) {
      const id = parts[1];
      if (method === "GET") {
        const transaction = db.getTransaction(id);
        return transaction ? send(response, 200, transaction) : send(response, 404, { error: "Transaction not found" });
      }
      if (method === "PUT" || method === "PATCH") {
        const body = await readBody(request);
        const transaction = db.updateTransaction(id, {
          accountId: body.accountId,
          amountCents: body.amountCents,
          description: body.description,
        });
        return transaction ? send(response, 200, transaction) : send(response, 404, { error: "Transaction not found" });
      }
      if (method === "DELETE") {
        return db.deleteTransaction(id) ? send(response, 204) : send(response, 404, { error: "Transaction not found" });
      }
    }
    send(response, 404, { error: "Not found" });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Invalid request";
    const status = message.startsWith("Unknown account") ? 404
      : message.includes("already exists") || message.includes("Cannot delete") ? 409
      : 400;
    send(response, status, { error: message });
  }
}

async function readBody(request: IncomingMessage): Promise<Record<string, any>> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    size += chunk.length;
    if (size > 1024 * 1024) throw new Error("Request body too large");
    chunks.push(Buffer.from(chunk));
  }
  if (chunks.length === 0) return {};
  const parsed: unknown = JSON.parse(Buffer.concat(chunks).toString("utf8"));
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new Error("Body must be a JSON object");
  return parsed as Record<string, any>;
}

function send(response: ServerResponse, status: number, payload?: unknown): void {
  response.statusCode = status;
  if (status === 204 || payload === undefined) return response.end();
  response.setHeader("content-type", "application/json; charset=utf-8");
  response.end(JSON.stringify(payload));
}

if (require.main === module) {
  const port = Number(process.env.PORT ?? 3000);
  createApiServer().listen(port, () => process.stdout.write(`Ledger API listening on ${port}\n`));
}
