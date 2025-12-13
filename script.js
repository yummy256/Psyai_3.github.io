// 全局变量
let messages = [];
let emotionData = [];
let currentEmotion = '中性';
let lastMessageEmotion = '中性';
let historySessions = JSON.parse(localStorage.getItem('historySessions') || '[]');
let rasaApiUrl = localStorage.getItem('rasaApiUrl') || 'https://brown-mobiles-exposed-currently.trycloudflare.com/webhooks/rest/webhook';
let isLoading = false;
let isPanelOpen = true;

// 语音识别相关变量
let recognition = null;
let isRecording = false;
let finalTranscript = '';
let voiceInputTimer = null;

// 文本转语音相关变量（增强版）
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let isSpeaking = false;
let currentVoice = null;
let voices = [];
let ttsEnabled = localStorage.getItem('ttsEnabled') === 'true' || false;

// 从localStorage加载设置或使用默认值
let voiceRate = parseFloat(localStorage.getItem('voiceRate')) || 0.9;  // 更自然的语速
let voicePitch = parseFloat(localStorage.getItem('voicePitch')) || 1.0; // 更自然的音调
let voiceVolume = parseFloat(localStorage.getItem('voiceVolume')) || 0.5;
let selectedVoiceName = localStorage.getItem('selectedVoiceName') || '';

// 高质量中文语音列表（优先级排序）
const preferredChineseVoices = [
    // Microsoft Azure 高质量语音（Edge浏览器）
    'Microsoft Xiaoxiao Online (Natural) - Chinese (Mainland)',
    'Microsoft Xiaoyi Online (Natural) - Chinese (Mainland)',
    'Microsoft Yunjian Online (Natural) - Chinese (Mainland)',
    'Microsoft Xiaoxiao - Chinese (Simplified, PRC)',
    'Microsoft Xiaoyan - Chinese (Simplified, PRC)',
    
    // Google 高质量语音（Chrome浏览器）
    'Google 普通话（中国大陆）',
    'Google 普通话（中国大陆）',
    
    // macOS/iOS 高质量语音
    'Ting-Ting', // 苹果的中文女声
    'Mei-Jia',   // 苹果的另一个中文女声
    
    // Windows 系统语音
    'Microsoft Huihui Desktop - Chinese (Simplified)',
    'Microsoft Yaoyao - Chinese (Simplified)',
    
    // 其他常见中文女声
    'zh-CN-XiaoxiaoNeural',
    'zh-CN-XiaoyiNeural',
    'zh-CN-YunjianNeural',
    'Chinese Female',
    'Chinese (China)',
    '中文（简体，中国）'
];

// Judy语音配置（优化版）
const judyVoiceProfiles = {
    '积极': { 
        rate: 0.9,  // 稍微加快，但保持自然
        pitch: 1.2, // 音调稍高但不夸张
        volume: 0.5,
        intonation: 'rising'
    },
    '中性': { 
        rate: 0.9,  // 适中语速
        pitch: 1.2, // 自然音调
        volume: 0.5,
        intonation: 'normal'
    },
    '消极': { 
        rate: 0.9,  // 稍慢，表达关心
        pitch: 1.1, // 音调稍低，温暖
        volume: 0.9,
        intonation: 'falling'
    }
};

// 自然语气词库
const naturalExpressions = {
    positive: [
        '太棒了！', '好开心呀～', '真好！', '太好了呢！', '真不错！',
        '为你开心！', '好厉害！', '赞！', '继续加油哦～', '了不起！'
    ],
    neutral: [
        '嗯...', '让我想想～', '这个嘛...', '我觉得呢～', '哦～原来是这样',
        '嗯嗯～', '好的', '我明白了～', '这样啊～', '了解了～'
    ],
    negative: [
        '哎呀～', '别难过呀', '抱抱你～', '没事的～', '我在这里呢',
        '会好起来的～', '摸摸头～', '不要伤心啦～', '我在听呢～', '想开点哦～'
    ]
};

