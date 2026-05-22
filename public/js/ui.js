import { formatDate, money } from "./utils.js";

const modalRoot = document.querySelector("#modal-root");
const toastRoot = document.querySelector("#toast-root");

export function initUI() {
  modalRoot.addEventListener("click", (event) => {
    if (event.target.matches("[data-close-modal], .modal-backdrop")) closeModal();
  });
}

export function toast(message, tone = "info") {
  const node = document.createElement("div");
  node.className = `toast ${tone}`;
  node.textContent = message;
  toastRoot.append(node);
  setTimeout(() => node.remove(), 2600);
}

export function closeModal() {
  modalRoot.innerHTML = "";
}

export function openSaleModal(category, onSubmit) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop"></div>
    <section class="modal-panel sale-modal" role="dialog" aria-modal="true">
      <header>
        <span class="eyebrow">${category.nombre}</span>
        <strong>${category.prefijo}${category.contador}</strong>
      </header>
      <form id="sale-form">
        <label>
          Precio
          <input id="sale-price" name="precio" inputmode="numeric" autocomplete="off" required placeholder="12990" />
        </label>
        <label>
          Cliente
          <input id="sale-client" name="cliente" autocomplete="off" required placeholder="Nombre o alias" />
        </label>
        <label>
          Descuento
          <input name="descuento" inputmode="numeric" autocomplete="off" value="0" />
        </label>
        <div class="modal-actions">
          <button class="secondary-button" type="button" data-close-modal>Cancelar</button>
          <button class="primary-button" type="submit">Guardar venta</button>
        </div>
      </form>
    </section>
  `;
  const form = modalRoot.querySelector("#sale-form");
  modalRoot.querySelector("#sale-price").focus();
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const data = new FormData(form);
    await onSubmit({
      precio: Number(String(data.get("precio")).replace(/\D/g, "")),
      clienteNombre: data.get("cliente"),
      descuento: Number(String(data.get("descuento")).replace(/\D/g, ""))
    });
  });
}

export function openLabelModal({ live, category, client, pedido, item }, onPrint) {
  modalRoot.innerHTML = `
    <div class="modal-backdrop"></div>
    <section class="modal-panel label-modal" role="dialog" aria-modal="true">
      <div class="label-preview">
        <span>${formatDate(live.fecha)}</span>
        <strong>${item.code}</strong>
        <span>${client.nombre}</span>
        <span>${String(item.ordinalCliente).padStart(2, "0")}/__</span>
        <b>${money(pedido.total)}</b>
      </div>
      <div class="modal-actions">
        <button class="secondary-button" type="button" data-close-modal>Listo</button>
        <button class="primary-button" id="btn-print-label" type="button">Imprimir mock</button>
      </div>
    </section>
  `;
  modalRoot.querySelector("#btn-print-label").addEventListener("click", onPrint);
}
