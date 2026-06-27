const STAGES = ["Nuevo", "Revisar", "Cotizando", "Listo", "Descartado"];
const ACTIVE_STATES = ["abierta", "vigente", "por adjudicar", "programada", "por autorizar"];
const STORAGE_KEY = "panama-compra-radar-workspace";
const DEADLINE_SCAN_LIMIT = 30;
const DEADLINE_SOON_HOURS = 48;
const DEFAULT_TAX_RATE = 7;
const STAGE_META = {
  Nuevo: { color: "slate" },
  Revisar: { color: "amber" },
  Cotizando: { color: "teal" },
  Listo: { color: "green" },
  Descartado: { color: "red" }
};
const ENRICHED_TENDER_SUMMARIES = {
  "2026-1-20-1-08-CM-001101": {
    price: "B/. 41,813.00",
    payment: "Credito / 30 dias calendario",
    penalty: "4%",
    submission: "19-06-2026 hasta 10:00 AM",
    opening: "19-06-2026 - 10:01 AM",
    contact: "DAMARIS ITZELL ORTEGA DE SALGADO",
    role: "COTIZADOR",
    phone: "502-4604",
    email: "dortega@ifarhu.gob.pa"
  }
};
const DETAIL_PENDING = "Cargando...";
const DETAIL_UNAVAILABLE = "No disponible";
let deadlineScanToken = 0;
let deadlineScanTimer = 0;

const state = {
  activeView: "work",
  tenders: [],
  catalogs: { estados: [], tipos: [], provincias: [] },
  workspace: loadWorkspace(),
  details: {},
  selectedId: null,
  filters: {
    q: "",
    estado: "",
    tipo: "",
    objeto: "",
    provincia: "",
    dateFrom: "",
    dateTo: "",
    limit: "50",
    stage: "",
    deadline: ""
  },
  provider: createProviderState(),
  loading: false,
  thinkingCount: 0,
  lastSync: null
};

const el = {
  workTabBtn: document.querySelector("#workTabBtn"),
  tendersTabBtn: document.querySelector("#tendersTabBtn"),
  flowTabBtn: document.querySelector("#flowTabBtn"),
  providersTabBtn: document.querySelector("#providersTabBtn"),
  quotesTabBtn: document.querySelector("#quotesTabBtn"),
  workView: document.querySelector("#workView"),
  tendersView: document.querySelector("#tendersView"),
  flowView: document.querySelector("#flowView"),
  providersView: document.querySelector("#providersView"),
  quotesView: document.querySelector("#quotesView"),
  refreshBtn: document.querySelector("#refreshBtn"),
  syncStatus: document.querySelector("#syncStatus"),
  thinkingIndicator: document.querySelector("#thinkingIndicator"),
  thinkingText: document.querySelector("#thinkingText"),
  thinkingOverlay: document.querySelector("#thinkingOverlay"),
  thinkingOverlayText: document.querySelector("#thinkingOverlayText"),
  metricTotal: document.querySelector("#metricTotal"),
  metricFresh: document.querySelector("#metricFresh"),
  metricActive: document.querySelector("#metricActive"),
  metricQuoting: document.querySelector("#metricQuoting"),
  metricDueSoon: document.querySelector("#metricDueSoon"),
  workDueSoonCount: document.querySelector("#workDueSoonCount"),
  workNeedQuotesCount: document.querySelector("#workNeedQuotesCount"),
  workNoResponseCount: document.querySelector("#workNoResponseCount"),
  workIncompleteCount: document.querySelector("#workIncompleteCount"),
  workAlertsMeta: document.querySelector("#workAlertsMeta"),
  workAlertsList: document.querySelector("#workAlertsList"),
  workActiveMeta: document.querySelector("#workActiveMeta"),
  workActiveList: document.querySelector("#workActiveList"),
  workGoToTendersBtn: document.querySelector("#workGoToTendersBtn"),
  workGoToQuotesBtn: document.querySelector("#workGoToQuotesBtn"),
  summaryEyebrow: document.querySelector("#summaryEyebrow"),
  summaryTitle: document.querySelector("#summaryTitle"),
  summaryDescription: document.querySelector("#summaryDescription"),
  summaryFavoriteBtn: document.querySelector("#summaryFavoriteBtn"),
  summaryItemsBtn: document.querySelector("#summaryItemsBtn"),
  summaryItemsBadge: document.querySelector("#summaryItemsBadge"),
  summaryOpenBtn: document.querySelector("#summaryOpenBtn"),
  summaryCopyBtn: document.querySelector("#summaryCopyBtn"),
  summaryNumber: document.querySelector("#summaryNumber"),
  summaryObject: document.querySelector("#summaryObject"),
  summaryType: document.querySelector("#summaryType"),
  summaryPrice: document.querySelector("#summaryPrice"),
  summaryPayment: document.querySelector("#summaryPayment"),
  summaryPenalty: document.querySelector("#summaryPenalty"),
  summaryPublished: document.querySelector("#summaryPublished"),
  summarySubmission: document.querySelector("#summarySubmission"),
  summaryOpening: document.querySelector("#summaryOpening"),
  summaryEntity: document.querySelector("#summaryEntity"),
  summaryContact: document.querySelector("#summaryContact"),
  summaryRole: document.querySelector("#summaryRole"),
  summaryPhone: document.querySelector("#summaryPhone"),
  summaryEmail: document.querySelector("#summaryEmail"),
  summaryItemsTotal: document.querySelector("#summaryItemsTotal"),
  summaryItemsList: document.querySelector("#summaryItemsList"),
  requestModal: document.querySelector("#requestModal"),
  requestModalClose: document.querySelector("#requestModalClose"),
  favoritesList: document.querySelector("#favoritesList"),
  clearFavoritesBtn: document.querySelector("#clearFavoritesBtn"),
  resultMeta: document.querySelector("#resultMeta"),
  searchInput: document.querySelector("#searchInput"),
  stateFilter: document.querySelector("#stateFilter"),
  typeFilter: document.querySelector("#typeFilter"),
  objectFilter: document.querySelector("#objectFilter"),
  provinceFilter: document.querySelector("#provinceFilter"),
  dateFromFilter: document.querySelector("#dateFromFilter"),
  dateToFilter: document.querySelector("#dateToFilter"),
  deadlineFilter: document.querySelector("#deadlineFilter"),
  limitFilter: document.querySelector("#limitFilter"),
  clearFiltersBtn: document.querySelector("#clearFiltersBtn"),
  tendersBody: document.querySelector("#tendersBody"),
  emptyState: document.querySelector("#emptyState"),
  flowBoard: document.querySelector("#flowBoard"),
  flowMeta: document.querySelector("#flowMeta"),
  flowWorkingCount: document.querySelector("#flowWorkingCount"),
  flowPriorityCount: document.querySelector("#flowPriorityCount"),
  flowReadyCount: document.querySelector("#flowReadyCount"),
  flowGoToTendersBtn: document.querySelector("#flowGoToTendersBtn"),
  flowGoToQuotesBtn: document.querySelector("#flowGoToQuotesBtn"),
  detailEmpty: document.querySelector("#detailEmpty"),
  detailContent: document.querySelector("#detailContent"),
  detailNumber: document.querySelector("#detailNumber"),
  detailTitle: document.querySelector("#detailTitle"),
  detailBadge: document.querySelector("#detailBadge"),
  detailEntity: document.querySelector("#detailEntity"),
  detailType: document.querySelector("#detailType"),
  detailObject: document.querySelector("#detailObject"),
  detailDate: document.querySelector("#detailDate"),
  portalLink: document.querySelector("#portalLink"),
  copyMessageBtn: document.querySelector("#copyMessageBtn"),
  quoteTenderSelect: document.querySelector("#quoteTenderSelect"),
  quoteGoToTendersBtn: document.querySelector("#quoteGoToTendersBtn"),
  quoteReferencePrice: document.querySelector("#quoteReferencePrice"),
  quoteBestSupplier: document.querySelector("#quoteBestSupplier"),
  quoteBestAmount: document.querySelector("#quoteBestAmount"),
  quoteEstimatedMargin: document.querySelector("#quoteEstimatedMargin"),
  quoteTaxAmount: document.querySelector("#quoteTaxAmount"),
  quoteSuggestedPrice: document.querySelector("#quoteSuggestedPrice"),
  quoteDueDate: document.querySelector("#quoteDueDate"),
  quoteTargetMargin: document.querySelector("#quoteTargetMargin"),
  quoteTaxRate: document.querySelector("#quoteTaxRate"),
  stageSelect: document.querySelector("#stageSelect"),
  prioritySelect: document.querySelector("#prioritySelect"),
  notesInput: document.querySelector("#notesInput"),
  supplierForm: document.querySelector("#supplierForm"),
  supplierName: document.querySelector("#supplierName"),
  supplierContact: document.querySelector("#supplierContact"),
  supplierAmount: document.querySelector("#supplierAmount"),
  supplierLeadTime: document.querySelector("#supplierLeadTime"),
  supplierStatus: document.querySelector("#supplierStatus"),
  supplierNote: document.querySelector("#supplierNote"),
  suppliersList: document.querySelector("#suppliersList"),
  quoteSupplierMeta: document.querySelector("#quoteSupplierMeta"),
  exportTendersBtn: document.querySelector("#exportTendersBtn"),
  exportQuotesBtn: document.querySelector("#exportQuotesBtn"),
  providerMetricMatches: document.querySelector("#providerMetricMatches"),
  providerMetricActivities: document.querySelector("#providerMetricActivities"),
  providerMetricSanctions: document.querySelector("#providerMetricSanctions"),
  providerSearchForm: document.querySelector("#providerSearchForm"),
  providerNameInput: document.querySelector("#providerNameInput"),
  providerDateFrom: document.querySelector("#providerDateFrom"),
  providerDateTo: document.querySelector("#providerDateTo"),
  providerScanLimit: document.querySelector("#providerScanLimit"),
  providerSearchBtn: document.querySelector("#providerSearchBtn"),
  providerSearchMeta: document.querySelector("#providerSearchMeta"),
  providerListMeta: document.querySelector("#providerListMeta"),
  providerMatchesList: document.querySelector("#providerMatchesList"),
  providerActivityMeta: document.querySelector("#providerActivityMeta"),
  providerActivitiesList: document.querySelector("#providerActivitiesList"),
  providerSanctionsMeta: document.querySelector("#providerSanctionsMeta"),
  providerSanctionsList: document.querySelector("#providerSanctionsList"),
  crmProviderForm: document.querySelector("#crmProviderForm"),
  crmProviderName: document.querySelector("#crmProviderName"),
  crmProviderContact: document.querySelector("#crmProviderContact"),
  crmProviderCategory: document.querySelector("#crmProviderCategory"),
  crmProviderStatus: document.querySelector("#crmProviderStatus"),
  crmProviderNote: document.querySelector("#crmProviderNote"),
  crmProvidersList: document.querySelector("#crmProvidersList"),
  toast: document.querySelector("#toast")
};

init();

async function init() {
  initProviderDates();
  bindEvents();
  renderProviderView();
  await loadCatalogs();
  await loadTenders();
}

