"use client";
import { AgroDocDroneIcon as Drone } from "../AgroDocDroneIcon";
import Link from "next/link";
import { Users, Map, Handshake, UserRound, Zap } from "lucide-react";
import {
  AgroDocHero,
  AgroDocCard,
  AgroDocKpiCard,
  AgroDocTable,
  AgroDocEmpty,
  AgroDocStatus,
  AgroDocError,
  useAgroData,
  ROOT,
} from "../AgroDocUi";
type Entity = {
  entityId: string;
  data: {
    nome?: string;
    modelo?: string;
    registroAnac?: string;
    municipio?: string;
    uf?: string;
    culturaPadrao?: string;
  };
};
type Entities = { items: Entity[]; canManage?: boolean };
type Pilots = {
  items: { id: string; nome: string; ativo: boolean; funcao?: string }[];
};
export function AgroDocRegistry() {
  const drones = useAgroData<Entities>("/api/dronegestor/equipamentos"),
    pilots = useAgroData<Pilots>("/api/dronegestor/pilotos"),
    farms = useAgroData<Entities>("/api/dronegestor/cadastros?type=fazenda"),
    clients = useAgroData<Entities>("/api/dronegestor/cadastros?type=cliente");
  return (
    <>
      <AgroDocHero
        variant="registry"
        title="Cadastros"
        description="Bases reutilizáveis da operação: drones, equipe, propriedades e clientes."
      />
      <div className="agro-kpis">
        {[
          {
            title: "Drones cadastrados",
            data: drones,
            icon: Drone,
            href: "equipamentos",
          },
          {
            title: "Pilotos e equipe",
            data: pilots,
            icon: Users,
            href: "pilotos",
          },
          { title: "Propriedades", data: farms, icon: Map, href: "gestao" },
          { title: "Clientes", data: clients, icon: Handshake, href: "gestao" },
        ].map((x) => (
          <AgroDocKpiCard
            key={x.title}
            title={x.title}
            icon={x.icon}
            value={x.data.data ? x.data.data.items.length : "—"}
            href={`${ROOT}/${x.href}`}
          />
        ))}
      </div>
      <AgroDocError
        error={[drones.error, pilots.error, farms.error, clients.error]
          .filter(Boolean)
          .join(" · ")}
      />
      <div className="agro-tabs">
        <a href="#agro-drones">Drones e equipamentos</a>
        <a href="#agro-team">Equipe operacional</a>
        <a href="#agro-properties">Propriedades e clientes</a>
      </div>
      <div className="agro-register-sections">
        <div id="agro-drones">
          <AgroDocCard
            title="Drones e equipamentos"
            icon={Drone}
            action={
              <Link href={`${ROOT}/equipamentos`}>Ver todos os drones →</Link>
            }
          >
            <AgroDocTable
              head={[
                "Equipamento",
                "Prefixo ANAC",
                "Homologação ANATEL",
                "Status documental",
                "Vencimento",
              ]}
            >
              {drones.data?.items.slice(0, 3).map((x) => (
                <tr key={x.entityId}>
                  <td>
                    <Link href={`${ROOT}/equipamentos`}>
                      {x.data.nome || x.data.modelo}
                    </Link>
                  </td>
                  <td>{x.data.registroAnac || "—"}</td>
                  <td>Não disponível no cadastro</td>
                  <td>
                    <AgroDocStatus>Conferir documentos</AgroDocStatus>
                  </td>
                  <td>—</td>
                </tr>
              ))}
            </AgroDocTable>
            {!drones.data?.items.length && (
              <AgroDocEmpty>
                {drones.data
                  ? "Nenhum drone cadastrado."
                  : "Consultando equipamentos..."}
              </AgroDocEmpty>
            )}
          </AgroDocCard>
        </div>
        <div id="agro-team">
          <AgroDocCard
            title="Equipe operacional"
            icon={Users}
            action={<Link href={`${ROOT}/pilotos`}>Ver toda a equipe →</Link>}
          >
            <div className="agro-team">
              {pilots.data?.items.slice(0, 4).map((x) => (
                <article key={x.id}>
                  <UserRound />
                  <div>
                    <Link href={`${ROOT}/pilotos`}>
                      <b>{x.nome}</b>
                    </Link>
                    <small>{x.funcao || "Piloto"}</small>
                    <AgroDocStatus tone={x.ativo ? "good" : "neutral"}>
                      {x.ativo ? "Ativo" : "Inativo"}
                    </AgroDocStatus>
                  </div>
                </article>
              ))}
            </div>
            {!pilots.data?.items.length && (
              <AgroDocEmpty>
                Nenhum piloto disponível para esta conta.
              </AgroDocEmpty>
            )}
          </AgroDocCard>
        </div>
        <div className="agro-two-col" id="agro-properties">
          <AgroDocCard
            title="Propriedades e clientes"
            icon={Map}
            action={
              <Link href={`${ROOT}/gestao`}>
                Gerenciar propriedades e clientes →
              </Link>
            }
          >
            <AgroDocTable
              head={[
                "Propriedade",
                "Município",
                "UF",
                "Cultura principal",
                "Ação",
              ]}
            >
              {farms.data?.items.slice(0, 3).map((x) => (
                <tr key={x.entityId}>
                  <td>{x.data.nome}</td>
                  <td>{x.data.municipio || "—"}</td>
                  <td>{x.data.uf || "—"}</td>
                  <td>{x.data.culturaPadrao || "Não registrada"}</td>
                  <td>
                    <Link href={`${ROOT}/gestao`}>Abrir cadastro</Link>
                  </td>
                </tr>
              ))}
            </AgroDocTable>
            {!farms.data?.items.length && (
              <AgroDocEmpty>Nenhuma propriedade disponível.</AgroDocEmpty>
            )}
          </AgroDocCard>
          <AgroDocCard title="Ações rápidas" icon={Zap}>
            <div className="agro-stack">
              <Link
                className="agro-button agro-button-primary"
                href={`${ROOT}/equipamentos`}
              >
                Novo drone →
              </Link>
              <Link className="agro-soft-link" href={`${ROOT}/pilotos`}>
                Novo colaborador →
              </Link>
              <Link className="agro-soft-link" href={`${ROOT}/gestao`}>
                Nova propriedade / cliente →
              </Link>
              <Link className="agro-button" href={`${ROOT}/perfil-operacional`}>
                Responsável técnico e empresa →
              </Link>
            </div>
          </AgroDocCard>
        </div>
      </div>
    </>
  );
}
