import { exportBackup } from "./backup.js";
import { createSale, getDashboardData, logPrint, updatePedidoEstado } from "./live.js";
import { flushSync } from "./sync.js";
import { closeModal, openLabelModal, openSaleModal, toast } from "./ui.js";
import { minutesSince, money } from "./utils.js";

const container = document.querySelector("#view-container");
const routes = {
  home: renderHome,
  clientes: renderClientes,
  paquetes: renderPaquetes,
  reportes: renderReportes
};

let currentRoute = "home";

export function initRouter() {
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.addEventListener("click", () => navigate(button.dataset.route));
  });
  document.querySelector("#btn-backup").addEventListener("click", async () => {
    const data = await getDashboardData();
    await exportBackup("manual", data.live?.id || null);
    toast("Backup exportado y guardado localmente", "success");
  });
  navigate("home");
}

export async function navigate(route = currentRoute) {
  currentRoute = route;
  const data = await getDashboardData();
  document.querySelector("#live-status").textContent = data.live
    ? `Live activo ${data.live.fecha} · ${data.pedidos.length} ventas`
    : "Sin live activo";
  document.querySelectorAll("[data-route]").forEach((button) => {
    button.classList.toggle("active", button.dataset.route === route);
  });
  container.innerHTML = await routes[route](data);
  bindRoute(route, data);
  container.focus({ preventScroll: true });
}

async function renderHome({ categorias, pedidos, items }) {
  const latest = [...items].sort((a, b) => b.createdAt.localeCompare(a.createdAt)).slice(0, 5);
  return `
    <section class="view home-view">
      <div class="section-head">
        <div>
          <span class="eyebrow">Venta agil</span>
          <h2>Toca categoria, precio, cliente, listo.</h2>
        </div>
        <button class="sync-button" id="btn-sync" type="button">Sync</button>
      </div>
      <div class="category-grid">
        ${categorias.map((category) => `
          <button class="category-card" data-category="${category.id}" style="--accent:${category.color}" type="button">
            <span>${iconFor(category.icono)}</span>
            <h3>${category.nombre}</h3>
            <small>${category.prefijo}${category.contador}</small>
          </button>
        `).join("")}
      </div>
      <div class="recent-panel">
        <h3>Ultimas ventas</h3>
        ${latest.length ? latest.map((item) => renderRecentItem(item, pedidos)).join("") : `<p class="empty">Aun no hay ventas en este live.</p>`}
      </div>
    </section>
  `;
}

function renderClientes({ clientes, pedidos }) {
  const rows = clientes
    .sort((a, b) => a.nombre.localeCompare(b.nombre))
    .map((client) => {
      const clientPedidos = pedidos.filter((pedido) => pedido.clienteId === client.id);
      const total = clientPedidos.reduce((sum, pedido) => sum + pedido.total, 0);
      return `
        <article class="list-row">
          <div>
            <strong>${client.nombre}</strong>
            <span>${client.alias || "sin alias"} · ${clientPedidos.length} pedidos</span>
          </div>
          <b>${money(total)}</b>
        </article>
      `;
    }).join("");
  return `
    <section class="view">
      <div class="section-head">
        <div>
          <span class="eyebrow">Clientes</span>
          <h2>Historial rapido</h2>
        </div>
      </div>
      <div class="list-panel">${rows || `<p class="empty">Los clientes aparecen al vender.</p>`}</div>
    </section>
  `;
}

function renderPaquetes({ pedidos, clientes, items }) {
  const states = [
    ["pendiente_pago", "Pendiente pago"],
    ["pagado", "Pagado"],
    ["empacado", "Empacado"],
    ["despachado", "Despachado"],
    ["cancelado", "Cancelado"]
  ];
  return `
    <section class="view">
      <div class="section-head">
        <div>
          <span class="eyebrow">Post-live</span>
          <h2>Paquetes y pagos</h2>
        </div>
      </div>
      <div class="kanban">
        ${states.map(([state, label]) => `
          <section class="kanban-column">
            <h3>${label}</h3>
            ${pedidos.filter((pedido) => pedido.estado === state).map((pedido) => renderPedidoCard(pedido, clientes, items)).join("") || `<p class="empty">Sin pedidos</p>`}
          </section>
        `).join("")}
      </div>
    </section>
  `;
}

