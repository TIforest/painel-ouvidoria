const loginView = document.getElementById("login-view");
const dashboardView = document.getElementById("dashboard-view");
const loginForm = document.getElementById("login-form");
const senhaInput = document.getElementById("senha");
const loginStatus = document.getElementById("login-status");
const logoutBtn = document.getElementById("logout-btn");
const lista = document.getElementById("lista");
const listaVazia = document.getElementById("lista-vazia");
const refreshBtn = document.getElementById("refresh-btn");
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

function mostrarLogin() {
  loginView.hidden = false;
  dashboardView.hidden = true;
  logoutBtn.hidden = true;
}

function mostrarDashboard() {
  loginView.hidden = true;
  dashboardView.hidden = false;
  logoutBtn.hidden = false;
  carregarDenuncias();
}

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

refreshBtn.addEventListener("click", carregarDenuncias);

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
  article.className = `denuncia-card status-${d.status}`;
  article.dataset.id = d.id;

  const prioridadeClasse = d.prioridade ? `prioridade-${d.prioridade}` : "prioridade-none";
  const prioridadeTitulo = d.prioridade ? PRIORIDADE_LABEL[d.prioridade] : "não definida";

  article.innerHTML = `
    <button type="button" class="denuncia-header">
      <div class="denuncia-id">
        <span class="protocolo">${escapeHtml(d.protocolo)}</span>
      </div>
      <div class="denuncia-meta">
        <span class="prioridade-dot ${prioridadeClasse}" title="Prioridade: ${prioridadeTitulo}"></span>
        <span class="status-badge status-${d.status}">${STATUS_LABEL[d.status]}</span>
        <span class="data">${escapeHtml(d.created_at)}</span>
        <span class="chevron">›</span>
      </div>
    </button>
    <div class="denuncia-body" hidden>
      <div class="field-row">
        <div class="field">
          <label>Status</label>
          <select class="status-select">
            <option value="aberta" ${d.status === "aberta" ? "selected" : ""}>Aberta</option>
            <option value="andamento" ${d.status === "andamento" ? "selected" : ""}>Em andamento</option>
            <option value="fechada" ${d.status === "fechada" ? "selected" : ""}>Fechada</option>
          </select>
        </div>
        <div class="field">
          <label>Prioridade</label>
          <select class="prioridade-select">
            <option value="" ${!d.prioridade ? "selected" : ""}>Não definida</option>
            <option value="alta" ${d.prioridade === "alta" ? "selected" : ""}>Alta</option>
            <option value="media" ${d.prioridade === "media" ? "selected" : ""}>Média</option>
            <option value="baixa" ${d.prioridade === "baixa" ? "selected" : ""}>Baixa</option>
          </select>
        </div>
      </div>

      <div class="field">
        <label>O que foi feito</label>
        <textarea class="notas-textarea" placeholder="Ex: liguei para fulano em 02/09 e avisei sobre o caso...">${escapeHtml(d.notas_juridico || "")}</textarea>
      </div>

      <div class="denuncia-actions">
        <button type="button" class="submit-btn secondary salvar-btn">Salvar alterações</button>
        <span class="salvar-status"></span>
      </div>
    </div>
  `;

  const header = article.querySelector(".denuncia-header");
  const body = article.querySelector(".denuncia-body");
  header.addEventListener("click", () => {
    body.hidden = !body.hidden;
    article.classList.toggle("expandido", !body.hidden);
  });

  const salvarBtn = article.querySelector(".salvar-btn");
  const salvarStatus = article.querySelector(".salvar-status");

  salvarBtn.addEventListener("click", async () => {
    const novoStatus = article.querySelector(".status-select").value;
    const novaPrioridade = article.querySelector(".prioridade-select").value || null;
    const novasNotas = article.querySelector(".notas-textarea").value;

    salvarBtn.disabled = true;
    salvarStatus.textContent = "Salvando...";
    salvarStatus.className = "salvar-status";

    try {
      const res = await fetch(`/api/denuncias/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: novoStatus, prioridade: novaPrioridade, notas_juridico: novasNotas }),
      });
      if (!res.ok) throw new Error("falha ao salvar");

      d.status = novoStatus;
      d.prioridade = novaPrioridade;
      d.notas_juridico = novasNotas;

      article.className = `denuncia-card status-${d.status} expandido`;
      const statusBadge = article.querySelector(".status-badge");
      statusBadge.className = `status-badge status-${d.status}`;
      statusBadge.textContent = STATUS_LABEL[d.status];

      const dot = article.querySelector(".prioridade-dot");
      dot.className = `prioridade-dot ${d.prioridade ? "prioridade-" + d.prioridade : "prioridade-none"}`;
      dot.title = `Prioridade: ${d.prioridade ? PRIORIDADE_LABEL[d.prioridade] : "não definida"}`;

      salvarStatus.textContent = "Salvo.";
      salvarStatus.classList.add("success");
    } catch {
      salvarStatus.textContent = "Erro ao salvar. Tente de novo.";
      salvarStatus.classList.add("error");
    } finally {
      salvarBtn.disabled = false;
    }
  });

  return article;
}

checarSessao();
