export type BibleStudy = {
  context: string;
  chapter: string;
  observe: string[];
  application: string;
  kingJamesNotes: Array<{
    title: string;
    text: string;
    source: "King James Atualizada";
  }>;
};

const KING_JAMES_NOTES: Record<string, Array<{ title: string; text: string; source: "King James Atualizada" }>> = {
  "NEH:6": [
    {
      title: "Nota de estudo — Neemias 6",
      source: "King James Atualizada",
      text: "A cidade de Ono ficava quase 12 km a Sudeste de Jope, próxima de Lode, atual Lida (Ed 2.33), na região Oeste, povoada pelos judeus que retornavam (Ne 7.37; 11.35). Talvez tenha sido proposta como território neutro. Neemias reconheceu no convite uma armadilha (Gn 4.8; Jr 41.1-3). Os inimigos da obra do Senhor são incansáveis, ainda que se afastem por um tempo (Dt 6.16; Lc 4.12), sempre voltam ao ataque, lançando mão de ciladas, enganos, seduções e subversão. Neemias nos adverte sobre algumas das principais artimanhas dos adversários: 1) Espionagem (4.1-3); 2) Intimidações e até agressões (4.8); 3) Esgotamento físico e emocional; cansaço, depressão e tristeza; 4) Boatos, mal-entendidos e calúnias (6.5-8); 5) Falsas profecias e batalhas espirituais (6.10-14); 6) Revoltas e sabotagem entre famílias (6.17-19)."
    }
  ]
};

const THEMES: Record<string, string> = {
  GEN: "Origens, criação, queda, alianças e o início da história do povo da promessa.",
  EXO: "Libertação, aliança, presença de Deus e formação de Israel como povo.",
  LEV: "Santidade, culto, sacerdócio e vida de um povo separado para Deus.",
  NUM: "Peregrinação, incredulidade, disciplina e fidelidade de Deus no deserto.",
  DEU: "Renovação da aliança e chamado à fidelidade antes da entrada na terra.",
  JOS: "Entrada na terra, coragem, obediência e fidelidade às promessas.",
  JDG: "Ciclos de afastamento, opressão, clamor e livramento no período dos juízes.",
  RUT: "Lealdade, redenção, providência e esperança em meio à vida comum.",
  "1SA": "Transição para a monarquia, liderança, obediência e o contraste entre Saul e Davi.",
  "2SA": "Reinado de Davi, aliança, vitórias, pecados e consequências dentro do reino.",
  "1KI": "Salomão, templo, divisão do reino e a tensão entre fidelidade e idolatria.",
  "2KI": "Declínio dos reinos, ministério profético, exílio e consequências da infidelidade.",
  "1CH": "Memória da identidade de Israel, linhagem davídica, culto e preparação do templo.",
  "2CH": "Templo, reis de Judá, reformas espirituais e chamado ao retorno para Deus.",
  EZR: "Retorno do exílio, reconstrução do templo e restauração da identidade espiritual.",
  NEH: "Reconstrução dos muros, liderança, resistência à oposição e renovação da comunidade.",
  EST: "Providência, coragem e preservação do povo judeu em ambiente estrangeiro.",
  JOB: "Sofrimento, integridade, limites da explicação humana e soberania divina.",
  PSA: "Oração, adoração, lamento, confiança, arrependimento e esperança diante de Deus.",
  PRO: "Sabedoria prática para palavras, escolhas, relacionamentos, trabalho e caráter.",
  ECC: "Limites das conquistas humanas e busca de sentido diante da brevidade da vida.",
  SNG: "Amor, compromisso, beleza e celebração do relacionamento conjugal.",
  ISA: "Santidade de Deus, juízo, consolo, esperança messiânica e restauração.",
  JER: "Chamado ao arrependimento, juízo sobre a infidelidade e promessa de nova aliança.",
  LAM: "Lamento diante da ruína, dor coletiva e esperança sustentada pela misericórdia.",
  EZK: "Glória de Deus, responsabilidade, juízo, restauração e renovação espiritual.",
  DAN: "Fidelidade em ambiente hostil, soberania de Deus sobre reinos e esperança futura.",
  HOS: "Amor persistente de Deus diante da infidelidade do povo.",
  JOL: "Arrependimento, dia do Senhor e promessa do derramamento do Espírito.",
  AMO: "Justiça, responsabilidade social e denúncia de religiosidade sem retidão.",
  OBA: "Juízo sobre o orgulho e certeza da justiça divina.",
  JON: "Misericórdia de Deus, missão e confronto com um coração resistente à graça.",
  MIC: "Juízo, justiça, misericórdia e esperança em um governante prometido.",
  NAM: "Queda da violência imperial e justiça de Deus contra a opressão.",
  HAB: "Fé em meio à perplexidade e confiança quando as circunstâncias não fazem sentido.",
  ZEP: "Dia do Senhor, juízo, purificação e esperança para um remanescente.",
  HAG: "Prioridades espirituais e reconstrução do templo após o exílio.",
  ZEC: "Restauração, visões proféticas e esperança messiânica.",
  MAL: "Fidelidade na adoração, alianças, justiça e expectativa do mensageiro prometido.",
  MAT: "Jesus como Messias e Rei, ensino do Reino e cumprimento das Escrituras.",
  MRK: "Jesus em ação, autoridade, serviço, sofrimento e chamado ao discipulado.",
  LUK: "Jesus como Salvador, compaixão, oração, Espírito Santo e alcance aos marginalizados.",
  JHN: "Identidade de Jesus, sinais, fé, vida eterna e relacionamento com o Pai.",
  ACT: "Expansão da igreja pelo Espírito Santo, testemunho e missão entre os povos.",
  ROM: "Evangelho, justificação pela fé, nova vida e implicações práticas da graça.",
  "1CO": "Correção de divisões, santidade, dons, culto, amor e ressurreição.",
  "2CO": "Ministério, fraqueza, consolo, generosidade e poder de Deus na fragilidade.",
  GAL: "Liberdade em Cristo, justificação pela fé e vida guiada pelo Espírito.",
  EPH: "Identidade em Cristo, unidade da igreja e vida coerente com o evangelho.",
  PHP: "Alegria em Cristo, humildade, perseverança e contentamento.",
  COL: "Supremacia de Cristo e vida transformada por sua suficiência.",
  "1TH": "Fé perseverante, santidade, esperança e retorno de Cristo.",
  "2TH": "Perseverança, correção de confusões sobre o fim e responsabilidade cotidiana.",
  "1TI": "Liderança, doutrina, culto e organização saudável da comunidade cristã.",
  "2TI": "Fidelidade ao evangelho, perseverança no ministério e transmissão da fé.",
  TIT: "Doutrina saudável, liderança e boas obras como fruto do evangelho.",
  PHM: "Reconciliação, fraternidade e transformação das relações pelo evangelho.",
  HEB: "Superioridade de Cristo, nova aliança, perseverança e fé.",
  JAS: "Fé prática demonstrada em obras, domínio da língua e perseverança.",
  "1PE": "Esperança e santidade em meio ao sofrimento e à pressão social.",
  "2PE": "Crescimento espiritual, alerta contra falsos mestres e esperança na promessa divina.",
  "1JN": "Comunhão com Deus, amor, verdade, obediência e segurança da fé.",
  "2JN": "Verdade, amor e discernimento diante de ensinos enganosos.",
  "3JN": "Hospitalidade, fidelidade e contraste entre serviço humilde e ambição.",
  JUD: "Defesa da fé e alerta contra corrupção doutrinária e moral.",
  REV: "Soberania de Deus, perseverança da igreja, juízo e esperança na nova criação."
};

