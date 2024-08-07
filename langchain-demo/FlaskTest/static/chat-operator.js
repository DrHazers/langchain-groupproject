document.addEventListener('DOMContentLoaded', function () {
    const newChatBtn = document.getElementById('new-chat-btn');
    const sendBtn = document.getElementById('send-btn');
    const historyContainer = document.querySelector('.history-container');
    const chatBox = document.querySelector('.chat-box');
    const messageInput = document.getElementById('message-input');

    let chatRecords = JSON.parse(localStorage.getItem('chatRecords')) || [];
    let currentChatIndex = -1;

    if (chatRecords.length > 0) {
        chatRecords.forEach((record, index) => {
            createChatRecordElement(index, record[0]?.text);
        });
        switchChat(0); // Load the first chat by default
    } else {
        createNewChat();
    }

    newChatBtn.addEventListener('click', function () {
        createNewChat();
    });

    sendBtn.addEventListener('click', function () {
        sendMessage();
    });

    messageInput.addEventListener('keydown', function (event) {
        if (event.key === 'Enter') {
            event.preventDefault(); // Prevents the default behavior of adding a new line
            sendMessage();
        }
    });

    function createNewChat() {
        chatRecords.push([]);
        switchChat(chatRecords.length - 1);
        saveToLocalStorage();
    }

    function createChatRecordElement(index, firstMessageText) {
        const chatRecord = document.createElement('div');
        chatRecord.classList.add('record');
        chatRecord.dataset.index = index;

        const titleSpan = document.createElement('span');
        titleSpan.textContent = firstMessageText ? firstMessageText.slice(0, 7) + '...' : '新聊天...';
        chatRecord.appendChild(titleSpan);

        const deleteBtn = document.createElement('button');
        deleteBtn.classList.add('delete-btn');
        deleteBtn.innerHTML =
            `<img src="../static/material/delete.svg" alt="删除" class="delete-icon">`;
        deleteBtn.addEventListener('click', function (event) {
            event.stopPropagation();
            deleteChat(index);
        });
        chatRecord.appendChild(deleteBtn);

        chatRecord.addEventListener('click', function () {
            switchChat(index);
        });

        historyContainer.appendChild(chatRecord);
    }

    function switchChat(index) {
        currentChatIndex = index;
        const chatRecord = chatRecords[index];
        chatBox.innerHTML = '';
        chatRecord.forEach(msg => {
            const messageDiv = document.createElement('div');
            messageDiv.classList.add('message', msg.type);
            messageDiv.textContent = msg.text;
            chatBox.appendChild(messageDiv);
        });
    }

    function addSentMessage(type, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type);
        chatBox.appendChild(messageDiv);
        messageDiv.textContent = text;


        if (currentChatIndex > -1) {
            chatRecords[currentChatIndex].push({ type, text });

            if (chatRecords[currentChatIndex].length === 1) {
                createChatRecordElement(currentChatIndex, text);
            } else {
                updateChatTitle(currentChatIndex);
            }

            saveToLocalStorage();
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function addReceiveMessage(type, text) {
        const messageDiv = document.createElement('div');
        messageDiv.classList.add('message', type);
        chatBox.appendChild(messageDiv);
        printText(messageDiv, text);

        if (currentChatIndex > -1) {
            chatRecords[currentChatIndex].push({ type, text });

            if (chatRecords[currentChatIndex].length === 1) {
                createChatRecordElement(currentChatIndex, text);
            } else {
                updateChatTitle(currentChatIndex);
            }

            saveToLocalStorage();
        }
        chatBox.scrollTop = chatBox.scrollHeight;
    }

    function printText(dom, content, speed = 50) {
        let index = 0
        setCursorStatus (dom, 'typing')
        let printInterval = setInterval (() => {
            dom.textContent = dom.textContent + content[index];
            index++
            if (index >= content.length) {
                setCursorStatus (dom, 'end')
                clearInterval (printInterval)
            }
        }, speed)
    }

    function setCursorStatus(dom, status) {
        const classList = {
            loading: 'typing blinker',
            typing: 'typing',
            end: '',
        }
        dom.classList.remove('blinker', 'typing');
        if (classList[status]) {
            dom.classList.add(classList[status]);
        }
    }

    function updateChatTitle(index) {
        const chatRecordDiv = historyContainer.querySelector(`.record[data-index='${index}']`);
        const titleSpan = chatRecordDiv.querySelector('span');
        const firstMessage = chatRecords[index].find(msg => msg.type === 'sent');
        if (firstMessage) {
            titleSpan.textContent = firstMessage.text.slice(0, 10) + '...';
        }
    }

    function deleteChat(index) {
        chatRecords.splice(index, 1);
        const chatRecordDiv = historyContainer.querySelector(`.record[data-index='${index}']`);
        historyContainer.removeChild(chatRecordDiv);

        // Adjust indices of remaining records
        Array.from(historyContainer.children).forEach((record, i) => {
            record.dataset.index = i;
        });

        if (currentChatIndex === index) {
            chatBox.innerHTML = '';
            currentChatIndex = -1;
        } else if (currentChatIndex > index) {
            currentChatIndex--;
        }

        if (chatRecords.length === 0) {
            createNewChat();
        }

        saveToLocalStorage();
    }

    function sendMessage() {
        const message = messageInput.value.trim();
        if (message) {
            addSentMessage('sent', message);

            var formData= {
                question: messageInput.value
            };

            fetch('/submit-form' ,{
                method: 'POST' , // 或者 'GET'
                headers: {
                    'Content-Type': 'application/json' , // 告诉服务器我们发送的是JSON格式的数据
                } ,
                body: JSON.stringify(formData) // 将JavaScript对象转换为JSON字符串
            })
                .then(response => {
                    if(!response.ok) {
                        throw new Error('Network response was not ok');
                    }
                    return response.json(); // 解析JSON格式的响应体
                })
                .then(data => {
                    console.log('Success:' ,data);
                    // 使用Fetch API请求数据
                    fetch('/get-data')
                        .then(response => {
                            // 确保请求成功
                            if(!response.ok) {
                                throw new Error('Network response was not ok');
                            }
                            // 解析JSON数据
                            return response.json();
                        })
                        .then(data => {
                            // 处理数据
                            setTimeout(() => {
                                addReceiveMessage('received' ,data.message);
                            } ,500);
                            // displayResponseLetterByLetter(data.message);
                        })
                        .catch(error => {
                            console.error('There was a problem with your fetch operation:' ,error);
                        });
                })
                .catch(error => {
                    console.error('There was a problem with your fetch operation:' ,error);
                });
            messageInput.value = '';
        }
    }

    function adjustHeight() {
        const textarea = document.getElementById('message-input');

        textarea.addEventListener('input', function() {
            // Reset textarea height to auto to correctly calculate the scroll height
            textarea.style.height = 'auto';
            // Set the height to the scroll height
            textarea.style.height = textarea.scrollHeight + 'px';
        });
    }


    function saveToLocalStorage() {
        localStorage.setItem('chatRecords', JSON.stringify(chatRecords));
    }
});
