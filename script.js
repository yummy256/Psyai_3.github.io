// --- 全局变量定义 ---
let rasaApiUrl = localStorage.getItem('rasaApiUrl') || "http://localhost:5005/webhooks/rest/webhook";
const SENDER_ID = "test_user_" + Math.random().toString(36).substr(2, 8);
let activeView = 'chat';
let isPanelOpen = true;
let chatMessages = document.getElementById('chatMessages');
let messages = [];
let inputMessage = document.getElementById('inputMessage');
let isLoading = false;
let inputFocused = false;
let historySessions = JSON.parse(localStorage.getItem('historySessions')) || [];
let emotionData = [];
let currentEmotion = '中性';
let lastMessageEmotion = '中性';

// 情感对应emoji映射
const emotionEmojiMap = {
    '积极': '😊',
    '中性': '😐',
    '消极': '😔'
};

// --- DOM加载完成后初始化 ---
document.addEventListener('DOMContentLoaded', function () {
    // 初始化API地址输入框
    document.getElementById('rasaApiUrl').value = rasaApiUrl;

    // 绑定侧边栏点击事件
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        item.addEventListener('click', function () {
            const view = this.getAttribute('data-view');
            switchView(view);
        });
    });

    // 绑定输入框字数统计事件
    inputMessage.addEventListener('input', function () {
        document.getElementById('wordCount').textContent = this.value.length + '/500';
        // 启用/禁用发送按钮
        document.getElementById('sendBtn').disabled = !this.value.trim();
    });

    // 初始化历史会话列表
    renderHistoryList();

    // 初始化emoji显示
    updateEmojiDisplay();

    // 滚动到底部
    scrollToBottom();
    
    // 添加批量删除按钮
    addBatchDeleteButton();
});

// --- 工具函数 ---
// 格式化时间
function formatTime(time) {
    return new Date(time).toLocaleString();
}

// 情感分析（基于关键词）
function analyzeEmotion(content) {
    content = content.toLowerCase();
    
    // 积极关键词
    const positiveWords = ['开心', '高兴', '快乐', '喜欢', '爱', '棒', '好', '谢谢', '感谢', '不错', '美丽', '漂亮', '完美', '赞', '棒极了', '幸福', '幸运'];
    // 消极关键词  
    const negativeWords = ['伤心', '难过', '悲伤', '生气', '愤怒', '讨厌', '恨', '不好', '糟糕', '差', '烦', '郁闷', '痛苦', '失望', '绝望', '难过死了', '气死了'];
    
    let positiveCount = 0;
    let negativeCount = 0;
    
    positiveWords.forEach(word => {
        if (content.includes(word.toLowerCase())) positiveCount++;
    });
    
    negativeWords.forEach(word => {
        if (content.includes(word.toLowerCase())) negativeCount++;
    });
    
    // 基于关键词数量判断情感
    let emotion;
    if (positiveCount > negativeCount) {
        emotion = '积极';
    } else if (negativeCount > positiveCount) {
        emotion = '消极';
    } else {
        // 如果都没有或相等，根据语气词判断
        if (content.includes('?') || content.includes('？') || content.includes('呢') || content.includes('吗')) {
            emotion = '中性';
        } else if (content.includes('!') || content.includes('！')) {
            emotion = Math.random() > 0.5 ? '积极' : '消极';
        } else {
            emotion = '中性';
        }
    }
    
    emotionData.push(emotion);
    lastMessageEmotion = emotion;

    // 更新当前情感（取最近3条的多数）
    const recentEmotions = emotionData.slice(-3);
    const count = {};
    recentEmotions.forEach(e => count[e] = (count[e] || 0) + 1);
    currentEmotion = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || '中性';

    // 更新DOM中的情感显示和emoji
    updateEmotionDOM();
    updateEmojiDisplay();

    return emotion;
}

// 计算情感占比
function calculateEmotionRatio(emotion) {
    if (emotionData.length === 0) return 0;
    const count = emotionData.filter(e => e === emotion).length;
    return Math.round((count / emotionData.length) * 100);
}