const SPECIAL: Record<string, string> = {
  "GEN:1": "O capítulo apresenta Deus como Criador e organiza a narrativa em movimentos de formação e preenchimento. Observe a repetição de expressões que comunicam ordem, propósito e bondade.",
  "EXO:20": "O texto reúne os mandamentos centrais da aliança. Eles começam com a graça da libertação e, a partir dela, orientam adoração, família, vida, sexualidade, propriedade, verdade e desejos.",
  "NEH:6": "Neemias 6 concentra várias formas de oposição à reconstrução: convites enganosos, intimidação, acusações públicas e uso indevido da linguagem religiosa. A resposta de Neemias combina discernimento, foco no trabalho, oração e recusa em agir pelo medo.",
  "PSA:23": "O salmo usa as imagens do pastor e do anfitrião para expressar cuidado, direção, presença e segurança. O centro da confiança não está na ausência de dificuldades, mas na presença de Deus durante o caminho.",
  "ISA:53": "O capítulo descreve o Servo em sofrimento e apresenta sua dor de forma ligada à culpa, restauração e justificação de outros. Leia observando o contraste entre rejeição humana e propósito redentor.",
  "MAT:5": "O início do Sermão do Monte apresenta o caráter dos cidadãos do Reino e aprofunda a obediência para além do comportamento externo, alcançando intenções, relacionamentos e integridade.",
  "JHN:3": "O diálogo com Nicodemos destaca novo nascimento, ação do Espírito, fé e vida eterna. O capítulo também contrasta luz e trevas como resposta humana à revelação de Deus.",
  "ROM:8": "O capítulo reúne vida no Espírito, adoção, esperança em meio ao sofrimento e segurança no amor de Deus. Observe como a esperança cristã inclui tanto a transformação presente quanto a expectativa futura.",
  "1CO:13": "Paulo coloca o amor no centro do exercício dos dons. O capítulo mostra que capacidade, conhecimento e sacrifício perdem seu valor quando não são orientados por um amor paciente, verdadeiro e perseverante.",
  "HEB:11": "A fé é apresentada por meio de uma sequência de pessoas que confiaram nas promessas de Deus mesmo sem ver imediatamente seu cumprimento. O foco está em confiança perseverante, não em facilidade."
};

const GENRE: Record<string, "lei" | "historia" | "poesia" | "profecia" | "evangelho" | "cartas" | "apocalipse"> = {};