function bindEvents() {
  el.workTabBtn.addEventListener("click", () => switchView("work"));
  el.tendersTabBtn.addEventListener("click", () => switchView("tenders"));
  el.flowTabBtn.addEventListener("click", () => switchView("flow"));
  el.providersTabBtn.addEventListener("click", () => switchView("providers"));
  el.quotesTabBtn.addEventListener("click", () => switchView("quotes"));
  el.refreshBtn.addEventListener("click", loadTenders);
  el.summaryFavoriteBtn.addEventListener("click", toggleSelectedFavorite);
  el.summaryItemsBtn.addEventListener("click", openRequestModal);
  el.summaryOpenBtn.addEventListener("click", openSelectedTender);
  el.summaryCopyBtn.addEventListener("click", copySelectedSummary);
  el.searchInput.addEventListener("input", debounce((event) => {
    state.filters.q = event.target.value.trim();
    render();
  }, 160));

  for (const [node, key] of [
    [el.stateFilter, "estado"],
    [el.typeFilter, "tipo"],
    [el.objectFilter, "objeto"],
    [el.provinceFilter, "provincia"],
    [el.dateFromFilter, "dateFrom"],
    [el.dateToFilter, "dateTo"],
    [el.deadlineFilter, "deadline"],
    [el.limitFilter, "limit"]
  ]) {
    node.addEventListener("change", async (event) => {
      state.filters[key] = event.target.value;
      if (["estado", "tipo", "provincia", "dateFrom", "dateTo", "limit"].includes(key)) {
        await loadTenders();
      } else {
        render();
      }
    });
  }

  el.clearFiltersBtn.addEventListener("click", async () => {
    state.filters = { q: "", estado: "", tipo: "", objeto: "", provincia: "", dateFrom: "", dateTo: "", limit: "50", stage: "", deadline: "" };
    el.searchInput.value = "";
    el.stateFilter.value = "";
    el.typeFilter.value = "";
    el.objectFilter.value = "";
    el.provinceFilter.value = "";
    el.dateFromFilter.value = "";
    el.dateToFilter.value = "";
    el.deadlineFilter.value = "";
    el.limitFilter.value = "50";
    document.querySelectorAll(".stage-tab").forEach((button) => {
      button.classList.toggle("active", button.dataset.stageFilter === "");
    });
    await loadTenders();
  });

  document.querySelectorAll(".stage-tab").forEach((button) => {
    button.addEventListener("click", () => {
      state.filters.stage = button.dataset.stageFilter || "";
      document.querySelectorAll(".stage-tab").forEach((item) => item.classList.remove("active"));
      button.classList.add("active");
      render();
    });
  });

  el.stageSelect.addEventListener("change", () => {
    const tender = getSelectedTender();
    if (!tender) return;
    const work = getTenderWork(tender);
    work.stage = el.stageSelect.value;
    if (work.stage !== "Nuevo" || work.favorite) {
      activateFlowItem(tender, work);
    }
    saveAndRender();
  });

  el.prioritySelect.addEventListener("change", () => {
    const tender = getSelectedTender();
    if (!tender) return;
    getTenderWork(tender).priority = el.prioritySelect.value;
    saveAndRender();
  });

  el.notesInput.addEventListener("input", debounce(() => {
    const tender = getSelectedTender();
    if (!tender) return;
    getTenderWork(tender).notes = el.notesInput.value;
    saveWorkspace();
  }, 180));

  el.quoteDueDate.addEventListener("change", () => {
    const tender = getSelectedTender();
    if (!tender) return;
    getTenderWork(tender).dueDate = el.quoteDueDate.value;
    saveWorkspace();
    renderBackOffice();
  });

  el.quoteTargetMargin.addEventListener("input", debounce(() => {
    const tender = getSelectedTender();
    if (!tender) return;
    getTenderWork(tender).targetMargin = el.quoteTargetMargin.value;
    saveWorkspace();
    renderQuoteMetrics(tender, getTenderWork(tender));
  }, 160));

  el.quoteTaxRate.addEventListener("input", debounce(() => {
    const tender = getSelectedTender();
    if (!tender) return;
    getTenderWork(tender).taxRate = el.quoteTaxRate.value;
    saveWorkspace();
    renderQuoteMetrics(tender, getTenderWork(tender));
  }, 160));

  el.quoteTenderSelect.addEventListener("change", () => {
    state.selectedId = el.quoteTenderSelect.value || null;
    render();
  });

  el.quoteGoToTendersBtn.addEventListener("click", () => switchView("tenders"));
  el.workGoToTendersBtn.addEventListener("click", () => switchView("tenders"));
  el.workGoToQuotesBtn.addEventListener("click", () => switchView("quotes"));
  el.flowGoToTendersBtn.addEventListener("click", () => switchView("tenders"));
  el.flowGoToQuotesBtn.addEventListener("click", () => switchView("quotes"));

  el.supplierForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const tender = getSelectedTender();
    if (!tender) return;
    const work = getTenderWork(tender);
    work.suppliers.unshift({
      id: createId(),
      name: el.supplierName.value.trim(),
      contact: el.supplierContact.value.trim(),
      amount: normalizeAmount(el.supplierAmount.value),
      leadTime: el.supplierLeadTime.value.trim(),
      status: el.supplierStatus.value,
      note: el.supplierNote.value.trim(),
      createdAt: new Date().toISOString()
    });
    el.supplierForm.reset();
    saveAndRender();
    showToast("Proveedor agregado");
  });

  el.copyMessageBtn.addEventListener("click", copySupplierMessage);
  el.exportTendersBtn.addEventListener("click", exportVisibleTenders);
  el.exportQuotesBtn.addEventListener("click", exportQuotes);
  el.providerSearchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    loadProviderActivity();
  });
  el.crmProviderForm.addEventListener("submit", (event) => {
    event.preventDefault();
    addCrmProviderFromForm();
  });
  el.clearFavoritesBtn.addEventListener("click", clearFavorites);
  el.requestModalClose.addEventListener("click", closeRequestModal);
  el.requestModal.addEventListener("click", (event) => {
    if (event.target === el.requestModal) closeRequestModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && !el.requestModal.classList.contains("hidden")) {
      closeRequestModal();
    }
  });
}

function createProviderState() {
  return {
    loading: false,
    searched: false,
    query: "",
    dateFrom: "",
    dateTo: "",
    scanLimit: "50",
    providers: [],
    selectedProviderKey: "",
    activities: [],
    sanctions: [],
    scanned: 0,
    scanBreakdown: null,
    syncedAt: "",
    error: ""
  };
}

function initProviderDates() {
  const today = new Date();
  const start = new Date(today);
  start.setDate(start.getDate() - 60);
  state.provider.dateFrom = toDateInputValue(start);
  state.provider.dateTo = toDateInputValue(today);
  el.providerDateFrom.value = state.provider.dateFrom;
  el.providerDateTo.value = state.provider.dateTo;
  el.providerScanLimit.value = state.provider.scanLimit;
}

function switchView(view) {
  state.activeView = view;
  el.workView.classList.toggle("hidden", view !== "work");
  el.tendersView.classList.toggle("hidden", view !== "tenders");
  el.flowView.classList.toggle("hidden", view !== "flow");
  el.providersView.classList.toggle("hidden", view !== "providers");
  el.quotesView.classList.toggle("hidden", view !== "quotes");
  el.workTabBtn.classList.toggle("active", view === "work");
  el.tendersTabBtn.classList.toggle("active", view === "tenders");
  el.flowTabBtn.classList.toggle("active", view === "flow");
  el.providersTabBtn.classList.toggle("active", view === "providers");
  el.quotesTabBtn.classList.toggle("active", view === "quotes");
  if (view === "work") renderWorkView();
  if (view === "tenders") renderTenderWorkspace();
  if (view === "flow") renderFlowBoard();
  if (view === "providers") renderProviderView();
  if (view === "quotes") renderBackOffice();
}

async function loadProviderActivity() {
  const query = el.providerNameInput.value.trim();
  if (query.length < 2) {
    showToast("Escribe el nombre del proveedor");
    return;
  }

  state.provider.loading = true;
  state.provider.searched = true;
  state.provider.query = query;
  state.provider.dateFrom = el.providerDateFrom.value;
  state.provider.dateTo = el.providerDateTo.value;
  state.provider.scanLimit = el.providerScanLimit.value;
  state.provider.error = "";
  state.provider.scanBreakdown = null;
  const stopThinking = startThinking("Buscando actividad del proveedor...");
  renderProviderView();

  try {
    const params = new URLSearchParams({
      nombre: state.provider.query,
      limit: state.provider.scanLimit
    });
    if (state.provider.dateFrom) params.set("desde", state.provider.dateFrom);
    if (state.provider.dateTo) params.set("hasta", state.provider.dateTo);
    const data = await fetchJson(`/api/proveedor-actividad?${params.toString()}`);
    state.provider.providers = data.providers || [];
    state.provider.activities = data.activities || [];
    state.provider.sanctions = data.sanctions || [];
    state.provider.scanned = data.scanned || 0;
    state.provider.scanBreakdown = data.scanBreakdown || null;
    state.provider.syncedAt = data.syncedAt || new Date().toISOString();
    state.provider.selectedProviderKey = state.provider.providers[0]
      ? getProviderKey(state.provider.providers[0])
      : "";
    showToast("Busqueda de proveedor lista");
  } catch (error) {
    state.provider.error = error.message || "No se pudo buscar el proveedor";
    showToast(state.provider.error);
  } finally {
    state.provider.loading = false;
    stopThinking();
    renderProviderView();
  }
}

function renderProviderView() {
  const providerState = state.provider;
  el.providerSearchBtn.disabled = providerState.loading;
  el.providerMetricMatches.textContent = providerState.providers.length;
  el.providerMetricActivities.textContent = providerState.activities.length;
  el.providerMetricSanctions.textContent = providerState.sanctions.length;

  if (providerState.loading) {
    el.providerSearchMeta.textContent = "Consultando el portal y revisando procesos...";
  } else if (providerState.error) {
    el.providerSearchMeta.textContent = providerState.error;
  } else if (providerState.searched) {
    const breakdown = providerState.scanBreakdown;
    const scanText = breakdown
      ? `Revisados ${breakdown.unicos || providerState.scanned} procesos (${breakdown.adjudicados || 0} adjudicados).`
      : `Revisados ${providerState.scanned} procesos en el rango seleccionado.`;
    el.providerSearchMeta.textContent = `${scanText} Actualizado ${formatTime(providerState.syncedAt)}.`;
  } else {
    el.providerSearchMeta.textContent = "Ingresa un nombre para consultar proveedores, participaciones y sanciones publicas.";
  }

  renderProviderMatches();
  renderProviderActivities();
  renderProviderSanctions();
  renderCrmProviders();
}

