const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;

// Хранилище данных
let surveyData = {
  question: 'Какой фильм тебе нравится больше всего?',
  answers: {} // { "матрица": 5, "аватар": 3 }
};

// Middleware
app.use(express.static('public'));
app.use(express.json());

// Маршруты для страниц
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'survey.html'));
});

app.get('/admin', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'admin.html'));
});

app.get('/cloud', (req, res) => {
  res.sendFile(path.join(__dirname, 'views', 'cloud.html'));
});

// API endpoints
app.get('/api/survey', (req, res) => {
  res.json(surveyData);
});

app.post('/api/survey/question', (req, res) => {
  surveyData.question = req.body.question;
  io.emit('questionUpdated', surveyData.question);
  res.json({ success: true });
});

app.post('/api/survey/reset', (req, res) => {
  surveyData.answers = {};
  io.emit('surveyReset', surveyData);
  res.json({ success: true });
});

// Socket.IO для реального времени
io.on('connection', (socket) => {
  console.log('Новое подключение:', socket.id);

  // Отправка текущих данных новому клиенту
  socket.emit('initialData', surveyData);

  // Обработка нового ответа
  socket.on('submitAnswer', (answer) => {
    const normalizedAnswer = answer.trim().toLowerCase();

    if (normalizedAnswer) {
      if (surveyData.answers[normalizedAnswer]) {
        surveyData.answers[normalizedAnswer]++;
      } else {
        surveyData.answers[normalizedAnswer] = 1;
      }

      // Отправка обновленных данных всем клиентам
      io.emit('answersUpdated', surveyData.answers);
      console.log('Новый ответ:', normalizedAnswer, 'Всего:', surveyData.answers[normalizedAnswer]);
    }
  });

  socket.on('disconnect', () => {
    console.log('Отключение:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   Сервер запущен на http://localhost:${PORT}           ║
║                                                       ║
║   Страницы:                                          ║
║   • Опрос: http://localhost:${PORT}/                  ║
║   • Админ: http://localhost:${PORT}/admin             ║
║   • Облако: http://localhost:${PORT}/cloud            ║
╚═══════════════════════════════════════════════════════╝
  `);
});