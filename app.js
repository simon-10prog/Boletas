const APP_CONFIG = {
  mode: "apps-script",
  appsScriptUrl: "https://script.google.com/macros/s/AKfycbwXYNMIczU3pl4-sLdz8TjEvCzySCLx-0f6a4cVApRSQgXCmNmW8zGgzK-wb6TbkHTi/exec"
};

const STORAGE_KEY = "rifas-multi-demo";

const state = {
  raffles: [],
  selectedRaffleId: null,
  raffleSearch: "",
  ticketSearch: "",
  activeMode: APP_CONFIG.mode
};

const elements = {
  connectionStatus: document.getElementById("connection-status"),
  raffleForm: document.getElementById("raffle-form"),
  raffleName: document.getElementById("raffle-name"),
  rafflePrize: document.getElementById("raffle-prize"),
  raffleDate: document.getElementById("raffle-date"),
  rafflePrice: document.getElementById("raffle-price"),
  activeRaffles: document.getElementById("active-raffles"),
  soldTickets: document.getElementById("sold-tickets"),
  totalRevenue: document.getElementById("total-revenue"),
  raffleSearch: document.getElementById("raffle-search"),
  rafflesList: document.getElementById("raffles-list"),
  detailPanel: document.getElementById("detail-panel"),
  detailId: document.getElementById("detail-id"),
  detailName: document.getElementById("detail-name"),
  detailMeta: document.getElementById("detail-meta"),
  detailAvailable: document.getElementById("detail-available"),
  detailSold: document.getElementById("detail-sold"),
  detailRevenue: document.getElementById("detail-revenue"),
  ticketSearch: document.getElementById("ticket-search"),
  ticketsGrid: document.getElementById("tickets-grid"),
  ticketNumber: document.getElementById("ticket-number"),
  saleForm: document.getElementById("sale-form"),
  buyerName: document.getElementById("buyer-name"),
  buyerPhone: document.getElementById("buyer-phone"),
  buyerPrice: document.getElementById("buyer-price"),
  closeDetail: document.getElementById("close-detail"),
  toggleSource: document.getElementById("toggle-source"),
  dialog: document.getElementById("ticket-dialog"),
  dialogTitle: document.getElementById("dialog-title"),
  dialogContent: document.getElementById("dialog-content"),
  releaseTicket: document.getElementById("release-ticket"),
  closeDialog: document.getElementById("close-dialog")
};

let selectedTicketNumber = null;


initialize();

async function initialize() {
  bindEvents();
  await loadData();
  render();
  registerServiceWorker();
}

function bindEvents() {
  elements.raffleForm.addEventListener("submit", handleCreateRaffle);
  elements.raffleSearch.addEventListener("input", (event) => {
    state.raffleSearch = event.target.value.trim().toLowerCase();
    renderRaffles();
  });
  elements.ticketSearch.addEventListener("input", (event) => {
    state.ticketSearch = event.target.value.trim().toLowerCase();
    renderSelectedRaffle();
  });
  elements.saleForm.addEventListener("submit", handleSellTicket);
  elements.closeDetail.addEventListener("click", closeRaffleDetail);
  elements.toggleSource.addEventListener("click", toggleModeMessage);
  elements.closeDialog.addEventListener("click", () => elements.dialog.close());
  elements.releaseTicket.addEventListener("click", handleReleaseTicket);
}

async function loadData() {
  if (state.activeMode === "apps-script" && APP_CONFIG.appsScriptUrl) {
    elements.connectionStatus.textContent = "Apps Script";
    try {
      const result = await apiRequest("listarRifas");
      const raffles = result.raffles || [];
      state.raffles = await Promise.all(raffles.map(hydrateRaffleFromApi));
      return;
    } catch (error) {
      state.activeMode = "demo";
      elements.connectionStatus.textContent = "Demo local";
      window.alert("No se pudo conectar con Apps Script. La app seguira en modo demo.");
    }
  }

  const saved = localStorage.getItem(STORAGE_KEY);
  state.raffles = saved ? JSON.parse(saved) : seedDemoRaffles();
}

function persistDemo() {
  if (state.activeMode === "demo") {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.raffles));
  }
}

