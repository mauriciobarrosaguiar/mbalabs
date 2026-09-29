declare module "*.mjs" {
  export const QA_TENANTS: Array<{
    name: string;
    legalName: string;
    cnpj: string;
    city: string;
    state: string;
  }>;
  export function requireQaEnvironment(environment?: Record<string, string | undefined>): {
    url: string;
    serviceRoleKey: string;
    projectRef: string;
  };
}
