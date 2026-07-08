const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '/')));

// ===== ПОДКЛЮЧЕНИЕ К SUPABASE =====
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Ошибка: SUPABASE_URL или SUPABASE_KEY не заданы!');
  process.exit(1);
}
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

// ===== ФУНКЦИИ ДЛЯ РАБОТЫ С БД =====
async function getUser(nick) {
  const { data, error } = await supabase
    .from('users')
    .select('data')
    .eq('nick', nick)
    .maybeSingle();
  if (error) throw error;
  return data ? data.data : null;
}

async function setUser(nick, data) {
  const { error } = await supabase
    .from('users')
    .upsert({ nick, data }, { onConflict: 'nick' });
  if (error) throw error;
}

// ===== API =====

// POST /login
app.post('/api/login', async (req, res) => {
  const { nick } = req.body;
  if (!nick) return res.status(400).json({ error: 'Ник обязателен' });

  try {
    let userData = await getUser(nick);
    if (!userData) {
      // Создаём нового пользователя
      const defaultState = {
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
        minerCoins: 0,
        minerRunning: false,
        videocards: [],
        purchasedItems: []
      };
      await setUser(nick, defaultState);
      userData = defaultState;
      console.log(`🆕 Создан новый профиль: ${nick}`);
    }
    res.json({ success: true, user: userData });
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
    await setUser(nick, state);
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
  if (!allowed.includes(nick)) return res.status(403).json({ error: 'Доступ запрещён' });

  try {
    // Получаем всех пользователей, обнуляем их top
    const { data, error } = await supabase.from('users').select('nick, data');
    if (error) throw error;
    for (const row of data) {
      const newData = { ...row.data, top: [] };
      await setUser(row.nick, newData);
    }
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
    let state = await getUser(nick);
    if (!state) return res.status(404).json({ error: 'Пользователь не найден' });

    const cardsCatalog = [
      { id: 'gtx1050', name: 'GTX 1050', price: 100, hashrate: 1 },
      { id: 'gtx1660', name: 'GTX 1660', price: 300, hashrate: 3 },
      { id: 'rtx2060', name: 'RTX 2060', price: 600, hashrate: 6 },
      { id: 'rtx3060', name: 'RTX 3060', price: 1200, hashrate: 12 },
      { id: 'rtx4090', name: 'RTX 4090', price: 5000, hashrate: 50 }
    ];
    const card = cardsCatalog.find(c => c.id === cardId);
    if (!card) return res.status(400).json({ error: 'Карта не найдена' });

    if (state.score < card.price) return res.status(400).json({ error: 'Недостаточно очков' });

    let userCard = state.videocards.find(v => v.id === cardId);
    if (userCard) userCard.count += 1;
    else state.videocards.push({ id: cardId, name: card.name, price: card.price, hashrate: card.hashrate, count: 1 });

    state.score -= card.price;
    await setUser(nick, state);
    res.json({ success: true, user: state });
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
    let state = await getUser(nick);
    if (!state) return res.status(404).json({ error: 'Пользователь не найден' });

    const itemsCatalog = [
      { id: 'flying_beaver', name: '🦫 Летающий бобр', price: 100 },
      { id: 'rainbow_trail', name: '🌈 Радужный след', price: 250 },
      { id: 'sparkles', name: '✨ Блестяшки', price: 500 },
      { id: 'ufo', name: '🛸 НЛО', price: 1000 }
    ];
    const item = itemsCatalog.find(it => it.id === itemId);
    if (!item) return res.status(400).json({ error: 'Предмет не найден' });

    if (state.minerCoins < item.price) return res.status(400).json({ error: 'Недостаточно майнер-монет' });
    if (state.purchasedItems.includes(itemId)) return res.status(400).json({ error: 'Уже есть' });

    state.purchasedItems.push(itemId);
    state.minerCoins -= item.price;
    await setUser(nick, state);
    res.json({ success: true, user: state });
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
    let state = await getUser(nick);
    if (!state) return res.status(404).json({ error: 'Пользователь не найден' });

    state.minerRunning = running;
    await setUser(nick, state);
    res.json({ success: true, user: state });
  } catch (err) {
    console.error('Ошибка /toggle-miner:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
