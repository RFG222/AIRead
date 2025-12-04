import { GoogleGenerativeAI } from "@google/generative-ai";

// =========================================================
// !!! ВСТАВЬТЕ СЮДА ВАШ API КЛЮЧ !!!
const API_KEY = "AIzaSyBIqPB4P6bzr5YsdhBdMxqE_1nSaGhoo6k"; 
// =========================================================

const genAI = new GoogleGenerativeAI(API_KEY);
const MODEL_NAME = "gemini-2.5-flash"; 

const STORAGE_KEY = 'aiLecturesSavedContent'; 

// Элементы DOM
const body = document.body;
const container = document.getElementById('mainContainer');
const fileInput = document.getElementById('fileInput');
const uploadLabel = document.getElementById('uploadLabel');
const resultArea = document.getElementById('result-area');
const loader = document.getElementById('loader');
const preview = document.getElementById('preview');
const errorMsg = document.getElementById('error-msg');
const shrinkBtn = document.getElementById('shrinkBtn');
const saveBtn = document.getElementById('saveBtn');
const helpModal = document.getElementById('helpModal');

let lastFullContent = ""; 

// === АВТОСОХРАНЕНИЕ ===
function saveContent() {
    try { localStorage.setItem(STORAGE_KEY, resultArea.innerHTML); } 
    catch (e) { console.error("Ошибка сохранения:", e); }
}

function loadContent() {
    try {
        const savedContent = localStorage.getItem(STORAGE_KEY);
        if (savedContent) {
            resultArea.innerHTML = savedContent;
            lastFullContent = savedContent; 
        }
    } catch (e) { console.error("Ошибка загрузки:", e); }
}

function clearStorage() {
    try { localStorage.removeItem(STORAGE_KEY); } 
    catch (e) { console.error("Ошибка очистки:", e); }
}

// === ГЛОБАЛЬНЫЕ ФУНКЦИИ (window) ===
window.openModal = function() { helpModal.style.display = "block"; }
window.closeModal = function() { helpModal.style.display = "none"; }
window.onclick = function(event) { if (event.target == helpModal) helpModal.style.display = "none"; }

window.toggleLayout = function() {
    const isSplit = container.classList.toggle('split-mode');
    const btn = document.getElementById('toggleLayoutBtn');
    if (isSplit) {
        body.style.overflowY = 'hidden';
        btn.innerText = "⊟"; 
    } else {
        body.style.overflowY = 'auto';
        btn.innerText = "◫"; 
    }
}

window.formatText = function(command) {
    document.execCommand(command, false, null);
    resultArea.focus();
    saveContent(); 
}

window.clearContent = function() {
    if (confirm("Очистить конспект?")) {
        resultArea.innerHTML = '';
        lastFullContent = ""; 
        clearStorage(); 
    }
}

window.shrinkAndSaveDoc = async function() {
    if (!lastFullContent.trim()) { alert("Сначала загрузите изображение!"); return; }
    setInterfaceLoading(true);
    shrinkBtn.innerText = "⏳ Сжимаю...";
    loader.style.display = 'block';
    
    let compressedHTML = "";
    try {
        const model = genAI.getGenerativeModel({ model: MODEL_NAME });
        const shrinkPrompt = `Сократи текст на 40%, оставив суть. Сохрани HTML (<h1>, <ul>). Верни ТОЛЬКО HTML: ${lastFullContent}`;
        const result = await model.generateContent([shrinkPrompt]);
        compressedHTML = result.response.text().replace(/```html/g, "").replace(/```/g, "").trim();
    } catch (error) {
        alert("Ошибка сжатия.");
        compressedHTML = lastFullContent; 
    } finally {
        loader.style.display = 'none';
        setInterfaceLoading(false);
    }
    saveAsDocx(compressedHTML, 'Сокращенный_Конспект_');
}

window.saveDoc = function() {
    const contentToSave = resultArea.innerHTML.trim() ? resultArea.innerHTML : lastFullContent;
    saveAsDocx(contentToSave, 'Полный_Конспект_');
}