function renderProviderMatches() {
  const providers = state.provider.providers;
  el.providerMatchesList.innerHTML = "";
  el.providerListMeta.textContent = state.provider.searched
    ? `${providers.length} coincidencias`
    : "Sin busqueda";

  if (state.provider.loading) {
    el.providerMatchesList.innerHTML = `<div class="provider-empty">Buscando proveedores...</div>`;
    return;
  }

  if (!state.provider.searched) {
    el.providerMatchesList.innerHTML = `<div class="provider-empty">Busca un proveedor para ver coincidencias del registro publico.</div>`;
    return;
  }

  if (!providers.length) {
    el.providerMatchesList.innerHTML = `<div class="provider-empty">No se encontraron proveedores con ese nombre.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const provider of providers) {
    const key = getProviderKey(provider);
    const sourceLabel = provider.source === "legacy" ? "Registro V2" : "Registro V3";
    const profileAmount = provider.profile?.montoAdjudicado || "";
    const profileStatus = provider.profile
      ? `Monto adjudicado en ficha: ${profileAmount || "Sin monto"}`
      : "";
    const profileLink = provider.profileUrl
      ? `<a class="btn secondary provider-profile-link" href="${escapeHtml(provider.profileUrl)}" target="_blank" rel="noreferrer noopener">Ver ficha</a>`
      : "";
    const card = document.createElement("article");
    card.className = `provider-match-card${key === state.provider.selectedProviderKey ? " active" : ""}`;
    card.innerHTML = `
      <button type="button">
        <strong>${escapeHtml(getProviderName(provider))}</strong>
        <span class="provider-card-meta">
          <span>${escapeHtml(sourceLabel)}</span>
          <span>RUC: ${escapeHtml(provider.ruc || "-")}</span>
          <span>${escapeHtml(provider.razonSocial || "")}</span>
          <span>${escapeHtml(profileStatus)}</span>
        </span>
      </button>
      <div class="provider-card-actions">
        ${profileLink}
        <button class="btn secondary provider-save-crm" type="button">Guardar CRM</button>
      </div>
    `;
    card.querySelector("button").addEventListener("click", () => {
      state.provider.selectedProviderKey = key;
      el.providerNameInput.value = getProviderName(provider);
      loadProviderActivity();
    });
    card.querySelector(".provider-save-crm").addEventListener("click", () => saveProviderToCrm(provider));
    fragment.appendChild(card);
  }
  el.providerMatchesList.appendChild(fragment);
}

function addCrmProviderFromForm() {
  const provider = {
    name: el.crmProviderName.value.trim(),
    contact: el.crmProviderContact.value.trim(),
    category: el.crmProviderCategory.value.trim(),
    status: el.crmProviderStatus.value,
    note: el.crmProviderNote.value.trim()
  };
  if (!provider.name) {
    showToast("Escribe el nombre del proveedor");
    return;
  }
  upsertCrmProvider(provider);
  el.crmProviderForm.reset();
  renderCrmProviders();
  showToast("Proveedor guardado en CRM");
}

function saveProviderToCrm(provider) {
  upsertCrmProvider({
    name: getProviderName(provider),
    contact: provider.profile?.contacto || provider.representanteLegal || "",
    category: "",
    status: "Activo",
    note: [provider.razonSocial, provider.ruc ? `RUC: ${provider.ruc}` : "", provider.profile?.montoAdjudicado ? `Monto adjudicado: ${provider.profile.montoAdjudicado}` : ""]
      .filter(Boolean)
      .join(" / "),
    source: provider.source,
    ruc: provider.ruc || ""
  });
  renderCrmProviders();
  showToast("Proveedor guardado en CRM");
}

function upsertCrmProvider(provider) {
  const providers = getCrmProviders();
  const key = normalizeText(provider.ruc || provider.name);
  const existingIndex = providers.findIndex((item) => normalizeText(item.ruc || item.name) === key);
  const saved = {
    id: existingIndex >= 0 ? providers[existingIndex].id : createId(),
    name: provider.name || "",
    contact: provider.contact || "",
    category: provider.category || "",
    status: provider.status || "Activo",
    note: provider.note || "",
    source: provider.source || "interno",
    ruc: provider.ruc || "",
    updatedAt: new Date().toISOString(),
    createdAt: existingIndex >= 0 ? providers[existingIndex].createdAt : new Date().toISOString()
  };
  if (existingIndex >= 0) providers[existingIndex] = saved;
  else providers.unshift(saved);
  state.workspace.__crmProviders = providers;
  saveWorkspace();
}

function renderCrmProviders() {
  const providers = getCrmProviders();
  el.crmProvidersList.innerHTML = "";
  if (!providers.length) {
    el.crmProvidersList.innerHTML = `<div class="provider-empty">Aun no hay proveedores internos guardados.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const provider of providers) {
    const card = document.createElement("article");
    card.className = "crm-provider-card";
    card.innerHTML = `
      <div>
        <strong>${escapeHtml(provider.name)}</strong>
        <span>${escapeHtml([provider.category, provider.contact].filter(Boolean).join(" / ") || "Sin contacto")}</span>
        <small>${escapeHtml(provider.note || "Sin nota")}</small>
      </div>
      <span class="status-pill ${provider.status === "No usar" ? "closed" : provider.status === "Evaluar" ? "warn" : ""}">${escapeHtml(provider.status)}</span>
      <button class="btn ghost crm-use-provider" type="button">Usar</button>
      <button class="btn remove crm-remove-provider" type="button" aria-label="Eliminar proveedor">X</button>
    `;
    card.querySelector(".crm-use-provider").addEventListener("click", () => {
      el.supplierName.value = provider.name;
      el.supplierContact.value = provider.contact;
      switchView("quotes");
      showToast("Proveedor cargado en cotizacion");
    });
    card.querySelector(".crm-remove-provider").addEventListener("click", () => removeCrmProvider(provider.id));
    fragment.appendChild(card);
  }
  el.crmProvidersList.appendChild(fragment);
}

function getCrmProviders() {
  if (!Array.isArray(state.workspace.__crmProviders)) {
    state.workspace.__crmProviders = [];
  }
  return state.workspace.__crmProviders;
}

function removeCrmProvider(providerId) {
  state.workspace.__crmProviders = getCrmProviders().filter((provider) => provider.id !== providerId);
  saveWorkspace();
  renderCrmProviders();
  showToast("Proveedor eliminado del CRM");
}

function renderProviderActivities() {
  const activities = state.provider.activities;
  el.providerActivitiesList.innerHTML = "";
  el.providerActivityMeta.textContent = state.provider.searched
    ? `${activities.length} actividades encontradas`
    : "Sin resultados";

  if (state.provider.loading) {
    el.providerActivitiesList.innerHTML = `<div class="provider-empty">Revisando procesos del portal...</div>`;
    return;
  }

  if (!state.provider.searched) {
    el.providerActivitiesList.innerHTML = `<div class="provider-empty">La actividad aparecera aqui despues de la busqueda.</div>`;
    return;
  }

  if (!activities.length) {
    const legacyOnly = state.provider.providers.length > 0 &&
      state.provider.providers.every((provider) => provider.source === "legacy");
    const hasV3 = state.provider.providers.some((provider) => provider.source === "v3");
    const emptyMessage = legacyOnly
      ? "Proveedor encontrado en el registro V2. Su ficha publica no reporta monto adjudicado y no aparece actividad cruzable en procesos V3 dentro del rango revisado."
      : hasV3
        ? "Proveedor encontrado en el registro V3, pero el portal publico no devolvio procesos para ese proveedor ni aparecio entre los procesos adjudicados revisados."
      : "No se encontro actividad en los procesos revisados para ese rango.";
    el.providerActivitiesList.innerHTML = `<div class="provider-empty">${escapeHtml(emptyMessage)}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const activity of activities) {
    const card = document.createElement("article");
    card.className = "provider-activity-card";
    card.innerHTML = `
      <div class="provider-activity-head">
        <div class="provider-activity-title">
          <span class="status-pill ${statusClass(activity.estado)}">${escapeHtml(activity.relation || activity.estado || "Actividad")}</span>
          <a href="${escapeHtml(activity.portalDetalleUrl || activity.portalUrl || "#")}" target="_blank" rel="noreferrer noopener">${escapeHtml(activity.numero || "Sin numero")}</a>
          <strong>${escapeHtml(activity.titulo || "Sin descripcion")}</strong>
        </div>
        <a class="btn secondary" href="${escapeHtml(activity.portalDetalleUrl || activity.portalUrl || "#")}" target="_blank" rel="noreferrer noopener">Abrir portal</a>
      </div>
      <div class="provider-activity-meta">
        <span>${escapeHtml(activity.entidad || "Sin entidad")}</span>
        <span>${escapeHtml(formatDate(activity.fechaPublicacion))}</span>
        <span>${escapeHtml(activity.estado || "Sin estado")}</span>
      </div>
      <div class="provider-activity-grid">
        <div>
          <span>Proveedor</span>
          <strong>${escapeHtml(activity.providerName || "-")}</strong>
        </div>
        <div>
          <span>RUC</span>
          <strong>${escapeHtml(activity.providerRuc || "-")}</strong>
        </div>
        <div>
          <span>Monto oferta</span>
          <strong>${escapeHtml(activity.offerAmount || "-")}</strong>
        </div>
        <div>
          <span>Items</span>
          <strong>${escapeHtml(activity.itemCount || "-")}</strong>
        </div>
      </div>
    `;
    fragment.appendChild(card);
  }
  el.providerActivitiesList.appendChild(fragment);
}

function renderProviderSanctions() {
  const sanctions = state.provider.sanctions;
  el.providerSanctionsList.innerHTML = "";
  el.providerSanctionsMeta.textContent = state.provider.searched
    ? `${sanctions.length} registros`
    : "Sin resultados";

  if (state.provider.loading) {
    el.providerSanctionsList.innerHTML = `<div class="provider-empty">Consultando sanciones publicas...</div>`;
    return;
  }

  if (!state.provider.searched) {
    el.providerSanctionsList.innerHTML = `<div class="provider-empty">Las multas o inhabilitaciones apareceran aqui si existen.</div>`;
    return;
  }

  if (!sanctions.length) {
    el.providerSanctionsList.innerHTML = `<div class="provider-empty">No se encontraron multas o inhabilitaciones con ese nombre.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const sanction of sanctions) {
    const card = document.createElement("article");
    card.className = "provider-sanction-card";
    const link = sanction.link
      ? `<a class="btn secondary" href="${escapeHtml(sanction.link)}" target="_blank" rel="noreferrer noopener">Ver resolucion</a>`
      : "";
    card.innerHTML = `
      <span class="status-pill warn">${escapeHtml(sanction.type || "Registro")}</span>
      <strong>${escapeHtml(sanction.nombreComercial || sanction.razonSocial || "Proveedor")}</strong>
      <div class="provider-sanction-meta">
        <span>${escapeHtml(sanction.razonSocial || "")}</span>
        <span>${escapeHtml(sanction.institution || "")}</span>
        <span>${escapeHtml(sanction.date || "")}</span>
      </div>
      <div>${escapeHtml(sanction.title || "")}</div>
      ${link}
    `;
    fragment.appendChild(card);
  }
  el.providerSanctionsList.appendChild(fragment);
}

async function loadCatalogs() {
  const stopThinking = startThinking("Cargando catalogos...");
  try {
    const data = await fetchJson("/api/catalogs");
    state.catalogs = data;
    fillCatalogs();
  } catch (error) {
    showToast(error.message || "No se pudieron cargar catalogos");
  } finally {
    stopThinking();
  }
}

async function loadTenders() {
  syncFiltersFromControls();
  state.loading = true;
  const stopThinking = startThinking("Sincronizando licitaciones...");
  setSyncStatus("Sincronizando...");
  el.refreshBtn.disabled = true;

  try {
    const requestedLimit = Number(state.filters.limit || 50);
    const params = new URLSearchParams({
      limit: String(requestedLimit),
      pages: String(Math.ceil(requestedLimit / 100) || 1)
    });
    if (state.filters.estado) params.set("estado", state.filters.estado);
    if (state.filters.tipo) params.set("tipo", state.filters.tipo);
    if (state.filters.provincia) params.set("provincia", state.filters.provincia);
    if (state.filters.q) params.set("q", state.filters.q);
    if (state.filters.dateFrom) params.set("desde", state.filters.dateFrom);
    if (state.filters.dateTo) params.set("hasta", state.filters.dateTo);

    const data = await fetchJson(`/api/licitaciones?${params.toString()}`);
    state.tenders = data.items || [];
    state.lastSync = data.syncedAt || new Date().toISOString();
    if (!state.tenders.some((item) => item.id === state.selectedId)) {
      state.selectedId = state.tenders[0]?.id || null;
    }
    setSyncStatus(`Actualizado ${formatTime(state.lastSync)}`);
    render();
    scheduleDeadlineScan(state.tenders);
  } catch (error) {
    setSyncStatus("Error de sincronizacion");
    showToast(error.hint || error.message || "No se pudo sincronizar");
  } finally {
    state.loading = false;
    el.refreshBtn.disabled = false;
    stopThinking();
  }
}

function fillCatalogs() {
  setOptions(el.stateFilter, state.catalogs.estados, "idEstado", "nombre", "Todos");
  setOptions(el.typeFilter, state.catalogs.tipos, "idTipoProceso", "nombre", "Todos");
  setOptions(el.provinceFilter, state.catalogs.provincias, "id", "provincia", "Todas");
}