function seedDemoRaffles() {
  return [
    buildRaffle({
      id: "RIFA001",
      name: "Rifa de lanzamiento",
      prize: "Bono de 300.000",
      drawDate: todayPlus(5),
      ticketPrice: 10000
    })
  ];
}

function buildRaffle({ id, name, prize, drawDate, ticketPrice }) {
  return {
    id,
    name,
    prize,
    drawDate,
    ticketPrice: Number(ticketPrice),
    status: "activa",
    createdAt: new Date().toISOString(),
    tickets: Array.from({ length: 100 }, (_, index) => ({
      number: index.toString().padStart(2, "0"),
      status: "libre",
      buyer: "",
      phone: "",
      soldAt: "",
      amountPaid: 0
    }))
  };
}

async function handleCreateRaffle(event) {
  event.preventDefault();
  const payload = {
    name: elements.raffleName.value.trim(),
    prize: elements.rafflePrize.value.trim(),
    drawDate: elements.raffleDate.value,
    ticketPrice: Number(elements.rafflePrice.value)
  };

  if (state.activeMode === "apps-script" && APP_CONFIG.appsScriptUrl) {
    try {
      await apiRequest("crearRifa", payload);
      await loadData();
    } catch (error) {
      window.alert(error.message);
      return;
    }
  } else {
    const raffle = buildRaffle({ id: nextRaffleId(), ...payload });
    state.raffles.unshift(raffle);
    persistDemo();
  }

  elements.raffleForm.reset();
  render();
}

async function handleSellTicket(event) {
  event.preventDefault();
  const raffle = getSelectedRaffle();
  if (!raffle) return;

  const payload = {
    rifaId: raffle.id,
    number: elements.ticketNumber.value,
    buyer: elements.buyerName.value.trim(),
    phone: elements.buyerPhone.value.trim(),
    amountPaid: Number(elements.buyerPrice.value || raffle.ticketPrice || 0)
  };

  if (state.activeMode === "apps-script" && APP_CONFIG.appsScriptUrl) {
    try {
      await apiRequest("venderBoleta", payload);
      await refreshSelectedRaffle(raffle.id);
    } catch (error) {
      window.alert(error.message);
      return;
    }
  } else {
    const ticket = raffle.tickets.find((item) => item.number === payload.number);
    if (!ticket || ticket.status === "vendido") return;
    ticket.status = "vendido";
    ticket.buyer = payload.buyer;
    ticket.phone = payload.phone;
    ticket.amountPaid = payload.amountPaid;
    ticket.soldAt = new Date().toISOString();
    persistDemo();
  }

  elements.saleForm.reset();
  render();
}

async function handleReleaseTicket() {
  const raffle = getSelectedRaffle();
  if (!raffle || !selectedTicketNumber) return;

  if (state.activeMode === "apps-script" && APP_CONFIG.appsScriptUrl) {
    try {
      await apiRequest("liberarBoleta", {
        rifaId: raffle.id,
        number: selectedTicketNumber
      });
      await refreshSelectedRaffle(raffle.id);
    } catch (error) {
      window.alert(error.message);
      return;
    }
  } else {
    const ticket = raffle.tickets.find((item) => item.number === selectedTicketNumber);
    if (!ticket) return;
    ticket.status = "libre";
    ticket.buyer = "";
    ticket.phone = "";
    ticket.amountPaid = 0;
    ticket.soldAt = "";
    persistDemo();
  }

  elements.dialog.close();
  render();
}

function openRaffleDetail(raffleId) {
  state.selectedRaffleId = raffleId;
  state.ticketSearch = "";
  elements.ticketSearch.value = "";
  renderSelectedRaffle();
  elements.detailPanel.classList.remove("hidden");
}

function closeRaffleDetail() {
  state.selectedRaffleId = null;
  elements.detailPanel.classList.add("hidden");
}

function render() {
  renderSummary();
  renderRaffles();
  renderSelectedRaffle();
}

