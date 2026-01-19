document.addEventListener("DOMContentLoaded", () => {
    // === КОНФИГУРАЦИЯ ===
    const BACKEND_URL = "https://adler-backend.onrender.com";
    let adminToken = localStorage.getItem("admin_token") || "";

    // === ЭЛЕМЕНТЫ ===
    const statusEl = document.getElementById("status-indicator");
    const errorEl = document.getElementById("admin-error");
    const successEl = document.getElementById("admin-success");
    
    // === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
    function setStatus(text) {
        if(statusEl) statusEl.textContent = text;
        console.log("Status:", text);
    }

    function showToast(el, text, isErr) {
        if(!el) return;
        el.textContent = text;
        el.classList.remove("hidden");
        setTimeout(() => el.classList.add("hidden"), 4000);
    }
    
    function showError(text) { showToast(errorEl, text, true); }
    function showSuccess(text) { showToast(successEl, text, false); }

    // Визуальное отображение имени файла при выборе
    const fileInput = document.getElementById('new-image');
    if(fileInput) {
        fileInput.addEventListener('change', (e) => {
            const fileName = e.target.files[0] ? e.target.files[0].name : "Файл не выбран";
            const label = document.getElementById('file-name');
            if(label) label.textContent = fileName;
        });
    }

    // === API FETCH (ГЛАВНАЯ ФУНКЦИЯ) ===
    async function apiFetch(path, options = {}) {
        if (!adminToken) {
            adminToken = prompt("Введите ADMIN_TOKEN:") || "";
            if(adminToken) localStorage.setItem("admin_token", adminToken);
        }

        const headers = options.headers || {};
        headers["X-Admin-Token"] = adminToken;

        // ИСПРАВЛЕНИЕ: Если отправляем FormData (файл), НЕ ставим Content-Type.
        // Если отправляем JSON, ставим application/json.
        if (!(options.body instanceof FormData)) {
            if (!headers["Content-Type"]) {
                headers["Content-Type"] = "application/json";
            }
        }

        try {
            const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
            
            if (res.status === 401) {
                localStorage.removeItem("admin_token");
                setStatus("Токен неверный");
                showError("Ошибка авторизации. Обновите страницу.");
                throw new Error("Unauthorized");
            }

            // Получаем текст ответа
            const text = await res.text();
            
            if (!res.ok) {
                // Пытаемся понять ошибку
                throw new Error(text || `Ошибка ${res.status}`);
            }

            setStatus("API OK");
            if (!text) return null; // Пустой ответ

            try {
                return JSON.parse(text);
            } catch (e) {
                return text;
            }
        } catch (e) {
            console.error(e);
            if (e.message.includes("Failed to fetch")) {
                showError("Ошибка сети! Сервер Render спит или блокирует запрос. Подождите 1 минуту.");
            } else {
                showError(e.message);
            }
            throw e;
        }
    }

    // === ТУРЫ ===
    const toursListEl = document.getElementById("tours-list");

    async function loadTours() {
        if (!toursListEl) return;
        toursListEl.innerHTML = '<div style="padding:20px; color:#888;">Загрузка...</div>';
        
        try {
            const tours = await apiFetch("/admin/tours");
            toursListEl.innerHTML = "";

            if (!Array.isArray(tours) || tours.length === 0) {
                toursListEl.innerHTML = '<div style="padding:20px;">Список пуст.</div>';
                return;
            }

            tours.forEach(tour => {
                const card = document.createElement("div");
                card.className = "card";
                
                // Картинка или заглушка
                const imgUrl = tour.image_url || tour.image || 'https://via.placeholder.com/60?text=IMG';
                const isActive = tour.is_active;

                card.innerHTML = `
                    <div class="tour-card-header">
                        <img src="${imgUrl}" class="tour-image" alt="Tour" onerror="this.src='https://via.placeholder.com/60?text=Err'">
                        <div class="tour-info">
                            <span class="tour-title">${tour.title}</span>
                            <span class="tour-badge ${isActive ? 'badge-active' : 'badge-hidden'}">
                                ${isActive ? 'Активен' : 'Скрыт'}
                            </span>
                            <div style="color:#888; font-size:13px; margin-top:4px;">
                                ${tour.type} • ${tour.price_from} ₽
                            </div>
                        </div>
                    </div>
                    <div class="tour-actions">
                         <button class="btn-text edit-btn" data-json='${JSON.stringify(tour).replace(/'/g, "&apos;")}'>
                            ✎ Редактировать
                         </button>
                         <button class="btn-text toggle-btn" data-id="${tour.id}" data-active="${isActive}">
                            ${isActive ? '👁 Скрыть' : '👁 Показать'}
                         </button>
                    </div>
                `;
                toursListEl.appendChild(card);
            });
        } catch (e) {
            // Ошибка уже показана через showError
        }
    }

    // Делегирование событий (чтобы кнопки работали всегда)
    if (toursListEl) {
        toursListEl.addEventListener("click", async (e) => {
            // Кнопка Скрыть/Показать
            if (e.target.closest(".toggle-btn")) {
                const btn = e.target.closest(".toggle-btn");
                const id = btn.dataset.id;
                const active = btn.dataset.active === "true";
                try {
                    await apiFetch(`/admin/tours/${id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ is_active: !active })
                    });
                    loadTours();
                    showSuccess(`Статус обновлен`);
                } catch (err) {}
            }
            
            // Кнопка Редактировать
            if (e.target.closest(".edit-btn")) {
                const btn = e.target.closest(".edit-btn");
                try {
                    const data = JSON.parse(btn.dataset.json);
                    openEditModal(data);
                } catch (err) { console.error(err); }
            }
        });
    }

    // СОЗДАНИЕ ТУРА (ГЛАВНАЯ ФОРМА)
    const createForm = document.getElementById("create-tour-form");
    if (createForm) {
        createForm.addEventListener("submit", async (e) => {
            e.preventDefault();

            const title = document.getElementById("new-title").value;
            const price = document.getElementById("new-price").value;
            const type = document.getElementById("new-type").value;
            const desc = document.getElementById("new-description").value;
            const active = document.getElementById("new-active").checked;
            const file = document.getElementById("new-image").files[0];

            try {
                // ЛОГИКА ОТПРАВКИ:
                // Если есть файл -> отправляем FormData
                // Если нет файла -> отправляем JSON
                let body;
                if (file) {
                    const fd = new FormData();
                    fd.append('title', title);
                    fd.append('price_from', price);
                    fd.append('type', type);
                    fd.append('description', desc);
                    fd.append('is_active', active);
                    fd.append('image', file); // Важно: имя поля 'image'
                    body = fd;
                } else {
                    body = JSON.stringify({
                        title, price_from: Number(price), type, description: desc, is_active: active
                    });
                }

                await apiFetch("/admin/tours", { method: "POST", body: body });

                showSuccess("Тур создан!");
                createForm.reset();
                document.getElementById('file-name').textContent = "Файл не выбран";
                loadTours();
            } catch (err) {
                // Ошибка покажется в showError
            }
        });
    }

    // === МОДАЛЬНОЕ ОКНО ===
    const modal = document.getElementById("tour-modal");
    const editForm = document.getElementById("edit-tour-form");

    function openEditModal(tour) {
        document.getElementById("edit-id").value = tour.id;
        document.getElementById("edit-title").value = tour.title;
        document.getElementById("edit-type").value = tour.type;
        document.getElementById("edit-price").value = tour.price_from;
        document.getElementById("edit-description").value = tour.description || "";
        modal.classList.remove("hidden");
    }

    document.getElementById("modal-cancel-btn").addEventListener("click", () => modal.classList.add("hidden"));
    document.querySelector(".modal-backdrop").addEventListener("click", () => modal.classList.add("hidden"));

    if (editForm) {
        editForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const id = document.getElementById("edit-id").value;
            const data = {
                title: document.getElementById("edit-title").value,
                type: document.getElementById("edit-type").value,
                price_from: Number(document.getElementById("edit-price").value),
                description: document.getElementById("edit-description").value
            };
            try {
                await apiFetch(`/admin/tours/${id}`, { method: "PATCH", body: JSON.stringify(data) });
                showSuccess("Тур обновлен");
                modal.classList.add("hidden");
                loadTours();
            } catch (e) {}
        });
    }

    // === ЗАЯВКИ ===
    const bookingsListEl = document.getElementById("bookings-list");
    async function loadBookings(filter = "") {
        if (!bookingsListEl) return;
        bookingsListEl.innerHTML = '<div style="color:#888;">Загрузка...</div>';
        try {
            const url = filter ? `/admin/bookings?status=${filter}` : `/admin/bookings`;
            const bookings = await apiFetch(url);
            bookingsListEl.innerHTML = "";
            if (!Array.isArray(bookings) || bookings.length === 0) {
                bookingsListEl.innerHTML = "Нет заявок.";
                return;
            }
            bookings.forEach(b => {
                const el = document.createElement("div");
                el.className = "card";
                el.style.padding = "20px";
                el.innerHTML = `
                    <div style="display:flex; justify-content:space-between;">
                        <strong>#${b.id} ${b.tour_title || ''}</strong>
                        <span style="font-weight:bold;">${b.status}</span>
                    </div>
                    <div style="margin:10px 0; color:#555; font-size:14px;">
                        ${b.client_name} (${b.client_phone})
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn-text" style="color:green;" onclick="window.updB(${b.id}, 'confirmed')">✔ Подтвердить</button>
                        <button class="btn-text" style="color:red;" onclick="window.updB(${b.id}, 'cancelled')">✖ Отменить</button>
                    </div>
                `;
                bookingsListEl.appendChild(el);
            });
        } catch (e) {}
    }

    window.updB = async (id, status) => {
        try {
            await apiFetch(`/admin/bookings/${id}`, { method: "PATCH", body: JSON.stringify({status}) });
            loadBookings(document.querySelector(".filter-chip.active").dataset.status);
        } catch (e) {}
    };

    document.querySelectorAll(".filter-chip").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            loadBookings(btn.dataset.status);
        });
    });

    // === НАВИГАЦИЯ ===
    const navItems = document.querySelectorAll(".nav-item");
    const views = document.querySelectorAll(".view");

    navItems.forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.hasAttribute("disabled")) return;
            navItems.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            const viewId = btn.dataset.view;
            views.forEach(v => {
                v.classList.remove("active");
                if (v.id === `view-${viewId}`) v.classList.add("active");
            });

            if (viewId === "tours") loadTours();
            if (viewId === "bookings") loadBookings();
        });
    });
    
    // Смена темы
    document.getElementById("theme-toggle")?.addEventListener("click", () => {
        const b = document.body;
        if(b.classList.contains("theme-light")) {
            b.className = "theme-dark";
        } else {
            b.className = "theme-light";
        }
    });

    // === ИНИЦИАЛИЗАЦИЯ ===
    if (adminToken) {
        setStatus("Ready");
        loadTours();
    } else {
        setStatus("No Token");
    }
});
