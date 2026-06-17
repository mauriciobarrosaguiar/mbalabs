-- LexGestor seed inicial de checklist templates.
-- ATENCAO: arquivo preparado para revisao. Nao aplicar automaticamente.

with area_docs(area, descricao, documentos) as (
  values
    (
      'Previdenciario',
      'Documentos iniciais para triagem, prova de vinculos, beneficios e historico junto ao INSS.',
      '["RG e CPF","Comprovante de endereco","CNIS","Carteira de trabalho","Carnes/guias de contribuicao","Extrato Meu INSS","Carta de concessao","Indeferimento do INSS","Laudos medicos","Exames","PPP","LTCAT","Documentos rurais, se for rural"]'::jsonb
    ),
    (
      'Criminal',
      'Documentos e provas para analise de risco, estrategia defensiva e providencias urgentes.',
      '["BO","Copia do inquerito","Auto de prisao em flagrante","Mandado de prisao, se houver","Decisao judicial","Denuncia","Intimacoes","Certidoes criminais","Comprovante de residencia","Documentos pessoais","Nome e contato de testemunhas","Prints","Videos","Fotos","Audios","Procuracao","Contrato de honorarios"]'::jsonb
    ),
    (
      'Familia',
      'Documentos para confirmar vinculos familiares, renda, bens, despesas e provas sensiveis.',
      '["RG e CPF","Certidao de casamento","Certidao de nascimento dos filhos","Comprovante de endereco","Comprovante de renda","Documentos dos bens","Escritura de imovel","Documento de veiculo","Extratos bancarios, se necessario","Comprovantes de despesas dos filhos","Conversas/prints","Boletim de ocorrencia, se houver","Procuracao","Contrato de honorarios"]'::jsonb
    ),
    (
      'Trabalhista',
      'Provas de vinculo, jornada, pagamentos, saude ocupacional e comunicacoes de trabalho.',
      '["RG e CPF","Carteira de trabalho","Contrato de trabalho","Holerites","TRCT/rescisao","Extrato FGTS","Folha/cartao de ponto","Escalas de trabalho","Conversas de WhatsApp","E-mails","Atestados medicos","CAT, se acidente","Laudos","Comprovante de pagamento","Dados da empresa","Procuracao","Contrato de honorarios"]'::jsonb
    ),
    (
      'Tributario',
      'Documentos fiscais, societarios, contabeis e processuais para analise tributaria.',
      '["CPF/CNPJ","Contrato social","Cartao CNPJ","Inscricao estadual/municipal","CDA","Notificacao fiscal","Auto de infracao","Processo administrativo","Comprovantes de pagamento","Guias DARF/GNRE/DAS","Notas fiscais","SPED","DCTF","PGDAS","Extratos da divida ativa","Balancos/balancetes","Procuracao","Contrato de honorarios"]'::jsonb
    )
),
subareas(area, subarea, ordem) as (
  values
    ('Previdenciario','Aposentadoria por idade',1),
    ('Previdenciario','Aposentadoria por tempo de contribuicao',2),
    ('Previdenciario','Aposentadoria especial',3),
    ('Previdenciario','Aposentadoria rural',4),
    ('Previdenciario','Pensao por morte',5),
    ('Previdenciario','Auxilio-doenca / beneficio por incapacidade',6),
    ('Previdenciario','Aposentadoria por incapacidade permanente',7),
    ('Previdenciario','BPC/LOAS idoso',8),
    ('Previdenciario','BPC/LOAS pessoa com deficiencia',9),
    ('Previdenciario','Salario-maternidade',10),
    ('Previdenciario','Revisao de beneficio',11),
    ('Previdenciario','Planejamento previdenciario',12),
    ('Previdenciario','Recurso administrativo no INSS',13),
    ('Previdenciario','Acao judicial previdenciaria',14),
    ('Criminal','Inquerito policial',1),
    ('Criminal','Prisao em flagrante',2),
    ('Criminal','Audiencia de custodia',3),
    ('Criminal','Liberdade provisoria',4),
    ('Criminal','Relaxamento de prisao',5),
    ('Criminal','Revogacao de prisao preventiva',6),
    ('Criminal','Habeas corpus',7),
    ('Criminal','Defesa preliminar',8),
    ('Criminal','Resposta a acusacao',9),
    ('Criminal','Crimes contra o patrimonio',10),
    ('Criminal','Crimes de transito',11),
    ('Criminal','Crimes contra a honra',12),
    ('Criminal','Violencia domestica',13),
    ('Criminal','Drogas',14),
    ('Criminal','Tribunal do Juri',15),
    ('Criminal','Execucao penal',16),
    ('Criminal','Revisao criminal',17),
    ('Familia','Divorcio consensual',1),
    ('Familia','Divorcio litigioso',2),
    ('Familia','Guarda',3),
    ('Familia','Regulamentacao de visitas',4),
    ('Familia','Pensao alimenticia',5),
    ('Familia','Revisao de alimentos',6),
    ('Familia','Exoneracao de alimentos',7),
    ('Familia','Uniao estavel',8),
    ('Familia','Dissolucao de uniao estavel',9),
    ('Familia','Partilha de bens',10),
    ('Familia','Inventario',11),
    ('Familia','Curatela',12),
    ('Familia','Tutela',13),
    ('Familia','Adocao',14),
    ('Familia','Alienacao parental',15),
    ('Familia','Medida protetiva familiar',16),
    ('Trabalhista','Reclamacao trabalhista',1),
    ('Trabalhista','Verbas rescisorias',2),
    ('Trabalhista','Horas extras',3),
    ('Trabalhista','Folha de ponto',4),
    ('Trabalhista','Vinculo sem registro',5),
    ('Trabalhista','FGTS',6),
    ('Trabalhista','Acidente de trabalho',7),
    ('Trabalhista','Doenca ocupacional',8),
    ('Trabalhista','Assedio moral',9),
    ('Trabalhista','Dano moral trabalhista',10),
    ('Trabalhista','Reversao de justa causa',11),
    ('Trabalhista','Estabilidade gestante',12),
    ('Trabalhista','Adicional de insalubridade',13),
    ('Trabalhista','Adicional de periculosidade',14),
    ('Trabalhista','Trabalho domestico',15),
    ('Trabalhista','Defesa de empresa',16),
    ('Tributario','Execucao fiscal',1),
    ('Tributario','CDA',2),
    ('Tributario','Divida ativa',3),
    ('Tributario','Defesa em auto de infracao',4),
    ('Tributario','Impugnacao administrativa',5),
    ('Tributario','Mandado de seguranca tributario',6),
    ('Tributario','Parcelamento',7),
    ('Tributario','Restituicao de tributos',8),
    ('Tributario','Compensacao tributaria',9),
    ('Tributario','Simples Nacional',10),
    ('Tributario','ICMS',11),
    ('Tributario','ISS',12),
    ('Tributario','IPTU',13),
    ('Tributario','IPVA',14),
    ('Tributario','IRPJ/CSLL/PIS/COFINS',15),
    ('Tributario','Planejamento tributario',16),
    ('Tributario','Defesa de empresa',17)
)
insert into public.lex_checklist_templates (
  area,
  subarea,
  titulo,
  descricao,
  documentos_necessarios,
  obrigatorio,
  ordem,
  ativo
)
select
  subareas.area,
  subareas.subarea,
  'Checklist ' || lower(subareas.area) || ' - ' || subareas.subarea,
  area_docs.descricao,
  area_docs.documentos,
  true,
  subareas.ordem,
  true
from subareas
join area_docs on area_docs.area = subareas.area
on conflict (area, subarea, ordem) do update set
  titulo = excluded.titulo,
  descricao = excluded.descricao,
  documentos_necessarios = excluded.documentos_necessarios,
  obrigatorio = excluded.obrigatorio,
  ativo = excluded.ativo;
