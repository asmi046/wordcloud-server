const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const path = require('path');
const ExcelJS = require('exceljs');
const fs = require('fs');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

const PORT = 3000;

// Путь к файлу справочника
const QUESTIONS_DB_PATH = path.join(__dirname, 'questions_db.json');

// Хранилище данных с историей
let surveyData = {
  question: '',
  answers: {},
  history: []
};

// История вопросов
let questionHistory = [];

// Справочник вопросов
let questionsLibrary = [];

// Загрузка справочника при запуске
function loadQuestionsLibrary() {
  try {
    if (fs.existsSync(QUESTIONS_DB_PATH)) {
      const data = fs.readFileSync(QUESTIONS_DB_PATH, 'utf8');
      questionsLibrary = JSON.parse(data);
      console.log(`✅ Загружено ${questionsLibrary.length} вопросов из справочника`);
    } else {
      // Создаем файл с примерами вопросов
      questionsLibrary = [
        {
          id: 1,
          text: 'Какой ваш любимый цвет?',
          category: 'Общие',
          createdAt: new Date().toISOString()
        },
        {
          id: 2,
          text: 'Какое ваше хобби?',
          category: 'Общие',
          createdAt: new Date().toISOString()
        },
        {
          id: 3,
          text: 'Что вам больше всего понравилось на мероприятии?',
          category: 'Обратная связь',
          createdAt: new Date().toISOString()
        }
      ];
      saveQuestionsLibrary();
    }
  } catch (error) {
    console.error('❌ Ошибка загрузки справочника:', error);
    questionsLibrary = [];
  }
}

// Сохранение справочника
function saveQuestionsLibrary() {
  try {
    fs.writeFileSync(QUESTIONS_DB_PATH, JSON.stringify(questionsLibrary, null, 2), 'utf8');
    console.log('💾 Справочник вопросов сохранен');
  } catch (error) {
    console.error('❌ Ошибка сохранения справочника:', error);
  }
}

// Загружаем справочник при старте
loadQuestionsLibrary();

// Middleware
app.use(express.static(path.join(__dirname, 'public')));
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

// API endpoints для опросов
app.get('/api/survey', (req, res) => {
  res.json(surveyData);
});

app.get('/api/survey/history', (req, res) => {
  res.json(questionHistory);
});

app.post('/api/survey/question', (req, res) => {
  const newQuestion = req.body.question;

  if (surveyData.question !== newQuestion && Object.keys(surveyData.answers).length > 0) {
    const currentQuestion = questionHistory.find(q => q.question === surveyData.question);
    if (currentQuestion) {
      currentQuestion.answers = [...surveyData.history];
      currentQuestion.completedAt = new Date();
    }
  }

  surveyData.question = newQuestion;
  surveyData.answers = {};
  surveyData.history = [];

  questionHistory.push({
    id: questionHistory.length + 1,
    question: newQuestion,
    createdAt: new Date(),
    answers: []
  });

  io.emit('questionUpdated', surveyData.question);
  io.emit('surveyReset', surveyData);

  res.json({ success: true });
});

app.post('/api/survey/reset', (req, res) => {
  const currentQuestion = questionHistory.find(q => q.question === surveyData.question);
  if (currentQuestion && surveyData.history.length > 0) {
    currentQuestion.answers = [...surveyData.history];
    currentQuestion.completedAt = new Date();
  }

  surveyData.answers = {};
  surveyData.history = [];

  io.emit('surveyReset', surveyData);
  res.json({ success: true });
});

// API endpoints для справочника вопросов
app.get('/api/questions-library', (req, res) => {
  res.json(questionsLibrary);
});

app.post('/api/questions-library', (req, res) => {
  const { text, category } = req.body;

  if (!text || text.trim() === '') {
    return res.status(400).json({ error: 'Текст вопроса не может быть пустым' });
  }

  const newQuestion = {
    id: questionsLibrary.length > 0 ? Math.max(...questionsLibrary.map(q => q.id)) + 1 : 1,
    text: text.trim(),
    category: category || 'Без категории',
    createdAt: new Date().toISOString(),
    usageCount: 0
  };

  questionsLibrary.push(newQuestion);
  saveQuestionsLibrary();

  res.json({ success: true, question: newQuestion });
});

app.put('/api/questions-library/:id', (req, res) => {
  const id = parseInt(req.params.id);
  const { text, category } = req.body;

  const question = questionsLibrary.find(q => q.id === id);

  if (!question) {
    return res.status(404).json({ error: 'Вопрос не найден' });
  }

  if (text) question.text = text.trim();
  if (category) question.category = category;
  question.updatedAt = new Date().toISOString();

  saveQuestionsLibrary();

  res.json({ success: true, question });
});

app.delete('/api/questions-library/:id', (req, res) => {
  const id = parseInt(req.params.id);

  const index = questionsLibrary.findIndex(q => q.id === id);

  if (index === -1) {
    return res.status(404).json({ error: 'Вопрос не найден' });
  }

  questionsLibrary.splice(index, 1);
  saveQuestionsLibrary();

  res.json({ success: true });
});

