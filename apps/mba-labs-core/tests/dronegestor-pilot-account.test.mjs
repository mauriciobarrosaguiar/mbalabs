import assert from "node:assert/strict";
import test from "node:test";

import { createOrLinkPilotAccount, PilotAccountError } from "../src/lib/dronegestor-pilot-account.ts";

function createAdmin(overrides = {}) {
  const state = {
    existingUser: null,
    previousPermission: null,
    authUserId: "auth-pilot-1",
    coreUserId: "core-pilot-1",
    authError: null,
    coreInsertError: null,
    previousPermissionError: null,
    permissionError: null,
    ...overrides,
  };
  const events = [];

  class Query {
    constructor(table) {
      this.table = table;
      this.operation = "select";
      this.payload = undefined;
      this.filters = [];
    }

    select() {
      return this;
    }

    ilike(column, value) {
      this.filters.push(["ilike", column, value]);
      return this;
    }

    eq(column, value) {
      this.filters.push(["eq", column, value]);
      return this;
    }

    limit() {
      return this;
    }

    insert(payload) {
      this.operation = "insert";
      this.payload = payload;
      events.push(this);
      return this;
    }

    update(payload) {
      this.operation = "update";
      this.payload = payload;
      events.push(this);
      return this;
    }

    delete() {
      this.operation = "delete";
      events.push(this);
      return this;
    }

    async upsert(payload, options) {
      events.push({ table: this.table, operation: "upsert", payload, options, filters: [] });
      return { error: state.permissionError };
    }

    async maybeSingle() {
      if (this.table === "core_usuarios") return { data: state.existingUser, error: null };
      if (this.table === "core_usuario_app_permissoes") {
        return { data: state.previousPermission, error: state.previousPermissionError };
      }
      throw new Error(`Consulta inesperada: ${this.table}`);
    }

    async single() {
      if (this.table !== "core_usuarios" || this.operation !== "insert") {
        throw new Error(`Inserção inesperada: ${this.table}`);
      }
      return {
        data: state.coreInsertError ? null : { id: state.coreUserId },
        error: state.coreInsertError,
      };
    }
  }

  const admin = {
    from(table) {
      return new Query(table);
    },
    auth: {
      admin: {
        async createUser(payload) {
          events.push({ table: "auth.users", operation: "insert", payload, filters: [] });
          return {
            data: { user: state.authError ? null : { id: state.authUserId } },
            error: state.authError,
          };
        },
        async deleteUser(userId) {
          events.push({ table: "auth.users", operation: "delete", payload: undefined, filters: [["eq", "id", userId]] });
          return { error: null };
        },
      },
    },
  };

  return { admin, events };
}

const current = { empresaId: "empresa-e2e" };
const appId = "app-dronegestor";
const input = {
  nome: "E2E Piloto Teste",
  email: "e2e.piloto@example.invalid",
  telefone: "11999999999",
  senhaAcesso: "SenhaE2E123",
};

function operations(events, table, operation) {
  return events.filter((event) => event.table === table && event.operation === operation);
}

test("cria Auth, usuário da empresa e permissão de piloto sem persistir a senha no perfil", async () => {
  const { admin, events } = createAdmin();

  const result = await createOrLinkPilotAccount(admin, current, appId, input);

  assert.equal(result.usuarioId, "core-pilot-1");
  assert.equal(result.createdAccount, true);
  assert.equal(operations(events, "auth.users", "insert").length, 1);

  const corePayload = operations(events, "core_usuarios", "insert")[0].payload;
  assert.equal(corePayload.empresa_id, current.empresaId);
  assert.equal(corePayload.auth_user_id, "auth-pilot-1");
  assert.equal("password" in corePayload, false);
  assert.equal("senha" in corePayload, false);

  const permissionPayload = operations(events, "core_usuario_app_permissoes", "upsert")[0].payload;
  assert.deepEqual(permissionPayload, {
    usuario_id: "core-pilot-1",
    empresa_id: current.empresaId,
    app_id: appId,
    perfil_app: "piloto",
    status: "ativo",
  });
});

