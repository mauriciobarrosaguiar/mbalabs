# MBA GeoMap — Fase 1 (prova de conceito)

Uso privado, um operador. Independente do AgroVoo. Nenhum serviço pago, migração, alteração do banco ou deploy autorizado nesta fase.

## Escopo
Fluxo de referência Maps4me: projeto → imagens originais → parâmetros → fila → processamento → produtos → visualização/análise/exportação. Implementação própria com NodeODM/ODM, sem dependência da Maps4me. Futuro GeoStudio e integração AgroVoo ficam fora desta fase.

## Executar localmente
Pré-requisitos: computador 64-bit, Docker Desktop/Engine com Compose, espaço livre suficiente e RAM verificada. Começar com 30–60 fotos JPG originais de um bloco com boa sobreposição, sem misturar voos desconexos. A capacidade real depende do tamanho das fotos e opções.
1. Na pasta infra/geomap, executar `docker compose up -d`.
2. Abrir http://localhost:3000/ e consultar http://localhost:3000/info e http://localhost:3000/options.
3. Enviar as imagens pelo painel nativo NodeODM. Usar um nome de tarefa exclusivo. Começar com parâmetros padrão, ativar dsm e dtm para os modelos de elevação; não ativar fast-orthophoto se desejar 3D. Confirmar opções disponíveis no motor instalado.
4. Acompanhar até a conclusão, baixar all.zip e guardar o ZIP e os originais em pasta privada fora do repositório. Registrar versão do motor, opções, duração e recursos. A limpeza automática do NodeODM pode remover tarefas antigas: não usar seu volume como backup definitivo.
5. Abrir GeoTIFFs no QGIS e conferir cobertura, CRS, alinhamento, falhas, resolução e coerência de elevação; conferir nuvem e modelo 3D. Sem pontos de controle/checkpoints não alegar precisão centimétrica.
6. Parar com `docker compose stop`. Não executar down -v sem backup: remove o volume de dados.

A porta é publicada somente no loopback do computador. Não expor à internet, não abrir portas no roteador, não enviar fotografias, coordenadas, tokens ou resultados privados ao GitHub. A imagem usa latest para experimentação; após o primeiro teste, registrar e fixar a versão/digest antes de homologar. Revisar licenças AGPL antes de distribuição ou oferta comercial.

## Critérios de aceite
- [ ] Docker e recursos do computador verificados.
- [ ] API /info e /options respondem.
- [ ] Dataset real submetido, UUID registrado e progresso acompanhado.
- [ ] Ortomosaico GeoTIFF válido no QGIS.
- [ ] MDT/MDS, nuvem e modelo 3D conferidos quando habilitados.
- [ ] ZIP e originais preservados e relatório de qualidade avaliado.
- [ ] Duração, pico de RAM e espaço medidos.
- [ ] Erro de tarefa tratado sem perda dos originais.

## Próximas fases
Projetos e armazenamento → adaptador NodeODM e fila → GeoStudio básico → planejamento → topografia e 3D → agricultura → relatórios → integração AgroVoo. A UI só deve afirmar sucesso após validar os resultados reais.

Referências:
- https://github.com/OpenDroneMap/NodeODM
- https://github.com/OpenDroneMap/NodeODM/blob/master/docs/index.adoc
- https://docs.opendronemap.org/arguments/
- https://docs.opendronemap.org/installation/