// Использовать вопрос из справочника
app.post('/api/questions-library/:id/use', (req, res) => {
  const id = parseInt(req.params.id);

  const question = questionsLibrary.find(q => q.id === id);

  if (!question) {
    return res.status(404).json({ error: 'Вопрос не найден' });
  }

  // Увеличиваем счетчик использования
  question.usageCount = (question.usageCount || 0) + 1;
  question.lastUsed = new Date().toISOString();
  saveQuestionsLibrary();

  // Активируем вопрос
  if (surveyData.question !== question.text && Object.keys(surveyData.answers).length > 0) {
    const currentQuestion = questionHistory.find(q => q.question === surveyData.question);
    if (currentQuestion) {
      currentQuestion.answers = [...surveyData.history];
      currentQuestion.completedAt = new Date();
    }
  }

  surveyData.question = question.text;
  surveyData.answers = {};
  surveyData.history = [];

  questionHistory.push({
    id: questionHistory.length + 1,
    question: question.text,
    createdAt: new Date(),
    answers: []
  });

  io.emit('questionUpdated', surveyData.question);
  io.emit('surveyReset', surveyData);

  res.json({ success: true, question });
});

// Экспорт в Excel
app.get('/api/export/excel', async (req, res) => {
  try {
    const workbook = new ExcelJS.Workbook();

    workbook.creator = 'МАХ Messenger Survey';
    workbook.created = new Date();
    workbook.modified = new Date();

    const summarySheet = workbook.addWorksheet('Общая статистика', {
      properties: { tabColor: { argb: '6C5CE7' } }
    });

    summarySheet.columns = [
      { header: '№', key: 'number', width: 10 },
      { header: 'Вопрос', key: 'question', width: 50 },
      { header: 'Всего ответов', key: 'total', width: 15 },
      { header: 'Уникальных ответов', key: 'unique', width: 20 },
      { header: 'Дата создания', key: 'created', width: 20 },
      { header: 'Дата завершения', key: 'completed', width: 20 }
    ];

    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: '6C5CE7' }
    };
    summarySheet.getRow(1).alignment = { vertical: 'middle', horizontal: 'center' };
    summarySheet.getRow(1).height = 25;

    questionHistory.forEach((q, index) => {
      const totalAnswers = q.answers.length;
      const uniqueAnswers = new Set(q.answers.map(a => a.answer.toLowerCase())).size;

      summarySheet.addRow({
        number: index + 1,
        question: q.question,
        total: totalAnswers,
        unique: uniqueAnswers,
        created: q.createdAt ? new Date(q.createdAt).toLocaleString('ru-RU') : '-',
        completed: q.completedAt ? new Date(q.completedAt).toLocaleString('ru-RU') : 'В процессе'
      });
    });

    if (surveyData.history.length > 0) {
      const totalAnswers = surveyData.history.length;
      const uniqueAnswers = Object.keys(surveyData.answers).length;

      summarySheet.addRow({
        number: questionHistory.length + 1,
        question: surveyData.question + ' (текущий)',
        total: totalAnswers,
        unique: uniqueAnswers,
        created: new Date().toLocaleString('ru-RU'),
        completed: 'В процессе'
      });
    }

    for (let i = 0; i < questionHistory.length; i++) {
      const q = questionHistory[i];
      if (q.answers.length === 0) continue;

      const sheetName = `Вопрос ${i + 1}`;
      const sheet = workbook.addWorksheet(sheetName);

      sheet.mergeCells('A1:D1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = q.question;
      titleCell.font = { bold: true, size: 14, color: { argb: '6C5CE7' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E8E4FF' }
      };
      sheet.getRow(1).height = 30;

      sheet.columns = [
        { header: '№', key: 'number', width: 10 },
        { header: 'Ответ', key: 'answer', width: 40 },
        { header: 'Дата и время', key: 'timestamp', width: 25 },
        { header: 'IP адрес', key: 'ip', width: 20 }
      ];

      sheet.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '6C5CE7' }
      };
      sheet.getRow(2).alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getRow(2).height = 20;

      q.answers.forEach((answer, index) => {
        sheet.addRow({
          number: index + 1,
          answer: answer.answer,
          timestamp: new Date(answer.timestamp).toLocaleString('ru-RU'),
          ip: answer.ip || '-'
        });
      });

      const lastRow = sheet.lastRow.number;
      for (let row = 2; row <= lastRow; row++) {
        for (let col = 1; col <= 4; col++) {
          const cell = sheet.getRow(row).getCell(col);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }

      sheet.addRow([]);
      sheet.addRow(['Статистика по ответам:']).font = { bold: true, size: 12 };

      const answerStats = {};
      q.answers.forEach(a => {
        const normalized = a.answer.toLowerCase();
        answerStats[normalized] = (answerStats[normalized] || 0) + 1;
      });

      const sortedStats = Object.entries(answerStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);

      sheet.addRow(['Ответ', 'Количество', 'Процент']);
      sheet.lastRow.font = { bold: true };
      sheet.lastRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E8E4FF' }
      };

      sortedStats.forEach(([answer, count]) => {
        const percentage = ((count / q.answers.length) * 100).toFixed(1);
        sheet.addRow([
          answer.charAt(0).toUpperCase() + answer.slice(1),
          count,
          `${percentage}%`
        ]);
      });
    }

    if (surveyData.history.length > 0) {
      const sheetName = 'Текущий опрос';
      const sheet = workbook.addWorksheet(sheetName);

      sheet.mergeCells('A1:D1');
      const titleCell = sheet.getCell('A1');
      titleCell.value = surveyData.question + ' (текущий опрос)';
      titleCell.font = { bold: true, size: 14, color: { argb: '6C5CE7' } };
      titleCell.alignment = { vertical: 'middle', horizontal: 'left' };
      titleCell.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E8E4FF' }
      };
      sheet.getRow(1).height = 30;

      sheet.columns = [
        { header: '№', key: 'number', width: 10 },
        { header: 'Ответ', key: 'answer', width: 40 },
        { header: 'Дата и время', key: 'timestamp', width: 25 },
        { header: 'IP адрес', key: 'ip', width: 20 }
      ];

      sheet.getRow(2).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(2).fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: '6C5CE7' }
      };
      sheet.getRow(2).alignment = { vertical: 'middle', horizontal: 'center' };
      sheet.getRow(2).height = 20;

      surveyData.history.forEach((answer, index) => {
        sheet.addRow({
          number: index + 1,
          answer: answer.answer,
          timestamp: new Date(answer.timestamp).toLocaleString('ru-RU'),
          ip: answer.ip || '-'
        });
      });

      const lastRow = sheet.lastRow.number;
      for (let row = 2; row <= lastRow; row++) {
        for (let col = 1; col <= 4; col++) {
          const cell = sheet.getRow(row).getCell(col);
          cell.border = {
            top: { style: 'thin' },
            left: { style: 'thin' },
            bottom: { style: 'thin' },
            right: { style: 'thin' }
          };
        }
      }

      sheet.addRow([]);
      sheet.addRow(['Статистика по ответам:']).font = { bold: true, size: 12 };

      const sortedStats = Object.entries(surveyData.answers)
        .sort((a, b) => b[1] - a[1]);

      sheet.addRow(['Ответ', 'Количество', 'Процент']);
      sheet.lastRow.font = { bold: true };
      sheet.lastRow.fill = {
        type: 'pattern',
        pattern: 'solid',
        fgColor: { argb: 'E8E4FF' }
      };

      sortedStats.forEach(([answer, count]) => {
        const percentage = ((count / surveyData.history.length) * 100).toFixed(1);
        sheet.addRow([
          answer.charAt(0).toUpperCase() + answer.slice(1),
          count,
          `${percentage}%`
        ]);
      });
    }

    const fileName = `max_survey_${new Date().toISOString().split('T')[0]}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=${fileName}`);

    await workbook.xlsx.write(res);
    res.end();

    console.log(`✅ Экспорт выполнен: ${fileName}`);
  } catch (error) {
    console.error('❌ Ошибка экспорта:', error);
    res.status(500).json({ error: 'Ошибка при создании Excel файла' });
  }
});

