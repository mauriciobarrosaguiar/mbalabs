# PR #205 — continuação em 22/11/2026

Base remota: d4084ae5ff2128b4ce8e47189da46bdb4ed83407. Trabalho incremental, sem aceite integral.
Login Pulveriza63 e conferência da OS de Pedro preservados como aceites anteriores; nenhum formulário desses testes foi submetido novamente.

## Correções entregues

1. O cliente removia zero identificadores de parcial após sucesso: reutilizava o primeiro na complementação. Agora remove a chave somente depois da confirmação e da persistência local do encerramento. Falha de rede mantém a chave para repetir.
2. O servidor retornava duplicate=true para qualquer conteúdo com o mesmo requestId. Agora só confirma novamente snapshot/motivo/justificativa iguais; alteração retorna 409, sem gravar ou confirmar hectares novos. Comparação conservadora do JSON pode recusar objetos equivalentes com ordem de propriedades diferente; exige conferência, nunca confirma dados diferentes silenciosamente.
3. GET/PUT/POST de estado passam a recusar perfil com status diferente de ativo antes de criar cliente privilegiado.

Não implementado nesta entrega: fila offline de parcial, recuperação específica do checkpoint da OS, unicidade inicial do estado, duração descontando pausas e integração completa das oito fases. Não classificar esses itens como resolvidos.

## Matriz dos sete pedidos

| Prioridade | Interface nesta rodada | Teste automatizado | Pendente / bloqueio |
|---|---|---|---|
| 1. Parcial e complementação | Não homologado | 12/20 ha, saldo 8; complementação 14/20, saldo 6; preservação de cargas; repetição; CAS; nova regressão de mesmo identificador com conteúdo diferente retorna 409 | Complementação até 100%, novo pré-voo e conferência final pela UI pendentes |
| 2. Conexão e troca de aparelho | Não homologado | Duas instâncias simuladas via handler real: B lê 12 ha/revisão 3, grava 14 ha/revisão 4; A antigo recebe 409 sem sobrescrever; testes existentes de resposta tardia e troca de conta passam | Não é teste em dois aparelhos físicos. Parcial ainda exige internet; checkpoint e estado sincronizado são registros diferentes. Perda do aparelho antes do upload pode perder dados locais |
| 3. APIs piloto/gestor/RT | Não homologado com sessões específicas reais | Fixtures separadas de papel: gestor/RT não encerram execução atribuída ao piloto; outro piloto/empresa negados; perfil inativo bloqueado; suítes de planejamento, MAPA e RLS passam | Não foram obtidos JWTs/sessões reais de cada papel. RLS em PostgreSQL descartável não equivale a PostgREST/JWT real; migration permanece não aplicada |
| 4. Oito fases | Não homologado | Regressões existentes passam, sem teste integral das oito fases | Integração persistente completa, documentos/vencimentos, mapa/obstáculos e conferência integral continuam pendentes de implementação e aceite |
| 5. Mobile | Não homologado | Nenhum novo aceite visual | 360, 390, 768, 1024, 1440 e 1920 px pendentes: prévia protegida por login Vercel; ferramenta atual sem API de viewport. Não usar login em produção como evidência da PR |
| 6. MAPA | Não homologado | Handler real com XLSX original; integridade das partes/fórmulas/validações; autorização, competência, perfil, conferência e PDF passam | Excel nativo/recálculo, conferência/exportação pela UI e tratamento final de parcial sem complementação pendentes |
| 7. Evidências e PR | Relatório incremental | 132/132, zero ignorados; TypeScript aprovado | PR permanece rascunho, sem merge |

## Evidências desta execução

- tests/dronegestor-partial-api.test.mjs: novos casos de repetição e gestor/RT.
- tests/dronegestor-state-cas.test.mjs: novos casos de inatividade e duas instâncias simuladas.
- docs/evidence/dronegestor/continuacao-205/testes.txt: execução completa, 132/132.
- docs/evidence/dronegestor/continuacao-205/typecheck.txt: TypeScript aprovado.
- Original XLSX fornecido anteriormente utilizado somente como entrada local; nenhum modelo sintético substituiu o original.
- Navegação à prévia conhecida da PR terminou em “Login – Vercel”. Nenhuma autenticação Vercel foi tentada ou proteção removida. Essa observação é bloqueio de acesso, não falha funcional do DroneGestor.
- Nenhum novo fluxo de negócio foi homologado pela interface nesta execução. O navegador disponível exibe a conta anterior, mas ela não constitui três sessões de piloto/gestor/RT nem acesso à versão da PR.

## Limites respeitados e próximos desbloqueios

Nenhuma migration executada pelo agente, alteração de dados produtivos, publicação produtiva, envio oficial, voo ou contratação. Dados fictícios existem apenas nas fixtures em memória. Não foi preenchido SARPAS, GPS ou inspeção para liberar operação real. A suíte RLS existente executa SQL apenas em banco WASM descartável, nunca no Supabase.

Para os aceites restantes: acesso autenticado à prévia da PR; confirmação do destino de banco e delimitação de registros fictícios antes de qualquer escrita remota; sessões individuais existentes de piloto, gestor e RT, fornecidas por fluxo seguro. Não solicitar senha em texto. Publicação da branch pode disparar automaticamente preview/CI já configurados; nenhum deploy produtivo foi solicitado.

Build Next concluído com sucesso nesta rodada. Lint dos três arquivos de produção alterados: zero erros e um aviso preexistente de navegação. Logs build.txt/lint.txt na pasta de evidências. Primeira tentativa de build falhou por dependências via symlink fora da raiz; repetição com cópia local das mesmas dependências foi aprovada.