// 更新情感相关DOM
function updateEmotionDOM() {
    // 更新占比
    document.getElementById('positiveRatio').textContent = calculateEmotionRatio('积极') + '%';
    document.getElementById('neutralRatio').textContent = calculateEmotionRatio('中性') + '%';
    document.getElementById('negativeRatio').textContent = calculateEmotionRatio('消极') + '%';

    // 更新当前情感
    const currentEmotionEl = document.getElementById('currentEmotion');
    currentEmotionEl.className = '';
    currentEmotionEl.classList.add(currentEmotion);
    currentEmotionEl.textContent = currentEmotion;

    // 更新最后一条消息情感
    const lastEmotionEl = document.getElementById('lastMessageEmotion');
    lastEmotionEl.className = 'recent-emotion';
    lastEmotionEl.classList.add(lastMessageEmotion);
    lastEmotionEl.textContent = lastMessageEmotion || '无';
}

// 更新动态emoji显示
function updateEmojiDisplay() {
    // 1. 更新情感分析视图的核心emoji
    const mainEmojiEl = document.getElementById('mainEmoji');
    if (mainEmojiEl) {
        mainEmojiEl.textContent = emotionEmojiMap[currentEmotion];
    }

    // 2. 更新右侧面板的核心emoji
    const panelEmojiEl = document.getElementById('panelEmoji');
    if (panelEmojiEl) {
        panelEmojiEl.textContent = emotionEmojiMap[currentEmotion];
    }

    // 3. 更新情感轨迹emoji（取最近8条）
    const trackEmojisEl = document.getElementById('trackEmojis');
    const panelTrackEmojisEl = document.getElementById('panelTrackEmojis');

    if (emotionData.length === 0) {
        if (trackEmojisEl) trackEmojisEl.textContent = '暂无消息';
        if (panelTrackEmojisEl) panelTrackEmojisEl.textContent = '暂无';
        return;
    }

    // 生成轨迹emoji字符串
    const recentEmojis = emotionData.slice(-8).map(em => emotionEmojiMap[em]);
    if (trackEmojisEl) trackEmojisEl.innerHTML = recentEmojis.join(' ');
    if (panelTrackEmojisEl) panelTrackEmojisEl.innerHTML = recentEmojis.join(' ');
}

// 切换视图
function switchView(view) {
    // 更新activeView
    activeView = view;

    // 更新侧边栏active类
    const sidebarItems = document.querySelectorAll('.sidebar-item');
    sidebarItems.forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-view') === view) {
            item.classList.add('active');
        }
    });

    // 更新视图显示
    const views = document.querySelectorAll('.view');
    views.forEach(v => {
        v.classList.remove('active');
        if (v.classList.contains(view + '-view') || (view === 'chat' && v.classList.contains('chat-view-container'))) {
            v.classList.add('active');
        }
    });

    // 切换视图后更新emoji
    updateEmojiDisplay();
}

// 渲染消息列表
function renderMessages() {
    // 清空现有消息（保留欢迎消息）
    const welcomeMsg = chatMessages.querySelector('.ai-message');
    chatMessages.innerHTML = '';
    if (welcomeMsg && messages.length === 0) {
        chatMessages.appendChild(welcomeMsg);
    }

    // 渲染消息
    messages.forEach(msg => {
        const messageEl = document.createElement('div');
        messageEl.className = 'message ' + (msg.role === 'user' ? 'user-message' : 'ai-message');

        // 头像
        const avatarEl = document.createElement('div');
        avatarEl.className = 'avatar ' + (msg.role === 'user' ? 'user-avatar' : 'ai-avatar');
        avatarEl.textContent = msg.role === 'user' ? '👤' : '🤖';

        // 消息内容容器
        const contentContainer = document.createElement('div');
        contentContainer.className = 'message-content-container';
        
        // 消息内容
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';

        const strongEl = document.createElement('strong');
        strongEl.textContent = msg.role === 'user' ? '你：' : 'Judy：';

        const spanEl = document.createElement('span');
        spanEl.innerHTML = msg.content.replace(/\n/g, '<br>');

        // 情感表情（在右下角）
        const emotionEmojiEl = document.createElement('span');
        emotionEmojiEl.className = 'message-emotion';
        emotionEmojiEl.textContent = emotionEmojiMap[msg.emotion];
        emotionEmojiEl.title = msg.emotion;

        // 组装
        contentEl.appendChild(strongEl);
        contentEl.appendChild(spanEl);
        contentContainer.appendChild(contentEl);
        contentContainer.appendChild(emotionEmojiEl);
        messageEl.appendChild(avatarEl);
        messageEl.appendChild(contentContainer);

        chatMessages.appendChild(messageEl);
    });

    // 如果正在加载，添加加载动画
    if (isLoading) {
        const loadingTemplate = document.getElementById('loadingTemplate').content.cloneNode(true);
        chatMessages.appendChild(loadingTemplate);
    }
}

