const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const senhaInput = document.getElementById("senha");
const loginStatus = document.getElementById("login-status");
const logoutBtn = document.getElementById("logout-btn");
const lista = document.getElementById("lista");
const listaVazia = document.getElementById("lista-vazia");
const filterBtns = document.querySelectorAll(".filter-btn");
const addBtn = document.getElementById("add-btn");
const addForm = document.getElementById("add-form");
const addCancelarBtn = document.getElementById("add-cancelar");
const novoProtocoloInput = document.getElementById("novo-protocolo");
const addStatus = document.getElementById("add-status");

let denuncias = [];
let filtroAtual = "todas";

const STATUS_LABEL = { aberta: "Aberta", andamento: "Em andamento", fechada: "Fechada" };
const PRIORIDADE_LABEL = { alta: "Alta", media: "Média", baixa: "Baixa" };

function escapeHtml(value) {
  const div = document.createElement("div");
  div.textContent = value ?? "";
  return div.innerHTML;
}

async function checarSessao() {
  const res = await fetch("/api/me");
  const data = await res.json();
  if (data.authenticated) {
    mostrarDashboard();
  } else {
    mostrarLogin();
  }
}

function mostrarLogin(mensagem) {
  loginView.hidden = false;
  dashboardView.hidden = true;
  logoutBtn.hidden = true;
  pararTimerInatividade();
  if (mensagem) {
    loginStatus.textContent = mensagem;
    loginStatus.className = "form-status";
  }
}

function mostrarDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  logoutBtn.hidden = false;
  carregarDenuncias();
  iniciarTimerInatividade();
}

/* ---------- desloga automaticamente apos 10 min sem atividade ---------- */
const TEMPO_INATIVIDADE_MS = 10 * 60 * 1000;
let timerInatividade = null;

function pararTimerInatividade() {
  clearTimeout(timerInatividade);
}

function iniciarTimerInatividade() {
  clearTimeout(timerInatividade);
  timerInatividade = setTimeout(async () => {
    await fetch("/api/logout", { method: "POST" });
    mostrarLogin("Sessão encerrada por inatividade. Entre novamente.");
  }, TEMPO_INATIVIDADE_MS);
}

["click", "keydown", "mousemove", "scroll", "touchstart"].forEach((evento) => {
  document.addEventListener(
    evento,
    () => {
      if (!dashboardView.hidden) iniciarTimerInatividade();
    },
    { passive: true }
  );
});

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  loginStatus.textContent = "";
  loginStatus.className = "form-status";

  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ senha: senhaInput.value }),
  });

  if (res.ok) {
    loginForm.reset();
    mostrarDashboard();
  } else {
    loginStatus.textContent = "Senha incorreta.";
    loginStatus.classList.add("error");
  }
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  mostrarLogin();
});

addBtn.addEventListener("click", () => {
  addForm.hidden = false;
  addStatus.textContent = "";
  addStatus.className = "form-status";
  novoProtocoloInput.focus();
});

addCancelarBtn.addEventListener("click", () => {
  addForm.hidden = true;
  addForm.reset();
  addStatus.textContent = "";
  addStatus.className = "form-status";
});

addForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  addStatus.textContent = "";
  addStatus.className = "form-status";

  const res = await fetch("/api/denuncias", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ protocolo: novoProtocoloInput.value.trim() }),
  });

  if (res.status === 401) {
    mostrarLogin();
    return;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    addStatus.textContent = data.error === "esse protocolo ja foi adicionado" ? "Esse protocolo já foi adicionado." : "Erro ao adicionar. Confira o número e tente de novo.";
    addStatus.classList.add("error");
    return;
  }

  addForm.reset();
  addForm.hidden = true;
  await carregarDenuncias();
});

filterBtns.forEach((btn) => {
  btn.addEventListener("click", () => {
    filterBtns.forEach((b) => b.classList.remove("active"));
    btn.classList.add("active");
    filtroAtual = btn.dataset.status;
    renderLista();
  });
});

