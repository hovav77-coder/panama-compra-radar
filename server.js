const http = require("node:http");
const https = require("node:https");
const fs = require("node:fs");
const path = require("node:path");
const { URL } = require("node:url");

const PORT = Number(process.env.PORT || 4174);
const API_BASE = process.env.PANAMA_COMPRA_API_BASE || "https://apisv3.panamacompra.gob.pa";
const LEGACY_BASE = process.env.PANAMA_COMPRA_LEGACY_BASE || "https://www.panamacompra.gob.pa";
const PUBLIC_DIR = path.join(__dirname, "public");

const MIME_TYPES = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml",
  ".ico": "image/x-icon"
};

async function appHandler(req, res) {
  try {
    const url = new URL(req.url, `http://${req.headers.host || "127.0.0.1"}`);

    if (url.pathname === "/api/health") {
      return sendJson(res, 200, {
        ok: true,
        apiBase: API_BASE,
        time: new Date().toISOString()
      });
    }

    if (url.pathname === "/api/catalogs") {
      return handleCatalogs(res);
    }

    if (url.pathname === "/api/licitaciones") {
      return handleLicitaciones(url, res);
    }

    if (url.pathname === "/api/licitacion-detalle") {
      return handleLicitacionDetalle(url, res);
    }

    if (url.pathname === "/api/proveedor-actividad") {
      return handleProveedorActividad(url, res);
    }

    return serveStatic(url.pathname, res);
  } catch (error) {
    console.error(error);
    return sendJson(res, 500, formatError(error));
  }
}

const server = http.createServer(appHandler);

if (require.main === module) {
  server.listen(PORT, "0.0.0.0", () => {
    console.log(`Panama Compra Radar listo en http://127.0.0.1:${PORT}`);
  });
}

module.exports = appHandler;

async function handleCatalogs(res) {
  const [states, types, provinces] = await Promise.all([
    fetchPanama("/procesos-estados/publico"),
    fetchPanama("/procesos-tipo/publico"),
    fetchPanama("/provincias")
  ]);

  sendJson(res, 200, {
    estados: normalizeResult(states),
    tipos: normalizeResult(types),
    provincias: Array.isArray(provinces) ? provinces : normalizeResult(provinces),
    syncedAt: new Date().toISOString()
  });
}

async function handleLicitaciones(url, res) {
  const query = url.searchParams;
  const requestedLimit = clamp(Number(query.get("limit") || 50), 10, 2000);
  const perPage = Math.min(100, requestedLimit);
  const pages = clamp(Number(query.get("pages") || Math.ceil(requestedLimit / perPage)), 1, 20);
  const search = clean(query.get("q"));
  const estado = Number(query.get("estado") || 0);
  const tipo = Number(query.get("tipo") || -1);
  const provincia = Number(query.get("provincia") || 0);
  const desde = clean(query.get("desde"));
  const hasta = clean(query.get("hasta"));

  const filtro = {
    idEstado: Number.isFinite(estado) ? estado : 0,
    idTipoProceso: Number.isFinite(tipo) ? tipo : -1,
    idProvincia: Number.isFinite(provincia) ? provincia : 0
  };

  if (search) {
    if (/^\d{4}-/.test(search)) filtro.numProceso = search;
    else filtro.titulo = search;
  }
  if (desde) filtro.fechaDesde = new Date(`${desde}T00:00:00-05:00`).toISOString();
  if (hasta) filtro.fechaHasta = new Date(`${hasta}T23:59:59-05:00`).toISOString();

  let valorSiguiente = "";
  let records = [];
  let rawPages = [];

  for (let page = 0; page < pages && records.length < requestedLimit; page += 1) {
    const payload = {
      registrosPorPagina: Math.min(perPage, requestedLimit - records.length),
      valorSiguiente,
      filtro
    };
    const response = await fetchPanama("/busqueda/proceso-lista-publico", {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        Accept: "application/json;charset=utf-8",
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      },
      body: JSON.stringify(payload)
    });

    const result = response.result || {};
    const pageRecords = Array.isArray(result.registros) ? result.registros : [];
    records = records.concat(pageRecords.map(normalizeTender)).slice(0, requestedLimit);
    rawPages.push({
      page: result.pagina || page + 1,
      count: pageRecords.length,
      next: result.valorInicial || ""
    });

    valorSiguiente = result.valorInicial || "";
    if (!valorSiguiente || pageRecords.length < perPage) break;
  }

  sendJson(res, 200, {
    source: "panamacompra-v3",
    syncedAt: new Date().toISOString(),
    count: records.length,
    next: valorSiguiente,
    pages: rawPages,
    items: records
  });
}

