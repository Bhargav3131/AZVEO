// ================= GLOBAL VARIABLES =================
const kieApiKey = "416127f06c4433f3aac9ea71c9e81ffc";
const backendUrl = "https://veo-backend-1.onrender.com";

// Store active tasks per instance
const activeTasks = {};

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