function setOptions(select, items, valueKey, labelKey, defaultLabel) {
  const current = select.value;
  select.innerHTML = `<option value="">${defaultLabel}</option>`;
  for (const item of items || []) {
    const option = document.createElement("option");
    option.value = item[valueKey];
    option.textContent = item.prefijo ? `${item.prefijo} - ${item[labelKey]}` : item[labelKey];
    select.appendChild(option);
  }
  select.value = current;
}

function render() {
  if (state.activeView === "work") {
    renderWorkView();
    return;
  }

  if (state.activeView === "tenders") {
    renderTenderWorkspace();
    return;
  }

  if (state.activeView === "flow") {
    renderFlowBoard();
    return;
  }

  if (state.activeView === "quotes") {
    renderBackOffice();
    return;
  }

  if (state.activeView === "providers") {
    renderProviderView();
  }
}

function renderTenderWorkspace() {
  const visible = getVisibleTenders();
  ensureSelectedTender(visible);
  renderSelectedSummary();
  renderFavorites();
  renderMetrics(visible);
  renderTenders(visible);
}

function ensureSelectedTender(visible) {
  if (!visible.length) {
    if (!getSelectedTender()) state.selectedId = null;
    return;
  }

  if (state.selectedId && getSelectedTender()) {
    return;
  }

  if (!visible.some((item) => item.id === state.selectedId)) {
    state.selectedId = visible[0].id;
  }
}

function renderMetrics(visible) {
  const now = Date.now();
  const fresh = visible.filter((item) => {
    const date = item.fechaPublicacion ? new Date(item.fechaPublicacion).getTime() : 0;
    return date && now - date <= 24 * 60 * 60 * 1000;
  }).length;
  const active = visible.filter((item) => ACTIVE_STATES.includes((item.estado || "").toLowerCase())).length;
  const quoting = state.tenders.filter((item) => getTenderWork(item).stage === "Cotizando").length;
  const dueSoon = visible.filter((item) => {
    const deadline = getTenderDeadlineInfo(item);
    return deadline.date && !deadline.isPast && deadline.hoursRemaining <= DEADLINE_SOON_HOURS;
  }).length;

  el.metricTotal.textContent = visible.length;
  el.metricFresh.textContent = fresh;
  el.metricActive.textContent = active;
  el.metricQuoting.textContent = quoting;
  el.metricDueSoon.textContent = dueSoon;
  el.resultMeta.textContent = `${visible.length} visibles de ${state.tenders.length} sincronizadas`;
}

function renderTenders(items) {
  el.tendersBody.innerHTML = "";
  el.emptyState.classList.toggle("hidden", items.length > 0);

  const fragment = document.createDocumentFragment();
  for (const tender of items) {
    const work = getTenderWork(tender);
    const favoriteBadge = work.favorite ? `<span class="favorite-inline">Favorito</span>` : "";
    const row = document.createElement("tr");
    row.className = `tender-row${tender.id === state.selectedId ? " selected" : ""}`;
    row.dataset.id = tender.id;
    row.innerHTML = `
      <td class="number-cell">${escapeHtml(tender.numero)}</td>
      <td>${statusPill(tender.estado)}</td>
      <td>
        <div class="desc-cell">
          <strong>${escapeHtml(tender.titulo)}</strong>
          <span class="desc-meta">${escapeHtml([tender.objeto, tender.tipoProceso, tender.modalidad].filter(Boolean).join(" / "))}</span>
          ${favoriteBadge}
        </div>
      </td>
      <td class="entity-cell">${escapeHtml(tender.entidad)}<br>${escapeHtml(tender.unidadCompra || "")}</td>
      <td class="date-cell">${escapeHtml(formatDate(tender.fechaPublicacion))}</td>
      <td>${deadlinePill(tender)}</td>
      <td><span class="stage-pill ${escapeHtml(work.stage)}">${escapeHtml(work.stage)}</span></td>
    `;
    row.addEventListener("click", () => {
      state.selectedId = tender.id;
      render();
    });
    fragment.appendChild(row);
  }
  el.tendersBody.appendChild(fragment);
}

function renderWorkView() {
  const stats = getWorkStats();
  el.workDueSoonCount.textContent = stats.dueSoon.length;
  el.workNeedQuotesCount.textContent = stats.needQuotes.length;
  el.workNoResponseCount.textContent = stats.noResponse.length;
  el.workIncompleteCount.textContent = stats.incomplete.length;
  el.workAlertsMeta.textContent = stats.alerts.length
    ? `${stats.alerts.length} alertas para atender`
    : "Sin alertas pendientes";
  el.workActiveMeta.textContent = `${stats.active.length} procesos en seguimiento`;

  renderWorkCards(el.workAlertsList, stats.alerts, "No hay alertas criticas con los filtros actuales.");
  renderWorkCards(el.workActiveList, stats.active, "Marca licitaciones como favoritas o muevelas de etapa para verlas aqui.");
}

