const chat = document.getElementById("chat");
const input = document.getElementById("q");
const fileInput = document.getElementById("file");

// Handle enter key press
input.addEventListener("keypress", function(event) {
    if (event.key === "Enter") {
        event.preventDefault();
        analyze();
    }
});

// Handle file upload
fileInput.addEventListener("change", function (e) {
    if (!e.target.files.length) return;
    
    const name = e.target.files[0].name;
    const size = (e.target.files[0].size / 1024).toFixed(2);
    
    // Append user file message
    appendUserFile(name, size);
    
    // Reset file input
    fileInput.value = "";
    
    // Simulate AI response to file upload
    simulateAIResponse("File uploaded successfully. I will analyze the contents of this log file. What specific threats should I look for?");
});

function appendUserFile(filename, sizeKB) {
    const fileHtml = `
    <div class="message user-message">
        <div class="avatar-wrapper"><i class="fa-solid fa-user"></i></div>
        <div class="message-content" style="background-color: transparent; padding: 0;">
            <div class="file-upload-card">
                <div class="file-icon"><i class="fa-solid fa-file-shield"></i></div>
                <div>
                    <div style="font-weight: 600;">Uploaded Log File</div>
                    <div style="font-size: 0.8rem; color: rgba(255,255,255,0.8);">${filename} (${sizeKB} KB)</div>
                </div>
            </div>
        </div>
    </div>
    `;
    chat.insertAdjacentHTML('beforeend', fileHtml);
    scrollToBottom();
}

function appendUserMessage(text) {
    const userHtml = `
    <div class="message user-message">
        <div class="avatar-wrapper"><i class="fa-solid fa-user"></i></div>
        <div class="message-content">
            ${escapeHTML(text)}
        </div>
    </div>
    `;
    chat.insertAdjacentHTML('beforeend', userHtml);
    scrollToBottom();
}

function appendTypingIndicator() {
    const indicatorId = 'typing-' + Date.now();
    const typingHtml = `
    <div class="message ai-message" id="${indicatorId}">
        <div class="avatar-wrapper"><i class="fa-solid fa-robot"></i></div>
        <div class="message-content">
            <div class="typing-indicator">
                <span></span><span></span><span></span>
            </div>
        </div>
    </div>
    `;
    chat.insertAdjacentHTML('beforeend', typingHtml);
    scrollToBottom();
    return indicatorId;
}

function removeElement(id) {
    const element = document.getElementById(id);
    if (element) {
        element.remove();
    }
}

function appendAIAnalysis() {
    const analysisHtml = `
    <div class="message ai-message">
        <div class="avatar-wrapper"><i class="fa-solid fa-robot"></i></div>
        <div class="message-content" style="background-color: transparent; padding: 0; width: 100%;">
            <div class="analysis-card">
                <div class="analysis-header">
                    <i class="fa-solid fa-shield-virus"></i> Threat Analysis Complete
                </div>
                
                <div class="analysis-grid">
                    <span class="analysis-label">Threat Level:</span>
                    <span class="analysis-value severity-medium"><i class="fa-solid fa-circle-exclamation"></i> Medium</span>
                    
                    <span class="analysis-label">Threat Type:</span>
                    <span class="analysis-value">Suspicious PowerShell Execution</span>
                    
                    <span class="analysis-label">MITRE ATT&CK:</span>
                    <span class="analysis-value"><a href="#" style="color: var(--info);">T1059.001</a> (PowerShell)</span>
                    
                    <span class="analysis-label">Affected Host:</span>
                    <span class="analysis-value">WIN-CLIENT-07</span>
                    
                    <span class="analysis-label">Detected IOC:</span>
                    <span class="analysis-value code-block">powershell.exe -enc JABz...</span>
                </div>
                
                <div class="recommendations">
                    <h4><i class="fa-solid fa-list-check"></i> Recommended Actions</h4>
                    <ul>
                        <li>Isolate the affected endpoint (WIN-CLIENT-07) from the network immediately.</li>
                        <li>Investigate the parent process that spawned this PowerShell instance.</li>
                        <li>Reset user credentials if compromise is confirmed.</li>
                    </ul>
                </div>
            </div>
        </div>
    </div>
    `;
    chat.insertAdjacentHTML('beforeend', analysisHtml);
    scrollToBottom();
}

function simulateAIResponse(text) {
    const typingId = appendTypingIndicator();
    
    setTimeout(() => {
        removeElement(typingId);
        const responseHtml = `
        <div class="message ai-message">
            <div class="avatar-wrapper"><i class="fa-solid fa-robot"></i></div>
            <div class="message-content">
                ${text}
            </div>
        </div>
        `;
        chat.insertAdjacentHTML('beforeend', responseHtml);
        scrollToBottom();
    }, 1500);
}

function analyze() {
    const text = input.value.trim();
    if (text === "") return;
    
    // 1. Add user message
    appendUserMessage(text);
    input.value = "";
    
    // 2. Show typing indicator
    const typingId = appendTypingIndicator();
    
    // 3. Simulate processing stages
    setTimeout(() => {
        const typingEl = document.getElementById(typingId);
        if(typingEl) typingEl.querySelector('.message-content').innerHTML = "<em>Parsing Event Logs...</em> <i class='fa-solid fa-circle-notch fa-spin' style='margin-left: 10px;'></i>";
    }, 800);
    
    setTimeout(() => {
        const typingEl = document.getElementById(typingId);
        if(typingEl) typingEl.querySelector('.message-content').innerHTML = "<em>Running MITRE ATT&CK Detection Models...</em> <i class='fa-solid fa-circle-notch fa-spin' style='margin-left: 10px;'></i>";
    }, 1800);
    
    // 4. Show final analysis
    setTimeout(() => {
        removeElement(typingId);
        appendAIAnalysis();
    }, 3200);
}

function scrollToBottom() {
    chat.scrollTop = chat.scrollHeight;
}

// Utility to prevent HTML injection
function escapeHTML(str) {
    return str.replace(/[&<>'"]/g, 
        tag => ({
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            "'": '&#39;',
            '"': '&quot;'
        }[tag] || tag)
    );
}