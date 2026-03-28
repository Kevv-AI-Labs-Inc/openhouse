export type SupportedQaLanguage = "en" | "zh" | "es" | "fr" | "pt" | "ja" | "ko";

export type QaQuestionKey =
  | "summary"
  | "financial"
  | "building"
  | "schools"
  | "neighborhood"
  | "policies"
  | "interior"
  | "agentPrep"
  | "confirmCosts";

const QA_TRANSLATIONS: Record<
  SupportedQaLanguage,
  {
    languageName: string;
    fallbackReply: string;
    emptyTitle: string;
    emptyBody: string;
    askNextLabel: string;
    placeholder: string;
    bestAvailableAnswer: string;
    needsAgentConfirmation: string;
    checkedPublicSources: string;
    questions: Record<QaQuestionKey, string>;
  }
> = {
  en: {
    languageName: "English",
    fallbackReply:
      "I do not have enough reliable information to answer that clearly yet. Please confirm with the listing agent.",
    emptyTitle: "Ask about the property, neighborhood, costs, or next steps.",
    emptyBody: "Start with one of these questions if you want a faster answer.",
    askNextLabel: "Try asking next",
    placeholder: "Ask about taxes, schools, parking, commute...",
    bestAvailableAnswer: "Best available answer",
    needsAgentConfirmation: "Needs agent confirmation",
    checkedPublicSources: "Checked public web sources",
    questions: {
      summary: "Can you summarize the home's key specs and standout details?",
      financial: "What taxes, HOA, or monthly carrying costs should buyers know?",
      building: "What amenities, parking, laundry, or pet policies come with the property?",
      schools: "What school district or nearby schools serve this property?",
      neighborhood: "What is the neighborhood, transit, and nearby convenience like?",
      policies: "Are there any financing, occupancy, or sublet rules to know about?",
      interior: "What appliances, heating, or cooling systems are included?",
      agentPrep: "What questions do buyers most often ask about this listing?",
      confirmCosts: "What costs or building policies should buyers confirm?",
    },
  },
  zh: {
    languageName: "Chinese",
    fallbackReply:
      "我目前还没有足够可靠的信息来明确回答这个问题。建议向挂牌经纪人确认。",
    emptyTitle: "可以问房源本身、周边、持有成本，或下一步安排。",
    emptyBody: "如果想更快拿到答案，可以先点下面这些问题。",
    askNextLabel: "你还可以继续问",
    placeholder: "可以问学区、地税、车位、通勤……",
    bestAvailableAnswer: "基于现有信息的最佳回答",
    needsAgentConfirmation: "仍需经纪人确认",
    checkedPublicSources: "已查询公开网络信息",
    questions: {
      summary: "你能总结一下这套房的核心信息和亮点吗？",
      financial: "这套房的地税、HOA 或每月持有成本大概有哪些？",
      building: "这套房有哪些配套、车位、洗衣或宠物政策？",
      schools: "这套房对应的学区或附近学校有哪些？",
      neighborhood: "周边社区、交通和生活便利度怎么样？",
      policies: "这套房有没有融资、入住、转租之类的限制？",
      interior: "房子里包含哪些电器、供暖或空调系统？",
      agentPrep: "这套房买家最常问的问题有哪些？",
      confirmCosts: "这套房还有哪些费用或楼宇规则需要特别确认？",
    },
  },
  es: {
    languageName: "Spanish",
    fallbackReply:
      "Todavía no tengo información suficientemente confiable para responder eso con claridad. Conviene confirmarlo con el agente.",
    emptyTitle: "Pregunta sobre la propiedad, la zona, los costos o los próximos pasos.",
    emptyBody: "Si quieres una respuesta más rápida, empieza con una de estas preguntas.",
    askNextLabel: "También puedes preguntar",
    placeholder: "Pregunta por impuestos, escuelas, estacionamiento, transporte...",
    bestAvailableAnswer: "Mejor respuesta disponible",
    needsAgentConfirmation: "Requiere confirmación del agente",
    checkedPublicSources: "Se consultaron fuentes públicas",
    questions: {
      summary: "¿Puedes resumir los datos clave y los puntos fuertes de la propiedad?",
      financial: "¿Qué impuestos, HOA o costos mensuales deberían conocer los compradores?",
      building: "¿Qué amenidades, estacionamiento, lavandería o políticas de mascotas tiene la propiedad?",
      schools: "¿Qué distrito escolar o escuelas cercanas corresponden a esta propiedad?",
      neighborhood: "¿Cómo es la zona, el transporte y la conveniencia cercana?",
      policies: "¿Hay reglas de financiamiento, ocupación o subarrendamiento que debamos saber?",
      interior: "¿Qué electrodomésticos, calefacción o aire acondicionado están incluidos?",
      agentPrep: "¿Qué preguntas hacen con más frecuencia los compradores sobre esta propiedad?",
      confirmCosts: "¿Qué costos o reglas del edificio conviene confirmar?",
    },
  },
  fr: {
    languageName: "French",
    fallbackReply:
      "Je n’ai pas encore assez d’informations fiables pour répondre clairement à cela. Il vaut mieux le confirmer avec l’agent.",
    emptyTitle: "Posez une question sur le bien, le quartier, les coûts ou la suite.",
    emptyBody: "Si vous voulez une réponse plus rapide, commencez par l’une de ces questions.",
    askNextLabel: "Vous pouvez aussi demander",
    placeholder: "Demandez les taxes, les écoles, le parking, les transports...",
    bestAvailableAnswer: "Meilleure réponse disponible",
    needsAgentConfirmation: "À confirmer avec l’agent",
    checkedPublicSources: "Sources publiques consultées",
    questions: {
      summary: "Pouvez-vous résumer les caractéristiques clés et les points forts du bien ?",
      financial: "Quelles taxes, charges HOA ou coûts mensuels faut-il connaître ?",
      building: "Quels équipements, parkings, services de buanderie ou règles pour animaux sont inclus ?",
      schools: "Quel secteur scolaire ou quelles écoles proches desservent ce bien ?",
      neighborhood: "Comment est le quartier, les transports et la commodité au quotidien ?",
      policies: "Y a-t-il des règles sur le financement, l’occupation ou la sous-location ?",
      interior: "Quels appareils, systèmes de chauffage ou de climatisation sont inclus ?",
      agentPrep: "Quelles questions les acheteurs posent-ils le plus souvent sur ce bien ?",
      confirmCosts: "Quels coûts ou règles de l’immeuble faut-il confirmer ?",
    },
  },
  pt: {
    languageName: "Portuguese",
    fallbackReply:
      "Ainda não tenho informação confiável suficiente para responder isso com clareza. Vale confirmar com o corretor.",
    emptyTitle: "Pergunte sobre o imóvel, a região, os custos ou os próximos passos.",
    emptyBody: "Se quiser uma resposta mais rápida, comece por uma destas perguntas.",
    askNextLabel: "Você também pode perguntar",
    placeholder: "Pergunte sobre impostos, escolas, vaga, deslocamento...",
    bestAvailableAnswer: "Melhor resposta disponível",
    needsAgentConfirmation: "Precisa de confirmação do corretor",
    checkedPublicSources: "Fontes públicas consultadas",
    questions: {
      summary: "Você pode resumir os principais dados e destaques do imóvel?",
      financial: "Quais impostos, HOA ou custos mensais os compradores devem saber?",
      building: "Quais amenidades, vaga, lavanderia ou políticas para pets vêm com o imóvel?",
      schools: "Qual distrito escolar ou quais escolas próximas atendem este imóvel?",
      neighborhood: "Como é o bairro, o transporte e a conveniência ao redor?",
      policies: "Há regras sobre financiamento, ocupação ou sublocação que devemos saber?",
      interior: "Quais eletrodomésticos, aquecimento ou ar-condicionado estão incluídos?",
      agentPrep: "Quais perguntas os compradores mais fazem sobre este imóvel?",
      confirmCosts: "Quais custos ou regras do prédio convém confirmar?",
    },
  },
  ja: {
    languageName: "Japanese",
    fallbackReply:
      "この点については、まだ十分に信頼できる情報がありません。掲載エージェントへの確認をおすすめします。",
    emptyTitle: "物件情報、周辺環境、費用、次のステップについて質問できます。",
    emptyBody: "早く答えを知りたい場合は、まず下の質問から始めてください。",
    askNextLabel: "次におすすめの質問",
    placeholder: "税金、学校、駐車場、通勤などを質問できます…",
    bestAvailableAnswer: "現時点での最善回答",
    needsAgentConfirmation: "エージェント確認が必要です",
    checkedPublicSources: "公開情報も参照しました",
    questions: {
      summary: "この物件の基本情報と主な魅力をまとめてもらえますか？",
      financial: "固定資産税や HOA、毎月の維持費で把握しておくべき点はありますか？",
      building: "設備、駐車場、ランドリー、ペット規約について教えてください。",
      schools: "この物件に対応する学区や近隣学校はどこですか？",
      neighborhood: "周辺環境、交通、生活利便性はどんな感じですか？",
      policies: "融資、居住、又貸しなどに関するルールはありますか？",
      interior: "備え付けの家電や空調・暖房設備について教えてください。",
      agentPrep: "この物件について購入検討者がよく聞く質問は何ですか？",
      confirmCosts: "追加費用や建物ルールで確認すべきことはありますか？",
    },
  },
  ko: {
    languageName: "Korean",
    fallbackReply:
      "이 부분은 아직 충분히 신뢰할 수 있는 정보가 없어 명확히 답하기 어렵습니다. 리스팅 에이전트에게 확인해 주세요.",
    emptyTitle: "매물 자체, 주변 환경, 비용, 다음 단계에 대해 물어볼 수 있습니다.",
    emptyBody: "더 빨리 답을 받고 싶다면 아래 질문부터 시작해 보세요.",
    askNextLabel: "이어서 물어보기",
    placeholder: "세금, 학군, 주차, 통근 등을 물어보세요...",
    bestAvailableAnswer: "현재 기준 최선의 답변",
    needsAgentConfirmation: "에이전트 확인이 필요합니다",
    checkedPublicSources: "공개 자료도 확인했습니다",
    questions: {
      summary: "이 집의 핵심 정보와 장점을 요약해 줄 수 있나요?",
      financial: "구매자가 알아야 할 재산세, HOA, 월 유지비는 어떤 것이 있나요?",
      building: "편의시설, 주차, 세탁, 반려동물 정책은 어떻게 되나요?",
      schools: "이 집이 속한 학군이나 근처 학교는 어디인가요?",
      neighborhood: "주변 동네 분위기, 교통, 생활 편의성은 어떤가요?",
      policies: "융자, 거주, 전대와 관련된 규정이 있나요?",
      interior: "포함된 가전이나 냉난방 설비는 무엇인가요?",
      agentPrep: "구매자들이 이 매물에 대해 가장 많이 묻는 질문은 무엇인가요?",
      confirmCosts: "추가 비용이나 건물 규정 중 꼭 확인해야 할 것은 무엇인가요?",
    },
  },
};

