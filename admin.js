document.addEventListener("DOMContentLoaded", () => {
    const BACKEND_URL = "https://adler-backend.onrender.com";
    let adminToken = localStorage.getItem("admin_token") || "";

    const statusEl = document.getElementById("status-indicator");
    const errorEl = document.getElementById("admin-error");
    const successEl = document.getElementById("admin-success");

    // File Input Logic (Visual only)
    const fileInput = document.getElementById('new-image');
    const fileNameDisplay = document.getElementById('file-name');
    if(fileInput) {
        fileInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (file) {
                fileNameDisplay.textContent = file.name;
                fileNameDisplay.style.color = "#333";
            } else {
                fileNameDisplay.textContent = "Файл не выбран";
                fileNameDisplay.style.color = "#888";
            }
        });
    }

    // --- UTILS ---
    function setStatus(text) {
        if (statusEl) statusEl.textContent = text;
    }

    function showToast(element, text) {
        element.textContent = text;
        element.classList.remove("hidden");
        setTimeout(() => element.classList.add("hidden"), 3000);
    }
    
    function showError(text) { showToast(errorEl, text); }
    function showSuccess(text) { showToast(successEl, text); }

    // --- API ---
    async function apiFetch(path, options = {}) {
        if (!adminToken) {
            adminToken = prompt("Введите admin token (ADMIN_TOKEN сервера):") || "";
            localStorage.setItem("admin_token", adminToken);
        }

        const headers = options.headers || {};
        headers["X-Admin-Token"] = adminToken;
        if (!headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }

        try {
            const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
            
            if (res.status === 401) {
                localStorage.removeItem("admin_token");
                adminToken = "";
                setStatus("Ошибка: Неверный токен");
                throw new Error("Неверный токен");
            }
            if (!res.ok) throw new Error(`Ошибка ${res.status}`);
            
            setStatus("API Connected");
            if (res.status === 204) return null;
            return await res.json();
        } catch (e) {
            console.error(e);
            showError(e.message);
            throw e;
        }
    }

    // --- NAVIGATION ---
    const navItems = document.querySelectorAll(".nav-item");
    const views = document.querySelectorAll(".view");

    navItems.forEach(btn => {
        btn.addEventListener("click", () => {
            if (btn.hasAttribute("disabled")) return;
            
            // Visual Update
            navItems.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            // View Update
            const viewId = btn.dataset.view;
            views.forEach(v => {
                v.classList.remove("active");
                if (v.id === `view-${viewId}`) v.classList.add("active");
            });

            // Reload data if needed
            if (viewId === "tours") loadTours();
            if (viewId === "bookings") loadBookings();
        });
    });

    // --- THEME & TOKEN ---
    document.getElementById("change-token-btn")?.addEventListener("click", () => {
        localStorage.removeItem("admin_token");
        location.reload();
    });

    const themeToggle = document.getElementById("theme-toggle");
    if (themeToggle) {
        const savedTheme = localStorage.getItem("admin_theme") || "light";
        document.body.className = `theme-${savedTheme}`;
        
        themeToggle.addEventListener("click", () => {
            const isDark = document.body.classList.contains("theme-dark");
            const newTheme = isDark ? "light" : "dark";
            document.body.className = `theme-${newTheme}`;
            localStorage.setItem("admin_theme", newTheme);
        });
    }

    // --- TOURS LOGIC ---
    const toursListEl = document.getElementById("tours-list");
    const createTourForm = document.getElementById("create-tour-form");

    async function loadTours() {
        if (!toursListEl) return;
        toursListEl.innerHTML = '<div style="color:#888;">Загрузка...</div>';
        
        try {
            const tours = await apiFetch("/admin/tours");
            toursListEl.innerHTML = "";
            
            if (tours.length === 0) {
                toursListEl.innerHTML = "Туров нет.";
                return;
            }

            tours.forEach(tour => {
                const el = document.createElement("div");
                el.className = "card";
                el.innerHTML = `
                    <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                        <span style="font-weight:bold; font-size:18px;">${tour.title}</span>
                        <span style="background:${tour.is_active ? '#D1FAE5' : '#F3F4F6'}; color:${tour.is_active ? '#065F46' : '#9CA3AF'}; padding:4px 8px; border-radius:6px; font-size:12px;">
                            ${tour.is_active ? 'Активен' : 'Скрыт'}
                        </span>
                    </div>
                    <div style="color:#666; font-size:14px; margin-bottom:15px;">
                        ${tour.type} • от ${tour.price_from} ₽
                    </div>
                    <div style="display:flex; gap:10px;">
                        <button class="btn-primary" style="padding:8px 16px; font-size:13px;" onclick="window.editTour(${tour.id})">Ред.</button>
                        <button class="btn-text" style="color:#ef4444;" onclick="window.toggleTour(${tour.id}, ${!tour.is_active})">
                            ${tour.is_active ? 'Скрыть' : 'Показать'}
                        </button>
                    </div>
                `;
                toursListEl.appendChild(el);
            });
        } catch (e) {}
    }

    // Global wrappers for inline onclick
    window.toggleTour = async (id, isActive) => {
        try {
            await apiFetch(`/admin/tours/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ is_active: isActive })
            });
            loadTours();
            showSuccess(`Тур ${isActive ? 'активирован' : 'скрыт'}`);
        } catch {}
    };

    if (createTourForm) {
        createTourForm.addEventListener("submit", async (e) => {
            e.preventDefault();
            const title = document.getElementById("new-title").value;
            const price = document.getElementById("new-price").value;
            const type = document.getElementById("new-type").value;
            const desc = document.getElementById("new-description").value;
            const active = document.getElementById("new-active").checked;

            try {
                await apiFetch("/admin/tours", {
                    method: "POST",
                    body: JSON.stringify({
                        title, type, 
                        price_from: Number(price),
                        description: desc,
                        is_active: active
                    })
                });
                showSuccess("Тур создан!");
                createTourForm.reset();
                document.getElementById('file-name').textContent = "Файл не выбран";
                loadTours(); // Refresh list if visible
            } catch {}
        });
    }

    // --- BOOKINGS LOGIC ---
    const bookingsListEl = document.getElementById("bookings-list");
    let currentFilter = "";

    async function loadBookings() {
        if (!bookingsListEl) return;
        bookingsListEl.innerHTML = '<div style="color:#888;">Загрузка...</div>';
        try {
            const url = currentFilter ? `/admin/bookings?status=${currentFilter}` : `/admin/bookings`;
            const bookings = await apiFetch(url);
            
            bookingsListEl.innerHTML = "";
            if (bookings.length === 0) {
                bookingsListEl.innerHTML = "Заявок нет.";
                return;
            }

            bookings.forEach(b => {
                const item = document.createElement("div");
                item.className = "card";
                item.style.padding = "20px";
                item.innerHTML = `
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <div style="font-weight:bold; font-size:16px;">#${b.id} ${b.tour_title}</div>
                            <div style="color:#888; font-size:13px; margin-top:4px;">
                                ${b.client_name} (${b.client_phone}) • ${new Date(b.date_time).toLocaleDateString()}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:12px; text-transform:uppercase; font-weight:bold; color:var(--accent-color);">${b.status}</span>
                            <div style="margin-top:5px; display:flex; gap:5px;">
                                <button class="btn-text" style="font-size:12px;" onclick="window.setBookingStatus(${b.id}, 'confirmed')">✅</button>
                                <button class="btn-text" style="font-size:12px;" onclick="window.setBookingStatus(${b.id}, 'cancelled')">❌</button>
                            </div>
                        </div>
                    </div>
                `;
                bookingsListEl.appendChild(item);
            });

        } catch {}
    }

    window.setBookingStatus = async (id, status) => {
        try {
            await apiFetch(`/admin/bookings/${id}`, {
                method: "PATCH",
                body: JSON.stringify({ status })
            });
            showSuccess("Статус обновлен");
            loadBookings();
        } catch {}
    };

    document.querySelectorAll(".filter-chip").forEach(btn => {
        btn.addEventListener("click", () => {
            document.querySelectorAll(".filter-chip").forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentFilter = btn.dataset.status;
            loadBookings();
        });
    });

    // Init
    if(adminToken) setStatus("Ready");
    loadTours(); // Preload
});
