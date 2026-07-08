const express = require('express');
const cors = require('cors');
const mongoose = require('mongoose');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '/')));

// ===== ПОДКЛЮЧЕНИЕ К MONGODB =====
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ Ошибка: MONGODB_URI не задана! Добавьте переменную окружения на Render.');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(() => console.log('✅ MongoDB подключена'))
  .catch(err => console.error('❌ Ошибка подключения к MongoDB:', err));

// ===== СХЕМА ПОЛЬЗОВАТЕЛЯ =====
const userSchema = new mongoose.Schema({
  nick: { type: String, unique: true, required: true },
  score: { type: Number, default: 0 },
  rebirths: { type: Number, default: 0 },
  rebirthBonus: { type: Number, default: 0 },
  upgrades: [
    {
      id: String,
      name: String,
      baseCost: Number,
      costMult: Number,
      level: { type: Number, default: 0 },
      maxLevel: Number,
      desc: String
    }
  ],
  top: [
    {
      name: String,
      score: Number,
      rebirths: Number,
      date: String
    }
  ],
  friends: [String],
  seeds: {
    grass: { type: Number, default: 0 },
    flower: { type: Number, default: 0 },
    tree: { type: Number, default: 0 }
  },
  plots: [
    {
      type: String,
      stage: { type: Number, default: 0 },
      progress: { type: Number, default: 0 },
      plantedAt: { type: Number, default: Date.now }
    }
  ],
  weather: {
    type: { type: String, default: 'normal' },
    startTime: { type: Number, default: Date.now },
    duration: { type: Number, default: 30000 }
  },
  bgMode: { type: String, default: 'stars' },
  bgImage: { type: String, default: '' },
  bgColor: { type: String, default: '#1a1040' },
  minerCoins: { type: Number, default: 0 },
  minerRunning: { type: Boolean, default: false },
  videocards: [
    {
      id: String,
      name: String,
      price: Number,
      hashrate: Number,
      count: { type: Number, default: 1 }
    }
  ],
  purchasedItems: [String]
});

const User = mongoose.model('User', userSchema);

// ===== API =====

// POST /login
app.post('/api/login', async (req, res) => {
  const { nick } = req.body;
  if (!nick) return res.status(400).json({ error: 'Ник обязателен' });

  try {
    let user = await User.findOne({ nick });
    if (!user) {
      const defaultUpgrades = [
        { id: 'click_power', name: '💪 Сила роста', baseCost: 10, costMult: 1.5, level: 0, maxLevel: 25, desc: '+1 к силе клика' },
        { id: 'auto_click', name: '🤖 Фотосинтез', baseCost: 50, costMult: 1.6, level: 0, maxLevel: 20, desc: '+1 очко в секунду' }
      ];
      user = new User({
        nick,
        upgrades: defaultUpgrades,
        seeds: { grass: 0, flower: 0, tree: 0 },
        plots: [],
        weather: { type: 'normal', startTime: Date.now(), duration: 30000 },
        bgMode: 'stars',
        bgImage: '',
        bgColor: '#1a1040',
        minerCoins: 0,
        minerRunning: false,
        videocards: [],
        purchasedItems: []
      });
      await user.save();
      console.log(`🆕 Создан новый профиль: ${nick}`);
    }
    res.json({ success: true, user });
  } catch (err) {
    console.error('Ошибка /login:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /save
app.post('/api/save', async (req, res) => {
  const { nick, state } = req.body;
  if (!nick || !state) return res.status(400).json({ error: 'Нет данных' });

  try {
    const user = await User.findOne({ nick });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    user.score = state.score;
    user.rebirths = state.rebirths;
    user.rebirthBonus = state.rebirthBonus;
    user.upgrades = state.upgrades;
    user.top = state.top;
    user.friends = state.friends;
    user.seeds = state.seeds;
    user.plots = state.plots;
    user.weather = state.weather;
    user.bgMode = state.bgMode;
    user.bgImage = state.bgImage;
    user.bgColor = state.bgColor;
    user.minerCoins = state.minerCoins || 0;
    user.minerRunning = state.minerRunning || false;
    user.videocards = state.videocards || [];
    user.purchasedItems = state.purchasedItems || [];

    await user.save();
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка /save:', err);
    res.status(500).json({ error: 'Ошибка сохранения' });
  }
});

// POST /reset-top
app.post('/api/reset-top', async (req, res) => {
  const { nick } = req.body;
  const allowed = ['Panika67', 'Вован7816'];
  if (!allowed.includes(nick)) {
    return res.status(403).json({ error: 'Доступ запрещён' });
  }

  try {
    await User.updateMany({}, { $set: { top: [] } });
    res.json({ success: true });
  } catch (err) {
    console.error('Ошибка /reset-top:', err);
    res.status(500).json({ error: 'Ошибка сброса' });
  }
});

// POST /buy-videocard
app.post('/api/buy-videocard', async (req, res) => {
  const { nick, cardId } = req.body;
  if (!nick || !cardId) return res.status(400).json({ error: 'Недостаточно данных' });

  try {
    const user = await User.findOne({ nick });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

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

    let userCard = user.videocards.find(v => v.id === cardId);
    if (userCard) {
      userCard.count += 1;
    } else {
      user.videocards.push({ id: cardId, name: card.name, price: card.price, hashrate: card.hashrate, count: 1 });
    }

    user.score -= card.price;
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    console.error('Ошибка /buy-videocard:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /buy-item
app.post('/api/buy-item', async (req, res) => {
  const { nick, itemId } = req.body;
  if (!nick || !itemId) return res.status(400).json({ error: 'Недостаточно данных' });

  try {
    const user = await User.findOne({ nick });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

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

    if (user.purchasedItems.includes(itemId)) {
      return res.status(400).json({ error: 'У вас уже есть этот предмет' });
    }

    user.purchasedItems.push(itemId);
    user.minerCoins -= item.price;
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    console.error('Ошибка /buy-item:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

// POST /toggle-miner
app.post('/api/toggle-miner', async (req, res) => {
  const { nick, running } = req.body;
  if (!nick) return res.status(400).json({ error: 'Ник обязателен' });

  try {
    const user = await User.findOne({ nick });
    if (!user) return res.status(404).json({ error: 'Пользователь не найден' });

    user.minerRunning = running;
    await user.save();
    res.json({ success: true, user });
  } catch (err) {
    console.error('Ошибка /toggle-miner:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