// Socket.IO
io.on('connection', (socket) => {
  console.log('✅ Новое подключение:', socket.id);

  socket.emit('initialData', surveyData);

  socket.on('submitAnswer', (answer) => {
    const normalizedAnswer = answer.trim().toLowerCase();

    if (normalizedAnswer) {
      if (surveyData.answers[normalizedAnswer]) {
        surveyData.answers[normalizedAnswer]++;
      } else {
        surveyData.answers[normalizedAnswer] = 1;
      }

      surveyData.history.push({
        answer: answer.trim(),
        timestamp: new Date(),
        ip: socket.handshake.address
      });

      io.emit('answersUpdated', surveyData.answers);
      console.log('📝 Новый ответ:', normalizedAnswer, 'Всего:', surveyData.answers[normalizedAnswer]);
    }
  });

  socket.on('disconnect', () => {
    console.log('❌ Отключение:', socket.id);
  });
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════╗
║   🚀 МАХ Survey запущен на http://localhost:${PORT}    ║
║                                                       ║
║   📄 Страницы:                                        ║
║   • Опрос: http://localhost:${PORT}/                  ║
║   • Админ: http://localhost:${PORT}/admin             ║
║   • Облако: http://localhost:${PORT}/cloud            ║
║                                                       ║
║   📚 Справочник: ${questionsLibrary.length} вопросов               ║
╚═══════════════════════════════════════════════════════╝
  `);
});