async function handleLicitacionDetalle(url, res) {
  const query = url.searchParams;
  const tipo = Number(query.get("tipo"));
  const flujo = Number(query.get("flujo"));
  const numero = clean(query.get("numero"));

  if (!Number.isFinite(tipo) || !Number.isFinite(flujo)) {
    return sendJson(res, 400, {
      ok: false,
      error: "Faltan tipo y flujo de la licitacion"
    });
  }

  const response = await fetchPanama(`/procesos-configuracion/pagina-componentes-publico/${tipo}/procesoVistaPliego/${flujo}`);
  const detail = response.result || response;
  const components = Array.isArray(detail.pageComponentes) ? detail.pageComponentes : [];
  const summary = normalizeTenderDetail(components, { tipo, flujo, numero });

  sendJson(res, 200, {
    source: "panamacompra-v3-detail",
    syncedAt: new Date().toISOString(),
    title: detail.titulo || "",
    idTipoProceso: detail.idTipoProceso || tipo,
    idProcesosContratacionFlujos: flujo,
    summary,
    components: components.map((component) => ({
      tipo: component.tipo,
      nombre: component.nombre || "",
      order: component.order,
      estado: component.estado
    }))
  });
}

async function handleProveedorActividad(url, res) {
  const query = url.searchParams;
  const nombre = clean(query.get("nombre"));
  const desde = clean(query.get("desde"));
  const hasta = clean(query.get("hasta"));
  const limit = clamp(Number(query.get("limit") || 50), 10, 150);

  if (nombre.length < 2) {
    return sendJson(res, 400, {
      ok: false,
      error: "Ingresa al menos 2 caracteres del proveedor"
    });
  }

  const [providers, sanctions] = await Promise.all([
    searchProviders(nombre),
    searchProviderSanctions(nombre)
  ]);
  const activity = await scanProviderActivity({ nombre, providers, desde, hasta, limit });

  sendJson(res, 200, {
    source: "panamacompra-provider-activity",
    syncedAt: new Date().toISOString(),
    query: { nombre, desde, hasta, limit },
    providers,
    sanctions,
    activities: activity.activities,
    scanned: activity.scanned,
    scanBreakdown: activity.scanBreakdown,
    processWindow: activity.processWindow
  });
}

async function fetchPanama(apiPath, options = {}) {
  const target = `${API_BASE}${apiPath}`;
  const response = await fetchWithPanamaTlsFallback(target, {
    ...options,
    headers: {
      Accept: "application/json;charset=utf-8",
      ...(options.headers || {})
    }
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`PanamaCompra respondio con contenido no JSON (${response.status}): ${text.slice(0, 180)}`);
  }

  if (!response.ok && response.status !== 201) {
    const message = data.message || data.error || text || response.statusText;
    throw new Error(`PanamaCompra API ${response.status}: ${message}`);
  }

  return data;
}

async function fetchLegacyPanama(apiPath, method, value) {
  const body = new URLSearchParams();
  body.set("METHOD", JSON.stringify(method));
  body.set("VALUE", JSON.stringify(value || {}));

  const response = await fetchWithPanamaTlsFallback(`${LEGACY_BASE}${apiPath}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded;charset=UTF-8",
      Accept: "application/json;charset=utf-8",
      Origin: LEGACY_BASE,
      Referer: `${LEGACY_BASE}/Inicio/#/buscador-proveedor-externo/proponentes-v2`
    },
    body
  });

  const text = await response.text();
  let data;
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    throw new Error(`PanamaCompra legacy respondio con contenido no JSON (${response.status}): ${text.slice(0, 180)}`);
  }

  if (!response.ok) {
    const message = data.message || data.error || text || response.statusText;
    throw new Error(`PanamaCompra legacy ${response.status}: ${message}`);
  }

  return data;
}

async function fetchWithPanamaTlsFallback(target, options = {}) {
  try {
    return await fetch(target, options);
  } catch (error) {
    if (!shouldUsePanamaTlsFallback(target, error)) {
      throw error;
    }
    console.warn(`Usando respaldo HTTPS para PanamaCompra: ${error.message}`);
    return requestWithNodeHttps(target, options);
  }
}

function shouldUsePanamaTlsFallback(target, error) {
  const message = `${error?.message || ""} ${error?.cause?.message || ""} ${error?.code || ""}`;
  return isPanamaCompraUrl(target) &&
    /fetch failed|certificate|VERIFY|TLS|SSL|ECONNRESET|UNABLE_TO|SELF_SIGNED/i.test(message);
}

function isPanamaCompraUrl(target) {
  try {
    const hostname = new URL(target).hostname.toLowerCase();
    return hostname === "panamacompra.gob.pa" ||
      hostname.endsWith(".panamacompra.gob.pa");
  } catch (error) {
    return false;
  }
}

