// 全局变量
let messages = [];
let emotionData = [];
let currentEmotion = '中性';
let lastMessageEmotion = '中性';
let historySessions = JSON.parse(localStorage.getItem('historySessions') || '[]');
let rasaApiUrl = localStorage.getItem('rasaApiUrl') || 'https://tions-true-boats-subsidiary.trycloudflare.com/webhooks/rest/webhook';
let isLoading = false;
let isPanelOpen = true;

// 情感与表情映射
const emotionEmojiMap = {
    '积极': '😊',
    '中性': '😐',
    '消极': '😞'
};

// 情感与动图映射
const emotionGifMap = {
    '积极': 'images/kaixin.gif',
    '中性': 'images/hehe.gif',
    '消极': 'images/chenmo.gif'
};

// DOM元素
const chatMessages = document.getElementById('chatMessages');
const inputMessage = document.getElementById('inputMessage');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChatBtn');

// 初始化
function init() {
    // 初始化粒子特效
    initParticles();

    // 加载历史记录
    renderHistoryList();

    // 初始化视图切换
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', function () {
            const viewName = this.getAttribute('data-view');
            switchView(viewName);

            // 只有在对话视图显示清空按钮
            if (viewName === 'chat') {
                clearChatBtn.style.display = 'flex';
            } else {
                clearChatBtn.style.display = 'none';
            }
        });
    });

    // 输入框事件
    inputMessage.addEventListener('focus', () => inputMessage.classList.add('input-focused'));
    inputMessage.addEventListener('blur', () => inputMessage.classList.remove('input-focused'));
    inputMessage.addEventListener('input', checkSendButton);

    // 发送按钮事件
    sendBtn.addEventListener('click', sendMessage);

    // 回车键发送消息
    inputMessage.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            sendMessage();
        }
    });

    // 清空对话按钮事件
    clearChatBtn.addEventListener('click', clearChat);

    // 初始化显示清空按钮状态
    if (document.querySelector('.sidebar-item.active').getAttribute('data-view') === 'chat') {
        clearChatBtn.style.display = 'flex';
    }

    // 初始化情感显示
    updateEmotionDOM();
    updateEmojiDisplay();
}

// 初始化粒子特效
function initParticles() {
    particlesJS('particles-js', {
        "particles": {
            "number": {
                "value": 80,
                "density": {
                    "enable": true,
                    "value_area": 800
                }
            },
            "color": {
                "value": "#e9a8d7"
            },
            "shape": {
                "type": "circle"
            },
            "opacity": {
                "value": 0.5,
                "random": true
            },
            "size": {
                "value": 3,
                "random": true
            },
            "line_linked": {
                "enable": true,
                "distance": 150,
                "color": "#e9a8d7",
                "opacity": 0.2,
                "width": 1
            },
            "move": {
                "enable": true,
                "speed": 1,
                "direction": "none",
                "random": true,
                "straight": false,
                "out_mode": "out",
                "bounce": false
            }
        },
        "interactivity": {
            "detect_on": "canvas",
            "events": {
                "onhover": {
                    "enable": true,
                    "mode": "grab"
                },
                "onclick": {
                    "enable": true,
                    "mode": "push"
                },
                "resize": true
            },
            "modes": {
                "grab": {
                    "distance": 140,
                    "line_linked": {
                        "opacity": 0.5
                    }
                },
                "push": {
                    "particles_nb": 3
                }
            }
        },
        "retina_detect": true
    });
}

// 切换视图
function switchView(viewName) {
    // 更新侧边栏激活状态
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.classList.remove('active');
        if (item.getAttribute('data-view') === viewName) {
            item.classList.add('active');
        }
    });

    // 更新视图显示
    document.querySelectorAll('.view').forEach(view => {
        view.classList.remove('active');
    });

    if (viewName === 'chat') {
        document.querySelector('.chat-view-container').classList.add('active');
    } else {
        document.querySelector(`.${viewName}-view`).classList.add('active');
    }
}

// 检查发送按钮状态
function checkSendButton() {
    sendBtn.disabled = inputMessage.value.trim() === '';
}

// 发送消息
function sendMessage() {
    const content = inputMessage.value.trim();
    if (!content) return;

    // 添加用户消息
    const userMessage = {
        role: 'user',
        content: content,
        timestamp: new Date().toISOString()
    };

    // 分析情感
    const emotion = analyzeEmotion(content);
    userMessage.emotion = emotion;

    messages.push(userMessage);
    inputMessage.value = '';
    checkSendButton();
    renderMessages();
    scrollToBottom();

    // 显示加载状态
    isLoading = true;
    renderMessages();

    // 调用API获取回复
    getAIResponse(content);
}