function renderWorkCards(container, cards, emptyText) {
  container.innerHTML = "";
  if (!cards.length) {
    container.innerHTML = `<div class="work-empty">${escapeHtml(emptyText)}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const cardData of cards) {
    const card = document.createElement("article");
    card.className = `work-card ${escapeHtml(cardData.tone || "slate")}`;
    card.innerHTML = `
      <div class="work-card-main">
        <span class="work-card-kicker">${escapeHtml(cardData.kicker)}</span>
        <strong>${escapeHtml(cardData.tender.titulo || "Sin descripcion")}</strong>
        <span>${escapeHtml(cardData.tender.numero || "-")}</span>
      </div>
      <div class="work-card-meta">
        <span>${escapeHtml(cardData.meta)}</span>
        <span>${escapeHtml(cardData.stage || getTenderWork(cardData.tender).stage)}</span>
      </div>
      <div class="work-card-actions">
        <button class="btn secondary work-open-tender" type="button">Ver licitacion</button>
        <button class="btn primary work-open-quote" type="button">Cotizar</button>
      </div>
    `;
    card.querySelector(".work-open-tender").addEventListener("click", () => selectTenderFromWork(cardData.tender.id, "tenders"));
    card.querySelector(".work-open-quote").addEventListener("click", () => selectTenderFromWork(cardData.tender.id, "quotes"));
    fragment.appendChild(card);
  }
  container.appendChild(fragment);
}

function getWorkStats() {
  const flowTenders = getFlowTenders();
  const active = flowTenders.filter((tender) => {
    const stage = getTenderWork(tender).stage;
    return stage !== "Listo" && stage !== "Descartado";
  });

  const dueSoon = state.tenders
    .filter((tender) => {
      const deadline = getTenderDeadlineInfo(tender);
      return deadline.date && !deadline.isPast && deadline.hoursRemaining <= DEADLINE_SOON_HOURS;
    })
    .sort(sortByDeadline);

  const overdue = state.tenders
    .filter((tender) => getTenderDeadlineInfo(tender).isPast)
    .sort(sortByDeadline);

  const needQuotes = active.filter((tender) => getTenderWork(tender).suppliers.length === 0);
  const noResponse = active.filter((tender) => {
    const suppliers = getTenderWork(tender).suppliers;
    return suppliers.length > 0 && !suppliers.some((supplier) => hasSupplierResponse(supplier));
  });
  const incomplete = active.filter((tender) => isQuoteIncomplete(tender, getTenderWork(tender)));

  const alerts = [
    ...overdue.slice(0, 6).map((tender) => workCardFromTender(tender, "Vencida", "danger", getTenderDeadlineInfo(tender).label)),
    ...dueSoon.slice(0, 8).map((tender) => workCardFromTender(tender, "Vence pronto", "warn", getTenderDeadlineInfo(tender).label)),
    ...needQuotes.slice(0, 8).map((tender) => workCardFromTender(tender, "Sin proveedores", "amber", "Agrega proveedores para pedir precios")),
    ...noResponse.slice(0, 8).map((tender) => workCardFromTender(tender, "Proveedor sin respuesta", "amber", "Hay solicitudes sin respuesta")),
    ...incomplete.slice(0, 8).map((tender) => workCardFromTender(tender, "Cotizacion incompleta", "slate", "Falta margen, proveedor o precio"))
  ];

  return {
    active: active.map((tender) => workCardFromTender(tender, "En seguimiento", "slate", getTenderDeadlineInfo(tender).label)),
    dueSoon,
    needQuotes,
    noResponse,
    incomplete,
    alerts: uniqueBy(alerts, (item) => `${item.kicker}|${item.tender.id}`)
  };
}

function workCardFromTender(tender, kicker, tone, meta) {
  return {
    tender,
    kicker,
    tone,
    meta: meta || getTenderDeadlineInfo(tender).label,
    stage: getTenderWork(tender).stage
  };
}

function selectTenderFromWork(tenderId, targetView) {
  state.selectedId = tenderId;
  render();
  switchView(targetView);
}

function isQuoteIncomplete(tender, work) {
  if (!["Revisar", "Cotizando"].includes(work.stage)) return false;
  const referenceAmount = parseCurrency(getSummaryData(tender).price);
  const bestSupplier = getBestSupplier(work.suppliers);
  return !referenceAmount || !bestSupplier || !Number(work.targetMargin);
}

function hasSupplierResponse(supplier) {
  return ["Respondio", "Negociando", "Ganador interno"].includes(supplier.status);
}

function deadlinePill(tender) {
  const info = getTenderDeadlineInfo(tender);
  return `<span class="deadline-pill ${escapeHtml(info.tone)}">${escapeHtml(info.label)}</span>`;
}

function getTenderDeadlineInfo(tender) {
  const date = getTenderDeadlineDate(tender);
  if (!date) {
    const detailState = state.details[tender.id];
    const label = detailState?.loading ? "Analizando" : "Sin fecha";
    return { date: null, label, tone: detailState?.loading ? "pending" : "missing", hoursRemaining: Infinity, isPast: false };
  }

  const now = new Date();
  const hoursRemaining = (date.getTime() - now.getTime()) / (60 * 60 * 1000);
  const isPast = hoursRemaining < 0;
  const sameDay = date.toLocaleDateString("en-CA", { timeZone: "America/Panama" }) ===
    now.toLocaleDateString("en-CA", { timeZone: "America/Panama" });

  if (isPast) {
    return {
      date,
      hoursRemaining,
      isPast: true,
      label: `Vencida ${formatShortDate(date)}`,
      tone: "overdue"
    };
  }

  if (sameDay) {
    return {
      date,
      hoursRemaining,
      isPast: false,
      label: `Hoy ${formatShortTime(date)}`,
      tone: "today"
    };
  }

  if (hoursRemaining <= DEADLINE_SOON_HOURS) {
    return {
      date,
      hoursRemaining,
      isPast: false,
      label: `En ${Math.ceil(hoursRemaining)} h`,
      tone: "soon"
    };
  }

  if (hoursRemaining <= 7 * 24) {
    return {
      date,
      hoursRemaining,
      isPast: false,
      label: `En ${Math.ceil(hoursRemaining / 24)} dias`,
      tone: "week"
    };
  }

  return {
    date,
    hoursRemaining,
    isPast: false,
    label: formatShortDate(date),
    tone: "ok"
  };
}

function getTenderDeadlineDate(tender) {
  const detail = state.details[tender.id]?.summary || {};
  return parseTenderDeadline(
    detail.submission ||
    tender.fechaPresentacionPropuesta ||
    tender.fechaPresentacion ||
    tender.fechaLimiteRecepcion ||
    tender.fechaCierre ||
    ""
  );
}

function parseTenderDeadline(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;

  const raw = String(value).trim();
  const iso = new Date(raw);
  if (!Number.isNaN(iso.getTime())) return iso;

  const normalized = raw
    .replace(/\s+/g, " ")
    .replace(/p\.\s*m\./gi, "PM")
    .replace(/a\.\s*m\./gi, "AM")
    .replace(/\ba\.m\.\b/gi, "AM")
    .replace(/\bp\.m\.\b/gi, "PM");
  const match = normalized.match(/(\d{1,2})[-/](\d{1,2})[-/](\d{4})(?:\D+(\d{1,2}):(\d{2})\s*(AM|PM)?)?/i);
  if (!match) return null;

  const [, day, month, year, hourRaw = "23", minuteRaw = "59", meridiem = ""] = match;
  let hour = Number(hourRaw);
  const minute = Number(minuteRaw);
  const marker = meridiem.toUpperCase();
  if (marker === "PM" && hour < 12) hour += 12;
  if (marker === "AM" && hour === 12) hour = 0;
  const date = new Date(Number(year), Number(month) - 1, Number(day), hour, minute, 0);
  return Number.isNaN(date.getTime()) ? null : date;
}

function matchesDeadlineFilter(tender, filter) {
  if (!filter) return true;
  const info = getTenderDeadlineInfo(tender);
  if (filter === "missing") return !info.date;
  if (!info.date) return false;
  if (filter === "overdue") return info.isPast;
  if (filter === "today") return info.tone === "today";
  if (filter === "48h") return !info.isPast && info.hoursRemaining <= DEADLINE_SOON_HOURS;
  if (filter === "7d") return !info.isPast && info.hoursRemaining <= 7 * 24;
  return true;
}

function sortByDeadline(a, b) {
  const dateA = getTenderDeadlineDate(a)?.getTime() || Number.MAX_SAFE_INTEGER;
  const dateB = getTenderDeadlineDate(b)?.getTime() || Number.MAX_SAFE_INTEGER;
  return dateA - dateB;
}

function scheduleDeadlineScan(tenders) {
  const token = ++deadlineScanToken;
  clearTimeout(deadlineScanTimer);
  const candidates = tenders
    .filter((tender) => tender.tipoId && tender.flujoId && !state.details[tender.id]?.loaded && !state.details[tender.id]?.loading)
    .slice(0, DEADLINE_SCAN_LIMIT);

  if (!candidates.length) return;
  deadlineScanTimer = window.setTimeout(() => scanDeadlineDetails(candidates, token), 700);
}

async function scanDeadlineDetails(candidates, token) {
  const batchSize = 3;
  for (let index = 0; index < candidates.length; index += batchSize) {
    if (token !== deadlineScanToken) return;
    await Promise.all(candidates.slice(index, index + batchSize).map(loadTenderDetailQuiet));
    if (token !== deadlineScanToken) return;
    render();
  }
}

async function loadTenderDetailQuiet(tender) {
  if (!tender?.tipoId || !tender?.flujoId || state.details[tender.id]?.loading || state.details[tender.id]?.loaded) {
    return;
  }

  state.details[tender.id] = { loading: true, loaded: false, summary: null };
  try {
    state.details[tender.id] = {
      loading: false,
      loaded: true,
      summary: await fetchTenderDetailSummary(tender)
    };
  } catch (error) {
    state.details[tender.id] = {
      loading: false,
      loaded: true,
      summary: null,
      error: error.message || "No se pudo consultar detalle"
    };
  }
}

async function fetchTenderDetailSummary(tender) {
  const params = new URLSearchParams({
    tipo: tender.tipoId,
    flujo: tender.flujoId,
    numero: tender.numero
  });
  const data = await fetchJson(`/api/licitacion-detalle?${params.toString()}`);
  return data.summary || null;
}

function formatShortDate(date) {
  return new Intl.DateTimeFormat("es-PA", {
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Panama"
  }).format(date);
}

function formatShortTime(date) {
  return new Intl.DateTimeFormat("es-PA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Panama"
  }).format(date);
}

function renderFlowBoard() {
  const tenders = getFlowTenders();
  const grouped = Object.fromEntries(STAGES.map((stage) => [stage, []]));

  for (const tender of tenders) {
    const work = getTenderWork(tender);
    const stage = STAGES.includes(work.stage) ? work.stage : "Nuevo";
    grouped[stage].push({ tender, work });
  }

  const workingCount = tenders.filter((tender) => {
    const stage = getTenderWork(tender).stage;
    return stage !== "Listo" && stage !== "Descartado";
  }).length;
  const highPriorityCount = tenders.filter((tender) => getTenderWork(tender).priority === "Alta").length;
  const readyCount = grouped.Listo.length;

  el.flowWorkingCount.textContent = workingCount;
  el.flowPriorityCount.textContent = highPriorityCount;
  el.flowReadyCount.textContent = readyCount;
  el.flowMeta.textContent = tenders.length
    ? `${tenders.length} procesos en el flujo interno`
    : "Marca licitaciones como favoritas para verlas aqui";
  el.flowBoard.innerHTML = "";

  const fragment = document.createDocumentFragment();
  for (const stage of STAGES) {
    const column = document.createElement("section");
    column.className = `flow-column flow-${STAGE_META[stage]?.color || "slate"}`;
    column.innerHTML = `
      <header class="flow-column-head">
        <div>
          <span class="flow-dot"></span>
          <h3>${escapeHtml(stage)}</h3>
        </div>
        <strong>${grouped[stage].length}</strong>
      </header>
      <div class="flow-column-body"></div>
    `;

    const body = column.querySelector(".flow-column-body");
    if (!grouped[stage].length) {
      body.innerHTML = `<div class="flow-empty">-</div>`;
    } else {
      for (const entry of grouped[stage]) {
        body.appendChild(createFlowCard(entry.tender, entry.work));
      }
    }
    fragment.appendChild(column);
  }

  el.flowBoard.appendChild(fragment);
}

function createFlowCard(tender, work) {
  const stageIndex = STAGES.indexOf(work.stage);
  const canMoveBack = stageIndex > 0;
  const canMoveNext = stageIndex >= 0 && stageIndex < STAGES.length - 1;
  const summary = getSummaryData(tender);
  const price = parseCurrency(summary.price) ? formatMoney(parseCurrency(summary.price)) : summary.price || "Pendiente";
  const supplierCount = Array.isArray(work.suppliers) ? work.suppliers.length : 0;
  const card = document.createElement("article");
  card.className = `flow-card${tender.id === state.selectedId ? " selected" : ""}`;
  card.innerHTML = `
    <button class="flow-card-main" type="button">
      <strong>${escapeHtml(tender.titulo || "Sin descripcion")}</strong>
      <span>${escapeHtml(tender.numero || "-")}</span>
      <small>${escapeHtml(tender.entidad || "Sin entidad")}</small>
    </button>
    <div class="flow-card-meta">
      <span>${escapeHtml(price)}</span>
      <span class="priority-pill">${escapeHtml(work.priority || "Media")}</span>
    </div>
    <div class="flow-card-foot">
      <span>${supplierCount ? `${supplierCount} proveedores` : "Sin proveedores"}</span>
      <span>${escapeHtml(formatDate(tender.fechaPublicacion))}</span>
    </div>
    <div class="flow-card-actions">
      <button class="btn secondary flow-move-back" type="button" ${canMoveBack ? "" : "disabled"} aria-label="Mover etapa anterior">←</button>
      <button class="btn secondary flow-open-quote" type="button">Cotizar</button>
      <button class="btn secondary flow-move-next" type="button" ${canMoveNext ? "" : "disabled"} aria-label="Mover etapa siguiente">→</button>
    </div>
  `;

  card.querySelector(".flow-move-back").innerHTML = "&larr;";
  card.querySelector(".flow-move-next").innerHTML = "&rarr;";
  card.querySelector(".flow-card-main").addEventListener("click", () => selectTenderFromFlow(tender.id, "tenders"));
  card.querySelector(".flow-open-quote").addEventListener("click", () => selectTenderFromFlow(tender.id, "quotes"));
  card.querySelector(".flow-move-back").addEventListener("click", () => moveTenderStage(tender.id, -1));
  card.querySelector(".flow-move-next").addEventListener("click", () => moveTenderStage(tender.id, 1));
  return card;
}

function getFlowTenders() {
  const currentByKey = new Map();
  for (const tender of state.tenders) {
    currentByKey.set(String(tender.id || tender.numero), tender);
    if (tender.numero) currentByKey.set(String(tender.numero), tender);
  }

  return Object.entries(state.workspace)
    .filter(([, work]) => isWorkInFlow(work))
    .map(([key, work]) => {
      const savedTender = work.flowTender || work.favoriteTender || null;
      const currentTender = currentByKey.get(String(key)) ||
        currentByKey.get(String(savedTender?.id || "")) ||
        currentByKey.get(String(savedTender?.numero || ""));
      return currentTender || savedTender;
    })
    .filter(Boolean)
    .sort((a, b) => {
      const workA = getTenderWork(a);
      const workB = getTenderWork(b);
      const priorityA = priorityRank(workA.priority);
      const priorityB = priorityRank(workB.priority);
      if (priorityA !== priorityB) return priorityA - priorityB;
      return new Date(b.fechaPublicacion || 0) - new Date(a.fechaPublicacion || 0);
    });
}

function isWorkInFlow(work) {
  return Boolean(
    work?.favorite ||
    work?.inFlow ||
    (work?.stage && work.stage !== "Nuevo")
  );
}

function selectTenderFromFlow(tenderId, targetView) {
  state.selectedId = tenderId;
  render();
  switchView(targetView);
}

function moveTenderStage(tenderId, direction) {
  const tender = getFlowTenders().find((item) => item.id === tenderId);
  if (!tender) return;

  const work = getTenderWork(tender);
  const currentIndex = Math.max(0, STAGES.indexOf(work.stage));
  const nextIndex = Math.min(STAGES.length - 1, Math.max(0, currentIndex + direction));
  work.stage = STAGES[nextIndex];
  activateFlowItem(tender, work);
  state.selectedId = tender.id;
  saveAndRender();
  showToast(`Movido a ${work.stage}`);
}

function activateFlowItem(tender, work = getTenderWork(tender)) {
  work.inFlow = true;
  work.flowTender = createFavoriteSnapshot(tender);
}

function priorityRank(priority) {
  if (priority === "Alta") return 0;
  if (priority === "Media") return 1;
  return 2;
}

function renderBackOffice() {
  const tender = getSelectedTender();
  renderQuoteTenderSelect(tender);
  el.detailEmpty.classList.toggle("hidden", Boolean(tender));
  el.detailContent.classList.toggle("hidden", !tender);
  el.supplierForm.classList.toggle("hidden", !tender);
  if (!tender) {
    renderQuoteMetrics(null, null);
    el.quoteSupplierMeta.textContent = "Selecciona una licitacion";
    el.suppliersList.innerHTML = `<div class="empty-state">Escoge una licitacion para administrar sus cotizaciones.</div>`;
    return;
  }

  const work = getTenderWork(tender);
  el.detailNumber.textContent = tender.numero;
  el.detailTitle.textContent = tender.titulo;
  el.detailBadge.textContent = tender.estado || "Sin estado";
  el.detailBadge.className = `status-pill ${statusClass(tender.estado)}`;
  el.detailEntity.textContent = [tender.entidad, tender.unidadCompra].filter(Boolean).join(" / ");
  el.detailType.textContent = [tender.prefijo, tender.tipoProceso, tender.modalidad].filter(Boolean).join(" / ");
  el.detailObject.textContent = tender.objeto || "No indicado";
  el.detailDate.textContent = formatDate(tender.fechaPublicacion);
  el.portalLink.href = tender.portalUrl || "https://www.panamacompra.gob.pa/Inicio/#/";
  el.stageSelect.value = work.stage;
  el.prioritySelect.value = work.priority;
  el.quoteDueDate.value = work.dueDate || "";
  el.quoteTargetMargin.value = work.targetMargin || "";
  el.quoteTaxRate.value = work.taxRate || String(DEFAULT_TAX_RATE);
  el.notesInput.value = work.notes || "";
  renderQuoteMetrics(tender, work);
  renderSuppliers(work.suppliers);
}

function renderQuoteTenderSelect(selectedTender) {
  const currentValue = selectedTender?.id || "";
  el.quoteTenderSelect.innerHTML = "";

  if (!state.tenders.length) {
    const option = document.createElement("option");
    option.value = "";
    option.textContent = "Sin licitaciones sincronizadas";
    el.quoteTenderSelect.appendChild(option);
    return;
  }

  for (const tender of state.tenders) {
    const option = document.createElement("option");
    option.value = tender.id;
    option.textContent = `${tender.numero} - ${tender.titulo}`;
    el.quoteTenderSelect.appendChild(option);
  }

  el.quoteTenderSelect.value = currentValue;
}

function renderQuoteMetrics(tender, work) {
  if (!tender || !work) {
    el.quoteReferencePrice.textContent = "-";
    el.quoteBestSupplier.textContent = "-";
    el.quoteBestAmount.textContent = "-";
    el.quoteEstimatedMargin.textContent = "-";
    el.quoteTaxAmount.textContent = "-";
    el.quoteSuggestedPrice.textContent = "-";
    return;
  }

  const summary = getSummaryData(tender);
  const referenceAmount = parseCurrency(summary.price || summary.itemsTotal);
  const bestSupplier = getBestSupplier(work.suppliers);

  el.quoteReferencePrice.textContent = referenceAmount ? formatMoney(referenceAmount) : summary.price || "Pendiente";
  el.quoteBestSupplier.textContent = bestSupplier?.name || "Pendiente";
  el.quoteBestAmount.textContent = bestSupplier ? formatMoney(bestSupplier.amount) : "Pendiente";

  if (!referenceAmount || !bestSupplier) {
    el.quoteEstimatedMargin.textContent = "Pendiente";
    el.quoteTaxAmount.textContent = "Pendiente";
    el.quoteSuggestedPrice.textContent = "Pendiente";
    return;
  }

  const supplierAmount = Number(bestSupplier.amount);
  const marginAmount = referenceAmount - supplierAmount;
  const marginPercent = referenceAmount ? (marginAmount / referenceAmount) * 100 : 0;
  const targetMargin = Number(work.targetMargin);
  const taxRate = getTaxRate(work);
  const suggestedBase = Number.isFinite(targetMargin) && targetMargin > 0 && targetMargin < 100
    ? supplierAmount / (1 - (targetMargin / 100))
    : referenceAmount;
  const taxAmount = suggestedBase * (taxRate / 100);
  const suggestedTotal = suggestedBase + taxAmount;
  const targetText = Number.isFinite(targetMargin) && targetMargin > 0
    ? ` / meta ${formatPercent(targetMargin)}`
    : "";
  el.quoteEstimatedMargin.textContent = `${formatMoney(marginAmount)} (${formatPercent(marginPercent)}${targetText})`;
  el.quoteTaxAmount.textContent = formatMoney(taxAmount);
  el.quoteSuggestedPrice.textContent = formatMoney(suggestedTotal);
}

function renderSelectedSummary() {
  const tender = getSelectedTender();
  el.summaryFavoriteBtn.disabled = !tender;
  el.summaryItemsBtn.disabled = !tender;
  el.summaryOpenBtn.disabled = !tender;
  el.summaryCopyBtn.disabled = !tender;

  if (!tender) {
    closeRequestModal();
    el.summaryFavoriteBtn.textContent = "Agregar favorito";
    el.summaryFavoriteBtn.classList.remove("favorite-active");
    el.summaryEyebrow.textContent = "Resumen de licitacion seleccionada";
    el.summaryTitle.textContent = "Selecciona una licitacion del listado";
    el.summaryDescription.textContent = "Aqui veras el resumen de la oportunidad que escogiste para cotizar.";
    setSummaryFields({
      number: "-",
      object: "-",
      type: "-",
      price: "-",
      payment: "-",
      penalty: "-",
      published: "-",
      submission: "-",
      opening: "-",
      entity: "-",
      contact: "-",
      role: "-",
      phone: "-",
      email: "-",
      itemsTotal: "-",
      items: [],
      itemsMessage: "Selecciona una licitacion para ver los items de compra."
    });
    return;
  }

  const work = getTenderWork(tender);
  el.summaryFavoriteBtn.textContent = work.favorite ? "Quitar favorito" : "Agregar favorito";
  el.summaryFavoriteBtn.classList.toggle("favorite-active", Boolean(work.favorite));
  loadTenderDetail(tender);
  const summary = getSummaryData(tender);
  el.summaryEyebrow.textContent = "Resumen de licitacion seleccionada";
  el.summaryTitle.textContent = summary.title;
  el.summaryDescription.textContent = summary.description;
  setSummaryFields(summary);
}

function setSummaryFields(summary) {
  el.summaryNumber.textContent = summary.number;
  el.summaryObject.textContent = summary.object;
  el.summaryType.textContent = summary.type;
  el.summaryPrice.textContent = summary.price;
  el.summaryPayment.textContent = summary.payment;
  el.summaryPenalty.textContent = summary.penalty;
  el.summaryPublished.textContent = summary.published;
  el.summarySubmission.textContent = summary.submission;
  el.summaryOpening.textContent = summary.opening;
  el.summaryEntity.textContent = summary.entity;
  el.summaryContact.textContent = summary.contact;
  el.summaryRole.textContent = summary.role;
  el.summaryPhone.textContent = summary.phone;
  el.summaryEmail.textContent = summary.email;
  renderRequestItems(summary);
}

function renderRequestItems(summary) {
  const items = Array.isArray(summary.items) ? summary.items : [];
  el.summaryItemsTotal.textContent = summary.itemsTotal || "-";
  el.summaryItemsBadge.textContent = getItemsBadgeText(summary, items);
  el.summaryItemsList.innerHTML = "";

  if (!items.length) {
    el.summaryItemsList.innerHTML = `<div class="request-empty">${escapeHtml(summary.itemsMessage || "No hay items disponibles en el detalle en linea.")}</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const item of items) {
    const card = document.createElement("article");
    card.className = "request-item-card";
    card.innerHTML = `
      <div class="request-item-main">
        <span class="request-item-number">${escapeHtml(item.renglon || "-")}</span>
        <strong>${escapeHtml(item.descripcion || "Sin descripcion")}</strong>
        <span class="request-item-price">${escapeHtml(item.precioReferencia || "-")}</span>
      </div>
      <div class="request-item-meta-grid">
        <div>
          <span>Codigo</span>
          <strong>${escapeHtml(item.codigo || "-")}</strong>
        </div>
        <div>
          <span>Clasificacion</span>
          <strong>${escapeHtml(item.clasificacion || "-")}</strong>
        </div>
        <div>
          <span>Cantidad</span>
          <strong>${escapeHtml(formatItemQuantity(item.cantidad))}</strong>
        </div>
        <div>
          <span>Unidad de medida</span>
          <strong>${escapeHtml(item.unidad || "-")}</strong>
        </div>
      </div>
    `;
    fragment.appendChild(card);
  }

  el.summaryItemsList.appendChild(fragment);
}