function requestWithNodeHttps(target, options = {}) {
  return new Promise((resolve, reject) => {
    const url = new URL(target);
    const isHttps = url.protocol === "https:";
    const transport = isHttps ? https : http;
    const headers = normalizeRequestHeaders(options.headers);
    let body = options.body;

    if (body instanceof URLSearchParams) {
      body = body.toString();
    } else if (body && !Buffer.isBuffer(body) && typeof body !== "string") {
      body = String(body);
    }

    if (body && !hasHeader(headers, "content-length")) {
      headers["Content-Length"] = Buffer.byteLength(body);
    }

    const req = transport.request({
      protocol: url.protocol,
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: options.method || "GET",
      headers,
      rejectUnauthorized: isHttps ? false : undefined
    }, (res) => {
      const chunks = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => {
        const buffer = Buffer.concat(chunks);
        resolve({
          ok: res.statusCode >= 200 && res.statusCode < 300,
          status: res.statusCode,
          statusText: res.statusMessage || "",
          headers: res.headers,
          text: async () => buffer.toString("utf8"),
          arrayBuffer: async () => buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
        });
      });
    });

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error("Tiempo agotado consultando PanamaCompra"));
    });

    if (body) req.write(body);
    req.end();
  });
}

function normalizeRequestHeaders(headers = {}) {
  if (headers && typeof headers.entries === "function") {
    return Object.fromEntries(headers.entries());
  }
  return { ...(headers || {}) };
}

function hasHeader(headers, name) {
  const target = name.toLowerCase();
  return Object.keys(headers).some((key) => key.toLowerCase() === target);
}

async function searchProviders(nombre) {
  const [modern, legacy] = await Promise.allSettled([
    searchProvidersV3(nombre),
    searchProvidersLegacy(nombre)
  ]);

  const modernProviders = modern.status === "fulfilled" ? modern.value : [];
  const legacyProviders = legacy.status === "fulfilled" ? legacy.value : [];
  const rucMatches = await searchProvidersV3ByLegacyRucs(legacyProviders);
  const providers = [
    ...modernProviders,
    ...rucMatches,
    ...legacyProviders
  ];

  return uniqueBy(providers, (item) =>
    [item.ruc, item.idProponente, item.nombreComercial, item.razonSocial].filter(Boolean).join("|").toLowerCase()
  ).slice(0, 15);
}

