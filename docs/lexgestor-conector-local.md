# LexGestor: Conector Local do Advogado

Este documento define a base técnica para um futuro conector local de tribunais.

## Regra principal

O LexGestor nunca deve salvar login, senha, certificado digital, token, cookies ou qualquer credencial de tribunal no Supabase, na Vercel ou em banco da MBA Labs.

O acesso ao tribunal deve permanecer no navegador, aparelho, certificado local ou ambiente controlado pelo advogado.

## Opções futuras

1. Extensão Chrome para desktop
   - Usa a sessão local do navegador do advogado.
   - Identifica o PDF baixado ou aberto no sistema oficial.
   - Envia o arquivo ao LexGestor somente depois de ação explícita do usuário.

2. Aplicativo local auxiliar
   - Roda no computador do advogado.
   - Usa sessão/certificado local já configurado.
   - Envia PDFs para endpoint autenticado do LexGestor.

3. Deep link ou upload assistido no mobile
   - Abre o sistema oficial no navegador/app do tribunal.
   - O advogado baixa ou compartilha o PDF.
   - O LexGestor recebe o arquivo via upload autenticado.

## Endpoint de recebimento

O PDF capturado deve ser enviado para um endpoint seguro do LexGestor.

Requisitos:

- Exigir usuário autenticado no MBA Labs.
- Validar que o usuário pertence ao escritório.
- Validar cliente, caso, processo e evento antes de salvar.
- Reusar o mesmo fluxo de documentos, Dropbox/Google Drive, PDF com marca d'água e auditoria.
- Registrar quem anexou, quando, qual processo e qual evento.
- Retornar erro amigável quando faltar arquivo ou metadados.

## Auditoria

Registrar, no mínimo:

- `processo.abriu_tribunal`
- `processo.copiou_cnj`
- `documento.anexado_evento`
- `conector.criado`
- `conector.atualizado`

## Fora de escopo

- Login automático em tribunal.
- Armazenamento de credenciais.
- Captura silenciosa de documentos.
- Download automático de PDFs internos do eproc/PJe/Projudi/ESAJ a partir do servidor da MBA Labs.
