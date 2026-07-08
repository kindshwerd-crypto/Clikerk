const express = require('express');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, '/')));

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('❌ Ошибка: SUPABASE_URL или SUPABASE_KEY не заданы!');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

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

app.post('/api/login', async (req, res) => {
  const { nick } = req.body;
  if (!nick) return res.status(400).json({ error: 'Ник обязателен' });

  try {
    let userData = await getUser(nick);
    if (!userData) {
      const FOUR_HOURS = 4 * 60 * 60 * 1000;
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
        purchasedItems: [],
        updateTimerEnd: Date.now() + FOUR_HOURS // <-- Таймер
      };
      await setUser(nick, defaultState);
      userData = defaultState;
    }
    res.json({ success: true, user: userData });
  } catch (err) {
    console.error('Ошибка /login:', err);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});

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

// Остальные эндпоинты (/reset-top, /buy-videocard, /buy-item, /toggle-miner) остаются без изменений.
// (Я их не повторяю для краткости, они такие же, как в предыдущем полном коде.)

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
});