async function searchProvidersV3(nombre) {
  const payload = {
    registrosPorPagina: 15,
    filtro: {
      tipoEDP: 3,
      esPublico: true,
      aprobado: true,
      razonSocialId: 0,
      nombreComercial: nombre,
      nombre,
      ruc: ""
    }
  };
  const response = await fetchPanama("/empresas/lista-publica", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Accept: "application/json;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
  const records = response.result?.registros || response.registros || [];

  return records.map((item) => ({
    source: "v3",
    idProponente: item.id || null,
    idRazonSocial: item.razonSocialId || null,
    nombreComercial: clean(item.nombreComercial) || clean(item.nombre),
    razonSocial: clean(item.razonSocial),
    ruc: clean(item.ruc),
    representanteLegal: clean(item.representanteLegal),
    activo: item.activo,
    aprobado: item.aprobado
  }));
}

async function searchProvidersV3ByLegacyRucs(providers) {
  const rucs = uniqueBy(providers
    .map((provider) => normalizeRucForV3(provider.ruc))
    .filter(Boolean), (value) => value);
  const results = await Promise.allSettled(rucs.map((ruc) => searchProvidersV3ByRuc(ruc)));
  return results.flatMap((result) => result.status === "fulfilled" ? result.value : []);
}

async function searchProvidersV3ByRuc(ruc) {
  const payload = {
    registrosPorPagina: 15,
    filtro: {
      tipoEDP: 3,
      esPublico: true,
      aprobado: true,
      razonSocialId: 0,
      nombreComercial: "",
      nombre: "",
      ruc
    }
  };
  const response = await fetchPanama("/empresas/lista-publica", {
    method: "POST",
    headers: {
      "Content-Type": "application/json;charset=utf-8",
      Accept: "application/json;charset=utf-8"
    },
    body: JSON.stringify(payload)
  });
  const records = response.result?.registros || response.registros || [];

  return records.map((item) => ({
    source: "v3",
    idProponente: item.id || null,
    idRazonSocial: item.razonSocialId || null,
    nombreComercial: clean(item.nombreComercial) || clean(item.nombre),
    razonSocial: clean(item.razonSocial),
    ruc: clean(item.ruc),
    representanteLegal: clean(item.representanteLegal),
    activo: item.activo,
    aprobado: item.aprobado
  }));
}

async function searchProvidersLegacy(nombre) {
  const response = await fetchLegacyPanama("/Security/searchAdvanced.asmx/ListarProveedores", 0, {
    nombre,
    rut: "",
    OrgC: "",
    entidad: "",
    Inicio: 0
  });
  const records = response.listNews || [];

  const providers = records.map((item) => ({
    source: "legacy",
    idProveedor: item.IdProveedor || null,
    idOrgV: item.IdOrgV || null,
    nombreComercial: clean(item.NombreProveedor),
    razonSocial: clean(item.NombreProveedor),
    ruc: clean(item.RutProveedor),
    direccion: clean(item.DireccionProveedor),
    profileUrl: createLegacyProviderProfileUrl(item.IdProveedor, item.IdOrgV)
  }));

  const enriched = await mapLimit(providers.slice(0, 10), 3, async (provider) => ({
    ...provider,
    profile: await fetchLegacyProviderProfile(provider).catch(() => null)
  }));

  return enriched.concat(providers.slice(10));
}

async function fetchLegacyProviderProfile(provider) {
  if (!provider.idProveedor || !provider.idOrgV) return null;
  const response = await fetchWithPanamaTlsFallback(provider.profileUrl, {
    headers: {
      Accept: "text/html,application/xhtml+xml",
      Referer: `${LEGACY_BASE}/Inicio/`
    }
  });
  const buffer = Buffer.from(await response.arrayBuffer());
  const html = buffer.toString("latin1");
  const plain = htmlToPlainText(html);
  const labels = [
    "Proponente",
    "Razon Social",
    "RUC",
    "Dirección",
    "Contacto",
    "Telefono",
    "Fax",
    "Fecha de Creación",
    "Fecha de Actualización",
    "Monto Adjudicado",
    "Cerrar"
  ];

  return {
    proponente: pickLegacyProfileField(plain, "Proponente", labels),
    razonSocial: pickLegacyProfileField(plain, "Razon Social", labels),
    ruc: pickLegacyProfileField(plain, "RUC", labels),
    contacto: pickLegacyProfileField(plain, "Contacto", labels),
    telefono: pickLegacyProfileField(plain, "Telefono", labels),
    fechaCreacion: pickLegacyProfileField(plain, "Fecha de Creación", labels),
    fechaActualizacion: pickLegacyProfileField(plain, "Fecha de Actualización", labels),
    montoAdjudicado: pickLegacyProfileField(plain, "Monto Adjudicado", labels)
  };
}

async function searchProviderSanctions(nombre) {
  const endpoints = [
    { type: "Inhabilitacion", path: "/proveedores-inhabilitados/listaPublica" },
    { type: "Multa", path: "/proveedores-multados/listaPublica" }
  ];
  const results = await Promise.allSettled(endpoints.map((endpoint) =>
    fetchPanama(endpoint.path, {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        Accept: "application/json;charset=utf-8"
      },
      body: JSON.stringify({})
    }).then((payload) => ({ endpoint, payload }))
  ));
  const terms = buildProviderTerms(nombre, []);

  return results.flatMap((result) => {
    if (result.status !== "fulfilled") return [];
    const records = result.value.payload.registros || result.value.payload.result?.registros || [];
    return records
      .filter((item) => matchesProviderText(JSON.stringify(item), terms))
      .map((item) => normalizeProviderSanction(item, result.value.endpoint.type));
  }).slice(0, 20);
}

async function scanProviderActivity({ nombre, providers, desde, hasta, limit }) {
  const [recentRecords, awardedRecords] = await Promise.all([
    fetchProviderProcessWindow({ desde, hasta, limit, estado: 0 }),
    fetchProviderProcessWindow({ desde, hasta, limit, estado: 1011 })
  ]);
  const records = uniqueBy([...awardedRecords, ...recentRecords], (record) =>
    String(record.idProcesosContratacionFlujos || record.idProcesosContratacion || record.numProceso || "")
  );
  const terms = buildProviderTerms(nombre, providers);
  const details = await mapLimit(records, 5, async (record) => {
    if (!record.idTipoProceso || !record.idProcesosContratacionFlujos) return null;
    try {
      const response = await fetchPanama(`/procesos-configuracion/pagina-componentes-publico/${record.idTipoProceso}/procesoVistaPliego/${record.idProcesosContratacionFlujos}`);
      const detail = response.result || response;
      const components = Array.isArray(detail.pageComponentes) ? detail.pageComponentes : [];
      return extractProviderActivity(record, components, terms);
    } catch (error) {
      return null;
    }
  });

  return {
    scanned: records.length,
    scanBreakdown: {
      recientes: recentRecords.length,
      adjudicados: awardedRecords.length,
      unicos: records.length
    },
    processWindow: records.map((record) => normalizeTender(record)),
    activities: details.filter(Boolean)
  };
}

