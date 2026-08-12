# MBA Cotações — legado temporário

> **Status:** LEGACY / somente compatibilidade e comparação durante a Fase 1 de unificação.
>
> **Não implementar novas funcionalidades neste workspace.** A versão canônica do MBA Cotações está integrada ao MBA Labs Core.

## Fonte canônica

A implementação oficial usada pela plataforma e pelo fluxo de acesso do MBA Labs é:

```text
apps/mba-labs-core/src/modules/cotacoes
```

Rotas da aplicação:

```text
apps/mba-labs-core/src/app/cotacoes
```

APIs específicas do módulo:

```text
apps/mba-labs-core/src/app/api/cotacoes
```

Entrada pelo portal:

```text
/apps/mbacotacoes -> /cotacoes
```

A entrada passa pelo controle central de autenticação, empresa, assinatura e permissão do MBA Labs.

## Por que este workspace ainda existe?

`apps/mba-cotacoes` foi a implementação separada original e ainda é mantido temporariamente como referência durante a consolidação. Ele não deve ser tratado como a fonte oficial de novas alterações.

Antes de removê-lo, a Fase 1 exige:

1. comparar componentes, serviços e APIs com a versão do Core;
2. identificar qualquer comportamento útil que exista apenas aqui;
3. migrar somente o que realmente estiver faltando no Core;
4. validar o fluxo completo em Preview e produção;
5. preservar documentação ou testes úteis;
6. só então remover este workspace e regenerar o lockfile.

## Diferenças já confirmadas

A versão do Core contém recursos que não existem neste workspace, incluindo controle de acesso específico à cotação, camada de segurança para upload e integração mais nova do WhatsApp/Evolution. Em várias telas e serviços, os arquivos do Core também são versões mais recentes e completas.

O arquivo `src/lib/actions/auth.ts` deste workspace é uma exceção esperada: ele existia para delegar login ao portal central quando o app rodava isoladamente. No Core, essa responsabilidade já pertence ao próprio MBA Labs e não deve ser copiada de volta.

## Uso de emergência

Os comandos legados foram mantidos temporariamente apenas para comparação/rollback técnico:

```bash
npm run dev:cotacoes:legacy
npm run build:cotacoes:legacy
```

Os comandos normais `dev:cotacoes` e `build:cotacoes` passam a apontar para a implementação canônica no Core.

## Banco de dados

O banco continua sendo o Supabase unificado do MBA Labs, com autenticação e autorização ligadas às estruturas `core_*` e às tabelas operacionais do Cotações. A existência deste diretório legado **não significa que existe um segundo banco em produção**.

## Regra para manutenção

Se uma correção for necessária no MBA Cotações, procure primeiro a implementação equivalente em:

```text
apps/mba-labs-core/src/modules/cotacoes
apps/mba-labs-core/src/app/cotacoes
apps/mba-labs-core/src/app/api/cotacoes
```

Não aplicar correções novas somente em `apps/mba-cotacoes`.