function renderSummary() {
  const active = state.raffles.filter((raffle) => raffle.status === "activa");
  const allTickets = active.flatMap((raffle) => raffle.tickets || []);
  const sold = allTickets.filter((ticket) => ticket.status === "vendido");
  const revenue = sold.reduce((sum, ticket) => sum + Number(ticket.amountPaid || 0), 0);

  elements.activeRaffles.textContent = active.length;
  elements.soldTickets.textContent = sold.length;
  elements.totalRevenue.textContent = formatCurrency(revenue);
}

function renderRaffles() {
  const query = state.raffleSearch;
  const raffles = state.raffles.filter((raffle) => {
    if (!query) return true;
    const text = [raffle.id, raffle.name, raffle.prize].join(" ").toLowerCase();
    return text.includes(query);
  });

  elements.rafflesList.innerHTML = "";

  raffles.forEach((raffle) => {
    const soldCount = (raffle.tickets || []).filter((ticket) => ticket.status === "vendido").length;
    const revenue = (raffle.tickets || []).reduce((sum, ticket) => sum + Number(ticket.amountPaid || 0), 0);
    const card = document.createElement("article");
    card.className = "raffle-card";
    card.innerHTML = `
      <div class="raffle-card-top">
        <div>
          <p class="eyebrow">${raffle.id}</p>
          <h3>${raffle.name}</h3>
          <p class="muted">${raffle.prize}</p>
        </div>
        <span class="badge">${raffle.status}</span>
      </div>
      <div class="raffle-card-bottom">
        <div class="muted">Sorteo: ${formatDate(raffle.drawDate)} | Valor: ${formatCurrency(raffle.ticketPrice)}</div>
        <div class="muted">${soldCount}/100 vendidas | ${formatCurrency(revenue)}</div>
      </div>
    `;
    card.addEventListener("click", () => openRaffleDetail(raffle.id));
    elements.rafflesList.appendChild(card);
  });

  if (!raffles.length) {
    elements.rafflesList.innerHTML = "<p class='muted'>No hay rifas que coincidan con la busqueda.</p>";
  }
}

function renderSelectedRaffle() {
  const raffle = getSelectedRaffle();
  if (!raffle) return;

  const sold = (raffle.tickets || []).filter((ticket) => ticket.status === "vendido");
  const available = (raffle.tickets || []).length - sold.length;
  const revenue = sold.reduce((sum, ticket) => sum + Number(ticket.amountPaid || 0), 0);

  elements.detailId.textContent = raffle.id;
  elements.detailName.textContent = raffle.name;
  elements.detailMeta.textContent = `${raffle.prize} | Sorteo: ${formatDate(raffle.drawDate)} | Valor base: ${formatCurrency(raffle.ticketPrice)}`;
  elements.detailAvailable.textContent = available;
  elements.detailSold.textContent = sold.length;
  elements.detailRevenue.textContent = formatCurrency(revenue);

  populateTicketSelect(raffle);
  renderTicketsGrid(raffle);
}

function populateTicketSelect(raffle) {
  const availableTickets = (raffle.tickets || []).filter((ticket) => ticket.status === "libre");
  elements.ticketNumber.innerHTML = "";

  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Selecciona un numero";
  placeholder.disabled = true;
  placeholder.selected = true;
  elements.ticketNumber.appendChild(placeholder);

  availableTickets.forEach((ticket) => {
    const option = document.createElement("option");
    option.value = ticket.number;
    option.textContent = ticket.number;
    elements.ticketNumber.appendChild(option);
  });
}

function renderTicketsGrid(raffle) {
  elements.ticketsGrid.innerHTML = "";
  const query = state.ticketSearch;
  const tickets = (raffle.tickets || []).filter((ticket) => {
    if (!query) return true;
    const text = [ticket.number, ticket.buyer].join(" ").toLowerCase();
    return text.includes(query);
  });

  tickets.forEach((ticket) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = `ticket ${ticket.status === "vendido" ? "sold" : ""}`;
    button.innerHTML = `${ticket.number}<small>${ticket.status === "vendido" ? ticket.buyer || "Vendido" : "Libre"}</small>`;
    button.addEventListener("click", () => openTicketDialog(ticket.number));
    elements.ticketsGrid.appendChild(button);
  });
}

