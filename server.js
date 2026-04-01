const express = require('express');
const fs = require('fs');
const path = require('path');
const cors = require('cors');

const app = express();
const PORT = 3000;

app.use(express.json());
app.use(cors());
app.use(express.static('public'));

const DB_FILE = './database/db.json';

// Инициализация БД
if (!fs.existsSync('./database')) {
  fs.mkdirSync('./database');
}

if (!fs.existsSync(DB_FILE)) {
  fs.writeFileSync(DB_FILE, JSON.stringify({ movies: [] }));
}

// Чтение данных
function readDB() {
  const data = fs.readFileSync(DB_FILE, 'utf8');
  return JSON.parse(data);
}

// Запись данных
function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2));
}

// API: Получить все ответы
app.get('/api/movies', (req, res) => {
  const db = readDB();
  res.json(db.movies);
});

// API: Добавить ответ
app.post('/api/movies', (req, res) => {
  const { title } = req.body;
  
  if (!title || title.trim().length === 0) {
    return res.status(400).json({ error: 'Название фильма не может быть пустым' });
  }

  const db = readDB();
  
  // Проверка лимита (10 ответов)
  if (db.movies.length >= 10) {
    return res.status(403).json({ error: 'Опрос завершён' });
  }

  const newMovie = {
    id: Date.now(),
    title: title.trim(),
    timestamp: new Date().toISOString()
  };

  db.movies.push(newMovie);
  writeDB(db);

  res.status(201).json({
    success: true,
    movie: newMovie,
    count: db.movies.length
  });
});

// API: Сбросить опрос
app.delete('/api/movies', (req, res) => {
  writeDB({ movies: [] });
  res.json({ success: true, message: 'Опрос сброшен' });
});

// API: Статистика
app.get('/api/stats', (req, res) => {
  const db = readDB();
  const movies = db.movies.map(m => m.title);
  const counts = {};

  movies.forEach(movie => {
    const normalized = movie.toLowerCase();
    counts[normalized] = (counts[normalized] || 0) + 1;
  });

  const topMovie = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])[0];

  res.json({
    total: movies.length,
    unique: Object.keys(counts).length,
    topMovie: topMovie ? { title: topMovie[0], count: topMovie[1] } : null,
    wordList: Object.entries(counts).map(([title, count]) => [title, count * 20])
  });
});

app.listen(PORT, () => {
  console.log(`✅ Сервер запущен на http://localhost:${PORT}`);
});