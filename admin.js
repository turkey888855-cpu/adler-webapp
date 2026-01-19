const BACKEND_URL = "https://adler-backend.onrender.com";

let adminToken = localStorage.getItem("admin_token") || "";

const statusEl = document.getElementById("status-indicator");
const errorEl = document.getElementById("admin-error");
const successEl = document.getElementById("admin-success");

function setStatus(text) {
  statusEl.textContent = text;
}
function showError(text) {
  errorEl.textContent = text;
  errorEl.classList.remove("hidden");
  successEl.classList.add("hidden");
}
function showSuccess(text) {
  successEl.textContent = text;
  successEl.classList.remove("hidden");
  errorEl.classList.add("hidden");
}

async function apiFetch(path, options = {}) {
  if (!adminToken) {
    adminToken = prompt("Введите admin token (значение ADMIN_TOKEN на сервере):") || "";
    localStorage.setItem("admin_token", adminToken);
  }

  const headers = options.headers || {};
  headers["X-Admin-Token"] = adminToken;
  if (!headers["Content-Type"]) {
    headers["Content-Type"] = "application/json";
  }

  try {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      ...options,
      headers,
    });
    if (res.status === 401) {
      localStorage.removeItem("admin_token");
      adminToken = "";
      setStatus("Неверный токен");
      throw new Error("Неавторизован (проверьте ADMIN_TOKEN)");
    }
    if (!res.ok) {
      const txt = await res.text();
      throw new Error(`Ошибка ${res.status}: ${txt}`);
    }
    setStatus("Подключено к API");
    if (res.status === 204) return null;
    return await res.json();
  } catch (e) {
    console.error("API error:", e);
    showError(e.message || "Ошибка запроса к серверу");
    throw e;
  }
}

// Переключение вкладок
document.querySelectorAll(".nav-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".nav-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    const tab = btn.dataset.tab;
    document.querySelectorAll(".tab").forEach(sec => {
      sec.classList.toggle("active", sec.id === `tab-${tab}`);
    });
  });
});

// Смена токена
document.getElementById("change-token-btn").addEventListener("click", () => {
  localStorage.removeItem("admin_token");
  adminToken = "";
  setStatus("Токен не задан");
});

// --- ТУРЫ ---

const toursListElAdmin = document.getElementById("tours-list");
const createTourForm = document.getElementById("create-tour-form");

async function loadToursAdmin() {
  toursListElAdmin.innerHTML = "Загрузка туров...";
  try {
    const tours = await apiFetch("/admin/tours");
    if (!tours.length) {
      toursListElAdmin.textContent = "Туров пока нет.";
      return;
    }
    toursListElAdmin.innerHTML = "";
    tours.forEach(tour => {
      const card = document.createElement("div");
      card.className = "card";

      const header = document.createElement("div");
      header.className = "card-header";
      header.innerHTML = `
        <div class="card-title">#${tour.id} — ${tour.title}</div>
        <div class="card-type">${tour.type}</div>
      `;

      const body = document.createElement("div");
      body.className = "card-body";
      body.innerHTML = `
        <div>Цена от: ${tour.price_from ?? "-"} ₽</div>
        <div>Длительность: ${tour.duration_hours ?? "-"} ч</div>
        <div>Описание: ${tour.description ?? ""}</div>
      `;

      const footer = document.createElement("div");
      footer.className = "card-footer";

      const editBtn = document.createElement("button");
      editBtn.className = "btn btn-primary";
      editBtn.textContent = "Редактировать";

      const toggleBtn = document.createElement("button");
      toggleBtn.className = "btn btn-outline";
      toggleBtn.textContent = "Скрыть / Показать";

      editBtn.addEventListener("click", () => openEditTourPrompt(tour));
      toggleBtn.addEventListener("click", async () => {
        try {
          await apiFetch(`/admin/tours/${tour.id}`, {
            method: "PATCH",
            body: JSON.stringify({ is_active: !tour.is_active }),
          });
          showSuccess("Тур обновлён");
          loadToursAdmin();
        } catch {}
      });

      footer.appendChild(editBtn);
      footer.appendChild(toggleBtn);

      card.appendChild(header);
      card.appendChild(body);
      card.appendChild(footer);

      toursListElAdmin.appendChild(card);
    });
  } catch {
    // showError уже показан
  }
}

createTourForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const title = document.getElementById("new-title").value.trim();
  const type = document.getElementById("new-type").value.trim();
  const price = document.getElementById("new-price").value || null;
  const duration = document.getElementById("new-duration").value || null;
  const description = document.getElementById("new-description").value.trim() || null;
  const is_active = document.getElementById("new-active").checked;

  if (!title || !type) {
    showError("Заполните хотя бы название и тип тура.");
    return;
  }

  try {
    await apiFetch("/admin/tours", {
      method: "POST",
      body: JSON.stringify({
        title,
        type,
        price_from: price ? Number(price) : null,
        duration_hours: duration ? Number(duration) : null,
        description,
        is_active,
      }),
    });
    showSuccess("Тур создан");
    createTourForm.reset();
    document.getElementById("new-active").checked = true;
    loadToursAdmin();
  } catch {}
});

async function openEditTourPrompt(tour) {
  const newTitle = prompt("Название тура", tour.title);
  if (newTitle === null) return;
  const newType = prompt("Тип (jeeping, yacht, excursion)", tour.type);
  if (newType === null) return;
  const newPrice = prompt("Цена от (₽)", tour.price_from ?? "");
  if (newPrice === null) return;
  const newDuration = prompt("Длительность (ч)", tour.duration_hours ?? "");
  if (newDuration === null) return;
  const newDescription = prompt("Описание", tour.description ?? "");
  if (newDescription === null) return;

  try {
    await apiFetch(`/admin/tours/${tour.id}`, {
      method: "PATCH",
      body: JSON.stringify({
        title: newTitle.trim(),
        type: newType.trim(),
        price_from: newPrice ? Number(newPrice) : null,
        duration_hours: newDuration ? Number(newDuration) : null,
        description: newDescription.trim(),
      }),
    });
    showSuccess("Тур обновлён");
    loadToursAdmin();
  } catch {}
}

// --- ЗАЯВКИ ---

const bookingsListEl = document.getElementById("bookings-list");
let currentStatusFilter = "";

async function loadBookingsAdmin() {
  bookingsListEl.innerHTML = "Загрузка заявок...";
  try {
    const qs = currentStatusFilter ? `?status=${currentStatusFilter}` : "";
    const bookings = await apiFetch(`/admin/bookings${qs}`);
    if (!bookings.length) {
      bookingsListEl.textContent = "Заявок пока нет.";
      return;
    }
    bookingsListEl.innerHTML = "";
    bookings.forEach(b => {
      const card = document.createElement("div");
      card.className = "card";

      const header = document.createElement("div");
      header.className = "card-header";
      header.innerHTML = `
        <div class="card-title">#${b.id} — ${b.tour_title}</div>
        <div class="card-type">${b.status}</div>
      `;

      const meta = document.createElement("div");
      meta.className = "booking-meta";
      meta.textContent =
        `${new Date(b.date_time).toLocaleString("ru-RU")} · ${b.people_count} чел.`;

      const body = document.createElement("div");
      body.className = "card-body";
      body.innerHTML = `
        <div><strong>Клиент:</strong> ${b.client_name} (${b.client_phone})</div>
        <div><strong>Комментарий:</strong> ${b.comment ?? "-"}</div>
      `;

      const footer = document.createElement("div");
      footer.className = "card-footer";

      ["confirmed", "done", "cancelled"].forEach(status => {
        const btn = document.createElement("button");
        btn.className = "btn btn-outline";
        btn.textContent =
          status === "confirmed" ? "Подтвердить" :
          status === "done" ? "Завершить" :
          "Отменить";
        btn.addEventListener("click", async () => {
          try {
            await apiFetch(`/admin/bookings/${b.id}`, {
              method: "PATCH",
              body: JSON.stringify({ status }),
            });
            showSuccess(`Статус #${b.id} → ${status}`);
            loadBookingsAdmin();
          } catch {}
        });
        footer.appendChild(btn);
      });

      card.appendChild(header);
      card.appendChild(meta);
      card.appendChild(body);
      card.appendChild(footer);

      bookingsListEl.appendChild(card);
    });
  } catch {}
}

document.querySelectorAll(".filter-btn").forEach(btn => {
  btn.addEventListener("click", () => {
    document.querySelectorAll(".filter-btn").forEach(b => b.classList.remove("active"));
    btn.classList.add("active");
    currentStatusFilter = btn.dataset.status || "";
    loadBookingsAdmin();
  });
});

// --- СТАРТ ---

(async function init() {
  if (adminToken) {
    setStatus("Токен задан, подключение...");
  } else {
    setStatus("Токен не задан");
  }
  await loadToursAdmin();
  await loadBookingsAdmin();
})();
