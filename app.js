// URL бекенда
const BACKEND_URL = "https://adler-backend.onrender.com";

// Telegram WebApp
const tg = window.Telegram.WebApp || null;
if (tg) {
  tg.ready();
  tg.expand();
}

// Элементы DOM
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

// Данные пользователя из Telegram (если есть)
const user = tg?.initDataUnsafe?.user || null;

// Картинки для разных типов туров
const TOUR_IMAGES = {
  jeeping: "img/jeeping.jpg",      // джиппинг
  yacht: "img/yacht.jpg",          // яхта / море
  excursion: "img/excursion.jpg"   // обзорные экскурсии
};
const DEFAULT_IMAGE = "img/default-tour.jpg";

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
    const card = document.createElement("article");
    card.className = "tour-card";

    // Фото
    const imageWrap = document.createElement("div");
    imageWrap.className = "tour-image";

    const img = document.createElement("img");
    img.src = TOUR_IMAGES[tour.type] || DEFAULT_IMAGE;
    img.alt = tour.title;
    imageWrap.appendChild(img);

    const overlay = document.createElement("div");
    overlay.className = "tour-image-overlay";
    imageWrap.appendChild(overlay);

    // Контент
    const content = document.createElement("div");
    content.className = "tour-content";

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
    btn.className = "btn btn-primary";
    btn.onclick = () => openBookingForm(tour);

    actions.appendChild(btn);

    content.appendChild(title);
    content.appendChild(meta);
    if (tour.description) content.appendChild(desc);
    content.appendChild(actions);

    card.appendChild(imageWrap);
    card.appendChild(content);

    toursListEl.appendChild(card);
  });
}

// ---------- ОТКРЫТЬ ФОРМУ БРОНИ ----------

function openBookingForm(tour) {
  tourIdInput.value = tour.id;
  bookingTitleEl.textContent = tour.title;

  bookingErrorEl.classList.add("hidden");
  bookingSuccessEl.classList.add("hidden");

  // Предзаполняем имя из Telegram, если оно есть
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

  // Отправляем строку datetime-local как есть — Pydantic сам разберёт
  const payload = {
    tour_id,
    date_time,
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
      const errText = await res.text();
      throw new Error(
        `Ошибка бронирования: статус ${res.status}. Ответ: ${errText}`
      );
    }

    const data = await res.json();
    console.log("Ответ бронирования:", data);

    bookingSuccessEl.textContent =
      "Заявка отправлена! Мы скоро свяжемся с вами и подтвердим бронирование.";
    bookingSuccessEl.classList.remove("hidden");

    // Закрываем WebApp в Telegram через пару секунд
    if (tg) {
      setTimeout(() => {
        tg.close();
      }, 2000);
    }
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

// ---------- СТАРТ ----------

loadTours();