async function fetchProviderProcessWindow({ desde, hasta, limit, estado = 0 }) {
  const perPage = 50;
  const filtro = {
    idEstado: estado,
    idTipoProceso: -1
  };

  if (desde) filtro.fechaDesde = new Date(`${desde}T00:00:00-05:00`).toISOString();
  if (hasta) filtro.fechaHasta = new Date(`${hasta}T23:59:59-05:00`).toISOString();

  let valorSiguiente = "";
  let records = [];
  while (records.length < limit) {
    const response = await fetchPanama("/busqueda/proceso-lista-publico", {
      method: "POST",
      headers: {
        "Content-Type": "application/json;charset=utf-8",
        Accept: "application/json;charset=utf-8",
        "Cache-Control": "no-cache",
        Pragma: "no-cache"
      },
      body: JSON.stringify({
        registrosPorPagina: Math.min(perPage, limit - records.length),
        valorSiguiente,
        filtro
      })
    });
    const result = response.result || {};
    const pageRecords = Array.isArray(result.registros) ? result.registros : [];
    records = records.concat(pageRecords);
    valorSiguiente = result.valorInicial || "";
    if (!valorSiguiente || pageRecords.length < perPage) break;
  }

  return records.slice(0, limit);
}

function extractProviderActivity(record, components, terms) {
  const matches = [];

  for (const component of components) {
    const componentName = normalizeText(`${component.tipo || ""} ${component.nombre || ""}`);
    const values = Array.isArray(component.value) ? component.value : [];

    const isOfferComponent = (componentName.includes("oferta") || componentName.includes("proponente")) &&
      !componentName.includes("file") &&
      !componentName.includes("archivo");

    if (isOfferComponent) {
      for (const offer of values) {
        const providerName = clean(offer.empresa?.nombreComercial) ||
          clean(offer.empresa?.razonSocial) ||
          clean(offer.nombreComercial) ||
          clean(offer.razonSocial);
        const searchable = [
          providerName,
          offer.empresa?.ruc,
          offer.ruc,
          offer.idProponente,
          JSON.stringify(offer.empresa || {})
        ].filter(Boolean).join(" ");

        if (matchesProviderText(searchable, terms) || matchesProviderText(JSON.stringify(offer), terms)) {
          matches.push({
            relation: componentName.includes("adjudic") ? "Adjudicado" : "Oferta presentada",
            providerName: providerName || "Proveedor en oferta",
            ruc: clean(offer.empresa?.ruc) || clean(offer.ruc),
            offerId: offer.id || null,
            idProponente: offer.idProponente || null,
            fechaEnvio: offer.fechaEnvio || "",
            amount: sumOfferItems(offer.procesosOfertasItems),
            itemCount: Array.isArray(offer.procesosOfertasItems) ? offer.procesosOfertasItems.length : 0
          });
        }
      }
    }

    const providerInfo = extractProviderInfoValues(values);
    if (providerInfo && matchesProviderText(Object.values(providerInfo).join(" "), terms)) {
      matches.push({
        relation: "Proveedor en detalle",
        providerName: providerInfo.nombreComercial || providerInfo.razonSocial || "Proveedor en detalle",
        ruc: providerInfo.ruc || "",
        amount: "",
        itemCount: 0
      });
    }
  }

  if (!matches.length) return null;

  const tender = normalizeTender(record);
  const uniqueMatches = uniqueProviderMatches(matches);
  const bestMatch = uniqueMatches.find((item) => item.relation === "Adjudicado") ||
    uniqueMatches.find((item) => item.relation === "Oferta presentada") ||
    uniqueMatches[0];

  return {
    ...tender,
    relation: bestMatch.relation,
    providerName: bestMatch.providerName,
    providerRuc: bestMatch.ruc,
    offerAmount: formatCurrencyValue(bestMatch.amount),
    offerDate: bestMatch.fechaEnvio || "",
    itemCount: bestMatch.itemCount || 0,
    matches: uniqueMatches
  };
}

function normalizeProviderSanction(item, type) {
  return {
    type,
    nombreComercial: clean(item.nameComercial || item.nombreComercial || item.NombreComercial),
    razonSocial: clean(item.razonSocial || item.RazonSocial),
    institution: clean(item.institution || item.institucion || item.Institucion),
    title: clean(item.title || item.titulo || item.resolucion || item.Resolucion),
    date: clean(item.date || item.fecha || item.periodo || item.Periodo),
    link: item.rutaCompleta ? `${API_BASE}${item.rutaCompleta}` : (item.link ? `${LEGACY_BASE}${item.link}` : ""),
    raw: item
  };
}

