import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  Download,
  ListChecks,
  Plus,
  ReceiptText,
  Users,
} from "lucide-react";
import { TenantManagementTable } from "@/modules/cotacoes/components/admin/tenant-management-table";
import { KpiCard } from "@/modules/cotacoes/components/dashboard/kpi-card";
import { StatusBadge } from "@/modules/cotacoes/components/dashboard/status-badge";
import { DemoCrudTable, type DemoCrudRow } from "@/modules/cotacoes/components/forms/demo-crud-table";
import { ImportWizard } from "@/modules/cotacoes/components/imports/import-wizard";
import { DemoQuotationTable } from "@/modules/cotacoes/components/quotations/demo-quotation-table";
import { GeneratePurchaseOrdersButton } from "@/modules/cotacoes/components/quotations/generate-purchase-orders-button";
import { NewQuotationForm } from "@/modules/cotacoes/components/quotations/new-quotation-form";
import { PublicOrderActions } from "@/modules/cotacoes/components/quotations/public-order-actions";
import { QuotationBasicEditor } from "@/modules/cotacoes/components/quotations/quotation-basic-editor";
import { BackButton, QuotationPageActions } from "@/modules/cotacoes/components/quotations/quotation-page-actions";
import { SupplierLinksTable } from "@/modules/cotacoes/components/quotations/supplier-links-table";
import { WinnerOrderLinks } from "@/modules/cotacoes/components/quotations/winner-order-links";
import { CreateMissingQuotationButton, WinnerPendingActions } from "@/modules/cotacoes/components/quotations/winner-pending-actions";
import { Badge } from "@/modules/cotacoes/components/ui/badge";
import { Button } from "@/modules/cotacoes/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/modules/cotacoes/components/ui/card";
import { Input } from "@/modules/cotacoes/components/ui/input";
import { Label } from "@/modules/cotacoes/components/ui/label";
import { Progress } from "@/modules/cotacoes/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/modules/cotacoes/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/modules/cotacoes/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/modules/cotacoes/components/ui/tabs";
import { getUnitLabel, productTypeLabels } from "@/modules/cotacoes/lib/constants";
import {
  formatCurrency,
  formatDate,
  formatInteger,
  formatNumber,
} from "@/modules/cotacoes/lib/formatters";
import {
  customerTypeLabels,
  labelFrom,
  quotationStatusLabels,
  statusLabels,
  userRoleLabels,
} from "@/modules/cotacoes/lib/labels";
import {
  getPurchaseOrderSupplierCompany,
  getPurchaseOrderSupplierContact,
  getPurchaseOrderSupplierDisplay,
} from "@/modules/cotacoes/lib/purchase-order-display";
import {
  getAdminMetrics,
  getBiddingAnalysis,
  getCollections,
  getPharmacyAnalysis,
  getPurchaseOrdersByQuotation,
  getQuotationBundle,
  getSupplierSessions,
  getWinnerOrderPendingItems,
  listQuotationsByModule,
} from "@/modules/cotacoes/lib/data/repository";
import { getRuntimeSummary } from "@/modules/cotacoes/lib/runtime-mode";
import {
  canGenerateQuotationOrders,
  isQuotationClosed,
  isQuotationFinished,
  isQuotationGenerated,
  isQuotationInProgress,
} from "@/modules/cotacoes/lib/quotation-status";
import { savePaymentSettingsAction } from "@/modules/cotacoes/lib/actions/payment-settings";
import { createUserAccessAction, updateUserAccessAction } from "@/modules/cotacoes/lib/actions/users";
import { listManagedUsers, listTenantOptions, type ManagedUser, type TenantOption } from "@/modules/cotacoes/lib/auth/users";
import { createSupabaseAdminClient, hasSupabaseAdminConfig } from "@/modules/cotacoes/lib/supabase/server";
import type {
  CustomerType,
  QuotationAward,
  QuotationItem,
  QuotationStatus,
  PurchaseOrderItem,
  SupplierQuoteResponse,
  SupplierQuoteResponseItem,
  SupplierQuoteSession,
} from "@/modules/cotacoes/lib/types";

type Collections = Awaited<ReturnType<typeof getCollections>>;
type AppSearchParams = Record<string, string | string[] | undefined>;

const supplierTypeLabels: Record<string, string> = {
  vendedor: "Vendedor",
  distribuidora: "Distribuidora",
  laboratorio: "Laboratório",
  marketplace: "Marketplace",
  outro: "Outro",
};

const laboratoryTypeLabels: Record<string, string> = {
  laboratorio: "Laboratório",
  marca: "Marca",
  fabricante: "Fabricante",
};

const paymentStatusOptions: Record<string, string> = {
  pending: "Pendente",
  paid: "Paga",
  overdue: "Vencida",
  canceled: "Cancelada",
  refunded: "Reembolsada",
};

const paymentMethodOptions: Record<string, string> = {
  pix: "Pix",
  transferencia: "Transferência",
  dinheiro: "Dinheiro",
  cartao: "Cartão",
  cortesia: "Cortesia",
  outro: "Outro",
};

const generatedOrderStatusOptions = [
  "gerado",
  "enviado",
  "enviado_ao_vendedor",
  "aberto_pelo_vendedor",
  "em_conferencia",
  "finalizado_pelo_vendedor",
  "parcialmente_faturado",
  "nao_faturado",
  "cancelado",
  "confirmed",
  "canceled",
];

function getSearchParam(searchParams: AppSearchParams | undefined, key: string) {
  const value = searchParams?.[key];
  return Array.isArray(value) ? value[0] : value;
}

async function loadWinnerOrderPendingItems(quotationId: string) {
  try {
    return await getWinnerOrderPendingItems(quotationId);
  } catch {
    return [];
  }
}

const activeInactiveOptions: Record<string, string> = {
  ativo: "Ativo",
  inativo: "Inativo",
};

const ufLabels = Object.fromEntries(
  ["AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS", "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC", "SP", "SE", "TO"].map((uf) => [uf, uf]),
);