async function carregarDenuncias() {
  const res = await fetch("/api/denuncias");
  if (res.status === 401) {
    mostrarLogin();
    return;
  }
  const data = await res.json();
  denuncias = data.denuncias || [];
  renderLista();
}

function renderLista() {
  const filtradas = denuncias.filter((d) => filtroAtual === "todas" || d.status === filtroAtual);
  lista.innerHTML = "";
  listaVazia.hidden = filtradas.length > 0;
  filtradas.forEach((d) => lista.appendChild(criarCard(d)));
}

function criarCard(d) {
  const article = document.createElement("article");
  article.className = "denuncia-card";
  article.dataset.id = d.id;

  const prioridadeClasse = d.prioridade ? `prioridade-${d.prioridade}` : "prioridade-none";
  const prioridadeTitulo = d.prioridade ? PRIORIDADE_LABEL[d.prioridade] : "não definida";

  article.innerHTML = `
    <div class="denuncia-header" role="button" tabindex="0">
      <div class="denuncia-id">
        <span class="protocolo-display">
          <span class="protocolo">${escapeHtml(d.protocolo)}</span>
          <button type="button" class="pencil-btn" title="Editar número do protocolo">✏️</button>
        </span>
        <span class="protocolo-edit" hidden>
          <input type="text" class="protocolo-input" value="${escapeHtml(d.protocolo)}" />
          <span class="protocolo-edit-actions">
            <button type="button" class="submit-btn secondary protocolo-salvar">Salvar</button>
            <button type="button" class="link-btn protocolo-cancelar">Cancelar</button>
            <span class="protocolo-edit-erro"></span>
          </span>
        </span>
      </div>
      <div class="denuncia-meta">
        <span class="prioridade-dot ${prioridadeClasse}" title="Prioridade: ${prioridadeTitulo}"></span>
        <span class="status-badge status-${d.status}">${STATUS_LABEL[d.status]}</span>
        <span class="data">${escapeHtml(d.created_at)}</span>
        <span class="chevron">›</span>
      </div>
    </div>
    <div class="denuncia-body" hidden>
      <div class="field">
        <label>Status</label>
        <div class="choice-group">
          <button type="button" class="choice-btn choice-aberta ${d.status === "aberta" ? "active" : ""}" data-value="aberta">Aberta</button>
          <button type="button" class="choice-btn choice-andamento ${d.status === "andamento" ? "active" : ""}" data-value="andamento">Em andamento</button>
          <button type="button" class="choice-btn choice-fechada ${d.status === "fechada" ? "active" : ""}" data-value="fechada">Fechada</button>
        </div>
      </div>

      <div class="field">
        <label>Prioridade <span class="hint-inline">(clique de novo para tirar)</span></label>
        <div class="choice-group">
          <button type="button" class="choice-btn choice-alta ${d.prioridade === "alta" ? "active" : ""}" data-value="alta">Alta</button>
          <button type="button" class="choice-btn choice-media ${d.prioridade === "media" ? "active" : ""}" data-value="media">Média</button>
          <button type="button" class="choice-btn choice-baixa ${d.prioridade === "baixa" ? "active" : ""}" data-value="baixa">Baixa</button>
        </div>
      </div>

      <div class="field">
        <label>O que foi feito</label>
        <textarea class="notas-textarea" placeholder="Ex: liguei para fulano em 02/09 e avisei sobre o caso...">${escapeHtml(d.notas_juridico || "")}</textarea>
      </div>

      <div class="denuncia-actions">
        <button type="button" class="submit-btn secondary salvar-btn">Salvar notas</button>
        <span class="salvar-status"></span>
      </div>

      <div class="apagar-area">
        <button type="button" class="lixeira-btn" title="Apagar protocolo">🗑️</button>
      </div>
    </div>
  `;

  const header = article.querySelector(".denuncia-header");
  const body = article.querySelector(".denuncia-body");
  function alternarExpandido() {
    body.hidden = !body.hidden;
    article.classList.toggle("expandido", !body.hidden);
  }
  header.addEventListener("click", alternarExpandido);
  header.addEventListener("keydown", (e) => {
    if (e.target === header && (e.key === "Enter" || e.key === " ")) {
      e.preventDefault();
      alternarExpandido();
    }
  });

  const protocoloTexto = article.querySelector(".protocolo");
  const protocoloDisplay = article.querySelector(".protocolo-display");
  const protocoloEdit = article.querySelector(".protocolo-edit");
  const protocoloInput = article.querySelector(".protocolo-input");
  const pencilBtn = article.querySelector(".pencil-btn");
  const protocoloSalvarBtn = article.querySelector(".protocolo-salvar");
  const protocoloCancelarBtn = article.querySelector(".protocolo-cancelar");
  const protocoloErro = article.querySelector(".protocolo-edit-erro");

  pencilBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    protocoloDisplay.hidden = true;
    protocoloEdit.hidden = false;
    protocoloErro.textContent = "";
    protocoloInput.value = d.protocolo;
    protocoloInput.focus();
    protocoloInput.select();
  });

  protocoloCancelarBtn.addEventListener("click", (e) => {
    e.stopPropagation();
    protocoloEdit.hidden = true;
    protocoloDisplay.hidden = false;
    protocoloErro.textContent = "";
  });

  protocoloEdit.addEventListener("click", (e) => e.stopPropagation());
  protocoloInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") protocoloSalvarBtn.click();
    if (e.key === "Escape") protocoloCancelarBtn.click();
  });

  protocoloSalvarBtn.addEventListener("click", async (e) => {
    e.stopPropagation();
    const novoProtocolo = protocoloInput.value.trim();
    if (!novoProtocolo || novoProtocolo === d.protocolo) {
      protocoloEdit.hidden = true;
      protocoloDisplay.hidden = false;
      return;
    }

    protocoloSalvarBtn.disabled = true;
    protocoloErro.textContent = "";
    try {
      const res = await fetch(`/api/denuncias/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ protocolo: novoProtocolo }),
      });
      if (res.status === 401) {
        mostrarLogin();
        return;
      }
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        protocoloErro.textContent = data.error === "esse protocolo ja foi adicionado" ? "Esse protocolo já existe." : "Erro ao salvar.";
        return;
      }
      d.protocolo = novoProtocolo;
      protocoloTexto.textContent = novoProtocolo;
      protocoloEdit.hidden = true;
      protocoloDisplay.hidden = false;
    } finally {
      protocoloSalvarBtn.disabled = false;
    }
  });

  const statusBadge = article.querySelector(".status-badge");
  const dot = article.querySelector(".prioridade-dot");

  function atualizarVisualStatus() {
    statusBadge.className = `status-badge status-${d.status}`;
    statusBadge.textContent = STATUS_LABEL[d.status];
    article.classList.toggle("expandido", !body.hidden);
  }

  function atualizarVisualPrioridade() {
    dot.className = `prioridade-dot ${d.prioridade ? "prioridade-" + d.prioridade : "prioridade-none"}`;
    dot.title = `Prioridade: ${d.prioridade ? PRIORIDADE_LABEL[d.prioridade] : "não definida"}`;
  }

  async function salvarCampo(campo, valor) {
    const res = await fetch(`/api/denuncias/${d.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ [campo]: valor }),
    });
    if (res.status === 401) {
      mostrarLogin();
      throw new Error("sessao expirada");
    }
    if (!res.ok) throw new Error("falha ao salvar");
  }

  article.querySelectorAll(".choice-aberta, .choice-andamento, .choice-fechada").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const valorAnterior = d.status;
      const novoValor = btn.dataset.value;
      if (novoValor === valorAnterior) return;

      d.status = novoValor;
      atualizarVisualStatus();
      article.querySelectorAll(".choice-aberta, .choice-andamento, .choice-fechada").forEach((b) => b.classList.toggle("active", b.dataset.value === novoValor));

      try {
        await salvarCampo("status", novoValor);
      } catch {
        d.status = valorAnterior;
        atualizarVisualStatus();
        article.querySelectorAll(".choice-aberta, .choice-andamento, .choice-fechada").forEach((b) => b.classList.toggle("active", b.dataset.value === valorAnterior));
      }
    });
  });

  article.querySelectorAll(".choice-alta, .choice-media, .choice-baixa").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const valorAnterior = d.prioridade;
      const novoValor = btn.classList.contains("active") ? null : btn.dataset.value;

      d.prioridade = novoValor;
      atualizarVisualPrioridade();
      article.querySelectorAll(".choice-alta, .choice-media, .choice-baixa").forEach((b) => b.classList.toggle("active", b.dataset.value === novoValor));

      try {
        await salvarCampo("prioridade", novoValor);
      } catch {
        d.prioridade = valorAnterior;
        atualizarVisualPrioridade();
        article.querySelectorAll(".choice-alta, .choice-media, .choice-baixa").forEach((b) => b.classList.toggle("active", b.dataset.value === valorAnterior));
      }
    });
  });

  const salvarBtn = article.querySelector(".salvar-btn");
  const salvarStatus = article.querySelector(".salvar-status");

  salvarBtn.addEventListener("click", async () => {
    const novasNotas = article.querySelector(".notas-textarea").value;

    salvarBtn.disabled = true;
    salvarStatus.textContent = "Salvando...";
    salvarStatus.className = "salvar-status";

    try {
      await salvarCampo("notas_juridico", novasNotas);
      d.notas_juridico = novasNotas;
      salvarStatus.textContent = "Salvo.";
      salvarStatus.classList.add("success");
      setTimeout(() => {
        if (!body.hidden) alternarExpandido();
      }, 600);
    } catch {
      salvarStatus.textContent = "Erro ao salvar. Tente de novo.";
      salvarStatus.classList.add("error");
    } finally {
      salvarBtn.disabled = false;
    }
  });

  const lixeiraBtn = article.querySelector(".lixeira-btn");
  lixeiraBtn.addEventListener("click", () => abrirModalExclusao(d, article));

  return article;
}