test("bloqueia senha inicial curta antes de criar qualquer conta", async () => {
  const { admin, events } = createAdmin();

  await assert.rejects(
    createOrLinkPilotAccount(admin, current, appId, { ...input, senhaAcesso: "curta" }),
    (error) => error instanceof PilotAccountError && error.status === 400,
  );
  assert.equal(operations(events, "auth.users", "insert").length, 0);
});

test("bloqueia e-mail pertencente a outra empresa", async () => {
  const { admin, events } = createAdmin({
    existingUser: { id: "core-externo", empresa_id: "outra-empresa", status: "ativo", auth_user_id: "auth-externo" },
  });

  await assert.rejects(
    createOrLinkPilotAccount(admin, current, appId, input),
    (error) => error instanceof PilotAccountError && error.status === 409,
  );
  assert.equal(operations(events, "auth.users", "insert").length, 0);
  assert.equal(operations(events, "core_usuario_app_permissoes", "upsert").length, 0);
});

test("bloqueia usuário inativo da própria empresa", async () => {
  const { admin, events } = createAdmin({
    existingUser: { id: "core-inativo", empresa_id: current.empresaId, status: "inativo", auth_user_id: "auth-inativo" },
  });

  await assert.rejects(
    createOrLinkPilotAccount(admin, current, appId, input),
    (error) => error instanceof PilotAccountError && error.status === 409,
  );
  assert.equal(operations(events, "core_usuario_app_permissoes", "upsert").length, 0);
});

test("remove a conta Auth quando o perfil interno não é criado", async () => {
  const { admin, events } = createAdmin({ coreInsertError: new Error("falha simulada") });

  await assert.rejects(
    createOrLinkPilotAccount(admin, current, appId, input),
    (error) => error instanceof PilotAccountError && error.status === 500,
  );
  assert.equal(operations(events, "auth.users", "delete").length, 1);
  assert.equal(operations(events, "core_usuario_app_permissoes", "upsert").length, 0);
});

test("remove Auth e perfil interno quando a permissão do aplicativo falha", async () => {
  const { admin, events } = createAdmin({ permissionError: new Error("falha simulada") });

  await assert.rejects(
    createOrLinkPilotAccount(admin, current, appId, input),
    (error) => error instanceof PilotAccountError && error.status === 500,
  );
  assert.equal(operations(events, "core_usuarios", "delete").length, 1);
  assert.equal(operations(events, "auth.users", "delete").length, 1);
});

test("vincula usuário ativo da mesma empresa sem criar outra conta Auth", async () => {
  const { admin, events } = createAdmin({
    existingUser: { id: "core-existente", empresa_id: current.empresaId, status: "ativo", auth_user_id: "auth-existente" },
  });

  const result = await createOrLinkPilotAccount(admin, current, appId, input);

  assert.equal(result.usuarioId, "core-existente");
  assert.equal(result.createdAccount, false);
  assert.equal(operations(events, "auth.users", "insert").length, 0);
  assert.equal(operations(events, "core_usuario_app_permissoes", "upsert").length, 1);
});

test("rollback de vínculo existente restaura exatamente a permissão anterior", async () => {
  const previousPermission = { id: "permission-1", perfil_app: "gestor_operacional", status: "ativo" };
  const { admin, events } = createAdmin({
    existingUser: { id: "core-existente", empresa_id: current.empresaId, status: "ativo", auth_user_id: "auth-existente" },
    previousPermission,
  });
  const result = await createOrLinkPilotAccount(admin, current, appId, input);

  await result.rollback();

  const restore = operations(events, "core_usuario_app_permissoes", "update")[0];
  assert.deepEqual(restore.payload, { perfil_app: previousPermission.perfil_app, status: previousPermission.status });
  assert.deepEqual(restore.filters, [["eq", "id", previousPermission.id]]);
});
