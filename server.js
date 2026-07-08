const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '/')));

const DATA_FILE = path.join(__dirname, 'data.json');

function readData() {
  try {
    if (fs.existsSync(DATA_FILE)) {
      const raw = fs.readFileSync(DATA_FILE, 'utf8');
      return JSON.parse(raw);
    }
  } catch (e) { console.error(e); }
  return {};
}

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
      bgColor: '#1a1040',
      // НОВЫЕ ПОЛЯ ДЛЯ МАЙНЕРА
      minerCoins: 0,
      minerRunning: false,
      videocards: [],
      purchasedItems: []
    };
    writeData(db);
  }
  res.json({ success: true, user: db[nick] });
});

// POST /save
app.post('/api/save', (req, res) => {
  const { nick, state } = req.body;
  if (!nick || !state) return res.status(400).json({ error: 'Нет данных' });

  const db = readData();
  if (!db[nick]) return res.status(404).json({ error: 'Пользователь не найден' });

  db[nick] = { ...db[nick], ...state };
  writeData(db);
  res.json({ success: true });
});

// POST /reset-top (без изменений)
app.post('/api/reset-top', (req, res) => {
  const { nick } = req.body;
  const allowed = ['Panika67', 'Вован7816'];
  if (!allowed.includes(nick)) return res.status(403).json({ error: 'Доступ запрещён' });

  const db = readData();
  for (let key in db) db[key].top = [];
  writeData(db);
  res.json({ success: true });
});

// ===== НОВЫЙ ЭНДПОИНТ ДЛЯ ПОКУПКИ ВИДЕОКАРТ =====
app.post('/api/buy-videocard', (req, res) => {
  const { nick, cardId } = req.body;
  if (!nick || !cardId) return res.status(400).json({ error: 'Недостаточно данных' });

  const db = readData();
  const user = db[nick];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  // Список доступных видеокарт (цены в обычных очках)
  const cardsCatalog = [
    { id: 'gtx1050', name: 'GTX 1050', price: 100, hashrate: 1 },
    { id: 'gtx1660', name: 'GTX 1660', price: 300, hashrate: 3 },
    { id: 'rtx2060', name: 'RTX 2060', price: 600, hashrate: 6 },
    { id: 'rtx3060', name: 'RTX 3060', price: 1200, hashrate: 12 },
    { id: 'rtx4090', name: 'RTX 4090', price: 5000, hashrate: 50 }
  ];

  const card = cardsCatalog.find(c => c.id === cardId);
  if (!card) return res.status(400).json({ error: 'Карта не найдена' });

  if (user.score < card.price) {
    return res.status(400).json({ error: 'Недостаточно очков' });
  }

  // Проверяем, есть ли уже такая карта у пользователя
  let userCard = user.videocards.find(v => v.id === cardId);
  if (userCard) {
    userCard.count += 1;
  } else {
    user.videocards.push({ id: cardId, name: card.name, price: card.price, hashrate: card.hashrate, count: 1 });
  }

  user.score -= card.price;
  writeData(db);
  res.json({ success: true, user });
});

// ===== НОВЫЙ ЭНДПОИНТ ДЛЯ ПОКУПКИ ПРИКОЛЮХ =====
app.post('/api/buy-item', (req, res) => {
  const { nick, itemId } = req.body;
  if (!nick || !itemId) return res.status(400).json({ error: 'Недостаточно данных' });

  const db = readData();
  const user = db[nick];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  // Список приколюх (цена в MinerCoins)
  const itemsCatalog = [
    { id: 'flying_beaver', name: '🦫 Летающий бобр', price: 100 },
    { id: 'rainbow_trail', name: '🌈 Радужный след', price: 250 },
    { id: 'sparkles', name: '✨ Блестяшки', price: 500 },
    { id: 'ufo', name: '🛸 НЛО', price: 1000 }
  ];

  const item = itemsCatalog.find(it => it.id === itemId);
  if (!item) return res.status(400).json({ error: 'Предмет не найден' });

  if (user.minerCoins < item.price) {
    return res.status(400).json({ error: 'Недостаточно майнер-монет' });
  }

  // Добавляем в purchasedItems (если ещё нет)
  if (!user.purchasedItems.includes(itemId)) {
    user.purchasedItems.push(itemId);
  } else {
    return res.status(400).json({ error: 'У вас уже есть этот предмет' });
  }

  user.minerCoins -= item.price;
  writeData(db);
  res.json({ success: true, user });
});

// ===== НОВЫЙ ЭНДПОИНТ ДЛЯ ЗАПУСКА/ОСТАНОВКИ МАЙНЕРА =====
app.post('/api/toggle-miner', (req, res) => {
  const { nick, running } = req.body;
  if (!nick) return res.status(400).json({ error: 'Ник обязателен' });

  const db = readData();
  const user = db[nick];
  if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

  user.minerRunning = running;
  writeData(db);
  res.json({ success: true, user });
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
