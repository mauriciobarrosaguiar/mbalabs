# GeoMap — Evidência da prova de conceito 002

Run: https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/46134391076
Job: https://github.com/mauriciobarrosaguiar/mbalabs/actions/runs/46134391076/job/140946334563

Motor: status 40, progresso 100%, 29 imagens, processingTime 381908 ms. ZIP validado.
- odm_orthophoto.tif: 4459369 bytes
- dsm.tif: 3978842 bytes
- dtm.tif: 3790385 bytes

Workflow falhou com código 127 após validação ZIP e antes da publicação. A falha é compatível com GDAL indisponível no PATH do container usado por docker exec; o log não contém mensagem explícita do comando ausente. Correção: instalar gdal-bin no runner, verificar ferramentas antes de processar, extrair três rasters do ZIP para nomes fixos, executar GDAL no host e publicar resultados somente após as verificações. Registrar linha de falha. Nenhuma alteração ao motor ou dados privados. A execução seguinte precisa confirmar a correção; retenção GitHub de sete dias é apenas teste, não implementação de produção.