function buildProviderTerms(nombre, providers) {
  const values = [
    nombre,
    ...providers.flatMap((provider) => [
      provider.nombreComercial,
      provider.razonSocial,
      provider.ruc
    ])
  ];

  return uniqueBy(values
    .map((value) => normalizeText(value))
    .filter((value) => value.length >= 3), (value) => value);
}

function matchesProviderText(text, terms) {
  const normalized = normalizeText(text);
  return terms.some((term) => normalized.includes(term));
}

function extractProviderInfoValues(values) {
  if (!values.some((item) => normalizeText(item.nombre).includes("razon social") ||
    normalizeText(item.nombre).includes("nombre comercial") ||
    normalizeText(item.nombre).includes("ruc"))) {
    return null;
  }

  return {
    razonSocial: pickValue(values, ["razon social"]),
    nombreComercial: pickValue(values, ["nombre comercial"]),
    ruc: pickValue(values, ["ruc"]),
    correo: pickValue(values, ["correo"]),
    telefono: pickValue(values, ["telefono"])
  };
}

function sumOfferItems(items) {
  if (!Array.isArray(items)) return "";
  const total = items.reduce((sum, item) => {
    const value = parseCurrencyNumber(item.precioTotal);
    return value > 0 ? sum + value : sum;
  }, 0);
  return total > 0 ? total : "";
}

function uniqueProviderMatches(matches) {
  return uniqueBy(matches, (item) =>
    [item.relation, item.providerName, item.ruc, item.offerId].filter(Boolean).join("|").toLowerCase()
  );
}

function uniqueBy(items, getKey) {
  const seen = new Set();
  const result = [];
  for (const item of items) {
    const key = getKey(item);
    if (!key || seen.has(key)) continue;
    seen.add(key);
    result.push(item);
  }
  return result;
}

async function mapLimit(items, limit, mapper) {
  const results = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await mapper(items[current], current);
    }
  }

  const workers = Array.from({ length: Math.min(limit, items.length) }, worker);
  await Promise.all(workers);
  return results;
}

function normalizeTender(item) {
  const numero = item.numProceso || "";
  const searchUrl = createSearchUrl(numero);
  const detailUrl = createDetailUrl(item);
  const publishedAt = item.fechaPublicacion || item.fechaEstado || null;

  return {
    id: String(item.idProcesosContratacionFlujos || item.idProcesosContratacion || numero),
    procesoId: item.idProcesosContratacion || null,
    flujoId: item.idProcesosContratacionFlujos || null,
    numero,
    titulo: item.titulo || "Sin titulo",
    entidad: clean(item.nombreEntidad) || "Sin entidad",
    unidadCompra: clean(item.nombreUnidadCompra),
    dependencia: clean(item.nombreDependencia),
    objeto: clean(item.nombreObjectoContractual),
    tipoProceso: clean(item.nombre),
    tipoId: item.idTipoProceso || null,
    prefijo: clean(item.prefijo),
    estado: clean(item.nombreRealizado),
    estadoId: item.idEstado || null,
    modalidad: clean(item.nombreModalidad),
    observaciones: clean(item.observaciones),
    fechaPublicacion: publishedAt,
    fechaEstado: item.fechaEstado || null,
    fechaPresentacionPropuesta: item.fechaPresentacionPropuesta ||
      item.fechaPresentacionPropuestas ||
      item.fechaRecepcionPropuestas ||
      item.fechaCierrePropuestas ||
      item.fechaPresentacion ||
      item.fechaCierre ||
      null,
    portalUrl: searchUrl,
    portalDetalleUrl: detailUrl,
    raw: item
  };
}

function normalizeResult(payload) {
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload.result)) return payload.result;
  return [];
}