[
  "GEN","EXO","LEV","NUM","DEU"
].forEach((id) => { GENRE[id] = "lei"; });
[
  "JOS","JDG","RUT","1SA","2SA","1KI","2KI","1CH","2CH","EZR","NEH","EST","ACT"
].forEach((id) => { GENRE[id] = "historia"; });
[
  "JOB","PSA","PRO","ECC","SNG"
].forEach((id) => { GENRE[id] = "poesia"; });
[
  "ISA","JER","LAM","EZK","DAN","HOS","JOL","AMO","OBA","JON","MIC","NAM","HAB","ZEP","HAG","ZEC","MAL"
].forEach((id) => { GENRE[id] = "profecia"; });
[
  "MAT","MRK","LUK","JHN"
].forEach((id) => { GENRE[id] = "evangelho"; });
[
  "ROM","1CO","2CO","GAL","EPH","PHP","COL","1TH","2TH","1TI","2TI","TIT","PHM","HEB","JAS","1PE","2PE","1JN","2JN","3JN","JUD"
].forEach((id) => { GENRE[id] = "cartas"; });
GENRE.REV = "apocalipse";

const OBSERVE: Record<string, string[]> = {
  lei: [
    "Observe o que o texto revela sobre o caráter de Deus e sua aliança.",
    "Diferencie princípios permanentes das instruções ligadas ao contexto de Israel.",
    "Perceba como graça, obediência, santidade e comunidade aparecem juntas."
  ],
  historia: [
    "Observe decisões, motivações e consequências na trajetória das pessoas.",
    "Note como a fidelidade ou a infidelidade influencia a comunidade.",
    "Procure sinais de providência, oração, liderança e resposta à Palavra."
  ],
  poesia: [
    "Identifique imagens, paralelismos, contrastes e repetições.",
    "Perceba a emoção do texto antes de transformá-lo em uma regra.",
    "Observe como a experiência humana é levada diante de Deus."
  ],
  profecia: [
    "Identifique a situação que está sendo confrontada e o chamado ao arrependimento.",
    "Observe a relação entre juízo, justiça, esperança e restauração.",
    "Diferencie o horizonte imediato do profeta das promessas de alcance mais amplo."
  ],
  evangelho: [
    "Observe o que Jesus faz, ensina e revela sobre sua identidade.",
    "Perceba as diferentes respostas das pessoas diante de Jesus.",
    "Procure o chamado ao discipulado, à fé, ao arrependimento e ao amor."
  ],
  cartas: [
    "Observe o problema ou necessidade pastoral que o autor está tratando.",
    "Separe afirmações do evangelho das aplicações práticas que decorrem delas.",
    "Procure conexões entre doutrina, caráter, relacionamentos e vida comunitária."
  ],
  apocalipse: [
    "Leia os símbolos à luz do restante das Escrituras e do contexto das igrejas.",
    "Observe o contraste entre poderes temporários e a soberania de Deus.",
    "Mantenha no centro o chamado à perseverança, fidelidade e esperança."
  ]
};

const APPLICATION: Record<string, string> = {
  lei: "Pergunte como os princípios de santidade, justiça, adoração e amor ao próximo podem orientar suas escolhas hoje, sem retirar as leis do contexto em que foram dadas.",
  historia: "Pergunte quais atitudes revelam fé, medo, orgulho, coragem ou dependência de Deus e como essas mesmas disposições aparecem nas suas decisões.",
  poesia: "Transforme a leitura em oração: reconheça a emoção do texto, o que ela revela sobre Deus e como você pode responder com sinceridade.",
  profecia: "Considere quais formas de injustiça, idolatria, autossuficiência ou desânimo o texto confronta e qual esperança ele oferece.",
  evangelho: "Pergunte o que o capítulo ensina sobre Jesus e qual resposta concreta de fé, obediência, serviço ou amor ele pede.",
  cartas: "Identifique uma verdade para crer, uma atitude para corrigir e uma prática que possa ser vivida em comunidade.",
  apocalipse: "Use o texto para fortalecer fidelidade e esperança, evitando transformar símbolos em especulação desconectada da mensagem central."
};

export function getBibleStudy(bookId: string, bookName: string, chapter: number, totalChapters: number): BibleStudy {
  const genre = GENRE[bookId] ?? "historia";
  const specific = SPECIAL[bookId + ":" + chapter];
  const position =
    chapter === 1
      ? "Como abertura do livro, observe de que maneira este capítulo apresenta pessoas, conflitos, ideias ou temas que serão desenvolvidos depois."
      : chapter === totalChapters
        ? "Como encerramento do livro, observe quais temas são concluídos, quais permanecem em aberto e qual resposta o leitor é convidado a levar consigo."
        : "Leia este capítulo em continuidade com o anterior e o seguinte. Muitas ideias bíblicas ficam mais claras quando não isolamos o capítulo do seu movimento maior.";

  return {
    context: THEMES[bookId] ?? "Leia o livro observando seu contexto, seus temas repetidos e a forma como ele contribui para a mensagem das Escrituras.",
    chapter: specific ?? (bookName + " " + chapter + ": " + position),
    observe: OBSERVE[genre],
    application: APPLICATION[genre],
    kingJamesNotes: KING_JAMES_NOTES[bookId + ":" + chapter] ?? []
  };
}
