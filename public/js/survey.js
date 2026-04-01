const socket = io();

const answerForm = document.getElementById('answerForm');
const answerInput = document.getElementById('answer');
const questionTextEl = document.getElementById('questionText');

// Загрузка вопроса
socket.on('initialData', (data) => {
  questionTextEl.textContent = data.question;
});

socket.on('questionUpdated', (question) => {
  questionTextEl.textContent = question;
});

// Отправка ответа
answerForm.addEventListener('submit', (e) => {
  e.preventDefault();
  
  const answer = answerInput.value.trim();
  
  if (!answer) {
    showNotification('Введите ответ', 'error');
    return;
  }

  socket.emit('submitAnswer', answer);
  answerInput.value = '';
  showNotification('Спасибо за ваш ответ!', 'success');
  
  // Плавная анимация
  answerForm.style.transform = 'scale(0.98)';
  setTimeout(() => {
    answerForm.style.transform = 'scale(1)';
  }, 100);
});

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