function normalizeBaseLanguage(value: string) {
  const normalized = value.toLowerCase().trim();

  if (normalized.startsWith("zh")) return "zh";
  if (normalized.startsWith("es")) return "es";
  if (normalized.startsWith("fr")) return "fr";
  if (normalized.startsWith("pt")) return "pt";
  if (normalized.startsWith("ja")) return "ja";
  if (normalized.startsWith("ko")) return "ko";

  return "en";
}

export function detectPreferredQaLanguage(params: {
  text?: string | null;
  acceptLanguage?: string | null;
  fallback?: SupportedQaLanguage;
}): SupportedQaLanguage {
  const text = params.text?.trim() || "";

  if (/[\u3040-\u30ff]/.test(text)) return "ja";
  if (/[\uac00-\ud7af]/.test(text)) return "ko";
  if (/[\u4e00-\u9fff]/.test(text)) return "zh";
  if (/[¿¡]/.test(text) || /\b(cu[aá]nto|impuestos?|escuelas?|vecindario|estacionamiento|transporte)\b/i.test(text)) {
    return "es";
  }
  if (/\b(combien|école|quartier|taxes?|stationnement|transport)\b/i.test(text) || /[àâçéèêëîïôûùüÿœ]/i.test(text)) {
    return "fr";
  }
  if (/\b(quanto|impostos?|escola|bairro|vaga|transporte)\b/i.test(text) || /[ãõ]/i.test(text)) {
    return "pt";
  }

  if (params.acceptLanguage) {
    const first = params.acceptLanguage
      .split(",")
      .map((item) => item.split(";")[0]?.trim())
      .find(Boolean);

    if (first) {
      return normalizeBaseLanguage(first);
    }
  }

  return params.fallback || "en";
}

export function getQaLanguageDisplayName(language: SupportedQaLanguage) {
  return QA_TRANSLATIONS[language].languageName;
}

export function getQaUiCopy(language: SupportedQaLanguage) {
  return QA_TRANSLATIONS[language];
}

export function getLocalizedQaQuestion(language: SupportedQaLanguage, key: QaQuestionKey) {
  return QA_TRANSLATIONS[language].questions[key];
}
