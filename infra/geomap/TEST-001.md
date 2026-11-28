# GeoMap — Evidência da prova de conceito 001

Run: https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/46133660266
Job: https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/46133660266/job/140944110829
Commit: 55274855ae683191f22a3223c9b200215bbfaf76
Resultado confirmado em logs: sucesso, 29 imagens, progresso 100%, processingTime 364825 ms, elapsed 391 s. Tempo total 7m30s conforme interface. ZIP passou teste de integridade e assinaturas TIFF.
- odm_orthophoto.tif: 4564385 bytes
- dsm.tif: 3990945 bytes
- dtm.tif: 3987196 bytes
Imagem testada: opendronemap/nodeodm@sha256:fcd99eb23d8db194a7d1dc95f029f518283b3d6be32dd64422395f4e7af56720
A primeira execução não reteve artefatos. CRS, qualidade visual, precisão, demais produtos e infraestrutura de produção ainda não homologados.

Teste 002: fixar digest, validar metadados GDAL, gerar prévia PNG e publicar ZIP de amostra pública com atribuição por sete dias via GitHub Actions. Somente CI de desenvolvimento; nunca usar fotos privadas em repositório público. A expiração de artefatos de CI não comprova implementação da política de retenção no armazenamento definitivo.