/* ---------- modal de exclusao (compartilhado por todos os cards) ---------- */
const apagarModal = document.getElementById("apagar-modal");
const apagarModalSenha = document.getElementById("apagar-modal-senha");
const apagarModalErro = document.getElementById("apagar-modal-erro");
const apagarModalConfirmarBtn = document.getElementById("apagar-modal-confirmar");
const apagarModalCancelarBtn = document.getElementById("apagar-modal-cancelar");
let alvoExclusao = null;

function abrirModalExclusao(d, article) {
  alvoExclusao = { d, article };
  apagarModalSenha.value = "";
  apagarModalErro.hidden = true;
  apagarModal.hidden = false;
  apagarModalSenha.focus();
}

function fecharModalExclusao() {
  apagarModal.hidden = true;
  alvoExclusao = null;
}

apagarModalCancelarBtn.addEventListener("click", fecharModalExclusao);

async function confirmarExclusaoModal() {
  if (!alvoExclusao) return;
  apagarModalErro.hidden = true;
  apagarModalConfirmarBtn.disabled = true;

  try {
    const res = await fetch(`/api/denuncias/${alvoExclusao.d.id}`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senha: apagarModalSenha.value }),
    });
    if (res.status === 401) {
      fecharModalExclusao();
      mostrarLogin();
      return;
    }
    if (!res.ok) {
      apagarModalErro.textContent = "Senha incorreta.";
      apagarModalErro.hidden = false;
      return;
    }
    denuncias = denuncias.filter((x) => x.id !== alvoExclusao.d.id);
    alvoExclusao.article.remove();
    listaVazia.hidden = denuncias.filter((x) => filtroAtual === "todas" || x.status === filtroAtual).length > 0;
    fecharModalExclusao();
  } finally {
    apagarModalConfirmarBtn.disabled = false;
  }
}

apagarModalConfirmarBtn.addEventListener("click", confirmarExclusaoModal);
apagarModalSenha.addEventListener("keydown", (e) => {
  if (e.key === "Enter") confirmarExclusaoModal();
  if (e.key === "Escape") fecharModalExclusao();
});

checarSessao();