function normalizeTenderDetail(components, fallback = {}) {
  const general = findValues(components, (component) =>
    hasAny(component, ["aviso", "convocatoria"]) ||
    hasAnyValue(component, ["fecha de publicacion", "precio de referencia", "precio estimado"])
  );
  const processInfo = findValues(components, (component) =>
    hasAnyValue(component, ["numero de proceso", "tipo de proceso", "objeto de contratacion"])
  );
  const entityInfo = findValues(components, (component) =>
    hasAny(component, ["entidad"]) ||
    hasAnyValue(component, ["entidad", "dependencia", "unidad de compra"])
  );
  const contactInfo = findValues(components, (component) =>
    hasAny(component, ["contacto"]) ||
    (hasAnyValue(component, ["telefono", "correo electronico"]) && hasAnyValue(component, ["nombre", "cargo"]))
  );
  const contractInfo = findValues(components, (component) =>
    hasAny(component, ["contratacion"]) ||
    hasAnyValue(component, ["forma de pago", "termino de pago", "multas"])
  );
  const itemValues = components
    .filter((component) => Array.isArray(component.value) && hasAny(component, ["items"]))
    .flatMap((component) => component.value || []);

  const itemsTotalRaw = sumCurrencyValues(itemValues.map((item) => item.precioReferencia));
  const priceRaw = pickValue(general, ["precio de referencia", "precio estimado"]) ||
    itemsTotalRaw ||
    firstNumberCurrency(itemValues.map((item) => item.precioReferencia));
  const payment = [pickValue(contractInfo, ["forma de pago"]), pickValue(contractInfo, ["termino de pago"])]
    .filter(Boolean)
    .join(" / ");

  return {
    number: pickValue(processInfo, ["numero de proceso"]) || fallback.numero || "",
    title: pickValue(processInfo, ["titulo"]) || pickValue(general, ["descripcion"]) || "",
    description: pickValue(general, ["descripcion"]) || pickValue(processInfo, ["titulo"]) || "",
    object: pickValue(processInfo, ["objeto de contratacion"]) || pickValue(general, ["objeto de contratacion"]) || "",
    type: pickValue(processInfo, ["tipo de proceso"]) || "",
    price: formatCurrencyValue(priceRaw),
    payment,
    penalty: pickValue(contractInfo, ["multas"]) || "",
    published: pickValue(general, ["fecha de publicacion"]) || "",
    submission: pickValue(general, [
      "fecha y hora presentacion de propuestas",
      "fecha y hora presentacion de cotizaciones"
    ]) || "",
    opening: pickValue(general, [
      "fecha y hora de apertura de propuestas",
      "fecha y hora de apertura de cotizaciones"
    ]) || "",
    entity: pickValue(entityInfo, ["entidad"]) || "",
    dependency: pickValue(entityInfo, ["dependencia"]) || "",
    purchaseUnit: pickValue(entityInfo, ["unidad de compra"]) || "",
    province: pickValue(entityInfo, ["provincia", "provincia de entrega"]) || pickValue(general, ["provincia de entrega"]) || "",
    contact: pickValue(contactInfo, ["nombre"]) || "",
    role: pickValue(contactInfo, ["cargo"]) || "",
    phone: pickValue(contactInfo, ["telefono"]) || "",
    email: pickValue(contactInfo, ["correo electronico"]) || "",
    delivery: [pickValue(contractInfo, ["entrega", "forma de entrega"]), pickValue(contractInfo, ["termino de entrega"])]
      .filter(Boolean)
      .join(" / "),
    itemsTotal: formatCurrencyValue(itemsTotalRaw),
    items: itemValues.map((item) => ({
      renglon: item.numRenglon,
      descripcion: clean(item.descripcion),
      codigo: cleanAny(item.codigo) ||
        cleanAny(item.codigoItem) ||
        cleanAny(item.codigoClasificacion) ||
        cleanAny(item.codClasificacion) ||
        cleanAny(item.codigoProducto) ||
        cleanAny(item.codigoRubro) ||
        cleanAny(item.codigoUNSPSC) ||
        cleanAny(item.codigoUnspsc) ||
        cleanAny(item.unspsc),
      clasificacion: clean(item.clasificacion),
      cantidad: item.cantidad,
      unidad: clean(item.unidad),
      precioReferencia: formatCurrencyValue(item.precioReferencia)
    }))
  };
}

function findValues(components, predicate) {
  const component = components.find((item) => predicate(item));
  return Array.isArray(component?.value) ? component.value : [];
}

function hasAny(component, needles) {
  const text = normalizeText(`${component.nombre || ""} ${component.tipo || ""}`);
  return needles.some((needle) => text.includes(normalizeText(needle)));
}

function hasAnyValue(component, labels) {
  if (!Array.isArray(component.value)) return false;
  return component.value.some((item) => labels.some((label) => normalizeText(item.nombre).includes(normalizeText(label))));
}

function pickValue(values, labels) {
  for (const label of labels) {
    const found = values.find((item) => normalizeText(item.nombre).includes(normalizeText(label)));
    if (found?.value !== undefined && found.value !== null && `${found.value}`.trim() !== "") {
      return clean(`${found.value}`);
    }
  }
  return "";
}

function normalizeText(value) {
  return `${value || ""}`
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function firstNumberCurrency(values) {
  const value = values.find((item) => Number.isFinite(Number(item)) && Number(item) > 0);
  return value === undefined ? "" : Number(value);
}

function sumCurrencyValues(values) {
  const total = values.reduce((sum, item) => {
    const value = parseCurrencyNumber(item);
    return value > 0 ? sum + value : sum;
  }, 0);
  return total > 0 ? total : "";
}

function parseCurrencyNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (value === undefined || value === null || value === "") return 0;
  const cleaned = `${value}`
    .replace(/[^\d.,-]/g, "")
    .replace(/,/g, "");
  const number = Number(cleaned);
  return Number.isFinite(number) ? number : 0;
}

