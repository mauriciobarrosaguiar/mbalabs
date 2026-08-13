# DroneGestor — auditoria de UX e fluxo — 12/08/2026

## Regra de produto

O DroneGestor deve funcionar como copiloto de campo para usuário leigo: uma ação clara por vez, preenchimento automático sempre que houver dado confiável já cadastrado e nenhuma informação técnica crítica escondida.

## Páginas auditadas

### `/apps/dronegestor`
- Manter: entrada simples por intenção.
- Ajustado: biblioteca de Produtos e Bulas passa a existir como função própria.
- Manter separados: Preparar operação, Campo, Histórico e Equipamentos.

### `/apps/dronegestor/gestao`
- Faz sentido: Cliente → Fazenda → Talhão → OS.
- Regra: cadastro administrativo é ADMIN/RT; piloto recebe somente OS operacional.
- A OS deve ser a principal porta de entrada para operação profissional.

### `/apps/dronegestor/equipamentos`
- Faz sentido e deve permanecer.
- Drone é cadastrado uma vez; piloto confirma o equipamento a cada nova missão.
- Troca de drone invalida calibração/checklist dependentes.

### `/apps/dronegestor/campo`
- Mantidas 6 fases visíveis: Operação, Calda, Segurança, Equipamento, Liberação e Aplicar.
- Subetapas técnicas continuam por segurança, mas recebem orientação em linguagem simples.
- Corrigida duplicidade do botão/modal de Mapa do voo.
- O mapa usado no voo continua aceitando câmera ou arquivo.
- GPS/modelo meteorológico continua separado da medição real feita no talhão.
- SARPAS continua sendo conferência no sistema oficial, sem falsa promessa de integração automática.

### `/apps/dronegestor/historico`
- Faz sentido: consulta consolidada, período, área real, volume real e ocorrências.
- CSV continua sendo base de conferência e não deve ser chamado de relatório oficial.

### `/apps/dronegestor/produtos`
- Problema anterior: a página apenas redirecionava para a calculadora, embora a API AGROFIT já existisse.
- Nova função: biblioteca de identificação do produto e revisão de bula pelo ADMIN/RT.
- Piloto pode consultar; somente ADMIN/RT grava revisão técnica.
- Nunca preencher dose automaticamente a partir desta biblioteca.

### `/apps/dronegestor/calculadora`
- Manter pública como Calda Fácil/PWA.
- Continua separada do fluxo autenticado para ser útil em campo sem burocracia.

## Contraste / textos invisíveis

Criado layout visual comum para todo `/apps/dronegestor`:
- `color-scheme: light`;
- cor explícita para input/select/textarea;
- placeholder visível;
- campos desabilitados com contraste estável;
- correção para WebView/PWA/celulares que tentam aplicar tema escuro aos controles nativos.

## Próximas fases recomendadas

1. Integrar a busca da biblioteca de produtos diretamente ao campo, preenchendo somente nome/registro — dose permanece manual conforme receita.
2. Evoluir Mapa do voo para polígono real do talhão, áreas sensíveis, buffers e vetor de vento.
3. Importar KML/KMZ/GeoJSON e depois arquivos reais exportados por DJI AGRAS após validar amostras.
4. Criar motor regulatório versionado por UF com fonte, vigência e revisão do RT; não hard-code distância legal sem fonte/versionamento.
5. Gerar pacote final da operação com mapa/evidências, parâmetros, clima, SARPAS, abastecimentos e ocorrências.
6. Só depois implementar relatório mensal oficial no modelo vigente e separar claramente geração de documento de eventual protocolo/envio oficial.
