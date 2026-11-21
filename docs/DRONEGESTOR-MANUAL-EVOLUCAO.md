# DroneGestor — manual das alterações desta entrega

## Navegação

O menu usa DroneGestor como nome do produto e agrupa as rotas existentes em Visão geral, Operações, Ferramentas, Gestão, Regularização, Piloto Pro e Configurações. A conferência continua sendo parte documental do produto. Não foram criadas telas vazias para funcionalidades futuras. Itens administrativos são filtrados pelo perfil resolvido no servidor. O botão Recolher menu atende desktop; em celulares permanece o menu lateral existente.

## Calculadoras

Acesse Ferramentas → Misturador, vazão e custos. Calda e produtos mantém a calculadora existente.

- Misturador: informe área, taxa, capacidades úteis e dose prescrita de um produto. A seção QUANTO COLOCAR NO MISTURADOR mostra a quantidade para a mistura, seguida da última mistura e do total. Repita para cada produto. Volume é de calda final.
- Vazão: informe taxa, velocidade e largura total efetiva. A fórmula fica visível.
- Rendimento: informe tempos e eficiência em voo; o resultado inclui tempo em solo. Cargas não equivalem necessariamente a voos. Rendimento real requer registros medidos.
- Custos: informe área, preço, custo variável, custo fixo e investimento. O período do custo fixo deve coincidir com a projeção mensal para estimar recuperação.

Entradas inválidas mostram mensagem; indicadores de retorno que não podem ser calculados não são substituídos por zero. A ferramenta não recomenda dose, mistura ou parâmetro operacional.

## Piloto Pro

A pesquisa existente continua sem distinção de acentos. Abra um capítulo para registrar a última leitura, use Favoritar e Marcar como lido e filtre os favoritos. A impressão usa os capítulos abertos. Preferências ficam apenas neste aparelho, separadas pelo usuário e empresa. Falhas de armazenamento mostram mensagem.

O e-book integral, mídias, procedimentos por modelo e validação técnica permanecem pendentes. Os artigos iniciais não são importação completa do PDF.

## Desenvolvimento e validação

Na raiz, instalar com `npm ci --ignore-scripts`. Na aplicação `apps/mba-labs-core`:

```
npm run test:agrodoc
npm run typecheck
npm run build
npx eslint src/app/apps/dronegestor src/app/api/dronegestor src/lib/dronegestor-*.ts src/lib/agrodoc-cloud.ts
```

Testes existentes de conferência e contas de pilotos foram preservados. Os novos testes cobrem cálculo, regra de sincronização, resolução de papel e autorização real do handler MAPA com dependências simuladas. Quatro testes adicionais executam o sincronizador real em memória, com armazenamento e rede controlados, para verificar edições concorrentes e respostas após troca de conta. Não são testes de integração com Supabase ou entre aparelhos.

O harness em `tests/components` serve exclusivamente componentes isolados, com Link substituído por âncora. Não testa autenticação e não é uma rota da aplicação. Para gerar o bundle:

```
npm exec --yes --package=esbuild -- esbuild tests/components/calculators-entry.tsx --bundle --platform=browser --jsx=automatic --alias:next/link=./tests/components/link-stub.tsx --outfile=/tmp/dronegestor-component.js
node tests/components/run-calculators.mjs
```

O runner tenta testar 360/390/768/1024/1440/1920 pixels. Nesta sessão Chromium falhou ao iniciar com `socket() failed: Operation not permitted`. O navegador remoto não alcançou o servidor local. Portanto nenhum desses testes visuais ou screenshots foi aprovado ou produzido.

E2E autenticado existente exige `AGRODOC_BASE_URL` e `AGRODOC_STORAGE_STATE` de conta autorizada em ambiente isolado. Não colocar o storage state no git.

## Publicação futura

1. Revisar diff e relatório de segurança.
2. Configurar Supabase de homologação e contas dos perfis solicitados; confirmar que o preview não grava no banco de produção.
3. Validar migrations existentes, backup e rollback nesse banco, sem apagar registros.
4. Executar E2E completo, testes offline/concorrência, permissões, documentos, OAuth e exportação MAPA.
5. Concluir os módulos ainda pendentes no acompanhamento. Aprovar os critérios de aceite com evidências.
6. Após autorização expressa do titular, publicar a versão aprovada e monitorar. Não promover automaticamente este preview.

Nenhuma migration nova foi criada ou aplicada nesta entrega. Google Drive permanece código existente, sem nova conexão OAuth configurada. Dropbox, assistente RAG e portal não estão concluídos.
