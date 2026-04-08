const fs = require("fs");
const path = require("path");
const express = require("express");
const cors = require("cors");
const XLSX = require("xlsx");

const app = express();
const PORT = process.env.PORT || 3000;

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "8528510557:AAFIiIwkn9ZSZx_veKzj1Af8QdvxNsRc0Z0";
const TELEGRAM_OWNER_CHAT_ID = process.env.TELEGRAM_OWNER_CHAT_ID || "8345837229";

const dataDir = path.join(__dirname, "data");
const excelFile = path.join(dataDir, "products.xlsx");

const CATEGORY_ORDER = ["снюс", "жижа", "одноразки", "картриджи"];

const SAMPLE_PRODUCTS = [
  {
    category: "снюс",
    name: "Siberia -80",
    stock: 12,
    image: "https://images.unsplash.com/photo-1511920170033-f8396924c348?w=400&q=80&auto=format&fit=crop"
  },
  {
    category: "жижа",
    name: "Lemon Mint 30ml",
    stock: 7,
    image: "https://images.unsplash.com/photo-1521572163474-6864f9cf17ab?w=400&q=80&auto=format&fit=crop"
  },
  {
    category: "одноразки",
    name: "Vape X 5000",
    stock: 4,
    image: "https://images.unsplash.com/photo-1606914501449-5a96b6ce24ca?w=400&q=80&auto=format&fit=crop"
  },
  {
    category: "картриджи",
    name: "Cartridge Pro 2ml",
    stock: 10,
    image: "https://images.unsplash.com/photo-1479064555552-3ef4979f8908?w=400&q=80&auto=format&fit=crop"
  }
];

function ensureExcelFile() {
  if (!fs.existsSync(dataDir)) {
    fs.mkdirSync(dataDir, { recursive: true });
  }

  if (fs.existsSync(excelFile)) {
    return;
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(SAMPLE_PRODUCTS, {
    header: ["category", "name", "stock", "image"]
  });
  XLSX.utils.book_append_sheet(wb, ws, "products");
  XLSX.writeFile(wb, excelFile);
}

function normalizeCategory(category) {
  if (!category) return "";
  return String(category).trim().toLowerCase();
}

function readProductsFromExcel() {
  ensureExcelFile();

  const workbook = XLSX.readFile(excelFile, { cellDates: false });
  const firstSheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[firstSheetName];

  const rows = XLSX.utils.sheet_to_json(sheet, {
    defval: "",
    raw: false
  });

  return rows
    .map((row) => ({
      category: normalizeCategory(row.category),
      name: String(row.name || "").trim(),
      stock: Number(row.stock || 0),
      image: String(row.image || "").trim()
    }))
    .filter((item) => item.category && item.name)
    .filter((item) => Number.isFinite(item.stock) && item.stock > 0)
    .sort((a, b) => {
      const categoryDiff = CATEGORY_ORDER.indexOf(a.category) - CATEGORY_ORDER.indexOf(b.category);
      if (categoryDiff !== 0) {
        return categoryDiff;
      }
      return a.name.localeCompare(b.name, "ru");
    });
}

function formatUserInfo(user) {
  if (!user || typeof user !== "object") {
    return "Пользователь: неизвестно";
  }

  const id = user.id ? `ID: ${user.id}` : "ID: неизвестно";
  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ") || "без имени";
  const username = user.username ? `@${user.username}` : "без username";

  return `Пользователь: ${fullName} (${username}), ${id}`;
}

async function sendSuggestionToTelegram({ text, user }) {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_OWNER_CHAT_ID) {
    throw new Error("Не настроены TELEGRAM_BOT_TOKEN и TELEGRAM_OWNER_CHAT_ID");
  }

  const message = [
    "Новая заявка из mini app:",
    formatUserInfo(user),
    "",
    text
  ].join("\n");

  const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      chat_id: TELEGRAM_OWNER_CHAT_ID,
      text: message
    })
  });

  const result = await response.json();
  if (!response.ok || !result.ok) {
    throw new Error(result.description || "Ошибка отправки в Telegram");
  }
}

app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "public", "index.html"));
});

app.get("/api/products", (req, res) => {
  try {
    const products = readProductsFromExcel();
    const grouped = CATEGORY_ORDER.map((category) => ({
      category,
      items: products.filter((item) => item.category === category)
    }));

    res.json({
      updatedAt: new Date().toISOString(),
      categories: grouped
    });
  } catch (error) {
    console.error("Excel read error:", error);
    res.status(500).json({
      error: "Не удалось прочитать Excel файл",
      details: error.message
    });
  }
});

app.post("/api/suggestions", async (req, res) => {
  try {
    const text = String(req.body && req.body.text ? req.body.text : "").trim();
    const user = req.body ? req.body.user : null;

    if (!text) {
      return res.status(400).json({ ok: false, error: "Пустой текст предложения" });
    }

    if (text.length > 800) {
      return res.status(400).json({ ok: false, error: "Слишком длинный текст" });
    }

    await sendSuggestionToTelegram({ text, user });
    return res.json({ ok: true });
  } catch (error) {
    console.error("Suggestion send error:", error);
    return res.status(500).json({ ok: false, error: error.message || "Ошибка отправки" });
  }
});

app.get("/api/health", (req, res) => {
  res.json({ ok: true });
});

function startServer(preferredPort) {
  const port = Number(preferredPort);
  const server = app.listen(port, () => {
    ensureExcelFile();
    console.log(`Mini app server started on http://localhost:${port}`);
    console.log(`Excel source: ${excelFile}`);
  });

  server.on("error", (error) => {
    if (error && error.code === "EADDRINUSE") {
      const nextPort = port + 1;
      console.log(`Port ${port} is busy, trying ${nextPort}...`);
      startServer(nextPort);
      return;
    }

    console.error("Server start error:", error);
    process.exit(1);
  });
}

startServer(PORT);
