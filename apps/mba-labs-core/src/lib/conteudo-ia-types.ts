export type ConteudoIaProfileInput = {
  marcaId?: string | null;
  perfilId?: string | null;
  marcaNome: string;
  tiktokUsername: string;
  profileUrl: string;
  nicho: string;
  subnicho: string;
  publicoAlvo: string;
  objetivo: string;
  tomVoz: string;
  cidadeRegiao: string;
  frequencia: "diaria" | "semanal";
  postsPorPeriodo: number;
  pilares: string[];
};

export type ConteudoIaGeneratedItem = {
  day: string;
  date: string;
  objective: string;
  format: "video_curto" | "carrossel" | "imagem";
  theme: string;
  title: string;
  hook: string;
  script: string;
  caption: string;
  callToAction: string;
  hashtags: string[];
  visualBrief: string;
  durationSeconds: number;
  width: number;
  height: number;
};

export type ConteudoIaGeneratedPlan = {
  strategySummary: string;
  audienceInsight: string;
  postingFrequency: string;
  contents: ConteudoIaGeneratedItem[];
};

export type ConteudoIaProfileResponse = {
  profile: ConteudoIaProfileInput | null;
  integrations: {
    openaiConfigured: boolean;
    tiktokConfigured: boolean;
  };
};