function getItemsBadgeText(summary, items) {
  if (items.length === 1) return "1 item";
  if (items.length > 1) return `${items.length} items`;
  return summary.itemsMessage === "Cargando items de compra..." ? "Cargando" : "Sin items";
}

function openRequestModal() {
  if (!getSelectedTender()) {
    showToast("Selecciona una licitacion");
    return;
  }
  el.requestModal.classList.remove("hidden");
  document.body.classList.add("modal-open");
  el.requestModalClose.focus();
}

function closeRequestModal() {
  el.requestModal.classList.add("hidden");
  document.body.classList.remove("modal-open");
}

function renderFavorites() {
  const favorites = getFavoriteEntries();
  el.favoritesList.innerHTML = "";
  el.clearFavoritesBtn.disabled = favorites.length === 0;

  if (!favorites.length) {
    el.favoritesList.innerHTML = `<div class="favorite-empty">Marca una licitacion como favorita para verla aqui y buscarla rapido.</div>`;
    return;
  }

  const selected = getSelectedTender();
  const fragment = document.createDocumentFragment();
  for (const entry of favorites) {
    const favorite = entry.tender;
    const card = document.createElement("article");
    const isActive = selected && (selected.id === favorite.id || selected.numero === favorite.numero);
    card.className = `favorite-card${isActive ? " active" : ""}`;
    card.innerHTML = `
      <button class="favorite-card-main" type="button">
        <strong>${escapeHtml(favorite.numero || "Sin numero")}</strong>
        <span>${escapeHtml(favorite.titulo || "Sin descripcion")}</span>
        <small class="favorite-meta">${escapeHtml([favorite.entidad, favorite.objeto].filter(Boolean).join(" / "))}</small>
      </button>
      <button class="btn favorite-remove" type="button" aria-label="Quitar favorito">X</button>
    `;
    card.querySelector(".favorite-card-main").addEventListener("click", () => quickSearchFavorite(entry));
    card.querySelector(".favorite-remove").addEventListener("click", () => removeFavorite(entry.key));
    fragment.appendChild(card);
  }
  el.favoritesList.appendChild(fragment);
}

function getFavoriteEntries() {
  return Object.entries(state.workspace)
    .filter(([, work]) => work?.favorite && work.favoriteTender)
    .map(([key, work]) => ({ key, work, tender: work.favoriteTender }))
    .sort((a, b) => new Date(b.work.favoriteAt || 0) - new Date(a.work.favoriteAt || 0));
}

function toggleSelectedFavorite() {
  const tender = getSelectedTender();
  if (!tender) {
    showToast("Selecciona una licitacion");
    return;
  }

  const work = getTenderWork(tender);
  if (work.favorite) {
    const keptInFlow = clearFavoriteData(work);
    showToast(keptInFlow ? "Favorito eliminado; se mantiene en flujo" : "Favorito eliminado");
  } else {
    work.favorite = true;
    work.favoriteAt = new Date().toISOString();
    work.favoriteTender = createFavoriteSnapshot(tender);
    activateFlowItem(tender, work);
    showToast("Favorito agregado");
  }
  saveAndRender();
}

async function quickSearchFavorite(entry) {
  const favorite = entry.tender;
  state.filters = {
    q: favorite.numero || "",
    estado: "",
    tipo: "",
    objeto: "",
    provincia: "",
    dateFrom: "",
    dateTo: "",
    limit: state.filters.limit || "50",
    stage: "",
    deadline: ""
  };
  syncFilterControls();
  await loadTenders();

  const found = state.tenders.find((item) => item.id === favorite.id || item.numero === favorite.numero);
  if (found) {
    state.selectedId = found.id;
    render();
    showToast("Favorito seleccionado");
  } else {
    showToast("No se encontro ese favorito en la busqueda actual");
  }
}

function removeFavorite(key) {
  const work = state.workspace[key];
  if (!work) return;
  const keptInFlow = clearFavoriteData(work);
  saveAndRender();
  showToast(keptInFlow ? "Favorito eliminado; se mantiene en flujo" : "Favorito eliminado");
}

function clearFavorites() {
  const favorites = getFavoriteEntries();
  if (!favorites.length) return;

  let keptInFlow = 0;
  for (const entry of favorites) {
    if (clearFavoriteData(entry.work)) keptInFlow += 1;
  }
  saveAndRender();
  showToast(keptInFlow ? "Favoritos limpiados; procesos en etapa se mantienen" : "Favoritos limpiados");
}

