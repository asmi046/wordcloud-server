const socket = io();

const questionForm = document.getElementById('questionForm');
const questionInput = document.getElementById('question');
const resetBtn = document.getElementById('resetBtn');
const exportBtn = document.getElementById('exportBtn');
const totalAnswersEl = document.getElementById('totalAnswers');
const uniqueAnswersEl = document.getElementById('uniqueAnswers');
const totalQuestionsEl = document.getElementById('totalQuestions');
const answersListEl = document.getElementById('answersList');
const historyListEl = document.getElementById('historyList');

// Элементы справочника
const addToLibraryForm = document.getElementById('addToLibraryForm');
const libraryQuestionText = document.getElementById('libraryQuestionText');
const libraryQuestionCategory = document.getElementById('libraryQuestionCategory');
const questionLibraryList = document.getElementById('questionLibraryList');

let questionsLibrary = [];

// Загрузка текущих данных
socket.on('initialData', (data) => {
  questionInput.value = data.question;
  updateStats(data.answers);
  displayAnswers(data.answers);
  loadHistory();
  loadQuestionsLibrary();
});

// Обновление ответов
socket.on('answersUpdated', (answers) => {
  updateStats(answers);
  displayAnswers(answers);
});

// Загрузка истории
async function loadHistory() {
  try {
    const response = await fetch('/api/survey/history');
    const history = await response.json();
    displayHistory(history);
    totalQuestionsEl.textContent = history.length;
  } catch (error) {
    console.error('Ошибка загрузки истории:', error);
  }
}

// Загрузка справочника вопросов
async function loadQuestionsLibrary() {
  try {
    const response = await fetch('/api/questions-library');
    questionsLibrary = await response.json();
    displayQuestionsLibrary();
  } catch (error) {
    console.error('Ошибка загрузки справочника:', error);
    showNotification('Ошибка загрузки справочника', 'error');
  }
}

// Отображение справочника вопросов
function displayQuestionsLibrary() {
  if (questionsLibrary.length === 0) {
    questionLibraryList.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">Справочник пуст. Добавьте первый вопрос!</div>
      </div>
    `;
    return;
  }

  // Группируем по категориям
  const grouped = {};
  questionsLibrary.forEach(q => {
    const cat = q.category || 'Без категории';
    if (!grouped[cat]) grouped[cat] = [];
    grouped[cat].push(q);
  });

  let html = '';
  
  Object.keys(grouped).sort().forEach(category => {
    html += `
      <div class="library-category">
        <h3 class="library-category-title">${category}</h3>
        <div class="library-questions">
    `;
    
    grouped[category].forEach(question => {
      const usageInfo = question.usageCount 
        ? `<span class="usage-badge">${question.usageCount} раз</span>` 
        : '';
      
      html += `
        <div class="library-question-item" data-id="${question.id}">
          <div class="library-question-content">
            <div class="library-question-text">${question.text}</div>
            ${usageInfo}
          </div>
          <div class="library-question-actions">
            <button class="btn-icon btn-use" onclick="useQuestion(${question.id})" title="Использовать вопрос">
              ▶️
            </button>
            <button class="btn-icon btn-edit" onclick="editQuestion(${question.id})" title="Редактировать">
              ✏️
            </button>
            <button class="btn-icon btn-delete" onclick="deleteQuestion(${question.id})" title="Удалить">
              🗑️
            </button>
          </div>
        </div>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });

  questionLibraryList.innerHTML = html;
}

// Добавление вопроса в справочник
addToLibraryForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const text = libraryQuestionText.value.trim();
  const category = libraryQuestionCategory.value.trim() || 'Общие';
  
  if (!text) {
    showNotification('Введите текст вопроса', 'error');
    return;
  }

  try {
    const response = await fetch('/api/questions-library', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, category })
    });

    if (response.ok) {
      showNotification('Вопрос добавлен в справочник', 'success');
      libraryQuestionText.value = '';
      loadQuestionsLibrary();
    } else {
      throw new Error('Ошибка при добавлении');
    }
  } catch (error) {
    showNotification('Ошибка при добавлении вопроса', 'error');
  }
});

// Использование вопроса из справочника
async function useQuestion(id) {
  if (!confirm('Активировать этот вопрос? Текущие ответы будут сохранены в истории.')) {
    return;
  }

  try {
    const response = await fetch(`/api/questions-library/${id}/use`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      showNotification('Вопрос активирован!', 'success');
      loadHistory();
      loadQuestionsLibrary();
    } else {
      throw new Error('Ошибка при активации');
    }
  } catch (error) {
    showNotification('Ошибка при активации вопроса', 'error');
  }
}

