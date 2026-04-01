const socket = io();

const tagCloudEl = document.getElementById('tagCloud');
const questionTextEl = document.getElementById('questionText');
const totalAnswersEl = document.getElementById('totalAnswers');
const uniqueAnswersEl = document.getElementById('uniqueAnswers');

let currentAnswers = {};
let placedTags = []; // Массив для хранения позиций размещенных тегов

// Загрузка данных
socket.on('initialData', (data) => {
  questionTextEl.textContent = data.question;
  currentAnswers = data.answers;
  updateStats();
  renderCloud();
});

socket.on('answersUpdated', (answers) => {
  currentAnswers = answers;
  updateStats();
  renderCloud();
});

socket.on('surveyReset', (data) => {
  currentAnswers = {};
  updateStats();
  renderCloud();
});

socket.on('questionUpdated', (question) => {
  questionTextEl.textContent = question;
});

// Обновление статистики
function updateStats() {
  const total = Object.values(currentAnswers).reduce((sum, count) => sum + count, 0);
  const unique = Object.keys(currentAnswers).length;
  
  totalAnswersEl.textContent = total;
  uniqueAnswersEl.textContent = unique;
}

// Генерация цвета на основе строки
function stringToColor(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  
  const hue = hash % 360;
  return `hsl(${hue}, 70%, 55%)`;
}

// Проверка пересечения двух прямоугольников
function isOverlapping(rect1, rect2, padding = 10) {
  return !(
    rect1.right + padding < rect2.left ||
    rect1.left - padding > rect2.right ||
    rect1.bottom + padding < rect2.top ||
    rect1.top - padding > rect2.bottom
  );
}

// Поиск свободной позиции для тега
function findPosition(width, height, tagWidth, tagHeight, attempts = 100) {
  const margin = 20; // Отступ от краев
  
  for (let i = 0; i < attempts; i++) {
    // Генерация случайной позиции
    const x = margin + Math.random() * (width - tagWidth - margin * 2);
    const y = margin + Math.random() * (height - tagHeight - margin * 2);
    
    const newRect = {
      left: x,
      top: y,
      right: x + tagWidth,
      bottom: y + tagHeight
    };
    
    // Проверка на пересечение с уже размещенными тегами
    const hasOverlap = placedTags.some(rect => isOverlapping(newRect, rect));
    
    if (!hasOverlap) {
      placedTags.push(newRect);
      return { x, y };
    }
  }
  
  // Если не нашли свободное место за N попыток, используем спиральный алгоритм
  return findPositionSpiral(width, height);
}

// Резервный спиральный алгоритм (если не удалось найти случайную позицию)
function findPositionSpiral(width, height) {
  const centerX = width / 2;
  const centerY = height / 2;
  const angle = placedTags.length * 0.5;
  const radius = placedTags.length * 8;
  
  const x = centerX + radius * Math.cos(angle);
  const y = centerY + radius * Math.sin(angle);
  
  return { x, y };
}

// Рендер облака тегов
function renderCloud() {
  if (Object.keys(currentAnswers).length === 0) {
    tagCloudEl.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">💭</div>
        <div class="empty-state-text">Ожидание ответов участников...</div>
      </div>
    `;
    return;
  }

  const width = tagCloudEl.offsetWidth;
  const height = tagCloudEl.offsetHeight;

  // Нормализация размеров
  const maxCount = Math.max(...Object.values(currentAnswers));
  const minCount = Math.min(...Object.values(currentAnswers));
  
  const tags = Object.entries(currentAnswers).map(([text, count]) => {
    // Размер от 16px до 72px (более заметная разница)
    const fontSize = 16 + ((count - minCount) / (maxCount - minCount || 1)) * 56;
    
    return { text, count, fontSize };
  });

  // Сортировка по частоте (самые популярные размещаются первыми)
  tags.sort((a, b) => b.count - a.count);

  tagCloudEl.innerHTML = '';
  placedTags = []; // Сброс массива размещенных тегов

  tags.forEach((tag, index) => {
    const tagEl = document.createElement('div');
    tagEl.className = 'tag';
    tagEl.textContent = tag.text.charAt(0).toUpperCase() + tag.text.slice(1);
    tagEl.style.fontSize = `${tag.fontSize}px`;
    tagEl.style.color = stringToColor(tag.text);
    tagEl.style.fontWeight = tag.count > maxCount * 0.7 ? '700' : '600';
    
    // Временное добавление в DOM для получения размеров
    tagEl.style.visibility = 'hidden';
    tagEl.style.position = 'absolute';
    tagCloudEl.appendChild(tagEl);
    
    // Получение реальных размеров тега
    const tagWidth = tagEl.offsetWidth;
    const tagHeight = tagEl.offsetHeight;
    
    // Поиск позиции
    let position;
    if (index === 0) {
      // Самый популярный тег размещаем ближе к центру
      const centerX = width / 2;
      const centerY = height / 2;
      position = {
        x: centerX - tagWidth / 2 + (Math.random() - 0.5) * 100,
        y: centerY - tagHeight / 2 + (Math.random() - 0.5) * 100
      };
      placedTags.push({
        left: position.x,
        top: position.y,
        right: position.x + tagWidth,
        bottom: position.y + tagHeight
      });
    } else {
      position = findPosition(width, height, tagWidth, tagHeight);
    }
    
    // Применение позиции
    tagEl.style.left = `${position.x}px`;
    tagEl.style.top = `${position.y}px`;
    tagEl.style.visibility = 'visible';
    tagEl.style.opacity = '0';
    
    // Добавление тултипа с количеством
    tagEl.title = `${tag.text}: ${tag.count} ${tag.count === 1 ? 'ответ' : tag.count < 5 ? 'ответа' : 'ответов'}`;
    
    // Анимация появления с задержкой
    setTimeout(() => {
      tagEl.style.opacity = '1';
      tagEl.style.transform = 'scale(1)';
    }, index * 80);
  });
}

// Перерисовка при изменении размера окна
let resizeTimeout;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimeout);
  resizeTimeout = setTimeout(renderCloud, 250);
});