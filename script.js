// ================= GLOBAL VARIABLES =================
const kieApiKey = "416127f06c4433f3aac9ea71c9e81ffc";
const backendUrl = "https://veo-backend-1.onrender.com";

// Store active tasks per instance
const activeTasks = {};

// History pagination
let historyPage = 0;
const historyPerPage = 9;

// ================= IMAGE INPUT HANDLING =================
function handleVeoImageInput(input, previewId, loaderId, progressId) {
    const url = input.value.trim();
    if (!url) return;

    if (!url.startsWith("http://") && !url.startsWith("https://")) {
        alert("Please enter a valid image URL");
        return;
    }

    const loader = document.getElementById(loaderId);
    const progressSpan = document.getElementById(progressId);
    const preview = document.getElementById(previewId);

    loader.style.display = "block";
    preview.style.display = "none";
    progressSpan.textContent = "0%";

    let progress = 0;
    const interval = setInterval(() => {
        progress += 25;
        progressSpan.textContent = `${progress}%`;

        if (progress >= 100) {
            clearInterval(interval);
            loader.style.display = "none";

            preview.src = url;
            preview.onload = () => {
                preview.style.display = "block";
                checkInstanceValidation(input.id);
            };
            preview.onerror = () => {
                alert("Failed to load image. Please check the URL.");
                loader.style.display = "none";
            };
        }
    }, 150);
}

// ================= VALIDATION FOR EACH INSTANCE =================
function checkInstanceValidation(inputId) {
    const instanceNum = inputId.replace(/\D/g, '');
    
    const script = document.getElementById(`script${instanceNum}`).value.trim();
    const startImage = document.getElementById(`image${instanceNum}_start`).value.trim();
    const endImage = document.getElementById(`image${instanceNum}_end`).value.trim();
    
    const generateBtn = document.getElementById(`generateBtn${instanceNum}`);
    
    if (generateBtn) {
        if (script && startImage && endImage) {
            generateBtn.disabled = false;
        } else {
            generateBtn.disabled = true;
        }
    }
}

// ================= UPDATE SCRIPT FROM CHECKBOXES =================
function updateScriptFromCheckbox(instanceNum) {
    const scriptTextarea = document.getElementById(`script${instanceNum}`);
    const toneOption1 = document.getElementById(`toneOption1_${instanceNum}`);
    const toneOption2 = document.getElementById(`toneOption2_${instanceNum}`);
    
    // Get current script
    let currentScript = scriptTextarea.value;
    
    // Remove existing tone options if they exist (to avoid duplicates)
    currentScript = currentScript.replace(/\n\nTONE:.*$/g, "");
    currentScript = currentScript.replace(/\n\nTone Indian Hinglish.*$/g, "");
    
    // Add selected tone option(s)
    const selectedOptions = [];
    
    if (toneOption1.checked) {
        selectedOptions.push(
            "TONE: Indian Hinglish with Character Age 27, with suitable expression according to the script as it will be used as a hook, No on-screen text and make the character say the script as it is."
        );
    }
    
    if (toneOption2.checked) {
        selectedOptions.push(
            "Tone Indian Hinglish - Indian tone age 27. this is a hook for an ad so make it that way. no onscreen text. make the person say the script exactly."
        );
    }
    
    // Append selected options to script
    if (selectedOptions.length > 0) {
        const appendedText = "\n\n" + selectedOptions.join("\n\n");
        scriptTextarea.value = currentScript + appendedText;
    }
}

