const vars = ["DATABASE_URL", "SUPABASE_SERVICE_ROLE_KEY", "NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY"];
for (const name of vars) {
  console.log(`[dronegestor-env] ${name}=${process.env[name] ? "present" : "missing"}`);
}