export async function AdminDashboardPage() {
  const runtime = getRuntimeSummary();
  if (runtime.missingProductionConfig) return <SupabaseRequiredState />;

  const [metrics, { tenants, auditLogs }] = await Promise.all([
    getAdminMetrics(),
    getCollections(),
  ]);

  return (
    <PageStack>
      <MetricsGrid metrics={metrics} />
      <TwoColumn>
        <Card>
          <CardHeader>
            <CardTitle>Empresas recentes</CardTitle>
          </CardHeader>
          <CardContent>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Empresa</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Mensalidade</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {tenants.map((tenant) => (
                  <TableRow key={tenant.id}>
                    <TableCell className="font-medium">{tenant.nomeFantasia}</TableCell>
                    <TableCell>{labelFrom(customerTypeLabels, tenant.tipoCliente)}</TableCell>
                    <TableCell><StatusBadge status={tenant.status} label={labelFrom(statusLabels, tenant.status)} /></TableCell>
                    <TableCell className="text-right">{formatCurrency(tenant.valorMensal)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle>Eventos do sistema</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {auditLogs.map((log) => (
              <div key={log.id} className="flex items-start gap-3">
                <span className="mt-1 rounded-md bg-slate-100 p-2 text-slate-600">
                  <ReceiptText className="h-4 w-4" />
                </span>
                <div>
                  <p className="text-sm font-medium text-slate-900">{log.action}</p>
                  <p className="text-xs text-muted-foreground">
                    {log.actor} · {formatDate(log.createdAt)}
                  </p>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </TwoColumn>
    </PageStack>
  );
}

export async function AdminSectionPage({
  section,
  slug,
}: {
  section?: string;
  slug?: string[];
}) {
  section = section ?? slug?.[0] ?? "dashboard";
  const subpage = slug?.[1];
  const runtime = getRuntimeSummary();
  if (runtime.missingProductionConfig) return <SupabaseRequiredState />;

  const collections = await getCollections();
  const tenantOptions = Object.fromEntries(
    collections.tenants.map((tenant) => [tenant.id, `${tenant.nomeFantasia} · ${labelFrom(customerTypeLabels, tenant.tipoCliente)}`]),
  );
  if (section === "configuracoes" && subpage === "pagamentos") {
    return <PaymentSettingsPage />;
  }

  if (section === "empresas" && subpage) {
    return <CompanyDetailsPage tenantId={subpage} />;
  }

  if (section === "empresas") {
    return (
      <CrudPage
        title="Empresas clientes"
        description="Cadastre tenants, defina módulo contratado, status e dados financeiros."
      >
        <TenantManagementTable
          initialTenants={collections.tenants}
          plans={collections.subscriptionPlans}
        />
      </CrudPage>
    );
  }

  if (section === "planos") {
    return (
      <CrudPage
        title="Planos"
        description="CRUD de planos comerciais. Alterações de valor valem apenas para próximas mensalidades geradas."
      >
        <DemoCrudTable
          entity="plans"
          storageKey="mba-admin-plans"
          title="Plano"
          primaryKey="name"
          statusOptions={activeInactiveOptions}
          initialRows={collections.subscriptionPlans.map((plan) => ({
            id: plan.id,
            name: plan.name,
            monthlyPrice: plan.monthlyPrice,
            modules: plan.modules,
            maxUsers: plan.maxUsers,
            maxQuotationsMonth: plan.maxQuotationsMonth,
            maxPharmacies: plan.maxPharmacies ?? 1,
            observation: plan.observation ?? "",
            status: plan.status,
          }))}
          fields={[
            { key: "name", label: "Nome do plano" },
            { key: "monthlyPrice", label: "Valor mensal", type: "number" },
            { key: "modules", label: "Módulo incluído", type: "select", options: customerTypeLabels },
            { key: "maxUsers", label: "Quantidade de usuários", type: "number" },
            { key: "maxQuotationsMonth", label: "Quantidade de cotações/mês", type: "number" },
            { key: "maxPharmacies", label: "Quantidade de farmácias/CNPJs", type: "number" },
            { key: "observation", label: "Observação" },
          ]}
        />
      </CrudPage>
    );
  }

  if (section === "mensalidades" || section === "pagamentos") {
    const planOptions = Object.fromEntries(collections.subscriptionPlans.map((plan) => [plan.id, plan.name]));
    return (
      <CrudPage
        title={section === "mensalidades" ? "Mensalidades" : "Pagamentos"}
        description="Mensalidades por empresa, com cobrança Pix preparada, baixa manual e histórico de pagamento."
      >
        <div className="space-y-4 p-4">
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" disabled>
              Gerar mensalidades do mês - Em desenvolvimento
            </Button>
            <Button type="button" variant="outline" disabled>
              Gerar cobrança Pix - Em desenvolvimento
            </Button>
          </div>
          <DemoCrudTable
            entity="monthly_subscriptions"
            storageKey="mba-admin-monthly-subscriptions"
            title="Mensalidade"
            primaryKey="referenceMonth"
            statusOptions={paymentStatusOptions}
            initialRows={collections.monthlySubscriptions.map((subscription) => ({
              id: subscription.id,
              tenantId: subscription.tenantId,
              planId: subscription.planId ?? collections.tenants.find((tenant) => tenant.id === subscription.tenantId)?.planoId ?? "",
              referenceMonth: subscription.referenceMonth,
              dueDate: subscription.dueDate,
              amount: subscription.amount,
              status: subscription.status,
              paymentMethod: subscription.paymentMethod ?? "pix",
              paidAt: subscription.paidAt ?? "",
              paidAmount: subscription.paidAmount ?? subscription.amount,
              manualPaymentNote: subscription.manualPaymentNote ?? "",
              txid: subscription.txid ?? "",
              efiStatus: subscription.efiStatus ?? "",
            }))}
            fields={[
              { key: "tenantId", label: "Empresa", type: "select", options: tenantOptions },
              { key: "planId", label: "Plano", type: "select", options: planOptions },
              { key: "referenceMonth", label: "Referência" },
              { key: "dueDate", label: "Vencimento", type: "date" },
              { key: "amount", label: "Valor", type: "number" },
              { key: "paymentMethod", label: "Forma de pagamento", type: "select", options: paymentMethodOptions },
              { key: "paidAt", label: "Data pagamento", type: "date" },
              { key: "paidAmount", label: "Valor pago", type: "number" },
              { key: "manualPaymentNote", label: "Observação da baixa manual" },
              { key: "txid", label: "TXID Efí" },
              { key: "efiStatus", label: "Status Efí" },
            ]}
          />
        </div>
      </CrudPage>
    );
  }

  if (section === "logs") {
    return (
      <CrudPage
        title="Logs de auditoria"
        description="Registro de ações relevantes, erros e eventos sensíveis do sistema."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Data</TableHead>
              <TableHead>Ator</TableHead>
              <TableHead>Ação</TableHead>
              <TableHead>Severidade</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {collections.auditLogs.map((log) => (
              <TableRow key={log.id}>
                <TableCell>{formatDate(log.createdAt)}</TableCell>
                <TableCell>{log.actor}</TableCell>
                <TableCell>{log.action}</TableCell>
                <TableCell><StatusBadge status={log.severity} label={log.severity} /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CrudPage>
    );
  }

  if (section === "usuarios") {
    const [users, tenants] = await Promise.all([listManagedUsers(), listTenantOptions()]);

    return (
      <CrudPage
        title="Usuários"
        description="Acessos reais do Supabase Auth com perfil, status e vínculo de empresa."
        form={<UserInviteForm tenants={tenants} />}
      >
        <AdminUsersTable users={users} tenants={tenants} />
      </CrudPage>
    );
  }

  if (section === "produtos") {
    return (
      <CrudPage
        title="Produtos"
        description="Produtos cadastrados por empresa, com busca, importação, edição e inativação."
      >
        <DemoCrudTable
          entity="products"
          storageKey="mba-admin-products"
          title="Produto"
          primaryKey="nome"
          showStatus={false}
          initialRows={collections.products.map((product) => ({
            id: product.id,
            tenantId: product.tenantId,
            ean: product.ean ?? "",
            nome: product.nome,
            laboratorio: collections.laboratories.find((laboratory) => laboratory.id === product.laboratorioId)?.nome ?? "",
            status: product.status,
          }))}
          fields={[
            { key: "tenantId", label: "Empresa", type: "hidden", defaultValue: Object.keys(tenantOptions)[0] ?? "" },
            { key: "ean", label: "EAN", required: true },
            { key: "nome", label: "Produto", required: true },
            { key: "laboratorio", label: "Laboratório", required: true },
          ]}
        />
      </CrudPage>
    );
  }

  if (section === "farmacias") {
    return (
      <CrudPage
        title="Farmácias"
        description="Farmácias e CNPJs compradores cadastrados por empresa."
      >
        <DemoCrudTable
          entity="pharmacies"
          storageKey="mba-admin-pharmacies"
          title="Farmácia/CNPJ"
          primaryKey="nomeFantasia"
          emptyMessage="Nenhuma farmácia cadastrada. Cadastre uma empresa do tipo Farmácia ou adicione uma unidade dentro da empresa."
          initialRows={collections.pharmacies.map((pharmacy) => ({
            id: pharmacy.id,
            tenantId: pharmacy.tenantId,
            nomeFantasia: pharmacy.nomeFantasia,
            razaoSocial: pharmacy.razaoSocial,
            cnpj: pharmacy.cnpj,
            cidade: pharmacy.cidade,
            uf: pharmacy.uf,
            responsavel: pharmacy.responsavel,
            whatsapp: pharmacy.whatsapp,
            email: pharmacy.email,
            status: pharmacy.status,
          }))}
          fields={[
            { key: "tenantId", label: "Empresa", type: "select", options: tenantOptions },
            { key: "nomeFantasia", label: "Nome Fantasia" },
            { key: "razaoSocial", label: "Razão Social" },
            { key: "cnpj", label: "CNPJ" },
            { key: "cidade", label: "Cidade" },
            { key: "uf", label: "UF", type: "select", options: ufLabels },
            { key: "responsavel", label: "Responsável" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "email", label: "E-mail", type: "email" },
          ]}
        />
      </CrudPage>
    );
  }

  if (section === "licitacoes") {
    const biddingQuotations = collections.quotations.filter((quotation) => quotation.moduleType === "bidding");

    return (
      <CrudPage
        title="Licitações"
        description="Visão geral das licitações criadas por todas as empresas que usam o módulo."
      >
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Empresa</TableHead>
              <TableHead>Processo/Pregão</TableHead>
              <TableHead>Nome da cotação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Abertura</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Respostas</TableHead>
              <TableHead className="text-right">Valor estimado</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {biddingQuotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={9} className="h-24 text-center text-muted-foreground">
                  Nenhuma licitação cadastrada.
                </TableCell>
              </TableRow>
            ) : (
              biddingQuotations.map((quotation) => {
                const tenant = collections.tenants.find((item) => item.id === quotation.tenantId);
                const items = collections.quotationItems.filter((item) => item.quotationId === quotation.id);
                const responses = collections.supplierQuoteResponses.filter((response) => response.quotationId === quotation.id);
                const estimated = collections.supplierQuoteResponseItems
                  .filter((item) => responses.some((response) => response.id === item.responseId))
                  .reduce((total, item) => total + (item.totalPriceAvailable ?? item.totalPriceIfFull ?? item.netPrice ?? item.unitPrice ?? 0), 0);
                return (
                  <TableRow key={quotation.id}>
                    <TableCell>{tenant?.nomeFantasia ?? "-"}</TableCell>
                    <TableCell>{[quotation.processNumber, quotation.bidNumber].filter(Boolean).join(" / ") || "-"}</TableCell>
                    <TableCell className="font-medium">{quotation.name}</TableCell>
                    <TableCell><StatusBadge status={quotation.status} label={labelFrom(statusLabels, quotation.status)} /></TableCell>
                    <TableCell>{formatDate(quotation.deadlineAt)}</TableCell>
                    <TableCell>{items.length}</TableCell>
                    <TableCell>{responses.length}</TableCell>
                    <TableCell className="text-right">{formatCurrency(estimated)}</TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`/cotacoes/licitacoes/${quotation.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CrudPage>
    );
  }

  if (section === "distribuidoras") {
    return (
      <CrudPage
        title="Distribuidoras"
        description="Distribuidoras cadastradas por empresa, com filtro, importação, edição e inativação."
      >
        <DemoCrudTable
          entity="distributors"
          storageKey="mba-admin-distributors"
          title="Distribuidora"
          primaryKey="nome"
          emptyMessage="Nenhuma distribuidora cadastrada."
          initialRows={collections.distributors.map((distributor) => ({
            id: distributor.id,
            tenantId: distributor.tenantId,
            nome: distributor.nome,
            unidadeCd: distributor.unidadeCd,
            uf: distributor.uf,
            pedidoMinimo: distributor.pedidoMinimo,
            prazoMedio: distributor.prazoMedio,
            portal: distributor.portal ?? "",
            observacao: distributor.observacao ?? "",
            status: distributor.status,
          }))}
          fields={[
            { key: "tenantId", label: "Empresa", type: "select", options: tenantOptions },
            { key: "nome", label: "Nome" },
            { key: "unidadeCd", label: "Unidade/CD" },
            { key: "uf", label: "UF", type: "select", options: ufLabels },
            { key: "pedidoMinimo", label: "Pedido Mínimo", type: "number" },
            { key: "prazoMedio", label: "Prazo Médio" },
            { key: "portal", label: "Portal" },
            { key: "observacao", label: "Observação" },
          ]}
        />
      </CrudPage>
    );
  }

  if (section === "vendedores") {
    const sellers = collections.suppliers.filter((supplier) => supplier.tipoFornecedor === "vendedor");

    return (
      <CrudPage
        title="Vendedores"
        description="Vendedores e fornecedores externos cadastrados por empresa para receber links públicos de cotação."
      >
        <DemoCrudTable
          entity="suppliers"
          storageKey="mba-admin-suppliers"
          title="Vendedor/Fornecedor"
          primaryKey="nome"
          emptyMessage="Nenhum vendedor cadastrado ainda."
          initialRows={sellers.map((seller) => ({
            id: seller.id,
            tenantId: seller.tenantId,
            nome: seller.nome,
            empresa: seller.empresa,
            whatsapp: seller.whatsapp,
            email: seller.email ?? "",
            tipoFornecedor: seller.tipoFornecedor,
            observacao: seller.observacao ?? "",
            status: seller.status,
          }))}
          fields={[
            { key: "tenantId", label: "Empresa", type: "select", options: tenantOptions },
            { key: "nome", label: "Nome" },
            { key: "empresa", label: "Empresa" },
            { key: "whatsapp", label: "WhatsApp" },
            { key: "email", label: "E-mail", type: "email" },
            { key: "tipoFornecedor", label: "Tipo", type: "select", options: supplierTypeLabels },
            { key: "observacao", label: "Observação" },
          ]}
        />
      </CrudPage>
    );
  }

  return (
    <PageStack>
      <HeaderBlock
        title={section === "suporte" ? "Suporte" : "Configurações gerais"}
        description="Área inicial funcional para atendimento, parâmetros do SaaS, integrações e segurança."
      />
      <TwoColumn>
        <Card>
          <CardHeader><CardTitle>Parâmetros</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <LabeledInput label="Nome do SaaS" defaultValue="MBA Cotações" />
            <LabeledInput label="E-mail suporte" defaultValue="suporte@mbacotacoes.com.br" />
            <LabeledInput label="Ambiente Efí" defaultValue="sandbox" />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Chamados recentes</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            {["Dúvida sobre importação", "Solicitação de novo usuário", "Configurar Pix"].map((item, index) => (
              <div key={item} className="flex items-center justify-between rounded-md border border-slate-200 p-3">
                <span className="text-sm">{item}</span>
                <Badge variant="outline">{index === 0 ? "aberto" : "em análise"}</Badge>
              </div>
            ))}
          </CardContent>
        </Card>
      </TwoColumn>
    </PageStack>
  );
}

export async function CompanyRoutePage({
  slug,
  tenantType,
  tenantId,
  searchParams,
}: {
  slug: string[];
  tenantType?: CustomerType;
  tenantId?: string;
  searchParams?: AppSearchParams;
}) {
  const [section = "dashboard", id, subpage] = slug;
  const runtime = getRuntimeSummary();

  if (
    runtime.missingProductionConfig &&
    !(section === "configuracoes" && id === "supabase")
  ) {
    return <SupabaseRequiredState />;
  }

  if (section === "dashboard") return <CompanyDashboard tenantType={tenantType} tenantId={tenantId} />;
  if (section === "acesso-suspenso") return <SuspendedAccessPage />;
  if (section === "sem-permissao") return <ModulePermissionDeniedPage />;
  if (section === "produtos") return <ProductsPage />;
  if (section === "fornecedores") return <SuppliersPage />;
  if (section === "distribuidoras") return <DistributorsPage />;
  if (section === "laboratorios") return <LaboratoriesPage />;
  if (section === "importar") return <ImportsPage />;
  if (section === "historico-precos" || section === "historico-compras" || section === "relatorios") {
    return <ReportsPage section={section} />;
  }
  if (section === "pedidos-gerados" || section === "pedidos-gerados-farmacia" || section === "pedidos-gerados-licitacao") {
    const forcedModule =
      section === "pedidos-gerados-farmacia" ? "pharmacy" :
      section === "pedidos-gerados-licitacao" ? "bidding" :
      undefined;
    return <GeneratedOrdersPage tenantType={tenantType} tenantId={tenantId} searchParams={searchParams} forcedModule={forcedModule} />;
  }
  if (section === "mapa-comparativo" || section === "analise-unidade") {
    return <BiddingOperationalPage section={section} />;
  }
  if (section === "cotacoes-disponiveis" || section === "cotacoes-respondidas" || section === "perfil") {
    return <SupplierPortalPage section={section} />;
  }
  if (section === "usuarios") return <CompanyUsersPage />;
  if (section === "configuracoes" && id === "supabase") return <SupabaseSettingsPage />;
  if (section === "configuracoes") return <CompanySettingsPage />;
  if (section === "cotacoes-farmacia") return <PharmacyQuotationPage id={id} subpage={subpage} tenantId={tenantId} />;
  if (section === "licitacoes") return <BiddingQuotationPage id={id} subpage={subpage} tenantId={tenantId} />;

  return <CompanyDashboard tenantType={tenantType} tenantId={tenantId} />;
}

async function CompanyDashboard({ tenantType = "both", tenantId }: { tenantType?: CustomerType; tenantId?: string } = {}) {
  const runtime = getRuntimeSummary();
  const collections = await getCollections(tenantId);
  const allowedModules = getTenantModules(tenantType);
  const visibleQuotations = collections.quotations.filter((quotation) =>
    allowedModules.includes(quotation.moduleType),
  );
  const hasQuotations = visibleQuotations.length > 0;

  if (runtime.missingProductionConfig) {
    return <SupabaseRequiredState />;
  }

  if (!runtime.isDemo && !hasQuotations) {
    return (
      <PageStack>
        <RuntimeNotice tenantType={tenantType} />
        <EmptyState
          icon={ReceiptText}
          title="Nenhuma cotação criada ainda"
          description="Crie sua primeira cotação para visualizar os indicadores reais do dashboard."
        />
        <div className="flex flex-wrap gap-3">
          {tenantType !== "distributor_bidding" ? (
            <Button asChild>
              <Link href="/cotacoes/cotacoes-farmacia/nova">Criar cotação farmácia</Link>
            </Button>
          ) : null}
          {tenantType !== "pharmacy" ? (
            <Button asChild variant="outline">
              <Link href="/cotacoes/licitacoes/nova">Criar cotação licitação</Link>
            </Button>
          ) : null}
        </div>
      </PageStack>
    );
  }

  const [biddingDashboard, pharmacyDashboard] = await Promise.all([
    allowedModules.includes("bidding")
      ? buildModuleDashboard(collections, "bidding", tenantId)
      : Promise.resolve(null),
    allowedModules.includes("pharmacy")
      ? buildModuleDashboard(collections, "pharmacy", tenantId)
      : Promise.resolve(null),
  ]);

  return (
    <PageStack>
      <RuntimeNotice tenantType={tenantType} />
      {tenantType === "both" && biddingDashboard && pharmacyDashboard ? (
        <Tabs defaultValue="pharmacy" className="w-full">
          <TabsList>
            <TabsTrigger value="pharmacy">Farmácia</TabsTrigger>
            <TabsTrigger value="bidding">Licitação</TabsTrigger>
          </TabsList>
          <TabsContent value="pharmacy" className="mt-4">
            <ModuleDashboardSection
              metrics={pharmacyDashboard.metrics}
              summary={<PharmacySummaryCard collections={collections} />}
            />
          </TabsContent>
          <TabsContent value="bidding" className="mt-4">
            <ModuleDashboardSection
              metrics={biddingDashboard.metrics}
              summary={<BiddingSummaryCard collections={collections} />}
            />
          </TabsContent>
        </Tabs>
      ) : (
        <ModuleDashboardSection
          metrics={(tenantType === "distributor_bidding" ? biddingDashboard : pharmacyDashboard)?.metrics ?? []}
          summary={
            tenantType === "distributor_bidding"
              ? <BiddingSummaryCard collections={collections} />
              : <PharmacySummaryCard collections={collections} />
          }
        />
      )}
    </PageStack>
  );
}

function ModuleDashboardSection({
  metrics,
  summary,
}: {
  metrics: DashboardMetricLike[];
  summary: React.ReactNode;
}) {
  return (
    <div className="space-y-4">
      <MetricsGrid metrics={metrics} />
      {summary ? <TwoColumn>{summary}</TwoColumn> : null}
    </div>
  );
}

type DashboardMetricLike = {
  label: string;
  value: string;
  hint: string;
  tone?: "default" | "success" | "warning" | "danger" | "info";
};

async function buildModuleDashboard(collections: Collections, moduleType: "pharmacy" | "bidding", tenantId?: string) {
  const quotations = collections.quotations.filter((quotation) => quotation.moduleType === moduleType);
  const quotationIds = new Set(quotations.map((quotation) => quotation.id));
  const responses = collections.supplierQuoteResponses.filter((response) =>
    quotationIds.has(response.quotationId) &&
    isSubmittedSupplierResponse(response),
  );
  const respondedSuppliers = new Set(responses.map(getSupplierResponseCountKey));
  const ordersByQuotation = await Promise.all(
    quotations.map((quotation) => getPurchaseOrdersByQuotation(quotation.id, tenantId)),
  );
  const orders = ordersByQuotation.flat();
  const generatedQuotationIds = new Set(orders.map((order) => order.quotationId));
  const moduleLabel = moduleType === "bidding" ? "Licitações" : "Cotações";

  return {
    metrics: [
      { label: moduleLabel, value: formatInteger(quotations.length), hint: "Total do módulo", tone: "info" },
      {
        label: "Em andamento",
        value: formatInteger(quotations.filter((quotation) => isQuotationInProgress(quotation.status)).length),
        hint: "Rascunho, aberta ou aguardando resposta",
        tone: "warning",
      },
      {
        label: "Finalizadas",
        value: formatInteger(quotations.filter((quotation) => isQuotationFinished(quotation.status)).length),
        hint: "Análise encerrada",
        tone: "success",
      },
      {
        label: "Geradas",
        value: formatInteger(quotations.filter((quotation) => isQuotationGenerated(quotation.status) || generatedQuotationIds.has(quotation.id)).length),
        hint: "Com pedido gerado",
        tone: "success",
      },
      { label: "Respostas", value: formatInteger(respondedSuppliers.size), hint: "Fornecedores respondidos" },
      { label: "Pedidos gerados", value: formatInteger(orders.length), hint: "Pedidos de vendedores vencedores" },
    ] satisfies DashboardMetricLike[],
  };
}

function isSubmittedSupplierResponse(response: SupplierQuoteResponse) {
  return ["submitted", "respondido"].includes(String(response.status).toLowerCase());
}

function getSupplierResponseCountKey(response: SupplierQuoteResponse) {
  const supplierKey = response.supplierId ?? response.sellerCompany ?? response.sellerName ?? response.id;
  return `${response.quotationId}:${String(supplierKey).trim().toLowerCase()}`;
}

function getTenantModules(tenantType: CustomerType): Array<"pharmacy" | "bidding"> {
  if (tenantType === "pharmacy") return ["pharmacy"];
  if (tenantType === "distributor_bidding") return ["bidding"];
  return ["bidding", "pharmacy"];
}

function RuntimeNotice({ tenantType = "both" }: { tenantType?: CustomerType }) {
  const runtime = getRuntimeSummary();

  if (!runtime.isDemo) return null;

  return (
    <Card className="border-amber-200 bg-amber-50/70">
      <CardContent className="flex flex-col gap-3 p-4 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <Badge className="bg-amber-100 text-amber-800">Ambiente de demonstração</Badge>
            <Badge variant="outline">{runtime.label}</Badge>
          </div>
          <h2 className="mt-3 text-lg font-semibold text-slate-950">Dashboard demonstrativo</h2>
          <p className="mt-1 text-sm text-slate-700">
            Estes números são exemplos para testar o fluxo. Nenhuma cotação real foi criada. Configure o Supabase para usar dados reais.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link href="/cotacoes/configuracoes/supabase">Configurar Supabase</Link>
          </Button>
          {tenantType !== "distributor_bidding" ? (
            <Button asChild>
              <Link href="/cotacoes/cotacoes-farmacia/nova">Nova cotação farmácia</Link>
            </Button>
          ) : null}
          {tenantType !== "pharmacy" ? (
            <Button asChild variant="outline">
              <Link href="/cotacoes/licitacoes/nova">Nova cotação licitação</Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function SupabaseRequiredState() {
  return (
    <PageStack>
      <Card className="border-red-200 bg-red-50/80">
        <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
          <div>
            <Badge className="bg-red-100 text-red-800">Configuração obrigatória</Badge>
            <h2 className="mt-3 text-lg font-semibold text-slate-950">Supabase não configurado na produção</h2>
            <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-700">
              Em produção o sistema não usa dados demo como fluxo principal. Configure as variáveis do Supabase,
              rode as migrations e crie o primeiro admin para liberar login, cotações, respostas públicas e pedidos reais.
            </p>
          </div>
          <Button asChild>
            <Link href="/cotacoes/configuracoes/supabase">Ver configuração</Link>
          </Button>
        </CardContent>
      </Card>
      <SupabaseSettingsPage />
    </PageStack>
  );
}

function SuspendedAccessPage() {
  return (
    <PageStack>
      <Card className="border-red-200 bg-red-50/80">
        <CardContent className="p-6">
          <Badge className="bg-red-100 text-red-800">Acesso suspenso</Badge>
          <h2 className="mt-4 text-xl font-semibold text-slate-950">
            Sua empresa está com acesso suspenso.
          </h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-700">
            Entre em contato com o administrador do sistema.
          </p>
        </CardContent>
      </Card>
    </PageStack>
  );
}

function ModulePermissionDeniedPage() {
  return (
    <PageStack>
      <EmptyState
        icon={AlertTriangle}
        title="Você não tem permissão para acessar este módulo."
        description="O menu e as rotas disponíveis seguem o tipo de empresa contratado: Farmácia, Distribuidora / Licitação ou Ambos."
      />
    </PageStack>
  );
}

function FeatureStageNote({
  title,
  description,
  badge,
}: {
  title: string;
  description: string;
  badge: "Demo" | "Em desenvolvimento" | "Requer Supabase" | "Requer integração";
}) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50/60 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge variant="outline" className="border-amber-300 text-amber-800">{badge}</Badge>
        <p className="font-medium text-slate-950">{title}</p>
      </div>
      <p className="mt-2 text-sm text-slate-700">{description}</p>
    </div>
  );
}

function ConfigStatus({ label, value, ok }: { label: string; value: string; ok: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-md border border-slate-200 bg-white p-3">
      <span className="text-sm font-medium text-slate-800">{label}</span>
      <Badge variant={ok ? "default" : "outline"}>{value}</Badge>
    </div>
  );
}

async function CompanyDetailsPage({ tenantId }: { tenantId: string }) {
  const [collections, users, tenantOptionsList] = await Promise.all([
    getCollections(),
    listManagedUsers(),
    listTenantOptions(),
  ]);
  const tenant = collections.tenants.find((item) => item.id === tenantId);

  if (!tenant) {
    return (
      <EmptyState
        icon={Building2}
        title="Empresa não encontrada"
        description="Verifique se a empresa ainda está cadastrada no Supabase."
      />
    );
  }

  const plan = collections.subscriptionPlans.find((item) => item.id === tenant.planoId);
  const pharmacies = collections.pharmacies.filter((item) => item.tenantId === tenant.id);
  const sellers = collections.suppliers.filter((item) => item.tenantId === tenant.id && item.tipoFornecedor === "vendedor");
  const distributors = collections.distributors.filter((item) => item.tenantId === tenant.id);
  const products = collections.products.filter((item) => item.tenantId === tenant.id);
  const pharmacyQuotations = collections.quotations.filter((item) => item.tenantId === tenant.id && item.moduleType === "pharmacy");
  const biddingQuotations = collections.quotations.filter((item) => item.tenantId === tenant.id && item.moduleType === "bidding");
  const subscriptions = collections.monthlySubscriptions.filter((item) => item.tenantId === tenant.id);
  const tenantUsers = users.filter((user) => user.tenantLinks.some((link) => link.tenantId === tenant.id));

  return (
    <PageStack>
      <HeaderBlock
        title={tenant.nomeFantasia}
        description={`${labelFrom(customerTypeLabels, tenant.tipoCliente)} · ${labelFrom(statusLabels, tenant.status)} · ${plan?.name ?? "Sem plano"}`}
      />
      <MetricsGrid
        metrics={[
          { label: "Farmácias/CNPJs", value: String(pharmacies.length), hint: "Unidades operacionais", tone: "info" },
          { label: "Usuários", value: String(tenantUsers.length), hint: "Vinculados à empresa", tone: "default" },
          { label: "Vendedores", value: String(sellers.length), hint: "Recebem cotações", tone: "success" },
          { label: "Mensalidades", value: String(subscriptions.length), hint: "Histórico financeiro", tone: "warning" },
        ]}
      />
      <Tabs defaultValue="dados">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="dados">Dados</TabsTrigger>
          <TabsTrigger value="farmacias">Farmácias/CNPJs</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="vendedores">Vendedores</TabsTrigger>
          <TabsTrigger value="distribuidoras">Distribuidoras</TabsTrigger>
          <TabsTrigger value="produtos">Produtos</TabsTrigger>
          <TabsTrigger value="cotacoes">Cotações</TabsTrigger>
          <TabsTrigger value="licitacoes">Licitações</TabsTrigger>
          <TabsTrigger value="mensalidades">Mensalidades</TabsTrigger>
          <TabsTrigger value="pagamentos">Pagamentos</TabsTrigger>
        </TabsList>

        <TabsContent value="dados" className="mt-4">
          <Card>
            <CardContent className="grid gap-4 p-5 md:grid-cols-2 xl:grid-cols-3">
              <Detail label="Nome fantasia" value={tenant.nomeFantasia} />
              <Detail label="Razão social" value={tenant.razaoSocial} />
              <Detail label="CNPJ" value={tenant.cnpj} />
              <Detail label="Tipo de cliente" value={labelFrom(customerTypeLabels, tenant.tipoCliente)} />
              <Detail label="Responsável" value={tenant.responsavelNome} />
              <Detail label="E-mail" value={tenant.responsavelEmail} />
              <Detail label="WhatsApp" value={tenant.responsavelWhatsapp} />
              <Detail label="Plano" value={plan?.name ?? "-"} />
              <Detail label="Mensalidade" value={formatCurrency(tenant.valorMensal)} />
              <Detail label="Vencimento" value={formatDate(tenant.dataVencimento)} />
              <Detail label="Status" value={labelFrom(statusLabels, tenant.status)} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="farmacias" className="mt-4">
          <Card><CardContent className="p-4">
            <DemoCrudTable
              entity="pharmacies"
              storageKey={`mba-company-${tenant.id}-pharmacies`}
              title="Farmácia/CNPJ"
              primaryKey="nomeFantasia"
              statusOptions={activeInactiveOptions}
              emptyMessage="Nenhuma farmácia cadastrada. Cadastre uma empresa do tipo Farmácia ou adicione uma unidade dentro da empresa."
              initialRows={pharmacies.map((pharmacy) => ({
                id: pharmacy.id,
                tenantId: pharmacy.tenantId,
                nomeFantasia: pharmacy.nomeFantasia,
                razaoSocial: pharmacy.razaoSocial,
                cnpj: pharmacy.cnpj,
                cidade: pharmacy.cidade,
                uf: pharmacy.uf,
                responsavel: pharmacy.responsavel,
                whatsapp: pharmacy.whatsapp,
                email: pharmacy.email,
                status: pharmacy.status,
              }))}
              fields={[
                { key: "tenantId", label: "Empresa", type: "hidden", defaultValue: tenant.id },
                { key: "nomeFantasia", label: "Farmácia" },
                { key: "razaoSocial", label: "Razão social" },
                { key: "cnpj", label: "CNPJ" },
                { key: "cidade", label: "Cidade" },
                { key: "uf", label: "UF", type: "select", options: ufLabels },
                { key: "responsavel", label: "Responsável" },
                { key: "whatsapp", label: "WhatsApp" },
                { key: "email", label: "E-mail", type: "email" },
              ]}
            />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="usuarios" className="mt-4">
          <Card><CardContent className="p-0"><AdminUsersTable users={tenantUsers} tenants={tenantOptionsList} /></CardContent></Card>
        </TabsContent>

        <TabsContent value="vendedores" className="mt-4">
          <Card><CardContent className="p-4">
            <DemoCrudTable
              entity="suppliers"
              storageKey={`mba-company-${tenant.id}-suppliers`}
              title="Vendedor"
              primaryKey="nome"
              statusOptions={activeInactiveOptions}
              emptyMessage="Nenhum vendedor cadastrado ainda."
              initialRows={sellers.map((seller) => ({
                id: seller.id,
                tenantId: seller.tenantId,
                nome: seller.nome,
                empresa: seller.empresa,
                whatsapp: seller.whatsapp,
                email: seller.email ?? "",
                tipoFornecedor: seller.tipoFornecedor,
                observacao: seller.observacao ?? "",
                status: seller.status,
              }))}
              fields={[
                { key: "tenantId", label: "Empresa", type: "hidden", defaultValue: tenant.id },
                { key: "nome", label: "Nome" },
                { key: "empresa", label: "Empresa do vendedor" },
                { key: "whatsapp", label: "WhatsApp" },
                { key: "email", label: "E-mail", type: "email" },
                { key: "tipoFornecedor", label: "Tipo", type: "select", options: supplierTypeLabels, defaultValue: "vendedor" },
                { key: "observacao", label: "Observação" },
              ]}
            />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="distribuidoras" className="mt-4">
          <Card><CardContent className="p-4">
            <DemoCrudTable
              entity="distributors"
              storageKey={`mba-company-${tenant.id}-distributors`}
              title="Distribuidora"
              primaryKey="nome"
              statusOptions={activeInactiveOptions}
              emptyMessage="Nenhuma distribuidora cadastrada."
              initialRows={distributors.map((distributor) => ({
                id: distributor.id,
                tenantId: distributor.tenantId,
                nome: distributor.nome,
                unidadeCd: distributor.unidadeCd,
                uf: distributor.uf,
                pedidoMinimo: distributor.pedidoMinimo,
                prazoMedio: distributor.prazoMedio,
                status: distributor.status,
              }))}
              fields={[
                { key: "tenantId", label: "Empresa", type: "hidden", defaultValue: tenant.id },
                { key: "nome", label: "Nome" },
                { key: "unidadeCd", label: "Unidade/CD" },
                { key: "uf", label: "UF", type: "select", options: ufLabels },
                { key: "pedidoMinimo", label: "Pedido mínimo", type: "number" },
                { key: "prazoMedio", label: "Prazo médio" },
              ]}
            />
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="produtos" className="mt-4">
          <TenantProductsTable tenantId={tenant.id} products={products} laboratories={collections.laboratories} />
        </TabsContent>

        <TabsContent value="cotacoes" className="mt-4">
          <TenantQuotationsTable quotations={pharmacyQuotations} collections={collections} emptyMessage="Nenhuma cotação farmácia cadastrada." />
        </TabsContent>

        <TabsContent value="licitacoes" className="mt-4">
          <TenantQuotationsTable quotations={biddingQuotations} collections={collections} emptyMessage="Nenhuma licitação cadastrada." />
        </TabsContent>

        <TabsContent value="mensalidades" className="mt-4">
          <TenantSubscriptionsTable tenant={tenant} subscriptions={subscriptions} plans={collections.subscriptionPlans} />
        </TabsContent>

        <TabsContent value="pagamentos" className="mt-4">
          <TenantSubscriptionsTable tenant={tenant} subscriptions={subscriptions} plans={collections.subscriptionPlans} />
        </TabsContent>
      </Tabs>
    </PageStack>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border border-slate-200 bg-white p-3">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 text-sm font-medium text-slate-950">{value || "-"}</p>
    </div>
  );
}

function TenantProductsTable({
  tenantId,
  products,
  laboratories,
}: {
  tenantId: string;
  products: Collections["products"];
  laboratories: Collections["laboratories"];
}) {
  return (
    <Card>
      <CardContent className="p-4">
        <DemoCrudTable
          entity="products"
          storageKey={`mba-company-${tenantId}-products`}
          title="Produto"
          primaryKey="nome"
          statusOptions={activeInactiveOptions}
          emptyMessage="Nenhum produto cadastrado."
          showStatus={false}
          initialRows={products.map((product) => ({
            id: product.id,
            tenantId: product.tenantId,
            ean: product.ean ?? "",
            nome: product.nome,
            laboratorio: laboratories.find((laboratory) => laboratory.id === product.laboratorioId)?.nome ?? "",
            status: product.status,
          }))}
          fields={[
            { key: "tenantId", label: "Empresa", type: "hidden", defaultValue: tenantId },
            { key: "ean", label: "EAN", required: true },
            { key: "nome", label: "Produto", required: true },
            { key: "laboratorio", label: "Laboratório", required: true },
          ]}
        />
      </CardContent>
    </Card>
  );
}

function TenantQuotationsTable({
  quotations,
  collections,
  emptyMessage,
}: {
  quotations: Collections["quotations"];
  collections: Collections;
  emptyMessage: string;
}) {
  return (
    <Card>
      <CardContent className="p-0">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Processo/Pregão</TableHead>
              <TableHead>Cotação</TableHead>
              <TableHead>Status</TableHead>
              <TableHead>Abertura</TableHead>
              <TableHead>Itens</TableHead>
              <TableHead>Respostas</TableHead>
              <TableHead>Ações</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {quotations.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="h-24 text-center text-muted-foreground">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              quotations.map((quotation) => {
                const itemCount = collections.quotationItems.filter((item) => item.quotationId === quotation.id).length;
                const responseCount = collections.supplierQuoteResponses.filter((response) => response.quotationId === quotation.id).length;
                const base = quotation.moduleType === "bidding" ? "/cotacoes/licitacoes" : "/cotacoes/cotacoes-farmacia";
                return (
                  <TableRow key={quotation.id}>
                    <TableCell>{[quotation.processNumber, quotation.bidNumber].filter(Boolean).join(" / ") || "-"}</TableCell>
                    <TableCell className="font-medium">{quotation.name}</TableCell>
                    <TableCell><StatusBadge status={quotation.status} label={labelFrom(quotationStatusLabels, quotation.status)} /></TableCell>
                    <TableCell>{formatDate(quotation.deadlineAt)}</TableCell>
                    <TableCell>{itemCount}</TableCell>
                    <TableCell>{responseCount}</TableCell>
                    <TableCell>
                      <Button asChild variant="outline" size="sm">
                        <Link href={`${base}/${quotation.id}`}>Ver</Link>
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

function TenantSubscriptionsTable({
  tenant,
  subscriptions,
  plans,
}: {
  tenant: Collections["tenants"][number];
  subscriptions: Collections["monthlySubscriptions"];
  plans: Collections["subscriptionPlans"];
}) {
  const planOptions = Object.fromEntries(plans.map((plan) => [plan.id, plan.name]));

  return (
    <Card>
      <CardContent className="space-y-4 p-4">
        <div className="flex flex-wrap gap-2">
          <Button type="button" variant="outline" disabled>
            Baixa manual - Em desenvolvimento
          </Button>
          <Button type="button" variant="outline" disabled>
            Suspender empresa - Em desenvolvimento
          </Button>
        </div>
        <DemoCrudTable
          entity="monthly_subscriptions"
          storageKey={`mba-company-${tenant.id}-subscriptions`}
          title="Mensalidade"
          primaryKey="referenceMonth"
          statusOptions={paymentStatusOptions}
          emptyMessage="Nenhuma mensalidade gerada para esta empresa."
          initialRows={subscriptions.map((subscription) => ({
            id: subscription.id,
            tenantId: subscription.tenantId,
            planId: subscription.planId ?? tenant.planoId,
            referenceMonth: subscription.referenceMonth,
            dueDate: subscription.dueDate,
            amount: subscription.amount,
            status: subscription.status,
            paymentMethod: subscription.paymentMethod ?? "pix",
            paidAt: subscription.paidAt ?? "",
            paidAmount: subscription.paidAmount ?? subscription.amount,
            manualPaymentNote: subscription.manualPaymentNote ?? "",
            txid: subscription.txid ?? "",
            efiStatus: subscription.efiStatus ?? "",
          }))}
          fields={[
            { key: "tenantId", label: "Empresa", type: "hidden", defaultValue: tenant.id },
            { key: "planId", label: "Plano", type: "select", options: planOptions, defaultValue: tenant.planoId },
            { key: "referenceMonth", label: "Referência" },
            { key: "dueDate", label: "Vencimento", type: "date" },
            { key: "amount", label: "Valor", type: "number" },
            { key: "paymentMethod", label: "Forma de pagamento", type: "select", options: paymentMethodOptions },
            { key: "paidAt", label: "Data pagamento", type: "date" },
            { key: "paidAmount", label: "Valor pago", type: "number" },
            { key: "manualPaymentNote", label: "Observação da baixa manual" },
            { key: "txid", label: "TXID Efí" },
            { key: "efiStatus", label: "Status Efí" },
          ]}
        />
      </CardContent>
    </Card>
  );
}

type PaymentSettingsRow = {
  provider?: string | null;
  environment?: string | null;
  pix_key?: string | null;
  client_id?: string | null;
  client_secret?: string | null;
  certificate_reference?: string | null;
  webhook_url?: string | null;
  receiver_account?: string | null;
};

async function PaymentSettingsPage() {
  const settings = await getPaymentSettings();
  const hasClientSecret = Boolean(settings?.client_secret || process.env.EFI_CLIENT_SECRET);
  const hasCertificate = Boolean(settings?.certificate_reference || process.env.EFI_CERTIFICATE_PATH);

  return (
    <CrudPage
      title="Configurações de pagamento"
      description="Configuração preparada para Efí Bank, com segredo gravado apenas pelo servidor e nunca exibido completo na interface."
    >
      <form action={savePaymentSettingsAction} className="grid gap-4 p-4 md:grid-cols-2 xl:grid-cols-3">
        <div className="space-y-2">
          <Label>Provedor</Label>
          <select
            name="provider"
            defaultValue={settings?.provider ?? "efi"}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="efi">Efí Bank</option>
          </select>
        </div>
        <div className="space-y-2">
          <Label>Ambiente</Label>
          <select
            name="environment"
            defaultValue={settings?.environment ?? "sandbox"}
            className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
          >
            <option value="sandbox">Sandbox</option>
            <option value="production">Produção</option>
          </select>
        </div>
        <LabeledInput name="pixKey" label="Chave Pix" defaultValue={settings?.pix_key ?? ""} />
        <LabeledInput name="clientId" label="Client ID" defaultValue={settings?.client_id ?? ""} />
        <LabeledInput
          name="clientSecret"
          label="Client Secret"
          type="password"
          placeholder={hasClientSecret ? "configurado" : "não configurado"}
        />
        <LabeledInput
          name="certificateReference"
          label="Certificado"
          placeholder={hasCertificate ? "configurado" : "referência segura do certificado"}
          defaultValue={settings?.certificate_reference ?? ""}
        />
        <LabeledInput name="webhookUrl" label="Webhook URL" defaultValue={settings?.webhook_url ?? ""} />
        <LabeledInput name="receiverAccount" label="Conta/identificação recebedora" defaultValue={settings?.receiver_account ?? ""} />
        <div className="md:col-span-2 xl:col-span-3">
          <div className="grid gap-3 md:grid-cols-3">
            <ConfigStatus label="Client Secret" value={hasClientSecret ? "configurado" : "não configurado"} ok={hasClientSecret} />
            <ConfigStatus label="Certificado" value={hasCertificate ? "configurado" : "não configurado"} ok={hasCertificate} />
            <ConfigStatus label="Status da conexão" value="Em desenvolvimento" ok={false} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 md:col-span-2 xl:col-span-3">
          <Button type="submit">Salvar configuração</Button>
          <Button type="button" variant="outline" disabled>
            Testar conexão - Em desenvolvimento
          </Button>
        </div>
      </form>
    </CrudPage>
  );
}

async function getPaymentSettings(): Promise<PaymentSettingsRow | null> {
  if (!hasSupabaseAdminConfig()) return null;

  try {
    const supabase = createSupabaseAdminClient();
    const { data } = await supabase
      .from("payment_settings")
      .select("provider, environment, pix_key, client_id, client_secret, certificate_reference, webhook_url, receiver_account")
      .eq("provider", "efi")
      .maybeSingle();
    return data as PaymentSettingsRow | null;
  } catch {
    return null;
  }
}

async function ProductsPage() {
  const { products, laboratories } = await getCollections();
  const demoRows = products.map((product) => ({
    id: product.id,
    tenantId: product.tenantId,
    ean: product.ean ?? "",
    nome: product.nome,
    laboratorio: laboratories.find((laboratory) => laboratory.id === product.laboratorioId)?.nome ?? "",
    status: product.status,
  })) as DemoCrudRow[];
  return (
    <CrudPage
      title="Produtos"
      description="Cadastro simples para cotação de farmácia: EAN, produto e laboratório."
    >
      <DemoCrudTable
        entity="products"
        storageKey="cotafarma-demo-products"
        title="Produto"
        primaryKey="nome"
        initialRows={demoRows}
        showStatus={false}
        fields={[
          { key: "tenantId", label: "Empresa", type: "hidden" },
          { key: "ean", label: "EAN", required: true },
          { key: "nome", label: "Produto", required: true },
          { key: "laboratorio", label: "Laboratório", required: true },
        ]}
      />
    </CrudPage>
  );
}

async function SuppliersPage() {
  const { suppliers } = await getCollections();
  const demoRows = suppliers.map((supplier) => ({
    id: supplier.id,
    nome: supplier.nome,
    empresa: supplier.empresa,
    whatsapp: supplier.whatsapp,
    email: supplier.email,
    tipoFornecedor: supplier.tipoFornecedor,
    observacao: supplier.observacao ?? "",
    status: supplier.status,
  })) as DemoCrudRow[];
  return (
    <CrudPage
      title="Fornecedores e vendedores"
      description="Contatos usados para gerar links públicos de resposta."
    >
      <DemoCrudTable
        entity="suppliers"
        storageKey="cotafarma-demo-suppliers"
        title="Fornecedor"
        primaryKey="nome"
        initialRows={demoRows}
        fields={[
          { key: "nome", label: "Nome" },
          { key: "empresa", label: "Empresa" },
          { key: "whatsapp", label: "WhatsApp" },
          { key: "email", label: "E-mail", type: "email" },
          { key: "tipoFornecedor", label: "Tipo fornecedor", type: "select", options: supplierTypeLabels },
          { key: "observacao", label: "Observação" },
        ]}
      />
      <div className="mt-6 border-t border-slate-200 pt-4">
        <p className="mb-3 text-sm font-medium text-muted-foreground">Registros atuais</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>Empresa</TableHead>
            <TableHead>WhatsApp</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {suppliers.map((supplier) => (
            <TableRow key={supplier.id}>
              <TableCell className="font-medium">{supplier.nome}</TableCell>
              <TableCell>{supplier.empresa}</TableCell>
              <TableCell>{supplier.whatsapp}</TableCell>
              <TableCell>{labelFrom(supplierTypeLabels, supplier.tipoFornecedor)}</TableCell>
              <TableCell><StatusBadge status={supplier.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </CrudPage>
  );
}

async function DistributorsPage() {
  const { distributors } = await getCollections();
  const demoRows = distributors.map((distributor) => ({
    id: distributor.id,
    nome: distributor.nome,
    unidadeCd: distributor.unidadeCd,
    uf: distributor.uf,
    pedidoMinimo: distributor.pedidoMinimo,
    prazoMedio: distributor.prazoMedio,
    portal: distributor.portal ?? "",
    observacao: distributor.observacao ?? "",
    status: distributor.status,
  })) as DemoCrudRow[];
  return (
    <CrudPage
      title="Distribuidoras"
      description="Controle de CD, UF, pedido mínimo e prazo médio para análise de farmácia."
    >
      <DemoCrudTable
        entity="distributors"
        storageKey="cotafarma-demo-distributors"
        title="Distribuidora"
        primaryKey="nome"
        initialRows={demoRows}
        fields={[
          { key: "nome", label: "Nome" },
          { key: "unidadeCd", label: "Unidade/CD" },
          { key: "uf", label: "UF", type: "select", options: ufLabels },
          { key: "pedidoMinimo", label: "Pedido mínimo", type: "number" },
          { key: "prazoMedio", label: "Prazo médio" },
          { key: "portal", label: "Portal" },
          { key: "observacao", label: "Observação" },
        ]}
      />
      <div className="mt-6 border-t border-slate-200 pt-4">
        <p className="mb-3 text-sm font-medium text-muted-foreground">Registros atuais</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Distribuidora</TableHead>
            <TableHead>CD</TableHead>
            <TableHead>UF</TableHead>
            <TableHead>Pedido mínimo</TableHead>
            <TableHead>Prazo</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {distributors.map((distributor) => (
            <TableRow key={distributor.id}>
              <TableCell className="font-medium">{distributor.nome}</TableCell>
              <TableCell>{distributor.unidadeCd}</TableCell>
              <TableCell>{distributor.uf}</TableCell>
              <TableCell>{formatCurrency(distributor.pedidoMinimo)}</TableCell>
              <TableCell>{distributor.prazoMedio}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </CrudPage>
  );
}

async function LaboratoriesPage() {
  const { laboratories } = await getCollections();
  const demoRows = laboratories.map((laboratory) => ({
    id: laboratory.id,
    nome: laboratory.nome,
    cnpj: laboratory.cnpj ?? "",
    tipo: laboratory.tipo,
    status: laboratory.status,
  })) as DemoCrudRow[];
  return (
    <CrudPage
      title="Laboratórios e marcas"
      description="Base para produtos, marca ofertada e restrições de laboratório obrigatório."
    >
      <DemoCrudTable
        entity="laboratories"
        storageKey="cotafarma-demo-laboratories"
        title="Laboratório"
        primaryKey="nome"
        initialRows={demoRows}
        fields={[
          { key: "nome", label: "Nome" },
          { key: "cnpj", label: "CNPJ opcional" },
          { key: "tipo", label: "Tipo", type: "select", options: laboratoryTypeLabels },
        ]}
      />
      <div className="mt-6 border-t border-slate-200 pt-4">
        <p className="mb-3 text-sm font-medium text-muted-foreground">Registros atuais</p>
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Nome</TableHead>
            <TableHead>CNPJ</TableHead>
            <TableHead>Tipo</TableHead>
            <TableHead>Status</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {laboratories.map((laboratory) => (
            <TableRow key={laboratory.id}>
              <TableCell className="font-medium">{laboratory.nome}</TableCell>
              <TableCell>{laboratory.cnpj ?? "-"}</TableCell>
              <TableCell>{laboratory.tipo}</TableCell>
              <TableCell><StatusBadge status={laboratory.status} /></TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
      </div>
    </CrudPage>
  );
}

function ImportsPage() {
  return (
    <PageStack>
      <HeaderBlock
        title="Central de importação"
        description="Importe produtos, fornecedores, distribuidoras, farmácias/CNPJs, laboratórios e itens de cotação com prévia, mapeamento e validação."
      />
      <ImportWizard />
    </PageStack>
  );
}

async function ReportsPage({ section }: { section: string }) {
  const collections = await getCollections();
  const titleMap: Record<string, string> = {
    "historico-precos": "Histórico de preços",
    "historico-compras": "Histórico de compras",
    relatorios: "Relatórios",
  };

  return (
    <PageStack>
      <HeaderBlock
        title={titleMap[section]}
        description="Consulta operacional com dados gravados no Supabase."
      />
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Preço</TableHead>
                <TableHead>Origem</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {collections.supplierQuoteResponseItems.map((item) => {
                const response = collections.supplierQuoteResponses.find((entry) => entry.id === item.responseId);
                const quotation = collections.quotations.find((entry) => entry.id === response?.quotationId);
                const quotationItem = collections.quotationItems.find((entry) => entry.id === item.quotationItemId);

                return (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.offeredProductName ?? quotationItem?.productName ?? "-"}</TableCell>
                    <TableCell>{response?.sellerName ?? "-"}</TableCell>
                    <TableCell>{formatDate(response?.submittedAt ?? quotation?.updatedAt ?? new Date().toISOString())}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.netPrice ?? item.unitPrice ?? 0)}</TableCell>
                    <TableCell>{quotation?.moduleType === "bidding" ? "Licitação" : "Farmácia"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageStack>
  );
}

async function BiddingOperationalPage({ section }: { section: string }) {
  const collections = await getCollections();
  const biddingQuotations = collections.quotations.filter((quotation) => quotation.moduleType === "bidding");
  const titles: Record<string, string> = {
    "mapa-comparativo": "Mapa comparativo",
    "analise-unidade": "Análise por unidade",
    "pedidos-gerados": "Pedidos gerados",
  };

  return (
    <CrudPage
      title={titles[section] ?? "Licitação"}
      description="Visão operacional das licitações com dados gravados no Supabase."
    >
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Licitação</TableHead>
            <TableHead>Status</TableHead>
            <TableHead>Itens</TableHead>
            <TableHead>Respostas</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {biddingQuotations.map((quotation) => (
            <TableRow key={quotation.id}>
              <TableCell className="font-medium">{quotation.name}</TableCell>
              <TableCell><StatusBadge status={quotation.status} label={labelFrom(quotationStatusLabels, quotation.status)} /></TableCell>
              <TableCell>{collections.quotationItems.filter((item) => item.quotationId === quotation.id).length}</TableCell>
              <TableCell>{collections.supplierQuoteResponses.filter((response) => response.quotationId === quotation.id).length}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </CrudPage>
  );
}

async function GeneratedOrdersPage({
  tenantType = "both",
  tenantId,
  searchParams,
  forcedModule,
}: {
  tenantType?: CustomerType;
  tenantId?: string;
  searchParams?: AppSearchParams;
  forcedModule?: "pharmacy" | "bidding";
}) {
  const collections = await getCollections(tenantId);
  const allowedModules = getTenantModules(tenantType);
  const moduleParam = getSearchParam(searchParams, "module");
  const moduleFilter = forcedModule ?? (moduleParam === "pharmacy" || moduleParam === "bidding" ? moduleParam : "all");
  const effectiveModuleFilter =
    moduleFilter !== "all" && allowedModules.includes(moduleFilter) ? moduleFilter : "all";
  const statusFilter = getSearchParam(searchParams, "status") ?? "all";
  const dateFilter = getSearchParam(searchParams, "date") ?? "";
  const vendorParam = getSearchParam(searchParams, "vendor") ?? "";
  const vendorFilter = vendorParam.trim().toLowerCase();
  const quotations = collections.quotations.filter((quotation) =>
    allowedModules.includes(quotation.moduleType) &&
    (effectiveModuleFilter === "all" || quotation.moduleType === effectiveModuleFilter),
  );

  const orderGroups = await Promise.all(quotations.map(async (quotation) => {
    const [orders, pendencies] = await Promise.all([
      getPurchaseOrdersByQuotation(quotation.id, tenantId),
      loadWinnerOrderPendingItems(quotation.id),
    ]);
    return { quotation, orders, pendencies };
  }));

  const rows = orderGroups
    .flatMap(({ quotation, orders }) => orders.map((order) => ({ quotation, order })))
    .filter(({ order }) => {
      const vendorText = [
        getPurchaseOrderSupplierDisplay(order),
        getPurchaseOrderSupplierCompany(order),
        getPurchaseOrderSupplierContact(order),
      ].filter(Boolean).join(" ").toLowerCase();
      const matchesVendor = !vendorFilter || vendorText.includes(vendorFilter);
      const matchesStatus = statusFilter === "all" || order.status === statusFilter;
      const matchesDate = !dateFilter || order.generatedAt?.slice(0, 10) === dateFilter;
      return matchesVendor && matchesStatus && matchesDate;
    });

  const pendingGroups = orderGroups
    .map(({ quotation, pendencies }) => ({
      quotation,
      pendencies: pendencies.filter((pending) => pending.status === "pendente" && pending.quantity > 0),
    }))
    .filter((group) => group.pendencies.length > 0);

  const totalMissing = rows.reduce(
    (total, { order }) => total + order.items.reduce((sum, item) => sum + getOrderItemMissingQuantity(item), 0),
    0,
  );
  const exportSearchParams = new URLSearchParams();
  if (effectiveModuleFilter !== "all") exportSearchParams.set("module", effectiveModuleFilter);
  if (dateFilter) exportSearchParams.set("date", dateFilter);
  if (vendorParam.trim()) exportSearchParams.set("vendor", vendorParam.trim());
  if (statusFilter !== "all") exportSearchParams.set("status", statusFilter);
  const exportHref = `/api/cotacoes/export/pedidos-gerados${exportSearchParams.size > 0 ? `?${exportSearchParams.toString()}` : ""}`;
  const pageHref =
    forcedModule === "pharmacy" ? "/cotacoes/pedidos-gerados-farmacia" :
    forcedModule === "bidding" ? "/cotacoes/pedidos-gerados-licitacao" :
    "/cotacoes/pedidos-gerados";
  const moduleTitle =
    effectiveModuleFilter === "pharmacy" ? "Farmácia" :
    effectiveModuleFilter === "bidding" ? "Licitação" :
    "";

  return (
    <PageStack>
      <HeaderBlock
        title={moduleTitle ? `Pedidos gerados - ${moduleTitle}` : "Pedidos gerados"}
        description="Visualize pedidos de farmácia e licitação, com quantidade solicitada, faturada e faltante."
      />
      <Card>
        <CardContent className="p-4">
          <form className="grid gap-3 md:grid-cols-5" action={pageHref}>
            <div className="space-y-2">
              <Label>Módulo</Label>
              {forcedModule ? (
                <Input value={moduleTitle} disabled />
              ) : (
                <select
                  name="module"
                  defaultValue={effectiveModuleFilter}
                  className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                >
                  <option value="all">Todos</option>
                  {allowedModules.includes("pharmacy") ? <option value="pharmacy">Farmácia</option> : null}
                  {allowedModules.includes("bidding") ? <option value="bidding">Licitação</option> : null}
                </select>
              )}
            </div>
            <div className="space-y-2">
              <Label>Data</Label>
              <Input name="date" type="date" defaultValue={dateFilter} />
            </div>
            <div className="space-y-2">
              <Label>Vendedor</Label>
              <Input name="vendor" defaultValue={getSearchParam(searchParams, "vendor") ?? ""} placeholder="Nome ou empresa" />
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <select
                name="status"
                defaultValue={statusFilter}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              >
                <option value="all">Todos</option>
                {generatedOrderStatusOptions.map((status) => (
                  <option key={status} value={status}>{labelFrom(statusLabels, status)}</option>
                ))}
              </select>
            </div>
            <div className="flex items-end gap-2">
              <Button type="submit" className="w-full">Filtrar</Button>
              <Button asChild type="button" variant="outline">
                <Link href={pageHref}>Limpar</Link>
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
      <MetricsGrid
        metrics={[
          { label: "Pedidos", value: formatInteger(rows.length), hint: "Após filtros" },
          { label: "Farmácia", value: formatInteger(rows.filter(({ order }) => order.moduleType === "pharmacy").length), hint: "Pedidos do módulo" },
          { label: "Licitação", value: formatInteger(rows.filter(({ order }) => order.moduleType === "bidding").length), hint: "Pedidos do módulo" },
          { label: "Quantidade faltante", value: formatInteger(totalMissing), hint: "Saldo pendente", tone: totalMissing > 0 ? "warning" : "success" },
        ]}
      />
      <div className="flex justify-end">
        {rows.length > 0 ? (
          <Button asChild variant="outline">
            <Link href={exportHref}><Download className="h-4 w-4" />Exportar Excel</Link>
          </Button>
        ) : (
          <Button variant="outline" disabled><Download className="h-4 w-4" />Exportar Excel</Button>
        )}
      </div>
      {rows.length === 0 ? (
        <EmptyState
          icon={ReceiptText}
          title="Nenhum pedido gerado encontrado"
          description="Gere pedidos a partir de uma cotação finalizada para visualizar esta lista."
        />
      ) : (
        <Card>
          <CardContent className="overflow-x-auto p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Módulo</TableHead>
                  <TableHead>Cotação</TableHead>
                  <TableHead>Vendedor</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Produtos</TableHead>
                  <TableHead className="text-right">Solicitado</TableHead>
                  <TableHead className="text-right">Faturado</TableHead>
                  <TableHead className="text-right">Falta</TableHead>
                  <TableHead className="text-right">Valor previsto</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map(({ quotation, order }) => {
                  const requestedQuantity = order.items.reduce((total, item) => total + item.quantityToBuy, 0);
                  const billedQuantity = order.items.reduce((total, item) => total + getOrderItemBilledQuantity(item), 0);
                  const missingQuantity = order.items.reduce((total, item) => total + getOrderItemMissingQuantity(item), 0);
                  const detailHref = `/cotacoes/${order.moduleType === "bidding" ? "licitacoes" : "cotacoes-farmacia"}/${quotation.id}/pedidos`;
                  return (
                    <TableRow key={order.id}>
                      <TableCell>{order.moduleType === "bidding" ? "Licitação" : "Farmácia"}</TableCell>
                      <TableCell className="min-w-52 font-medium">{quotation.name}</TableCell>
                      <TableCell className="min-w-48">{getPurchaseOrderSupplierDisplay(order)}</TableCell>
                      <TableCell>{order.generatedAt ? formatDate(order.generatedAt) : "-"}</TableCell>
                      <TableCell><StatusBadge status={order.status} label={labelFrom(statusLabels, order.status)} /></TableCell>
                      <TableCell className="min-w-72">
                        <div className="space-y-2">
                          {order.items.map((item) => (
                            <div key={item.id} className="rounded-md bg-slate-50 p-2 text-xs text-slate-700">
                              <p className="font-medium text-slate-950">{item.productName}</p>
                              <p>
                                Solicitado {formatInteger(item.quantityToBuy)} · faturado {formatInteger(getOrderItemBilledQuantity(item))} · falta {formatInteger(getOrderItemMissingQuantity(item))}
                              </p>
                              <p>Status: {labelFrom(statusLabels, getOrderItemDisplayStatus(item))}</p>
                            </div>
                          ))}
                        </div>
                      </TableCell>
                      <TableCell className="text-right">{formatInteger(requestedQuantity)}</TableCell>
                      <TableCell className="text-right">{formatInteger(billedQuantity)}</TableCell>
                      <TableCell className="text-right">{formatInteger(missingQuantity)}</TableCell>
                      <TableCell className="text-right">{formatCurrency(order.totalAmount)}</TableCell>
                      <TableCell>
                        <div className="flex flex-wrap gap-2">
                          <Button asChild variant="outline" size="sm">
                            <Link href={detailHref}>Detalhes</Link>
                          </Button>
                          <Button asChild variant="outline" size="sm">
                            <Link href={`/api/cotacoes/export/pedido/${order.publicToken}`}>Exportar</Link>
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
      {pendingGroups.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Produtos com falta para nova cotação</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            {pendingGroups.map(({ quotation, pendencies }) => (
              <div key={quotation.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{quotation.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {quotation.moduleType === "bidding" ? "Licitação" : "Farmácia"} · {pendencies.length} produto(s) com falta
                    </p>
                  </div>
                  <CreateMissingQuotationButton
                    quotationId={quotation.id}
                    moduleType={quotation.moduleType}
                    pendingIds={pendencies.map((pending) => pending.id)}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </PageStack>
  );
}

function SupplierPortalPage({ section }: { section: string }) {
  const titles: Record<string, string> = {
    "cotacoes-disponiveis": "Cotações disponíveis",
    "cotacoes-respondidas": "Cotações respondidas",
    perfil: "Perfil",
  };

  return (
    <PageStack>
      <EmptyState
        icon={ListChecks}
        title={titles[section] ?? "Portal do fornecedor"}
        description="O acesso de distribuidoras e vendedores usa links públicos por cotação. Quando houver login dedicado, esta área exibirá somente as cotações do fornecedor autenticado."
      />
    </PageStack>
  );
}

function CompanyUsersPage() {
  return (
    <CrudPage
      title="Usuários da empresa"
      description="A gestão de usuários fica centralizada no painel administrativo para manter perfil e tenant consistentes."
    >
      <EmptyState
        icon={Users}
        title="Gestão centralizada"
        description="Peça ao administrador para criar ou alterar acessos em Admin > Usuários."
      />
    </CrudPage>
  );
}

function CompanySettingsPage() {
  return (
    <PageStack>
      <HeaderBlock
        title="Configurações da empresa"
        description="Preferências e permissões operacionais do tenant autenticado."
      />
      <TwoColumn>
        <Card>
          <CardHeader><CardTitle>Perfil e tenant</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>Os acessos, papéis e vínculos com farmácia, licitação ou distribuidora são definidos pelo administrador em Usuários.</p>
            <Button asChild variant="outline">
              <Link href="/cotacoes/usuarios">Ver usuários</Link>
            </Button>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle>Segurança</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm text-muted-foreground">
            <p>RLS por tenant habilitado nas migrations.</p>
            <p>Links públicos têm token, validade e escopo por fornecedor.</p>
            <p>Credenciais de portais ficam preparadas para criptografia futura.</p>
          </CardContent>
        </Card>
      </TwoColumn>
    </PageStack>
  );
}

function SupabaseSettingsPage() {
  const runtime = getRuntimeSummary();
  const modeStatus = {
    supabase: { value: "Supabase", ok: true },
    demo: { value: "Demo local", ok: false },
    missing_config: { value: "Não configurado", ok: false },
  }[runtime.mode];

  return (
    <PageStack>
      <HeaderBlock
        title="Configuração do Supabase"
        description="Status das variáveis necessárias para sair do modo demonstração e usar dados reais."
      />
      <RuntimeNotice />
      <Card>
        <CardHeader>
          <CardTitle>Status da conexão</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2">
          <ConfigStatus label="Modo atual" value={modeStatus.value} ok={modeStatus.ok} />
          <ConfigStatus label="Ambiente local" value={runtime.isLocal ? "Sim" : "Não"} ok={runtime.isLocal} />
          <ConfigStatus label="NEXT_PUBLIC_SUPABASE_URL" value={runtime.supabaseUrlConfigured ? "Configurado" : "Não configurado"} ok={runtime.supabaseUrlConfigured} />
          <ConfigStatus label="NEXT_PUBLIC_SUPABASE_ANON_KEY" value={runtime.supabaseAnonKeyConfigured ? "Configurado" : "Não configurado"} ok={runtime.supabaseAnonKeyConfigured} />
          <ConfigStatus label="SUPABASE_SERVICE_ROLE_KEY" value={runtime.supabaseServiceRoleConfigured ? "Configurado" : "Não configurado"} ok={runtime.supabaseServiceRoleConfigured} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <CardTitle>Instruções de configuração</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3 text-sm text-slate-700">
          <p>1. Criar um projeto no Supabase.</p>
          <p>2. Rodar as migrations da pasta <code className="rounded bg-slate-100 px-1 py-0.5">supabase/migrations</code>.</p>
          <p>3. Configurar as variáveis na Vercel.</p>
          <p>4. Configurar as mesmas variáveis no <code className="rounded bg-slate-100 px-1 py-0.5">.env.local</code>.</p>
          <p>5. Reiniciar a aplicação local e fazer novo deploy.</p>
        </CardContent>
      </Card>
    </PageStack>
  );
}

async function PharmacyQuotationPage({ id, subpage, tenantId }: { id?: string; subpage?: string; tenantId?: string }) {
  if (!id) return <QuotationList moduleType="pharmacy" tenantId={tenantId} />;
  if (id === "nova") return <NewQuotationPage moduleType="pharmacy" tenantId={tenantId} />;
  if (subpage === "editar") return <QuotationEditPage quotationId={id} moduleType="pharmacy" tenantId={tenantId} />;
  if (subpage === "respostas") return <PharmacyResponses quotationId={id} tenantId={tenantId} />;
  if (subpage === "analise") return <PharmacyAnalysis quotationId={id} tenantId={tenantId} />;
  if (subpage === "pedidos") return <OrdersPage quotationId={id} tenantId={tenantId} />;
  return <QuotationDetail quotationId={id} moduleType="pharmacy" tenantId={tenantId} />;
}

async function BiddingQuotationPage({ id, subpage, tenantId }: { id?: string; subpage?: string; tenantId?: string }) {
  if (!id) return <QuotationList moduleType="bidding" tenantId={tenantId} />;
  if (id === "nova") return <NewQuotationPage moduleType="bidding" tenantId={tenantId} />;
  if (subpage === "editar") return <QuotationEditPage quotationId={id} moduleType="bidding" tenantId={tenantId} />;
  if (subpage === "respostas") return <BiddingResponses quotationId={id} tenantId={tenantId} />;
  if (subpage === "analise") return <BiddingAnalysis quotationId={id} tenantId={tenantId} />;
  if (subpage === "mapa-comparativo") return <ComparativeMap quotationId={id} />;
  if (subpage === "saldo-pendente") return <PendingBalancePage quotationId={id} />;
  if (subpage === "pedidos") return <OrdersPage quotationId={id} tenantId={tenantId} />;
  return <QuotationDetail quotationId={id} moduleType="bidding" tenantId={tenantId} />;
}

async function QuotationList({ moduleType, tenantId }: { moduleType: "pharmacy" | "bidding"; tenantId?: string }) {
  const list = await listQuotationsByModule(moduleType, tenantId);
  console.info("[QuotationList] listagem carregada", {
    moduleType,
    count: list.length,
  });
  const base = moduleType === "pharmacy" ? "/cotacoes/cotacoes-farmacia" : "/cotacoes/licitacoes";
  const title = moduleType === "pharmacy" ? "Cotações de farmácia" : "Cotações de licitação";

  return (
    <PageStack>
      <HeaderBlock
        title={title}
        description="Crie, envie links seguros aos fornecedores, analise respostas e gere pedidos vencedores."
        actionLabel="Nova cotação"
        actionHref={`${base}/nova`}
      />
      <Card>
        <CardContent className="p-0">
          <DemoQuotationTable moduleType={moduleType} initialQuotations={list} />
        </CardContent>
      </Card>
    </PageStack>
  );
}

async function NewQuotationPage({ moduleType, tenantId }: { moduleType: "pharmacy" | "bidding"; tenantId?: string }) {
  const { laboratories, products, suppliers } = await getCollections(tenantId);
  return (
    <PageStack>
      <HeaderBlock
        title={moduleType === "pharmacy" ? "Nova cotação farmácia" : "Nova cotação licitação"}
        description="Versão inicial funcional com campos essenciais e preparada para importar planilhas."
      />
      <BackButton fallbackHref={moduleType === "pharmacy" ? "/cotacoes/cotacoes-farmacia" : "/cotacoes/licitacoes"} />
      <NewQuotationForm
        moduleType={moduleType}
        products={products}
        laboratories={laboratories}
        suppliers={suppliers}
      />
    </PageStack>
  );
}

async function QuotationDetail({ quotationId, moduleType, tenantId }: { quotationId: string; moduleType: "pharmacy" | "bidding"; tenantId?: string }) {
  const [{ quotation, items: rawItems }, sessions, orders, pendencies] = await Promise.all([
    getQuotationBundle(quotationId, tenantId),
    getSupplierSessions(quotationId, tenantId),
    getPurchaseOrdersByQuotation(quotationId, tenantId),
    loadWinnerOrderPendingItems(quotationId),
  ]);
  const base = moduleType === "pharmacy" ? "/cotacoes/cotacoes-farmacia" : "/cotacoes/licitacoes";
  const isLocalStorageDemo = quotationId.startsWith("demo-") && quotationId !== "demo-farmacia" && quotationId !== "demo-licitacao";
  const subpages =
    moduleType === "pharmacy"
      ? ["respostas", "analise", "pedidos"]
      : ["respostas", "analise", "mapa-comparativo", "saldo-pendente", "pedidos"];

  const items = rawItems.map((item) => ({
    ...item,
    status: getQuotationItemStatusFromOrders(item, orders),
  }));

  return (
    <PageStack>
      <HeaderBlock
        title={quotation.name}
        description={quotation.notes ?? "Detalhes da cotação"}
      />
      {isLocalStorageDemo ? (
        <FeatureStageNote
          title="Cotação salva no demo local"
          description="Este registro foi criado no navegador e aparece na lista. Enquanto o Supabase não estiver configurado, os detalhes analíticos usam o fluxo demo padrão."
          badge="Demo"
        />
      ) : null}
      <QuotationPageActions quotationId={quotation.id} moduleType={moduleType} status={quotation.status} currentPage="detail" />
      <div className="flex flex-wrap gap-2">
        {!isQuotationClosed(quotation.status) ? (
          <Button asChild variant="outline" size="sm">
            <Link href={`${base}/${quotation.id}/editar`}>Editar</Link>
          </Button>
        ) : null}
        {moduleType === "bidding" ? subpages.filter((page) => page === "mapa-comparativo" || page === "saldo-pendente").map((page) => (
          <Button key={page} asChild variant="outline" size="sm">
            <Link href={`${base}/${quotation.id}/${page}`}>{page.replaceAll("-", " ")}</Link>
          </Button>
        )) : null}
      </div>
      <Card>
        <CardHeader><CardTitle>Itens solicitados</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ItemsTable items={items} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Links dos fornecedores</CardTitle></CardHeader>
        <CardContent className="p-0">
          <SupplierLinksTable moduleType={moduleType} sessions={sessions} deadlineAt={quotation.deadlineAt} />
        </CardContent>
      </Card>
      {canGenerateQuotationOrders(quotation.status) ? (
        <Card>
          <CardHeader><CardTitle>Links dos vendedores vencedores</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {orders.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhum pedido gerado ainda. Use Gerar pedido para criar os links dos vencedores.
              </p>
            ) : orders.map((order) => (
              <div key={order.id} className="rounded-md border border-slate-200 bg-white p-3">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="font-semibold text-slate-950">{order.supplierName}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{order.supplierWhatsapp ?? "WhatsApp não informado"}</p>
                    <p className="mt-1 text-sm text-muted-foreground">
                      {order.items.length} itens ganhos · {formatCurrency(order.totalAmount)}
                    </p>
                  </div>
                  <WinnerOrderLinks order={order} />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
      {canGenerateQuotationOrders(quotation.status) && pendencies.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Produtos com falta</CardTitle>
              <CreateMissingQuotationButton
                quotationId={quotation.id}
                moduleType={moduleType}
                pendingIds={pendencies.filter((pending) => pending.status === "pendente").map((pending) => pending.id)}
                disabled={!pendencies.some((pending) => pending.status === "pendente")}
              />
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {pendencies.map((pending) => (
              <div key={pending.id} className="rounded-md border border-slate-200 p-3">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                  <div>
                    <p className="font-medium text-slate-950">{pending.productName}</p>
                    <p className="text-sm text-muted-foreground">
                      Solicitado: {formatInteger(pending.requestedQuantity ?? pending.quantity)} · Faturado: {formatInteger(pending.billedQuantity ?? 0)} · Falta: {formatInteger(pending.quantity)} {getUnitLabel(pending.unit)}
                    </p>
                  </div>
                  <WinnerPendingActions
                    quotationId={quotation.id}
                    pendingId={pending.id}
                    moduleType={moduleType}
                    disabled={pending.status !== "pendente"}
                  />
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      ) : null}
    </PageStack>
  );
}

function getQuotationItemStatusFromOrders(
  item: QuotationItem,
  orders: Awaited<ReturnType<typeof getPurchaseOrdersByQuotation>>,
): QuotationItem["status"] {
  const orderEntries = orders
    .filter((order) => order.status !== "cancelado" && order.status !== "canceled")
    .flatMap((order) =>
      order.items
        .filter((orderItem) => orderItem.quotationItemId === item.id)
        .map((orderItem) => ({ order, orderItem })),
    );

  if (orderEntries.length === 0) {
    return item.status;
  }

  const entry =
    orderEntries.find(({ order }) =>
      ["finalizado_pelo_vendedor", "parcialmente_faturado", "nao_faturado", "confirmed"].includes(order.status),
    ) ?? orderEntries[0];

  const billedQuantity = getOrderItemBilledQuantity(entry.orderItem);
  const missingQuantity = getOrderItemMissingQuantity(entry.orderItem);

  if (entry.orderItem.fulfillmentStatus === "nao_faturado" || entry.order.status === "nao_faturado") {
    return "nao_faturado" as QuotationItem["status"];
  }

  if (billedQuantity > 0 && missingQuantity <= 0) {
    return "paid" as QuotationItem["status"];
  }

  if (billedQuantity > 0 && missingQuantity > 0) {
    return "falta_parcial" as QuotationItem["status"];
  }

  if (["finalizado_pelo_vendedor", "parcialmente_faturado", "confirmed"].includes(entry.order.status)) {
    return "nao_faturado" as QuotationItem["status"];
  }

  return "gerado" as QuotationItem["status"];
}
async function QuotationEditPage({ quotationId, moduleType, tenantId }: { quotationId: string; moduleType: "pharmacy" | "bidding"; tenantId?: string }) {
  const { quotation, items } = await getQuotationBundle(quotationId, tenantId);
  return (
    <PageStack>
      <HeaderBlock
        title={`Editar ${quotation.name}`}
        description="Rascunhos aceitam edição ampla. Cotações abertas ficam limitadas a prazo e observações para preservar respostas."
      />
      <QuotationPageActions quotationId={quotation.id} moduleType={moduleType} status={quotation.status} currentPage="edit" />
      <QuotationBasicEditor quotation={quotation} moduleType={moduleType} />
      <Card>
        <CardHeader><CardTitle>Itens da cotação</CardTitle></CardHeader>
        <CardContent className="p-0">
          <ItemsTable items={items} />
        </CardContent>
      </Card>
    </PageStack>
  );
}

async function PharmacyResponses({ quotationId, tenantId }: { quotationId: string; tenantId?: string }) {
  const [{ quotation, responseItems, responses }, sessions] = await Promise.all([
    getQuotationBundle(quotationId, tenantId),
    getSupplierSessions(quotationId, tenantId),
  ]);
  const submittedResponseIds = new Set(
    responses
      .filter((response) => response.status === "submitted")
      .map((response) => response.id),
  );
  return (
    <ResponseItemsPage
      title="Respostas dos vendedores"
      items={responseItems.filter((item) => submittedResponseIds.has(item.responseId))}
      mode="pharmacy"
      sessions={sessions}
      deadlineAt={quotation.deadlineAt}
      quotationId={quotationId}
      status={quotation.status}
    />
  );
}

async function BiddingResponses({ quotationId, tenantId }: { quotationId: string; tenantId?: string }) {
  const [analysis, { quotation }, sessions] = await Promise.all([
    getBiddingAnalysis(quotationId),
    getQuotationBundle(quotationId, tenantId),
    getSupplierSessions(quotationId, tenantId),
  ]);
  return (
    <ResponseItemsPage
      title="Respostas dos fornecedores"
      items={analysis.ranking}
      mode="bidding"
      sessions={sessions}
      deadlineAt={quotation.deadlineAt}
      quotationId={quotationId}
      status={quotation.status}
    />
  );
}

async function PharmacyAnalysis({ quotationId, tenantId }: { quotationId: string; tenantId?: string }) {
  const [analysis, { quotation, items }, orders] = await Promise.all([
    getPharmacyAnalysis(quotationId),
    getQuotationBundle(quotationId, tenantId),
    getPurchaseOrdersByQuotation(quotationId, tenantId),
  ]);

  const orderForAward = (award: QuotationAward) =>
    orders.find((order) => (
      (award.supplierId && order.supplierId === award.supplierId) ||
      order.supplierName === award.supplierName
    ));
  const awardByItemId = new Map(
    analysis.awards.map((award) => [award.quotationItemId, award]),
  );

  return (
    <PageStack>
      <HeaderBlock
        title="Análise da cotação farmácia"
        description="Menor preço por produto, diferença entre ofertas e pedido mínimo por distribuidora."
        actionLabel={canGenerateQuotationOrders(quotation.status) ? "Gerar pedido" : undefined}
        actionHref={canGenerateQuotationOrders(quotation.status) ? `/cotacoes/cotacoes-farmacia/${quotationId}/pedidos` : undefined}
      />
      <QuotationPageActions quotationId={quotationId} moduleType="pharmacy" status={quotation.status} currentPage="analysis" />
      <Card>
        <CardHeader><CardTitle>Vencedores e links de pedido</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead className="text-right">Quantidade</TableHead>
                <TableHead>Fornecedor vencedor</TableHead>
                <TableHead className="text-right">Preco informado</TableHead>
                <TableHead className="text-right">Total do item</TableHead>
                <TableHead className="text-right">Acoes</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="h-24 text-center text-muted-foreground">
                    Nenhum item encontrado para esta cotação.
                  </TableCell>
                </TableRow>
              ) : items.map((product) => {
                const award = awardByItemId.get(product.id);
                if (!award) {
                  return (
                    <TableRow key={product.id}>
                      <TableCell className="font-medium">{product.productName}</TableCell>
                      <TableCell className="text-right">{formatInteger(product.requestedQuantity)}</TableCell>
                      <TableCell className="text-muted-foreground">Sem resposta válida</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                      <TableCell className="text-right">-</TableCell>
                    </TableRow>
                  );
                }
                return (
                  <TableRow key={award.id}>
                    <TableCell className="font-medium">{product.productName}</TableCell>
                    <TableCell className="text-right">{formatInteger(award.awardedQuantity)}</TableCell>
                    <TableCell>{award.supplierName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(award.unitPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(award.totalPrice)}</TableCell>
                    <TableCell className="text-right">
                      <WinnerOrderLinks order={orderForAward(award)} />
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <MetricsGrid
        metrics={[
          { label: "Itens", value: String(analysis.totals.totalItems), hint: "Produtos cotados" },
          { label: "Respondidos", value: String(analysis.totals.answeredItems), hint: "Com preço válido", tone: "success" },
          { label: "Total vencedor", value: formatCurrency(analysis.totals.estimatedTotal), hint: "Menor preço", tone: "default" },
          { label: "Economia", value: formatCurrency(analysis.totals.estimatedSavings), hint: "Vs última compra", tone: "success" },
        ]}
      />
      <Card>
        <CardHeader><CardTitle>Ranking por menor preço</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Produto</TableHead>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Distribuidora</TableHead>
                <TableHead className="text-right">Preço unitário</TableHead>
                <TableHead className="text-right">Total item</TableHead>
                <TableHead className="text-right">Segundo preço</TableHead>
                <TableHead className="text-right">Diferença R$</TableHead>
                <TableHead className="text-right">Diferença %</TableHead>
                <TableHead>Ranking</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.ranking.map((item) => {
                const product = items.find((quotationItem) => quotationItem.id === item.quotationItemId);
                const second = analysis.ranking.find(
                  (candidate) =>
                    candidate.quotationItemId === item.quotationItemId &&
                    candidate.rankingPosition === 2,
                );
                const diff = second?.unitPrice && item.unitPrice ? second.unitPrice - item.unitPrice : 0;
                const diffPercent = item.unitPrice ? (diff / item.unitPrice) * 100 : 0;
                return (
                  <TableRow key={item.id}>
                    <TableCell>{product?.productName ?? item.quotationItemId}</TableCell>
                    <TableCell>{supplierName(item.supplierId)}</TableCell>
                    <TableCell>{distributorName(item.distributorId)}</TableCell>
                    <TableCell className="text-right">{formatCurrency(item.unitPrice)}</TableCell>
                    <TableCell className="text-right">{formatCurrency((item.unitPrice ?? 0) * (product?.requestedQuantity ?? 0))}</TableCell>
                    <TableCell className="text-right">{second ? formatCurrency(second.unitPrice) : "-"}</TableCell>
                    <TableCell className="text-right">{second ? formatCurrency(diff) : "-"}</TableCell>
                    <TableCell className="text-right">{second ? `${formatNumber(diffPercent)}%` : "-"}</TableCell>
                    <TableCell>{item.rankingPosition ? `${item.rankingPosition}º` : "-"}</TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Pedido mínimo por distribuidora</CardTitle></CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Distribuidora</TableHead>
                <TableHead>Vendedor</TableHead>
                <TableHead className="text-right">Total ganho</TableHead>
                <TableHead className="text-right">Pedido mínimo</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.distributorMinimums.map((item) => (
                <TableRow key={item.distributorName}>
                  <TableCell className="font-medium">{item.distributorName}</TableCell>
                  <TableCell>{item.sellerName}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.totalWon)}</TableCell>
                  <TableCell className="text-right">{formatCurrency(item.minimumOrder)}</TableCell>
                  <TableCell><StatusBadge status={item.status} label={labelFrom(statusLabels, item.status)} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageStack>
  );
}

async function BiddingAnalysis({ quotationId, tenantId }: { quotationId: string; tenantId?: string }) {
  const [analysis, { quotation }] = await Promise.all([
    getBiddingAnalysis(quotationId),
    getQuotationBundle(quotationId, tenantId),
  ]);

  return (
    <PageStack>
      <HeaderBlock
        title="Análise por unidade convertida"
        description="Preço por cápsula/comprimido calculado automaticamente e sugestão de compra com atendimento parcial."
        actionLabel="Finalizar cotação"
      />
      <QuotationPageActions quotationId={quotationId} moduleType="bidding" status={quotation.status} currentPage="analysis" />
      <MetricsGrid
        metrics={[
          { label: "Total de itens", value: String(analysis.totals.totalItems), hint: "Produtos cotados" },
          { label: "Itens respondidos", value: String(analysis.totals.answeredItems), hint: "Com preço convertido", tone: "success" },
          { label: "Atendidos 100%", value: String(analysis.totals.fullySuppliedItems), hint: "Sem saldo", tone: "success" },
          { label: "Saldo pendente", value: String(analysis.totals.pendingItems), hint: "A recotar", tone: "warning" },
          { label: "Economia estimada", value: "R$ 0,00", hint: "Com histórico futuro", tone: "info" },
          { label: "Total estimado", value: formatCurrency(analysis.totals.estimatedTotal), hint: "Sugestão atual" },
        ]}
      />
      <Card>
        <CardHeader><CardTitle>Ranking por menor preço unitário</CardTitle></CardHeader>
        <CardContent className="p-0">
          <BiddingRankingTable quotationId={quotationId} />
        </CardContent>
      </Card>
      <Card>
        <CardHeader><CardTitle>Sugestão automática de compra</CardTitle></CardHeader>
        <CardContent className="space-y-4 p-0">
          <AwardsTable quotationId={quotationId} />
          <div className="flex flex-wrap gap-2 p-4">
            <Button asChild>
              <Link href={`/cotacoes/licitacoes/${quotationId}/pedidos`}><ReceiptText className="h-4 w-4" />Ver pedidos por fornecedor</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={`/api/cotacoes/export/licitacao/${quotationId}`}><Download className="h-4 w-4" />Exportar Excel</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </PageStack>
  );
}

async function ComparativeMap({ quotationId }: { quotationId: string }) {
  const analysis = await getBiddingAnalysis(quotationId);
  return (
    <PageStack>
      <HeaderBlock
        title="Mapa comparativo"
        description="Fornecedores lado a lado por embalagem, unidade convertida, marca, prazo e status."
        actionLabel="Exportar PDF"
      />
      <BackButton fallbackHref={`/cotacoes/licitacoes/${quotationId}`} />
      <Card>
        <CardContent className="overflow-x-auto p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Preço embalagem</TableHead>
                <TableHead>Qtd/embalagem</TableHead>
                <TableHead>Preço unitário</TableHead>
                <TableHead>Disponível</TableHead>
                <TableHead>Prazo</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {analysis.ranking.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{supplierName(item.supplierId)}</TableCell>
                  <TableCell>{formatCurrency(item.packagePrice)}</TableCell>
                  <TableCell>{formatNumber(item.packageQuantity)}</TableCell>
                  <TableCell>{formatCurrency(item.convertedUnitPrice)}</TableCell>
                  <TableCell>{formatInteger(item.availableQuantity)}</TableCell>
                  <TableCell>{item.deliveryDays} dias</TableCell>
                  <TableCell>{item.offeredLaboratory}</TableCell>
                  <TableCell><StatusBadge status={item.alertStatus ? "pending" : "paid"} label={item.alertStatus ?? "Válida"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageStack>
  );
}

async function PendingBalancePage({ quotationId }: { quotationId: string }) {
  const analysis = await getBiddingAnalysis(quotationId);
  return (
    <PageStack>
      <HeaderBlock
        title="Saldo pendente"
        description="Itens não atendidos totalmente, prontos para nova cotação parcial."
        actionLabel="Gerar nova cotação do saldo"
      />
      <BackButton fallbackHref={`/cotacoes/licitacoes/${quotationId}`} />
      {analysis.pendingBalances.length === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Nenhum saldo pendente"
          description="A sugestão automática fechou 100% da quantidade necessária."
        />
      ) : (
        <Card>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Necessário</TableHead>
                  <TableHead>Atendido</TableHead>
                  <TableHead>Saldo</TableHead>
                  <TableHead>Unidade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {analysis.pendingBalances.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell>{formatInteger(item.requestedQuantity)}</TableCell>
                    <TableCell>{formatInteger(item.suppliedQuantity)}</TableCell>
                    <TableCell>{formatInteger(item.pendingQuantity)}</TableCell>
                    <TableCell>{getUnitLabel(item.unit)}</TableCell>
                    <TableCell><StatusBadge status={item.status} label={labelFrom(statusLabels, item.status)} /></TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </PageStack>
  );
}

async function OrdersPage({ quotationId, tenantId }: { quotationId: string; tenantId?: string }) {
  const { quotation, items, responseItems, responses } = await getQuotationBundle(quotationId, tenantId);
  const canGenerateOrders = canGenerateQuotationOrders(quotation.status);
  const submittedResponseIds = new Set(
    responses
      .filter((response) => response.status === "submitted")
      .map((response) => response.id),
  );
  const validResponseItemIds = new Set(
    responseItems
      .filter((item) =>
        submittedResponseIds.has(item.responseId) &&
        hasValidOrderResponseItem(quotation.moduleType, item),
      )
      .map((item) => item.quotationItemId),
  );
  const hasValidResponses = validResponseItemIds.size > 0;
  let pendencies: Awaited<ReturnType<typeof getWinnerOrderPendingItems>> = [];
  try {
    pendencies = await getWinnerOrderPendingItems(quotationId);
  } catch {
    pendencies = [];
  }
  let orders: Awaited<ReturnType<typeof getPurchaseOrdersByQuotation>> = [];
  let ordersError: string | null = null;
  try {
    orders = await getPurchaseOrdersByQuotation(quotationId, tenantId);
  } catch (error) {
    console.error("Erro ao buscar pedidos dos vencedores", { quotationId, error });
    ordersError = "Não foi possível carregar os pedidos dos vencedores. Tente novamente ou verifique o log do servidor.";
  }
  const emptyTitle = quotation.moduleType === "pharmacy"
    ? !canGenerateOrders
      ? "Finalize a cotação para gerar pedidos dos vencedores."
      : !hasValidResponses
        ? "Não existem respostas válidas para gerar pedidos."
        : "Nenhum pedido gerado ainda"
    : "Nenhum pedido gerado ainda";
  const emptyDescription = quotation.moduleType === "pharmacy"
    ? emptyTitle
    : canGenerateOrders
      ? "Clique em Gerar pedido para criar os pedidos dos vendedores vencedores."
      : "Finalize a cotação para gerar os vencedores.";
  const orderItemIds = new Set(orders.flatMap((order) => order.items.map((item) => item.quotationItemId)));
  const noValidResponseItems = items.filter((item) => !validResponseItemIds.has(item.id));
  const totalOrderItems = orders.reduce((total, order) => total + order.items.length, 0);
  const totalItemsWithOrder = orderItemIds.size;
  const billedItemsDenominator = quotation.moduleType === "pharmacy" ? totalItemsWithOrder : totalOrderItems;
  const allOrderItems = orders.flatMap((order) => order.items);
  const billedItems = allOrderItems.filter((item) => getOrderItemMissingQuantity(item) <= 0 && getOrderItemBilledQuantity(item) > 0).length;
  const partialItems = allOrderItems.filter((item) => getOrderItemBilledQuantity(item) > 0 && getOrderItemMissingQuantity(item) > 0).length;
  const notBilledItems = quotation.moduleType === "pharmacy"
    ? Math.max(items.length - totalItemsWithOrder, 0)
    : allOrderItems.filter((item) => getOrderItemBilledQuantity(item) <= 0 && getOrderItemMissingQuantity(item) > 0).length;
  const expectedAmount = orders.reduce((total, order) => total + order.totalAmount, 0);
  const confirmedAmount = allOrderItems.reduce((total, item) => total + getOrderItemBilledQuantity(item) * item.unitPrice, 0);
  return (
    <PageStack>
      <HeaderBlock
        title="Pedidos vencedores"
        description="Pedidos agrupados apenas por vendedores que ganharam itens. Cada produto fica em um único pedido ativo."
      />
      <QuotationPageActions quotationId={quotationId} moduleType={quotation.moduleType} status={quotation.status} currentPage="orders" />
      <div className="flex flex-wrap justify-end gap-2">
        {orders.length > 0 ? (
          <Button asChild variant="outline">
            <Link href={`/api/cotacoes/export/pedidos/${quotationId}`}>
              <Download className="h-4 w-4" />
              Exportar todos
            </Link>
          </Button>
        ) : null}
        <GeneratePurchaseOrdersButton quotationId={quotationId} disabled={!canGenerateOrders || !hasValidResponses} />
      </div>
      <MetricsGrid
        metrics={[
          { label: "Pedidos gerados", value: String(orders.length), hint: "Somente vendedores vencedores" },
          { label: "Pedidos finalizados", value: String(orders.filter((order) => ["finalizado_pelo_vendedor", "parcialmente_faturado", "nao_faturado", "confirmed"].includes(order.status)).length), hint: "Conferidos pelo vendedor", tone: "success" },
          { label: "Itens faturados", value: `${billedItems}/${billedItemsDenominator}`, hint: quotation.moduleType === "pharmacy" ? "Confirmados / com pedido" : "Confirmados" },
          { label: "Itens parciais", value: String(partialItems), hint: "Com falta parcial", tone: partialItems > 0 ? "warning" : "default" },
          { label: "Itens não faturados", value: String(notBilledItems), hint: quotation.moduleType === "pharmacy" ? "Sem resposta válida" : "Com pendência", tone: notBilledItems > 0 ? "warning" : "default" },
          { label: "Valor previsto", value: formatCurrency(expectedAmount), hint: "Pedido vencedor" },
          { label: "Valor confirmado", value: formatCurrency(confirmedAmount), hint: "Faturado" },
        ]}
      />
      {ordersError ? (
        <Card className="border-amber-200 bg-amber-50">
          <CardContent className="p-4 text-sm text-amber-900">
            {ordersError}
          </CardContent>
        </Card>
      ) : null}
      {orders.length === 0 && !ordersError ? (
        <EmptyState
          icon={ReceiptText}
          title={emptyTitle}
          description={emptyDescription}
        />
      ) : orders.length > 0 ? (
        <Card>
          <CardHeader><CardTitle>Links dos vendedores vencedores</CardTitle></CardHeader>
          <CardContent className="grid gap-3 md:grid-cols-2">
            {orders.map((order) => {
              const supplierDisplay = getPurchaseOrderSupplierDisplay(order);
              return (
                <div key={order.id} className="rounded-md border border-slate-200 bg-white p-3">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="font-semibold text-slate-950">{supplierDisplay}</p>
                      <p className="mt-1 text-sm text-muted-foreground">{order.supplierWhatsapp ?? "WhatsApp não informado"}</p>
                      <p className="mt-1 text-sm text-muted-foreground">
                        {order.items.length} itens ganhos · {formatCurrency(order.totalAmount)}
                      </p>
                    </div>
                    <WinnerOrderLinks order={order} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : null}
      <div className="grid gap-4 lg:grid-cols-2">
        {orders.map((order) => {
          const supplierCompany = getPurchaseOrderSupplierCompany(order);
          const supplierContact = getPurchaseOrderSupplierContact(order);
          return (
          <Card key={order.id}>
            <CardHeader>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <CardTitle>{supplierContact ? `${supplierCompany} - ${supplierContact}` : supplierCompany}</CardTitle>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Total {formatCurrency(order.totalAmount)}
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {order.supplierWhatsapp ?? "WhatsApp não informado"}
                  </p>
                </div>
                <StatusBadge status={order.status} />
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-3 rounded-md bg-slate-50 p-3 text-sm sm:grid-cols-3">
                <SummaryCell label="Itens ganhos" value={String(order.items.length)} />
                <SummaryCell label="Faturados" value={String(order.items.filter((item) => getOrderItemMissingQuantity(item) <= 0 && getOrderItemBilledQuantity(item) > 0).length)} />
                <SummaryCell label="Parciais" value={String(order.items.filter((item) => getOrderItemBilledQuantity(item) > 0 && getOrderItemMissingQuantity(item) > 0).length)} />
                <SummaryCell label="Não faturados" value={String(order.items.filter((item) => getOrderItemBilledQuantity(item) <= 0 && getOrderItemMissingQuantity(item) > 0).length)} />
                <SummaryCell label="Valor previsto" value={formatCurrency(order.totalAmount)} />
                <SummaryCell label="Valor confirmado" value={formatCurrency(order.items.reduce((total, item) => total + getOrderItemBilledQuantity(item) * item.unitPrice, 0))} />
              </div>
              {order.items.map((item) => {
                const billedQuantity = getOrderItemBilledQuantity(item);
                const missingQuantity = getOrderItemMissingQuantity(item);
                const itemStatus = getOrderItemDisplayStatus(item);
                return (
                  <div key={item.id} className="rounded-md border border-slate-200 p-3">
                    <p className="text-sm font-medium">{item.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      Solicitado: {formatInteger(item.quantityToBuy)} {getUnitLabel(item.unit)} · Faturado: {formatInteger(billedQuantity)} · Falta: {formatInteger(missingQuantity)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Valor previsto: {formatCurrency(item.totalPrice)} · Valor faturado: {formatCurrency(billedQuantity * item.unitPrice)}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Status: {labelFrom(statusLabels, itemStatus)}
                    </p>
                  </div>
                );
              })}
              <Button asChild variant="outline" className="w-full">
                <Link href={`/${order.moduleType === "bidding" ? "licitacao" : "cotacao"}/pedido/${order.publicToken}`}>
                  Ver link público
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <PublicOrderActions order={order} />
            </CardContent>
          </Card>
          );
        })}
      </div>
      {quotation.moduleType === "pharmacy" && canGenerateOrders && noValidResponseItems.length > 0 ? (
        <Card>
          <CardHeader>
            <CardTitle>Itens sem resposta válida</CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead className="text-right">Quantidade</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {noValidResponseItems.map((item) => (
                  <TableRow key={item.id}>
                    <TableCell className="font-medium">{item.productName}</TableCell>
                    <TableCell className="text-right">{formatInteger(item.requestedQuantity)}</TableCell>
                    <TableCell>Sem resposta válida</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
      {pendencies.length > 0 ? (
        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <CardTitle>Produtos com falta</CardTitle>
              <CreateMissingQuotationButton
                quotationId={quotationId}
                moduleType={quotation.moduleType}
                pendingIds={pendencies.filter((pending) => pending.status === "pendente").map((pending) => pending.id)}
                disabled={!pendencies.some((pending) => pending.status === "pendente")}
              />
            </div>
          </CardHeader>
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Produto</TableHead>
                  <TableHead>Solicitado</TableHead>
                  <TableHead>Faturado</TableHead>
                  <TableHead>Falta</TableHead>
                  <TableHead>Vendedor original</TableHead>
                  <TableHead className="text-right">Preço original</TableHead>
                  <TableHead>Motivo</TableHead>
                  <TableHead>Próximo vendedor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {pendencies.map((pending) => (
                  <TableRow key={pending.id}>
                    <TableCell className="font-medium">{pending.productName}</TableCell>
                    <TableCell>{formatInteger(pending.requestedQuantity ?? pending.quantity)} {getUnitLabel(pending.unit)}</TableCell>
                    <TableCell>{formatInteger(pending.billedQuantity ?? 0)} {getUnitLabel(pending.unit)}</TableCell>
                    <TableCell>{formatInteger(pending.quantity)} {getUnitLabel(pending.unit)}</TableCell>
                    <TableCell>{pending.originalSupplierName}</TableCell>
                    <TableCell className="text-right">{formatCurrency(pending.originalUnitPrice)}</TableCell>
                    <TableCell>{pending.reason ?? "-"}</TableCell>
                    <TableCell>
                      {pending.nextSupplierName
                        ? `${pending.nextSupplierName} · ${formatCurrency(pending.nextUnitPrice ?? 0)}`
                        : "A calcular"}
                    </TableCell>
                    <TableCell><StatusBadge status={pending.status} label={labelFrom(statusLabels, pending.status)} /></TableCell>
                    <TableCell>
                      <WinnerPendingActions
                        quotationId={quotationId}
                        pendingId={pending.id}
                        moduleType={quotation.moduleType}
                        disabled={pending.status !== "pendente"}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      ) : null}
    </PageStack>
  );
}

async function BiddingSummaryCard({ collections }: { collections: Collections }) {
  const quotation = collections.quotations.find((item) => item.moduleType === "bidding");
  if (!quotation) return null;

  const analysis = await getBiddingAnalysis(quotation.id);
  const awards = analysis.awards.filter((award) => award.quotationId === quotation.id);
  if (awards.length === 0) return null;

  const firstAward = awards[0];
  const firstItem = collections.quotationItems.find((item) => item.id === firstAward.quotationItemId);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Compra sugerida</CardTitle>
          <Badge variant="outline">Resumo</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span>{firstItem?.productName ?? firstAward.supplierName}</span>
          <span className="font-medium">
            {formatInteger(firstAward.awardedQuantity)} {getUnitLabel(firstItem?.requestedUnit)}
          </span>
        </div>
        <Progress value={100} />
        <AwardsCompact awards={awards} />
      </CardContent>
    </Card>
  );
}

function SummaryCell({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 truncate font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function getOrderItemBilledQuantity(item: PurchaseOrderItem) {
  if (item.fulfillmentStatus === "faturado") return item.quantityToBuy;
  if (item.fulfillmentStatus === "nao_faturado" || item.fulfillmentStatus === "pendente") return 0;
  const numeric = Number(item.billedQuantity ?? 0);
  if (!Number.isFinite(numeric)) return 0;
  return Math.min(Math.max(numeric, 0), item.quantityToBuy);
}

function getOrderItemMissingQuantity(item: PurchaseOrderItem) {
  const storedMissing = Number(item.missingQuantity);
  if (Number.isFinite(storedMissing)) return Math.max(0, storedMissing);
  return Math.max(0, item.quantityToBuy - getOrderItemBilledQuantity(item));
}

function getOrderItemDisplayStatus(item: PurchaseOrderItem) {
  const billedQuantity = getOrderItemBilledQuantity(item);
  const missingQuantity = getOrderItemMissingQuantity(item);
  if (billedQuantity > 0 && missingQuantity > 0) return "falta_parcial";
  return item.fulfillmentStatus ?? "pendente";
}

function hasValidOrderResponseItem(moduleType: string, item: SupplierQuoteResponseItem) {
  if (moduleType === "pharmacy") {
    return (item.unitPrice ?? item.netPrice ?? item.convertedUnitPrice ?? 0) > 0;
  }

  return (item.convertedUnitPrice ?? item.unitPrice ?? item.packagePrice ?? 0) > 0;
}

async function PharmacySummaryCard({ collections }: { collections: Collections }) {
  const quotation = collections.quotations.find((item) => item.moduleType === "pharmacy");
  if (!quotation) return null;

  const analysis = await getPharmacyAnalysis(quotation.id);
  const quotationItems = collections.quotationItems.filter((item) => item.quotationId === quotation.id);
  const hasPriceHistory = quotationItems.some((item) => (item.lastPurchasePrice ?? 0) > 0);

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <CardTitle>Resumo de farmácia</CardTitle>
          <Badge variant="outline">Resumo</Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between text-sm">
          <span>Total vencedor</span>
          <span className="font-medium">{formatCurrency(analysis.totals.estimatedTotal)}</span>
        </div>
        {hasPriceHistory ? (
          <div className="flex items-center justify-between text-sm">
            <span>Economia estimada</span>
            <span className="font-medium text-emerald-700">{formatCurrency(analysis.totals.estimatedSavings)}</span>
          </div>
        ) : null}
        <Button asChild variant="outline" className="w-full">
          <Link href="/cotacoes/cotacoes-farmacia">Abrir cotações</Link>
        </Button>
      </CardContent>
    </Card>
  );
}

async function BiddingRankingTable({ quotationId }: { quotationId: string }) {
  const [analysis, { items }] = await Promise.all([
    getBiddingAnalysis(quotationId),
    getQuotationBundle(quotationId),
  ]);
  const firstItem = items[0];
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Qtd necessária</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Fornecedor</TableHead>
          <TableHead>Marca</TableHead>
          <TableHead>Produto ofertado</TableHead>
          <TableHead>Preço embalagem</TableHead>
          <TableHead>Qtd embalagem</TableHead>
          <TableHead>Preço unitário</TableHead>
          <TableHead>Disponível</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {analysis.ranking.map((item) => (
          <TableRow key={item.id}>
            <TableCell className="font-medium">{firstItem?.productName}</TableCell>
            <TableCell>{formatInteger(firstItem?.requestedQuantity)}</TableCell>
            <TableCell>{getUnitLabel(firstItem?.requestedUnit)}</TableCell>
            <TableCell>{supplierName(item.supplierId)}</TableCell>
            <TableCell>{item.offeredLaboratory}</TableCell>
            <TableCell>{item.offeredProductName}</TableCell>
            <TableCell>{formatCurrency(item.packagePrice)}</TableCell>
            <TableCell>{formatNumber(item.packageQuantity)}</TableCell>
            <TableCell>{formatCurrency(item.convertedUnitPrice)}</TableCell>
            <TableCell>{item.hasFullQuantity ? "Total" : formatInteger(item.availableQuantity)}</TableCell>
            <TableCell><StatusBadge status={item.alertStatus ? "pending" : "paid"} label={item.alertStatus ?? "Válida"} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

async function AwardsTable({ quotationId }: { quotationId: string }) {
  const [analysis, { items, responseItems }] = await Promise.all([
    getBiddingAnalysis(quotationId),
    getQuotationBundle(quotationId),
  ]);
  const firstItem = items[0];
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Produto</TableHead>
          <TableHead>Ordem</TableHead>
          <TableHead>Fornecedor</TableHead>
          <TableHead>Marca</TableHead>
          <TableHead>Preço unitário</TableHead>
          <TableHead>Qtd disponível</TableHead>
          <TableHead>Qtd recomendada</TableHead>
          <TableHead>Embalagens</TableHead>
          <TableHead>Preço embalagem</TableHead>
          <TableHead>Valor total</TableHead>
          <TableHead>Saldo após compra</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {analysis.awards.map((award) => {
          const responseItem = responseItems.find(
            (item) => item.id === award.supplierResponseItemId,
          );
          return (
            <TableRow key={award.id}>
              <TableCell className="font-medium">{firstItem?.productName}</TableCell>
              <TableCell>{award.rankingPosition}º</TableCell>
              <TableCell>{award.supplierName}</TableCell>
              <TableCell>{responseItem?.offeredLaboratory ?? "-"}</TableCell>
              <TableCell>{formatCurrency(award.unitPrice)}</TableCell>
              <TableCell>{responseItem?.hasFullQuantity ? "Total" : formatInteger(responseItem?.availableQuantity)}</TableCell>
              <TableCell>{formatInteger(award.awardedQuantity)}</TableCell>
              <TableCell>{formatInteger(award.awardedPackages)}</TableCell>
              <TableCell>{formatCurrency(award.packagePrice)}</TableCell>
              <TableCell>{formatCurrency(award.totalPrice)}</TableCell>
              <TableCell>{formatInteger(award.remainingBalanceAfter)}</TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function ResponseItemsPage({
  title,
  items,
  mode,
  sessions,
  deadlineAt,
  quotationId,
  status,
}: {
  title: string;
  items: Array<{
    id: string;
    offeredProductName?: string;
    offeredLaboratory?: string;
    packagePrice?: number;
    packageQuantity?: number;
    convertedUnitPrice?: number;
    unitPrice?: number;
    hasStock?: boolean;
    availableQuantity?: number;
    supplierId?: string;
    alertStatus?: string;
  }>;
  mode: "pharmacy" | "bidding";
  sessions: SupplierQuoteSession[];
  deadlineAt: string;
  quotationId: string;
  status: QuotationStatus;
}) {
  return (
    <PageStack>
      <HeaderBlock
        title={title}
        description="Cada fornecedor vê apenas a própria resposta no link público; o painel interno consolida tudo."
      />
      <QuotationPageActions quotationId={quotationId} moduleType={mode} status={status} currentPage="responses" />
      <Card>
        <CardHeader><CardTitle>Fornecedores convidados</CardTitle></CardHeader>
        <CardContent className="p-0">
          <SupplierLinksTable moduleType={mode} sessions={sessions} deadlineAt={deadlineAt} />
        </CardContent>
      </Card>
      <Card>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fornecedor</TableHead>
                <TableHead>Produto ofertado</TableHead>
                <TableHead>Marca</TableHead>
                <TableHead>Qtd embalagem</TableHead>
                <TableHead className="text-right">{mode === "bidding" ? "Preço embalagem" : "Preço unitário"}</TableHead>
                {mode === "bidding" ? <TableHead className="text-right">Preço convertido</TableHead> : null}
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {items.map((item) => (
                <TableRow key={item.id}>
                  <TableCell className="font-medium">{supplierName(item.supplierId)}</TableCell>
                  <TableCell>{item.offeredProductName ?? "-"}</TableCell>
                  <TableCell>{item.offeredLaboratory ?? "-"}</TableCell>
                  <TableCell>{item.packageQuantity ?? "-"}</TableCell>
                  <TableCell className="text-right">{formatCurrency(mode === "bidding" ? item.packagePrice : item.unitPrice)}</TableCell>
                  {mode === "bidding" ? (
                    <TableCell className="text-right">{formatCurrency(item.convertedUnitPrice ?? item.unitPrice)}</TableCell>
                  ) : null}
                  <TableCell><StatusBadge status={item.alertStatus ? "pending" : "submitted"} label={item.alertStatus ?? "Recebida"} /></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </PageStack>
  );
}

function ItemsTable({
  items,
}: {
  items: QuotationItem[];
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>#</TableHead>
          <TableHead>Produto</TableHead>
          <TableHead>Quantidade</TableHead>
          <TableHead>Unidade</TableHead>
          <TableHead>Laboratório</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>{item.itemNumber}</TableCell>
            <TableCell className="font-medium">{item.productName}</TableCell>
            <TableCell>{formatInteger(item.requestedQuantity)}</TableCell>
            <TableCell>{getUnitLabel(item.requestedUnit)}</TableCell>
            <TableCell>{item.requestedLaboratory ?? "-"}</TableCell>
            <TableCell>{productTypeLabels[item.productType]}</TableCell>
            <TableCell><StatusBadge status={item.status} label={labelFrom(statusLabels, item.status)} /></TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function AwardsCompact({
  awards,
}: {
  awards: QuotationAward[];
}) {
  return (
    <div className="space-y-2">
      {awards.map((award) => (
        <div key={award.id} className="flex items-center justify-between rounded-md border border-slate-200 p-3 text-sm">
          <span>{award.supplierName}</span>
          <span className="font-medium">
            {formatInteger(award.awardedQuantity)} · {formatCurrency(award.totalPrice)}
          </span>
        </div>
      ))}
    </div>
  );
}

function CrudPage({
  title,
  description,
  actionLabel,
  form,
  children,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  form?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <PageStack>
      <HeaderBlock title={title} description={description} actionLabel={actionLabel} />
      {form ? (
        <Card>
          <CardHeader><CardTitle>Cadastro rápido</CardTitle></CardHeader>
          <CardContent>{form}</CardContent>
        </Card>
      ) : null}
      <Card>
        <CardContent className="p-0">{children}</CardContent>
      </Card>
    </PageStack>
  );
}

function HeaderBlock({
  title,
  description,
  actionLabel,
  actionHref,
}: {
  title: string;
  description: string;
  actionLabel?: string;
  actionHref?: string;
}) {
  const button = actionLabel && actionHref ? (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <Button asChild>
        <Link href={actionHref}>
          <Plus className="h-4 w-4" />
          {actionLabel}
        </Link>
      </Button>
    </div>
  ) : null;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
      <div className="max-w-3xl">
        <h2 className="text-2xl font-semibold tracking-normal text-slate-950">{title}</h2>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
      </div>
      {button}
    </div>
  );
}

function MetricsGrid({
  metrics,
}: {
  metrics: Array<{ label: string; value: string; hint: string; tone?: "default" | "success" | "warning" | "danger" | "info" }>;
}) {
  const icons = [Building2, CheckCircle2, AlertTriangle, ReceiptText];
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {metrics.map((metric, index) => (
        <KpiCard key={metric.label} {...metric} icon={icons[index % icons.length]} />
      ))}
    </div>
  );
}

function EmptyState({
  icon: Icon,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string }>;
  title: string;
  description: string;
}) {
  return (
    <div className="flex min-h-80 flex-col items-center justify-center rounded-md border border-dashed border-slate-300 bg-white p-8 text-center">
      <Icon className="h-10 w-10 text-emerald-600" />
      <h3 className="mt-4 text-lg font-semibold text-slate-950">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-muted-foreground">{description}</p>
    </div>
  );
}

function PageStack({ children }: { children: React.ReactNode }) {
  return <div className="space-y-6">{children}</div>;
}

function TwoColumn({ children }: { children: React.ReactNode }) {
  return <div className="grid gap-4 xl:grid-cols-2">{children}</div>;
}

function LabeledInput({
  label,
  defaultValue,
  name,
  type = "text",
  required,
  placeholder,
}: {
  label: string;
  defaultValue?: string;
  name?: string;
  type?: string;
  required?: boolean;
  placeholder?: string;
}) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Input
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        placeholder={placeholder}
      />
    </div>
  );
}

function AdminUsersTable({
  users,
  tenants,
}: {
  users: ManagedUser[];
  tenants: TenantOption[];
}) {
  if (users.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={Users}
          title="Nenhum usuário cadastrado"
          description="Crie o primeiro acesso para liberar o painel por perfil."
        />
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Nome</TableHead>
          <TableHead>E-mail</TableHead>
          <TableHead>Perfil</TableHead>
          <TableHead>Empresa</TableHead>
          <TableHead>Status</TableHead>
          <TableHead className="text-right">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {users.map((user) => {
          const primaryTenant = user.tenantLinks[0];

          return (
            <TableRow key={user.id}>
              <TableCell className="font-medium">{user.fullName}</TableCell>
              <TableCell>{user.email}</TableCell>
              <TableCell>{labelFrom(userRoleLabels, user.role)}</TableCell>
              <TableCell>
                {primaryTenant
                  ? `${primaryTenant.tenantName} · ${labelFrom(customerTypeLabels, primaryTenant.tenantType)}`
                  : "-"}
              </TableCell>
              <TableCell>
                <StatusBadge status={user.status} label={labelFrom(statusLabels, user.status)} />
              </TableCell>
              <TableCell>
                <form action={updateUserAccessAction} className="flex justify-end gap-2">
                  <input type="hidden" name="profileId" value={user.id} />
                  <Select name="role" defaultValue={user.role}>
                    <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="SUPER_ADMIN">{userRoleLabels.SUPER_ADMIN}</SelectItem>
                      <SelectItem value="ADMIN_EMPRESA">{userRoleLabels.ADMIN_EMPRESA}</SelectItem>
                      <SelectItem value="COMPRADOR">{userRoleLabels.COMPRADOR}</SelectItem>
                      <SelectItem value="CONFERENTE">{userRoleLabels.CONFERENTE}</SelectItem>
                      <SelectItem value="FINANCEIRO">{userRoleLabels.FINANCEIRO}</SelectItem>
                    </SelectContent>
                  </Select>
                  <Select name="tenantId" defaultValue={primaryTenant?.tenantId ?? "none"}>
                    <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">Sem vínculo</SelectItem>
                      {tenants.map((tenant) => (
                        <SelectItem key={tenant.id} value={tenant.id}>
                          {tenant.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <Select name="status" defaultValue={user.status}>
                    <SelectTrigger className="w-28"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ativo">Ativo</SelectItem>
                      <SelectItem value="convidado">Convidado</SelectItem>
                      <SelectItem value="inativo">Inativo</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button type="submit" size="sm" variant="outline">
                    Salvar
                  </Button>
                </form>
              </TableCell>
            </TableRow>
          );
        })}
      </TableBody>
    </Table>
  );
}

function UserInviteForm({ tenants = [] }: { tenants?: TenantOption[] }) {
  return (
    <form action={createUserAccessAction} className="grid gap-4 md:grid-cols-6">
      <LabeledInput label="Nome" name="fullName" required />
      <LabeledInput label="E-mail" name="email" type="email" required />
      <div className="space-y-2">
        <Label>Perfil</Label>
        <Select name="role" defaultValue="COMPRADOR">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="SUPER_ADMIN">{userRoleLabels.SUPER_ADMIN}</SelectItem>
            <SelectItem value="ADMIN_EMPRESA">{userRoleLabels.ADMIN_EMPRESA}</SelectItem>
            <SelectItem value="COMPRADOR">{userRoleLabels.COMPRADOR}</SelectItem>
            <SelectItem value="CONFERENTE">{userRoleLabels.CONFERENTE}</SelectItem>
            <SelectItem value="FINANCEIRO">{userRoleLabels.FINANCEIRO}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Empresa</Label>
        <Select name="tenantId" defaultValue={tenants[0]?.id ?? "none"}>
          <SelectTrigger><SelectValue placeholder="Sem vínculo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="none">Sem vínculo</SelectItem>
            {tenants.map((tenant) => (
              <SelectItem key={tenant.id} value={tenant.id}>
                {tenant.name} · {labelFrom(customerTypeLabels, tenant.type)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label>Status</Label>
        <Select name="status" defaultValue="ativo">
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="ativo">Ativo</SelectItem>
            <SelectItem value="convidado">Convidado</SelectItem>
            <SelectItem value="inativo">Inativo</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <LabeledInput
        label="Senha temporária"
        name="temporaryPassword"
        defaultValue="Alterar@123"
        required
      />
      <input type="hidden" name="mustChangePassword" value="true" />
      <div className="flex items-end">
        <Button className="w-full" type="submit">
          Criar acesso
        </Button>
      </div>
    </form>
  );
}

export function getCompanyRouteTitle(slug: string[]) {
  const [section = "dashboard", id, subpage] = slug;
  if (section === "cotacoes-farmacia") {
    if (!id) return "Cotação Farmácia";
    if (id === "nova") return "Nova cotação";
    return subpage ? subpageTitle(subpage) : "Detalhes da cotação";
  }
  if (section === "licitacoes") {
    if (!id) return "Cotação Licitação";
    if (id === "nova") return "Nova licitação";
    return subpage ? subpageTitle(subpage) : "Detalhes da licitação";
  }
  const titles: Record<string, string> = {
    dashboard: "Dashboard",
    produtos: "Produtos",
    fornecedores: "Fornecedores",
    distribuidoras: "Distribuidoras",
    laboratorios: "Laboratórios",
    importar: "Importação",
    "historico-precos": "Histórico de preços",
    "historico-compras": "Histórico de compras",
    "mapa-comparativo": "Mapa comparativo",
    "analise-unidade": "Análise por unidade",
    "pedidos-gerados": "Pedidos gerados",
    "pedidos-gerados-farmacia": "Pedidos gerados Farmácia",
    "pedidos-gerados-licitacao": "Pedidos gerados Licitação",
    "cotacoes-disponiveis": "Cotações disponíveis",
    "cotacoes-respondidas": "Cotações respondidas",
    perfil: "Perfil",
    relatorios: "Relatórios",
    configuracoes: id === "supabase" ? "Configuração do Supabase" : "Configurações",
    usuarios: "Usuários",
  };
  return titles[section] ?? "MBA Cotações";
}

function supplierName(supplierId?: string) {
  return supplierId ?? "Fornecedor";
}

function distributorName(distributorId?: string) {
  return distributorId ?? "-";
}

function subpageTitle(value: string) {
  const titles: Record<string, string> = {
    respostas: "Respostas",
    analise: "Análise",
    pedidos: "Pedidos",
    "mapa-comparativo": "Mapa comparativo",
    "saldo-pendente": "Saldo pendente",
  };
  return titles[value] ?? value.replaceAll("-", " ");
}

export function getAdminRouteTitle(section?: string) {
  const titles: Record<string, string> = {
    empresas: "Empresas",
    planos: "Planos",
    mensalidades: "Mensalidades",
    pagamentos: "Pagamentos",
    usuarios: "Usuários",
    farmacias: "Farmácias",
    licitacoes: "Licitações",
    distribuidoras: "Distribuidoras",
    vendedores: "Vendedores",
    logs: "Logs",
    suporte: "Suporte",
    configuracoes: "Configurações",
  };
  return section ? titles[section] ?? "Admin" : "Dashboard administrativo";
}
