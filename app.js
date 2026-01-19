// URL бекенда
const BACKEND_URL = "https://adler-backend.onrender.com";

// Telegram WebApp
const tg = window.Telegram.WebApp || null;
if (tg) {
  tg.ready();
  tg.expand();
}

// DOM-элементы
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

// Мини-карточка тура в форме
const bookingTourImageEl = document.getElementById("booking-tour-image");
const bookingTourTypeEl = document.getElementById("booking-tour-type");
const bookingTourMetaEl = document.getElementById("booking-tour-meta");
const bookingTourDescEl = document.getElementById("booking-tour-desc");
const bookingProgressBarEl = document.getElementById("booking-progress-bar");

// Пользователь Telegram (если есть)
const user = tg?.initDataUnsafe?.user || null;

// Картинки и подписи типов туров
const TOUR_IMAGES = {
  jeeping: "img/jeeping.jpg",
  yacht: "img/yacht.jpg",
  excursion: "img/excursion.jpg",
};
const TOUR_TYPE_LABEL = {
  jeeping: "ADVENTURE",
  yacht: "VIP",
  excursion: "POPULAR",
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

    // бейдж
    const badge = document.createElement("div");
    badge.className = "tour-badge";
    if (tour.type === "jeeping") badge.classList.add("tour-badge--jeeping");
    if (tour.type === "yacht") badge.classList.add("tour-badge--yacht");
    if (tour.type === "excursion") badge.classList.add("tour-badge--excursion");
    badge.textContent = TOUR_TYPE_LABEL[tour.type] || "TOUR";

    const title = document.createElement("div");
    title.className = "tour-title";
    title.textContent = tour.title;

    const meta = document.createElement("div");
    meta.className = "tour-meta";
    meta.textContent = tour.description
      ? tour.description.split(".")[0]
      : "";

    const footer = document.createElement("div");
    footer.className = "tour-footer";

    const priceEl = document.createElement("div");
    priceEl.className = "tour-price";
    if (tour.price_from) {
      priceEl.innerHTML = `<span>от</span> ${tour.price_from.toLocaleString("ru-RU")} ₽`;
    } else {
      priceEl.textContent = "Цена по запросу";
    }

    const btn = document.createElement("button");
    btn.textContent = "Смотреть";
    btn.className = "btn btn-primary";
    btn.onclick = () => openBookingForm(tour);

    footer.appendChild(priceEl);
    footer.appendChild(btn);

    content.appendChild(badge);
    content.appendChild(title);
    if (meta.textContent) content.appendChild(meta);
    content.appendChild(footer);

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

  // Мини-карточка тура
  const imgSrc = TOUR_IMAGES[tour.type] || DEFAULT_IMAGE;
  if (bookingTourImageEl) {
    bookingTourImageEl.src = imgSrc;
    bookingTourImageEl.alt = tour.title;
  }
  if (bookingTourTypeEl) {
    bookingTourTypeEl.textContent = TOUR_TYPE_LABEL[tour.type] || "TOUR";
  }
  if (bookingTourMetaEl) {
    const price = tour.price_from
      ? `от ${tour.price_from.toLocaleString("ru-RU")} ₽`
      : "Цена по запросу";
    const duration = tour.duration_hours
      ? `${tour.duration_hours} ч`
      : "Длительность не указана";
    bookingTourMetaEl.textContent = `${price} · ${duration}`;
  }
  if (bookingTourDescEl) {
    bookingTourDescEl.textContent =
      tour.description || "Выбран премиальный маршрут от Adler Tours.";
  }

  // Предзаполнение имени из Telegram
  if (user) {
    const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ");
    if (fullName && !clientNameInput.value) {
      clientNameInput.value = fullName;
    }
  }

  updateFieldStates();
  updateProgress();

  document.getElementById("tours-container").classList.add("hidden");
  bookingContainerEl.classList.remove("hidden");
}

backButton.addEventListener("click", () => {
  bookingContainerEl.classList.add("hidden");
  document.getElementById("tours-container").classList.remove("hidden");
});

// ---------- ЭФФЕКТЫ ПОЛЕЙ И ПРОГРЕСС ----------

const requiredFields = [dateTimeInput, peopleCountInput, clientNameInput, clientPhoneInput];

function attachFieldEffects() {
  const allInputs = [dateTimeInput, peopleCountInput, clientNameInput, clientPhoneInput, commentInput];

  allInputs.forEach((input) => {
    if (!input) return;
    input.addEventListener("focus", () => {
      const field = input.closest(".field");
      if (field) field.classList.add("field--focused");
    });
    input.addEventListener("blur", () => {
      const field = input.closest(".field");
      if (field) field.classList.remove("field--focused");
    });
    input.addEventListener("input", () => {
      updateFieldStates();
      updateProgress();
    });
  });

  updateFieldStates();
  updateProgress();
}

function updateFieldStates() {
  const allInputs = [dateTimeInput, peopleCountInput, clientNameInput, clientPhoneInput, commentInput];
  allInputs.forEach((input) => {
    if (!input) return;
    const field = input.closest(".field");
    if (!field) return;
    const hasValue = input.value && input.value.trim().length > 0;
    field.classList.toggle("field--filled", !!hasValue);
  });
}

function updateProgress() {
  if (!bookingProgressBarEl) return;
  let filled = 0;
  requiredFields.forEach((input) => {
    if (input && input.value && input.value.trim().length > 0) {
      filled++;
    }
  });
  const percent = (filled / requiredFields.length) * 100;
  bookingProgressBarEl.style.width = `${percent}%`;
}

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

attachFieldEffects();
loadTours();
