import { useState, useRef } from 'react';
import { supabase } from './lib/supabase';


// Fatores de risco psicossocial baseados nos 12 domínios do Guia Prático SIT/ENIT (2020)
// e da ISO 45003 (2021), conforme metodologia de tetra-angulação de evidências em
// macroergonomia (Artigo de referência da AEP).
//
// sevBase: Severidade clínica FIXA — magnitude do agravo potencial definida pelo
// nexo epidemiológico (NTEP/Decreto 3.048/99) e CID-11. Não depende de dados da empresa.
// S1=Leve | S2=Média | S3=Grave | S4=Crítica
// FATORES — ordem conforme tabela do artigo (Tetra-angulação de Evidências, Eixo III)
// Eixo II  = perguntas de auditoria para a GESTÃO (trabalho prescrito)
// Eixo III = checklist de observação in loco (TST/perito)
// Eixo IV  = pergunta ao representante do GHE (escala 1–4, invertida ou direta)
const FATORES = [
  { id: 1,
    label: "Assédio de Qualquer Natureza no Trabalho",
    cid: "TEPT / Depressão Grave (F43.1 / F32 / 6B40)",
    sevBase: 4,
    justificativa: "NR-01 / CID-11: risco de incapacidade permanente e dano à dignidade.",
    perguntaEixo2: "Existem canais éticos de denúncia e política de consequências documentadas?",
    checklist: "Observou-se exposição de erros em público ou linguagem hostil na supervisão?",
    perguntaEixo4: { tipo: "Direta", texto: "Observo ou sofro situações de humilhação, gritos ou perseguições no ambiente de trabalho." } },

  { id: 2,
    label: "Eventos Violentos ou Traumáticos",
    cid: "TEPT (F43.1 / 6B40)",
    sevBase: 4,
    justificativa: "NR-01: exposição a perigo imediato com agravo psicológico irreversível.",
    perguntaEixo2: "Há protocolos de segurança e suporte psicológico para eventos críticos/violentos?",
    checklist: "Há exposição a riscos críticos (violência, morte, acidentes) sem barreira física?",
    perguntaEixo4: { tipo: "Direta", texto: "A minha função expõe-me a situações violentas, acidentes graves ou risco de vida." } },

  { id: 3,
    label: "Excesso de Demandas no Trabalho",
    cid: "Síndrome de Burnout (QD85 / F48)",
    sevBase: 3,
    justificativa: "NTEP / Decreto 3.048: Nexo com sobrecarga cognitiva e física.",
    perguntaEixo2: "A meta de produção foi calculada prevendo pausas e imprevistos técnicos?",
    checklist: "Observou-se ritmo de trabalho frenético ou trabalhadores suprimindo pausas?",
    perguntaEixo4: { tipo: "Direta", texto: "O meu volume de trabalho é tão alto que preciso ignorar pausas ou fazer horas extras constantes." } },

  { id: 4,
    label: "Baixa Demanda no Trabalho (Subcarga)",
    cid: "Estresse / Ansiedade Reativa (F41 / F43)",
    sevBase: 2,
    justificativa: "ISO 45003: subutilização de capacidades gerando sofrimento ético.",
    perguntaEixo2: "Existe planejamento para evitar o ócio forçado ou subutilização de competências?",
    checklist: "Identificou-se ociosidade forçada ou 'presenteísmo' por falta de fluxo?",
    perguntaEixo4: { tipo: "Direta", texto: "Sinto que passo muito tempo sem ter tarefas produtivas para fazer (ócio forçado)." } },

  { id: 5,
    label: "Baixo Controle no Trabalho / Falta de Autonomia",
    cid: "Episódios Depressivos (6A70 / F32)",
    sevBase: 3,
    justificativa: "Modelo de Karasek: alto risco de adoecimento por baixa margem de decisão.",
    perguntaEixo2: "A norma permite que o trabalhador altere a ordem das tarefas em caso de incidentes?",
    checklist: "O trabalhador está submetido a um ritmo ditado estritamente por máquinas/sistemas?",
    perguntaEixo4: { tipo: "Invertida", texto: "Sinto que tenho liberdade para decidir a ordem das minhas tarefas e o ritmo do meu trabalho." } },

  { id: 6,
    label: "Falta de Suporte / Apoio no Trabalho",
    cid: "Reação ao Estresse Grave (F43)",
    sevBase: 3,
    justificativa: "ISO 45003 / NR-17: o isolamento técnico amplia o risco de fadiga mental.",
    perguntaEixo2: "Existe líder técnico disponível durante 100% da jornada para suporte?",
    checklist: "No momento da dúvida, o trabalhador encontrou auxílio ou ficou desamparado?",
    perguntaEixo4: { tipo: "Invertida", texto: "Quando tenho uma dificuldade técnica, recebo apoio rápido e eficiente da minha liderança." } },

  { id: 7,
    label: "Má Gestão de Mudanças Organizacionais",
    cid: "Transtornos de Adaptação (F43.2)",
    sevBase: 2,
    justificativa: "NR-01 (GRO): falha na gestão de mudanças impacta a estabilidade psíquica.",
    perguntaEixo2: "Há cronograma de treinamento e aviso prévio formal para mudanças de processo?",
    checklist: "Há sinais de improvisação ou estresse por desconhecimento de novos processos?",
    perguntaEixo4: { tipo: "Direta", texto: "Geralmente, sou surpreendido por mudanças no trabalho sem que ninguém me avise ou treine antes." } },

  { id: 8,
    label: "Baixa Clareza de Papel / Função",
    cid: "Ansiedade Generalizada (6A71 / F41.1)",
    sevBase: 2,
    justificativa: "ISO 45003: incerteza sobre responsabilidades gera estresse crônico.",
    perguntaEixo2: "O colaborador possui descrição de cargo e indicadores de metas por escrito?",
    checklist: "Os trabalhadores apresentam dúvidas sobre a quem se reportar ou o que entregar?",
    perguntaEixo4: { tipo: "Invertida", texto: "Sei exatamente o que a empresa espera de mim e quais são as minhas responsabilidades." } },

  { id: 9,
    label: "Baixas Recompensas e Reconhecimento",
    cid: "Desmotivação / Transtorno de Humor (F30-F39)",
    sevBase: 2,
    justificativa: "Modelo de Siegrist (DER): desequilíbrio entre esforço e recompensa.",
    perguntaEixo2: "Existe política clara de reconhecimento e progressão ligada ao esforço?",
    checklist: "O clima organizacional demonstra apatia por falta de perspectiva de crescimento?",
    perguntaEixo4: { tipo: "Invertida", texto: "Sinto que o meu esforço e dedicação são reconhecidos e valorizados pela organização." } },

  { id: 10,
    label: "Baixa Justiça Organizacional",
    cid: "Reações ao Estresse / Ansiedade (F41 / F43)",
    sevBase: 2,
    justificativa: "CID-11: percepção de iniquidade como fator de estresse ocupacional.",
    perguntaEixo2: "Os critérios de escalas, folgas e benefícios são públicos e isonômicos?",
    checklist: "Há indícios ou relatos informais de favoritismo na distribuição de tarefas?",
    perguntaEixo4: { tipo: "Invertida", texto: "As decisões sobre benefícios, folgas e promoções no meu setor são transparentes e justas." } },

  { id: 11,
    label: "Maus Relacionamentos no Local de Trabalho",
    cid: "Estresse Ocupacional (QD85 / F43.2)",
    sevBase: 2,
    justificativa: "NR-17: conflitos interpessoais como barreira à organização do trabalho.",
    perguntaEixo2: "Existem ritos de integração e mediação de conflitos entre as equipes?",
    checklist: "Observou-se cooperação técnica ou sinais de isolamento e conflitos interpessoais?",
    perguntaEixo4: { tipo: "Invertida", texto: "Existe um clima de respeito, ajuda mútua e cooperação entre os meus colegas." } },

  { id: 12,
    label: "Trabalho em Condições de Difícil Comunicação",
    cid: "Ansiedade / Erros Cognitivos (F41 / F48)",
    sevBase: 2,
    justificativa: "Guia SIT: dificuldade de acesso à informação como fator de insegurança.",
    perguntaEixo2: "Quais os canais oficiais para garantir que a informação chegue sem distorção?",
    checklist: "Os canais de informação (sistemas/murais) estão atualizados e funcionais?",
    perguntaEixo4: { tipo: "Invertida", texto: "As informações para realizar o meu trabalho chegam de forma clara e sem atrasos." } },
];

