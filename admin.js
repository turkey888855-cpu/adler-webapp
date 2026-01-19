document.addEventListener("DOMContentLoaded", () => {
    const BACKEND_URL = "https://adler-backend.onrender.com"; // Убедитесь, что адрес верный
    let adminToken = localStorage.getItem("admin_token") || "";

    // Элементы интерфейса
    const statusEl = document.getElementById("status-indicator");
    const errorEl = document.getElementById("admin-error");
    const successEl = document.getElementById("admin-success");
    
    // Модальное окно
    const modal = document.getElementById("tour-modal");
    const modalBackdrop = document.querySelector(".modal-backdrop");
    const modalCancelBtn = document.getElementById("modal-cancel-btn");
    const editForm = document.getElementById("edit-tour-form");

    // --- УТИЛИТЫ ---
    function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
    }

    function showToast(element, text) {
        if (!element) return;
        element.textContent = text;
        element.classList.remove("hidden");
        setTimeout(() => element.classList.add("hidden"), 3000);
    }
    
    function showError(text) { showToast(errorEl, text); }
    function showSuccess(text) { showToast(successEl, text); }

    // Логика input type file (визуальная)
    const fileInput = document.getElementById('new-image');
    if(fileInput) {
        fileInput.addEventListener('change', (e) => {
            const fileName = e.target.files[0] ? e.target.files[0].name : "Файл не выбран";
            document.getElementById('file-name').textContent = fileName;
        });
    }

    // --- API ЗАПРОСЫ ---
    async function apiFetch(path, options = {}) {
        if (!adminToken) {
            adminToken = prompt("Введите ADMIN_TOKEN:") || "";
            localStorage.setItem("admin_token", adminToken);
        }

        const headers = options.headers || {};
        headers["X-Admin-Token"] = adminToken;

        // Если отправляем FormData (фото), Content-Type выставляется браузером автоматически
        // Если отправляем JSON, нужно явно указать
        if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }

        try {
            const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
            
            if (res.status === 401) {
                localStorage.removeItem("admin_token");
                adminToken = "";
                setStatus("Ошибка авторизации");
                throw new Error("Неверный токен");
            }
            if (!res.ok) {
                const txt = await res.text();
                throw new Error(txt || `Ошибка ${res.status}`);
            }
            
            setStatus("API: OK");
            if (res.status === 204) return null;
            return await res.json();
        } catch (e) {
            console.error(e);
            showError(e.message);
            throw e;
        }
    }

    // --- ФУНКЦИИ ТУРОВ ---
    const toursListEl = document.getElementById("tours-list");
    const createTourForm = document.getElementById("create-tour-form");

    async function loadTours() {
        if (!toursListEl) return;
        toursListEl.innerHTML = '<div style="color:#888;">Загрузка списка...</div>';
        
        try {
            const tours = await apiFetch("/admin/tours");
            toursListEl.innerHTML = "";
            
            if (!tours || tours.length === 0) {
                toursListEl.innerHTML = "Туров пока нет.";
                return;
            }

            tours.forEach(tour => {
                const card = document.createElement("div");
                card.className = "card";
                
                // Проверяем, есть ли картинка (image_url или photo)
                const imgUrl = tour.image_url || tour.image || 'https://via.placeholder.com/60?text=No+Img';
                const statusClass = tour.is_active ? 'badge-active' : 'badge-hidden';
                const statusText = tour.is_active ? 'Активен' : 'Скрыт';

                card.innerHTML = `
                    <div class="tour-card-header">
                        <img src="${imgUrl}" class="tour-image" alt="Tour">
                        <div class="tour-info">
                            <span class="tour-title">${tour.title}</span>
                            <span class="tour-badge ${statusClass}">${statusText}</span>
                            <div style="color:#888; font-size:13px; margin-top:4px;">
                                ${tour.type} • от ${tour.price_from} ₽
                            </div>
                        </div>
                    </div>
                    <div class="tour-actions">
                        <button class="btn-text btn-edit" data-id="${tour.id}">✎ Редактировать</button>
                        <button class="btn-text btn-toggle" data-id="${tour.id}" data-active="${tour.is_active}">
                            ${tour.is_active ? '👁 Скрыть' : '👁 Показать'}
                        </button>
                    </div>
                `;

                // Навешиваем обработчики событий прямо на элементы
                const editBtn = card.querySelector('.btn-edit');
                editBtn.addEventListener('click', () => openEditModal(tour));

                const toggleBtn = card.querySelector('.btn-toggle');
                toggleBtn.addEventListener('click', () => toggleTour(tour.id, !tour.is_active));

                toursListEl.appendChild(card);
            });
        } catch (e) {
            toursListEl.innerHTML = "Ошибка загрузки.";
        }
    }

    // Создание тура (с фото)
    if (createTourForm) {
        createTourForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            
            // Используем FormData для отправки файлов
            const formData = new FormData();
            formData.append('title', document.getElementById("new-title").value);
            formData.append('price_from', document.getElementById("new-price").value);
            formData.append('type', document.getElementById("new-type").value);
            formData.append('description', document.getElementById("new-description").value);
            formData.append('is_active', document.getElementById("new-active").checked);
            
            const file = document.getElementById("new-image").files[0];
            if (file) {
                formData.append('image', file); // Ключ 'image' должен совпадать с тем, что ждет бэкенд (multer)
            }

            try {
                // Если бэкенд поддерживает загрузку файлов, используем FormData
                // Если нет, придется отправлять JSON (тогда фото не загрузится)
                await apiFetch("/admin/tours", {
                    method: "POST",
                    body: formData // Отправляем как multipart/form-data
                });

                showSuccess("Тур успешно создан!");
                createTourForm.reset();
                document.getElementById('file-name').textContent = "Файл не выбран";
                loadTours();
            } catch (e) {
                showError("Ошибка создания: " + e.message);
            }
        });
    }

    // Переключение видимости
    async function toggleTour(id, newState) {
        try {
            await apiFetch(`/admin/tours/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ is_active: newState })
            });
            showSuccess(`Тур ${newState ? 'показан' : 'скрыт'}`);
            loadTours();
        } catch (e) {
            console.error(e);
        }
    }

    // --- МОДАЛЬНОЕ ОКНО (РЕДАКТИРОВАНИЕ) ---
    function openEditModal(tour) {
        document.getElementById("edit-id").value = tour.id;
        document.getElementById("edit-title").value = tour.title;
        document.getElementById("edit-type").value = tour.type;
        document.getElementById("edit-price").value = tour.price_from;
        document.getElementById("edit-description").value = tour.description || "";
        
        modal.classList.remove("hidden");
    }

    function closeModal() {
        modal.classList.add("hidden");
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
                showError("Ошибка обновления");
            }
        });
    }

    // --- НАВИГАЦИЯ ---
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
        });
    });

    // --- ЗАПУСК ---
    if(adminToken) setStatus("Готов к работе");
    loadTours(); // Загружаем туры сразу
});
