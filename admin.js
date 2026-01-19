document.addEventListener("DOMContentLoaded", () => {
    // 1. НАСТРОЙКИ
    const BACKEND_URL = "https://adler-backend.onrender.com"; 
    let adminToken = localStorage.getItem("admin_token") || "";

    // 2. ЭЛЕМЕНТЫ DOM
    const statusEl = document.getElementById("status-indicator");
    const errorEl = document.getElementById("admin-error");
    const successEl = document.getElementById("admin-success");
    
    const toursListEl = document.getElementById("tours-list");
    const bookingsListEl = document.getElementById("bookings-list");
    
    // Модальное окно
    const modal = document.getElementById("tour-modal");
    const modalBackdrop = document.querySelector(".modal-backdrop");
    const modalCancelBtn = document.getElementById("modal-cancel-btn");
    const editForm = document.getElementById("edit-tour-form");

    // 3. УТИЛИТЫ
    function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
        console.log(`[STATUS]: ${text}`);
    }

    function showToast(element, text, isError = false) {
        if (!element) return;
        element.textContent = text;
        element.classList.remove("hidden");
        console.log(isError ? `[ERROR]: ${text}` : `[SUCCESS]: ${text}`);
        
        // Скрываем через 4 секунды
        setTimeout(() => element.classList.add("hidden"), 4000);
    }
    
    function showError(text) { showToast(errorEl, text, true); }
    function showSuccess(text) { showToast(successEl, text, false); }

    // Визуальное отображение имени файла
    const fileInput = document.getElementById('new-image');
    if(fileInput) {
        fileInput.addEventListener('change', (e) => {
            const fileName = e.target.files[0] ? e.target.files[0].name : "Файл не выбран";
            const label = document.getElementById('file-name');
            if(label) label.textContent = fileName;
        });
    }

    // 4. API FETCH (ЯДРО ЗАПРОСОВ)
    async function apiFetch(path, options = {}) {
        if (!adminToken) {
            adminToken = prompt("Введите ADMIN_TOKEN (пароль администратора):") || "";
            if(adminToken) localStorage.setItem("admin_token", adminToken);
        }

        const headers = options.headers || {};
        headers["X-Admin-Token"] = adminToken;

        // ВАЖНО: Если отправляем JSON, ставим Content-Type.
        // Если отправляем FormData (фото), браузер сам поставит Boundary, вручную ставить НЕЛЬЗЯ.
        if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }

        try {
            const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
            
            // Если токен протух
            if (res.status === 401) {
                localStorage.removeItem("admin_token");
                adminToken = "";
                setStatus("Ошибка: Неверный токен");
                showError("Неверный токен. Обновите страницу.");
                throw new Error("Unauthorized");
            }

            // Читаем ответ
            const text = await res.text();
            
            if (!res.ok) {
                throw new Error(text || `Ошибка сервера: ${res.status}`);
            }
            
            setStatus("API Connected");
            if (res.status === 204 || !text) return null;
            
            try {
                return JSON.parse(text);
            } catch (e) {
                return text; // Если сервер вернул просто текст
            }

        } catch (e) {
            console.error("API Error:", e);
            showError(e.message);
            throw e;
        }
    }

    // 5. ЛОГИКА ТУРОВ
    async function loadTours() {
        if (!toursListEl) return;
        toursListEl.innerHTML = '<div style="padding:20px; color:#888;">Загрузка туров...</div>';
        
        try {
            const tours = await apiFetch("/admin/tours");
            toursListEl.innerHTML = "";
            
            if (!Array.isArray(tours) || tours.length === 0) {
                toursListEl.innerHTML = '<div style="padding:20px;">Список туров пуст.</div>';
                return;
            }

            tours.forEach(tour => {
                const card = document.createElement("div");
                card.className = "card";
                
                // Картинка: если нет, ставим заглушку
                const imgUrl = tour.image_url || tour.image || 'https://via.placeholder.com/60?text=No+Img';
                const isActive = tour.is_active; 
                
                card.innerHTML = `
                    <div class="tour-card-header">
                        <img src="${imgUrl}" class="tour-image" alt="img" onerror="this.src='https://via.placeholder.com/60?text=Error'">
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
                        <!-- Используем data-атрибуты для передачи данных -->
                        <button class="btn-text action-btn edit-btn" data-json='${JSON.stringify(tour).replace(/'/g, "&apos;")}'>
                            ✎ Редактировать
                        </button>
                        <button class="btn-text action-btn toggle-btn" data-id="${tour.id}" data-active="${isActive}">
                            ${isActive ? '👁 Скрыть' : '👁 Показать'}
                        </button>
                    </div>
                `;
                toursListEl.appendChild(card);
            });
        } catch (e) {
            // Ошибка уже показана в apiFetch
        }
    }

    // Обработка кликов по кнопкам (ДЕЛЕГИРОВАНИЕ)
    // Это чинит проблему "кнопки не работают"
    if (toursListEl) {
        toursListEl.addEventListener("click", async (e) => {
            const btn = e.target.closest(".action-btn");
            if (!btn) return;

            // Кнопка Скрыть/Показать
            if (btn.classList.contains("toggle-btn")) {
                const id = btn.dataset.id;
                const currentActive = btn.dataset.active === "true";
                try {
                    await apiFetch(`/admin/tours/${id}`, {
                        method: "PATCH",
                        body: JSON.stringify({ is_active: !currentActive })
                    });
                    showSuccess(`Статус тура #${id} обновлен`);
                    loadTours();
                } catch (err) { console.error(err); }
            }

            // Кнопка Редактировать
            if (btn.classList.contains("edit-btn")) {
                try {
                    const tourData = JSON.parse(btn.dataset.json);
                    openEditModal(tourData);
                } catch(err) {
                    console.error("Ошибка парсинга данных тура", err);
                }
            }
        });
    }

    // Создание тура (Форма)
    const createForm = document.getElementById("create-tour-form");
    if (createForm) {
        createForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            const title = document.getElementById("new-title").value;
            const price = document.getElementById("new-price").value;
            const type = document.getElementById("new-type").value;
            const description = document.getElementById("new-description").value;
            const isActive = document.getElementById("new-active").checked;
            const file = document.getElementById("new-image").files[0];

            try {
                let body;
                
                // СТРАТЕГИЯ ОТПРАВКИ:
                // Если файл есть -> отправляем FormData
                // Если файла нет -> отправляем JSON (для надежности)
                
                if (file) {
                    const fd = new FormData();
                    fd.append('title', title);
                    fd.append('price_from', price);
                    fd.append('type', type);
                    fd.append('description', description);
                    fd.append('is_active', isActive);
                    fd.append('image', file); // 'image' - имя поля на бэкенде
                    body = fd;
                } else {
                    body = JSON.stringify({
                        title, 
                        price_from: Number(price), 
                        type, 
                        description, 
                        is_active: isActive
                    });
                }

                await apiFetch("/admin/tours", {
                    method: "POST",
                    body: body
                });

                showSuccess("Тур успешно создан!");
                createForm.reset();
                if(document.getElementById('file-name')) 
                    document.getElementById('file-name').textContent = "Файл не выбран";
                loadTours();

            } catch (err) {
                // Ошибка уже показана
            }
        });
    }

    // 6. МОДАЛЬНОЕ ОКНО (РЕДАКТИРОВАНИЕ)
    function openEditModal(tour) {
        if(!modal) return;
        document.getElementById("edit-id").value = tour.id;
        document.getElementById("edit-title").value = tour.title || "";
        document.getElementById("edit-type").value = tour.type || "";
        document.getElementById("edit-price").value = tour.price_from || "";
        document.getElementById("edit-description").value = tour.description || "";
        
        modal.classList.remove("hidden");
    }

    function closeModal() {
        if(modal) modal.classList.add("hidden");
    }

    if (modalBackdrop) modalBackdrop.addEventListener("click", closeModal);
    if (modalCancelBtn) modalCancelBtn.addEventListener("click", closeModal);

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
                await apiFetch(`/admin/tours/${id}`, {
                    method: "PATCH",
                    body: JSON.stringify(data)
                });
                showSuccess("Тур обновлен");
                closeModal();
                loadTours();
            } catch (e) {
                // Ошибка показана
            }
        });
    }

    // 7. ЗАЯВКИ (BOOKINGS)
    async function loadBookings(filter = "") {
        if (!bookingsListEl) return;
        bookingsListEl.innerHTML = '<div style="color:#888;">Загрузка заявок...</div>';
        
        try {
            const qs = filter ? `?status=${filter}` : "";
            const bookings = await apiFetch(`/admin/bookings${qs}`);
            bookingsListEl.innerHTML = "";

            if (!Array.isArray(bookings) || bookings.length === 0) {
                bookingsListEl.innerHTML = "Нет заявок.";
                return;
            }

            bookings.forEach(b => {
                const el = document.createElement("div");
                el.className = "card";
                el.style.padding = "15px";
                el.style.borderLeft = `4px solid ${getStatusColor(b.status)}`;
                
                el.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                        <strong>#${b.id} ${b.tour_title || 'Тур удален'}</strong>
                        <span style="font-size:12px; font-weight:bold; color:#555;">${translateStatus(b.status)}</span>
                    </div>
                    <div style="font-size:13px; color:#555; margin-bottom:10px;">
                        <div>👤 ${b.client_name}</div>
                        <div>📞 ${b.client_phone}</div>
                        <div>📅 ${new Date(b.date_time).toLocaleString()}</div>
                    </div>
                    <div style="display:flex; gap:8px;">
                        <button class="btn-text" style="color:#059669;" onclick="window.updateBooking(${b.id}, 'confirmed')">✔ Подтвердить</button>
                        <button class="btn-text" style="color:#DC2626;" onclick="window.updateBooking(${b.id}, 'cancelled')">✖ Отменить</button>
                    </div>
                `;
                bookingsListEl.appendChild(el);
            });
        } catch (e) {}
    }

    // Глобальная функция для кнопок заявок (упрощенный вариант)
    window.updateBooking = async (id, status) => {
        try {
            await apiFetch(`/admin/bookings/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ status })
            });
            showSuccess(`Заявка #${id}: ${status}`);
            // Обновляем текущий вид
            const activeFilter = document.querySelector(".filter-chip.active");
            loadBookings(activeFilter ? activeFilter.dataset.status : "");
        } catch (e) {}
    };

    function getStatusColor(s) {
        if(s === 'confirmed') return '#10B981';
        if(s === 'cancelled') return '#EF4444';
        if(s === 'done') return '#3B82F6';
        return '#F59E0B'; // new
    }
    
    function translateStatus(s) {
        const dict = { 'new': 'Новая', 'confirmed': 'Подтверждена', 'done': 'Завершена', 'cancelled': 'Отменена' };
        return dict[s] || s;
    }

    // Фильтры заявок
    document.querySelectorAll(".filter-chip").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            loadBookings(btn.dataset.status);
        });
    });

    // 8. НАВИГАЦИЯ МЕНЮ
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

    // Кнопка смены токена
    document.getElementById("change-token-btn")?.addEventListener("click", () => {
        localStorage.removeItem("admin_token");
        location.reload();
    });
    
    // Кнопка смены темы
    const themeBtn = document.getElementById("theme-toggle");
    if(themeBtn) {
        themeBtn.addEventListener("click", () => {
            const b = document.body;
            if(b.classList.contains("theme-dark")) {
                b.classList.remove("theme-dark");
                b.classList.add("theme-light");
            } else {
                b.classList.remove("theme-light");
                b.classList.add("theme-dark");
            }
        });
    }

    // 9. ИНИЦИАЛИЗАЦИЯ
    if(adminToken) {
        setStatus("Token Loaded");
        loadTours(); // Загружаем сразу
    } else {
        setStatus("No Token");
    }
});
