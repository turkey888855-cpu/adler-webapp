document.addEventListener("DOMContentLoaded", () => {
    const BACKEND_URL = "https://adler-backend.onrender.com"; // Проверьте адрес
    let adminToken = localStorage.getItem("admin_token") || "";
    
    // Глобальная переменная для хранения загруженных туров (чтобы брать данные для редактирования)
    let loadedTours = [];

    const statusEl = document.getElementById("status-indicator");
    const errorEl = document.getElementById("admin-error");
    const successEl = document.getElementById("admin-success");

    // --- ФУНКЦИИ УВЕДОМЛЕНИЙ ---
    function setStatus(text) { if (statusEl) statusEl.textContent = text; }
    
    function showSuccess(text) {
        if (!successEl) return;
        successEl.textContent = text;
        successEl.classList.remove("hidden");
        setTimeout(() => successEl.classList.add("hidden"), 3000);
    }

    function showError(text) {
        if (!errorEl) return;
        errorEl.textContent = text;
        errorEl.classList.remove("hidden");
        setTimeout(() => errorEl.classList.add("hidden"), 4000);
    }

    // --- API ЗАПРОСЫ ---
    async function apiFetch(path, options = {}) {
        if (!adminToken) {
            adminToken = prompt("Введите токен администратора:") || "";
            localStorage.setItem("admin_token", adminToken);
        }

        const headers = options.headers || {};
        headers["X-Admin-Token"] = adminToken;

        // Если отправляем FormData (файл), Content-Type выставляется браузером автоматически
        // Если отправляем JSON, ставим заголовок вручную
        if (!(options.body instanceof FormData) && !headers["Content-Type"]) {
            headers["Content-Type"] = "application/json";
        }

        try {
            const res = await fetch(`${BACKEND_URL}${path}`, { ...options, headers });
            
            if (res.status === 
