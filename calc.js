/**
 * SobraCerta — cálculos puros (navegador e Node).
 * Taxas padrão consultadas em 25/11/2026 (America/Sao_Paulo).
 * O usuário pode (e deve) ajustar pelas taxas do próprio painel.
 */
(function (root, factory) {
  if (typeof module === "object" && module.exports) {
    module.exports = factory();
  } else {
    root.SobraCertaCalc = factory();
  }
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const DEFAULTS = {
    kiwify: {
      id: "kiwify",
      name: "Kiwify",
      pixPercent: 8.99,
      pixFixed: 2.49,
      cardPercent: 8.99,
      cardFixed: 2.49,
      withdrawFee: 3.67,
      antecipacaoPercent: 2,
      antecipacaoLabel:
        "Receber o cartão em 2 dias (+2% sobre todas as vendas)",
      microMax: null,
      microPercent: 0,
      microFixed: 0,
      prazoPix: "2 dias corridos",
      prazoCartao: "15 dias corridos (ou 2 dias com a opção D+2)",
      fonte:
        "Central de ajuda da Kiwify (taxa 8,99% + R$ 2,49; saque R$ 3,67) e página inicial, conferido em 25/11/2026. A opção D+2 (+2% sobre todas as vendas) aparece em artigos de 2026 sobre as taxas da Kiwify; confirme no painel.",
    },
    hotmart: {
      id: "hotmart",
      name: "Hotmart",
      pixPercent: 9.9,
      pixFixed: 2.49,
      cardPercent: 9.9,
      cardFixed: 2.49,
      withdrawFee: 1.99,
      antecipacaoPercent: 3.59,
      antecipacaoLabel:
        "Antecipar o cartão em 2 dias (+3,59% sobre a venda)",
      microMax: 10,
      microPercent: 20,
      microFixed: 0,
      prazoPix: "2 dias corridos",
      prazoCartao: "30 dias corridos (antecipação opcional)",
      fonte:
        "Central de ajuda da Hotmart (transações gerais em BRL: 9,9% + R$ 2,49 acima de R$ 10; microtransação até R$ 10: 20%). Antecipação em 2 dias: 3,59%. Saque: R$ 1,99. Conferido em fontes oficiais e páginas da Hotmart em novembro de 2026.",
    },
    cakto: {
      id: "cakto",
      name: "Cakto",
      pixPercent: 0,
      pixFixed: 2.49,
      cardPercent: 4.99,
      cardFixed: 2.49,
      withdrawFee: 0,
      antecipacaoPercent: 0,
      antecipacaoLabel:
        "Antecipação do cartão (informe o % do seu painel, se houver)",
      microMax: null,
      microPercent: 0,
      microFixed: 0,
      prazoPix: "D+1 (tabela pública)",
      prazoCartao: "Até 15 dias, ou 2 com antecipação (tabela pública)",
      fonte:
        "Tabela pública da Cakto (cakto.com.br/taxas, set/2026): Pix 0% + R$ 2,49; cartão 4,99% + R$ 2,49. A Cakto avisa que as taxas são definidas por conta — a referência é o painel (Perfil > Taxas). Taxa de saque: informe a do seu painel (padrão 0 neste app por não haver valor único publicado em 25/11/2026).",
    },
  };

  const SUGGESTED_PRICES = [17, 27, 37, 47, 67, 97, 147, 197, 297, 497];

  function moneyRound(n) {
    return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  }

  function clamp(n, min, max) {
    return Math.min(max, Math.max(min, n));
  }

  function mergeFees(platformId, custom) {
    const base = DEFAULTS[platformId];
    if (!base) throw new Error("Plataforma desconhecida: " + platformId);
    return Object.assign({}, base, custom || {});
  }

  function feeForMethod(fees, price, method) {
    const p = Number(price) || 0;
    if (p <= 0) {
      return { fee: 0, percent: 0, fixed: 0, micro: false };
    }
    if (fees.microMax != null && p <= fees.microMax) {
      const percent = Number(fees.microPercent) || 0;
      const fixed = Number(fees.microFixed) || 0;
      return {
        fee: moneyRound(p * (percent / 100) + fixed),
        percent,
        fixed,
        micro: true,
      };
    }
    const percent =
      method === "pix"
        ? Number(fees.pixPercent) || 0
        : Number(fees.cardPercent) || 0;
    const fixed =
      method === "pix"
        ? Number(fees.pixFixed) || 0
        : Number(fees.cardFixed) || 0;
    return {
      fee: moneyRound(p * (percent / 100) + fixed),
      percent,
      fixed,
      micro: false,
    };
  }

  function platformFee(fees, price, pixShare) {
    const share = clamp(Number(pixShare) || 0, 0, 1);
    const pix = feeForMethod(fees, price, "pix");
    const card = feeForMethod(fees, price, "card");
    const fee = moneyRound(share * pix.fee + (1 - share) * card.fee);
    return { fee, pix, card, pixShare: share };
  }

  /**
   * Ordem da conta (como nas centrais da Kiwify e da Cakto):
   * 1) taxa da plataforma (e antecipação, se houver)
   * 2) comissão do afiliado sobre o que sobrou
   * 3) coprodutor sobre o que sobrou depois do afiliado
   * 4) reserva para impostos sobre o líquido do produtor
   */
  function breakdown(input) {
    const price = moneyRound(Number(input.price) || 0);
    const fees = mergeFees(input.platformId, input.fees);
    const pixShare = clamp(Number(input.pixShare) || 0, 0, 1);
    const affiliatePct = clamp(Number(input.affiliatePct) || 0, 0, 100);
    const coproducerPct = clamp(Number(input.coproducerPct) || 0, 0, 100);
    const taxReservePct = clamp(Number(input.taxReservePct) || 0, 0, 100);
    const useAntecipacao = Boolean(input.antecipacao);
    const antecipacaoPct = useAntecipacao
      ? clamp(Number(fees.antecipacaoPercent) || 0, 0, 100)
      : 0;

    const plat = platformFee(fees, price, pixShare);
    const antecipacaoFee = moneyRound(price * (antecipacaoPct / 100));
    const afterPlatform = moneyRound(price - plat.fee - antecipacaoFee);
    const affiliateFee = moneyRound(afterPlatform * (affiliatePct / 100));
    const afterAffiliate = moneyRound(afterPlatform - affiliateFee);
    const coproducerFee = moneyRound(afterAffiliate * (coproducerPct / 100));
    const producerGross = moneyRound(afterAffiliate - coproducerFee);
    const taxReserve = moneyRound(producerGross * (taxReservePct / 100));
    const netPerSale = moneyRound(producerGross - taxReserve);
    const effectiveRate =
      price > 0 ? moneyRound((1 - netPerSale / price) * 100) : 0;

    return {
      price,
      fees,
      pixShare,
      affiliatePct,
      coproducerPct,
      taxReservePct,
      antecipacaoPct,
      platformFee: plat.fee,
      platformFeePix: plat.pix.fee,
      platformFeeCard: plat.card.fee,
      microApplied: plat.pix.micro || plat.card.micro,
      antecipacaoFee,
      afterPlatform,
      affiliateFee,
      afterAffiliate,
      coproducerFee,
      producerGross,
      taxReserve,
      netPerSale,
      effectiveRate,
      negative: netPerSale < 0,
    };
  }

  function monthly(input) {
    const one = breakdown(input);
    const goal = moneyRound(Number(input.monthlyGoal) || 0);
    const das = moneyRound(Number(input.dasMonthly) || 0);
    const withdraws = Math.max(0, Number(input.withdrawalsPerMonth) || 0);
    const withdrawCost = moneyRound(withdraws * (Number(one.fees.withdrawFee) || 0));
    const fixedMonthly = moneyRound(das + withdrawCost);
    const netNeeded = moneyRound(goal + fixedMonthly);

    let salesNeeded = 0;
    if (one.netPerSale > 0 && netNeeded > 0) {
      salesNeeded = Math.ceil(netNeeded / one.netPerSale);
    } else if (one.netPerSale > 0 && netNeeded <= 0) {
      salesNeeded = 0;
    } else {
      salesNeeded = null;
    }

    const sales = salesNeeded == null ? 0 : salesNeeded;
    const gross = moneyRound(sales * one.price);
    const netMonth = moneyRound(sales * one.netPerSale - fixedMonthly);

    return {
      ...one,
      monthlyGoal: goal,
      dasMonthly: das,
      withdrawalsPerMonth: withdraws,
      withdrawCost,
      fixedMonthly,
      netNeeded,
      salesNeeded,
      grossForGoal: gross,
      netMonth,
    };
  }

  function priceForNet(desiredNet, input) {
    const want = moneyRound(Number(desiredNet) || 0);
    const affiliatePct = clamp(Number(input.affiliatePct) || 0, 0, 100);
    const coproducerPct = clamp(Number(input.coproducerPct) || 0, 0, 100);
    const taxReservePct = clamp(Number(input.taxReservePct) || 0, 0, 100);
    const pixShare = clamp(Number(input.pixShare) || 0, 0, 1);
    const fees = mergeFees(input.platformId, input.fees);
    const useAntecipacao = Boolean(input.antecipacao);
    const ant = useAntecipacao
      ? clamp(Number(fees.antecipacaoPercent) || 0, 0, 100) / 100
      : 0;
    const a = affiliatePct / 100;
    const c = coproducerPct / 100;
    const t = taxReservePct / 100;
    const keep = (1 - a) * (1 - c) * (1 - t);

    if (keep <= 0) return { price: null, reason: "comissoes" };

    const tryPrice = (price) => {
      const b = breakdown(Object.assign({}, input, { price: moneyRound(price) }));
      return b.netPerSale;
    };

    // Sem microtransação, a taxa é linear por método; usamos busca para
    // cobrir mix Pix/cartão e a faixa de microtransação da Hotmart.
    if (want <= 0) return { price: 0, reason: null };

    let lo = 0;
    let hi = Math.max(20, want * 4 + 50);
    for (let i = 0; i < 8 && tryPrice(hi) < want; i++) hi *= 2;
    if (tryPrice(hi) < want) return { price: null, reason: "impossivel" };

    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (tryPrice(mid) >= want) hi = mid;
      else lo = mid;
    }
    const price = moneyRound(Math.ceil(hi * 100) / 100);
    return { price, reason: null, check: tryPrice(price) };
  }

  function compareAll(input) {
    return ["kiwify", "hotmart", "cakto"].map((id) => {
      const b = monthly(Object.assign({}, input, { platformId: id, fees: undefined }));
      return b;
    });
  }

  function suggestedTable(input) {
    return SUGGESTED_PRICES.map((price) =>
      monthly(Object.assign({}, input, { price }))
    );
  }

  function launchSim(input) {
    const one = breakdown(input);
    const budget = moneyRound(Number(input.adBudget) || 0);
    const cpa = moneyRound(Number(input.cpa) || 0);
    let sales = Math.max(0, Number(input.expectedSales) || 0);
    if (cpa > 0) sales = Math.floor(budget / cpa);
    const revenue = moneyRound(sales * one.price);
    const netSales = moneyRound(sales * one.netPerSale);
    const profit = moneyRound(netSales - budget);
    const roas = budget > 0 ? moneyRound(revenue / budget) : null;
    const roi = budget > 0 ? moneyRound((profit / budget) * 100) : null;
    return {
      ...one,
      adBudget: budget,
      cpa: cpa,
      launchSales: sales,
      revenue,
      netSales,
      profit,
      roas,
      roi,
    };
  }

  return {
    DEFAULTS,
    SUGGESTED_PRICES,
    moneyRound,
    mergeFees,
    feeForMethod,
    platformFee,
    breakdown,
    monthly,
    priceForNet,
    compareAll,
    suggestedTable,
    launchSim,
  };
});