function clearFavoriteData(work) {
  const shouldKeepInFlow = work.stage && work.stage !== "Nuevo";
  if (shouldKeepInFlow && !work.flowTender && work.favoriteTender) {
    work.flowTender = work.favoriteTender;
  }
  work.favorite = false;
  delete work.favoriteAt;
  delete work.favoriteTender;
  if (shouldKeepInFlow) {
    work.inFlow = true;
  } else {
    work.inFlow = false;
    delete work.flowTender;
  }
  return Boolean(shouldKeepInFlow);
}

function createFavoriteSnapshot(tender) {
  return {
    id: tender.id,
    procesoId: tender.procesoId,
    flujoId: tender.flujoId,
    numero: tender.numero,
    titulo: tender.titulo,
    entidad: tender.entidad,
    unidadCompra: tender.unidadCompra,
    estado: tender.estado,
    estadoId: tender.estadoId,
    objeto: tender.objeto,
    tipoProceso: tender.tipoProceso,
    tipoId: tender.tipoId,
    prefijo: tender.prefijo,
    modalidad: tender.modalidad,
    fechaPublicacion: tender.fechaPublicacion,
    fechaEstado: tender.fechaEstado,
    fechaPresentacionPropuesta: tender.fechaPresentacionPropuesta,
    portalUrl: tender.portalUrl,
    portalDetalleUrl: tender.portalDetalleUrl
  };
}

function syncFilterControls() {
  el.searchInput.value = state.filters.q;
  el.stateFilter.value = state.filters.estado;
  el.typeFilter.value = state.filters.tipo;
  el.objectFilter.value = state.filters.objeto;
  el.provinceFilter.value = state.filters.provincia;
  el.dateFromFilter.value = state.filters.dateFrom;
  el.dateToFilter.value = state.filters.dateTo;
  el.deadlineFilter.value = state.filters.deadline;
  el.limitFilter.value = state.filters.limit;
  document.querySelectorAll(".stage-tab").forEach((button) => {
    button.classList.toggle("active", button.dataset.stageFilter === state.filters.stage);
  });
}

function syncFiltersFromControls() {
  state.filters.q = el.searchInput.value.trim();
  state.filters.estado = el.stateFilter.value;
  state.filters.tipo = el.typeFilter.value;
  state.filters.objeto = el.objectFilter.value;
  state.filters.provincia = el.provinceFilter.value;
  state.filters.dateFrom = el.dateFromFilter.value;
  state.filters.dateTo = el.dateToFilter.value;
  state.filters.deadline = el.deadlineFilter.value;
  state.filters.limit = el.limitFilter.value;
}

function getSummaryData(tender) {
  const detailState = state.details[tender.id];
  const detail = detailState?.summary || {};
  const extra = ENRICHED_TENDER_SUMMARIES[tender.numero] || {};
  const pending = detailState?.loading ? DETAIL_PENDING : DETAIL_UNAVAILABLE;
  const detailValue = (key, fallback = "") => detail[key] || extra[key] || fallback || pending;
  const items = Array.isArray(detail.items) && detail.items.length
    ? detail.items
    : Array.isArray(extra.items) ? extra.items : [];
  const itemsMessage = detailState?.loading
    ? "Cargando items de compra..."
    : "No hay items disponibles en el detalle en linea.";

  return {
    number: detail.number || tender.numero || "-",
    title: detail.title || tender.titulo || "Sin descripcion",
    description: detail.description || tender.titulo || "Sin descripcion",
    object: detail.object || tender.objeto || "No indicado",
    type: detail.type || tender.tipoProceso || "No indicado",
    price: detailValue("price"),
    payment: detailValue("payment"),
    penalty: detailValue("penalty"),
    published: detail.published || formatDate(tender.fechaPublicacion),
    submission: detailValue("submission"),
    opening: detailValue("opening"),
    entity: detail.entity || tender.entidad || "No indicada",
    contact: detailValue("contact"),
    role: detailValue("role"),
    phone: detailValue("phone"),
    email: detailValue("email"),
    itemsTotal: detail.itemsTotal || extra.itemsTotal || (items.length ? "-" : ""),
    items,
    itemsMessage
  };
}

async function loadTenderDetail(tender) {
  if (!tender?.tipoId || !tender?.flujoId || state.details[tender.id]?.loading || state.details[tender.id]?.loaded) {
    return;
  }

  state.details[tender.id] = { loading: true, loaded: false, summary: null };
  const stopThinking = startThinking("Cargando detalle de licitacion...");

  try {
    state.details[tender.id] = {
      loading: false,
      loaded: true,
      summary: await fetchTenderDetailSummary(tender)
    };
  } catch (error) {
    state.details[tender.id] = {
      loading: false,
      loaded: true,
      summary: null,
      error: error.message || "No se pudo consultar detalle"
    };
    showToast("No se pudo cargar el detalle en linea");
  } finally {
    stopThinking();
  }

  if (state.selectedId === tender.id) {
    renderSelectedSummary();
    renderBackOffice();
  }
}

function renderSuppliers(suppliers) {
  el.suppliersList.innerHTML = "";
  const tender = getSelectedTender();
  const work = tender ? getTenderWork(tender) : null;
  const referenceAmount = tender ? parseCurrency(getSummaryData(tender).price) : 0;
  const bestSupplier = work ? getBestSupplier(work.suppliers) : null;
  const responded = suppliers.filter((supplier) => supplier.status === "Respondio" || supplier.status === "Ganador interno").length;
  el.quoteSupplierMeta.textContent = suppliers.length
    ? `${suppliers.length} proveedores, ${responded} con respuesta`
    : "Sin proveedores agregados";

  if (!suppliers.length) {
    el.suppliersList.innerHTML = `<div class="empty-state">Agrega proveedores para comparar precios y seguimiento.</div>`;
    return;
  }

  const fragment = document.createDocumentFragment();
  for (const supplier of suppliers) {
    const supplierAmount = Number(supplier.amount);
    const hasAmount = Number.isFinite(supplierAmount) && supplierAmount > 0;
    const targetMargin = Number(work?.targetMargin);
    const taxRate = getTaxRate(work);
    const suggestedBase = hasAmount && Number.isFinite(targetMargin) && targetMargin > 0 && targetMargin < 100
      ? supplierAmount / (1 - (targetMargin / 100))
      : referenceAmount || supplierAmount;
    const taxAmount = hasAmount ? suggestedBase * (taxRate / 100) : 0;
    const suggestedPrice = hasAmount ? suggestedBase + taxAmount : 0;
    const marginText = referenceAmount && hasAmount
      ? `${formatMoney(referenceAmount - supplierAmount)} / ${formatPercent(((referenceAmount - supplierAmount) / referenceAmount) * 100)}`
      : "Pendiente";
    const isBest = bestSupplier?.id === supplier.id;
    const card = document.createElement("article");
    card.className = `supplier-card${isBest ? " supplier-card-best" : ""}`;
    card.innerHTML = `
      <header>
        <div>
          <strong>${escapeHtml(supplier.name)}</strong>
          <span class="supplier-meta">${escapeHtml([supplier.contact, supplier.status].filter(Boolean).join(" / "))}</span>
        </div>
        <button class="btn remove" type="button" aria-label="Eliminar proveedor">X</button>
      </header>
      <div class="supplier-grid">
        <div>
          <span>Monto</span>
          <strong>${escapeHtml(formatMoney(supplier.amount))}</strong>
        </div>
        <div>
          <span>Margen estimado</span>
          <strong>${escapeHtml(marginText)}</strong>
        </div>
        <div>
          <span>ITBMS sugerido</span>
          <strong>${escapeHtml(hasAmount ? formatMoney(taxAmount) : "Pendiente")}</strong>
        </div>
        <div>
          <span>Precio sugerido</span>
          <strong>${escapeHtml(hasAmount ? formatMoney(suggestedPrice) : "Pendiente")}</strong>
        </div>
        <div>
          <span>Entrega</span>
          <strong>${escapeHtml(supplier.leadTime || "Pendiente")}</strong>
        </div>
        <div>
          <span>Nota</span>
          <strong>${escapeHtml(supplier.note || "Sin nota")}</strong>
        </div>
      </div>
    `;
    card.querySelector(".remove").addEventListener("click", () => removeSupplier(supplier.id));
    fragment.appendChild(card);
  }
  el.suppliersList.appendChild(fragment);
}

function getVisibleTenders() {
  const q = state.filters.q.toLowerCase();
  return state.tenders.filter((item) => {
    const work = getTenderWork(item);
    const haystack = [
      item.numero,
      item.titulo,
      item.entidad,
      item.unidadCompra,
      item.dependencia,
      item.objeto,
      item.estado,
      item.tipoProceso
    ].join(" ").toLowerCase();

    if (q && !haystack.includes(q)) return false;
    if (state.filters.objeto && item.objeto !== state.filters.objeto) return false;
    if (state.filters.stage && work.stage !== state.filters.stage) return false;
    if (state.filters.deadline && !matchesDeadlineFilter(item, state.filters.deadline)) return false;
    return true;
  });
}

function getSelectedTender() {
  const currentTender = state.tenders.find((item) => item.id === state.selectedId);
  if (currentTender) return currentTender;

  const favoriteEntry = getFavoriteEntries().find((entry) => entry.tender.id === state.selectedId);
  if (favoriteEntry?.tender) return favoriteEntry.tender;

  return getFlowTenders().find((tender) => tender.id === state.selectedId) || null;
}

function getTenderWork(tender) {
  const key = tender.id || tender.numero;
  if (!state.workspace[key]) {
    state.workspace[key] = {
      stage: "Nuevo",
      priority: "Media",
      dueDate: "",
      targetMargin: "",
      notes: "",
      suppliers: [],
      favorite: false
    };
  }

  const work = state.workspace[key];
  work.stage = work.stage || "Nuevo";
  work.priority = work.priority || "Media";
  work.dueDate = work.dueDate || "";
  work.targetMargin = work.targetMargin || "";
  work.taxRate = work.taxRate === undefined || work.taxRate === "" ? String(DEFAULT_TAX_RATE) : work.taxRate;
  work.notes = work.notes || "";
  work.suppliers = Array.isArray(work.suppliers)
    ? work.suppliers.map(normalizeSupplier)
    : [];
  work.favorite = Boolean(work.favorite);
  if (work.favorite && !work.favoriteTender) {
    work.favoriteTender = createFavoriteSnapshot(tender);
  }
  work.inFlow = Boolean(work.inFlow);
  if (work.favorite || work.stage !== "Nuevo") {
    work.inFlow = true;
  }
  if (work.inFlow && !work.flowTender) {
    work.flowTender = createFavoriteSnapshot(tender);
  }
  return work;
}

function normalizeSupplier(supplier) {
  return {
    id: supplier.id || createId(),
    name: supplier.name || "",
    contact: supplier.contact || "",
    amount: supplier.amount === undefined ? "" : supplier.amount,
    leadTime: supplier.leadTime || "",
    status: supplier.status || "Solicitado",
    note: supplier.note || "",
    createdAt: supplier.createdAt || new Date().toISOString()
  };
}