// Редактирование вопроса
async function editQuestion(id) {
  const question = questionsLibrary.find(q => q.id === id);
  if (!question) return;

  const newText = prompt('Введите новый текст вопроса:', question.text);
  if (!newText || newText.trim() === '') return;

  const newCategory = prompt('Категория:', question.category);

  try {
    const response = await fetch(`/api/questions-library/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        text: newText.trim(), 
        category: newCategory || question.category 
      })
    });

    if (response.ok) {
      showNotification('Вопрос обновлен', 'success');
      loadQuestionsLibrary();
    } else {
      throw new Error('Ошибка при обновлении');
    }
  } catch (error) {
    showNotification('Ошибка при обновлении вопроса', 'error');
  }
}

// Удаление вопроса
async function deleteQuestion(id) {
  if (!confirm('Удалить этот вопрос из справочника?')) {
    return;
  }

  try {
    const response = await fetch(`/api/questions-library/${id}`, {
      method: 'DELETE'
    });

    if (response.ok) {
      showNotification('Вопрос удален', 'success');
      loadQuestionsLibrary();
    } else {
      throw new Error('Ошибка при удалении');
    }
  } catch (error) {
    showNotification('Ошибка при удалении вопроса', 'error');
  }
}

// Отображение истории
function displayHistory(history) {
  if (history.length === 0) {
    historyListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">История опросов пуста</div>
      </div>
    `;
    return;
  }

  historyListEl.innerHTML = `
    <div class="history-list">
      ${history.map((item, index) => `
        <div class="history-item">
          <div class="history-header">
            <span class="history-number">#${index + 1}</span>
            <span class="history-question">${item.question}</span>
          </div>
          <div class="history-meta">
            <span>📅 ${new Date(item.createdAt).toLocaleString('ru-RU')}</span>
            <span>💬 ${item.answers.length} ответов</span>
            ${item.completedAt ? `<span class="status-completed">✅ Завершен</span>` : `<span class="status-active">🔄 Активен</span>`}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

// Сохранение вопроса (ручной ввод)
questionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const question = questionInput.value.trim();
  
  if (!question) {
    showNotification('Введите вопрос', 'error');
    return;
  }

  if (!confirm('Сохранение нового вопроса сбросит текущие ответы. Продолжить?')) {
    return;
  }

  try {
    const response = await fetch('/api/survey/question', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question })
    });

    if (response.ok) {
      showNotification('Вопрос успешно обновлен', 'success');
      loadHistory();
    }
  } catch (error) {
    showNotification('Ошибка при сохранении', 'error');
  }
});

// Сброс данных
resetBtn.addEventListener('click', async () => {
  if (!confirm('Вы уверены, что хотите удалить все ответы текущего опроса? Данные будут сохранены в истории.')) {
    return;
  }

  try {
    const response = await fetch('/api/survey/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      showNotification('Все ответы удалены', 'success');
      loadHistory();
    }
  } catch (error) {
    showNotification('Ошибка при сбросе', 'error');
  }
});

// Экспорт в Excel
exportBtn.addEventListener('click', async () => {
  try {
    exportBtn.disabled = true;
    exportBtn.innerHTML = '<div class="loading"></div> Создание отчета...';
    
    const response = await fetch('/api/export/excel');
    
    if (!response.ok) {
      throw new Error('Ошибка при создании файла');
    }
    
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `max_survey_${new Date().toISOString().split('T')[0]}.xlsx`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);
    
    showNotification('Файл успешно загружен', 'success');
  } catch (error) {
    showNotification('Ошибка при экспорте', 'error');
    console.error(error);
  } finally {
    exportBtn.disabled = false;
    exportBtn.innerHTML = '📥 Скачать Excel отчет (.xlsx)';
  }
});

// Обновление статистики
function updateStats(answers) {
  const total = Object.values(answers).reduce((sum, count) => sum + count, 0);
  const unique = Object.keys(answers).length;
  
  totalAnswersEl.textContent = total;
  uniqueAnswersEl.textContent = unique;
}

// Отображение списка ответов
function displayAnswers(answers) {
  if (Object.keys(answers).length === 0) {
    answersListEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📭</div>
        <div class="empty-state-text">Пока нет ответов</div>
      </div>
    `;
    return;
  }

  const sortedAnswers = Object.entries(answers)
    .sort((a, b) => b[1] - a[1]);
  
  const total = Object.values(answers).reduce((sum, count) => sum + count, 0);

  answersListEl.innerHTML = `
    <div style="overflow-x: auto;">
      <table style="width: 100%; border-collapse: collapse;">
        <thead>
          <tr style="border-bottom: 2px solid #E0E0E0;">
            <th style="text-align: left; padding: 12px;">#</th>
            <th style="text-align: left; padding: 12px;">Ответ</th>
            <th style="text-align: center; padding: 12px;">Количество</th>
            <th style="text-align: center; padding: 12px;">Процент</th>
            <th style="text-align: center; padding: 12px;">График</th>
          </tr>
        </thead>
        <tbody>
          ${sortedAnswers.map(([answer, count], index) => {
            const percentage = ((count / total) * 100).toFixed(1);
            return `
              <tr style="border-bottom: 1px solid #F0F0F0;">
                <td style="padding: 12px; color: var(--text-light);">${index + 1}</td>
                <td style="padding: 12px; text-transform: capitalize; font-weight: 500;">${answer}</td>
                <td style="text-align: center; padding: 12px; font-weight: 600; color: var(--primary);">
                  ${count}
                </td>
                <td style="text-align: center; padding: 12px; font-weight: 600; color: var(--success);">
                  ${percentage}%
                </td>
                <td style="padding: 12px;">
                  <div style="background: #E8E4FF; height: 24px; border-radius: 12px; overflow: hidden;">
                    <div style="background: var(--gradient-primary); height: 100%; width: ${percentage}%; transition: width 0.3s;"></div>
                  </div>
                </td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    </div>
  `;
}

// Уведомления
function showNotification(message, type) {
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.remove();
  }, 3000);
}

// Начальная загрузка
loadHistory();
loadQuestionsLibrary();