// ── MAPEAMENTO CNAE → CIDs NTEP (Decreto 3.048/1999, Lista C, Anexo II) ──
// Estrutura por seção CNAE (2 dígitos):
//   cidF: CIDs do Grupo F (Transtornos Mentais) — DESTAQUE principal
//   cidOutros: demais CIDs com nexo NTEP para o setor (doenças osteomusculares, LER/DORT, etc.)
//   fatoresPsi: IDs dos fatores psicossociais de maior prevalência epidemiológica
const CNAE_NTEP_FULL = {
  "01": { nome: "Agricultura, pecuária e silvicultura", cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade"], cidOutros: ["M54 – Dorsalgia","M79.1 – Mialgia","J68 – Pneumonite química","L25 – Dermatite de contato"], fatoresPsi: [3,6,2,4] },
  "02": { nome: "Silvicultura e exploração florestal",  cidF: ["F32 – Episódio depressivo","F43 – Reações ao estresse","F41 – Ansiedade"], cidOutros: ["M54 – Dorsalgia","S60-S69 – Traumatismos do punho/mão","L25 – Dermatite de contato"], fatoresPsi: [3,6,2,4] },
  "03": { nome: "Pesca e aquicultura",                  cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F10 – Transt. uso álcool"], cidOutros: ["M54 – Dorsalgia","S00-S09 – Traumatismos cabeça","Z57.5 – Exposição ao calor extremo"], fatoresPsi: [3,6,2,4] },
  "05": { nome: "Extração de carvão mineral",           cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade"], cidOutros: ["J60 – Pneumoconiose do mineiro","M54 – Dorsalgia","H83.3 – Perda auditiva induzida por ruído"], fatoresPsi: [3,6,1,2] },
  "06": { nome: "Extração de petróleo e gás",           cidF: ["F43.1 – TEPT","F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["L55-L59 – Afecções pele/sol","M54 – Dorsalgia","Z57.5 – Exposição calor"], fatoresPsi: [3,6,1,2] },
  "07": { nome: "Extração de minerais metálicos",       cidF: ["F32 – Episódio depressivo","F43 – Reações ao estresse"], cidOutros: ["J61 – Pneumoconiose (amianto)","M54 – Dorsalgia","H83.3 – PAIR"], fatoresPsi: [3,6,1,2] },
  "08": { nome: "Extração de minerais não-metálicos",   cidF: ["F32 – Episódio depressivo","F43 – Reações ao estresse"], cidOutros: ["J62 – Silicose","M54 – Dorsalgia","H83.3 – PAIR"], fatoresPsi: [3,6,1,2] },
  "09": { nome: "Serviços de apoio à extração",         cidF: ["F32 – Episódio depressivo","F43.1 – TEPT"], cidOutros: ["M54 – Dorsalgia","S40-S49 – Traumatismo ombro/braço"], fatoresPsi: [3,6,1,2] },
  "10": { nome: "Fabricação de produtos alimentícios",  cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Neurastenia/esgotamento"], cidOutros: ["M65 – Sinovite/Tenossinovite","M70 – LER/DORT","L25 – Dermatite contato"], fatoresPsi: [3,5,6,12] },
  "11": { nome: "Fabricação de bebidas",                cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","H83.3 – PAIR"], fatoresPsi: [3,5,6,12] },
  "12": { nome: "Fabricação de produtos do fumo",       cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["C34 – Neoplasia pulmão","M65 – Sinovite","J40 – Bronquite"], fatoresPsi: [3,5,6,12] },
  "13": { nome: "Fabricação de produtos têxteis",       cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","H83.3 – PAIR","L25 – Dermatite"], fatoresPsi: [3,5,6,12] },
  "14": { nome: "Confecção de artigos do vestuário",    cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","M54 – Dorsalgia"], fatoresPsi: [3,5,6,12] },
  "15": { nome: "Fabricação de couro e calçados",       cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","G54 – Síndromes radiculares"], fatoresPsi: [3,5,6,12] },
  "16": { nome: "Fabricação de prod. de madeira",       cidF: ["F32 – Episódio depressivo","F43 – Reações ao estresse"], cidOutros: ["M54 – Dorsalgia","S40-S49 – Traumatismo","H83.3 – PAIR"], fatoresPsi: [3,5,6,12] },
  "17": { nome: "Fabricação de celulose e papel",       cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","H83.3 – PAIR","L25 – Dermatite"], fatoresPsi: [3,5,6,12] },
  "18": { nome: "Impressão e reprodução",               cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","G54 – Síndromes radiculares"], fatoresPsi: [3,5,6,12] },
  "19": { nome: "Fabricação de coque e petróleo",       cidF: ["F32 – Episódio depressivo","F43.1 – TEPT"], cidOutros: ["L55 – Queimaduras solares ocupacionais","J68 – Pneumonite química","H83.3 – PAIR"], fatoresPsi: [3,5,6,2] },
  "20": { nome: "Fabricação de prod. químicos",         cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["J68 – Pneumonite química","L24 – Dermatite irritante","R60 – Edema de etiologia química"], fatoresPsi: [3,5,6,12] },
  "21": { nome: "Fabricação de prod. farmacêuticos",    cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","L24 – Dermatite irritante","J68 – Pneumonite"], fatoresPsi: [3,5,6,12] },
  "22": { nome: "Fabricação de prod. de borracha",      cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","H83.3 – PAIR","L24 – Dermatite"], fatoresPsi: [3,5,6,12] },
  "23": { nome: "Fabricação de prod. minerais não-metálicos", cidF: ["F32 – Episódio depressivo","F43 – Reações ao estresse"], cidOutros: ["J62 – Silicose","M54 – Dorsalgia","H83.3 – PAIR"], fatoresPsi: [3,5,6,12] },
  "24": { nome: "Metalurgia",                           cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","H83.3 – PAIR","T56 – Intoxicação por metais"], fatoresPsi: [3,5,6,12] },
  "25": { nome: "Fabricação de prod. de metal",         cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","S40-S49 – Traumatismo"], fatoresPsi: [3,5,6,12] },
  "26": { nome: "Fabricação de equipamentos de informática", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","G54 – Síndrome radicular"], fatoresPsi: [3,5,6,12] },
  "27": { nome: "Fabricação de máquinas e equipamentos elétricos", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","H83.3 – PAIR","S40-S49 – Traumatismo"], fatoresPsi: [3,5,6,12] },
  "28": { nome: "Fabricação de máquinas e equipamentos", cidF: ["F32 – Episódio depressivo","F43 – Reações ao estresse"], cidOutros: ["M65 – Sinovite","M54 – Dorsalgia","H83.3 – PAIR"], fatoresPsi: [3,5,6,12] },
  "29": { nome: "Fabricação de veículos automotores",   cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","H83.3 – PAIR"], fatoresPsi: [3,5,6,12] },
  "30": { nome: "Fabricação de outros equip. de transporte", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M54 – Dorsalgia","H83.3 – PAIR"], fatoresPsi: [3,5,6,12] },
  "31": { nome: "Fabricação de móveis",                 cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","H83.3 – PAIR"], fatoresPsi: [3,5,6,12] },
  "32": { nome: "Fabricação de prod. diversos",         cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","L25 – Dermatite"], fatoresPsi: [3,5,6,12] },
  "33": { nome: "Manutenção e reparação de máquinas",   cidF: ["F32 – Episódio depressivo","F43 – Reações ao estresse"], cidOutros: ["M65 – Sinovite","M54 – Dorsalgia","S40-S49 – Traumatismo"], fatoresPsi: [3,5,6,12] },
  "35": { nome: "Eletricidade, gás e outras utilidades", cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade"], cidOutros: ["Z57.5 – Estresse pelo calor","T75.0 – Relâmpago","M54 – Dorsalgia"], fatoresPsi: [3,5,6,2] },
  "36": { nome: "Captação, tratamento e distribuição de água", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["A06 – Amebíase","A09 – Infecção intestinal","M54 – Dorsalgia"], fatoresPsi: [3,5,6,2] },
  "37": { nome: "Esgoto e atividades relacionadas",     cidF: ["F32 – Episódio depressivo","F43 – Reações ao estresse"], cidOutros: ["A06 – Amebíase","Z57.5 – Estresse calor","M54 – Dorsalgia"], fatoresPsi: [3,6,2,12] },
  "38": { nome: "Coleta e tratamento de resíduos",      cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade"], cidOutros: ["M54 – Dorsalgia","A06 – Amebíase","S40-S49 – Traumatismo"], fatoresPsi: [3,6,2,12] },
  "39": { nome: "Descontaminação e gestão de resíduos", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["L24 – Dermatite irritante","T65 – Intoxicação substâncias"], fatoresPsi: [3,6,2,12] },
  "41": { nome: "Construção de edifícios",              cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade"], cidOutros: ["M54 – Dorsalgia","S40-S49 – Traumatismo ombro","H83.3 – PAIR","Z57.5 – Estresse calor"], fatoresPsi: [3,5,6,2] },
  "42": { nome: "Obras de infraestrutura",              cidF: ["F32 – Episódio depressivo","F43.1 – TEPT"], cidOutros: ["M54 – Dorsalgia","S40-S49 – Traumatismo","H83.3 – PAIR"], fatoresPsi: [3,5,6,2] },
  "43": { nome: "Serviços especializados p/ construção", cidF: ["F32 – Episódio depressivo","F43 – Reações ao estresse"], cidOutros: ["M54 – Dorsalgia","S40-S49 – Traumatismo","L25 – Dermatite"], fatoresPsi: [3,5,6,2] },
  "45": { nome: "Comércio e reparação de veículos",     cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F43 – Burnout/esgotamento"], cidOutros: ["M65 – Sinovite","L24 – Dermatite","T65 – Intoxicação"], fatoresPsi: [3,5,11,1] },
  "46": { nome: "Comércio atacadista",                  cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M54 – Dorsalgia","M65 – Sinovite","M70 – LER/DORT"], fatoresPsi: [3,5,11,1] },
  "47": { nome: "Comércio varejista",                   cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento","F43.1 – TEPT"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","M54 – Dorsalgia"], fatoresPsi: [3,5,11,1] },
  "49": { nome: "Transporte terrestre",                 cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade","F10 – Transt. uso álcool"], cidOutros: ["M54 – Dorsalgia","G54 – Sínd. radicular","Z57.5 – Estresse calor"], fatoresPsi: [3,5,6,2] },
  "50": { nome: "Transporte aquaviário",                cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F10 – Transt. uso álcool"], cidOutros: ["M54 – Dorsalgia","T75.1 – Afogamento","Z57.5 – Estresse calor"], fatoresPsi: [3,5,6,2] },
  "51": { nome: "Transporte aéreo",                     cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade","F51 – Transtornos do sono"], cidOutros: ["G47 – Distúrbios do sono","Z57.5 – Pressão/altitude","M54 – Dorsalgia"], fatoresPsi: [3,5,6,2] },
  "52": { nome: "Armazenagem e atividades auxiliares",  cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M54 – Dorsalgia","M65 – Sinovite","S40-S49 – Traumatismo"], fatoresPsi: [3,5,6,2] },
  "53": { nome: "Correio e outras atividades de entrega", cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade"], cidOutros: ["M54 – Dorsalgia","G54 – Sínd. radicular","S40-S49 – Traumatismo"], fatoresPsi: [3,5,6,2] },
  "55": { nome: "Alojamento",                           cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M54 – Dorsalgia","G47 – Distúrbios do sono"], fatoresPsi: [3,5,11,1] },
  "56": { nome: "Alimentação",                          cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","L25 – Dermatite","Z57.5 – Estresse calor"], fatoresPsi: [3,5,11,1] },
  "58": { nome: "Edição e impressão",                   cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","H52 – Distúrbios da refração"], fatoresPsi: [3,5,8,12] },
  "59": { nome: "Atividades cinematográficas e de vídeo", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","H52 – Distúrbios da refração","G47 – Distúrbios do sono"], fatoresPsi: [3,5,8,12] },
  "60": { nome: "Atividades de rádio e televisão",      cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F43.1 – TEPT"], cidOutros: ["G47 – Distúrbios do sono","H52 – Distúrbios refração","M65 – Sinovite"], fatoresPsi: [3,5,8,12] },
  "61": { nome: "Telecomunicações",                     cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento (call center)"], cidOutros: ["M65 – Sinovite","G47 – Distúrbios do sono","H83.3 – PAIR"], fatoresPsi: [3,5,8,12] },
  "62": { nome: "Atividades de tecnologia da informação", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Burnout/esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","H52 – Distúrbios refração","G47 – Distúrbios sono"], fatoresPsi: [3,5,8,12] },
  "63": { nome: "Atividades de prestação de serv. de informação", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","H52 – Distúrbios refração"], fatoresPsi: [3,5,8,12] },
  "64": { nome: "Atividades de serviços financeiros",   cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Burnout (call center)","F43.1 – TEPT"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","G47 – Distúrbios sono"], fatoresPsi: [3,5,9,10] },
  "65": { nome: "Seguros e previdência complementar",   cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","G47 – Distúrbios sono","M70 – LER/DORT"], fatoresPsi: [3,5,9,10] },
  "66": { nome: "Atividades auxiliares dos serv. financeiros", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","G47 – Distúrbios sono"], fatoresPsi: [3,5,9,10] },
  "68": { nome: "Atividades imobiliárias",              cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","G47 – Distúrbios sono"], fatoresPsi: [3,9,10,8] },
  "69": { nome: "Atividades jurídicas e de contabilidade", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Burnout"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","G47 – Distúrbios sono","H52 – Distúrbios refração"], fatoresPsi: [3,5,8,12] },
  "70": { nome: "Atividades de sedes e consultoria",    cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","G47 – Distúrbios sono","H52 – Distúrbios refração"], fatoresPsi: [3,5,8,12] },
  "71": { nome: "Atividades de arquitetura e engenharia", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","H52 – Distúrbios refração"], fatoresPsi: [3,5,8,12] },
  "72": { nome: "Pesquisa e desenvolvimento científico", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","G47 – Distúrbios sono","H52 – Distúrbios refração"], fatoresPsi: [3,5,8,12] },
  "73": { nome: "Publicidade e pesquisa de mercado",    cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","G47 – Distúrbios sono"], fatoresPsi: [3,5,8,12] },
  "74": { nome: "Outras atividades profissionais",      cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT"], fatoresPsi: [3,5,8,12] },
  "75": { nome: "Atividades veterinárias",              cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade"], cidOutros: ["B02 – Herpes zoster","A28.1 – Brucelose","M65 – Sinovite"], fatoresPsi: [3,5,6,2] },
  "77": { nome: "Alugueis e arrendamentos",             cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT"], fatoresPsi: [3,5,11,10] },
  "78": { nome: "Seleção, agenciamento e locação de mão-de-obra", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","G47 – Distúrbios sono"], fatoresPsi: [3,5,11,10] },
  "79": { nome: "Agências de viagem e operadores turísticos", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","G47 – Distúrbios sono"], fatoresPsi: [3,5,11,10] },
  "80": { nome: "Atividades de vigilância e segurança", cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade","F51 – Transt. do sono"], cidOutros: ["G47 – Distúrbios sono","M54 – Dorsalgia","Z57.5 – Estresse calor"], fatoresPsi: [1,2,3,12] },
  "81": { nome: "Serviços para edifícios e atividades paisagísticas", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M54 – Dorsalgia","L25 – Dermatite","Z57.5 – Estresse calor"], fatoresPsi: [3,5,6,11] },
  "82": { nome: "Atividades de escritório e apoio a negócios", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","G47 – Distúrbios sono"], fatoresPsi: [3,5,11,10] },
  "84": { nome: "Administração pública",                cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Burnout","F43.1 – TEPT"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","G47 – Distúrbios sono"], fatoresPsi: [3,5,1,8] },
  "85": { nome: "Educação",                             cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Burnout docente","F43.1 – TEPT"], cidOutros: ["J38 – Nódulos nas cordas vocais","M65 – Sinovite","G47 – Distúrbios sono"], fatoresPsi: [3,5,6,1] },
  "86": { nome: "Atividades de atenção à saúde humana", cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade","F48 – Burnout profissionais de saúde"], cidOutros: ["B20 – HIV","A33 – Tétano","G47 – Distúrbios sono","M65 – Sinovite"], fatoresPsi: [3,5,6,1,2] },
  "87": { nome: "Atividades de atenção à saúde residencial", cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade","F48 – Burnout"], cidOutros: ["M65 – Sinovite","M54 – Dorsalgia","G47 – Distúrbios sono"], fatoresPsi: [3,5,6,1,2] },
  "88": { nome: "Serviços sociais sem alojamento",      cidF: ["F32 – Episódio depressivo","F43.1 – TEPT","F41 – Ansiedade","F48 – Burnout"], cidOutros: ["M65 – Sinovite","M54 – Dorsalgia","G47 – Distúrbios sono"], fatoresPsi: [3,5,6,1,2] },
  "90": { nome: "Atividades artísticas e de espetáculo", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","G47 – Distúrbios sono","H83.3 – PAIR"], fatoresPsi: [3,9,11,8] },
  "91": { nome: "Atividades de bibliotecas e museus",   cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","H52 – Distúrbios refração"], fatoresPsi: [3,9,11,8] },
  "92": { nome: "Atividades de apostas e jogos de azar", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F63.0 – Jogo patológico"], cidOutros: ["G47 – Distúrbios sono","M65 – Sinovite"], fatoresPsi: [3,9,11,8] },
  "93": { nome: "Atividades esportivas e de recreação",  cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["M65 – Sinovite","S40-S49 – Traumatismo","H83.3 – PAIR"], fatoresPsi: [3,9,11,8] },
  "94": { nome: "Atividades de organizações associativas", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","G47 – Distúrbios sono"], fatoresPsi: [3,5,11,10] },
  "95": { nome: "Reparação de comput. e artigos pessoais", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["M65 – Sinovite","M70 – LER/DORT","L25 – Dermatite"], fatoresPsi: [3,5,6,11] },
  "96": { nome: "Outras atividades de serviços pessoais", cidF: ["F32 – Episódio depressivo","F41 – Ansiedade"], cidOutros: ["L25 – Dermatite","M65 – Sinovite","Z57.5 – Estresse calor"], fatoresPsi: [3,5,6,11] },
  "97": { nome: "Atividades domésticas",                cidF: ["F32 – Episódio depressivo","F43 – Reações ao estresse"], cidOutros: ["M54 – Dorsalgia","M65 – Sinovite","Z57.5 – Estresse calor"], fatoresPsi: [3,4] },
  "99": { nome: "Organismos internacionais",            cidF: ["F32 – Episódio depressivo","F41 – Ansiedade","F48 – Esgotamento"], cidOutros: ["G47 – Distúrbios sono","M65 – Sinovite"], fatoresPsi: [3,5,8,10] },
};

function getCnaeDados(cnaeStr) {
  if (!cnaeStr) return null;
  const digits = cnaeStr.replace(/\D/g, '');
  if (digits.length < 2) return null;
  const secao = digits.substring(0, 2);
  return CNAE_NTEP_FULL[secao] || null;
}
// Compat shim para uso legado (Eixos II/III/IV badge)
function getFatoresByCnae(cnaeStr) {
  const d = getCnaeDados(cnaeStr);
  return d ? d.fatoresPsi : null;
}

// P é determinado pela convergência dos 4 eixos analíticos (Tetra-angulação de Evidências):
// P1 = evidência em apenas 1 eixo ou ocorrência excepcional
// P2 = validado por 2 eixos, situações específicas
// P3 = recorrente, confirmado por dados e relatos consistentes (≥2 eixos + frequência)
// P4 = onipresente no fluxo, convergência total dos 4 eixos analíticos
const probLabels = { 1: "P1 – Rara (1 eixo)", 2: "P2 – Ocasional (2 eixos)", 3: "P3 – Frequente (≥2 eixos + recorrência)", 4: "P4 – Contínua (4 eixos convergentes)" };
const sevLabels  = { 1: "S1 – Baixa", 2: "S2 – Moderada", 3: "S3 – Grave", 4: "S4 – Crítica" };

// Classificação conforme artigo de referência (Tetra-angulação de Evidências):
// Baixo (1-4): monitoramento | Moderado (6-9): planejar ações | Crítico (12-16): intervenção imediata
// NR = S × P. Valores 5, 10, 11 não ocorrem na matriz 4×4 com S e P inteiros.
function riskLevel(p, s) {
  const v = p * s;
  if (v >= 12) return { label: "CRÍTICO",  color: "#7f1d1d", bg: "#fef2f2" };
  if (v >= 6)  return { label: "MODERADO", color: "#92400e", bg: "#fffbeb" };
  return         { label: "BAIXO",    color: "#14532d", bg: "#f0fdf4" };
}

const initAnexo1 = {
  afastamentosINSS: "", cidGrupoF: "nao", cidGrupoFDetalhe: "",
  catMental: "nao", catQtd: "",
  absenteismo: "", turnover: "", horasExtras: "",
  assedioDenuncia: "nao", respondente: "", cargo: "", data: "",
};

const initAnexo2a = () => FATORES.reduce((acc, f) => ({ ...acc, [`f${f.id}_grau`]: 0, [`f${f.id}_evidencia`]: "" }), {});
const initAnexo2b = () => FATORES.reduce((acc, f) => ({ ...acc, [`f${f.id}_pratica`]: "" }), {});
const initAnexo3  = () => FATORES.reduce((acc, f) => ({ ...acc, [`f${f.id}_valida`]: "" }), {
  tipoRepresentante: "", setor: "", data: "", comentarios: "",
});
const initAnexo4 = {
  empresa: "", cnpj: "", ghe: "", data: "",
  parecer: "", ressalvas: "",
  rep1nome: "", rep1cpf: "", rep1criterio: "",
  rep2nome: "", rep2cpf: "", rep2criterio: "",
  cipa: "", cipacpf: "",
  tecnico: "", tecnicoReg: "",
};
const initIdent = {
  razaoSocial: "", cnpj: "", cnae: "", grauRisco: "", endereco: "",
  setor: "", dataInspecao: "", responsavel: "", tecnicoReg: "", dataRelatorio: "",
};
const initRisk = () => FATORES.reduce((acc, f) => ({ ...acc, [`f${f.id}_p`]: 0, [`f${f.id}_s`]: 0 }), {});

// Ações padrão por nível de risco e fator
// Ações específicas por fator (baseadas no Plano de Ação AEP – AMBRAC/Wenlla Lima, nov/2025)
// Estrutura: ACOES_POR_FATOR[fatorId][nivel] = [{ tipo, prazo, complexidade, acao, treinamento }]
const ACOES_POR_FATOR = {
  // F1 – Assédio de Qualquer Natureza no Trabalho
  1: {
    "BAIXO": [
      { tipo: "Normativo", prazo: "Imediato", complexidade: "Baixa", responsavel: "", acao: "Definição de Política de Zero Tolerância ao Assédio/Violência com publicação formal." },
      { tipo: "Orientação", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Criação de Canais de Orientação: informar onde o trabalhador pode buscar ajuda." },
      { tipo: "Educativo", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Campanhas Educativas: cartazes e comunicações digitais sobre assédio, dignidade e respeito." },
    ],
    "MODERADO": [
      { tipo: "Comitê", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Comitê de Ética e Conduta: instância mista para julgar e recomendar ações em casos de assédio." },
      { tipo: "Suporte à Vítima", prazo: "Imediato", complexidade: "Alta", responsavel: "", acao: "Apoio Psicológico/Jurídico: oferecer suporte imediato e sigiloso às vítimas." },
      { tipo: "Expressão/Suporte", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Teatro fórum de assédio e intervenção do observador: dramatizações de situações de humilhação, treinando a equipe a intervir de forma segura." },
      { tipo: "Compliance", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Certificação Externa em Compliance e Boas Práticas de combate ao assédio." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata/Legal", prazo: "Imediato", complexidade: "Alta", responsavel: "", acao: "URGENTE: afastar o agressor imediatamente. Acionar RH, Jurídico, SESMT e Psicólogo. Registrar ocorrência e instaurar processo disciplinar." },
      { tipo: "PCMSO", prazo: "Imediato", complexidade: "Alta", responsavel: "", acao: "Encaminhamento imediato da vítima ao Médico do Trabalho e Psicólogo. Avaliação de todos os integrantes do GHE (SRQ-20)." },
    ],
  },
  // F2 – Eventos Violentos ou Traumáticos
  2: {
    "BAIXO": [
      { tipo: "Segurança", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Procedimentos de Segurança: divulgar e treinar o protocolo de acionamento de emergência." },
      { tipo: "Suporte", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Reforço de Apoio Imediato: divulgar protocolo de apoio psicológico pós-incidente." },
      { tipo: "Comunicação", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Comunicação de Protocolos: divulgar canais de denúncia e acionamento de emergência." },
    ],
    "MODERADO": [
      { tipo: "Ergonômico/Estrutural", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Revisão Ergonômica dos Postos Críticos: revisão estrutural do ambiente e dispositivos para melhor proteção física." },
      { tipo: "Segurança Pública", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Parceria com Autoridades: criação de canal direto com polícia ou guarda municipal." },
      { tipo: "PCMSO", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Programa de Saúde Mental Ocupacional: integração de suporte psicológico imediato na rotina do PCMSO." },
      { tipo: "Dinâmicas/Crise", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Simulação de gerenciamento de crise: role-playing prático de como lidar com agressões verbais ou ameaças com técnicas de desescalonamento." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata", prazo: "Imediato", complexidade: "Alta", responsavel: "", acao: "URGENTE: acionar SESMT, Médico do Trabalho e Psicólogo imediatamente. Afastar trabalhadores expostos. Registrar ocorrência." },
      { tipo: "PCMSO", prazo: "Imediato", complexidade: "Alta", responsavel: "", acao: "Avaliação psicossocial emergencial (SRQ-20 / TEPT) para todos os integrantes do GHE expostos ao evento." },
    ],
  },
  // F3 – Excesso de Demandas no Trabalho
  3: {
    "BAIXO": [
      { tipo: "Ergonomia/Movimento", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Auditoria de Pausas: monitorar o cumprimento das pausas obrigatórias (NR-17)." },
      { tipo: "Preventiva", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Alinhamento de Metas: comunicar metas realistas e alcançáveis às equipes." },
      { tipo: "Ergonomia/Movimento", prazo: "Imediato", complexidade: "Baixa", responsavel: "", acao: "Ginástica laboral: alongamentos rápidos realizados durante as pausas programadas." },
    ],
    "MODERADO": [
      { tipo: "RH/Estrutural", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Aumento de Quadro: avaliar e executar contratação de trabalhadores para redistribuição da carga." },
      { tipo: "Saúde", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Programa de Apoio à Saúde: oferecer suporte nutricional, psicológico e físico (massoterapia rápida de 15–20 min priorizando setores com maior sobrecarga)." },
      { tipo: "Treinamento – Chefia Superior", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Treinamento em Gestão Estratégica e planejamento de Recursos Humanos; Implantação de Comitê de Ergonomia com foco nos riscos psicossociais." },
      { tipo: "Treinamento – Chefia Intermediária", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Treinamento avançado em Gestão de Conflitos decorrentes de sobrecarga; Desenvolvimento de Plano de Carreira para a equipe operacional." },
      { tipo: "Treinamento – Operacional", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Redesenho de Cargos: reavaliar atribuições para redistribuir a carga. Treinamento sobre Atenção Plena (Mindfulness) para lidar com pressão." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata/Estrutural", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Redesenho de Cargos urgente e aumento emergencial de quadro. Notificar SESMT e CIPA imediatamente." },
      { tipo: "Cultura Organizacional", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Implementação de Cultura de Trabalho Saudável (programa de longo prazo) com suporte da Chefia Superior." },
      { tipo: "PCMSO", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Convocar avaliação psicossocial (SRQ-20) para todos os integrantes do GHE. Encaminhamento ao Médico do Trabalho." },
    ],
  },
  // F4 – Baixa Demanda no Trabalho (Subcarga)
  4: {
    "BAIXO": [
      { tipo: "Organizacional", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Rodízio Simples: estabelecer rodízio entre tarefas rotineiras e de menor demanda." },
      { tipo: "Processo", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Banco de Tarefas: criar lista de tarefas secundárias para períodos de inatividade." },
      { tipo: "Comunicação", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Comunicação de Objetivos: clarear o objetivo e propósito da tarefa monótona para o trabalhador." },
      { tipo: "Inovação/Habilidade", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Banco de ideias de inovação: o operacional usa períodos de baixa demanda para propor soluções implementáveis em ciclo de 30 dias com autonomia." },
    ],
    "MODERADO": [
      { tipo: "Estrutural/RH", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Job Enrichment: enriquecimento vertical com maior responsabilidade e autonomia para o trabalhador." },
      { tipo: "Equipes", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Criação de Equipes Multidisciplinares: envolvimento em projetos de diferentes áreas da empresa." },
      { tipo: "Desenvolvimento", prazo: "120 dias", complexidade: "Alta", responsavel: "", acao: "Ações de Qualificação: apoio financeiro para cursos fora do escopo imediato da função." },
      { tipo: "Cultura/Propósito", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Programa mentor reversa em tecnologia: colaboradores operacionais ensinam novas habilidades práticas/tecnológicas para a chefia ou colegas — aumenta o significado do trabalho." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata/Estrutural", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Redesenho emergencial do cargo e redistribuição de atribuições. Notificar SESMT e RH." },
      { tipo: "PCMSO", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Avaliação psicossocial (SRQ-20) para todos; encaminhamento ao Médico do Trabalho (risco de F10-F19 – uso de substâncias por tédio crônico)." },
    ],
  },
// F5 – Baixo Controle no Trabalho / Falta de Autonomia
  5: {
    "BAIXO": [
      { tipo: "Organizacional", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Flexibilização de Detalhes: permitir escolhas em aspectos não críticos da rotina de trabalho." },
      { tipo: "Participação", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Criação de Canais de Sugestão: pedir inputs da equipe sobre como otimizar o trabalho." },
      { tipo: "Participação/Controle", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Mini-comitê de planejamento operacional: grupos rotativos do operacional que se reúnem com a chefia para ajustar as regras da rotina." },
    ],
    "MODERADO": [
      { tipo: "Estrutural/RH", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Job Enrichment: concessão de autonomia para tomada de decisão em situações críticas." },
      { tipo: "Organizacional", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Desenvolvimento de Checklists: dar autonomia na ordem de execução, respeitando checkpoints de segurança." },
      { tipo: "Organizacional", prazo: "120 dias", complexidade: "Alta", responsavel: "", acao: "Implementar Job Rotation Planejado: trabalhar em diferentes áreas da empresa." },
      { tipo: "Treinamento – Chefia Superior", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Revisão da Estrutura de Poder e cadeia de comando. Treinamento em Cultura de Segurança Psicológica (permitir erros em busca de autonomia)." },
      { tipo: "Treinamento – Chefia Intermediária", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Treinamento avançado em Gestão de Equipes Autônomas e de alto desempenho. Curso sobre Habilidades de Coaching para apoiar a autogestão." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Revisão emergencial da estrutura de controle. Garantir que normas — e não o humor da chefia — definam o ritmo. Notificar SESMT." },
      { tipo: "PCMSO", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Avaliação psicossocial imediata (SRQ-20) para todos os integrantes do GHE." },
    ],
  },
  // F6 – Falta de Suporte / Apoio no Trabalho
  6: {
    "BAIXO": [
      { tipo: "Estrutural", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Criação de Canais de Escuta: implementar reuniões de check-in semanais de 10 min." },
      { tipo: "Organizacional", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Definição de Padrinho/Madrinha: designar colegas experientes para apoiar novatos." },
      { tipo: "Tecnologia", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Plataforma de Dúvidas: criar canal digital para tirar dúvidas operacionais rápidas." },
      { tipo: "Suporte Estruturado", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Rede de consultores técnicos internos: selecionar e treinar colaboradores experientes como fontes de informação reconhecidas." },
    ],
    "MODERADO": [
      { tipo: "Mentoria", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Programa de Mentoria Formal: desenvolver estrutura de mentoria de longo prazo." },
      { tipo: "Comitê", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Criação de Comitê de Crise/Apoio composto por RH, Segurança e Liderança." },
      { tipo: "Estrutural/RH", prazo: "120 dias", complexidade: "Alta", responsavel: "", acao: "Revisão da Estrutura: reduzir o span of control do chefe para que ele possa dar mais atenção a cada colaborador." },
      { tipo: "Treinamento – Chefia Superior", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Implementação de Cultura de Liderança acessível e suportiva. Módulo de liderança acessível: treinamento para a liderança observar a realidade do posto e oferecer suporte imediato visível." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Acolhimento pós-trauma emergencial: ativar protocolo de apoio psicológico imediato para todos os integrantes do GHE. Notificar SESMT." },
      { tipo: "PCMSO", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Avaliação psicossocial (SRQ-20) e encaminhamento ao Médico do Trabalho e/ou Psicólogo." },
    ],
  },
  // F7 – Má Gestão de Mudanças Organizacionais
  7: {
    "BAIXO": [
      { tipo: "Comunicação", prazo: "Imediato", complexidade: "Baixa", responsavel: "", acao: "Calendário de Comunicação: informar a equipe com antecedência sobre todas as mudanças previstas." },
      { tipo: "Documentação", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Criação de FAQs: documento de Perguntas Frequentes sobre as mudanças em andamento." },
      { tipo: "Organizacional", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Ponto Focal de Dúvidas: definir uma pessoa da chefia para tirar dúvidas sobre a mudança." },
    ],
    "MODERADO": [
      { tipo: "Estrutural/RH", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Revisão de Funções/Cargos: se a mudança for estrutural, revisar a descrição de cargo." },
      { tipo: "Suporte", prazo: "Durante a mudança", complexidade: "Alta", responsavel: "", acao: "Treinamento On-the-Job: garantir suporte prático durante a execução da nova rotina." },
      { tipo: "Comitê", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Criação de Comitê de Mudança: grupo misto que planeja, executa e acompanha a mudança." },
      { tipo: "Suporte/Treinamento", prazo: "30 dias", complexidade: "Média", responsavel: "", acao: "Plantão do Embaixador: turnos onde Embaixadores da Mudança ficam disponíveis para dar suporte prático e imediato durante a nova rotina." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Suspender a mudança até elaboração de plano de comunicação e suporte adequado. Reunião emergencial com SESMT e liderança." },
      { tipo: "PCMSO", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Avaliação psicossocial (SRQ-20) para todos os integrantes; encaminhamento ao Médico do Trabalho." },
    ],
  },
  // F8 – Baixa Clareza de Papel / Função
  8: {
    "BAIXO": [
      { tipo: "Documentação", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Criação de Descrições de Cargo: documentar as responsabilidades básicas de cada função." },
      { tipo: "Comunicação", prazo: "Imediato", complexidade: "Baixa", responsavel: "", acao: "Reuniões de Alinhamento: sessões rápidas semanais para garantir que todos entendam a meta da semana e o papel de cada um." },
      { tipo: "Processo", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Mapeamento de Processos: desenhar o fluxo de trabalho para visualizar o papel de cada função." },
      { tipo: "Transparência/Processo", prazo: "Imediato", complexidade: "Baixa", responsavel: "", acao: "Clareza de 5 minutos: agenda semanal obrigatória para revisão e explicação das metas da semana e o papel de cada um." },
    ],
    "MODERADO": [
      { tipo: "Estrutural/RH", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Reengenharia de Cargos: reestruturação profunda das funções para maior clareza de papel e responsabilidade." },
      { tipo: "Conhecimento", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Sistema de Gestão do Conhecimento: centralizar documentação e POPs." },
      { tipo: "Desenvolvimento/Habilidade", prazo: "60 dias", complexidade: "Média", responsavel: "", acao: "Troca de chapéus estruturada: membros da equipe de diferentes funções passam tempo em observação no setor do colega para entender as responsabilidades mútuas." },
      { tipo: "Treinamento – Chefia Superior", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Treinamento em Design Organizacional e gestão de performance. Formação em Governança Corporativa e transparência." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Publicar descrições de cargo emergenciais e reunião obrigatória de alinhamento de papéis com toda a equipe do GHE. Notificar SESMT." },
      { tipo: "PCMSO", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Avaliação psicossocial (SRQ-20) para todos os integrantes; encaminhamento ao Médico do Trabalho." },
    ],
  },
  // F9 – Baixas Recompensas e Reconhecimento
  9: {
    "BAIXO": [
      { tipo: "Reconhecimento", prazo: "Imediato", complexidade: "Baixa", responsavel: "", acao: "Reconhecimento Imediato: incentivar elogios verbais e escritos simples no dia a dia (O Elogio de 1 minuto)." },
      { tipo: "Cultura", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Mural de Reconhecimento: criar espaço físico ou digital para destacar conquistas da equipe." },
      { tipo: "Reconhecimento", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Reuniões de Celebração: dedicar 5 minutos de uma reunião para celebrar um sucesso coletivo." },
    ],
    "MODERADO": [
      { tipo: "Remuneração", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Remuneração Variável: bônus e participação nos lucros atrelados ao desempenho." },
      { tipo: "Desenvolvimento", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Programas de Desenvolvimento: investimento em cursos e certificações para o trabalhador." },
      { tipo: "Carreira", prazo: "120 dias", complexidade: "Alta", responsavel: "", acao: "Criação de Fast-Track: caminhos rápidos para progressão de carreira por mérito, especialmente para especialistas técnicos operacionais." },
      { tipo: "Treinamento – Chefia Superior", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Revisão da Cultura Organizacional para incluir a gratidão e o reconhecimento. Treinamento em Gestão de Performance de alto nível." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Revisão salarial emergencial e implantação imediata de programa de reconhecimento. Notificar SESMT e RH." },
      { tipo: "PCMSO", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Avaliação psicossocial (SRQ-20) para todos; encaminhamento de casos de Burnout ao Médico do Trabalho." },
    ],
  },
  // F10 – Baixa Justiça Organizacional
  10: {
    "BAIXO": [
      { tipo: "Transparência", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Transparência de Regras: divulgar e explicar as regras e políticas de forma clara para toda a equipe." },
      { tipo: "Organizacional", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Critérios de Distribuição: definir e divulgar critérios objetivos para distribuir tarefas e oportunidades." },
      { tipo: "Participação", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Criação de Canais de Consulta: permitir que a equipe tire dúvidas sobre regras e questione distribuições." },
    ],
    "MODERADO": [
      { tipo: "Ombudsman", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Implementação de Ombudsman: profissional neutro para lidar com queixas de injustiça." },
      { tipo: "Auditoria", prazo: "120 dias", complexidade: "Alta", responsavel: "", acao: "Auditoria de Processos: auditoria externa para validar a justiça dos processos de RH." },
      { tipo: "Comitê", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Comitê de Ética e Justiça composto por representantes de todos os níveis hierárquicos." },
      { tipo: "Transparência/Processo", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Consulta aberta de regras: canal para a equipe questionar a distribuição de tarefas; chefia responde publicamente sobre o porquê das decisões." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Revisão emergencial dos processos de RH (promoção, seleção, distribuição). Notificar SESMT e Comitê de Ética." },
      { tipo: "PCMSO", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Avaliação psicossocial (SRQ-20) para todos; encaminhamento ao Médico do Trabalho." },
    ],
  },
  // F11 – Maus Relacionamentos no Local de Trabalho
  11: {
    "BAIXO": [
      { tipo: "Ambiental", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Criação de Espaços Neutros: salas de descompressão ou café para interação informal entre colegas." },
      { tipo: "Normativo", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Normas de Convivência: definir e divulgar código de conduta básico para o GHE." },
      { tipo: "Cultura/Prevenção", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Círculo de respeito e limites: dinâmica mediada por RH/Psicólogo para que membros da equipe expressem necessidades e limites de forma segura." },
    ],
    "MODERADO": [
      { tipo: "Mediação Externa", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Programa de Mediação Profissional: contratação de mediadores externos para conflitos graves." },
      { tipo: "Canal de Denúncia", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Implantação de Canal de Denúncia: garantia de anonimato e confidencialidade para relatos de conflito." },
      { tipo: "Individual", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Coaching Individual para líderes e funcionários envolvidos em conflitos graves." },
      { tipo: "Estrutura/Apoio", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Eventos de integração focados em cooperação: uso de jogos e dinâmicas que exigem cooperação intersetorial." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Afastar as partes em conflito do mesmo espaço/turno imediatamente. Acionar RH, SESMT e Psicólogo." },
      { tipo: "PCMSO", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Avaliação psicossocial (SRQ-20) para todos os integrantes do GHE; encaminhamento ao Médico do Trabalho." },
    ],
  },
  // F12 – Trabalho em Condições de Difícil Comunicação
  12: {
    "BAIXO": [
      { tipo: "Ambiental", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Revisão de Layout: garantir proximidade dos postos de trabalho para facilitar o contato." },
      { tipo: "Processo", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Checklist de Informação: garantir que toda informação crucial seja transmitida e confirmada." },
      { tipo: "Documentação", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Atualização de Contatos: garantir que todos os telefones e e-mails estejam corretos e acessíveis." },
      { tipo: "Ergonomia/Comunicação", prazo: "30 dias", complexidade: "Baixa", responsavel: "", acao: "Glossário de comunicação e checklist de informação: fixar nos postos um glossário de termos técnicos e checklists da informação crucial a ser transmitida." },
    ],
    "MODERADO": [
      { tipo: "Processo/Estrutural", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Revisão de Processos Críticos: redesenhar processos que dependem de comunicação com alto índice de falha." },
      { tipo: "Emergência", prazo: "60 dias", complexidade: "Alta", responsavel: "", acao: "Sistema de Comunicação de Emergência: garantir canal de emergência em caso de falha da comunicação principal." },
      { tipo: "UX/Tecnologia", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Investimento em Design de Interface: tornar sistemas mais intuitivos (Ergonomia Cognitiva) e informação mais clara." },
      { tipo: "Tecnologia/Procedimento", prazo: "90 dias", complexidade: "Alta", responsavel: "", acao: "Garantir que informações cruciais sejam registradas em logbooks/relatórios para rastreabilidade e Ergonomia Cognitiva." },
    ],
    "CRÍTICO": [
      { tipo: "Imediata", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Implementar protocolo emergencial de comunicação alternativa. Notificar SESMT. Interditar processos críticos que dependam de comunicação falha." },
      { tipo: "PCMSO", prazo: "30 dias", complexidade: "Alta", responsavel: "", acao: "Avaliação psicossocial (SRQ-20) para todos os integrantes; encaminhamento ao Médico do Trabalho." },
    ],
  },
};

const initAcoes = () => FATORES.reduce((acc, f) => ({
  ...acc,
  [`f${f.id}_acoes`]: [], // Empty initially; auto-populated when risk is calculated
}), {});

const createGHE = (nome = "") => ({
  id: Date.now() + Math.random(),
  nome: nome,
  setor: "",
  a1: { ...initAnexo1 },
  a2a: initAnexo2a(),
  a2b: initAnexo2b(),
  a3: initAnexo3(),
  a4: { ...initAnexo4 },
  risk: initRisk(),
  acoes: initAcoes(),
  termos: [], // [{ name, type, data, uploadedAt }]
});

// ─── helpers ─────────────────────────────────────────────────────────────────

function Field({ label, children }) {
  return (
    <div style={{ marginBottom: 12 }}>
      <label style={{ display: "block", fontSize: 11, fontWeight: 700, color: "#334155", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</label>
      {children}
    </div>
  );
}
function Input({ value, onChange, placeholder, type = "text" }) {
  return <input type={type} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder}
    style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 13, background: "#fff", boxSizing: "border-box", outline: "none" }} />;
}
function Select({ value, onChange, options }) {
  return (
    <select value={value} onChange={e => onChange(e.target.value)}
      style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 13, background: "#fff", boxSizing: "border-box" }}>
      {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}
function Radio({ value, onChange, options, name }) {
  return (
    <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
      {options.map(o => (
        <label key={o.value} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}>
          <input type="radio" name={name} value={o.value} checked={value === o.value} onChange={() => onChange(o.value)} />
          {o.label}
        </label>
      ))}
    </div>
  );
}
function Textarea({ value, onChange, placeholder, rows = 2 }) {
  return <textarea value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} rows={rows}
    style={{ width: "100%", padding: "8px 10px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 13, background: "#fff", boxSizing: "border-box", resize: "vertical" }} />;
}

// ─── Abas ────────────────────────────────────────────────────────────────────

const TABS = [
  "Identificação",
  "Eixo I – Epidemiológico",
  "Eixo II – Trabalho Prescrito",
  "Eixo III – Observação In Loco",
  "Eixo IV – Representantes",
  "Anexo V – Consentimento",
  "Cálculo de Risco",
  "📋 Plano de Ação",
  "📎 Termos Assinados",
  "📄 Relatório",
];

export default function App() {
  const [tab, setTab] = useState(0);
  const [ident, setIdent] = useState(initIdent);
  const [showNtepOutros, setShowNtepOutros] = useState(false);
  // Multi-GHE state
  const [ghes, setGhes] = useState([createGHE("GHE 1")]);
  const [activeGHE, setActiveGHE] = useState(0);

  // Upload inteligente — estados movidos para o topo do componente (corrige violação de Rules of Hooks)
  const [uploadState, setUploadState] = useState("idle"); // idle | loading | done | error | applied
  const [uploadMsg, setUploadMsg] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [extractedPreview, setExtractedPreview] = useState(null);

  // Helpers to get/set current GHE data
  const ghe = ghes[activeGHE] || ghes[0];
  const a1 = ghe.a1;
  const a2a = ghe.a2a;
  const a2b = ghe.a2b;
  const a3 = ghe.a3;
  const a4 = ghe.a4;
  const risk = ghe.risk;

  const updateGHE = (field) => (val) => {
    setGhes(prev => prev.map((g, i) => i === activeGHE ? { ...g, [field]: val } : g));
  };

  const setField = (field) => (key) => (val) => {
    setGhes(prev => prev.map((g, i) => i === activeGHE ? { ...g, [field]: { ...g[field], [key]: val } } : g));
  };
  const si = setField("setIdent_unused"); // ident is global (empresa)
  const siGlobal = (key) => (val) => setIdent(prev => ({ ...prev, [key]: val }));
  const s1 = setField("a1");
  const s2a = setField("a2a");
  const s2b = setField("a2b");
  const s3 = setField("a3");
  const s4 = setField("a4");
  const sr = setField("risk");

  // Atualiza um campo de risco (P ou S) e, se tanto P quanto S estiverem preenchidos,
  // gera as ações automaticamente para esse fator (sem sobrescrever ações customizadas)
  // Atualiza P manualmente. S é sempre fixo (sevBase do fator — propriedade clínica intrínseca).
  // Ao definir P, S é automaticamente gravado no state como sevBase para consistência.
  const setRiskField = (fid, psKey) => (val) => {
    const numVal = Number(val);
    const fator = FATORES.find(f => f.id === fid);
    setGhes(prev => prev.map((g, i) => {
      if (i !== activeGHE) return g;
      // P vem do select; S é sempre o sevBase clínico do fator
      const p = psKey === "p" ? numVal : (g.risk[`f${fid}_p`] || 0);
      const s = fator.sevBase; // S fixo — nunca alterado pelo usuário
      const newRisk = { ...g.risk, [`f${fid}_p`]: p, [`f${fid}_s`]: s };
      const newAcoes = { ...g.acoes };
      const key = `f${fid}_acoes`;
      const current = g.acoes[key] || [];
      const allAuto = current.length === 0 || current.every(a => !a._customized);
      if (p > 0 && allAuto) {
        const rl = riskLevel(p, s);
        const fatAcoes = ACOES_POR_FATOR[fid];
        const nivelAcoes = fatAcoes ? (fatAcoes[rl.label] || []) : [];
        newAcoes[key] = nivelAcoes.map(a => ({ ...a, _customized: false }));
      } else if (p === 0 && allAuto) {
        newAcoes[key] = [];
      }
      return { ...g, risk: newRisk, acoes: newAcoes };
    }));
  };

  // Ações helpers
  const updateAcaoField = (fid, aIdx, field) => (val) => {
    setGhes(prev => prev.map((g, i) => {
      if (i !== activeGHE) return g;
      const key = `f${fid}_acoes`;
      const acoes = [...(g.acoes[key] || [])];
      acoes[aIdx] = { ...acoes[aIdx], [field]: val, _customized: true };
      return { ...g, acoes: { ...g.acoes, [key]: acoes } };
    }));
  };

  const addAcao = (fid) => {
    setGhes(prev => prev.map((g, i) => {
      if (i !== activeGHE) return g;
      const key = `f${fid}_acoes`;
      const acoes = [...(g.acoes[key] || []), { tipo: "Preventiva", prazo: "", responsavel: "", acao: "" }];
      return { ...g, acoes: { ...g.acoes, [key]: acoes } };
    }));
  };

  const removeAcao = (fid, aIdx) => {
    setGhes(prev => prev.map((g, i) => {
      if (i !== activeGHE) return g;
      const key = `f${fid}_acoes`;
      const acoes = (g.acoes[key] || []).filter((_, j) => j !== aIdx);
      return { ...g, acoes: { ...g.acoes, [key]: acoes } };
    }));
  };

  // Auto-populate actions based on risk level when calcRisk is run
  const syncAcoesByRisk = (gheIdx, riskData) => {
    setGhes(prev => prev.map((g, i) => {
      if (i !== gheIdx) return g;
      const newAcoes = { ...g.acoes };
      FATORES.forEach(f => {
        const p = riskData[`f${f.id}_p`] || 0;
        const s = riskData[`f${f.id}_s`] || 0;
        if (p && s) {
          const rl = riskLevel(p, s);
          const key = `f${f.id}_acoes`;
          if (!g.acoes[key] || g.acoes[key].length === 0) {
            const fatAcoes = ACOES_POR_FATOR[f.id];
            const nivelAcoes = fatAcoes ? (fatAcoes[rl.label] || []) : [];
            newAcoes[key] = nivelAcoes.map(a => ({ ...a, _customized: false }));
          }
        }
      });
      return { ...g, acoes: newAcoes };
    }));
  };

  // Termos (consent file uploads)
  const addTermo = (file) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const termo = { name: file.name, type: file.type, data: e.target.result, uploadedAt: new Date().toLocaleString("pt-BR") };
      setGhes(prev => prev.map((g, i) => i === activeGHE ? { ...g, termos: [...(g.termos || []), termo] } : g));
    };
    reader.readAsDataURL(file);
  };

  const removeTermo = (tIdx) => {
    setGhes(prev => prev.map((g, i) => i === activeGHE ? { ...g, termos: (g.termos || []).filter((_, j) => j !== tIdx) } : g));
  };

  const addGHE = () => {
    const newGHE = createGHE(`GHE ${ghes.length + 1}`);
    setGhes(prev => [...prev, newGHE]);
    setActiveGHE(ghes.length);
  };

  const removeGHE = (idx) => {
    if (ghes.length === 1) return;
    setGhes(prev => prev.filter((_, i) => i !== idx));
    setActiveGHE(prev => Math.min(prev, ghes.length - 2));
  };

  // ─── TRIANGULAÇÃO DE EVIDÊNCIAS — Cálculo de P pela convergência dos 4 Eixos ──
  //
  // Ref: "Tetra-angulação de Evidências em Macroergonomia" (artigo de referência AEP)
  //
  // S (Severidade) = FIXA por fator — magnitude clínica do agravo potencial
  //   definida na tabela do Guia SIT/ENIT (CID-11 / NTEP / Decreto 3.048/1999).
  //   NÃO depende de dados históricos da empresa. Definida em FATORES[].sevBase.
  //
  // P (Probabilidade) = determinada pela CONVERGÊNCIA dos 3 Eixos analíticos:
  //   P1 – Rara:     evidência em apenas 1 eixo ou ocorrência excepcional
  //   P2 – Ocasional: estressor surge em situações específicas, validado por 2 eixos
  //   P3 – Frequente: recorrente na rotina, confirmado por dados e relatos consistentes
  //   P4 – Contínua:  onipresente no fluxo, com convergência total nos 4 eixos analíticos
  //
  // Eixo I  — Indicadores epidemiológicos e de gestão (Anexo I / RH / SESMT)
  //           Afastamentos INSS, CIDs Grupo F, CATs, absenteísmo, turnover, CNAE/NTEP
  // Eixo II — Análise da realidade laboral in loco (Anexo II-A / II-B)
  //           Grau de exposição observado + discrepância trabalho prescrito x real
  // Eixo III— Validação qualitativa participativa (Anexo III)
  //           Relato de representantes do GHE, coletado de forma independente e sigilosa
  //
  // Pareamento de padrões (Yin, 2015): convergência entre eixos isola o efeito
  // Spillover e valida o risco como sistêmico/organizacional.
  //
  function calcInteligente(fid, gData) {
    const fator   = FATORES.find(f => f.id === fid);
    const a2aData = gData.a2a;
    const a3Data  = gData.a3;
    const a1Data  = gData.a1;

    const grau   = Number(a2aData[`f${fid}_grau`]) || 0;
    const valida = a3Data[`f${fid}_valida`]; // "confirma" | "nega" | ""

    // S é FIXO — propriedade clínica intrínseca (tabela Guia SIT/ENIT, artigo p.5-6)
    const s = fator.sevBase;

    // Grau 0 = fator não identificado na inspeção → P não avaliado
    if (grau === 0) return { p: 0, s: 0 };

    // ── Eixo I: Indicadores epidemiológicos de gestão ─────────────────────────
    const afastamentos   = Number(a1Data.afastamentosINSS) || 0;
    const temCAT         = a1Data.catMental === "sim";
    const temCIDGrupoF   = a1Data.cidGrupoF === "sim";
    const absenteismo    = parseFloat(a1Data.absenteismo) || 0;
    const turnover       = parseFloat(a1Data.turnover) || 0;
    // Eixo I é positivo se há qualquer evidência epidemiológica objetiva
    const eixo1_positivo = afastamentos > 0 || temCAT || temCIDGrupoF || absenteismo > 3 || turnover > 20;
    // Eixo I é forte se múltiplos indicadores convergem
    const eixo1_forte    = (afastamentos > 0 ? 1 : 0) + (temCAT ? 1 : 0) + (temCIDGrupoF ? 1 : 0) +
                           (absenteismo > 3 ? 1 : 0) + (turnover > 20 ? 1 : 0) >= 2;

    // ── Eixo II: Realidade laboral in loco (grau de exposição observado) ──────
    // grau 1 = baixa exposição | grau 2 = moderada | grau 3 = crítica
    const eixo2_positivo = grau >= 1;
    const eixo2_forte    = grau >= 2; // exposição moderada/crítica = evidência forte

    // ── Eixo III: Validação qualitativa pelos representantes do GHE ───────────
    const eixo3_confirma = valida === "confirma";
    const eixo3_nega     = valida === "nega";

    // ── Contagem de eixos positivos (para determinar P) ──────────────────────
    let eixosPositivos = 0;
    if (eixo1_positivo) eixosPositivos++;
    if (eixo2_positivo) eixosPositivos++; // sempre >= 1 pois grau > 0
    if (eixo3_confirma) eixosPositivos++;

    // ── Determinação de P pela convergência dos eixos (artigo, seção 3.3) ────
    // P4: convergência total dos 3 eixos + exposição forte
    // P3: estressor recorrente, 2+ eixos + força de exposição moderada/alta
    // P2: validado por 2 eixos, situações específicas
    // P1: evidência em apenas 1 eixo ou ocorrência excepcional
    //
    // Mitigação por Eixo III negativo: se trabalhadores negam e Eixo I é fraco,
    // sinaliza possível ruído de percepção / spillover — reduz P em 1 nível.
    let p;
    if      (eixosPositivos === 3 && eixo2_forte && eixo1_forte) p = 4; // P4: 3 eixos + intensidade alta
    else if (eixosPositivos === 3 && eixo2_forte)                p = 3; // P4 → P3 sem intensidade dupla
    else if (eixosPositivos >= 2  && (eixo2_forte || eixo1_forte)) p = 3; // P3: 2 eixos, pelo menos 1 forte
    else if (eixosPositivos >= 2)                                  p = 2; // P2: 2 eixos, exposição baixa
    else                                                           p = 1; // P1: 1 eixo

    // Mitigação Spillover: relato nega + Eixo I sem evidência → reduz P
    if (eixo3_nega && !eixo1_positivo) p = Math.max(1, p - 1);

    return { p, s };
  }

  // ── Fallback: Princípio da Precaução ────────────────────────────────────────
  // Aplicado quando o Eixo I (Anexo I) não está disponível.
  // Usa apenas Eixo II (grau de exposição) e Eixo III (relato dos representantes).
  // S é sempre fixo (sevBase do fator — artigo, seção 3.3).
  function calcPrecaucao(fid) {
    const fator  = FATORES.find(f => f.id === fid);
    const grau   = a2a[`f${fid}_grau`];
    const valida = a3[`f${fid}_valida`];
    if (grau === 0) return { p: 0, s: 0 };
    const s = fator.sevBase; // S fixo — mesmo na precaução
    // P pela convergência de Eixo II + Eixo III apenas (sem Eixo I)
    let p;
    if      (grau === 3 && valida === "confirma") p = 3; // 2 eixos + alta exposição → P3
    else if (grau === 3)                          p = 2; // só Eixo II forte
    else if (grau === 2 && valida === "confirma") p = 2; // 2 eixos, moderado
    else if (grau === 2)                          p = 2; // Eixo II moderado
    else                                          p = 1; // exposição baixa
    return { p, s };
  }

  // ── Função comum para aplicar P/S calculados e sincronizar ações ────────────
  const applyCalculatedRisk = (calcFn) => {
    setGhes(prev => prev.map((g, i) => {
      if (i !== activeGHE) return g;
      const updated = { ...g.risk };
      const newAcoes = { ...g.acoes };
      FATORES.forEach(f => {
        const { p, s } = calcFn(f.id, g);
        if (p > 0 && s > 0) {
          updated[`f${f.id}_p`] = p;
          updated[`f${f.id}_s`] = s;
          const rl = riskLevel(p, s);
          const key = `f${f.id}_acoes`;
          const current = g.acoes[key] || [];
          const allAuto = current.length === 0 || current.every(a => !a._customized);
          if (allAuto) {
            const nivelAcoes = (ACOES_POR_FATOR[f.id] || {})[rl.label] || [];
            newAcoes[key] = nivelAcoes.map(a => ({ ...a, _customized: false }));
          }
        }
      });
      return { ...g, risk: updated, acoes: newAcoes };
    }));
  };

  // Botão principal: cálculo pelos dados reais dos Anexos
  const calcRiskInteligente = () => applyCalculatedRisk(calcInteligente);

  // Botão alternativo: Princípio da Precaução (fallback sem dados suficientes)
  const calcRisk = () => applyCalculatedRisk((fid) => calcPrecaucao(fid));

  // Build report text - consolidates ALL GHEs
  const buildReport = () => {
    const date = new Date().toLocaleDateString("pt-BR");

    const gheReports = ghes.map(g => {
      const riscos = FATORES.map(f => {
        const p = g.risk[`f${f.id}_p`] || 0;
        const s = g.risk[`f${f.id}_s`] || 0;
        if (!p || !s) return null;
        const rl = riskLevel(p, s);
        return { ...f, p, s, v: p * s, rl };
      }).filter(Boolean);

      const criticos = riscos.filter(r => r.rl.label === "CRÍTICO");
      const altos    = riscos.filter(r => r.rl.label === "MODERADO");
      const overall  = riscos.length === 0 ? "NÃO AVALIADO"
        : criticos.length > 0 ? "CRÍTICO"
        : altos.length > 0 ? "MODERADO"
        : "BAIXO";

      return { ghe: g, riscos, criticos, altos, overall };
    });

    // Global overall = worst among all GHEs
    const allRiscos = gheReports.flatMap(r => r.riscos);
    const allCriticos = gheReports.flatMap(r => r.criticos);
    const allAltos = gheReports.flatMap(r => r.altos);
    const globalOverall = allRiscos.length === 0 ? "NÃO AVALIADO"
      : allCriticos.length > 0 ? "CRÍTICO"
      : allAltos.length > 0 ? "MODERADO"
      : "BAIXO";

    // For single-GHE backward compat in tabs
    const { riscos, criticos, altos, overall } = gheReports[activeGHE] || gheReports[0];

    return { date, riscos, criticos, altos, overall, gheReports, globalOverall, allRiscos, allCriticos, allAltos };
  };

  const tabStyle = (i) => ({
    padding: "8px 14px", cursor: "pointer", fontSize: 12, fontWeight: 600,
    border: "none", background: tab === i ? "#1e3a5f" : "#f1f5f9",
    color: tab === i ? "#fff" : "#475569", borderRadius: "6px 6px 0 0",
    transition: "all 0.15s",
  });

  const sectionTitle = (t) => (
    <div style={{ borderLeft: "4px solid #1e3a5f", paddingLeft: 12, marginBottom: 20, marginTop: 8 }}>
      <h3 style={{ margin: 0, fontSize: 15, color: "#1e3a5f", fontFamily: "'Georgia', serif" }}>{t}</h3>
    </div>
  );

  const card = (children, extra = {}) => (
    <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: 20, marginBottom: 16, ...extra }}>
      {children}
    </div>
  );

  const { date, riscos, criticos, altos, overall, gheReports, globalOverall, allRiscos, allCriticos, allAltos } = buildReport();

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc", fontFamily: "'Segoe UI', sans-serif" }}>
      {/* Header */}
      <div style={{ background: "linear-gradient(135deg, #0f2744 0%, #1e3a5f 60%, #164e8a 100%)", padding: "24px 32px", color: "#fff" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div style={{ width: 48, height: 48, borderRadius: 10, background: "rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 22 }}>⚙</div>
          <div>
            <div style={{ fontSize: 11, letterSpacing: "0.12em", textTransform: "uppercase", opacity: 0.7 }}>AMBRAC · Medicina e Segurança do Trabalho</div>
            <h1 style={{ margin: 0, fontSize: 20, fontFamily: "'Georgia', serif" }}>Avaliação Ergonômica Preliminar (AEP)</h1>
            <div style={{ fontSize: 12, opacity: 0.8 }}>Tetra-angulação de Evidências em Macroergonomia · NR-01 / NR-17</div>
          </div>
        </div>
      </div>

      {/* Tab bar */}
      <div style={{ background: "#f1f5f9", borderBottom: "2px solid #e2e8f0", padding: "0 24px", display: "flex", flexWrap: "wrap", gap: 4, paddingTop: 8 }}>
        {TABS.map((t, i) => <button key={i} onClick={() => setTab(i)} style={tabStyle(i)}>{t}</button>)}
      </div>

      {/* GHE Selector */}
      <div style={{ background: "#1e3a5f", padding: "10px 24px", display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        <span style={{ color: "#93c5fd", fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em" }}>GHEs Avaliados:</span>
        {ghes.map((g, i) => (
          <div key={g.id} style={{ display: "flex", alignItems: "center", gap: 0 }}>
            <button onClick={() => setActiveGHE(i)} style={{
              padding: "5px 12px", fontSize: 12, fontWeight: 700, border: "none", cursor: "pointer",
              background: activeGHE === i ? "#facc15" : "rgba(255,255,255,0.12)",
              color: activeGHE === i ? "#0f2744" : "#e2e8f0",
              borderRadius: "6px 0 0 6px", transition: "all 0.15s"
            }}>
              {g.nome || `GHE ${i+1}`}
            </button>
            {ghes.length > 1 && (
              <button onClick={() => removeGHE(i)} title="Remover este GHE" style={{
                padding: "5px 7px", fontSize: 11, border: "none", cursor: "pointer",
                background: activeGHE === i ? "#f59e0b" : "rgba(255,255,255,0.08)",
                color: activeGHE === i ? "#0f2744" : "#94a3b8",
                borderRadius: "0 6px 6px 0", borderLeft: "1px solid rgba(255,255,255,0.1)"
              }}>✕</button>
            )}
          </div>
        ))}
        <button onClick={addGHE} style={{
          padding: "5px 14px", fontSize: 12, fontWeight: 700, border: "2px dashed rgba(255,255,255,0.3)",
          background: "transparent", color: "#93c5fd", borderRadius: 6, cursor: "pointer"
        }}>+ Adicionar GHE</button>
        <div style={{ marginLeft: "auto", color: "#93c5fd", fontSize: 11 }}>
          Editando: <strong style={{ color: "#facc15" }}>{ghes[activeGHE]?.nome || `GHE ${activeGHE+1}`}</strong>
          {" — "}
          <span style={{ opacity: 0.7 }}>
            {tab === 9 ? "Relatório de todos os GHEs" : "Dados específicos deste GHE"}
          </span>
        </div>
      </div>

      {/* GHE Nome inline edit */}
      {tab !== 9 && (
        <div style={{ background: "#f0f9ff", borderBottom: "1px solid #bae6fd", padding: "8px 24px", display: "flex", alignItems: "center", gap: 12 }}>
          <label style={{ fontSize: 11, fontWeight: 700, color: "#0369a1", textTransform: "uppercase" }}>Nome do GHE ativo:</label>
          <input value={ghes[activeGHE]?.nome || ""} onChange={e => updateGHE("nome")(e.target.value)}
            placeholder="Ex: Central de Atendimento, Financeiro..."
            style={{ padding: "5px 10px", border: "1.5px solid #bae6fd", borderRadius: 6, fontSize: 13, background: "#fff", width: 280 }} />
          <span style={{ fontSize: 11, color: "#64748b" }}>Este nome aparecerá no relatório.</span>
        </div>
      )}

      <div style={{ maxWidth: 900, margin: "0 auto", padding: "24px 20px" }}>

        {/* ── TAB 0: Identificação ── */}
        {tab === 0 && (
          <>
            {sectionTitle("1. Identificação Institucional e Responsabilidade Técnica")}

            {/* ── UPLOAD INTELIGENTE ── */}
            {(() => {
              const SUPPORTED = ".pdf,.png,.jpg,.jpeg,.docx,.txt,.csv,.xlsx,.html";

              const toBase64 = (file) => new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result.split(",")[1]);
                r.onerror = () => rej(new Error("Leitura falhou"));
                r.readAsDataURL(file);
              });

              const toText = (file) => new Promise((res, rej) => {
                const r = new FileReader();
                r.onload = () => res(r.result);
                r.onerror = () => rej(new Error("Leitura falhou"));
                r.readAsText(file, "UTF-8");
              });

              const extractIdent = async (file) => {
                setUploadState("loading");
                setUploadMsg(`Analisando "${file.name}"...`);
                setExtractedPreview(null);
                try {
                  const ext = file.name.split(".").pop().toLowerCase();
                  const isImage = ["png","jpg","jpeg","gif","webp"].includes(ext);
                  const isPdf = ext === "pdf";
                  const isText = ["txt","csv","html","htm"].includes(ext);

                  let messages;

                  const systemPrompt = `Você é um extrator preciso de dados cadastrais e epidemiológicos de empresas brasileiras para laudos ergonômicos (AEP/NR-17).
Analise TODO o conteúdo fornecido e extraia os campos abaixo. Responda SOMENTE com um objeto JSON válido, sem markdown, sem texto extra.
Use "" para campos não encontrados. Para campos sim/nao, use exatamente "sim" ou "nao".

{
  "razaoSocial": "Nome completo ou Razão Social da empresa",
  "cnpj": "CNPJ no formato XX.XXX.XXX/XXXX-XX",
  "cnae": "Código CNAE principal (somente números ou número/descrição)",
  "grauRisco": "1, 2, 3 ou 4 (somente o número)",
  "endereco": "Endereço completo (logradouro, número, cidade/UF)",
  "responsavel": "Nome do responsável técnico / elaborador do laudo",
  "dataInspecao": "Data da inspeção no formato YYYY-MM-DD (ISO 8601)",
  "setor": "Setor, departamento ou GHE identificado",

  "afastamentosINSS": "Número de afastamentos INSS B31/B91 (somente o número, ex: 3)",
  "cidGrupoF": "sim ou nao — se há CIDs do Grupo F (transtornos mentais) nos afastamentos",
  "cidGrupoFDetalhe": "Quais CIDs do Grupo F foram identificados (ex: F32, F43)",
  "catMental": "sim ou nao — se há CATs por adoecimento mental",
  "catQtd": "Quantidade de CATs por adoecimento mental (somente o número)",
  "absenteismo": "Taxa de absenteísmo mensal em % (somente o número, ex: 3.5)",
  "turnover": "Taxa de turnover anual em % (somente o número, ex: 25)",
  "horasExtras": "Média de horas extras por trabalhador por mês (somente o número)",
  "assedioDenuncia": "sim ou nao — se há denúncias formais de assédio ou conflitos registradas",
  "a1Respondente": "Nome de quem forneceu os dados do Anexo I (RH/SESMT)",
  "a1Cargo": "Cargo de quem forneceu os dados do Anexo I",
  "a1Data": "Data do preenchimento do Anexo I no formato YYYY-MM-DD"
}`;

                  if (isImage) {
                    const b64 = await toBase64(file);
                    const mime = file.type || "image/jpeg";
                    messages = [{
                      role: "user",
                      content: [
                        { type: "image", source: { type: "base64", media_type: mime, data: b64 } },
                        { type: "text", text: "Extraia os dados de identificação institucional desta imagem conforme instruído." }
                      ]
                    }];
                  } else if (isPdf) {
                    const b64 = await toBase64(file);
                    messages = [{
                      role: "user",
                      content: [
                        { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
                        { type: "text", text: "Extraia os dados de identificação institucional deste PDF conforme instruído." }
                      ]
                    }];
                  } else {
                    // Text-based: txt, csv, html
                    // DOCX/XLSX são binários — enviamos como base64 com instrução de texto
                    const isBinary = ["docx","xlsx","xls"].includes(ext);
                    if (isBinary) {
                      const b64 = await toBase64(file);
                      const mime = ext === "xlsx" || ext === "xls"
                        ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                        : "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
                      messages = [{
                        role: "user",
                        content: [
                          { type: "document", source: { type: "base64", media_type: "application/pdf", data: b64 } },
                          { type: "text", text: "Extraia os dados de identificação institucional deste documento conforme instruído." }
                        ]
                      }];
                    } else {
                      const text = await toText(file);
                      const truncated = text.slice(0, 12000);
                      messages = [{
                        role: "user",
                        content: `Extraia os dados de identificação institucional do conteúdo abaixo:\n\n${truncated}`
                      }];
                    }
                  }

                  const resp = await fetch("/api/claude", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                      model: "claude-sonnet-4-6",
                      max_tokens: 2000,
                      system: systemPrompt,
                      messages,
                    })
                  });

                  if (!resp.ok) throw new Error(`API erro ${resp.status}`);
                  const data = await resp.json();
                  const raw = (data.content || []).map(b => b.text || "").join("").trim();

                  // Parse JSON — strip possible markdown fences
                  const clean = raw.replace(/^```[a-z]*\n?/i, "").replace(/```$/,"").trim();
                  const extracted = JSON.parse(clean);

                  setExtractedPreview(extracted);
                  setUploadState("done");
                  setUploadMsg(`✅ Dados extraídos de "${file.name}". Revise e confirme abaixo.`);
                } catch (err) {
                  setUploadState("error");
                  setUploadMsg(`❌ Erro ao processar: ${err.message}`);
                }
              };

              const applyExtracted = () => {
                if (!extractedPreview) return;
                const grauMap = { "1":1, "2":2, "3":3, "4":4 };

                // ── Identificação (global) ──
                if (extractedPreview.razaoSocial) siGlobal("razaoSocial")(extractedPreview.razaoSocial);
                if (extractedPreview.cnpj) siGlobal("cnpj")(extractedPreview.cnpj);
                if (extractedPreview.cnae) siGlobal("cnae")(extractedPreview.cnae);
                if (extractedPreview.grauRisco) siGlobal("grauRisco")(String(grauMap[extractedPreview.grauRisco] || extractedPreview.grauRisco));
                if (extractedPreview.endereco) siGlobal("endereco")(extractedPreview.endereco);
                if (extractedPreview.responsavel) siGlobal("responsavel")(extractedPreview.responsavel);
                if (extractedPreview.tecnicoReg) siGlobal("tecnicoReg")(extractedPreview.tecnicoReg);
                if (extractedPreview.dataInspecao) siGlobal("dataInspecao")(extractedPreview.dataInspecao);
                if (extractedPreview.setor) updateGHE("setor")(extractedPreview.setor);

                // ── Anexo I – Epidemiologia (GHE ativo) ──
                setGhes(prev => prev.map((g, i) => {
                  if (i !== activeGHE) return g;
                  const a1upd = { ...g.a1 };
                  const p = extractedPreview;
                  if (p.afastamentosINSS !== undefined && p.afastamentosINSS !== "") a1upd.afastamentosINSS = String(p.afastamentosINSS);
                  if (p.cidGrupoF === "sim" || p.cidGrupoF === "nao") a1upd.cidGrupoF = p.cidGrupoF;
                  if (p.cidGrupoFDetalhe) a1upd.cidGrupoFDetalhe = p.cidGrupoFDetalhe;
                  if (p.catMental === "sim" || p.catMental === "nao") a1upd.catMental = p.catMental;
                  if (p.catQtd !== undefined && p.catQtd !== "") a1upd.catQtd = String(p.catQtd);
                  if (p.absenteismo !== undefined && p.absenteismo !== "") a1upd.absenteismo = String(p.absenteismo);
                  if (p.turnover !== undefined && p.turnover !== "") a1upd.turnover = String(p.turnover);
                  if (p.horasExtras !== undefined && p.horasExtras !== "") a1upd.horasExtras = String(p.horasExtras);
                  if (p.assedioDenuncia === "sim" || p.assedioDenuncia === "nao") a1upd.assedioDenuncia = p.assedioDenuncia;
                  if (p.a1Respondente) a1upd.respondente = p.a1Respondente;
                  if (p.a1Cargo) a1upd.cargo = p.a1Cargo;
                  if (p.a1Data) a1upd.data = p.a1Data;
                  return { ...g, a1: a1upd };
                }));

                setUploadState("applied");
                setUploadMsg("✅ Dados aplicados com sucesso! Identificação e Anexo I preenchidos.");
                setExtractedPreview(null);
              };

              const reset = () => { setUploadState("idle"); setUploadMsg(""); setExtractedPreview(null); };

              const handleFile = (file) => {
                if (!file) return;
                extractIdent(file);
              };

              return (
                <div style={{ marginBottom: 20 }}>
                  {/* Drop zone */}
                  {(uploadState === "idle" || uploadState === "applied") && (
                    <div
                      onDragOver={e => { e.preventDefault(); setDragOver(true); }}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={e => { e.preventDefault(); setDragOver(false); const f = e.dataTransfer.files[0]; if(f) handleFile(f); }}
                      style={{
                        border: `2px dashed ${dragOver ? "#1e3a5f" : "#93c5fd"}`,
                        borderRadius: 12,
                        padding: "24px 20px",
                        background: dragOver ? "#dbeafe" : (uploadState === "applied" ? "#f0fdf4" : "#f8fafc"),
                        textAlign: "center",
                        transition: "all 0.2s",
                        cursor: "pointer",
                      }}
                    >
                      <div style={{ fontSize: 32, marginBottom: 6 }}>{uploadState === "applied" ? "✅" : "📂"}</div>
                      {uploadState === "applied"
                        ? <p style={{ margin: "0 0 10px", color: "#15803d", fontSize: 13, fontWeight: 700 }}>{uploadMsg}</p>
                        : <>
                            <p style={{ margin: "0 0 4px", color: "#1e3a5f", fontSize: 13, fontWeight: 700 }}>Importar dados de identificação e epidemiologia automaticamente</p>
                            <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 12 }}>Arraste um arquivo com os dados da empresa. Claude irá extrair <strong>Identificação Institucional + Anexo I</strong></p>
                            <p style={{ margin: "0 0 14px", color: "#94a3b8", fontSize: 11 }}>Suportado: PDF · Imagem (PNG/JPG) · DOCX · Excel · TXT · CSV · HTML</p>
                          </>
                      }
                      <label style={{
                        display: "inline-block", padding: "7px 20px",
                        background: uploadState === "applied" ? "#dcfce7" : "#1e3a5f",
                        color: uploadState === "applied" ? "#15803d" : "#fff",
                        border: uploadState === "applied" ? "1px solid #86efac" : "none",
                        borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: 700
                      }}>
                        {uploadState === "applied" ? "🔄 Importar novo arquivo" : "📁 Selecionar arquivo"}
                        <input type="file" accept={SUPPORTED} style={{ display: "none" }}
                          onChange={e => { const f = e.target.files[0]; if(f) handleFile(f); e.target.value=""; }} />
                      </label>
                    </div>
                  )}

                  {/* Loading */}
                  {uploadState === "loading" && (
                    <div style={{ border: "1.5px solid #bfdbfe", borderRadius: 12, padding: "20px 24px", background: "#eff6ff", textAlign: "center" }}>
                      <div style={{ fontSize: 28, marginBottom: 8 }}>🤖</div>
                      <p style={{ margin: 0, color: "#1e3a5f", fontSize: 13, fontWeight: 700 }}>{uploadMsg}</p>
                      <p style={{ margin: "6px 0 0", color: "#64748b", fontSize: 12 }}>Claude está lendo o documento e extraindo Identificação + Anexo I...</p>
                      <div style={{ marginTop: 14, height: 4, background: "#dbeafe", borderRadius: 2, overflow: "hidden" }}>
                        <div style={{ height: "100%", width: "60%", background: "#3b82f6", borderRadius: 2, animation: "pulse 1.4s ease-in-out infinite" }} />
                      </div>
                    </div>
                  )}

                  {/* Error */}
                  {uploadState === "error" && (
                    <div style={{ border: "1.5px solid #f87171", borderRadius: 12, padding: "16px 20px", background: "#fef2f2" }}>
                      <p style={{ margin: "0 0 10px", color: "#7f1d1d", fontSize: 13, fontWeight: 700 }}>{uploadMsg}</p>
                      <button onClick={reset} style={{ padding: "6px 16px", background: "#fee2e2", color: "#991b1b", border: "1px solid #f87171", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                        Tentar novamente
                      </button>
                    </div>
                  )}

                  {/* Preview antes de aplicar */}
                  {uploadState === "done" && extractedPreview && (
                    <div style={{ border: "1.5px solid #4ade80", borderRadius: 12, background: "#f0fdf4", overflow: "hidden" }}>
                      <div style={{ background: "#16a34a", color: "#fff", padding: "10px 16px", display: "flex", alignItems: "center", gap: 8 }}>
                        <span style={{ fontSize: 16 }}>🤖</span>
                        <strong style={{ fontSize: 13 }}>Dados extraídos — revise antes de aplicar</strong>
                      </div>
                      <div style={{ padding: "14px 16px" }}>

                        {/* Bloco 1: Identificação */}
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#16a34a", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          🏢 Identificação Institucional
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginBottom: 16, padding: "10px 12px", background: "#dcfce7", borderRadius: 8 }}>
                          {[
                            ["Razão Social", extractedPreview.razaoSocial],
                            ["CNPJ", extractedPreview.cnpj],
                            ["CNAE Principal", extractedPreview.cnae],
                            ["Grau de Risco", extractedPreview.grauRisco ? `GR ${extractedPreview.grauRisco}` : ""],
                            ["Endereço", extractedPreview.endereco],
                            ["Setor / GHE", extractedPreview.setor],
                            ["Data da Inspeção", extractedPreview.dataInspecao],
                            ["Responsável Técnico / Elaborador", extractedPreview.responsavel],
                            ["Registro Profissional", extractedPreview.tecnicoReg],
                          ].map(([label, val]) => (
                            <div key={label} style={{ fontSize: 12 }}>
                              <span style={{ color: "#64748b", fontWeight: 700, display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                              <span style={{ color: val ? "#1e3a5f" : "#94a3b8", fontStyle: val ? "normal" : "italic", fontWeight: val ? 600 : 400 }}>
                                {val || "não encontrado"}
                              </span>
                            </div>
                          ))}
                        </div>

                        {/* Bloco 2: Anexo I */}
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 8 }}>
                          📊 Anexo I – Dados Epidemiológicos
                        </div>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "6px 16px", marginBottom: 14, padding: "10px 12px", background: "#eff6ff", borderRadius: 8 }}>
                          {[
                            ["Afastamentos INSS (B31/B91)", extractedPreview.afastamentosINSS],
                            ["CIDs Grupo F?", extractedPreview.cidGrupoF ? (extractedPreview.cidGrupoF === "sim" ? "✅ Sim" : "❌ Não") : ""],
                            ["Quais CIDs Grupo F", extractedPreview.cidGrupoFDetalhe],
                            ["CATs Saúde Mental?", extractedPreview.catMental ? (extractedPreview.catMental === "sim" ? "✅ Sim" : "❌ Não") : ""],
                            ["Qtd. de CATs", extractedPreview.catQtd],
                            ["Absenteísmo (%/mês)", extractedPreview.absenteismo],
                            ["Turnover (%/ano)", extractedPreview.turnover],
                            ["Horas Extras (h/mês)", extractedPreview.horasExtras],
                            ["Denúncias Assédio?", extractedPreview.assedioDenuncia ? (extractedPreview.assedioDenuncia === "sim" ? "✅ Sim" : "❌ Não") : ""],
                            ["Fornecido por", extractedPreview.a1Respondente],
                            ["Cargo", extractedPreview.a1Cargo],
                            ["Data do Anexo I", extractedPreview.a1Data],
                          ].map(([label, val]) => (
                            <div key={label} style={{ fontSize: 12 }}>
                              <span style={{ color: "#64748b", fontWeight: 700, display: "block", fontSize: 10, textTransform: "uppercase", letterSpacing: "0.05em" }}>{label}</span>
                              <span style={{ color: val ? "#1e3a5f" : "#94a3b8", fontStyle: val ? "normal" : "italic", fontWeight: val ? 600 : 400 }}>
                                {val || "não encontrado"}
                              </span>
                            </div>
                          ))}
                        </div>

                        <div style={{ display: "flex", gap: 8 }}>
                          <button onClick={applyExtracted} style={{
                            flex: 1, padding: "9px 0", background: "#16a34a", color: "#fff",
                            border: "none", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700
                          }}>
                            ✅ Aplicar todos os dados nos campos
                          </button>
                          <button onClick={reset} style={{
                            padding: "9px 16px", background: "#f1f5f9", color: "#475569",
                            border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 600
                          }}>
                            Cancelar
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })()}

            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: "#1e3a5f" }}>
              📌 <strong>Dados da Empresa</strong> abaixo são compartilhados por todos os GHEs. O campo <strong>Setor / GHE</strong> é específico do GHE ativo (<em>{ghes[activeGHE]?.nome || `GHE ${activeGHE+1}`}</em>).
            </div>
            {card(<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Razão Social"><Input value={ident.razaoSocial} onChange={siGlobal("razaoSocial")} placeholder="Nome da empresa" /></Field>
                <Field label="CNPJ"><Input value={ident.cnpj} onChange={siGlobal("cnpj")} placeholder="XX.XXX.XXX/0001-XX" /></Field>
                <Field label="CNAE Principal"><Input value={ident.cnae} onChange={siGlobal("cnae")} placeholder="Ex: 6422100" /></Field>
                <Field label="Grau de Risco"><Select value={ident.grauRisco} onChange={siGlobal("grauRisco")} options={[
                  { value: "", label: "Selecione..." },
                  { value: "1", label: "GR 1 – Mínimo" },
                  { value: "2", label: "GR 2 – Médio" },
                  { value: "3", label: "GR 3 – Alto" },
                  { value: "4", label: "GR 4 – Máximo" },
                ]} /></Field>
                <Field label="Endereço da Instalação" ><Input value={ident.endereco} onChange={siGlobal("endereco")} placeholder="Rua, número, cidade/UF" /></Field>
                <Field label={`Setor / GHE Avaliado (${ghes[activeGHE]?.nome || `GHE ${activeGHE+1}`})`}><Input value={ghes[activeGHE]?.setor || ""} onChange={updateGHE("setor")} placeholder="Ex: Central de Atendimento" /></Field>
                <Field label="Data da Inspeção"><Input value={ident.dataInspecao} onChange={siGlobal("dataInspecao")} type="date" /></Field>
                <Field label="Responsável Técnico / Elaborador do Laudo"><Input value={ident.responsavel} onChange={siGlobal("responsavel")} placeholder="Nome completo" /></Field>
                <Field label="Registro Profissional"><Input value={ident.tecnicoReg} onChange={siGlobal("tecnicoReg")} placeholder="CRP, CREA, CRM..." /></Field>
              </div>
            </>)}
            {/* ── PAINEL NTEP / CNAE EXPANDIDO ── */}
            {(() => {
              const dados = getCnaeDados(ident.cnae);
              if (!dados) return (
                <div style={{ background: "#f8fafc", border: "1px dashed #cbd5e1", borderRadius: 8, padding: 14, marginTop: 12, fontSize: 12, color: "#94a3b8", textAlign: "center" }}>
                  🏭 Informe o <strong>CNAE Principal</strong> acima para visualizar o <strong>perfil epidemiológico do setor</strong> (NTEP / Decreto nº 3.048/1999 — Lista C, Anexo II).
                </div>
              );
              const fatoresList = FATORES.filter(f => dados.fatoresPsi.includes(f.id));
              const showOutros = showNtepOutros;
              const setShowOutros = setShowNtepOutros;
              return (
                <div style={{ background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 8, padding: 16, marginTop: 12 }}>
                  {/* Cabeçalho */}
                  <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                    <span style={{ fontSize: 18 }}>⚖️</span>
                    <div>
                      <div style={{ fontWeight: 700, color: "#92400e", fontSize: 13 }}>
                        NTEP — Perfil Epidemiológico Inerente ao CNAE {ident.cnae}
                      </div>
                      <div style={{ fontSize: 11, color: "#78350f" }}>{dados.nome}</div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#78350f", marginBottom: 12, lineHeight: 1.7, background: "#fef9c3", borderRadius: 6, padding: "8px 12px" }}>
                    Com base na <strong>Lista C do Anexo II do Decreto nº 3.048/1999</strong>, este setor possui <strong>presunção estatística de causalidade</strong> para as patologias abaixo.
                    O diagnóstico psicossocial passa de exploratório para <strong>auditoria de confirmação de nexo</strong> (Tetra-angulação de Evidências — Eixo I).
                  </div>

                  {/* CID F — Destaque Principal */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#1d4ed8", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6, display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ background: "#1d4ed8", color: "#fff", borderRadius: 4, padding: "1px 7px", fontSize: 10 }}>CID GRUPO F</span>
                      Transtornos Mentais e Comportamentais — FOCO DO DIAGNÓSTICO PSICOSSOCIAL
                    </div>
                    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                      {dados.cidF.map((cid, i) => (
                        <span key={i} style={{ background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#1e3a8a", fontWeight: 600 }}>
                          🧠 {cid}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Fatores psicossociais prioritários */}
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ fontSize: 11, fontWeight: 700, color: "#92400e", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                      Fatores Psicossociais de Maior Prevalência para este Setor
                    </div>
                    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 6 }}>
                      {fatoresList.map(f => (
                        <div key={f.id} style={{ background: "#fff", border: "1px solid #fde68a", borderRadius: 6, padding: "7px 10px", display: "flex", gap: 8, alignItems: "flex-start" }}>
                          <span style={{ background: "#d97706", color: "#fff", borderRadius: 4, padding: "2px 7px", fontSize: 10, fontWeight: 700, flexShrink: 0 }}>{f.id}</span>
                          <div>
                            <div style={{ fontWeight: 700, fontSize: 11, color: "#1e3a5f" }}>{f.label}</div>
                            <div style={{ fontSize: 10, color: "#92400e", marginTop: 2 }}>{f.cid}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Demais CIDs — toggle */}
                  <div>
                    <button onClick={() => setShowOutros(v => !v)} style={{
                      background: "none", border: "1px solid #fcd34d", borderRadius: 6, padding: "5px 12px",
                      fontSize: 11, color: "#92400e", cursor: "pointer", fontWeight: 600, display: "flex", alignItems: "center", gap: 6
                    }}>
                      {showOutros ? "▲ Ocultar" : "▼ Mostrar"} demais CIDs com nexo NTEP para este setor ({dados.cidOutros.length} patologias adicionais)
                    </button>
                    {showOutros && (
                      <div style={{ marginTop: 8 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                          Outras patologias com nexo NTEP (doenças osteomusculares, LER/DORT, ambientais etc.)
                        </div>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {dados.cidOutros.map((cid, i) => (
                            <span key={i} style={{ background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, padding: "4px 10px", fontSize: 11, color: "#475569", fontWeight: 500 }}>
                              📋 {cid}
                            </span>
                          ))}
                        </div>
                        <div style={{ fontSize: 10, color: "#94a3b8", marginTop: 8, fontStyle: "italic" }}>
                          * Estas patologias são relevantes para o PGR geral, mas o foco da AEP está nos transtornos do Grupo F (acima). Consulte SESMT para os demais riscos.
                        </div>
                      </div>
                    )}
                  </div>
                  <div style={{ fontSize: 10, color: "#a16207", marginTop: 10, fontStyle: "italic" }}>
                    * Todos os 12 fatores psicossociais devem ser avaliados — esta lista indica os de maior prevalência epidemiológica para o setor segundo o Decreto nº 3.048/1999.
                  </div>
                </div>
              );
            })()}
          </>
        )}

        {/* ── TAB 1: Anexo I ── */}
        {tab === 1 && (
          <>
            {sectionTitle("Eixo I — Indicadores Epidemiológicos e de Gestão (CNAE / NTEP / Decreto 3.048/1999)")}
            <div style={{ background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
              <strong style={{ color: "#0369a1" }}>Fundamentação metodológica:</strong> O Eixo I consolida os indicadores objetivos de gestão do GHE avaliado.
              Conforme o artigo de referência, os dados de absenteísmo, afastamentos e CATs devem ser cruzados com a
              <strong> Lista C do Anexo II do Decreto nº 3.048/1999</strong> via CNAE, que institui o <strong>NTEP (Nexo Técnico Epidemiológico Previdenciário)</strong>.
              Essa integração migra o diagnóstico do campo subjetivo da "satisfação no trabalho" para o domínio da
              <strong> segurança jurídica e epidemiológica</strong>, fornecendo o perfil de agravo esperado para o setor que valida tecnicamente os estressores identificados na triangulação.
            </div>
            {card(<>
              <p style={{ fontSize: 12, color: "#64748b", marginTop: 0 }}>Dados dos últimos 12 meses referentes ao GHE avaliado.</p>
              <h4 style={{ color: "#1e3a5f", margin: "0 0 12px" }}>1. Dados de Saúde e Absenteísmo</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Afastamentos INSS (B31/B91) – nº de casos"><Input value={a1.afastamentosINSS} onChange={s1("afastamentosINSS")} placeholder="0" type="number" /></Field>
                <Field label="CIDs do Grupo F nos afastamentos?">
                  <Radio value={a1.cidGrupoF} onChange={s1("cidGrupoF")} name="cidGrupoF" options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]} />
                </Field>
              </div>
              {a1.cidGrupoF === "sim" && (
                <Field label="Quais CIDs do Grupo F?"><Textarea value={a1.cidGrupoFDetalhe} onChange={s1("cidGrupoFDetalhe")} placeholder="Ex: F32 (Depressão), F43 (Burnout)..." /></Field>
              )}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="CATs por adoecimento mental?">
                  <Radio value={a1.catMental} onChange={s1("catMental")} name="catMental" options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]} />
                </Field>
                {a1.catMental === "sim" && <Field label="Qtd. de CATs"><Input value={a1.catQtd} onChange={s1("catQtd")} placeholder="Nº de CATs" type="number" /></Field>}
                <Field label="Taxa média de absenteísmo mensal (%)"><Input value={a1.absenteismo} onChange={s1("absenteismo")} placeholder="Ex: 3.5" type="number" /></Field>
              </div>
              <h4 style={{ color: "#1e3a5f", margin: "16px 0 12px" }}>2. Dados de Gestão Organizacional (RH)</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Turnover no GHE (% ao ano)"><Input value={a1.turnover} onChange={s1("turnover")} placeholder="Ex: 25" type="number" /></Field>
                <Field label="Média de horas extras/trabalhador/mês"><Input value={a1.horasExtras} onChange={s1("horasExtras")} placeholder="Horas" type="number" /></Field>
                <Field label="Denúncias formais de assédio/conflitos?">
                  <Radio value={a1.assedioDenuncia} onChange={s1("assedioDenuncia")} name="assedioDenuncia" options={[{ value: "sim", label: "Sim" }, { value: "nao", label: "Não" }]} />
                </Field>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12, marginTop: 8 }}>
                <Field label="Fornecido por"><Input value={a1.respondente} onChange={s1("respondente")} placeholder="Nome" /></Field>
                <Field label="Cargo"><Input value={a1.cargo} onChange={s1("cargo")} placeholder="Cargo" /></Field>
                <Field label="Data"><Input value={a1.data} onChange={s1("data")} type="date" /></Field>
              </div>
            </>)}
          </>
        )}

        {/* ── TAB 2: Eixo II – Trabalho Prescrito ── */}
        {tab === 2 && (
          <>
            {sectionTitle("Eixo II — Inventário da Gestão: O Trabalho Prescrito")}
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
              <strong style={{ color: "#92400e" }}>Eixo II — Inventário da Gestão (Trabalho Prescrito):</strong> Este módulo captura as <strong>práticas organizacionais prescritas</strong>
              (políticas, normas, manuais, treinamentos formais) para cada fator de risco. O confronto com o que foi observado <em>in loco</em> (Eixo III)
              permite identificar a discrepância entre o trabalho prescrito e o real — fonte primária dos estressores psicossociais sistêmicos (Guérin et al., 2001 / NR-17, item 17.3.1).
            </div>
            <p style={{ fontSize: 12, color: "#64748b" }}>Preenchido pelo gestor, RH ou Engenharia de Produção para mapear o Trabalho Prescrito.</p>
            {card(<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Setor / GHE"><Input value={a2b.setor || ""} onChange={s2b("setor")} placeholder="Setor" /></Field>
                <Field label="Respondente"><Input value={a2b.respondente || ""} onChange={s2b("respondente")} placeholder="Nome" /></Field>
                <Field label="Cargo"><Input value={a2b.cargo || ""} onChange={s2b("cargo")} placeholder="Cargo" /></Field>
                <Field label="Data"><Input value={a2b.data || ""} onChange={s2b("data")} type="date" /></Field>
              </div>
            </>)}
            {FATORES.map(f => {
              const ntepIds = getFatoresByCnae(ident.cnae) || [];
              const isNtep = ntepIds.includes(f.id);
              return (
              <div key={f.id} style={{ background: isNtep ? "#fffbeb" : "#fff", border: `1px solid ${isNtep ? "#fcd34d" : "#e2e8f0"}`, borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
                  <span style={{ background: "#475569", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{f.id}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#334155" }}>{f.label}</span>
                  {isNtep && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 700, background: "#fef3c7", color: "#92400e" }}>⚖️ NTEP</span>}
                </div>
                <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 11, color: "#075985", lineHeight: 1.6 }}>
                  <strong>📋 Pergunta de Auditoria para a Gestão (Trabalho Prescrito):</strong><br />{f.perguntaEixo2}
                </div>
                <Field label="Resposta / Prática Organizacional Prescrita">
                  <Textarea value={a2b[`f${f.id}_pratica`]} onChange={s2b(`f${f.id}_pratica`)} placeholder="Descreva a norma, política ou prática formal adotada pela organização para este fator..." rows={2} />
                </Field>
              </div>
              );
            })}
          </>
        )}

        {/* ── TAB 3: Eixo III – Observação In Loco ── */}
        {tab === 3 && (
          <>
            {sectionTitle("Eixo III — Análise da Realidade Laboral In Loco (Observação Pericial)")}
            <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
              <strong style={{ color: "#92400e" }}>Fundamentação metodológica:</strong> O Eixo III compreende a observação técnica <em>in loco</em> dos fluxos de trabalho,
              exigências cognitivas e possíveis discrepâncias entre o <strong>trabalho prescrito</strong> (normas e manuais) e o <strong>trabalho real</strong> (o que é efetivamente executado — Guérin et al., 2001).
              É justamente nessa discrepância que residem os riscos psicossociais sistêmicos. A investigação é estruturada para auditar os
              <strong> 12 domínios do Guia Prático SIT/ENIT (2020)</strong>, garantindo rastreabilidade e conformidade com NR-01 e NR-17.
              O grau de exposição observado alimenta <strong>diretamente o cálculo de P</strong> na Tetra-angulação de Evidências.
            </div>
            <p style={{ fontSize: 12, color: "#64748b" }}>Escala: 0 = Inexistente | 1 = Baixa/Ocasional | 2 = Moderada/Frequente | 3 = Crítica/Contínua</p>
            {FATORES.map(f => {
              const ntepIds = getFatoresByCnae(ident.cnae) || [];
              const isNtep = ntepIds.includes(f.id);
              return (
              <div key={f.id} style={{ background: isNtep ? "#fffbeb" : "#fff", border: `1px solid ${isNtep ? "#fcd34d" : "#e2e8f0"}`, borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ background: "#1e3a5f", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{f.id}</span>
                  <span style={{ fontWeight: 700, fontSize: 13, color: "#1e3a5f" }}>{f.label}</span>
                  {isNtep && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 700, background: "#fef3c7", color: "#92400e" }}>⚖️ NTEP</span>}
                  <span style={{ fontSize: 11, color: "#94a3b8", marginLeft: "auto" }}>Nexo: {f.cid}</span>
                </div>
                <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 6, padding: "8px 12px", marginBottom: 10, fontSize: 11, color: "#475569", lineHeight: 1.6 }}>
                  <strong style={{ color: "#1e3a5f" }}>🔍 O que observar (Eixo III — Checklist de Auditoria Operacional):</strong><br />{f.checklist}
                </div>
                <div style={{ display: "grid", gridTemplateColumns: "auto 1fr", gap: 12, alignItems: "center" }}>
                  <Field label="Grau de Exposição (0–3)">
                    <select value={a2a[`f${f.id}_grau`]} onChange={e => s2a(`f${f.id}_grau`)(Number(e.target.value))}
                      style={{ padding: "6px 10px", border: "1.5px solid #e2e8f0", borderRadius: 6, fontSize: 13, background: "#fff" }}>
                      <option value={0}>0 – Inexistente</option>
                      <option value={1}>1 – Baixa/Ocasional</option>
                      <option value={2}>2 – Moderada/Frequente</option>
                      <option value={3}>3 – Crítica/Contínua</option>
                    </select>
                  </Field>
                  <Field label="Evidência Material Observada">
                    <Input value={a2a[`f${f.id}_evidencia`]} onChange={s2a(`f${f.id}_evidencia`)} placeholder="Descreva a evidência concreta observada in loco..." />
                  </Field>
                </div>
              </div>
              );
            })}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14 }}>
              <h4 style={{ margin: "0 0 12px", color: "#1e3a5f", fontSize: 13 }}>Declaração do Avaliador Técnico</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Avaliador / TST"><Input value={a2a.avaliador || ""} onChange={s2a("avaliador")} placeholder="Nome e registro" /></Field>
                <Field label="Data da Inspeção"><Input value={a2a.dataInsp || ""} onChange={s2a("dataInsp")} type="date" /></Field>
                <Field label="Tempo Total de Observação (h)"><Input value={a2a.tempoObs || ""} onChange={s2a("tempoObs")} placeholder="Ex: 2h30min" /></Field>
              </div>
            </div>
          </>
        )}

        {/* ── TAB 3: Eixo III – Observação In Loco ── */}
        {tab === 4 && (
          <>
            {sectionTitle("Eixo IV — Validação Qualitativa Participativa (Representantes do GHE)")}
            <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 8, padding: 14, marginBottom: 12, fontSize: 12, lineHeight: 1.6 }}>
              <strong style={{ color: "#15803d" }}>Fundamentação metodológica:</strong> O Eixo IV utiliza amostragem por representatividade qualitativa (Glaser & Strauss, 1967),
              baseada no conceito de saturação teórica aplicada a Grupos Homogêneos de Exposição (GHE). A premissa é que, após um número crítico de relatos
              sobre o mesmo fluxo de trabalho, os achados tornam-se redundantes — validando o diagnóstico organizacional sem necessidade de envolver
              todo o quadro funcional. A coleta ocorre <strong>sem intermediação hierárquica</strong> para neutralizar o viés de conformidade e o efeito Spillover.<br /><br />
              <strong>Instrução ao representante:</strong> Responda com base na sua rotina de trabalho. Não há respostas certas ou erradas.
              Escala: <strong>1 – Nunca/Raro</strong> | <strong>2 – Ocasional</strong> | <strong>3 – Frequente</strong> | <strong>4 – Sempre/Constante</strong>.
              As perguntas marcadas <span style={{ background: "#dbeafe", color: "#1d4ed8", padding: "0 5px", borderRadius: 4, fontWeight: 700 }}>↩ Invertida</span> indicam
              que uma pontuação <strong>baixa</strong> é o sinal de risco (ex: "tenho autonomia" com nota 1 = risco alto).
              {getFatoresByCnae(ident.cnae) && (
                <span> · Fatores com <span style={{ background: "#fef3c7", color: "#92400e", padding: "0 5px", borderRadius: 4, fontWeight: 700 }}>⚖️ NTEP</span> têm presunção epidemiológica para este CNAE.</span>
              )}
              <table style={{ marginTop: 6, borderCollapse: "collapse", width: "100%", fontSize: 11 }}>
                <thead>
                  <tr style={{ background: "#dcfce7" }}>
                    <th style={{ padding: "4px 10px", textAlign: "left", border: "1px solid #86efac" }}>Tamanho do GHE</th>
                    <th style={{ padding: "4px 10px", textAlign: "center", border: "1px solid #86efac" }}>Nº de representantes</th>
                    <th style={{ padding: "4px 10px", textAlign: "left", border: "1px solid #86efac" }}>Justificativa técnica</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    ["Até 10", "3", "Alta representatividade — cobertura de variabilidades individuais"],
                    ["11 a 30", "5", "Equilíbrio entre diversidade de turnos e experiência"],
                    ["31 a 100", "8", "Margem de segurança para saturação de temas recorrentes"],
                    ["Acima de 100", "10% do grupo (máx. 20)", "Suficiência amostral para diagnóstico organizacional"],
                  ].map(([tam, n, just], i) => (
                    <tr key={i} style={{ background: i % 2 === 0 ? "#f0fdf4" : "#fff" }}>
                      <td style={{ padding: "4px 10px", border: "1px solid #d1fae5" }}>{tam}</td>
                      <td style={{ padding: "4px 10px", textAlign: "center", fontWeight: 700, border: "1px solid #d1fae5" }}>{n}</td>
                      <td style={{ padding: "4px 10px", border: "1px solid #d1fae5" }}>{just}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {card(<>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Tipo de Representante">
                  <Select value={a3.tipoRepresentante} onChange={s3("tipoRepresentante")} options={[
                    { value: "", label: "Selecione..." },
                    { value: "senioridade", label: "Por Senioridade" },
                    { value: "sorteio", label: "Sorteio / Voluntário" },
                    { value: "cipa", label: "Membro CIPA / Designado" },
                  ]} />
                </Field>
                <Field label="Setor / GHE"><Input value={a3.setor} onChange={s3("setor")} placeholder="Setor" /></Field>
                <Field label="Data"><Input value={a3.data} onChange={s3("data")} type="date" /></Field>
              </div>
            </>)}
            {FATORES.map(f => {
              const ntepIds = getFatoresByCnae(ident.cnae) || [];
              const isNtep = ntepIds.includes(f.id);
              return (
              <div key={f.id} style={{ background: isNtep ? "#fffbeb" : "#fff", border: `1px solid ${isNtep ? "#fcd34d" : "#e2e8f0"}`, borderRadius: 8, padding: 14, marginBottom: 10 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10, marginBottom: 10 }}>
                  <span style={{ background: "#0f2744", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700, flexShrink: 0 }}>{f.id}</span>
                  <div style={{ flex: 1 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                      <span style={{ fontWeight: 700, fontSize: 13, color: "#1e3a5f" }}>{f.label}</span>
                      <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 700,
                        background: f.perguntaEixo4.tipo === "Invertida" ? "#dbeafe" : "#fef3c7",
                        color: f.perguntaEixo4.tipo === "Invertida" ? "#1d4ed8" : "#92400e" }}>
                        {f.perguntaEixo4.tipo === "Invertida" ? "↩ Invertida" : "→ Direta"}
                      </span>
                      {isNtep && <span style={{ fontSize: 10, padding: "1px 7px", borderRadius: 10, fontWeight: 700, background: "#fef3c7", color: "#92400e" }}>⚖️ NTEP</span>}
                    </div>
                    <p style={{ fontSize: 12, color: "#334155", margin: "0 0 10px", lineHeight: 1.5, fontStyle: "italic" }}>
                      "{f.perguntaEixo4.texto}"
                    </p>
                    <div style={{ display: "flex", gap: 6 }}>
                      {[
                        { v: "1", label: "1 – Nunca/Raro" },
                        { v: "2", label: "2 – Ocasional" },
                        { v: "3", label: "3 – Frequente" },
                        { v: "4", label: "4 – Sempre/Constante" },
                      ].map(opt => (
                        <label key={opt.v} style={{ display: "flex", alignItems: "center", gap: 4, cursor: "pointer",
                          padding: "4px 10px", borderRadius: 6, fontSize: 11, fontWeight: 600,
                          border: `1.5px solid ${a3[`f${f.id}_valida`] === opt.v ? "#1e3a5f" : "#e2e8f0"}`,
                          background: a3[`f${f.id}_valida`] === opt.v ? "#1e3a5f" : "#f8fafc",
                          color: a3[`f${f.id}_valida`] === opt.v ? "#fff" : "#475569" }}>
                          <input type="radio" name={`valida_${f.id}`} value={opt.v}
                            checked={a3[`f${f.id}_valida`] === opt.v}
                            onChange={() => s3(`f${f.id}_valida`)(opt.v)}
                            style={{ display: "none" }} />
                          {opt.label}
                        </label>
                      ))}
                    </div>
                  </div>
                </div>
              </div>
              );
            })}
            <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: 14 }}>
              <Field label="Comentários ou Ressalvas do Trabalhador">
                <Textarea value={a3.comentarios} onChange={s3("comentarios")} placeholder="Observações adicionais..." rows={3} />
              </Field>
            </div>
          </>
        )}

        {/* ── TAB 5: Anexo IV ── */}
        {tab === 5 && (
          <>
            {sectionTitle("Anexo V – Termo de Consulta e Consentimento Livre e Esclarecido (NR-01)")}
            {card(<>
              <div style={{ background: "#eff6ff", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 12, color: "#1e3a5f", lineHeight: 1.6 }}>
                <strong>Referência Legal:</strong> NR-01 (Item 1.5.3.3, alínea "f") – Consulta aos Trabalhadores.<br />
                Esta consulta foi realizada de forma estritamente voluntária e confidencial, sem coação gerencial.
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                <Field label="Empresa (Razão Social)"><Input value={a4.empresa} onChange={s4("empresa")} placeholder="Razão social" /></Field>
                <Field label="CNPJ"><Input value={a4.cnpj} onChange={s4("cnpj")} placeholder="XX.XXX.XXX/0001-XX" /></Field>
                <Field label="GHE Validado"><Input value={a4.ghe} onChange={s4("ghe")} placeholder="Nome do setor/GHE" /></Field>
                <Field label="Data da Consulta"><Input value={a4.data} onChange={s4("data")} type="date" /></Field>
              </div>
            </>)}
            {card(<>
              <h4 style={{ margin: "0 0 12px", color: "#1e3a5f" }}>Parecer Oficial dos Representantes</h4>
              <Field label="O levantamento...">
                <Select value={a4.parecer} onChange={s4("parecer")} options={[
                  { value: "", label: "Selecione o parecer..." },
                  { value: "integro", label: "Reflete integralmente a realidade operacional" },
                  { value: "ressalvas", label: "Reflete a realidade, com ressalvas descritas abaixo" },
                  { value: "nao", label: "NÃO reflete a realidade organizacional do setor" },
                ]} />
              </Field>
              <Field label="Ressalvas / Observações dos Trabalhadores">
                <Textarea value={a4.ressalvas} onChange={s4("ressalvas")} placeholder="Espaço para o trabalhador acrescentar observações..." rows={3} />
              </Field>
            </>)}
            {card(<>
              <h4 style={{ margin: "0 0 12px", color: "#1e3a5f" }}>Assinaturas</h4>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 12 }}>
                <Field label="Representante 1 – Nome"><Input value={a4.rep1nome} onChange={s4("rep1nome")} /></Field>
                <Field label="CPF"><Input value={a4.rep1cpf} onChange={s4("rep1cpf")} placeholder="000.000.000-00" /></Field>
                <Field label="Critério"><Select value={a4.rep1criterio} onChange={s4("rep1criterio")} options={[{ value: "", label: "..." }, { value: "senioridade", label: "Senioridade" }, { value: "sorteio", label: "Sorteio/Voluntário" }]} /></Field>
                <Field label="Representante 2 – Nome"><Input value={a4.rep2nome} onChange={s4("rep2nome")} /></Field>
                <Field label="CPF"><Input value={a4.rep2cpf} onChange={s4("rep2cpf")} placeholder="000.000.000-00" /></Field>
                <Field label="Critério"><Select value={a4.rep2criterio} onChange={s4("rep2criterio")} options={[{ value: "", label: "..." }, { value: "senioridade", label: "Senioridade" }, { value: "sorteio", label: "Sorteio/Voluntário" }]} /></Field>
                <Field label="Designado NR-05 / CIPA – Nome"><Input value={a4.cipa} onChange={s4("cipa")} /></Field>
                <Field label="CPF"><Input value={a4.cipacpf} onChange={s4("cipacpf")} placeholder="000.000.000-00" /></Field>
              </div>

            </>)}
          </>
        )}

        {/* ── TAB 6: Cálculo de Risco ── */}
        {tab === 6 && (
          <>
            {sectionTitle("Tetra-angulação de Evidências — Matriz de Risco NR = S × P")}
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 14, marginBottom: 16, fontSize: 12 }}>
              <div style={{ fontWeight: 700, color: "#0f2744", marginBottom: 6, fontSize: 13 }}>📐 Tetra-angulação de Evidências em Macroergonomia — NR = S × P</div>
              <div style={{ color: "#334155", marginBottom: 8, lineHeight: 1.6 }}>
                <strong>Faixas:</strong> Baixo 1–4 (monitoramento) · Moderado 6–9 (planejar melhorias) · Crítico 12–16 (intervenção imediata)<br />
                <strong>Severidade (S):</strong> fixa por fator — magnitude clínica do agravo potencial (Guia SIT/ENIT / CID-11 / NTEP / Decreto 3.048/1999).<br />
                <strong>Probabilidade (P):</strong> determinada pela <em>convergência dos 4 Eixos</em> analíticos (pareamento de padrões — Yin, 2015).
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8, marginBottom: 10, fontSize: 11 }}>
                <div style={{ background: "#e0f2fe", border: "1px solid #7dd3fc", borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ fontWeight: 700, color: "#0369a1", marginBottom: 2 }}>Eixo I — Epidemiológico</div>
                  <div style={{ color: "#0c4a6e" }}>Indicadores de gestão: afastamentos INSS, CIDs Grupo F, CATs, absenteísmo, turnover e CNAE/NTEP (Anexo I)</div>
                </div>
                <div style={{ background: "#fef3c7", border: "1px solid #fcd34d", borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ fontWeight: 700, color: "#92400e", marginBottom: 2 }}>Eixo II — Laboral In Loco</div>
                  <div style={{ color: "#78350f" }}>Observação técnica dos fluxos, exigências cognitivas e discrepância trabalho prescrito × real (Anexo II-A/B)</div>
                </div>
                <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: 6, padding: "8px 10px" }}>
                  <div style={{ fontWeight: 700, color: "#15803d", marginBottom: 2 }}>Eixo III — Validação Participativa</div>
                  <div style={{ color: "#14532d" }}>Relato sigiloso dos representantes do GHE, coletado sem intermediação hierárquica (Anexo III)</div>
                </div>
              </div>
              <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                <div style={{ flex: 1, minWidth: 260, background: "#dbeafe", border: "1px solid #93c5fd", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontWeight: 700, color: "#1e3a5f", marginBottom: 4 }}>🔺 Tetra-angulação Completa (recomendado)</div>
                  <div style={{ color: "#334155", marginBottom: 8, fontSize: 11 }}>P calculado pela convergência dos <strong>3 eixos</strong>. Isolamento automático do efeito Spillover pelo pareamento de padrões.</div>
                  <button onClick={calcRiskInteligente} style={{ padding: "6px 16px", background: "#1e3a5f", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    🔺 Calcular por Tetra-angulação (Eixos I + II + III + IV)
                  </button>
                </div>
                <div style={{ flex: 1, minWidth: 260, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ fontWeight: 700, color: "#475569", marginBottom: 4 }}>⚡ Biaxial — Sem Eixo I</div>
                  <div style={{ color: "#64748b", marginBottom: 8, fontSize: 11 }}>Usa apenas Eixos II e III quando o Eixo I (Anexo I / RH) não está disponível. Princípio da Precaução (NR-01).</div>
                  <button onClick={calcRisk} style={{ padding: "6px 16px", background: "#64748b", color: "#fff", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700 }}>
                    ⚡ Calcular Biaxial (Eixos II + III apenas)
                  </button>
                </div>
              </div>
              <div style={{ marginTop: 8, fontSize: 11, color: "#64748b" }}>
                💡 Ajuste <strong>P</strong> manualmente se necessário — a S 🔒 é sempre fixa. Se o relato (Eixo III) contradiz o Eixo I e II, o sistema sinalizará ruído de percepção / efeito Spillover.
              </div>
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse", background: "#fff", borderRadius: 10, overflow: "hidden", boxShadow: "0 1px 4px rgba(0,0,0,0.07)" }}>
              <thead>
                <tr style={{ background: "#0f2744", color: "#fff" }}>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12 }}>#</th>
                  <th style={{ padding: "10px 12px", textAlign: "left", fontSize: 12 }}>Fator de Risco (Guia SIT/ENIT)</th>
                  <th style={{ padding: "10px 12px", fontSize: 11, textAlign: "center" }} title="Eixo II — Grau de exposição observado in loco">Eixo II<br/>Grau</th>
                  <th style={{ padding: "10px 12px", fontSize: 11, textAlign: "center" }} title="Eixo III — Validação pelos representantes do GHE">Eixo III<br/>Valida?</th>
                  <th style={{ padding: "10px 12px", fontSize: 12 }}>P (Convergência dos Eixos)</th>
                  <th style={{ padding: "10px 12px", fontSize: 12 }} title="Severidade — fixa por fator, conforme magnitude clínica do agravo potencial (Guia SIT/ENIT / CID-11 / NTEP). Independe de dados históricos da empresa.">S 🔒<br/><span style={{ fontSize: 10, fontWeight: 400 }}>CID-11/NTEP</span></th>
                  <th style={{ padding: "10px 12px", fontSize: 12 }}>NR = S×P</th>
                  <th style={{ padding: "10px 12px", fontSize: 12 }}>Classificação</th>
                </tr>
              </thead>
              <tbody>
                {FATORES.map((f, i) => {
                  const p = risk[`f${f.id}_p`] || 0;
                  // S é sempre o sevBase clínico do fator — se ainda não foi salvo no state, usa o sevBase
                  const sSaved = risk[`f${f.id}_s`] || 0;
                  const s = sSaved > 0 ? sSaved : f.sevBase;
                  const v = p * s;
                  const rl = p > 0 ? riskLevel(p, s) : null;
                  const grau = a2a[`f${f.id}_grau`];
                  const val = a3[`f${f.id}_valida`];
                  const sevColors = { 1: { bg: "#f0fdf4", color: "#15803d" }, 2: { bg: "#fefce8", color: "#854d0e" }, 3: { bg: "#fff7ed", color: "#c2410c" }, 4: { bg: "#fef2f2", color: "#991b1b" } };
                  const sc = sevColors[s] || sevColors[1];
                  return (
                    <tr key={f.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
                      <td style={{ padding: "10px 12px", fontSize: 12, color: "#64748b" }}>{f.id}</td>
                      <td style={{ padding: "10px 12px", fontSize: 13, fontWeight: 600 }}>{f.label}</td>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 12 }}>
                        <span style={{ background: grau >= 2 ? "#fee2e2" : "#f1f5f9", color: grau >= 2 ? "#991b1b" : "#475569", padding: "2px 8px", borderRadius: 4, fontWeight: 700 }}>{grau}</span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontSize: 12 }}>
                        {val === "confirma" ? "✅" : val === "nega" ? "❌" : "—"}
                      </td>
                      <td style={{ padding: "6px 12px" }}>
                        <select value={p} onChange={e => setRiskField(f.id, "p")(e.target.value)}
                          style={{ padding: "4px 6px", border: "1px solid #e2e8f0", borderRadius: 4, fontSize: 11, width: "100%" }}>
                          <option value={0}>— Não avaliado</option>
                          {[1,2,3,4].map(n => <option key={n} value={n}>{probLabels[n]}</option>)}
                        </select>
                      </td>
                      <td style={{ padding: "8px 12px", textAlign: "center" }}>
                        <span title={`S${s} – ${sevLabels[s]?.split("–")[1]?.trim() || ""} | ${f.justificativa} | ${f.modelo}`}
                          style={{ background: sc.bg, color: sc.color, border: `1px solid ${sc.color}`, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800, cursor: "help" }}>
                          S{s} 🔒
                        </span>
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "center", fontWeight: 800, fontSize: 15, color: rl ? rl.color : "#94a3b8" }}>
                        {v > 0 ? v : "—"}
                      </td>
                      <td style={{ padding: "8px 12px" }}>
                        {rl ? (
                          <span style={{ background: rl.bg, color: rl.color, border: `1.5px solid ${rl.color}`, padding: "3px 10px", borderRadius: 20, fontSize: 11, fontWeight: 800 }}>
                            {rl.label}
                          </span>
                        ) : <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {riscos.length > 0 && (
              <div style={{ marginTop: 20, background: riskLevel(1, riscos.reduce((max, r) => r.v > max ? r.v : max, 0) >= 12 ? 4 : riscos.reduce((max, r) => r.v > max ? r.v : max, 0) >= 6 ? 3 : 2).bg || "#f0fdf4",
                border: "2px solid", borderColor: overall === "CRÍTICO" ? "#7f1d1d" : overall === "MODERADO" ? "#92400e" : "#1e3a5f",
                borderRadius: 10, padding: 20, textAlign: "center" }}>
                <div style={{ fontSize: 12, color: "#64748b", marginBottom: 4 }}>NÍVEL DE RISCO ERGONÔMICO GLOBAL DO GHE — {ghe.nome || `GHE ${activeGHE+1}`}</div>
                <div style={{ fontSize: 36, fontWeight: 900, color: overall === "CRÍTICO" ? "#7f1d1d" : overall === "MODERADO" ? "#92400e" : "#14532d" }}>
                  {overall}
                </div>
                <div style={{ fontSize: 12, color: "#64748b", marginTop: 4 }}>
                  {criticos.length > 0 && `${criticos.length} fator(es) crítico(s): ${criticos.map(r => r.label).join(", ")}`}
                  {altos.length > 0 && ` | ${altos.length} fator(es) alto(s): ${altos.map(r => r.label).join(", ")}`}
                </div>
              </div>
            )}
          </>
        )}

        {/* ── TAB 7: Plano de Ação ── */}
        {tab === 7 && (
          <>
            {sectionTitle(`📋 Plano de Ação Preventiva e Corretiva — ${ghe.nome || `GHE ${activeGHE+1}`}`)}
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: "#1e3a5f" }}>
              💡 As ações são geradas <strong>automaticamente</strong> ao usar o <strong>🧠 Cálculo Inteligente</strong> (com dados dos Anexos) ou ao definir P e S manualmente na aba <strong>Cálculo de Risco</strong>. O botão Precaução é alternativo para quando o Anexo I não estiver disponível. Edições manuais nas ações são sempre preservadas.
            </div>
            {FATORES.map(f => {
              const p = risk[`f${f.id}_p`] || 0;
              const s = risk[`f${f.id}_s`] || 0;
              const v = p * s;
              const rl = v > 0 ? riskLevel(p, s) : null;
              const acoes = ghe.acoes[`f${f.id}_acoes`] || [];
              if (!rl && acoes.length === 0) return null;
              return (
                <div key={f.id} style={{ background: "#fff", border: `1.5px solid ${rl ? rl.color : "#e2e8f0"}`, borderRadius: 10, marginBottom: 14, overflow: "hidden" }}>
                  <div style={{ background: rl ? rl.bg : "#f8fafc", padding: "10px 16px", display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ background: "#0f2744", color: "#fff", borderRadius: 4, padding: "2px 8px", fontSize: 11, fontWeight: 700 }}>{f.id}</span>
                    <span style={{ fontWeight: 700, fontSize: 13, color: "#1e3a5f" }}>{f.label}</span>
                    {rl && <span style={{ marginLeft: "auto", background: rl.bg, color: rl.color, border: `1px solid ${rl.color}`, padding: "2px 10px", borderRadius: 20, fontWeight: 800, fontSize: 11 }}>{rl.label} (P{p}×S{s}={v})</span>}
                  </div>
                  <div style={{ padding: "12px 16px" }}>
                    {acoes.length === 0 && <p style={{ color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>Nenhuma ação cadastrada. Use o botão abaixo para adicionar.</p>}
                    {acoes.map((a, aIdx) => (
                      <div key={aIdx} style={{ display: "grid", gridTemplateColumns: "140px 140px 1fr 32px", gap: 8, alignItems: "start", marginBottom: 8, background: "#f8fafc", borderRadius: 8, padding: 10 }}>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3, textTransform: "uppercase" }}>Tipo</label>
                          <select value={a.tipo} onChange={e => updateAcaoField(f.id, aIdx, "tipo")(e.target.value)}
                            style={{ width: "100%", padding: "5px 6px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, background: "#fff" }}>
                            {["Imediata","Administrativa","Organizacional","Médica (PCMSO)","Preventiva","Monitoramento","Engenharia","Treinamento"].map(t => <option key={t}>{t}</option>)}
                          </select>
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3, textTransform: "uppercase" }}>Prazo</label>
                          <input value={a.prazo} onChange={e => updateAcaoField(f.id, aIdx, "prazo")(e.target.value)}
                            placeholder="Ex: 30 dias" style={{ width: "100%", padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, background: "#fff", boxSizing: "border-box" }} />
                        </div>
                        <div>
                          <label style={{ fontSize: 10, fontWeight: 700, color: "#64748b", display: "block", marginBottom: 3, textTransform: "uppercase" }}>Descrição da Ação</label>
                          <textarea value={a.acao} onChange={e => updateAcaoField(f.id, aIdx, "acao")(e.target.value)} rows={2}
                            style={{ width: "100%", padding: "5px 8px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 11, background: "#fff", resize: "vertical", boxSizing: "border-box" }} />
                          <input value={a.responsavel} onChange={e => updateAcaoField(f.id, aIdx, "responsavel")(e.target.value)}
                            placeholder="Responsável pela execução" style={{ width: "100%", padding: "4px 8px", border: "1px solid #e2e8f0", borderRadius: 5, fontSize: 10, background: "#fff", boxSizing: "border-box", marginTop: 4, color: "#64748b" }} />
                        </div>
                        <button onClick={() => removeAcao(f.id, aIdx)} style={{ padding: "4px 6px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 5, cursor: "pointer", fontSize: 13, marginTop: 16 }}>✕</button>
                      </div>
                    ))}
                    <button onClick={() => addAcao(f.id)} style={{ padding: "5px 14px", background: "#eff6ff", color: "#1e3a5f", border: "1px dashed #93c5fd", borderRadius: 6, cursor: "pointer", fontSize: 11, fontWeight: 700 }}>
                      + Adicionar Ação
                    </button>
                  </div>
                </div>
              );
            })}
          </>
        )}

        {/* ── TAB 8: Termos Assinados ── */}
        {tab === 8 && (
          <>
            {sectionTitle(`📎 Termos de Consentimento Assinados — ${ghe.nome || `GHE ${activeGHE+1}`}`)}
            <div style={{ background: "#eff6ff", border: "1px solid #bfdbfe", borderRadius: 8, padding: 12, marginBottom: 16, fontSize: 12, color: "#1e3a5f" }}>
              📌 Faça upload dos termos de consentimento assinados (Anexo IV) em formato PDF, JPG ou PNG. Os arquivos ficam vinculados ao GHE ativo e aparecem no relatório.
            </div>
            {/* Upload area */}
            <div style={{ background: "#fff", border: "2px dashed #bfdbfe", borderRadius: 12, padding: 32, textAlign: "center", marginBottom: 20, cursor: "pointer" }}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); Array.from(e.dataTransfer.files).forEach(addTermo); }}>
              <div style={{ fontSize: 40, marginBottom: 8 }}>📄</div>
              <p style={{ margin: "0 0 12px", color: "#64748b", fontSize: 13 }}>Arraste arquivos aqui ou clique para selecionar</p>
              <p style={{ margin: "0 0 16px", color: "#94a3b8", fontSize: 11 }}>PDF, PNG, JPG — múltiplos arquivos permitidos</p>
              <label style={{ padding: "8px 20px", background: "#1e3a5f", color: "#fff", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: 700 }}>
                📁 Selecionar Arquivos
                <input type="file" multiple accept=".pdf,.jpg,.jpeg,.png" style={{ display: "none" }}
                  onChange={e => Array.from(e.target.files).forEach(addTermo)} />
              </label>
            </div>
            {/* File list */}
            {(ghe.termos || []).length === 0 ? (
              <p style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 13, textAlign: "center" }}>Nenhum arquivo enviado ainda.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                {(ghe.termos || []).map((t, tIdx) => (
                  <div key={tIdx} style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 16px", display: "flex", alignItems: "center", gap: 12 }}>
                    <div style={{ fontSize: 28 }}>{t.type === "application/pdf" ? "📕" : "🖼️"}</div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13, color: "#1e3a5f" }}>{t.name}</div>
                      <div style={{ fontSize: 11, color: "#94a3b8" }}>Enviado em {t.uploadedAt}</div>
                    </div>
                    {t.type !== "application/pdf" && (
                      <img src={t.data} alt={t.name} style={{ height: 60, width: 80, objectFit: "cover", borderRadius: 6, border: "1px solid #e2e8f0" }} />
                    )}
                    {t.type === "application/pdf" && (
                      <a href={t.data} download={t.name} style={{ padding: "5px 12px", background: "#eff6ff", color: "#1e3a5f", border: "1px solid #bfdbfe", borderRadius: 6, fontSize: 11, fontWeight: 700, textDecoration: "none" }}>⬇ Baixar</a>
                    )}
                    <button onClick={() => removeTermo(tIdx)} style={{ padding: "4px 8px", background: "#fee2e2", color: "#991b1b", border: "none", borderRadius: 6, cursor: "pointer", fontSize: 12 }}>✕</button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}

        {/* ── TAB 9: Relatório ── */}
        {tab === 9 && (() => {
          const date = new Date().toLocaleDateString("pt-BR");
          return (
            <>
              {sectionTitle("📄 Relatório Técnico – AEP")}
              {gheReports.map((rep, repIdx) => {
                const g = rep.ghe;
                const a1 = g.a1;
                const riscosOrdenados = [...rep.riscos].sort((a,b) => b.v - a.v);
                const criticos = rep.riscos.filter(r => r.rl.label === "CRÍTICO");
                const moderados = rep.riscos.filter(r => r.rl.label === "MODERADO");
                const baixos = rep.riscos.filter(r => r.rl.label === "BAIXO");
                const overallBg = rep.overall === "CRÍTICO" ? "#7f1d1d" : rep.overall === "MODERADO" ? "#92400e" : "#14532d";
                const getRiscoColor = (label) =>
                  label === "CRÍTICO" ? { bar:"#dc2626", bg:"#fee2e2", text:"#7f1d1d" }
                  : label === "MODERADO" ? { bar:"#2563eb", bg:"#eff6ff", text:"#1e40af" }
                  : { bar:"#16a34a", bg:"#f0fdf4", text:"#166534" };

                return (
                  <div key={g.id} style={{ background:"#fff", fontFamily:"Arial, sans-serif", fontSize:11, color:"#1a1a1a", border:"1px solid #cbd5e1", borderRadius:4, marginBottom:32, pageBreakAfter:"always", overflow:"hidden" }}>

                    {/* CABEÇALHO */}
                    <div style={{ background:"#0f2744", padding:"20px 32px 18px", display:"flex", justifyContent:"space-between", alignItems:"flex-start" }}>
                      <div>
                        <div style={{ fontSize:9, fontWeight:700, letterSpacing:3, color:"#93c5fd", textTransform:"uppercase", marginBottom:6 }}>AMBRAC · MEDICINA E SEGURANÇA DO TRABALHO</div>
                        <div style={{ fontSize:18, fontWeight:900, color:"#fff", lineHeight:1.2, marginBottom:4 }}>AVALIAÇÃO ERGONÔMICA PRELIMINAR</div>
                        <div style={{ fontSize:10, color:"#bfdbfe", marginBottom:8 }}>Mapeamento de Fatores de Risco Psicossociais e Organizacionais</div>
                        <div style={{ fontSize:8.5, color:"#93c5fd", lineHeight:1.7 }}>
                          Metodologia: Tetra-angulação de Evidências em Macroergonomia<br/>
                          Guia SIT/ENIT (2020) · ISO 45003 (2021) · NR-01 / NR-17 · Pareamento de Padrões (Yin, 2015)
                        </div>
                      </div>
                      <div style={{ textAlign:"right", color:"#bfdbfe", fontSize:9 }}>
                        <div style={{ fontSize:28, color:"#fff", marginBottom:6 }}>⚙</div>
                        <div>Brasília/DF · {date}</div>
                        <div style={{ marginTop:3, fontWeight:700, color:"#fff" }}>GHE: {g.nome || `GHE ${repIdx+1}`}</div>
                        <div style={{ marginTop:2 }}>Laudo nº {String(repIdx+1).padStart(3,"0")}/{new Date().getFullYear()}</div>
                      </div>
                    </div>

                    {/* NÍVEL GLOBAL */}
                    <div style={{ background:overallBg, padding:"10px 32px", display:"flex", alignItems:"center", gap:16 }}>
                      <div style={{ color:"#fff", fontWeight:900, fontSize:16, letterSpacing:2 }}>{rep.overall}</div>
                      <div style={{ width:1, height:20, background:"rgba(255,255,255,0.35)" }}/>
                      <div style={{ color:"#fff", fontSize:9 }}>NÍVEL DE RISCO PSICOSSOCIAL GLOBAL · {g.nome || `GHE ${repIdx+1}`}</div>
                      <div style={{ marginLeft:"auto", color:"#fff", fontSize:9 }}>
                        {criticos.length > 0 && <span style={{ marginRight:10 }}>⚠ {criticos.length} fator(es) CRÍTICO(s)</span>}
                        {moderados.length > 0 && <span>{moderados.length} MODERADO(s)</span>}
                      </div>
                    </div>

                    <div style={{ padding:"24px 32px" }}>

                      {/* 1. IDENTIFICAÇÃO */}
                      <div style={{ marginBottom:22 }}>
                        <div style={{ background:"#0f2744", color:"#fff", fontWeight:700, fontSize:10, padding:"5px 12px", letterSpacing:1, textTransform:"uppercase" }}>1. IDENTIFICAÇÃO INSTITUCIONAL</div>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, border:"1px solid #e2e8f0" }}>
                          <tbody>
                            {[
                              ["Razão Social", ident.empresa||"[não informado]", "CNPJ", ident.cnpj||"[não informado]"],
                              ["CNAE / Grau de Risco", ident.cnae?`${ident.cnae} / GR ${ident.gr||"—"}`:"[não informado]", "Endereço", ident.endereco||"[não informado]"],
                              ["GHEs Avaliados", ghes.map(g=>g.nome||"GHE").join(", "), "Data da Inspeção", ident.dataInspecao||"[não informada]"],
                              ["Responsável Técnico", ident.responsavel||"[não informado]", "Data de Emissão", date],
                            ].map(([l1,v1,l2,v2],i)=>(
                              <tr key={i} style={{ background:i%2===0?"#f8fafc":"#fff" }}>
                                <td style={{ padding:"5px 10px", fontWeight:700, color:"#334155", width:"18%", borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>{l1}</td>
                                <td style={{ padding:"5px 10px", width:"30%", borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>{v1}</td>
                                <td style={{ padding:"5px 10px", fontWeight:700, color:"#334155", width:"18%", borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>{l2}</td>
                                <td style={{ padding:"5px 10px", borderBottom:"1px solid #e2e8f0" }}>{v2}</td>
                              </tr>
                            ))}
                            <tr style={{ background:"#eff6ff" }}>
                              <td style={{ padding:"5px 10px", fontWeight:700, color:"#1e40af", borderRight:"1px solid #e2e8f0" }}>NTEP</td>
                              <td colSpan={3} style={{ padding:"5px 10px" }}>Perfil epidemiológico verificado via Lista C, Anexo II, Decreto nº 3.048/1999 — {ident.cnae?`CNAE ${ident.cnae}`:"CNAE não informado"}</td>
                            </tr>
                          </tbody>
                        </table>
                      </div>

                      {/* 2. VIGILÂNCIA EPIDEMIOLÓGICA */}
                      <div style={{ marginBottom:22 }}>
                        <div style={{ background:"#0f2744", color:"#fff", fontWeight:700, fontSize:10, padding:"5px 12px", letterSpacing:1, textTransform:"uppercase" }}>2. VIGILÂNCIA EPIDEMIOLÓGICA — EIXO I</div>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, border:"1px solid #e2e8f0" }}>
                          <tbody>
                            {[
                              ["Afastamentos INSS (B31/B91)", a1.afastamentos||"0", "CIDs Grupo F", a1.cidsF||"—"],
                              ["CATs por adoecimento mental", a1.cats||"0", "Absenteísmo", a1.absenteismo?`${a1.absenteismo}%/mês`:"—"],
                              ["Turnover", a1.turnover?`${a1.turnover}%/ano`:"—", "Horas Extras", a1.horasExtras?`${a1.horasExtras} h/mês`:"—"],
                            ].map(([l1,v1,l2,v2],i)=>(
                              <tr key={i} style={{ background:i%2===0?"#f8fafc":"#fff" }}>
                                <td style={{ padding:"5px 10px", fontWeight:700, color:"#334155", width:"22%", borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>{l1}</td>
                                <td style={{ padding:"5px 10px", fontWeight:700, color:"#0f2744", width:"14%", borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>{v1}</td>
                                <td style={{ padding:"5px 10px", fontWeight:700, color:"#334155", width:"22%", borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>{l2}</td>
                                <td style={{ padding:"5px 10px", fontWeight:700, color:"#0f2744", borderBottom:"1px solid #e2e8f0" }}>{v2}</td>
                              </tr>
                            ))}
                            {a1.queixas && (
                              <tr><td style={{ padding:"5px 10px", fontWeight:700, color:"#334155", borderRight:"1px solid #e2e8f0" }}>Queixas de saúde</td><td colSpan={3} style={{ padding:"5px 10px" }}>{a1.queixas}</td></tr>
                            )}
                          </tbody>
                        </table>
                      </div>

                      {/* 3. GRÁFICO BARRAS */}
                      {rep.riscos.length > 0 && (
                        <div style={{ marginBottom:22 }}>
                          <div style={{ background:"#0f2744", color:"#fff", fontWeight:700, fontSize:10, padding:"5px 12px", letterSpacing:1, textTransform:"uppercase" }}>3. DIAGNÓSTICO POR FATOR DE RISCO PSICOSSOCIAL</div>
                          <div style={{ border:"1px solid #e2e8f0", borderTop:"none", padding:"16px 16px 8px" }}>
                            <div style={{ fontSize:9, color:"#64748b", marginBottom:12, textAlign:"right" }}>Escala P×S · máx. 16</div>
                            {riscosOrdenados.map((r,i)=>{
                              const pct=Math.round((r.v/16)*100);
                              const cls=getRiscoColor(r.rl.label);
                              return (
                                <div key={r.id} style={{ display:"flex", alignItems:"center", gap:10, marginBottom:7, background:i%2===0?"#f8fafc":"#fff", padding:"4px 8px", borderRadius:3 }}>
                                  <div style={{ width:220, fontSize:10, fontWeight:600, color:"#334155", flexShrink:0 }}>{r.label}</div>
                                  <div style={{ flex:1, background:"#e2e8f0", borderRadius:2, height:14, position:"relative" }}>
                                    <div style={{ position:"absolute", left:0, top:0, height:"100%", width:`${pct}%`, background:cls.bar, borderRadius:2 }}/>
                                  </div>
                                  <div style={{ width:28, fontSize:10, fontWeight:900, color:cls.text, textAlign:"center", flexShrink:0 }}>{r.v}</div>
                                  <div style={{ width:65, fontSize:9, fontWeight:700, color:cls.text, background:cls.bg, padding:"2px 6px", borderRadius:3, textAlign:"center", flexShrink:0 }}>{r.rl.label}</div>
                                  <div style={{ width:28, fontSize:9, color:"#64748b", textAlign:"center", flexShrink:0 }}>P{r.p}×S{r.s}</div>
                                </div>
                              );
                            })}
                            <div style={{ display:"flex", gap:20, marginTop:10, justifyContent:"flex-end" }}>
                              {[["#dc2626","CRÍTICO"],["#2563eb","MODERADO"],["#16a34a","BAIXO"]].map(([cor,lbl])=>(
                                <div key={lbl} style={{ display:"flex", alignItems:"center", gap:5, fontSize:9, color:"#475569" }}>
                                  <div style={{ width:12, height:12, background:cor, borderRadius:2 }}/>{lbl}
                                </div>
                              ))}
                            </div>
                          </div>
                        </div>
                      )}

                      {/* 3B. MAPA DE CALOR + MATRIZ */}
                      {rep.riscos.length > 0 && (
                        <div style={{ marginBottom:22 }}>
                          <div style={{ background:"#0f2744", color:"#fff", fontWeight:700, fontSize:10, padding:"5px 12px", letterSpacing:1, textTransform:"uppercase" }}>3B. MAPA DE CALOR — PROBABILIDADE × SEVERIDADE</div>
                          <div style={{ border:"1px solid #e2e8f0", borderTop:"none", padding:"16px" }}>
                            {/* MAPA DE CALOR */}
                      <h4 style={{ color: "#1e3a5f", borderLeft: "3px solid #1e3a5f", paddingLeft: 8, fontSize: 13, marginBottom: 8 }}>Mapa de Calor — Probabilidade × Severidade</h4>
                      <div style={{ marginBottom: 16, overflowX: "auto" }}>
                        <div style={{ display: "inline-block", minWidth: 340 }}>
                          {/* Y axis label */}
                          <div style={{ display: "flex", alignItems: "flex-end", gap: 4 }}>
                            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", marginRight: 4 }}>
                              <div style={{ fontSize: 9, color: "#64748b", writingMode: "vertical-rl", transform: "rotate(180deg)", marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>Probabilidade →</div>
                            </div>
                            <div>
                              {/* Grid header row */}
                              <div style={{ display: "flex", marginBottom: 2 }}>
                                <div style={{ width: 28 }}></div>
                                {[1,2,3,4].map(sv => (
                                  <div key={sv} style={{ width: 52, textAlign: "center", fontSize: 10, color: "#64748b", fontWeight: 700, paddingBottom: 2 }}>S{sv}</div>
                                ))}
                                <div style={{ width: 8 }}></div>
                                <div style={{ fontSize: 10, color: "#64748b", paddingLeft: 4, paddingBottom: 2, alignSelf: "flex-end" }}>→ Severidade</div>
                              </div>
                              {/* Grid rows P4 → P1 */}
                              {[4,3,2,1].map(pv => (
                                <div key={pv} style={{ display: "flex", alignItems: "center", marginBottom: 3 }}>
                                  <div style={{ width: 28, fontSize: 10, color: "#64748b", fontWeight: 700, textAlign: "right", paddingRight: 4 }}>P{pv}</div>
                                  {[1,2,3,4].map(sv => {
                                    const cellV = pv * sv;
                                    const rl = riskLevel(pv, sv);
                                    // Which factors land in this cell?
                                    const hits = rep.riscos.filter(r => r.p === pv && r.s === sv);
                                    return (
                                      <div key={sv} style={{
                                        width: 52, height: 44, background: rl.bg, border: `1.5px solid ${hits.length > 0 ? rl.color : "transparent"}`,
                                        borderRadius: 6, marginRight: 3, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
                                        position: "relative", boxShadow: hits.length > 0 ? `0 0 0 2px ${rl.color}` : "none"
                                      }}>
                                        <div style={{ fontSize: 13, fontWeight: 900, color: rl.color }}>{cellV}</div>
                                        {hits.length > 0 && (
                                          <div style={{ fontSize: 8, color: rl.color, fontWeight: 700, textAlign: "center", lineHeight: 1.1, maxWidth: 46, overflow: "hidden" }}>
                                            {hits.map(r => r.id).join(",")}
                                          </div>
                                        )}
                                      </div>
                                    );
                                  })}
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Legend */}
                          <div style={{ display: "flex", gap: 8, marginTop: 8, flexWrap: "wrap" }}>
                            {[["CRÍTICO","#fef2f2","#7f1d1d"],["MODERADO","#fffbeb","#92400e"],["BAIXO","#f0fdf4","#14532d"]].map(([l,bg,c]) => (
                              <div key={l} style={{ display: "flex", alignItems: "center", gap: 4, fontSize: 10 }}>
                                <div style={{ width: 12, height: 12, background: bg, border: `1.5px solid ${c}`, borderRadius: 3 }}></div>
                                <span style={{ color: c, fontWeight: 700 }}>{l}</span>
                              </div>
                            ))}
                            <span style={{ fontSize: 10, color: "#64748b", marginLeft: 8 }}>• Números = IDs dos fatores identificados na célula</span>
                          </div>
                          {/* Factor ID reference */}
                          {rep.riscos.length > 0 && (
                            <div style={{ marginTop: 8, display: "flex", flexWrap: "wrap", gap: 4 }}>
                              {rep.riscos.map(r => (
                                <span key={r.id} style={{ fontSize: 10, background: r.rl.bg, color: r.rl.color, border: `1px solid ${r.rl.color}`, padding: "1px 6px", borderRadius: 4, fontWeight: 700 }}>
                                  {r.id} – {r.label}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Matriz de Riscos */}
                      <h4 style={{ color: "#1e3a5f", borderLeft: "3px solid #1e3a5f", paddingLeft: 8, fontSize: 13, marginBottom: 8 }}>Matriz de Correlação e Resultados de Risco</h4>
                      {rep.riscos.length > 0 ? (
                        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 16, fontSize: 12 }}>
                          <thead>
                            <tr style={{ background: "#0f2744", color: "#fff" }}>
                              <th style={{ padding: "6px 8px", textAlign: "left" }}>Fator de Risco</th>
                              <th style={{ padding: "6px 8px", textAlign: "center" }}>P</th>
                              <th style={{ padding: "6px 8px", textAlign: "center" }}>S</th>
                              <th style={{ padding: "6px 8px", textAlign: "center" }}>P×S</th>
                              <th style={{ padding: "6px 8px", textAlign: "center" }}>Nível</th>
                              <th style={{ padding: "6px 8px", textAlign: "left" }}>Nexo (Decreto 3.048/99)</th>
                            </tr>
                          </thead>
                          <tbody>
                            {rep.riscos.map((r, i) => (
                              <tr key={r.id} style={{ background: i % 2 === 0 ? "#f8fafc" : "#fff", borderBottom: "1px solid #f1f5f9" }}>
                                <td style={{ padding: "6px 8px", fontWeight: 600 }}>{r.label}</td>
                                <td style={{ padding: "6px 8px", textAlign: "center" }}>{probLabels[r.p]?.split("–")[0]}</td>
                                <td style={{ padding: "6px 8px", textAlign: "center" }}>{sevLabels[r.s]?.split("–")[0]}</td>
                                <td style={{ padding: "6px 8px", textAlign: "center", fontWeight: 800 }}>{r.v}</td>
                                <td style={{ padding: "6px 8px", textAlign: "center" }}>
                                  <span style={{ background: r.rl.bg, color: r.rl.color, border: `1px solid ${r.rl.color}`, padding: "1px 8px", borderRadius: 20, fontWeight: 700, fontSize: 11 }}>{r.rl.label}</span>
                                </td>
                                <td style={{ padding: "6px 8px", fontSize: 11, color: "#64748b" }}>{r.cid}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      ) : <p style={{ color: "#94a3b8", fontStyle: "italic", fontSize: 12 }}>Nenhum fator avaliado neste GHE.</p>}
                          </div>
                        </div>
                      )}

                      {/* 4. MATRIZ CORRELAÇÃO */}
                      {rep.riscos.length > 0 && (
                        <div style={{ marginBottom:22 }}>
                          <div style={{ background:"#0f2744", color:"#fff", fontWeight:700, fontSize:10, padding:"5px 12px", letterSpacing:1, textTransform:"uppercase" }}>4. MATRIZ DE CORRELAÇÃO E RESULTADOS DE RISCO</div>
                          <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, border:"1px solid #e2e8f0" }}>
                            <thead>
                              <tr style={{ background:"#1e3a5f" }}>
                                <th style={{ padding:"7px 10px", color:"#fff", textAlign:"left", width:"35%", borderRight:"1px solid #2d4f7c" }}>FATOR DE RISCO</th>
                                <th style={{ padding:"7px 10px", color:"#fff", textAlign:"center", width:"6%", borderRight:"1px solid #2d4f7c" }}>P</th>
                                <th style={{ padding:"7px 10px", color:"#fff", textAlign:"center", width:"6%", borderRight:"1px solid #2d4f7c" }}>S</th>
                                <th style={{ padding:"7px 10px", color:"#fff", textAlign:"center", width:"8%", borderRight:"1px solid #2d4f7c" }}>P×S</th>
                                <th style={{ padding:"7px 10px", color:"#fff", textAlign:"center", width:"11%", borderRight:"1px solid #2d4f7c" }}>NÍVEL</th>
                                <th style={{ padding:"7px 10px", color:"#fff", textAlign:"left" }}>NEXO (DECRETO 3.048/99)</th>
                              </tr>
                            </thead>
                            <tbody>
                              {riscosOrdenados.map((r,i)=>{
                                const cls=getRiscoColor(r.rl.label);
                                return (
                                  <tr key={r.id} style={{ background:i%2===0?"#f8fafc":"#fff", borderBottom:"1px solid #e2e8f0" }}>
                                    <td style={{ padding:"6px 10px", fontWeight:600, borderRight:"1px solid #e2e8f0" }}>{r.label}</td>
                                    <td style={{ padding:"6px 10px", textAlign:"center", borderRight:"1px solid #e2e8f0" }}>P{r.p}</td>
                                    <td style={{ padding:"6px 10px", textAlign:"center", borderRight:"1px solid #e2e8f0" }}>S{r.s}</td>
                                    <td style={{ padding:"6px 10px", textAlign:"center", fontWeight:900, color:cls.text, borderRight:"1px solid #e2e8f0" }}>{r.v}</td>
                                    <td style={{ padding:"6px 10px", textAlign:"center", borderRight:"1px solid #e2e8f0" }}>
                                      <span style={{ fontWeight:700, color:cls.text, background:cls.bg, padding:"2px 8px", borderRadius:3, fontSize:9 }}>{r.rl.label}</span>
                                    </td>
                                    <td style={{ padding:"6px 10px", color:"#475569", fontSize:9.5 }}>{r.cid}</td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      )}

                      {/* 5. EIXOS */}
                      <div style={{ marginBottom:22 }}>
                        <div style={{ background:"#0f2744", color:"#fff", fontWeight:700, fontSize:10, padding:"5px 12px", letterSpacing:1, textTransform:"uppercase" }}>5. REGISTROS DA TETRA-ANGULAÇÃO DE EVIDÊNCIAS</div>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, border:"1px solid #e2e8f0" }}>
                          <thead>
                            <tr style={{ background:"#1e3a5f" }}>
                              <th style={{ padding:"6px 10px", color:"#fff", textAlign:"left", width:"22%", borderRight:"1px solid #2d4f7c" }}>EIXO</th>
                              <th style={{ padding:"6px 10px", color:"#fff", textAlign:"left", borderRight:"1px solid #2d4f7c" }}>INSTRUMENTO</th>
                              <th style={{ padding:"6px 10px", color:"#fff", textAlign:"center", width:"14%" }}>STATUS</th>
                            </tr>
                          </thead>
                          <tbody>
                            {[
                              ["Eixo I – Epidemiológico","Análise NTEP/CNAE, afastamentos B31/B91, CATs, absenteísmo, turnover e HE", g.a1.afastamentos||g.a1.cats?"✓ Preenchido":"— Pendente"],
                              ["Eixo II – Trabalho Prescrito","Entrevista gerencial — gestão normativa por fator de risco", Object.values(g.a2b||{}).some(v=>v)?"✓ Preenchido":"— Pendente"],
                              ["Eixo III – Observação In Loco","Checklist observacional — 12 domínios SIT/ENIT (2020)", Object.values(g.a2a||{}).some(v=>v)?"✓ Preenchido":"— Pendente"],
                              ["Eixo IV – Representantes","Validação qualitativa participativa — escala 1–4 com inversão", Object.values(g.a3||{}).some(v=>v)?"✓ Preenchido":"— Pendente"],
                            ].map(([eixo,instrumento,status],i)=>(
                              <tr key={i} style={{ background:i%2===0?"#f8fafc":"#fff", borderBottom:"1px solid #e2e8f0" }}>
                                <td style={{ padding:"6px 10px", fontWeight:700, color:"#0f2744", borderRight:"1px solid #e2e8f0" }}>{eixo}</td>
                                <td style={{ padding:"6px 10px", color:"#334155", borderRight:"1px solid #e2e8f0" }}>{instrumento}</td>
                                <td style={{ padding:"6px 10px", textAlign:"center", fontWeight:600, color:status.startsWith("✓")?"#166534":"#92400e" }}>{status}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>

                      {/* 6. CONCLUSÃO */}
                      <div style={{ marginBottom:22 }}>
                        <div style={{ background:"#0f2744", color:"#fff", fontWeight:700, fontSize:10, padding:"5px 12px", letterSpacing:1, textTransform:"uppercase" }}>6. CONCLUSÃO</div>
                        <div style={{ border:"1px solid #e2e8f0", borderTop:"none", padding:"14px 16px", background:"#f8fafc", fontSize:10, lineHeight:1.8 }}>
                          A organização do trabalho no <strong>GHE {g.nome||repIdx+1}</strong> apresenta exposição a Fatores de Risco Psicossociais de nível <strong style={{ color:rep.overall==="CRÍTICO"?"#7f1d1d":rep.overall==="MODERADO"?"#92400e":"#166534" }}>{rep.overall}</strong>.
                          {criticos.length>0&&(<> Fatores críticos: <strong>{criticos.map(r=>r.label).join(", ")}</strong>.</>)}
                          {moderados.length>0&&(<> Fatores moderados: <strong>{moderados.map(r=>r.label).join(", ")}</strong>.</>)}
                          {baixos.length>0&&(<> Fatores baixos: {baixos.map(r=>r.label).join(", ")}.</>)}
                          {` Validação participativa (Eixo IV): ${Object.values(g.a3||{}).some(v=>v)?"registrada":"ainda não registrada"}.`}
                          {criticos.length>0&&(
                            <div style={{ marginTop:10, background:"#fee2e2", border:"1px solid #fca5a5", borderRadius:4, padding:"8px 12px", fontSize:9.5, color:"#7f1d1d" }}>
                              ⚠️ <strong>Aprofundamento Obrigatório:</strong> Em razão dos fatores CRÍTICO(s) identificados ({criticos.map(r=>r.label).join(", ")}), recomenda-se AET aprofundada, conforme NR-17.
                            </div>
                          )}
                        </div>
                      </div>

                      {/* 7. RECOMENDAÇÕES */}
                      <div style={{ marginBottom:22 }}>
                        <div style={{ background:"#0f2744", color:"#fff", fontWeight:700, fontSize:10, padding:"5px 12px", letterSpacing:1, textTransform:"uppercase" }}>7. RECOMENDAÇÕES POR NÍVEL DE AÇÃO</div>
                        <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, border:"1px solid #e2e8f0" }}>
                          <thead>
                            <tr style={{ background:"#1e3a5f" }}>
                              <th style={{ padding:"6px 10px", color:"#fff", width:"12%", borderRight:"1px solid #2d4f7c" }}>FAIXA (P×S)</th>
                              <th style={{ padding:"6px 10px", color:"#fff", width:"12%", borderRight:"1px solid #2d4f7c" }}>NÍVEL</th>
                              <th style={{ padding:"6px 10px", color:"#fff", width:"20%", borderRight:"1px solid #2d4f7c" }}>INTERPRETAÇÃO</th>
                              <th style={{ padding:"6px 10px", color:"#fff" }}>RECOMENDAÇÃO</th>
                            </tr>
                          </thead>
                          <tbody>
                            <tr style={{ background:"#fee2e2" }}><td style={{ padding:"6px 10px", fontWeight:700, borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>12–16</td><td style={{ padding:"6px 10px", fontWeight:900, color:"#7f1d1d", borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>CRÍTICO</td><td style={{ padding:"6px 10px", borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>Exposição severa</td><td style={{ padding:"6px 10px", borderBottom:"1px solid #e2e8f0" }}>Ação imediata. Notificar SESMT. Avaliar AET completa (NR-17).</td></tr>
                            <tr style={{ background:"#eff6ff" }}><td style={{ padding:"6px 10px", fontWeight:700, borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>6–9</td><td style={{ padding:"6px 10px", fontWeight:900, color:"#1e40af", borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>MODERADO</td><td style={{ padding:"6px 10px", borderRight:"1px solid #e2e8f0", borderBottom:"1px solid #e2e8f0" }}>Exposição relevante</td><td style={{ padding:"6px 10px", borderBottom:"1px solid #e2e8f0" }}>Planejar ações com prazo definido. Incluir no PGR e PCMSO.</td></tr>
                            <tr style={{ background:"#f0fdf4" }}><td style={{ padding:"6px 10px", fontWeight:700, borderRight:"1px solid #e2e8f0" }}>1–4</td><td style={{ padding:"6px 10px", fontWeight:900, color:"#166534", borderRight:"1px solid #e2e8f0" }}>BAIXO</td><td style={{ padding:"6px 10px", borderRight:"1px solid #e2e8f0" }}>Situação favorável</td><td style={{ padding:"6px 10px" }}>Monitorar. Manter medidas preventivas.</td></tr>
                          </tbody>
                        </table>
                      </div>

                      {/* 8. PLANO RESUMIDO */}
                      {rep.riscos.length>0&&(()=>{
                        const acoesExibir=riscosOrdenados.slice(0,6).map(r=>{
                          const fatAcoes=ACOES_POR_FATOR[r.id];
                          const nivel=r.rl.label;
                          const nivelAcoes=fatAcoes?(fatAcoes[nivel]||fatAcoes["MODERADO"]||[]):[];
                          return { fator:r.label, nivel, cor:getRiscoColor(nivel), acoes:nivelAcoes.slice(0,2) };
                        }).filter(a=>a.acoes.length>0);
                        if(acoesExibir.length===0) return null;
                        return (
                          <div style={{ marginBottom:22 }}>
                            <div style={{ background:"#0f2744", color:"#fff", fontWeight:700, fontSize:10, padding:"5px 12px", letterSpacing:1, textTransform:"uppercase" }}>8. PLANO DE AÇÃO PREVENTIVA E CORRETIVA (RESUMO)</div>
                            <table style={{ width:"100%", borderCollapse:"collapse", fontSize:10, border:"1px solid #e2e8f0" }}>
                              <thead>
                                <tr style={{ background:"#1e3a5f" }}>
                                  <th style={{ padding:"6px 10px", color:"#fff", textAlign:"left", width:"28%", borderRight:"1px solid #2d4f7c" }}>FATOR DE RISCO</th>
                                  <th style={{ padding:"6px 10px", color:"#fff", textAlign:"center", width:"10%", borderRight:"1px solid #2d4f7c" }}>NÍVEL</th>
                                  <th style={{ padding:"6px 10px", color:"#fff", width:"14%", borderRight:"1px solid #2d4f7c" }}>TIPO</th>
                                  <th style={{ padding:"6px 10px", color:"#fff", width:"12%", borderRight:"1px solid #2d4f7c" }}>PRAZO</th>
                                  <th style={{ padding:"6px 10px", color:"#fff" }}>AÇÃO</th>
                                </tr>
                              </thead>
                              <tbody>
                                {acoesExibir.flatMap((a,i)=>
                                  a.acoes.map((ac,j)=>(
                                    <tr key={`${i}-${j}`} style={{ background:(i+j)%2===0?"#f8fafc":"#fff", borderBottom:"1px solid #e2e8f0" }}>
                                      {j===0&&<td rowSpan={a.acoes.length} style={{ padding:"6px 10px", fontWeight:600, borderRight:"1px solid #e2e8f0", verticalAlign:"top" }}>{a.fator}</td>}
                                      {j===0&&<td rowSpan={a.acoes.length} style={{ padding:"6px 10px", textAlign:"center", borderRight:"1px solid #e2e8f0", verticalAlign:"top" }}><span style={{ fontWeight:700, color:a.cor.text, background:a.cor.bg, padding:"2px 6px", borderRadius:3, fontSize:9 }}>{a.nivel}</span></td>}
                                      <td style={{ padding:"6px 10px", color:"#475569", borderRight:"1px solid #e2e8f0" }}>{ac.tipo}</td>
                                      <td style={{ padding:"6px 10px", color:"#475569", borderRight:"1px solid #e2e8f0" }}>{ac.prazo}</td>
                                      <td style={{ padding:"6px 10px", color:"#334155" }}>{ac.acao}</td>
                                    </tr>
                                  ))
                                )}
                              </tbody>
                            </table>
                          </div>
                        );
                      })()}

                      {/* ASSINATURA */}
                      <div style={{ marginTop:32, borderTop:"2px solid #0f2744", paddingTop:18, display:"flex", justifyContent:"space-between", alignItems:"flex-end" }}>
                        <div style={{ borderTop:"1.5px solid #334155", paddingTop:8, minWidth:240 }}>
                          <div style={{ fontWeight:800, fontSize:12, color:"#0f2744" }}>{ident.responsavel||"Responsável Técnico"}</div>
                          <div style={{ fontSize:10, color:"#475569" }}>{ident.tecnicoReg||"Registro Profissional"}</div>
                          <div style={{ fontSize:10, color:"#475569" }}>Elaborador do Laudo</div>
                        </div>
                        <div style={{ textAlign:"right" }}>
                          <div style={{ fontSize:11, color:"#0f2744", fontWeight:700 }}>AMBRAC · Medicina e Segurança do Trabalho</div>
                          <div style={{ fontSize:9, color:"#64748b" }}>Revisão nº00 · {date}</div>
                          <div style={{ fontSize:9, color:"#64748b" }}>NR-01 / NR-17 / Decreto 3.048/99</div>
                        </div>
                      </div>

                    </div>
                  </div>
                );
              })}

              <button onClick={()=>window.print()} style={{ marginTop:8, background:"#0f2744", color:"#fff", border:"none", borderRadius:8, padding:"10px 28px", fontSize:13, fontWeight:700, cursor:"pointer", display:"flex", alignItems:"center", gap:8 }}>
                🖨️ Imprimir / Salvar como PDF
              </button>
            </>
          );
        })()}
      </div>
    </div>
  );
}