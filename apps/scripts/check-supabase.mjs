import { createClient } from "@supabase/supabase-js";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

loadEnvFile(".env.local");
loadEnvFile(".env");

const required = ["NEXT_PUBLIC_SUPABASE_URL", "SUPABASE_SERVICE_ROLE_KEY"];
const missingEnv = required.filter((key) => !process.env[key]);

const result = {
  connectionOk: false,
  tablesOk: false,
  missingEnv,
  missingTables: [],
  missingColumns: [],
  tenants: 0,
  superAdmins: 0,
  suppliers: 0,
  serviceRoleCanRead: false,
};

if (missingEnv.length > 0) {
  console.log(JSON.stringify(result, null, 2));
  process.exit(1);
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  },
);

const tables = [
  "tenants",
  "users_profile",
  "tenant_users",
  "suppliers",
  "distributors",
  "laboratories",
  "products",
  "quotations",
  "quotation_items",
  "supplier_quote_sessions",
  "supplier_quote_responses",
  "supplier_quote_response_items",
  "purchase_orders",
  "purchase_order_items",
];

for (const table of tables) {
  const { error } = await supabase.from(table).select("id", { count: "exact", head: true });
  if (error) {
    result.missingTables.push(table);
  }
}

result.tablesOk = result.missingTables.length === 0;
result.connectionOk = result.tablesOk;
result.serviceRoleCanRead = result.tablesOk;

const { error: columnError } = await supabase
  .from("supplier_quote_response_items")
  .select("gross_price,discount_extra,net_price,delivery_term_text")
  .limit(1);

if (columnError) {
  for (const column of ["gross_price", "discount_extra", "net_price", "delivery_term_text"]) {
    if (columnError.message.includes(column) || columnError.details?.includes(column)) {
      result.missingColumns.push(`supplier_quote_response_items.${column}`);
    }
  }
  if (result.missingColumns.length === 0) {
    result.missingColumns.push("supplier_quote_response_items.commercial_fields");
  }
}

result.tenants = await countRows("tenants");
result.superAdmins = await countRows("users_profile", { column: "role", value: "SUPER_ADMIN" });
result.suppliers = await countRows("suppliers");

console.log(JSON.stringify(result, null, 2));

if (
  !result.connectionOk ||
  !result.tablesOk ||
  result.missingColumns.length > 0 ||
  result.tenants < 1 ||
  result.superAdmins < 1 ||
  result.suppliers < 1
) {
  process.exit(1);
}

async function countRows(table, filter) {
  let query = supabase.from(table).select("id", { count: "exact", head: true });
  if (filter) query = query.eq(filter.column, filter.value);
  const { count, error } = await query;
  if (error) return 0;
  return count ?? 0;
}

function loadEnvFile(fileName) {
  const filePath = resolve(process.cwd(), fileName);
  if (!existsSync(filePath)) return;

  const content = readFileSync(filePath, "utf8");
  for (const line of content.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index);
    const value = trimmed.slice(index + 1).replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