// === ОБРАБОТКА ФАЙЛОВ ===
fileInput.addEventListener('change', async (e) => {
    const files = e.target.files;
    if (files.length === 0) return;

    setInterfaceLoading(true);
    preview.style.display = 'none'; 
    errorMsg.style.display = 'none';

    if (window.innerWidth > 800 && !container.classList.contains('split-mode')) {
       toggleLayout(); 
    }

    resultArea.style.opacity = "0.7";
    let allGeneratedText = "";
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        loader.innerText = `⚡ Анализ файла ${i + 1} из ${files.length}...`; // Без имени файла, чтобы избежать ошибок кодировки
        loader.style.display = 'block';

        if (i === 0) {
            preview.src = URL.createObjectURL(file);
            preview.style.display = 'block';
        }

        try {
            let imagePart = await compressAndConvertFile(file);
            const model = genAI.getGenerativeModel({ model: MODEL_NAME });
            const prompt = `Ты - помощник студента. Проанализируй изображение. 1. Распознай весь текст. 2. Исправь ошибки. 3. Оформи результат СТРОГО В HTML: <h1>, <h2>, <b>, <ul>, <li>. 4. Верни ТОЛЬКО HTML код.`;
            
            const result = await model.generateContent([prompt, imagePart]);
            let text = result.response.text().replace(/```html/g, "").replace(/```/g, "").trim();
            
            const separator = i > 0 ? "<hr>" : "";
            allGeneratedText += separator + text;
            
        } catch (error) {
            console.error(`API Error:`, error);
            let msg = error.message;
            if (msg.includes("400")) msg = "❌ Ошибка региона (VPN) или API-ключа.";
            errorMsg.innerText = `Ошибка: ${msg}`;
            errorMsg.style.display = 'block';
        } 
    }
    
    const currentContent = resultArea.innerHTML.trim();
    const isPlaceholder = currentContent.includes('Инструкция:');
    const finalSeparator = !isPlaceholder && currentContent.length > 0 ? "<p>&nbsp;</p>" : ""; 
    
    resultArea.innerHTML = isPlaceholder ? allGeneratedText : currentContent + finalSeparator + allGeneratedText;
    
    resultArea.style.opacity = "1";
    lastFullContent = resultArea.innerHTML;
    saveContent(); 
    
    loader.style.display = 'none';
    setInterfaceLoading(false);
});

// === ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ ===
function setInterfaceLoading(isLoading) {
    if (isLoading) {
        shrinkBtn.disabled = true;
        saveBtn.disabled = true;
        uploadLabel.classList.add('disabled');
        fileInput.disabled = true;
    } else {
        shrinkBtn.disabled = false;
        saveBtn.disabled = false;
        uploadLabel.classList.remove('disabled');
        fileInput.disabled = false;
        shrinkBtn.innerText = "✨ Сжать и Скачать (Сокращенный)";
    }
}

async function compressAndConvertFile(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = (event) => {
            const img = new Image();
            img.onload = () => {
                const MAX_WIDTH = 1200;
                let width = img.width;
                let height = img.height;
                if (width > MAX_WIDTH) { height *= MAX_WIDTH / width; width = MAX_WIDTH; }
                const canvas = document.createElement('canvas');
                canvas.width = width; canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                const dataUrl = canvas.toDataURL('image/jpeg', 0.9); 
                resolve({ inlineData: { data: dataUrl.split(',')[1], mimeType: 'image/jpeg' } });
            };
            img.src = event.target.result;
        };
        reader.readAsDataURL(file);
    });
}

function saveAsDocx(htmlContent, filenamePrefix) {
    const header = `<html xmlns:o='urn:schemas-microsoft-com:office:office' xmlns:w='urn:schemas-microsoft-com:office:word' xmlns='http://www.w3.org/TR/REC-html40'><head><meta charset='utf-8'><style>body { font-family: 'Times New Roman', serif; font-size: 14pt; } h1, h2, h3 { font-size: 16pt; }</style></head><body>`;
    const footer = "</body></html>";
    const fullHTML = header + htmlContent + footer;
    const blob = new Blob(['\ufeff' + fullHTML], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${filenamePrefix}${new Date().toLocaleDateString('ru-RU')}.doc`;
    a.click();
}

// Инициализация
resultArea.addEventListener('input', saveContent);
document.addEventListener('DOMContentLoaded', loadContent);