// 自然停顿词
const naturalPauses = [
    '呢', '啊', '呀', '哦', '啦', '嘛', '嗯'
];

// DOM元素
const chatMessages = document.getElementById('chatMessages');
const inputMessage = document.getElementById('inputMessage');
const sendBtn = document.getElementById('sendBtn');
const clearChatBtn = document.getElementById('clearChatBtn');
const voiceBtn = document.querySelector('.voice-btn');

// 初始化
function init() {
    // 初始化粒子特效
    initParticles();

    // 初始化语音识别
    initSpeechRecognition();
    
    // 初始化文本转语音
    initTextToSpeech();

    // 加载历史记录
    renderHistoryList();

    // 初始化视图切换
    document.querySelectorAll('.sidebar-item').forEach(item => {
        item.addEventListener('click', function () {
            const viewName = this.getAttribute('data-view');
            switchView(viewName);

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

    // 麦克风按钮事件
    voiceBtn.addEventListener('click', toggleSpeechRecognition);

    // 初始化显示清空按钮状态
    if (document.querySelector('.sidebar-item.active').getAttribute('data-view') === 'chat') {
        clearChatBtn.style.display = 'flex';
    }

    // 初始化情感显示
    updateEmotionDOM();
    updateEmojiDisplay();
    
    // 加载TTS设置
    loadTTSSettings();
}

// 初始化粒子特效
function initParticles() {
    if (typeof particlesJS === 'function') {
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
}

// 初始化文本转语音（增强版）
function initTextToSpeech() {
    if (!speechSynthesis) {
        console.warn('当前浏览器不支持文本转语音功能');
        showVoiceError('当前浏览器不支持语音功能');
        return;
    }
    
    // 等待语音加载
    setTimeout(() => {
        voices = speechSynthesis.getVoices();
        
        if (voices.length === 0) {
            speechSynthesis.onvoiceschanged = function() {
                voices = speechSynthesis.getVoices();
                if (voices.length > 0) {
                    setupVoiceSelection();
                    console.log('语音加载完成，可用语音:', voices.map(v => v.name));
                } else {
                    console.warn('未找到可用语音');
                    showVoiceError('未找到可用语音，请检查系统语音设置');
                }
            };
        } else {
            setupVoiceSelection();
        }
    }, 100);
    
    speechSynthesis.addEventListener('voiceschanged', function() {
        voices = speechSynthesis.getVoices();
        if (voices.length > 0 && !currentVoice) {
            setupVoiceSelection();
        }
    });
}

// 显示语音错误
function showVoiceError(message) {
    console.error('语音错误:', message);
    const errorDiv = document.createElement('div');
    errorDiv.className = 'voice-error-hint';
    errorDiv.innerHTML = `<span>⚠️ ${message}</span>`;
    
    document.querySelector('.app-container').appendChild(errorDiv);
    
    setTimeout(() => {
        errorDiv.classList.add('show');
    }, 10);
    
    setTimeout(() => {
        errorDiv.classList.remove('show');
        setTimeout(() => {
            if (errorDiv.parentNode) {
                errorDiv.parentNode.removeChild(errorDiv);
            }
        }, 300);
    }, 5000);
}

// 智能语音选择算法（重点改进）
function setupVoiceSelection() {
    console.log('可用语音列表:', voices.map(v => `${v.name} (${v.lang})`));
    
    // 1. 首先尝试使用用户之前选择的语音
    if (selectedVoiceName) {
        const savedVoice = voices.find(v => v.name === selectedVoiceName);
        if (savedVoice) {
            currentVoice = savedVoice;
            console.log('使用保存的语音:', currentVoice.name);
            updateVoiceSelector();
            return;
        }
    }
    
    // 2. 寻找高质量中文女性语音
    let bestVoice = null;
    let bestScore = -1;
    
    voices.forEach(voice => {
        const score = calculateVoiceScore(voice);
        console.log(`语音评分: ${voice.name} - ${score}分`);
        
        if (score > bestScore) {
            bestScore = score;
            bestVoice = voice;
        }
    });
    
    if (bestVoice) {
        currentVoice = bestVoice;
        console.log('选择最佳语音:', currentVoice.name, `(评分: ${bestScore})`);
    } else if (voices.length > 0) {
        // 3. 降级选择：任何中文语音
        const chineseVoice = voices.find(v => 
            v.lang.startsWith('zh') || 
            v.lang.includes('Chinese') ||
            v.name.includes('Chinese')
        );
        
        if (chineseVoice) {
            currentVoice = chineseVoice;
            console.log('选择中文语音:', currentVoice.name);
        } else {
            // 4. 最后选择：第一个可用语音
            currentVoice = voices[0];
            console.log('使用默认语音:', currentVoice.name);
        }
    } else {
        currentVoice = null;
        console.warn('未找到可用语音');
        showVoiceError('未找到可用语音，请安装高质量语音包');
    }
    
    updateVoiceSelector();
}

// 语音评分算法
function calculateVoiceScore(voice) {
    let score = 0;
    const name = voice.name.toLowerCase();
    const lang = voice.lang.toLowerCase();
    
    // 语言加分
    if (lang.includes('zh-cn') || lang.includes('zh_hans')) {
        score += 30; // 简体中文最高优先级
    } else if (lang.includes('zh') || lang.includes('chinese')) {
        score += 20; // 其他中文
    } else if (lang.includes('en')) {
        score += 5; // 英文备用
    }
    
    // 语音质量关键词加分
    const qualityKeywords = [
        'neural', 'natural', 'premium', 'hd', 'online', 'azure',
        'xiaoxiao', 'xiaoyi', 'yunjian', 'xiaoyan', 'huihui', 'yaoyao'
    ];
    
    qualityKeywords.forEach(keyword => {
        if (name.includes(keyword)) {
            score += 10;
        }
    });
    
    // 厂商加分
    if (name.includes('microsoft')) score += 8;
    if (name.includes('google')) score += 6;
    if (name.includes('apple') || name.includes('ting')) score += 7;
    
    // 语音类型加分（女性）
    if (name.includes('female') || 
        name.includes('xiaoxiao') || 
        name.includes('xiaoyi') ||
        name.includes('yaoyao') ||
        name.includes('huihui') ||
        name.includes('女')) {
        score += 15;
    }
    
    // 系统默认语音减分
    if (name.includes('desktop') || name.includes('system') || name.includes('default')) {
        score -= 5;
    }
    
    return score;
}

// 更新语音选择器UI
function updateVoiceSelector() {
    // 如果有语音选择器，更新它
    const voiceSelector = document.getElementById('voiceSelector');
    if (voiceSelector && voices.length > 0) {
        // 保存当前选择
        voiceSelector.innerHTML = '';
        
        // 添加选项
        voices.forEach((voice, index) => {
            const option = document.createElement('option');
            option.value = index;
            option.textContent = `${voice.name} (${voice.lang})`;
            if (currentVoice && voice.name === currentVoice.name) {
                option.selected = true;
            }
            voiceSelector.appendChild(option);
        });
        
        // 显示当前语音信息
        const voiceInfo = document.getElementById('currentVoiceInfo');
        if (voiceInfo && currentVoice) {
            voiceInfo.textContent = `当前语音: ${currentVoice.name}`;
        }
    }
}

// 加载TTS设置
function loadTTSSettings() {
    ttsEnabled = localStorage.getItem('ttsEnabled') === 'true' || false;
    voiceRate = parseFloat(localStorage.getItem('voiceRate')) || 1.0;
    voicePitch = parseFloat(localStorage.getItem('voicePitch')) || 1.2;
    voiceVolume = parseFloat(localStorage.getItem('voiceVolume')) || 0.8;
    selectedVoiceName = localStorage.getItem('selectedVoiceName') || '';
    
    // 更新设置界面
    if (document.getElementById('ttsEnabled')) {
        document.getElementById('ttsEnabled').checked = ttsEnabled;
    }
    if (document.getElementById('voiceRate')) {
        document.getElementById('voiceRate').value = voiceRate;
        document.getElementById('voiceRateValue').textContent = voiceRate.toFixed(1);
    }
    if (document.getElementById('voicePitch')) {
        document.getElementById('voicePitch').value = voicePitch;
        document.getElementById('voicePitchValue').textContent = voicePitch.toFixed(1);
    }
    if (document.getElementById('voiceVolume')) {
        document.getElementById('voiceVolume').value = voiceVolume;
        document.getElementById('voiceVolumeValue').textContent = voiceVolume.toFixed(1);
    }
    
    // 显示语音控制栏
    const voiceControlBar = document.getElementById('voiceControlBar');
    if (voiceControlBar && ttsEnabled) {
        voiceControlBar.style.display = 'flex';
    }
    
    // 更新语音选择器
    updateVoiceSelector();
}

// 保存TTS设置
function saveTTSSettings() {
    ttsEnabled = document.getElementById('ttsEnabled').checked;
    voiceRate = parseFloat(document.getElementById('voiceRate').value);
    voicePitch = parseFloat(document.getElementById('voicePitch').value);
    voiceVolume = parseFloat(document.getElementById('voiceVolume').value);
    
    // 保存选择的语音
    const voiceSelector = document.getElementById('voiceSelector');
    if (voiceSelector && voiceSelector.value !== '') {
        const selectedIndex = parseInt(voiceSelector.value);
        if (voices[selectedIndex]) {
            selectedVoiceName = voices[selectedIndex].name;
            currentVoice = voices[selectedIndex];
            localStorage.setItem('selectedVoiceName', selectedVoiceName);
        }
    }
    
    localStorage.setItem('ttsEnabled', ttsEnabled);
    localStorage.setItem('voiceRate', voiceRate);
    localStorage.setItem('voicePitch', voicePitch);
    localStorage.setItem('voiceVolume', voiceVolume);
    
    // 显示语音控制栏
    const voiceControlBar = document.getElementById('voiceControlBar');
    if (voiceControlBar) {
        voiceControlBar.style.display = ttsEnabled ? 'flex' : 'none';
    }
    
    alert('语音设置已保存！');
}

// 更新语音参数显示
function updateVoiceSettingsDisplay() {
    if (document.getElementById('voiceRateValue')) {
        document.getElementById('voiceRateValue').textContent = 
            document.getElementById('voiceRate').value;
    }
    if (document.getElementById('voicePitchValue')) {
        document.getElementById('voicePitchValue').textContent = 
            document.getElementById('voicePitch').value;
    }
    if (document.getElementById('voiceVolumeValue')) {
        document.getElementById('voiceVolumeValue').textContent = 
            document.getElementById('voiceVolume').value;
    }
}

// 应用语音预设
function applyVoicePreset(presetName) {
    const presets = {
        'natural': { rate: 0.9, pitch: 1.2, volume: 0.8 },
        'gentle': { rate: 1.1, pitch: 1.3, volume: 0.9 },
        'energetic': { rate: 1.5, pitch: 1.6, volume: 1.0 }
    };
    
    const preset = presets[presetName] || presets.natural;
    
    document.getElementById('voiceRate').value = preset.rate;
    document.getElementById('voicePitch').value = preset.pitch;
    document.getElementById('voiceVolume').value = preset.volume;
    
    updateVoiceSettingsDisplay();
    saveTTSSettings();
    
    alert(`已应用${presetName === 'natural' ? '自然' : presetName === 'gentle' ? '温柔' : '活力'}预设！`);
}

// 停止当前语音
function stopCurrentSpeech() {
    if (speechSynthesis && (isSpeaking || speechSynthesis.speaking)) {
        speechSynthesis.cancel();
        isSpeaking = false;
        currentUtterance = null;
        
        updateAllPlayButtons();
        updateVoiceStatus('已停止');
        
        document.querySelectorAll('.message-content-container.speech-active').forEach(el => {
            el.classList.remove('speech-active');
        });
    }
}

// 更新语音状态
function updateVoiceStatus(status) {
    const voiceStatus = document.getElementById('voiceStatus');
    if (voiceStatus) {
        voiceStatus.textContent = status;
    }
}

// 自然文本处理
function processTextForSpeech(text, emotion) {
    let processed = text;
    
    // 移除过多的标点
    processed = processed.replace(/!!+/g, '！');
    processed = processed.replace(/\.\.+/g, '。');
    
    // 在适当位置添加自然停顿
    const sentences = processed.split(/[。！？]/);
    if (sentences.length > 1) {
        processed = sentences.join('，');
    }
    
    // 根据情感添加语气词
    if (Math.random() > 0.6 && naturalExpressions[emotion]) {
        const expressions = naturalExpressions[emotion];
        const randomExp = expressions[Math.floor(Math.random() * expressions.length)];
        
        if (Math.random() > 0.5) {
            processed = randomExp + ' ' + processed;
        } else if (!processed.endsWith('！') && !processed.endsWith('？')) {
            processed = processed + ' ' + randomExp;
        }
    }
    
    return processed;
}

// 优化文本转语音（修复版）- 主要修复点
function speakText(text, emotion = '中性') {
    if (!ttsEnabled || !speechSynthesis || !text.trim()) {
        console.log('语音功能未启用或文本为空');
        return;
    }
    
    // 检查 speechSynthesis 是否可用
    if (!speechSynthesis) {
        console.warn('SpeechSynthesis 不可用');
        return;
    }
    
    stopCurrentSpeech();
    
    // 确保有可用语音
    if (!currentVoice) {
        if (voices.length === 0) {
            voices = speechSynthesis.getVoices();
            if (voices.length === 0) {
                console.warn('语音列表为空');
                setTimeout(() => {
                    voices = speechSynthesis.getVoices();
                    if (voices.length > 0) {
                        setupVoiceSelection();
                        // 递归调用，使用当前文本和情感
                        speakText(text, emotion);
                    }
                }, 500);
                return;
            }
        }
        setupVoiceSelection();
    }
    
    if (!currentVoice) {
        console.warn('没有可用语音');
        showVoiceError('没有可用的语音，请安装中文语音包');
        return;
    }
    
    try {
        // 处理文本，使其更自然
        const processedText = processTextForSpeech(text, emotion);
        
        // 创建语音实例
        const utterance = new SpeechSynthesisUtterance(processedText);
        
        // 设置语音参数
        utterance.voice = currentVoice;
        utterance.lang = 'zh-CN';
        
        // 获取情感配置
        const emotionProfile = judyVoiceProfiles[emotion] || judyVoiceProfiles['中性'];
        
        // 应用更自然的参数
        utterance.rate = Math.max(0.8, Math.min(1.8, voiceRate * emotionProfile.rate));
        utterance.pitch = Math.max(0.8, Math.min(1.8, voicePitch * emotionProfile.pitch));
        utterance.volume = Math.max(0.1, Math.min(1.0, voiceVolume * emotionProfile.volume));
        
        // 保存当前 utterance 的引用
        currentUtterance = utterance;
        
        // 事件处理 - 使用箭头函数保持上下文
        utterance.onstart = () => {
            console.log('开始播放:', processedText.substring(0, 50));
            isSpeaking = true;
            updateVoiceStatus('Judy在说话...');
            updateAllPlayButtons();
            
            const currentPlayBtn = document.querySelector(`.message-play-btn[data-text="${encodeURIComponent(text)}"]`);
            if (currentPlayBtn) {
                currentPlayBtn.classList.add('playing');
                currentPlayBtn.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>';
                currentPlayBtn.title = '正在播放...';
                
                const messageContainer = currentPlayBtn.closest('.message-content-container');
                if (messageContainer) {
                    messageContainer.classList.add('speech-active');
                }
            }
        };
        
        utterance.onend = () => {
            console.log('语音播放结束');
            isSpeaking = false;
            // 只有当前 utterance 是正在播放的 utterance 时才清除
            if (currentUtterance === utterance) {
                currentUtterance = null;
            }
            updateVoiceStatus('语音就绪');
            updateAllPlayButtons();
            
            document.querySelectorAll('.message-content-container.speech-active').forEach(el => {
                el.classList.remove('speech-active');
            });
        };
        
        utterance.onerror = (event) => {
            console.error('语音播放错误:', event.error);
            isSpeaking = false;
            // 只有当前 utterance 是正在播放的 utterance 时才清除
            if (currentUtterance === utterance) {
                currentUtterance = null;
            }
            updateVoiceStatus('播放错误');
            updateAllPlayButtons();
            
            // 不显示中断错误
            if (event.error !== 'interrupted') {
                showVoiceError(`语音播放失败: ${event.error}`);
            }
            
            document.querySelectorAll('.message-content-container.speech-active').forEach(el => {
                el.classList.remove('speech-active');
            });
        };
        
        // 播放语音 - 使用 Promise 确保顺序
        setTimeout(() => {
            try {
                speechSynthesis.speak(utterance);
            } catch (error) {
                console.error('语音合成失败:', error);
                showVoiceError('语音合成失败，请刷新页面重试');
            }
        }, 50);
        
    } catch (error) {
        console.error('创建语音实例失败:', error);
        showVoiceError('创建语音失败');
    }
}

// 测试不同语音
function testVoice(voiceType = 'default') {
    const testTexts = {
        default: '你好呀，我是Judy，你的解忧小伙伴～',
        emotion: '今天天气真好，要不要一起聊聊天？',
        comfort: '别难过啦，无论发生什么我都会陪着你的～'
    };
    
    const text = testTexts[voiceType] || testTexts.default;
    speakText(text, voiceType === 'comfort' ? '消极' : '积极');
}

// 语音安装指南
function showVoiceInstallGuide() {
    const modal = document.getElementById('voiceGuideModal');
    if (modal) {
        modal.classList.add('show');
    }
}

// 刷新语音列表
function refreshVoices() {
    voices = speechSynthesis.getVoices();
    setupVoiceSelection();
    alert('语音列表已刷新！');
}

// 初始化语音识别
function initSpeechRecognition() {
    // 检查浏览器是否支持语音识别
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    
    if (!SpeechRecognition) {
        console.warn('当前浏览器不支持语音识别功能');
        voiceBtn.style.display = 'none'; // 隐藏麦克风按钮
        return;
    }

    // 创建语音识别实例
    recognition = new SpeechRecognition();
    recognition.continuous = false; // 是否连续识别
    recognition.interimResults = true; // 是否返回中间结果
    recognition.lang = 'zh-CN'; // 设置语言为中文

    // 语音识别开始事件
    recognition.onstart = function() {
        console.log('语音识别开始...');
        isRecording = true;
        voiceBtn.classList.add('recording');
        
        // 清空之前的转录文本
        finalTranscript = '';
        
        // 显示语音识别提示
        const voiceHint = document.getElementById('voiceRecordingHint');
        if (voiceHint) voiceHint.classList.add('show');
        
        // 清空输入框，准备接收语音输入
        inputMessage.value = '';
        checkSendButton();
        
        // 清除之前的定时器
        if (voiceInputTimer) {
            clearTimeout(voiceInputTimer);
            voiceInputTimer = null;
        }
    };

    // 语音识别结果事件
    recognition.onresult = function(event) {
        let interimTranscript = '';
        
        for (let i = event.resultIndex; i < event.results.length; i++) {
            const transcript = event.results[i][0].transcript;
            if (event.results[i].isFinal) {
                finalTranscript += transcript;
            } else {
                interimTranscript += transcript;
            }
        }
        
        // 实时显示识别结果
        if (interimTranscript) {
            inputMessage.value = finalTranscript + interimTranscript;
            checkSendButton();
        }
        
        // 当有最终结果时，显示完整文本
        if (finalTranscript) {
            inputMessage.value = finalTranscript;
            checkSendButton();
        }
    };

    // 语音识别结束事件
    recognition.onend = function() {
        console.log('语音识别结束');
        isRecording = false;
        voiceBtn.classList.remove('recording');
        
        // 隐藏语音识别提示
        const voiceHint = document.getElementById('voiceRecordingHint');
        if (voiceHint) voiceHint.classList.remove('show');
        
        // 如果有最终结果，放入输入框让用户确认
        if (finalTranscript.trim()) {
            inputMessage.value = finalTranscript;
            checkSendButton();
            
            // 输入框获得焦点，方便用户编辑
            inputMessage.focus();
            
            // 如果输入框有内容，滚动到光标位置
            if (inputMessage.value) {
                inputMessage.scrollTop = inputMessage.scrollHeight;
            }
            
            // 显示确认提示
            showVoiceInputConfirmation();
        } else {
            // 如果没有识别到内容，显示提示
            console.log('没有识别到语音内容');
        }
    };

    // 语音识别错误事件
    recognition.onerror = function(event) {
        console.error('语音识别错误:', event.error);
        isRecording = false;
        voiceBtn.classList.remove('recording');
        
        // 隐藏语音识别提示
        const voiceHint = document.getElementById('voiceRecordingHint');
        if (voiceHint) voiceHint.classList.remove('show');
        
        // 显示错误提示
        if (event.error === 'not-allowed') {
            alert('请允许浏览器使用麦克风权限');
        } else if (event.error === 'no-speech') {
            console.log('没有检测到语音');
            showVoiceInputNoSpeech();
        }
    };
}

// 显示语音输入确认提示
function showVoiceInputConfirmation() {
    // 创建一个临时的确认提示
    const confirmationDiv = document.createElement('div');
    confirmationDiv.className = 'voice-confirmation-hint';
    confirmationDiv.innerHTML = `
        <span>已识别语音，请确认后点击发送</span>
        <button class="voice-confirm-btn">发送</button>
        <button class="voice-cancel-btn">取消</button>
    `;
    
    // 添加到页面
    document.querySelector('.app-container').appendChild(confirmationDiv);
    
    // 显示提示
    setTimeout(() => {
        confirmationDiv.classList.add('show');
    }, 10);
    
    // 发送按钮事件
    confirmationDiv.querySelector('.voice-confirm-btn').addEventListener('click', function() {
        sendMessage();
        hideVoiceInputConfirmation(confirmationDiv);
    });
    
    // 取消按钮事件
    confirmationDiv.querySelector('.voice-cancel-btn').addEventListener('click', function() {
        // 清空输入框
        inputMessage.value = '';
        checkSendButton();
        hideVoiceInputConfirmation(confirmationDiv);
    });
    
    // 5秒后自动隐藏
    voiceInputTimer = setTimeout(() => {
        hideVoiceInputConfirmation(confirmationDiv);
    }, 5000);
}

// 隐藏语音输入确认提示
function hideVoiceInputConfirmation(confirmationDiv) {
    if (confirmationDiv) {
        confirmationDiv.classList.remove('show');
        setTimeout(() => {
            if (confirmationDiv.parentNode) {
                confirmationDiv.parentNode.removeChild(confirmationDiv);
            }
        }, 300);
    }
    
    if (voiceInputTimer) {
        clearTimeout(voiceInputTimer);
        voiceInputTimer = null;
    }
}

// 显示无语音检测提示
function showVoiceInputNoSpeech() {
    const noSpeechDiv = document.createElement('div');
    noSpeechDiv.className = 'voice-nospeech-hint';
    noSpeechDiv.innerHTML = `<span>未检测到语音，请重试</span>`;
    
    document.querySelector('.app-container').appendChild(noSpeechDiv);
    
    setTimeout(() => {
        noSpeechDiv.classList.add('show');
    }, 10);
    
    // 2秒后自动隐藏
    setTimeout(() => {
        noSpeechDiv.classList.remove('show');
        setTimeout(() => {
            if (noSpeechDiv.parentNode) {
                noSpeechDiv.parentNode.removeChild(noSpeechDiv);
            }
        }, 300);
    }, 2000);
}

// 切换语音识别状态
function toggleSpeechRecognition() {
    const voiceHint = document.getElementById('voiceRecordingHint');
    
    if (!recognition) {
        alert('当前浏览器不支持语音识别功能');
        return;
    }
    
    if (isRecording) {
        // 停止录音
        recognition.stop();
        if (voiceHint) voiceHint.classList.remove('show');
    } else {
        // 开始录音
        try {
            recognition.start();
            if (voiceHint) voiceHint.classList.add('show');
        } catch (error) {
            console.error('启动语音识别失败:', error);
            alert('启动语音识别失败，请确保已允许麦克风权限');
            if (voiceHint) voiceHint.classList.remove('show');
        }
    }
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
                
                // 如果TTS启用，自动播放AI回复
                if (ttsEnabled) {
                    // 延迟播放，让消息先显示出来
                    setTimeout(() => {
                        speakText(data[0].text, emotion);
                    }, 800);
                }
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
                
                // 如果TTS启用，自动播放默认回复
                if (ttsEnabled) {
                    setTimeout(() => {
                        speakText(aiMessage.content, '中性');
                    }, 800);
                }
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
            
            // 如果TTS启用，自动播放错误回复
            if (ttsEnabled) {
                setTimeout(() => {
                    speakText(errorMessage.content, '消极');
                }, 800);
            }

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
    messages.forEach((msg, index) => {
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

        // 如果是AI消息，添加语音播放按钮
        let playButton = null;
        if (msg.role === 'ai') {
            playButton = document.createElement('button');
            playButton.className = 'message-play-btn';
            playButton.setAttribute('data-text', encodeURIComponent(msg.content));
            
            // 检查是否正在播放这条消息
            const isPlayingThis = isSpeaking && currentUtterance && 
                decodeURIComponent(currentUtterance.text || '') === msg.content;
            
            playButton.innerHTML = isPlayingThis ? 
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><rect x="6" y="4" width="4" height="16"></rect><rect x="14" y="4" width="4" height="16"></rect></svg>' : 
                '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
            playButton.title = isPlayingThis ? '正在播放...' : '播放Judy语音';
            
            if (isPlayingThis) {
                playButton.classList.add('playing');
            }
            
            // 添加播放事件
            playButton.addEventListener('click', function(e) {
                e.stopPropagation();
                
                if (isPlayingThis) {
                    // 如果正在播放这条消息，停止播放
                    stopCurrentSpeech();
                } else {
                    // 否则播放这条消息
                    speakText(msg.content, msg.emotion);
                }
            });
        }

        // 组装
        contentEl.appendChild(strongEl);
        contentEl.appendChild(spanEl);
        contentContainer.appendChild(contentEl);
        contentContainer.appendChild(emotionEmojiEl);
        
        // 如果是AI消息，添加播放按钮
        if (playButton) {
            contentContainer.appendChild(playButton);
        }
        
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

// 更新所有播放按钮状态
function updateAllPlayButtons() {
    const playButtons = document.querySelectorAll('.message-play-btn');
    playButtons.forEach(button => {
        button.classList.remove('playing');
        button.innerHTML = '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>';
        button.title = '播放Judy语音';
    });
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

        // 停止当前语音
        stopCurrentSpeech();

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
