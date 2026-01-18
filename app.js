// URL бекенда
const BACKEND_URL = "https://adler-backend.onrender.com";

const tg = window.Telegram.WebApp;
tg.ready();
tg.expand();

const toursListEl = document.getElementById("tours-list");
const toursLoadingEl = document.getElementById("tours-loading");
const toursErrorEl = document.getElementById("tours-error");

const bookingContainerEl = document.getElementById("booking-container");
const bookingTitleEl = document.getElementById("booking-title");
const bookingFormEl = document.getElementById("booking-form");

const tourIdInput = document.getElementById("tour_id");
const dateTimeInput = document.getElementById("date_time");
const peopleCountInput = document.getElementById("people_count");
const clientNameInput = document.getElementById("client_name");
const clientPhoneInput = document.getElementById("client_phone");
const commentInput = document.getElementById("comment");

const bookingErrorEl = document.getElementById("booking-error");
const bookingSuccessEl = document.getElementById("booking-success");

const backButton = document.getElementById("back-button");
const submitButton = document.getElementById("submit-button");

// Сохраним данные пользователя из Telegram
const user = tg.initDataUnsafe?.user || null;

// ---------- ЗАГРУЗКА ТУРОВ ----------

async function loadTours() {
  toursErrorEl.classList.add("hidden");
  toursLoadingEl.classList.remove("hidden");

  try {
    const res = await fetch(`${BACKEND_URL}/api/tours`);
    if (!res.ok) {
      throw new Error(`Ошибка загрузки туров: ${res.status}`);
    }
    const tours = await res.json();
    renderTours(tours);
  } catch (e) {
    console.error("Ошибка загрузки туров:", e);
    toursErrorEl.textContent = "Не удалось загрузить туры. Попробуйте позже.";
    toursErrorEl.classList.remove("hidden");
  } finally {
    toursLoadingEl.classList.add("hidden");
  }
}

function renderTours(tours) {
  toursListEl.innerHTML = "";

  if (!tours.length) {
    toursListEl.innerHTML = "<p>Пока нет доступных туров.</p>";
    return;
  }

  tours.forEach((tour) => {
    const card = document.createElement("div");
    card.className = "tour-card";

    const title = document.createElement("div");
    title.className = "tour-title";
    title.textContent = tour.title;

    const meta = document.createElement("div");
    meta.className = "tour-meta";
    const price = tour.price_from ? `${tour.price_from} ₽` : "Цена по запросу";
    const duration = tour.duration_hours
      ? `${tour.duration_hours} ч`
      : "Длительность не указана";
    meta.textContent = `${price} · ${duration}`;

    const desc = document.createElement("div");
    desc.className = "tour-description";
    desc.textContent = tour.description || "";

    const actions = document.createElement("div");
    actions.className = "tour-actions";

    const btn = document.createElement("button");
    btn.textContent = "Забронировать";
    btn.onclick = () => openBookingForm(tour);

    actions.appendChild(btn);

    card.appendChild(title);
    card.appendChild(meta);
    if (tour.description) card.appendChild(desc);
    card.appendChild(actions);

    toursListEl.appendChild(card);
  });
}

// ---------- ФОРМА БРОНИ ----------

function openBookingForm(tour) {
  tourIdInput.value = tour.id;
  bookingTitleEl.textContent = `Бронирование: ${tour.title}`;

  bookingErrorEl.classList.add("hidden");
  bookingSuccessEl.classList.add("hidden");

  // Предзаполним имя из Telegram, если есть
  if (user) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
    if (fullName && !clientNameInput.value) {
      clientNameInput.value = fullName;
    }
  }

  document.getElementById("tours-container").classList.add("hidden");
  bookingContainerEl.classList.remove("hidden");
}

backButton.addEventListener("click", () => {
  bookingContainerEl.classList.add("hidden");
  document.getElementById("tours-container").classList.remove("hidden");
});

// ---------- ОТПРАВКА ЗАЯВКИ ----------

bookingFormEl.addEventListener("submit", async (e) => {
  e.preventDefault();

  bookingErrorEl.classList.add("hidden");
  bookingSuccessEl.classList.add("hidden");

  const tour_id = parseInt(tourIdInput.value, 10);
  const date_time = dateTimeInput.value;
  const people_count = parseInt(peopleCountInput.value || "1", 10);
  const client_name = clientNameInput.value.trim();
  const client_phone = clientPhoneInput.value.trim();
  const comment = commentInput.value.trim() || null;

  if (!date_time || !client_name || !client_phone || !people_count) {
    bookingErrorEl.textContent = "Заполните все обязательные поля.";
    bookingErrorEl.classList.remove("hidden");
    return;
  }

  // Преобразуем в ISO-формат, который понимает FastAPI
  const isoDate = new Date(date_time).toISOString();

  const payload = {
    tour_id,
    date_time: isoDate,
    people_count,
    client_name,
    client_phone,
    comment,
    telegram_user_id: user ? user.id : null,
    telegram_username: user ? user.username : null,
  };

  console.log("Отправляем заявку:", payload);

  submitButton.disabled = true;
  submitButton.textContent = "Отправляем...";

  try {
    const res = await fetch(`${BACKEND_URL}/api/bookings`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      // читаем текст ошибки от сервера
      const errText = await res.text();
      throw new Error(
        `Ошибка бронирования: статус ${res.status}. Ответ: ${errText}`
      );
    }

    const data = await res.json();
    console.log("Ответ бронирования:", data);

    bookingSuccessEl.textContent =
      "Заявка отправлена! Ожидайте подтверждения в этом чате.";
    bookingSuccessEl.classList.remove("hidden");

    setTimeout(() => {
      tg.close();
    }, 1500);
  } catch (e) {
    console.error("Ошибка при бронировании:", e);
    bookingErrorEl.textContent =
      e.message || "Не удалось отправить заявку. Попробуйте ещё раз позже.";
    bookingErrorEl.classList.remove("hidden");
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Отправить заявку";
  }
});

// Старт
loadTours();