function openTicketDialog(number) {
  const raffle = getSelectedRaffle();
  if (!raffle) return;

  const ticket = (raffle.tickets || []).find((item) => item.number === number);
  if (!ticket) return;

  selectedTicketNumber = number;
  elements.dialogTitle.textContent = `Boleta ${number} - ${raffle.name}`;

  if (ticket.status === "vendido") {
    elements.dialogContent.innerHTML = `
      <p><strong>Estado:</strong> Vendido</p>
      <p><strong>Comprador:</strong> ${ticket.buyer}</p>
      <p><strong>Telefono:</strong> ${ticket.phone || "No registrado"}</p>
      <p><strong>Valor:</strong> ${formatCurrency(ticket.amountPaid)}</p>
      <p><strong>Fecha:</strong> ${formatDateTime(ticket.soldAt)}</p>
    `;
    elements.releaseTicket.style.display = "inline-flex";
  } else {
    elements.dialogContent.innerHTML = "<p>Esta boleta esta disponible.</p>";
    elements.releaseTicket.style.display = "none";
  }

  elements.dialog.showModal();
}

function getSelectedRaffle() {
  return state.raffles.find((raffle) => raffle.id === state.selectedRaffleId) || null;
}

async function refreshSelectedRaffle(raffleId) {
  const index = state.raffles.findIndex((raffle) => raffle.id === raffleId);
  if (index === -1) return;
  state.raffles[index] = await hydrateRaffleFromApi(state.raffles[index]);
}

async function hydrateRaffleFromApi(raffle) {
  const raffleId = raffle.rifa_id || raffle.id;
  const result = await apiRequest("obtenerBoletas", { rifaId: raffleId });
  const normalizedTickets = (result.tickets || []).map((ticket) => ({
    number: ticket.numero,
    status: ticket.estado,
    buyer: ticket.comprador || "",
    phone: ticket.telefono || "",
    soldAt: ticket.vendido_en || "",
    amountPaid: Number(ticket.valor_pagado || 0)
  }));

  return {
    id: raffleId,
    name: raffle.nombre || raffle.name,
    prize: raffle.premio || raffle.prize,
    drawDate: raffle.fecha_sorteo || raffle.drawDate,
    ticketPrice: Number(raffle.valor_boleta || raffle.ticketPrice || 0),
    status: raffle.estado || raffle.status || "activa",
    createdAt: raffle.creada_en || raffle.createdAt || "",
    tickets: normalizedTickets
  };
}

function nextRaffleId() {
  const count = state.raffles.length + 1;
  return `RIFA${count.toString().padStart(3, "0")}`;
}

function formatCurrency(value) {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    maximumFractionDigits: 0
  }).format(Number(value || 0));
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Date(`${value}T00:00:00`).toLocaleDateString("es-CO");
}

function formatDateTime(value) {
  if (!value) return "Sin registro";
  return new Date(value).toLocaleString("es-CO");
}

function todayPlus(days) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function toggleModeMessage() {
  const message = state.activeMode === "demo"
    ? "Cuando pegues la URL de Apps Script en APP_CONFIG.appsScriptUrl, esta app dejara de usar localStorage y empezara a consultar Google Sheets."
    : "La app esta usando Apps Script.";
  window.alert(message);
}

async function apiRequest(action, payload = {}) {
  const callbackName = `appsScriptCallback_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const params = new URLSearchParams({ action, ...payload, callback: callbackName });

  return new Promise((resolve, reject) => {
    const script = document.createElement("script");
    const cleanup = () => {
      delete window[callbackName];
      script.remove();
    };

    const timeoutId = window.setTimeout(() => {
      cleanup();
      reject(new Error("No fue posible conectar con Apps Script."));
    }, 10000);

    window[callbackName] = (data) => {
      window.clearTimeout(timeoutId);
      cleanup();

      if (!data || !data.ok) {
        reject(new Error((data && data.error) || "La operacion fallo."));
        return;
      }

      resolve(data);
    };

    script.onerror = () => {
      window.clearTimeout(timeoutId);
      cleanup();
      reject(new Error("No fue posible conectar con Apps Script."));
    };

    script.src = `${APP_CONFIG.appsScriptUrl}?${params.toString()}`;
    document.body.appendChild(script);
  });
}


function registerServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("./service-worker.js").catch(() => {});
  }
}