// 获取AI回复
function getAIResponse(content) {
    fetch(rasaApiUrl, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            sender: 'user',
            message: content
        })
    })
        .then(response => response.json())
        .then(data => {
            isLoading = false;

            if (data && data.length > 0) {
                const aiMessage = {
                    role: 'ai',
                    content: data[0].text,
                    timestamp: new Date().toISOString()
                };

                // 分析AI回复的情感
                const emotion = analyzeEmotion(data[0].text);
                aiMessage.emotion = emotion;

                messages.push(aiMessage);
            } else {
                // 默认回复
                const aiMessage = {
                    role: 'ai',
                    content: '抱歉，我没太明白你的意思，可以再说一遍吗？',
                    timestamp: new Date().toISOString(),
                    emotion: '中性'
                };
                messages.push(aiMessage);
                analyzeEmotion(aiMessage.content); // 分析默认回复的情感
            }

            renderMessages();
            scrollToBottom();
        })
        .catch(error => {
            console.error('API请求失败:', error);
            isLoading = false;

            const errorMessage = {
                role: 'ai',
                content: '抱歉，连接AI服务失败，请检查设置中的API地址是否正确。',
                timestamp: new Date().toISOString(),
                emotion: '消极'
            };
            messages.push(errorMessage);
            analyzeEmotion(errorMessage.content); // 分析错误消息的情感

            renderMessages();
            scrollToBottom();
        });
}

// 情感分析（基于关键词）
function analyzeEmotion(content) {
    content = content.toLowerCase();

    // 积极关键词
    const positiveWords = ['开心', '高兴', '快乐', '喜欢', '爱', '棒', '好', '谢谢', '感谢', '不错', '美丽', '漂亮', '完美', '赞', '棒极了', '幸福', '幸运'];
    // 消极关键词  
    const negativeWords = ['不开心', '伤心', '难过', '悲伤', '生气', '愤怒', '讨厌', '恨', '不好', '糟糕', '差', '烦', '郁闷', '痛苦', '失望', '绝望', '难过死了', '气死了'];

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

// 更新动态emoji显示（改为动图）
function updateEmojiDisplay() {
    // 1. 更新情感分析视图的核心动图
    const mainEmojiEl = document.getElementById('mainEmoji');
    if (mainEmojiEl) {
        mainEmojiEl.innerHTML = `<img src="${emotionGifMap[currentEmotion]}" alt="${currentEmotion}" class="emotion-gif">`;
    }

    // 2. 更新右侧面板的核心动图
    const panelEmojiEl = document.getElementById('panelEmoji');
    if (panelEmojiEl) {
        panelEmojiEl.innerHTML = `<img src="${emotionGifMap[currentEmotion]}" alt="${currentEmotion}" class="emotion-gif">`;
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

        // 消息内容容器
        const contentContainer = document.createElement('div');
        contentContainer.className = 'message-content-container';

        // 消息内容
        const contentEl = document.createElement('div');
        contentEl.className = 'message-content';

        const strongEl = document.createElement('strong');
        strongEl.textContent = msg.role === 'user' ? '小苦瓜：' : 'Judy：';

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

// 滚动到底部
function scrollToBottom() {
    chatMessages.scrollTop = chatMessages.scrollHeight;
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

// 格式化时间
function formatTime(timestamp) {
    const date = new Date(timestamp);
    return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')} ${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;
}

// 恢复会话
function restoreSession(index) {
    const session = historySessions[index];
    messages = [...session.messages];

    // 重新计算情感数据
    emotionData = [];
    messages.forEach(msg => {
        if (msg.emotion) {
            emotionData.push(msg.emotion);
        } else {
            // 如果消息没有情感数据，重新分析
            analyzeEmotion(msg.content);
        }
    });

    // 更新当前情感
    const recentEmotions = emotionData.slice(-3);
    const count = {};
    recentEmotions.forEach(e => count[e] = (count[e] || 0) + 1);
    currentEmotion = Object.keys(count).sort((a, b) => count[b] - count[a])[0] || '中性';

    // 更新UI
    renderMessages();
    updateEmotionDOM();
    updateEmojiDisplay();
    switchView('chat');
    scrollToBottom();
}

// 删除会话
function deleteSession(index) {
    if (confirm('确定要删除这条历史记录吗？')) {
        historySessions.splice(index, 1);
        localStorage.setItem('historySessions', JSON.stringify(historySessions));
        renderHistoryList();
    }
}

// 清空对话
function clearChat() {
    if (messages.length === 0) return;

    if (confirm('确定要清空当前对话吗？')) {
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
}

// 设置功能
function saveSetting() {
    rasaApiUrl = document.getElementById('rasaApiUrl').value;
    localStorage.setItem('rasaApiUrl', rasaApiUrl);
    alert('设置已保存！');
}

// 右侧面板切换
function togglePanel() {
    isPanelOpen = !isPanelOpen;
    document.getElementById('panelContent').style.display = isPanelOpen ? 'block' : 'none';
}

// 页面加载完成后初始化
window.addEventListener('DOMContentLoaded', init);