function formatCurrencyValue(value) {
  if (value === undefined || value === null || value === "") return "";
  if (typeof value === "number") {
    return `B/. ${value.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  }
  return clean(`${value}`);
}

function createSearchUrl(numero) {
  const q = encodePortalUrl(JSON.stringify({ numLc: numero }));
  return `https://www.panamacompra.gob.pa/Inicio/#/busqueda-avanzada?q=${q}`;
}

function createDetailUrl(item) {
  if (!item.numProceso || !item.idProcesosContratacionFlujos || !item.idTipoProceso) {
    return createSearchUrl(item.numProceso || "");
  }
  const route = item.idTipoProceso === 2 ? "solicitud-de-cotizacion" : "pliego-de-cargos";
  const q = encodePortalUrl(JSON.stringify({
    i: item.idProcesosContratacionFlujos,
    tp: item.idTipoProceso
  }));
  return `https://www.panamacompra.gob.pa/Inicio/#/${route}/${item.numProceso}/${q}`;
}

function createLegacyProviderProfileUrl(idProveedor, idOrgV) {
  if (!idProveedor || !idOrgV) return "";
  return `${LEGACY_BASE}/ambientepublico/AP_FichaProveedor.aspx?IdEmpresa=${encodeURIComponent(`${idProveedor}_${idOrgV}`)}`;
}

function encodePortalUrl(value) {
  const binary = encodeURIComponent(value).replace(/%([0-9A-F]{2})/g, (_, hex) =>
    String.fromCodePoint(Number.parseInt(hex, 16))
  );
  const base64 = Buffer.from(binary, "binary").toString("base64");
  const urlSafe = base64.replace(/[+/=]/g, (char) => ({ "+": "-", "/": "_", "=": "" })[char] || "");
  return [...urlSafe].reverse().join("");
}

function clean(value) {
  return typeof value === "string" ? value.replace(/\s+/g, " ").trim() : "";
}

function cleanAny(value) {
  if (value === undefined || value === null) return "";
  return clean(`${value}`);
}

function normalizeRucForV3(value) {
  const text = cleanAny(value);
  if (!text) return "";
  const parts = text.split("-").map((part) => part.trim()).filter(Boolean);
  if (parts.length >= 4 && /^\d{1,2}$/.test(parts[parts.length - 1])) {
    return parts.slice(0, -1).join("-");
  }
  return text.replace(/\s+/g, "");
}

function htmlToPlainText(html) {
  return decodeHtmlEntities(`${html || ""}`)
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function decodeHtmlEntities(value) {
  return `${value || ""}`
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, "\"")
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&#(\d+);/g, (_, number) => String.fromCodePoint(Number(number)))
    .replace(/&#x([0-9a-f]+);/gi, (_, hex) => String.fromCodePoint(Number.parseInt(hex, 16)));
}

function pickLegacyProfileField(text, label, labels) {
  const start = text.indexOf(label);
  if (start < 0) return "";
  const valueStart = start + label.length;
  const next = labels
    .filter((item) => item !== label)
    .map((item) => text.indexOf(item, valueStart))
    .filter((index) => index > valueStart)
    .sort((a, b) => a - b)[0] || text.length;
  return clean(text.slice(valueStart, next).replace(/^[:\s]+/, ""));
}

function clamp(value, min, max) {
  if (!Number.isFinite(value)) return min;
  return Math.max(min, Math.min(max, value));
}

function serveStatic(pathname, res) {
  const safePath = pathname === "/" ? "/index.html" : pathname;
  const filePath = path.normalize(path.join(PUBLIC_DIR, safePath));

  if (!filePath.startsWith(PUBLIC_DIR)) {
    return sendText(res, 403, "Acceso denegado");
  }

  fs.readFile(filePath, (error, data) => {
    if (error) {
      return sendText(res, 404, "No encontrado");
    }
    const ext = path.extname(filePath).toLowerCase();
    res.writeHead(200, {
      "Content-Type": MIME_TYPES[ext] || "application/octet-stream",
      "Cache-Control": "no-store"
    });
    res.end(data);
  });
}

function sendJson(res, status, body) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(JSON.stringify(body));
}

function sendText(res, status, text) {
  res.writeHead(status, {
    "Content-Type": "text/plain; charset=utf-8",
    "Cache-Control": "no-store"
  });
  res.end(text);
}

function formatError(error) {
  const message = error && error.message ? error.message : "Error inesperado";
  const hint = message.includes("certificate") || message.includes("VERIFY")
    ? "Inicia el servidor con: node --use-system-ca server.js"
    : undefined;

  return {
    ok: false,
    error: message,
    hint
  };
}