function createId() {
  return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function uniqueBy(items, keyGetter) {
  const seen = new Set();
  return items.filter((item) => {
    const key = keyGetter(item);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function getBestSupplier(suppliers = []) {
  const pricedSuppliers = suppliers
    .map(normalizeSupplier)
    .filter((supplier) => {
      const amount = Number(supplier.amount);
      return Number.isFinite(amount) && amount > 0;
    });

  const internalWinner = pricedSuppliers.find((supplier) => supplier.status === "Ganador interno");
  if (internalWinner) return internalWinner;

  return pricedSuppliers
    .slice()
    .sort((a, b) => Number(a.amount) - Number(b.amount))[0] || null;
}

function getTaxRate(work) {
  const value = Number(work?.taxRate);
  return Number.isFinite(value) && value >= 0 ? value : DEFAULT_TAX_RATE;
}

function parseCurrency(value) {
  if (typeof value === "number") {
    return Number.isFinite(value) ? value : 0;
  }

  const rawValue = String(value || "").trim();
  if (!/\d/.test(rawValue)) return 0;

  const numericValue = rawValue.replace(/[^\d.,-]/g, "");
  let normalized = numericValue;

  if (numericValue.includes(",") && numericValue.includes(".")) {
    normalized = numericValue.replace(/,/g, "");
  } else if (numericValue.includes(",")) {
    const parts = numericValue.split(",");
    const lastPart = parts[parts.length - 1];
    normalized = lastPart.length <= 2
      ? `${parts.slice(0, -1).join("")}.${lastPart}`
      : parts.join("");
  }

  const amount = Number(normalized);
  return Number.isFinite(amount) ? amount : 0;
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "-";
  return `${new Intl.NumberFormat("es-PA", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1
  }).format(value)}%`;
}

function saveAndRender() {
  saveWorkspace();
  render();
}

function removeSupplier(supplierId) {
  const tender = getSelectedTender();
  if (!tender) return;
  const work = getTenderWork(tender);
  work.suppliers = work.suppliers.filter((supplier) => supplier.id !== supplierId);
  saveAndRender();
}

async function copySupplierMessage() {
  const tender = getSelectedTender();
  if (!tender) return;
  const message = [
    "Hola, estamos evaluando participar en esta licitacion de PanamaCompra.",
    "",
    `Numero: ${tender.numero}`,
    `Entidad: ${tender.entidad}`,
    `Objeto: ${tender.titulo}`,
    `Tipo: ${[tender.prefijo, tender.tipoProceso].filter(Boolean).join(" / ")}`,
    "",
    "Por favor confirmar disponibilidad, precio, tiempo de entrega y condiciones para cotizar."
  ].join("\n");

  try {
    await copyText(message);
    showToast("Mensaje copiado");
  } catch (error) {
    showCopyFallback("Mensaje para proveedor", message);
    showToast("Mensaje listo para copiar");
  }
}

function openSelectedTender() {
  const tender = getSelectedTender();
  if (!tender?.portalUrl) {
    showToast("Selecciona una licitacion");
    return;
  }
  window.open(tender.portalUrl, "_blank", "noopener,noreferrer");
}

async function copySelectedSummary() {
  const tender = getSelectedTender();
  if (!tender) {
    showToast("Selecciona una licitacion");
    return;
  }

  const summary = getSummaryData(tender);
  const itemLines = buildItemsSummaryLines(summary);
  const message = [
    "Resumen de proceso PanamaCompra",
    "",
    `Numero de Proceso: ${summary.number}`,
    `Objeto de Contratacion: ${summary.object}`,
    `Descripcion: ${summary.description}`,
    `Tipo de proceso: ${summary.type}`,
    `Fecha de Publicacion: ${summary.published}`,
    `Presentacion de propuestas: ${summary.submission}`,
    `Apertura de propuestas: ${summary.opening}`,
    `Precio de referencia: ${summary.price}`,
    `Pago: ${summary.payment}`,
    `Multas: ${summary.penalty}`,
    `Entidad: ${summary.entity}`,
    `Contacto: ${summary.contact}`,
    `Cargo: ${summary.role}`,
    `Telefono: ${summary.phone}`,
    `Correo electronico: ${summary.email}`,
    ...(itemLines.length
      ? ["", "Items de compra menor:", ...itemLines, `Total items: ${summary.itemsTotal || "-"}`]
      : [])
  ].join("\n");

  try {
    await copyText(message);
    showToast("Resumen copiado");
  } catch (error) {
    showCopyFallback("Resumen del proceso", message);
    showToast("Resumen listo para copiar");
  }
}

function buildItemsSummaryLines(summary) {
  const items = Array.isArray(summary.items) ? summary.items : [];
  return items.flatMap((item) => [
    `${item.renglon || "-"}: ${item.descripcion || "Sin descripcion"}`,
    `Codigo: ${item.codigo || "-"} | Clasificacion: ${item.clasificacion || "-"} | Cantidad: ${formatItemQuantity(item.cantidad)} | Unidad: ${item.unidad || "-"} | Precio referencia: ${item.precioReferencia || "-"}`
  ]);
}

function exportVisibleTenders() {
  const rows = getVisibleTenders().map((item) => {
    const work = getTenderWork(item);
    const deadline = getTenderDeadlineInfo(item);
    return {
      numero: item.numero,
      titulo: item.titulo,
      entidad: item.entidad,
      unidadCompra: item.unidadCompra,
      estado: item.estado,
      objeto: item.objeto,
      tipoProceso: item.tipoProceso,
      fechaPublicacion: item.fechaPublicacion,
      presentacionPropuestas: deadline.date ? deadline.date.toISOString() : "",
      tiempoRestante: deadline.label,
      etapa: work.stage,
      prioridad: work.priority,
      favorito: work.favorite ? "Si" : "No",
      portal: item.portalUrl
    };
  });
  downloadCsv("licitaciones-panamacompra.csv", rows);
}

function exportQuotes() {
  const rows = [];
  for (const tender of state.tenders) {
    const work = getTenderWork(tender);
    const summary = getSummaryData(tender);
    const referenceAmount = parseCurrency(summary.price);
    const taxRate = getTaxRate(work);
    for (const supplier of work.suppliers) {
      const supplierAmount = Number(supplier.amount);
      const marginAmount = referenceAmount && Number.isFinite(supplierAmount)
        ? referenceAmount - supplierAmount
        : "";
      const marginPercent = referenceAmount && Number.isFinite(supplierAmount)
        ? ((referenceAmount - supplierAmount) / referenceAmount) * 100
        : "";
      const targetMargin = Number(work.targetMargin);
      const suggestedBase = Number.isFinite(supplierAmount) && supplierAmount > 0 && Number.isFinite(targetMargin) && targetMargin > 0 && targetMargin < 100
        ? supplierAmount / (1 - (targetMargin / 100))
        : "";
      const taxAmount = suggestedBase ? suggestedBase * (taxRate / 100) : "";
      const suggestedPrice = suggestedBase ? suggestedBase + taxAmount : "";
      rows.push({
        numero: tender.numero,
        titulo: tender.titulo,
        entidad: tender.entidad,
        etapa: work.stage,
        prioridad: work.priority,
        fechaLimiteInterna: work.dueDate,
        margenMeta: work.targetMargin,
        precioReferencia: summary.price,
        proveedor: supplier.name,
        contacto: supplier.contact,
        monto: supplier.amount,
        margenEstimado: marginAmount,
        margenPorcentaje: marginPercent,
        itbmsPorcentaje: taxRate,
        itbmsEstimado: taxAmount,
        precioSugerido: suggestedPrice,
        entrega: supplier.leadTime,
        estadoProveedor: supplier.status,
        notaProveedor: supplier.note,
        notasInternas: work.notes,
        creado: supplier.createdAt
      });
    }
  }
  downloadCsv("cotizaciones-proveedores.csv", rows);
}

function downloadCsv(filename, rows) {
  if (!rows.length) {
    showToast("No hay datos para exportar");
    return;
  }
  const headers = Object.keys(rows[0]);
  const csv = [
    headers.join(","),
    ...rows.map((row) => headers.map((header) => csvCell(row[header])).join(","))
  ].join("\n");
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function copyText(text) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return;
    } catch (error) {
      // Continue with the textarea fallback below.
    }
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);
  textarea.select();
  const copied = document.execCommand("copy");
  textarea.remove();

  if (!copied) {
    throw new Error("No se pudo copiar");
  }
}

function showCopyFallback(title, text) {
  document.querySelector(".copy-fallback")?.remove();

  const wrapper = document.createElement("div");
  wrapper.className = "copy-fallback";
  wrapper.innerHTML = `
    <div class="copy-fallback-head">
      <strong>${escapeHtml(title)}</strong>
      <button class="btn ghost" type="button">Cerrar</button>
    </div>
    <textarea rows="10" readonly>${escapeHtml(text)}</textarea>
  `;

  document.body.appendChild(wrapper);
  const textarea = wrapper.querySelector("textarea");
  textarea.focus();
  textarea.select();
  wrapper.querySelector("button").addEventListener("click", () => wrapper.remove());
}

async function fetchJson(url) {
  const response = await fetch(url);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.ok === false) {
    const error = new Error(data.error || response.statusText || "Error de servidor");
    error.hint = data.hint;
    throw error;
  }
  return data;
}

function loadWorkspace() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

function saveWorkspace() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.workspace));
}

function statusPill(status) {
  return `<span class="status-pill ${statusClass(status)}">${escapeHtml(status || "Sin estado")}</span>`;
}

function statusClass(status) {
  const value = (status || "").toLowerCase();
  if (["adjudicado", "cerrada", "desierto", "cancelado"].some((item) => value.includes(item))) return "closed";
  if (["reclamo", "suspendido", "autorizar"].some((item) => value.includes(item))) return "warn";
  return "";
}

function normalizeAmount(value) {
  const number = parseCurrency(value);
  return number > 0 ? number : "";
}

function formatMoney(value) {
  if (value === "" || value === null || value === undefined) return "Pendiente";
  return new Intl.NumberFormat("es-PA", { style: "currency", currency: "PAB" }).format(Number(value));
}

function formatItemQuantity(value) {
  if (value === "" || value === null || value === undefined) return "-";
  const number = Number(value);
  if (!Number.isFinite(number)) return String(value);
  return new Intl.NumberFormat("es-PA", { maximumFractionDigits: 4 }).format(number);
}

function formatDate(value) {
  if (!value) return "Sin fecha";
  return new Intl.DateTimeFormat("es-PA", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: "America/Panama"
  }).format(new Date(value));
}

function formatTime(value) {
  return new Intl.DateTimeFormat("es-PA", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "America/Panama"
  }).format(new Date(value));
}

function toDateInputValue(value) {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function getProviderName(provider) {
  return provider.nombreComercial || provider.razonSocial || "Proveedor sin nombre";
}

function getProviderKey(provider) {
  return [
    provider.source,
    provider.idProponente,
    provider.idProveedor,
    provider.idRazonSocial,
    provider.ruc,
    getProviderName(provider)
  ].filter(Boolean).join("|");
}

function setSyncStatus(text) {
  el.syncStatus.textContent = text;
}

function startThinking(text = "Pensando...") {
  state.thinkingCount += 1;
  updateThinkingIndicator(text);

  let stopped = false;
  return () => {
    if (stopped) return;
    stopped = true;
    state.thinkingCount = Math.max(0, state.thinkingCount - 1);
    updateThinkingIndicator();
  };
}

function updateThinkingIndicator(text) {
  if (text) {
    el.thinkingText.textContent = text;
    el.thinkingOverlayText.textContent = text;
  }
  const isThinking = state.thinkingCount > 0;
  el.thinkingIndicator.classList.toggle("hidden", !isThinking);
  el.thinkingIndicator.setAttribute("aria-busy", isThinking ? "true" : "false");
  el.thinkingOverlay.classList.toggle("hidden", !isThinking);
  el.thinkingOverlay.setAttribute("aria-busy", isThinking ? "true" : "false");
}

function showToast(text) {
  el.toast.textContent = text;
  el.toast.classList.remove("hidden");
  window.clearTimeout(showToast.timer);
  showToast.timer = window.setTimeout(() => el.toast.classList.add("hidden"), 3200);
}

function debounce(fn, delay) {
  let timer;
  return (...args) => {
    window.clearTimeout(timer);
    timer = window.setTimeout(() => fn(...args), delay);
  };
}

function csvCell(value) {
  const text = String(value ?? "");
  return `"${text.replace(/"/g, '""')}"`;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}
