const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '/')));

// Путь к файлу с данными
const DATA_FILE = path.join(__dirname, 'data.json');

// Функция чтения данных
function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) {
    console.error('Ошибка чтения файла:', e);
  }
  return {}; // если файла нет – пустой объект
}

// Функция записи данных
function writeData(data) {
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ===== API =====

// POST /login
app.post('/api/login', (req, res) => {
  const { nick } = req.body;
  if (!nick) return res.status(400).json({ error: 'Ник обязателен' });

  const db = readData();
  if (!db[nick]) {
    // Создаём нового пользователя
    db[nick] = {
      score: 0,
      rebirths: 0,
      rebirthBonus: 0,
      upgrades: [
        { id: 'click_power', name: '💪 Сила роста', baseCost: 10, costMult: 1.5, level: 0, maxLevel: 25, desc: '+1 к силе клика' },
        { id: 'auto_click', name: '🤖 Фотосинтез', baseCost: 50, costMult: 1.6, level: 0, maxLevel: 20, desc: '+1 очко в секунду' }
      ],
      top: [],
      friends: [],
      seeds: { grass: 0, flower: 0, tree: 0 },
      plots: [],
      weather: { type: 'normal', startTime: Date.now(), duration: 30000 },
      bgMode: 'stars',
      bgImage: '',
      bgColor: '#1a1040'
    };
    writeData(db);
  }
  res.json({ success: true, user: db[nick] });
});
// В схеме пользователя (если вы используете MongoDB) или в объекте данных (если файл)
{
  // ... существующие поля
  minerCoins: 0,
  minerRunning: false,
  videocards: [], // массив объектов { id, name, price, hashrate, count }
  purchasedItems: [] // массив строк (названия купленных приколюх)
}
// POST /save
app.post('/api/save', (req, res) => {
  const { nick, state } = req.body;
  if (!nick || !state) return res.status(400).json({ error: 'Нет данных' });

  const db = readData();
  if (!db[nick]) return res.status(404).json({ error: 'Пользователь не найден' });

  // Обновляем все поля
  db[nick] = { ...db[nick], ...state };
  writeData(db);
  res.json({ success: true });
});

// POST /reset-top
app.post('/api/reset-top', (req, res) => {
  const { nick } = req.body;
  const allowed = ['Panika67', 'Вован7816'];
  if (!allowed.includes(nick)) {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  const db = readData();
  for (let key in db) {
    db[key].top = [];
  }
  writeData(db);
  res.json({ success: true });
});

// ===== Запуск =====
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
