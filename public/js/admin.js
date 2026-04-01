const socket = io();

const questionForm = document.getElementById('questionForm');
const questionInput = document.getElementById('question');
const resetBtn = document.getElementById('resetBtn');
const totalAnswersEl = document.getElementById('totalAnswers');
const uniqueAnswersEl = document.getElementById('uniqueAnswers');
const answersListEl = document.getElementById('answersList');

// Загрузка текущих данных
socket.on('initialData', (data) => {
  questionInput.value = data.question;
  updateStats(data.answers);
  displayAnswers(data.answers);
});

// Обновление ответов
socket.on('answersUpdated', (answers) => {
  updateStats(answers);
  displayAnswers(answers);
});

// Сохранение вопроса
questionForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  
  const question = questionInput.value.trim();
  
  if (!question) {
    showNotification('Введите вопрос', 'error');
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
    }
  } catch (error) {
    showNotification('Ошибка при сохранении', 'error');
  }
});

// Сброс данных
resetBtn.addEventListener('click', async () => {
  if (!confirm('Вы уверены, что хотите удалить все ответы?')) {
    return;
  }

  try {
    const response = await fetch('/api/survey/reset', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' }
    });

    if (response.ok) {
      showNotification('Все ответы удалены', 'success');
    }
  } catch (error) {
    showNotification('Ошибка при сбросе', 'error');
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

  answersListEl.innerHTML = `
    <table style="width: 100%; border-collapse: collapse;">
      <thead>
        <tr style="border-bottom: 2px solid #E0E0E0;">
          <th style="text-align: left; padding: 12px;">Ответ</th>
          <th style="text-align: right; padding: 12px;">Количество</th>
        </tr>
      </thead>
      <tbody>
        ${sortedAnswers.map(([answer, count]) => `
          <tr style="border-bottom: 1px solid #F0F0F0;">
            <td style="padding: 12px; text-transform: capitalize;">${answer}</td>
            <td style="text-align: right; padding: 12px; font-weight: 600; color: var(--primary-color);">
              ${count}
            </td>
          </tr>
        `).join('')}
      </tbody>
    </table>
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