# MBA DroneGestor — correções de navegação (22/11/2026)

## Escopo
Reorganizar os menus, ajustar rotas e botões e corrigir a entrada em ordens de serviço sem mudar dados de produção.

## Problemas concretos corrigidos
1. **OS suspensa:** abrir uma OS não tenta mais executar `PATCH em_execucao` sem evidência de pré-voo. A retomada exige o checkpoint já associado ao aparelho e volta à revisão das conferências. Sem checkpoint validado, não reinicia automaticamente nem apaga hectares e cargas.
2. **OS em execução:** acesso por outro dispositivo sem estado recuperado é bloqueado com explicação, evitando sobreposição de registros locais. Não declarar troca de aparelho homologada.
3. **Painel do gestor:** exibido no topo de Operações; retirado wrapper de listagem que escondia cadastro/atribuição atrás de botão genérico. Botão “Gerenciar esta OS” localiza o cartão correspondente.
4. **Cadastros:** “Clientes” e “Fazendas” levam às abas corretas via query `tab`; a página de Operações respeita `tab` e localiza `osId` solicitado.
5. **Menu lateral:** navegação agrupada por Operações, Cadastros, Documentação, Ferramentas, Piloto Pro, Configurações e Ajuda; itens ocultos conforme permissões.
6. **Menu inferior:** entradas adequadas ao gestor e ao piloto; indicador de tela atual contempla sub-rotas.
7. **Ajuda:** nova tela instrutiva `/apps/dronegestor/ajuda`; ícone de ajuda não é mais atalho enganoso para Legislação.
8. **Modo Campo:** sequência interna reorganizada para acompanhar OS → Planejamento → Documentação (tela externa) → Segurança → Calibração/Checklist → Calda → Liberação/Aplicação → Pós-operação. Links de documentos e pacote conservam `osId`.
9. **Dashboard:** indicador “Em campo” retorna à seleção de OS para não utilizar acidentalmente uma missão diferente armazenada no aparelho.

## Limites e riscos pendentes
- A fase 3 continua sendo uma página externa de Documentos; não existe uma tela interna de `View` própria e sua aprovação não é persistida como marco independente.
- O sistema ainda possui componentes antigos e rótulos históricos, além de APIs de navegação não totalmente unificadas. Não proclamar a reconstrução integral das oito fases.
- A recuperação automática de execução em um segundo aparelho não foi homologada; o novo comportamento preserva a segurança bloqueando retomada sem checkpoint.
- A abertura de uma OS suspensa exige revalidação de pré-voo pelo servidor; não gera nem simula autorização SARPAS ou inspeção.
- RLS de `core_logs` continua pendente no banco produtivo; esta entrega não aplica migrations.
- Testes estáticos de rotas não substituem navegação autenticada no navegador. Executar testes de clique, gestor/RT/piloto, 360/390/768/1024/1440/1920 px, teclado e leitor de tela em homologação posterior.
- Nenhum registro produtivo ou credencial foi alterado por esta PR. Não realizar merge/deploy sem autorização.

## Testes
- `npm --prefix apps/mba-labs-core run test:agrodoc`
- `npm --prefix apps/mba-labs-core run typecheck`
- `npm --prefix apps/mba-labs-core run build`
- CI disponível após abertura da PR.
