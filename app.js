const tg = window.Telegram && window.Telegram.WebApp;
if (tg) {
  tg.ready();
  tg.expand();
}

const state = {
  categories: [],
  selectedCategory: ""
};

const categoriesEl = document.getElementById("categories");
const productsEl = document.getElementById("products");
const currentCategoryEl = document.getElementById("currentCategory");
const stockDateTextEl = document.getElementById("stockDateText");
const refreshBtn = document.getElementById("refreshBtn");
const productCardTemplate = document.getElementById("productCardTemplate");
const imageModalEl = document.getElementById("imageModal");
const imageModalPreviewEl = document.getElementById("imageModalPreview");
const imageModalCloseEl = document.getElementById("imageModalClose");
const suggestModalEl = document.getElementById("suggestModal");
const suggestOpenBtnEl = document.getElementById("suggestOpenBtn");
const suggestCloseBtnEl = document.getElementById("suggestCloseBtn");
const suggestSendBtnEl = document.getElementById("suggestSendBtn");
const suggestTextEl = document.getElementById("suggestText");
const suggestStatusEl = document.getElementById("suggestStatus");

function updateStockDateText() {
  if (!stockDateTextEl) return;

  const today = new Date();
  const localDate = today.toLocaleDateString("ru-RU");
  stockDateTextEl.textContent = `Актуальные остатки на ${localDate}`;
}

function openImageModal(src, name) {
  if (!imageModalEl || !imageModalPreviewEl) return;
  imageModalPreviewEl.src = src;
  imageModalPreviewEl.alt = name ? `Фото товара: ${name}` : "Увеличенное фото товара";
  imageModalEl.classList.add("open");
  imageModalEl.setAttribute("aria-hidden", "false");
}

function closeImageModal() {
  if (!imageModalEl || !imageModalPreviewEl) return;
  imageModalEl.classList.remove("open");
  imageModalEl.setAttribute("aria-hidden", "true");
  imageModalPreviewEl.src = "";
}

function openSuggestModal() {
  if (!suggestModalEl || !suggestTextEl) return;
  suggestModalEl.classList.add("open");
  suggestModalEl.setAttribute("aria-hidden", "false");
  suggestStatusEl.textContent = "";
  setTimeout(() => {
    suggestTextEl.focus();
  }, 0);
}

function closeSuggestModal() {
  if (!suggestModalEl) return;
  suggestModalEl.classList.remove("open");
  suggestModalEl.setAttribute("aria-hidden", "true");
}

function setSuggestStatus(message, isError = false) {
  if (!suggestStatusEl) return;
  suggestStatusEl.textContent = message;
  suggestStatusEl.classList.toggle("error", isError);
  suggestStatusEl.classList.toggle("ok", !isError && Boolean(message));
}

async function sendSuggestion() {
  if (!suggestTextEl || !suggestSendBtnEl) return;

  const text = suggestTextEl.value.trim();
  if (!text) {
    setSuggestStatus("Введите текст предложения", true);
    return;
  }

  suggestSendBtnEl.disabled = true;
  setSuggestStatus("Отправляем...");

  try {
    const user = tg && tg.initDataUnsafe ? tg.initDataUnsafe.user : null;

    const response = await fetch("/api/suggestions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        text,
        user
      })
    });

    const data = await response.json();
    if (!response.ok || !data.ok) {
      throw new Error(data.error || "Не удалось отправить сообщение");
    }

    setSuggestStatus("Отправлено успешно");
    suggestTextEl.value = "";
  } catch (error) {
    setSuggestStatus(error.message, true);
  } finally {
    suggestSendBtnEl.disabled = false;
  }
}

async function loadData() {
  const response = await fetch("/api/products", { cache: "no-store" });
  if (!response.ok) {
    throw new Error("Не удалось загрузить каталог");
  }

  const data = await response.json();
  state.categories = data.categories;

  if (!state.selectedCategory || !state.categories.find((c) => c.category === state.selectedCategory)) {
    state.selectedCategory = state.categories[0]?.category || "";
  }

  renderCategories();
  renderProducts();
}

function renderCategories() {
  categoriesEl.innerHTML = "";

  state.categories.forEach((category) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "category-btn";
    btn.textContent = category.category;

    if (category.category === state.selectedCategory) {
      btn.classList.add("active");
    }

    btn.addEventListener("click", () => {
      state.selectedCategory = category.category;
      renderCategories();
      renderProducts();
    });

    categoriesEl.appendChild(btn);
  });
}

function renderProducts() {
  const categoryData = state.categories.find((c) => c.category === state.selectedCategory);
  const items = categoryData ? categoryData.items : [];

  currentCategoryEl.textContent = state.selectedCategory || "Каталог";
  productsEl.innerHTML = "";

  if (!items.length) {
    const empty = document.createElement("p");
    empty.className = "empty";
    empty.textContent = "В этом разделе сейчас нет товара в наличии";
    productsEl.appendChild(empty);
    return;
  }

  items.forEach((item) => {
    const card = productCardTemplate.content.firstElementChild.cloneNode(true);
    const image = card.querySelector(".product-image");
    const name = card.querySelector(".product-name");
    const stock = card.querySelector(".product-stock");

    image.src = item.image || "https://placehold.co/160x160/f4efe6/1f1b16?text=No+Image";
    image.loading = "lazy";
    image.style.cursor = "zoom-in";
    name.textContent = item.name;
    stock.textContent = `Остаток: ${item.stock} шт.`;

    image.addEventListener("click", () => {
      openImageModal(image.src, item.name);
    });

    productsEl.appendChild(card);
  });
}

async function bootstrap() {
  try {
    updateStockDateText();
    await loadData();
  } catch (error) {
    productsEl.innerHTML = `<p class=\"empty\">${error.message}</p>`;
  }
}

refreshBtn.addEventListener("click", bootstrap);

if (imageModalCloseEl) {
  imageModalCloseEl.addEventListener("click", closeImageModal);
}

if (imageModalEl) {
  imageModalEl.addEventListener("click", (event) => {
    if (event.target === imageModalEl) {
      closeImageModal();
    }
  });
}

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape") {
    closeImageModal();
    closeSuggestModal();
  }
});

if (suggestOpenBtnEl) {
  suggestOpenBtnEl.addEventListener("click", openSuggestModal);
}

if (suggestCloseBtnEl) {
  suggestCloseBtnEl.addEventListener("click", closeSuggestModal);
}

if (suggestModalEl) {
  suggestModalEl.addEventListener("click", (event) => {
    if (event.target === suggestModalEl) {
      closeSuggestModal();
    }
  });
}

if (suggestSendBtnEl) {
  suggestSendBtnEl.addEventListener("click", sendSuggestion);
}

bootstrap();
