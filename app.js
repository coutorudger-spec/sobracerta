(function () {
  "use strict";

  const C = window.SobraCertaCalc;
  const CFG = window.SOBRACERTA_CONFIG || {};
  const form = document.getElementById("form");
  const STORAGE_KEY = "sobracerta-cenarios-v1";
  const PRO_KEY = "sobracerta-pro";
  const FREE_LIMIT = 3;

  const brl = new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  });
  const pct = (n) =>
    new Intl.NumberFormat("pt-BR", {
      minimumFractionDigits: 0,
      maximumFractionDigits: 2,
    }).format(n) + "%";

  function currentFeesFromForm() {
    const fd = new FormData(form);
    return {
      pixPercent: num(fd.get("pixPercent")),
      pixFixed: num(fd.get("pixFixed")),
      cardPercent: num(fd.get("cardPercent")),
      cardFixed: num(fd.get("cardFixed")),
      withdrawFee: num(fd.get("withdrawFee")),
      antecipacaoPercent: num(fd.get("antecipacaoPercent")),
    };
  }

  function num(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : 0;
  }

  function platformId() {
    const el = form.querySelector('input[name="platform"]:checked');
    return el ? el.value : "kiwify";
  }

  function readInput() {
    const fd = new FormData(form);
    return {
      platformId: platformId(),
      price: num(fd.get("price")),
      pixShare: num(fd.get("pixShare")) / 100,
      antecipacao: form.antecipacao.checked,
      affiliatePct: num(fd.get("affiliatePct")),
      coproducerPct: num(fd.get("coproducerPct")),
      taxReservePct: num(fd.get("taxReservePct")),
      dasMonthly: num(fd.get("dasMonthly")),
      monthlyGoal: num(fd.get("monthlyGoal")),
      withdrawalsPerMonth: num(fd.get("withdrawalsPerMonth")),
      fees: currentFeesFromForm(),
    };
  }

  function fillFeeFields(platform, custom) {
    const fees = C.mergeFees(platform, custom);
    form.pixPercent.value = fees.pixPercent;
    form.pixFixed.value = fees.pixFixed;
    form.cardPercent.value = fees.cardPercent;
    form.cardFixed.value = fees.cardFixed;
    form.withdrawFee.value = fees.withdrawFee;
    form.antecipacaoPercent.value = fees.antecipacaoPercent;
    document.getElementById("antecLabel").textContent = fees.antecipacaoLabel;
  }

  function loadScenarios() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
    } catch (e) {
      return [];
    }
  }

  function saveScenarios(list) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  }

  function isPro() {
    return localStorage.getItem(PRO_KEY) === "1" || sessionStorage.getItem("sobracerta-demo") === "1";
  }

  function setPro(on) {
    if (on) localStorage.setItem(PRO_KEY, "1");
    else localStorage.removeItem(PRO_KEY);
    renderProState();
    renderScenarios();
    render();
  }

  function renderBreakdown(m) {
    const items = [
      ["Preço da oferta", brl.format(m.price), false],
      [
        m.microApplied
          ? "Taxa da plataforma (regra de microtransação)"
          : "Taxa da plataforma",
        "− " + brl.format(m.platformFee),
        true,
      ],
    ];
    if (m.antecipacaoFee > 0) {
      items.push(["Antecipação", "− " + brl.format(m.antecipacaoFee), true]);
    }
    if (m.affiliatePct > 0) {
      items.push([
        "Afiliados (" + pct(m.affiliatePct) + " do que sobrou)",
        "− " + brl.format(m.affiliateFee),
        true,
      ]);
    }
    if (m.coproducerPct > 0) {
      items.push([
        "Coprodutor (" + pct(m.coproducerPct) + ")",
        "− " + brl.format(m.coproducerFee),
        true,
      ]);
    }
    if (m.taxReservePct > 0) {
      items.push([
        "Reserva para impostos (" + pct(m.taxReservePct) + ")",
        "− " + brl.format(m.taxReserve),
        true,
      ]);
    }
    items.push(["Líquido por venda", brl.format(m.netPerSale), false]);
    document.getElementById("breakdown").innerHTML = items
      .map(
        ([k, v, neg]) =>
          "<li" +
          (neg ? ' class="neg"' : "") +
          "><span>" +
          k +
          "</span><span>" +
          v +
          "</span></li>"
      )
      .join("");
  }

  function renderCompare(input) {
    const rows = C.compareAll(input);
    const best = Math.max(...rows.map((r) => r.netPerSale));
    const tb = document.querySelector("#compareTable tbody");
    tb.innerHTML = rows
      .map((r) => {
        const sales =
          r.salesNeeded == null
            ? "—"
            : r.salesNeeded === 0
            ? "Já cobre os custos fixos"
            : String(r.salesNeeded);
        const cls = r.netPerSale === best && r.netPerSale > 0 ? "best" : "";
        return (
          "<tr class='" +
          cls +
          "'><td>" +
          r.fees.name +
          "</td><td>" +
          brl.format(r.platformFee + r.antecipacaoFee) +
          "</td><td>" +
          brl.format(r.netPerSale) +
          "</td><td>" +
          sales +
          "</td><td>Pix: " +
          r.fees.prazoPix +
          "<br>Cartão: " +
          r.fees.prazoCartao +
          "</td></tr>"
        );
      })
      .join("");
  }

  function renderPrices(input) {
    const rows = C.suggestedTable(input);
    const tb = document.querySelector("#priceTable tbody");
    tb.innerHTML = rows
      .map((r) => {
        const out = r.price - r.netPerSale;
        const sales =
          r.salesNeeded == null
            ? "—"
            : r.salesNeeded === 0
            ? "—"
            : String(r.salesNeeded);
        return (
          "<tr><td>" +
          brl.format(r.price) +
          "</td><td>" +
          brl.format(r.netPerSale) +
          "</td><td>" +
          brl.format(out) +
          " (" +
          pct(r.effectiveRate) +
          ")</td><td>" +
          sales +
          "</td></tr>"
        );
      })
      .join("");
  }

  function renderReverse(input) {
    const desired = num(document.getElementById("desiredNet").value);
    const r = C.priceForNet(desired, input);
    const el = document.getElementById("priceForNet");
    if (!desired) {
      el.textContent = "Informe o líquido que você quer por venda.";
      return;
    }
    if (!r.price) {
      el.textContent =
        r.reason === "comissoes"
          ? "Com essas comissões não dá para chegar a um líquido positivo."
          : "Não foi possível achar um preço neste cenário.";
      return;
    }
    el.textContent =
      "Cobrar " +
      brl.format(r.price) +
      " deixa cerca de " +
      brl.format(r.check) +
      " por venda, nesta plataforma e neste mix.";
  }

  function renderMeta(m) {
    const el = document.getElementById("salesNeeded");
    const det = document.getElementById("metaDetail");
    if (m.netPerSale <= 0 && m.netNeeded > 0) {
      el.textContent = "Com este líquido não dá para bater a meta.";
      det.textContent = "Aumente o preço ou reduza comissões e reservas.";
      return;
    }
    if (!m.monthlyGoal && !m.fixedMonthly) {
      el.textContent = "Informe uma meta mensal para ver quantas vendas faltam.";
      det.textContent = "";
      return;
    }
    if (m.salesNeeded === 0) {
      el.textContent = "Os custos fixos do mês já estão cobertos sem vendas.";
      det.textContent = "Isso só acontece se a meta e o DAS/saque forem zero.";
      return;
    }
    el.textContent =
      m.salesNeeded +
      (m.salesNeeded === 1 ? " venda" : " vendas") +
      " no mês para ficar com " +
      brl.format(m.monthlyGoal) +
      " líquidos.";
    det.textContent =
      "Faturamento bruto aproximado: " +
      brl.format(m.grossForGoal) +
      ". Depois das vendas, descontamos " +
      brl.format(m.dasMonthly) +
      " de DAS e " +
      brl.format(m.withdrawCost) +
      " de saque. Líquido estimado no mês: " +
      brl.format(m.netMonth) +
      ".";
  }

  function renderScenarios() {
    const list = loadScenarios();
    const ul = document.getElementById("scenarioList");
    if (!list.length) {
      ul.innerHTML = "<li>Nenhum cenário salvo ainda.</li>";
      return;
    }
    ul.innerHTML = list
      .map((s, i) => {
        return (
          "<li><span>" +
          escapeHtml(s.name) +
          " · " +
          (C.DEFAULTS[s.input.platformId] || {}).name +
          " · " +
          brl.format(s.input.price) +
          '</span><span><button type="button" class="link" data-load="' +
          i +
          '">Abrir</button> · <button type="button" class="link" data-del="' +
          i +
          '">Apagar</button></span></li>'
        );
      })
      .join("");
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/"/g, "&quot;");
  }

  function applyScenario(s) {
    const inp = s.input;
    form.querySelectorAll('input[name="platform"]').forEach((el) => {
      el.checked = el.value === inp.platformId;
    });
    fillFeeFields(inp.platformId, inp.fees);
    form.price.value = inp.price;
    form.pixShare.value = Math.round((inp.pixShare || 0) * 100);
    form.antecipacao.checked = Boolean(inp.antecipacao);
    form.affiliatePct.value = inp.affiliatePct || 0;
    form.coproducerPct.value = inp.coproducerPct || 0;
    form.taxReservePct.value = inp.taxReservePct || 0;
    form.dasMonthly.value = inp.dasMonthly || 0;
    form.monthlyGoal.value = inp.monthlyGoal || 0;
    form.withdrawalsPerMonth.value = inp.withdrawalsPerMonth || 0;
    syncPixHint();
    render();
  }

  function renderLaunch(input) {
    if (!isPro()) return;
    const s = C.launchSim(
      Object.assign({}, input, {
        adBudget: num(document.getElementById("adBudget").value),
        cpa: num(document.getElementById("cpa").value),
      })
    );
    const items = [
      ["Vendas do lançamento", String(s.launchSales)],
      ["Faturamento", brl.format(s.revenue)],
      ["Líquido das vendas", brl.format(s.netSales)],
      ["Verba de anúncio", "− " + brl.format(s.adBudget)],
      ["Lucro (ou prejuízo) do lançamento", brl.format(s.profit)],
      ["ROAS (receita / verba)", s.roas == null ? "—" : String(s.roas).replace(".", ",")],
      ["Retorno sobre a verba", s.roi == null ? "—" : pct(s.roi)],
    ];
    document.getElementById("launchBreak").innerHTML = items
      .map(
        ([k, v]) =>
          "<li><span>" + k + "</span><span>" + v + "</span></li>"
      )
      .join("");

    const a = C.monthly(Object.assign({}, input, { price: num(document.getElementById("sideA").value) }));
    const b = C.monthly(Object.assign({}, input, { price: num(document.getElementById("sideB").value) }));
    const rows = [
      ["Líquido / venda", brl.format(a.netPerSale), brl.format(b.netPerSale)],
      ["Vendas para a meta", a.salesNeeded == null ? "—" : String(a.salesNeeded), b.salesNeeded == null ? "—" : String(b.salesNeeded)],
      ["Faturamento para a meta", brl.format(a.grossForGoal), brl.format(b.grossForGoal)],
    ];
    document.querySelector("#sideTable tbody").innerHTML = rows
      .map(
        (r) =>
          "<tr><td>" +
          r[0] +
          "</td><td>" +
          r[1] +
          "</td><td>" +
          r[2] +
          "</td></tr>"
      )
      .join("");
  }

  function renderProState() {
    const locked = document.getElementById("proLocked");
    const open = document.getElementById("proOpen");
    const buy = document.getElementById("buyLink");
    const hint = document.getElementById("buyHint");
    const preco = document.getElementById("kitPrecoLabel");
    if (CFG.kitPreco) preco.textContent = CFG.kitPreco;
    if (CFG.kiwifyUrl) {
      buy.href = CFG.kiwifyUrl;
      buy.target = "_blank";
      buy.rel = "noopener noreferrer";
      hint.hidden = true;
    } else {
      buy.href = "#pro";
      buy.removeAttribute("target");
      hint.hidden = false;
    }
    if (isPro()) {
      locked.hidden = true;
      open.hidden = false;
    } else {
      locked.hidden = false;
      open.hidden = true;
    }
  }

  function syncPixHint() {
    const p = Number(form.pixShare.value) || 0;
    document.getElementById("pixHint").textContent =
      p + "% Pix · " + (100 - p) + "% cartão";
  }

  function render() {
    const input = readInput();
    const m = C.monthly(input);
    document.getElementById("resultPlatform").textContent = m.fees.name;
    document.getElementById("netPerSale").textContent = brl.format(m.netPerSale);
    document.getElementById("effectiveRate").textContent =
      m.price > 0
        ? pct(m.effectiveRate) +
          " do preço saem em taxas, comissões e reservas. Prazo: Pix " +
          m.fees.prazoPix +
          "; cartão " +
          m.fees.prazoCartao +
          "."
        : "Informe um preço para ver o líquido.";
    document.getElementById("negWarn").hidden = !m.negative;
    renderBreakdown(m);
    renderMeta(m);
    renderCompare(input);
    renderPrices(input);
    renderReverse(input);
    renderLaunch(input);
  }

  form.addEventListener("input", function (ev) {
    if (ev.target && ev.target.name === "pixShare") syncPixHint();
    if (ev.target && ev.target.name === "platform") {
      fillFeeFields(platformId());
    }
    render();
  });
  form.addEventListener("change", render);

  document.getElementById("restoreFees").addEventListener("click", function () {
    fillFeeFields(platformId());
    render();
  });
  document.getElementById("desiredNet").addEventListener("input", render);
  document.getElementById("printBtn").addEventListener("click", function () {
    window.print();
  });

  document.getElementById("saveScenario").addEventListener("click", function () {
    const name = (document.getElementById("scenarioName").value || "").trim();
    if (!name) {
      document.getElementById("scenarioName").focus();
      return;
    }
    const list = loadScenarios();
    if (!isPro() && list.length >= FREE_LIMIT) {
      alert("No plano gratuito cabem 3 cenários. Apague um ou use o Kit Pro.");
      document.getElementById("pro").scrollIntoView({ behavior: "smooth" });
      return;
    }
    list.push({ name: name, input: readInput(), savedAt: new Date().toISOString() });
    saveScenarios(list);
    document.getElementById("scenarioName").value = "";
    renderScenarios();
  });

  document.getElementById("scenarioList").addEventListener("click", function (ev) {
    const load = ev.target.getAttribute("data-load");
    const del = ev.target.getAttribute("data-del");
    const list = loadScenarios();
    if (load != null) applyScenario(list[Number(load)]);
    if (del != null) {
      list.splice(Number(del), 1);
      saveScenarios(list);
      renderScenarios();
    }
  });

  document.getElementById("previewPro").addEventListener("click", function () {
    sessionStorage.setItem("sobracerta-demo", "1");
    renderProState();
    render();
    document.getElementById("proOpen").scrollIntoView({ behavior: "smooth" });
  });

  document.getElementById("unlockForm").addEventListener("submit", function (ev) {
    ev.preventDefault();
    const code = (document.getElementById("proCode").value || "").trim();
    const allowed = (CFG.proCodes || []).filter(Boolean);
    if (allowed.length && allowed.indexOf(code) !== -1) {
      setPro(true);
    } else if (!allowed.length) {
      alert(
        "Ainda não há código de acesso configurado. Quando o produto existir, o Rudger coloca os códigos em config.js."
      );
    } else {
      alert("Este código não conferiu. Veja o e-mail de entrega da Kiwify.");
    }
  });

  ["adBudget", "cpa", "sideA", "sideB"].forEach(function (id) {
    const el = document.getElementById(id);
    if (el) el.addEventListener("input", render);
  });

  fillFeeFields("kiwify");
  syncPixHint();
  renderProState();
  renderScenarios();
  render();
})();