// 渲染历史会话列表
function renderHistoryList() {
    const historyList = document.getElementById('historyList');
    const historyEmpty = document.getElementById('historyEmpty');

    if (historySessions.length === 0) {
        historyEmpty.style.display = 'block';
        historyList.innerHTML = '';
        return;
    }

    historyEmpty.style.display = 'none';
    historyList.innerHTML = '';

    historySessions.forEach((session, index) => {
        const itemEl = document.createElement('div');
        itemEl.className = 'history-item';
        itemEl.dataset.index = index;

        const contentEl = document.createElement('div');
        contentEl.className = 'history-item-content';
        
        const timeEl = document.createElement('div');
        timeEl.className = 'session-time';
        timeEl.textContent = formatTime(session.createTime);

        const previewEl = document.createElement('div');
        previewEl.className = 'session-preview';
        previewEl.textContent = session.messages[0]?.content || '空会话';
        
        const messageCountEl = document.createElement('div');
        messageCountEl.className = 'session-count';
        messageCountEl.textContent = `共 ${session.messages.length} 条消息`;

        const btnContainer = document.createElement('div');
        btnContainer.className = 'history-item-buttons';

        const restoreBtn = document.createElement('button');
        restoreBtn.className = 'restore-btn';
        restoreBtn.textContent = '恢复';
        restoreBtn.onclick = function (e) {
            e.stopPropagation();
            restoreSession(index);
        };

        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'delete-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.title = '删除此历史记录';
        deleteBtn.onclick = function (e) {
            e.stopPropagation();
            deleteSession(index);
        };

        // 组装
        contentEl.appendChild(timeEl);
        contentEl.appendChild(previewEl);
        contentEl.appendChild(messageCountEl);
        
        btnContainer.appendChild(restoreBtn);
        btnContainer.appendChild(deleteBtn);
        
        itemEl.appendChild(contentEl);
        itemEl.appendChild(btnContainer);

        historyList.appendChild(itemEl);
    });
}

// 删除历史会话
function deleteSession(index) {
    if (confirm('确定要删除这条历史记录吗？')) {
        historySessions.splice(index, 1);
        localStorage.setItem('historySessions', JSON.stringify(historySessions));
        renderHistoryList();
    }
}

// 添加批量删除按钮到历史记录视图
function addBatchDeleteButton() {
    const historyView = document.querySelector('.history-view');
    if (!historyView.querySelector('.batch-delete-btn')) {
        const batchDeleteBtn = document.createElement('button');
        batchDeleteBtn.className = 'batch-delete-btn';
        batchDeleteBtn.textContent = '清空所有历史记录';
        batchDeleteBtn.onclick = clearAllHistory;
        historyView.insertBefore(batchDeleteBtn, historyView.querySelector('#historyList'));
    }
}

// 清空所有历史记录
function clearAllHistory() {
    if (historySessions.length === 0) return;
    
    if (confirm('确定要清空所有历史记录吗？此操作不可恢复！')) {
        historySessions = [];
        localStorage.setItem('historySessions', JSON.stringify(historySessions));
        renderHistoryList();
    }
}

// --- 聊天核心功能 ---
// 处理键盘事件
function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        sendMessage();
    }
}