// ================= GENERATE VEO VIDEO FOR SPECIFIC INSTANCE =================
async function generateVeoVideo(instanceNum) {
    const script = document.getElementById(`script${instanceNum}`).value.trim();
    const startImage = document.getElementById(`image${instanceNum}_start`).value.trim();
    const endImage = document.getElementById(`image${instanceNum}_end`).value.trim();
    
    const model = document.getElementById("veoModel").value;
    const aspectRatio = document.getElementById("veoAspectRatio").value;
    const enableTranslation = document.getElementById("veoTranslation").value === "true";
    
    const progressSection = document.getElementById(`progress${instanceNum}`);
    const progressText = document.getElementById(`progressText${instanceNum}`);
    const progressBar = document.getElementById(`progressBar${instanceNum}`);
    const resultSection = document.getElementById(`result${instanceNum}`);
    const generateBtn = document.getElementById(`generateBtn${instanceNum}`);
    
    // Show progress, hide result
    progressSection.style.display = "block";
    resultSection.style.display = "none";
    generateBtn.disabled = true;
    
    progressText.textContent = "Creating task...";
    progressBar.style.width = "10%";
    
    // Prepare request data
    const requestData = {
        prompt: script,
        imageUrls: [startImage, endImage],
        model: model,
        generationType: "FIRST_AND_LAST_FRAMES_2_VIDEO",
        aspect_ratio: aspectRatio,
        enableTranslation: enableTranslation,
        callBackUrl: `${backendUrl}/api/veo/callback`
    };
    
    try {
        // Create task
        const response = await fetch(`${backendUrl}/api/veo/generate`, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${kieApiKey}`,
                "Content-Type": "application/json"
            },
            body: JSON.stringify(requestData)
        });
        
        const result = await response.json();
        
        if (result.code === 200) {
            const taskId = result.data.taskId;
            activeTasks[instanceNum] = taskId;
            
            console.log("Task created:", taskId);
            progressText.textContent = "Task created. Processing...";
            progressBar.style.width = "30%";
            
            // Poll for completion
            pollForVideoCompletion(taskId, instanceNum);
        } else {
            throw new Error(result.msg || "Failed to create task");
        }
    } catch (error) {
        console.error("Error creating Veo 3.1 task:", error);
        progressText.textContent = `Error: ${error.message}`;
        progressBar.style.width = "0%";
        generateBtn.disabled = false;
    }
}

// ================= POLL FOR VIDEO COMPLETION (INSTANCE-SPECIFIC) =================
async function pollForVideoCompletion(taskId, instanceNum) {
    const progressText = document.getElementById(`progressText${instanceNum}`);
    const progressBar = document.getElementById(`progressBar${instanceNum}`);
    const resultSection = document.getElementById(`result${instanceNum}`);
    const generateBtn = document.getElementById(`generateBtn${instanceNum}`);
    
    let pollCount = 0;
    const maxPolls = 120;  // 10 minutes at 5s intervals
    
    const interval = setInterval(async () => {
        pollCount++;
        const progressPercent = Math.min(30 + (pollCount / maxPolls) * 70, 95);
        progressBar.style.width = `${progressPercent}%`;
        
        if (pollCount > maxPolls) {
            clearInterval(interval);
            progressText.textContent = "Polling timed out. Check backend logs.";
            progressBar.style.width = "0%";
            generateBtn.disabled = false;
            delete activeTasks[instanceNum];
            return;
        }
        
        try {
            // Poll backend for task status (instance-specific)
            const res = await fetch(`${backendUrl}/api/veo/status/${taskId}`);
            const data = await res.json();
            
            console.log("Poll response:", data);
            
            if (data.status === "completed") {
                clearInterval(interval);
                progressText.textContent = "✅ Video ready!";
                progressBar.style.width = "100%";
                
                // Show result directly below this instance
                const videoUrl = data.videoUrl;
                resultSection.style.display = "block";
                resultSection.querySelector("video").src = videoUrl;
                resultSection.querySelector("a").href = videoUrl;
                
                // Save to history
                saveToHistory(videoUrl);
                
                // Reset button after delay
                setTimeout(() => {
                    generateBtn.disabled = false;
                }, 2000);
                
                // Clear active task
                delete activeTasks[instanceNum];
            } else if (data.status === "failed") {
                clearInterval(interval);
                progressText.textContent = `❌ Generation failed: ${data.error || "Unknown error"}`;
                progressBar.style.width = "0%";
                generateBtn.disabled = false;
                delete activeTasks[instanceNum];
            } else {
                progressText.textContent = `Processing... (${pollCount}/${maxPolls})`;
            }
        } catch (error) {
            console.error("Error polling video status:", error);
            progressText.textContent = "Error checking status. Retrying...";
        }
    }, 5000);
}

// ================= SAVE TO HISTORY =================
async function saveToHistory(videoUrl) {
    try {
        await fetch(`${backendUrl}/api/saveHistory`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ url: videoUrl })
        });
    } catch (error) {
        console.error("Error saving to history:", error);
    }
}

// ================= HISTORY FUNCTIONS =================
async function loadHistory() {
    const historyGrid = document.getElementById('historyGrid');
    const noHistory = document.getElementById('noHistory');
    const showMoreBtn = document.getElementById('showMoreBtn');
    
    try {
        const res = await fetch(`${backendUrl}/api/history`);
        const data = await res.json();
        
        if (data.history && data.history.length > 0) {
            noHistory.style.display = 'none';
            
            // Show first 9 (or current page)
            const videosToShow = data.history.slice(0, (historyPage + 1) * historyPerPage);
            
            historyGrid.innerHTML = '';
            videosToShow.forEach((video, index) => {
                const historyItem = document.createElement('div');
                historyItem.className = 'history-item';
                historyItem.innerHTML = `
                    <video src="${video.url}" controls></video>
                    <div class="history-item-info">
                        <span>${video.timestamp}</span>
                    </div>
                `;
                historyGrid.appendChild(historyItem);
            });
            
            // Show "Show More" if there are more videos
            if (data.history.length > (historyPage + 1) * historyPerPage) {
                showMoreBtn.style.display = 'block';
            } else {
                showMoreBtn.style.display = 'none';
            }
        } else {
            noHistory.style.display = 'block';
            showMoreBtn.style.display = 'none';
        }
    } catch (error) {
        console.error("Error loading history:", error);
        noHistory.style.display = 'block';
    }
}

function loadMoreHistory() {
    historyPage++;
    loadHistory();
}

// ================= ADDITIONAL FUNCTIONS =================

// Copy script to clipboard
function copyScript(instanceNum) {
    const scriptTextarea = document.getElementById(`script${instanceNum}`);
    const copyBtn = document.getElementById(`copyBtn${instanceNum}`);
    
    navigator.clipboard.writeText(scriptTextarea.value).then(() => {
        alert("Script copied to clipboard!");
    }).catch(err => {
        console.error("Failed to copy script: ", err);
        alert("Failed to copy script. Please try again.");
    });
}

// Toggle edit mode for script
function toggleEdit(instanceNum) {
    const scriptTextarea = document.getElementById(`script${instanceNum}`);
    const editBtn = document.getElementById(`editBtn${instanceNum}`);
    
    if (scriptTextarea.readOnly) {
        scriptTextarea.readOnly = false;
        editBtn.innerHTML = '<span class="btn-icon">💾</span> Save';
        scriptTextarea.focus();
    } else {
        scriptTextarea.readOnly = true;
        editBtn.innerHTML = '<span class="btn-icon">✏️</span> Edit';
    }
}

// Toggle sidebar
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebarOverlay');
    sidebar.classList.toggle('active');
    overlay.classList.toggle('active');
    
    if (sidebar.classList.contains('active')) {
        loadHistory();
    }
}

// Change model
function changeModel() {
    const modelSelect = document.getElementById('modelSelect');
    const currentModel = modelSelect.value;
    console.log("Model changed to:", currentModel);
}