function renderReportes({ pedidos, items, categorias, clientes }) {
  const total = pedidos.reduce((sum, pedido) => sum + pedido.total, 0);
  const pending = pedidos.filter((pedido) => pedido.estado === "pendiente_pago").reduce((sum, pedido) => sum + pedido.total, 0);
  const ticket = pedidos.length ? Math.round(total / pedidos.length) : 0;
  const byCategory = categorias.map((category) => {
    const categoryItems = items.filter((item) => item.categoriaId === category.id);
    return `<article class="metric-row"><span>${category.nombre}</span><b>${categoryItems.length}</b></article>`;
  }).join("");
  return `
    <section class="view">
      <div class="section-head">
        <div>
          <span class="eyebrow">Analisis</span>
          <h2>Resumen del live</h2>
        </div>
      </div>
      <div class="metrics-grid">
        <article><span>Ventas</span><strong>${pedidos.length}</strong></article>
        <article><span>Total</span><strong>${money(total)}</strong></article>
        <article><span>Pendiente</span><strong>${money(pending)}</strong></article>
        <article><span>Ticket</span><strong>${money(ticket)}</strong></article>
      </div>
      <div class="list-panel">
        <h3>Por categoria</h3>
        ${byCategory}
        <article class="metric-row"><span>Clientes</span><b>${clientes.length}</b></article>
      </div>
    </section>
  `;
}

function bindRoute(route, data) {
  if (route === "home") {
    container.querySelectorAll("[data-category]").forEach((button) => {
      button.addEventListener("click", () => {
        const category = data.categorias.find((item) => item.id === button.dataset.category);
        openSaleModal(category, async (formData) => {
          try {
            const sale = await createSale({ categoriaId: category.id, ...formData });
            closeModal();
            openLabelModal(sale, async () => {
              await logPrint(sale.item.id);
              toast("Impresion mock registrada", "success");
            });
            await navigate("home");
          } catch (error) {
            toast(error.message, "error");
          }
        });
      });
    });
    container.querySelector("#btn-sync")?.addEventListener("click", async () => {
      try {
        const result = await flushSync();
        toast(`Sync listo: ${result.sent} eventos`, "success");
      } catch {
        toast("Sin backend disponible. Queda en cola.", "info");
      }
    });
  }

  if (route === "paquetes") {
    container.querySelectorAll("[data-next-state]").forEach((button) => {
      button.addEventListener("click", async () => {
        await updatePedidoEstado(button.dataset.pedido, button.dataset.nextState);
        await navigate("paquetes");
      });
    });
  }
}

function renderRecentItem(item, pedidos) {
  const pedido = pedidos.find((entry) => entry.id === item.pedidoId);
  return `
    <article class="recent-item">
      <strong>${item.code}</strong>
      <span>${money(pedido?.total || item.precio)} · ${item.estado}</span>
    </article>
  `;
}

function renderPedidoCard(pedido, clientes, items) {
  const client = clientes.find((entry) => entry.id === pedido.clienteId);
  const codes = items.filter((item) => item.pedidoId === pedido.id).map((item) => item.code).join(", ");
  const next = nextState(pedido.estado);
  return `
    <article class="pedido-card">
      <strong>${client?.nombre || "Cliente"}</strong>
      <span>${codes} · ${money(pedido.total)}</span>
      <small>${minutesSince(pedido.createdAt)}</small>
      ${next ? `<button data-pedido="${pedido.id}" data-next-state="${next.value}" type="button">${next.label}</button>` : ""}
    </article>
  `;
}

function nextState(state) {
  return {
    pendiente_pago: { value: "pagado", label: "Marcar pagado" },
    pagado: { value: "empacado", label: "Empacar" },
    empacado: { value: "despachado", label: "Despachar" }
  }[state];
}

function iconFor(icon) {
  return { shirt: "TS", pants: "JN", jacket: "CQ", hoodie: "PL", bag: "AC" }[icon] || "LC";
}