// 发送消息
async function sendMessage() {
    const message = inputMessage.value.trim();
    if (!message) return;

    // 1. 添加用户消息
    const userEmotion = analyzeEmotion(message);
    messages.push({ role: 'user', content: message, emotion: userEmotion });
    inputMessage.value = '';
    document.getElementById('wordCount').textContent = '0/500';
    document.getElementById('sendBtn').disabled = true;

    // 2. 渲染消息并滚动到底部
    renderMessages();
    await new Promise(resolve => setTimeout(resolve, 0));
    scrollToBottom();

    // 3. 显示加载动画
    isLoading = true;
    renderMessages();

    try {
        // 4. 调用Rasa API
        const response = await fetch(rasaApiUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ sender: SENDER_ID, message })
        });
        const data = await response.json();

        // 5. 隐藏加载动画
        isLoading = false;

        // 6. 添加AI回复
        const aiContent = data.length > 0 && data[0].text
            ? data[0].text
            : "抱歉，我暂时没理解你的意思，能再说说吗？";
        const aiEmotion = analyzeEmotion(aiContent);
        messages.push({ role: 'ai', content: aiContent, emotion: aiEmotion });

    } catch (error) {
        isLoading = false;
        const errorContent = `请求失败：${error.message}，请检查Rasa服务是否启动！`;
        const errorEmotion = analyzeEmotion(errorContent);
        messages.push({ role: 'ai', content: errorContent, emotion: errorEmotion });
        console.error("调用Rasa API失败：", error);
    }

    // 7. 最终渲染和滚动
    renderMessages();
    await new Promise(resolve => setTimeout(resolve, 0));
    scrollToBottom();

    // 8. 更新emoji显示
    updateEmojiDisplay();
}

// 滚动到底部
function scrollToBottom() {
    if (chatMessages) {
        chatMessages.scrollTop = chatMessages.scrollHeight;
    }
}

// 清空对话
function clearChat() {
    if (messages.length === 0) return;

    // 保存当前会话到历史
    historySessions.unshift({
        createTime: Date.now(),
        messages: [...messages]
    });

    // 持久化历史
    localStorage.setItem('historySessions', JSON.stringify(historySessions));

    // 清空当前数据
    messages = [];
    emotionData = [];
    currentEmotion = '中性';
    lastMessageEmotion = '中性';

    // 更新DOM
    renderMessages();
    renderHistoryList();
    updateEmotionDOM();
    updateEmojiDisplay();

    // 滚动到底部
    scrollToBottom();
}

// 恢复历史会话
function restoreSession(index) {
    const session = historySessions[index];
    messages = [...session.messages];
    emotionData = session.messages.map(msg => msg.emotion);

    // 更新情感状态
    const recentEmotions = emotionData.slice(-3);
    const count = {};
    recentEmotions.forEach(e => count[e] = (count[e] || 0) + 1);
    currentEmotion = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || '中性';
    lastMessageEmotion = emotionData[emotionData.length - 1] || '中性';

    // 更新DOM
    updateEmotionDOM();
    updateEmojiDisplay();
    renderMessages();

    // 切换到对话视图
    switchView('chat');

    // 滚动到底部
    setTimeout(scrollToBottom, 100);
}

// --- 语音输入功能 ---
function startVoiceInput() {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
        alert('你的浏览器不支持语音识别功能，请更换Chrome浏览器尝试');
        return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = 'zh-CN';
    recognition.continuous = false;
    recognition.interimResults = false;

    recognition.start();
    alert('请开始说话...');

    recognition.onresult = function (event) {
        const transcript = event.results[0][0].transcript;
        inputMessage.value = transcript;
        document.getElementById('wordCount').textContent = transcript.length + '/500';
        document.getElementById('sendBtn').disabled = !transcript.trim();
    };

    recognition.onend = function () {
        recognition.stop();
    };

    recognition.onerror = function (event) {
        alert(`语音识别错误：${event.error}`);
    };
}

// --- 设置功能 ---
function saveSetting() {
    rasaApiUrl = document.getElementById('rasaApiUrl').value;
    localStorage.setItem('rasaApiUrl', rasaApiUrl);
    alert('设置已保存！');
}

// --- 右侧面板切换 ---
function togglePanel() {
    isPanelOpen = !isPanelOpen;
    document.getElementById('panelContent').style.display = isPanelOpen ? 'block' : 'none';
}