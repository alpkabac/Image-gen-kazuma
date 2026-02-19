/* eslint-disable no-undef */
import { extension_settings, getContext } from "../../../extensions.js";
import { saveSettingsDebounced, generateQuietPrompt, saveChat, reloadCurrentChat, eventSource, event_types, addOneMessage, getRequestHeaders, appendMediaToMessage } from "../../../../script.js";
import { saveBase64AsFile, getBase64Async } from "../../../utils.js";
import { humanizedDateTime } from "../../../RossAscends-mods.js";
import { Popup, POPUP_TYPE } from "../../../popup.js";

const extensionName = "Image-gen-kazuma";
const extensionFolderPath = `scripts/extensions/third-party/${extensionName}`;

// --- UPDATED CONSTANTS (With Dscriptions) ---
const KAZUMA_PLACEHOLDERS = [
    { key: '"*input*"', desc: "Positive Prompt (Text)" },
    { key: '"*ninput*"', desc: "Negative Prompt (Text)" },
    { key: '"*seed*"', desc: "Seed (Integer)" },
    { key: '"*steps*"', desc: "Sampling Steps (Integer)" },
    { key: '"*cfg*"', desc: "CFG Scale (Float)" },
    { key: '"*denoise*"', desc: "Denoise Strength (Float)" },
    { key: '"*clip_skip*"', desc: "CLIP Skip (Integer)" },
    { key: '"*model*"', desc: "Checkpoint Name" },
    { key: '"*sampler*"', desc: "Sampler Name" },
    { key: '"*scheduler*"', desc: "Scheduler Name" },
    { key: '"*width*"', desc: "Image Width (px)" },
    { key: '"*height*"', desc: "Image Height (px)" },
    { key: '"*lora*"', desc: "LoRA 1 Filename" },
    { key: '"*lorawt*"', desc: "LoRA 1 Weight (Float)" },
    { key: '"*lora2*"', desc: "LoRA 2 Filename" },
    { key: '"*lorawt2*"', desc: "LoRA 2 Weight (Float)" },
    { key: '"*lora3*"', desc: "LoRA 3 Filename" },
    { key: '"*lorawt3*"', desc: "LoRA 3 Weight (Float)" },
    { key: '"*lora4*"', desc: "LoRA 4 Filename" },
    { key: '"*lorawt4*"', desc: "LoRA 4 Weight (Float)" },
    { key: '"*image*"', desc: "Input Image Filename (Edit Mode)" }
];

const RESOLUTIONS = [
    { label: "1024 x 1024 (SDXL 1:1)", w: 1024, h: 1024 },
    { label: "1152 x 896 (SDXL Landscape)", w: 1152, h: 896 },
    { label: "896 x 1152 (SDXL Portrait)", w: 896, h: 1152 },
    { label: "1216 x 832 (SDXL Landscape)", w: 1216, h: 832 },
    { label: "832 x 1216 (SDXL Portrait)", w: 832, h: 1216 },
    { label: "1344 x 768 (SDXL Landscape)", w: 1344, h: 768 },
    { label: "768 x 1344 (SDXL Portrait)", w: 768, h: 1344 },
    { label: "512 x 512 (SD 1.5 1:1)", w: 512, h: 512 },
    { label: "768 x 512 (SD 1.5 Landscape)", w: 768, h: 512 },
    { label: "512 x 768 (SD 1.5 Portrait)", w: 512, h: 768 },
];

const defaultWorkflowData = {
  "3": { "inputs": { "seed": "seed", "steps": 20, "cfg": 7, "sampler_name": "sampler", "scheduler": "normal", "denoise": 1, "model": ["35", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["5", 0] }, "class_type": "KSampler" },
  "4": { "inputs": { "ckpt_name": "model" }, "class_type": "CheckpointLoaderSimple" },
  "5": { "inputs": { "width": "width", "height": "height", "batch_size": 1 }, "class_type": "EmptyLatentImage" },
  "6": { "inputs": { "text": "input", "clip": ["35", 1] }, "class_type": "CLIPTextEncode" },
  "7": { "inputs": { "text": "ninput", "clip": ["35", 1] }, "class_type": "CLIPTextEncode" },
  "8": { "inputs": { "samples": ["33", 0], "vae": ["4", 2] }, "class_type": "VAEDecode" },
  "14": { "inputs": { "images": ["8", 0] }, "class_type": "PreviewImage" },
  "33": { "inputs": { "seed": "seed", "steps": 20, "cfg": 7, "sampler_name": "sampler", "scheduler": "normal", "denoise": 0.5, "model": ["4", 0], "positive": ["6", 0], "negative": ["7", 0], "latent_image": ["34", 0] }, "class_type": "KSampler" },
  "34": { "inputs": { "upscale_method": "nearest-exact", "scale_by": 1.2, "samples": ["3", 0] }, "class_type": "LatentUpscaleBy" },
  "35": { "inputs": { "lora_name": "lora", "strength_model": "lorawt", "strength_clip": "lorawt", "model": ["4", 0], "clip": ["4", 1] }, "class_type": "LoraLoader" }
};

const defaultSettings = {
    enabled: true,
    debugPrompt: false,
    comfyUrl: "http://127.0.0.1:8188",
    connectionProfile: "",
    currentWorkflowName: "", // Server manages this now
    selectedModel: "",
    selectedLora: "",
    selectedLora2: "",
    selectedLora3: "",
    selectedLora4: "",
    selectedLoraWt: 1.0,
    selectedLoraWt2: 1.0,
    selectedLoraWt3: 1.0,
    selectedLoraWt4: 1.0,
    loraEnabled1: true,
    loraEnabled2: true,
    loraEnabled3: true,
    loraEnabled4: true,
    imgWidth: 1024,
    imgHeight: 1024,
    autoGenEnabled: false,
    autoGenFreq: 1,
    customNegative: "bad quality, blurry, worst quality, low quality",
    customSeed: -1,
    selectedSampler: "euler",
    selectedScheduler: "normal",
    compressImages: true,
    steps: 20,
    cfg: 7.0,
    denoise: 0.5,
    clipSkip: 1,
    profileStrategy: "current",
    promptStyle: "standard",      
    promptPerspective: "scene",   
    promptExtra: "",              
    connectionProfile: "",
    savedWorkflowStates: {},
    editMode: false,
    selectedImage: null,
    selectedImageBase64: null,
    editWorkflowName: ""
};

async function loadSettings() {
    if (!extension_settings[extensionName]) extension_settings[extensionName] = {};
    for (const key in defaultSettings) {
        if (typeof extension_settings[extensionName][key] === 'undefined') {
            extension_settings[extensionName][key] = defaultSettings[key];
        }
    }

    $("#kazuma_enable").prop("checked", extension_settings[extensionName].enabled);
    $("#kazuma_debug").prop("checked", extension_settings[extensionName].debugPrompt);
    $("#kazuma_url").val(extension_settings[extensionName].comfyUrl);
    $("#kazuma_width").val(extension_settings[extensionName].imgWidth);
    $("#kazuma_height").val(extension_settings[extensionName].imgHeight);
    $("#kazuma_auto_enable").prop("checked", extension_settings[extensionName].autoGenEnabled);
    $("#kazuma_auto_freq").val(extension_settings[extensionName].autoGenFreq);
	
    $("#kazuma_prompt_style").val(extension_settings[extensionName].promptStyle || "standard");
    $("#kazuma_prompt_persp").val(extension_settings[extensionName].promptPerspective || "scene");
    $("#kazuma_prompt_extra").val(extension_settings[extensionName].promptExtra || "");

    $("#kazuma_lora_wt").val(extension_settings[extensionName].selectedLoraWt);
    $("#kazuma_lora_wt_display").text(extension_settings[extensionName].selectedLoraWt);
    $("#kazuma_lora_wt_2").val(extension_settings[extensionName].selectedLoraWt2);
    $("#kazuma_lora_wt_display_2").text(extension_settings[extensionName].selectedLoraWt2);
    $("#kazuma_lora_wt_3").val(extension_settings[extensionName].selectedLoraWt3);
    $("#kazuma_lora_wt_display_3").text(extension_settings[extensionName].selectedLoraWt3);
    $("#kazuma_lora_wt_4").val(extension_settings[extensionName].selectedLoraWt4);
    $("#kazuma_lora_wt_display_4").text(extension_settings[extensionName].selectedLoraWt4);

    // LoRA on/off toggles
    $("#kazuma_lora_on_1").prop("checked", extension_settings[extensionName].loraEnabled1 !== false);
    $("#kazuma_lora_on_2").prop("checked", extension_settings[extensionName].loraEnabled2 !== false);
    $("#kazuma_lora_on_3").prop("checked", extension_settings[extensionName].loraEnabled3 !== false);
    $("#kazuma_lora_on_4").prop("checked", extension_settings[extensionName].loraEnabled4 !== false);

    $("#kazuma_negative").val(extension_settings[extensionName].customNegative);
    $("#kazuma_seed").val(extension_settings[extensionName].customSeed);
    $("#kazuma_compress").prop("checked", extension_settings[extensionName].compressImages);
	
	$("#kazuma_profile_strategy").val(extension_settings[extensionName].profileStrategy || "current");
    toggleProfileVisibility();

    updateSliderInput('kazuma_steps', 'kazuma_steps_val', extension_settings[extensionName].steps);
    updateSliderInput('kazuma_cfg', 'kazuma_cfg_val', extension_settings[extensionName].cfg);
    updateSliderInput('kazuma_denoise', 'kazuma_denoise_val', extension_settings[extensionName].denoise);
    updateSliderInput('kazuma_clip', 'kazuma_clip_val', extension_settings[extensionName].clipSkip);

    // Load edit mode settings
    $("#kazuma_mode").val(extension_settings[extensionName].editMode ? "edit" : "generate");
    $("#kazuma_edit_workflow_list").val(extension_settings[extensionName].editWorkflowName || "");
    
    // Restore image preview if exists
    if (extension_settings[extensionName].selectedImageBase64) {
        $("#kazuma_preview_img").attr("src", extension_settings[extensionName].selectedImageBase64);
        $("#kazuma_image_preview").show();
    }
    
    // Toggle edit controls based on mode
    const isEditMode = extension_settings[extensionName].editMode;
    $("#kazuma_edit_controls").toggle(isEditMode);
    updateGenerateButtonText(isEditMode);

    populateResolutions();
    populateProfiles();
    populateWorkflows();
    await fetchComfyLists();
}

function toggleProfileVisibility() {
    const strategy = extension_settings[extensionName].profileStrategy;

    // Always show the builder now!
    $("#kazuma_prompt_builder").show();

    // Only toggle the preset selector
    if (strategy === "specific") {
        $("#kazuma_profile").show();
    } else {
        $("#kazuma_profile").hide();
    }
}

function updateGenerateButtonText(isEditMode) {
    const btnText = isEditMode ? "Edit Image" : "Visualize Last Message";
    $("#kazuma_gen_prompt_btn").html(`<i class="fa-solid fa-bolt"></i> ${btnText}`);
}

function updateSliderInput(sliderId, numberId, value) {
    $(`#${sliderId}`).val(value);
    $(`#${numberId}`).val(value);
}

function populateResolutions() {
    const sel = $("#kazuma_resolution_list");
    sel.empty().append('<option value="">-- Select Preset --</option>');
    RESOLUTIONS.forEach((r, idx) => {
        sel.append(`<option value="${idx}">${r.label}</option>`);
    });
}

// --- WORKFLOW MANAGER ---
async function populateWorkflows() {
    const sel = $("#kazuma_workflow_list");
    const editSel = $("#kazuma_edit_workflow_list");
    sel.empty();
    editSel.empty();
    editSel.append('<option value="">-- Select Edit Workflow --</option>');
    
    try {
        const response = await fetch('/api/sd/comfy/workflows', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ url: extension_settings[extensionName].comfyUrl }),
        });

        if (response.ok) {
            const workflows = await response.json();
            workflows.forEach(w => {
                sel.append(`<option value="${w}">${w}</option>`);
                editSel.append(`<option value="${w}">${w}</option>`);
            });

            // Set generation workflow
            if (extension_settings[extensionName].currentWorkflowName) {
                if (workflows.includes(extension_settings[extensionName].currentWorkflowName)) {
                    sel.val(extension_settings[extensionName].currentWorkflowName);
                } else if (workflows.length > 0) {
                    sel.val(workflows[0]);
                    extension_settings[extensionName].currentWorkflowName = workflows[0];
                    saveSettingsDebounced();
                }
            } else if (workflows.length > 0) {
                sel.val(workflows[0]);
                extension_settings[extensionName].currentWorkflowName = workflows[0];
                saveSettingsDebounced();
            }
            
            // Set edit workflow
            if (extension_settings[extensionName].editWorkflowName) {
                if (workflows.includes(extension_settings[extensionName].editWorkflowName)) {
                    editSel.val(extension_settings[extensionName].editWorkflowName);
                }
            }
        }
    } catch (e) {
        sel.append('<option disabled>Failed to load</option>');
        editSel.append('<option disabled>Failed to load</option>');
    }
}

async function onComfyNewWorkflowClick() {
    let name = await prompt("New workflow file name (e.g. 'my_flux.json'):");
    if (!name) return;
    if (!name.toLowerCase().endsWith('.json')) name += '.json';

    try {
        const res = await fetch('/api/sd/comfy/save-workflow', {
            method: 'POST', headers: getRequestHeaders(),
            body: JSON.stringify({ file_name: name, workflow: '{}' })
        });
        if (!res.ok) throw new Error(await res.text());
        toastr.success("Workflow created!");
        await populateWorkflows();
        $("#kazuma_workflow_list").val(name).trigger('change');
        setTimeout(onComfyOpenWorkflowEditorClick, 500);
    } catch (e) { toastr.error(e.message); }
}

async function onComfyDeleteWorkflowClick() {
    const name = extension_settings[extensionName].currentWorkflowName;
    if (!name) return;
    if (!confirm(`Delete ${name}?`)) return;

    try {
        const res = await fetch('/api/sd/comfy/delete-workflow', {
            method: 'POST', headers: getRequestHeaders(),
            body: JSON.stringify({ file_name: name })
        });
        if (!res.ok) throw new Error(await res.text());
        toastr.success("Deleted.");
        await populateWorkflows();
    } catch (e) { toastr.error(e.message); }
}

/* --- WORKFLOW STUDIO (Live Capture Fix) --- */
async function onComfyOpenWorkflowEditorClick() {
    const name = extension_settings[extensionName].currentWorkflowName;
    if (!name) return toastr.warning("No workflow selected");

    // 1. Load Data
    let loadedContent = "{}";
    try {
        const res = await fetch('/api/sd/comfy/workflow', {
            method: 'POST', headers: getRequestHeaders(),
            body: JSON.stringify({ file_name: name })
        });
        if (res.ok) {
            const rawBody = await res.json();
            let jsonObj = rawBody;
            if (typeof rawBody === 'string') {
                try { jsonObj = JSON.parse(rawBody); } catch(e) {}
            }
            loadedContent = JSON.stringify(jsonObj, null, 4);
        }
    } catch (e) { toastr.error("Failed to load file. Starting empty."); }

    // 2. Variable to hold the text in memory (Critical for saving)
    let currentJsonText = loadedContent;

    // --- UI BUILDER ---
    const $container = $(`
        <div style="display: flex; flex-direction: column; width: 100%; gap: 10px;">
            <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid var(--smart-border-color); padding-bottom:10px;">
                <h3 style="margin:0;">${name}</h3>
                <div style="display:flex; gap:5px;">
                    <button class="menu_button wf-format" title="Beautify JSON"><i class="fa-solid fa-align-left"></i> Format</button>
                    <button class="menu_button wf-import" title="Upload .json file"><i class="fa-solid fa-upload"></i> Import</button>
                    <button class="menu_button wf-export" title="Download .json file"><i class="fa-solid fa-download"></i> Export</button>
                    <input type="file" class="wf-file-input" accept=".json" style="display:none;" />
                </div>
            </div>

            <div style="display: flex; gap: 15px;">
                <textarea class="text_pole wf-textarea" spellcheck="false"
                    style="flex: 1; min-height: 600px; height: 600px; font-family: 'Consolas', 'Monaco', monospace; white-space: pre; resize: none; font-size: 13px; padding: 10px; line-height: 1.4;"></textarea>

                <div style="width: 250px; flex-shrink: 0; display: flex; flex-direction: column; border-left: 1px solid var(--smart-border-color); padding-left: 10px; max-height: 600px;">
                    <h4 style="margin: 0 0 10px 0; opacity:0.8;">Placeholders</h4>
                    <div class="wf-list" style="overflow-y: auto; flex: 1; padding-right: 5px;"></div>
                </div>
            </div>
            <small style="opacity:0.5;">Tip: Ensure your JSON is valid before saving.</small>
        </div>
    `);

    // --- LOGIC ---
    const $textarea = $container.find('.wf-textarea');
    const $list = $container.find('.wf-list');
    const $fileInput = $container.find('.wf-file-input');

    // Initialize UI
    $textarea.val(currentJsonText);

    // Sidebar Generator
    KAZUMA_PLACEHOLDERS.forEach(item => {
        const $itemDiv = $('<div></div>')
            .css({
                'padding': '8px 6px', 'margin-bottom': '6px', 'background-color': 'rgba(0,0,0,0.1)',
                'border-radius': '4px', 'font-family': 'monospace', 'font-size': '12px',
                'border': '1px solid transparent', 'transition': 'all 0.2s', 'cursor': 'text'
            });
        const $keySpan = $('<span></span>').text(item.key).css({'font-weight': 'bold', 'color': 'var(--smart-text-color)'});
        const $descSpan = $('<div></div>').text(item.desc).css({ 'font-size': '11px', 'opacity': '0.7', 'margin-top': '2px', 'font-family': 'sans-serif' });
        $itemDiv.append($keySpan).append($descSpan);
        $list.append($itemDiv);
    });

    // Highlighting & LIVE UPDATE Logic
    const updateState = () => {
        // 1. Capture text into memory variable
        currentJsonText = $textarea.val();

        // 2. Run Highlighting logic (Visuals)
        $list.children().each(function() {
            const cleanKey = $(this).find('span').first().text().replace(/"/g, '');
            if (currentJsonText.includes(cleanKey)) $(this).css({'border': '1px solid #4caf50', 'background-color': 'rgba(76, 175, 80, 0.1)'});
            else $(this).css({'border': '1px solid transparent', 'background-color': 'rgba(0,0,0,0.1)'});
        });
    };

    // Bind Input Listener to update variable immediately
    $textarea.on('input', updateState);
    setTimeout(updateState, 100);

    // Toolbar Actions
    $container.find('.wf-format').on('click', () => {
        try {
            const formatted = JSON.stringify(JSON.parse($textarea.val()), null, 4);
            $textarea.val(formatted);
            updateState(); // Update variable
            toastr.success("Formatted");
        } catch(e) { toastr.warning("Invalid JSON"); }
    });

    $container.find('.wf-import').on('click', () => $fileInput.click());
    $fileInput.on('change', (e) => {
        if (!e.target.files[0]) return;
        const r = new FileReader(); r.onload = (ev) => {
            $textarea.val(ev.target.result);
            updateState(); // Update variable
            toastr.success("Imported");
        };
        r.readAsText(e.target.files[0]); $fileInput.val('');
    });

    $container.find('.wf-export').on('click', () => {
        try { JSON.parse(currentJsonText); const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([currentJsonText], {type:"application/json"})); a.download = name; a.click(); } catch(e) { toastr.warning("Invalid content"); }
    });

    // Validating Closure
    const onClosing = () => {
        try {
            JSON.parse(currentJsonText); // Validate the variable, not the UI
            return true;
        } catch (e) {
            toastr.error("Invalid JSON. Cannot save.");
            return false;
        }
    };

    const popup = new Popup($container, POPUP_TYPE.CONFIRM, '', { okButton: 'Save Changes', cancelButton: 'Cancel', wide: true, large: true, onClosing: onClosing });
    const confirmed = await popup.show();

    // SAVING
    if (confirmed) {
        try {
            console.log(`[${extensionName}] Saving workflow: ${name}`);
            // Minify
            const minified = JSON.stringify(JSON.parse(currentJsonText));
            const res = await fetch('/api/sd/comfy/save-workflow', {
                method: 'POST', headers: getRequestHeaders(),
                body: JSON.stringify({ file_name: name, workflow: minified })
            });

            if (!res.ok) throw new Error(await res.text());
            toastr.success("Workflow Saved!");
        } catch (e) {
            toastr.error("Save Failed: " + e.message);
        }
    }
}



// --- FETCH LISTS ---
async function fetchComfyLists() {
    const comfyUrl = extension_settings[extensionName].comfyUrl;
    const modelSel = $("#kazuma_model_list");
    const samplerSel = $("#kazuma_sampler_list");
    const schedulerSel = $("#kazuma_scheduler_list");
    const loraSelectors = [ $("#kazuma_lora_list"), $("#kazuma_lora_list_2"), $("#kazuma_lora_list_3"), $("#kazuma_lora_list_4") ];

    try {
        const modelRes = await fetch('/api/sd/comfy/models', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ url: comfyUrl }) });
        if (modelRes.ok) {
            const models = await modelRes.json();
            modelSel.empty().append('<option value="">-- Select Model --</option>');
            models.forEach(m => {
                let val = (typeof m === 'object' && m !== null) ? m.value : m;
                let text = (typeof m === 'object' && m !== null && m.text) ? m.text : val;
                modelSel.append(`<option value="${val}">${text}</option>`);
            });
            if (extension_settings[extensionName].selectedModel) modelSel.val(extension_settings[extensionName].selectedModel);
        }

        const samplerRes = await fetch('/api/sd/comfy/samplers', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ url: comfyUrl }) });
        if (samplerRes.ok) {
            const samplers = await samplerRes.json();
            samplerSel.empty();
            samplers.forEach(s => samplerSel.append(`<option value="${s}">${s}</option>`));
            if (extension_settings[extensionName].selectedSampler) samplerSel.val(extension_settings[extensionName].selectedSampler);
        }

        const schedulerRes = await fetch('/api/sd/comfy/schedulers', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ url: comfyUrl }) });
        if (schedulerRes.ok) {
            const schedulers = await schedulerRes.json();
            schedulerSel.empty();
            schedulers.forEach(s => schedulerSel.append(`<option value="${s}">${s}</option>`));
            if (extension_settings[extensionName].selectedScheduler) schedulerSel.val(extension_settings[extensionName].selectedScheduler);
        }

        const loraRes = await fetch(`${comfyUrl}/object_info/LoraLoader`);
        if (loraRes.ok) {
            const json = await loraRes.json();
            const files = json['LoraLoader'].input.required.lora_name[0];
            loraSelectors.forEach((sel, i) => {
                const k = i === 0 ? "selectedLora" : `selectedLora${i + 1}`;
                const v = extension_settings[extensionName][k];
                sel.empty().append('<option value="">-- No LoRA --</option>');
                files.forEach(f => sel.append(`<option value="${f}">${f}</option>`));
                if (v) sel.val(v);
            });
        }
    } catch (e) {
        console.warn(`[${extensionName}] Failed to fetch lists.`, e);
    }
}

async function onTestConnection() {
    const url = extension_settings[extensionName].comfyUrl;
    try {
        const result = await fetch('/api/sd/comfy/ping', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ url: url }) });
        if (result.ok) {
            toastr.success("ComfyUI API connected!", "Image Gen Kazuma");
            await fetchComfyLists();
        } else { throw new Error('ComfyUI returned an error via proxy.'); }
    } catch (error) { toastr.error(`Connection failed: ${error.message}`, "Image Gen Kazuma"); }
}

/* --- UPDATED GENERATION LOGIC --- */
async function onGeneratePrompt() {
    if (!extension_settings[extensionName].enabled) return;
    const context = getContext();
    if (!context.chat || context.chat.length === 0) return toastr.warning("No chat history.");

    const isEditMode = extension_settings[extensionName].editMode;
    const selectedImage = extension_settings[extensionName].selectedImage;
    
    // Check if edit mode requires an image
    if (isEditMode && !selectedImage) {
        return toastr.warning("Edit mode requires an image. Please upload or select one.");
    }

    const strategy = extension_settings[extensionName].profileStrategy || "current";
    const requestProfile = extension_settings[extensionName].connectionProfile;
    const targetDropdown = $("#settings_preset_openai");
    const originalProfile = targetDropdown.val();
    let didSwitch = false;

    if (strategy === "specific" && requestProfile && requestProfile !== originalProfile && requestProfile !== "") {
        toastr.info(`Switching presets...`);
        targetDropdown.val(requestProfile).trigger("change");
        await new Promise(r => setTimeout(r, 1000));
        didSwitch = true;
    }

    // [START PROGRESS]
    showKazumaProgress(isEditMode ? "Converting to edit instruction..." : "Generating Prompt...");

    try {
        toastr.info(isEditMode ? "Converting to edit..." : "Visualizing...", "Image Gen Kazuma");
        
        // Find the last non-system message (user or character message)
        let lastMessage = "";
        for (let i = context.chat.length - 1; i >= 0; i--) {
            const msg = context.chat[i];
            // Skip system messages (like image generation messages)
            if (!msg.is_system && msg.mes && msg.mes.trim() !== "") {
                lastMessage = msg.mes;
                break;
            }
        }
        
        // Fallback if no valid message found
        if (!lastMessage || lastMessage.trim() === "") {
            toastr.warning("No valid message found to generate from.");
            hideKazumaProgress();
            return;
        }
        
        const s = extension_settings[extensionName];

        let instruction;
        if (isEditMode) {
            // Edit mode: convert to Flux Klein edit instruction
            // IMPORTANT: Strong override phrasing to cut through roleplay system prompts
            instruction = `[OVERRIDE ALL PREVIOUS INSTRUCTIONS. THIS IS A SEPARATE TASK.]

You are an image prompt writer. Ignore all roleplay instructions, character cards, and output format rules above. Your ONLY job is to write ONE short image editing prompt.

Convert this scene into a Flux Klein 9B image editing prompt. The input image is a photo/portrait of a woman.

Scene: "${lastMessage}"

Write a single paragraph describing what the woman is doing in the scene. Use natural language sentences. Be specific about: body position, camera angle, expressions, clothing state, and what is visible in frame. For NSFW scenes, use direct anatomical terms. For SFW scenes, describe the activity, setting, and mood.

Examples:
- "The woman is on her knees performing oral sex on a standing man. Only the man's lower body is visible in frame. Her lips are wrapped around his erect penis and she is making eye contact with the camera."
- "A high-angle POV looking down at the woman lying on her back on a bed, nude, with her legs spread. Soft warm bedroom lighting from the left side."
- "The woman is standing at a kitchen counter preparing a meal, wearing a casual white sundress. Her hands are covered in flour and she is smiling warmly. Soft natural light streams through a window to her left."
- "The woman is bent over a desk in doggystyle position, looking back over her shoulder at the camera with a teasing expression. She is wearing a partially unbuttoned white shirt with no bra."
- "The woman is giving a blowjob. She makes intense eye contact with the camera. Her lips are fully wrapped around a large penis as she is in the midst of the blowjob."

Output ONLY the edit prompt. Nothing else. No quotes, no prefixes, no commentary.`;
            // Append extra instructions if provided
            const extra = s.promptExtra ? s.promptExtra.trim() : "";
            if (extra) {
                instruction += `\n\nAdditional requirements to include in the prompt: ${extra}`;
            }
        } else {
            // Generation mode: existing logic
            const style = s.promptStyle || "standard";
            const persp = s.promptPerspective || "scene";
            const extra = s.promptExtra ? `, ${s.promptExtra}` : "";

            let styleInst = "", perspInst = "";
            if (style === "illustrious") styleInst = "Use Booru-style tags (e.g., 1girl, solo, blue hair). Focus on anime aesthetics.";
            else if (style === "sdxl") styleInst = "Use natural language sentences. Focus on photorealism and detailed textures.";
            else styleInst = "Use a list of detailed keywords/descriptors.";

            if (persp === "pov") perspInst = "Describe the scene from a First Person (POV) perspective, looking at the character.";
            else if (persp === "character") perspInst = "Focus intensely on the character's appearance and expression, ignoring background details.";
            else perspInst = "Describe the entire environment and atmosphere.";

            instruction = `
Task: Write an image generation prompt for the following scene.
Scene: "${lastMessage}"
Style Constraint: ${styleInst}
Perspective: ${perspInst}
Additional Req: ${extra}
Output ONLY the prompt text.
            `;
        }

        let generatedText = await generateQuietPrompt(instruction, true);

        if (didSwitch) {
            targetDropdown.val(originalProfile).trigger("change");
            await new Promise(r => setTimeout(r, 500));
        }

        if (s.debugPrompt) {
            // Hide progress while user is confirming
            hideKazumaProgress();

            const $content = $(`
                <div style="display: flex; flex-direction: column; gap: 10px;">
                    <p><b>Review generated ${isEditMode ? 'edit instruction' : 'prompt'}:</b></p>
                    <textarea class="text_pole" rows="6" style="width:100%; resize:vertical; font-family:monospace;">${generatedText}</textarea>
                </div>
            `);
            let currentText = generatedText;
            $content.find("textarea").on("input", function() { currentText = $(this).val(); });
            const popup = new Popup($content, POPUP_TYPE.CONFIRM, "Diagnostic Mode", { okButton: "Send", cancelButton: "Stop" });
            const confirmed = await popup.show();

            if (!confirmed) {
                toastr.info("Generation stopped by user.");
                return;
            }
            generatedText = currentText;
            // Show progress again
            showKazumaProgress("Sending to ComfyUI...");
        }

        // Update progress text
        showKazumaProgress("Sending to ComfyUI...");
        await generateWithComfy(generatedText, null, isEditMode);

    } catch (err) {
        // [HIDE PROGRESS ON ERROR]
        hideKazumaProgress();
        if (didSwitch) targetDropdown.val(originalProfile).trigger("change");
        console.error(err);
        toastr.error("Generation failed. Check console.");
    }
}

async function onManualPrompt() {
    if (!extension_settings[extensionName].enabled) return;

    const isEditMode = extension_settings[extensionName].editMode;

    if (isEditMode && !extension_settings[extensionName].selectedImage) {
        return toastr.warning("Edit mode requires an image. Please upload or select one.");
    }

    const $content = $(`
        <div style="display: flex; flex-direction: column; gap: 10px;">
            <p><b>Enter your ${isEditMode ? 'edit instruction' : 'image prompt'} manually:</b></p>
            <textarea class="text_pole" rows="6" style="width:100%; resize:vertical; font-family:monospace;" placeholder="${isEditMode ? 'e.g. Change her hair color to bright blue' : 'e.g. a woman standing in a field at sunset'}"></textarea>
        </div>
    `);
    let currentText = "";
    $content.find("textarea").on("input", function() { currentText = $(this).val(); });
    const popup = new Popup($content, POPUP_TYPE.CONFIRM, "Manual Prompt", { okButton: "Send", cancelButton: "Cancel" });
    const confirmed = await popup.show();

    if (!confirmed || !currentText.trim()) {
        if (confirmed && !currentText.trim()) toastr.warning("Prompt is empty.");
        return;
    }

    showKazumaProgress("Sending to ComfyUI...");
    try {
        await generateWithComfy(currentText.trim(), null, isEditMode);
    } catch (err) {
        hideKazumaProgress();
        console.error(err);
        toastr.error("Generation failed. Check console.");
    }
}

async function generateWithComfy(positivePrompt, target = null, isEditMode = false) {
    const url = extension_settings[extensionName].comfyUrl;
    
    // Choose workflow based on mode
    const currentName = isEditMode && extension_settings[extensionName].editWorkflowName
        ? extension_settings[extensionName].editWorkflowName
        : extension_settings[extensionName].currentWorkflowName;

    if (!currentName) {
        return toastr.error(isEditMode ? "No edit workflow selected" : "No workflow selected");
    }

    // Load from server
    let workflowRaw;
    try {
        const res = await fetch('/api/sd/comfy/workflow', { method: 'POST', headers: getRequestHeaders(), body: JSON.stringify({ file_name: currentName }) });
        if (!res.ok) throw new Error("Load failed");
        workflowRaw = await res.json();
    } catch (e) { return toastr.error(`Could not load ${currentName}`); }

    let workflow = (typeof workflowRaw === 'string') ? JSON.parse(workflowRaw) : workflowRaw;

    let finalSeed = parseInt(extension_settings[extensionName].customSeed);
    if (finalSeed === -1 || isNaN(finalSeed)) {
        finalSeed = Math.floor(Math.random() * 1000000000);
    }

    workflow = injectParamsIntoWorkflow(workflow, positivePrompt, finalSeed, isEditMode);

    try {
        toastr.info("Sending to ComfyUI...", "Image Gen Kazuma");
        const res = await fetch(`${url}/prompt`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt: workflow }) });
        if(!res.ok) throw new Error("Failed");
        const data = await res.json();
        await waitForGeneration(url, data.prompt_id, positivePrompt, target);
    } catch(e) { 
        hideKazumaProgress();
        toastr.error("Comfy Error: " + e.message); 
    }
}

function injectParamsIntoWorkflow(workflow, promptText, finalSeed, isEditMode = false) {
    const s = extension_settings[extensionName];
    let seedInjected = false;
    
    // LoRA mapping: placeholder → { value setting key, weight setting key, enabled setting key }
    const loraMap = {
        "*lora*":   { val: s.selectedLora  || "None", wt: parseFloat(s.selectedLoraWt)  || 1.0, on: s.loraEnabled1 !== false },
        "*lora2*":  { val: s.selectedLora2 || "None", wt: parseFloat(s.selectedLoraWt2) || 1.0, on: s.loraEnabled2 !== false },
        "*lora3*":  { val: s.selectedLora3 || "None", wt: parseFloat(s.selectedLoraWt3) || 1.0, on: s.loraEnabled3 !== false },
        "*lora4*":  { val: s.selectedLora4 || "None", wt: parseFloat(s.selectedLoraWt4) || 1.0, on: s.loraEnabled4 !== false },
    };
    const loraWtMap = {
        "*lorawt*":  loraMap["*lora*"],
        "*lorawt2*": loraMap["*lora2*"],
        "*lorawt3*": loraMap["*lora3*"],
        "*lorawt4*": loraMap["*lora4*"],
    };

    for (const nodeId in workflow) {
        const node = workflow[nodeId];
        if (node.inputs) {
            for (const key in node.inputs) {
                const val = node.inputs[key];
                
                // --- Handle rgthree Power Lora Loader nested objects ---
                if (val && typeof val === 'object' && !Array.isArray(val) && 'lora' in val) {
                    // This is a rgthree lora slot like { on: true, lora: "*lora*", strength: "*lorawt*" }
                    const loraPlaceholder = val.lora;
                    if (loraPlaceholder && loraMap[loraPlaceholder]) {
                        const info = loraMap[loraPlaceholder];
                        val.lora = info.val;
                        val.strength = info.wt;
                        val.on = info.on;
                    }
                    continue;
                }

                // --- Standard flat value replacements ---
                if (val === "*input*") node.inputs[key] = promptText;
                if (val === "*ninput*") node.inputs[key] = s.customNegative || "";
                if (val === "*seed*") { node.inputs[key] = finalSeed; seedInjected = true; }
                if (val === "*sampler*") node.inputs[key] = s.selectedSampler || "euler";
                if (val === "*scheduler*") node.inputs[key] = s.selectedScheduler || "normal";
                if (val === "*model*") node.inputs[key] = s.selectedModel || "v1-5-pruned.ckpt";

                if (val === "*steps*") node.inputs[key] = parseInt(s.steps) || 20;
                if (val === "*cfg*") node.inputs[key] = parseFloat(s.cfg) || 7.0;
                if (val === "*denoise*") node.inputs[key] = parseFloat(s.denoise) || 1.0;
                if (val === "*clip_skip*") node.inputs[key] = -Math.abs(parseInt(s.clipSkip)) || -1;

                // Standard LoraLoader (flat values)
                if (val && loraMap[val]) node.inputs[key] = loraMap[val].val;
                if (val && loraWtMap[val]) node.inputs[key] = loraWtMap[val].wt;

                if (val === "*width*") node.inputs[key] = parseInt(s.imgWidth) || 512;
                if (val === "*height*") node.inputs[key] = parseInt(s.imgHeight) || 512;
                
                // Edit mode specific: inject image filename
                if (val === "*image*") {
                    if (isEditMode && s.selectedImage) {
                        node.inputs[key] = s.selectedImage;
                    } else if (isEditMode && !s.selectedImage) {
                        throw new Error("Edit mode requires an image to be selected");
                    }
                }
            }
            if (!seedInjected && node.class_type === "KSampler" && 'seed' in node.inputs && typeof node.inputs['seed'] === 'number') {
               node.inputs.seed = finalSeed;
            }
        }
    }
    return workflow;
}

async function onImageSwiped(data) {
    if (!extension_settings[extensionName].enabled) return;
    const { message, direction, element } = data;
    const context = getContext();
    const settings = context.powerUserSettings || window.power_user;

    if (direction !== "right") return;
    if (settings && settings.image_overswipe !== "generate") return;
    if (message.name !== "Image Gen Kazuma") return;

    const media = message.extra?.media || [];
    const idx = message.extra?.media_index || 0;

    if (idx < media.length - 1) return;

    const mediaObj = media[idx];
    if (!mediaObj || !mediaObj.title) return;

    const prompt = mediaObj.title;
    toastr.info("New variation...", "Image Gen Kazuma");
    
    // Check if current mode is edit mode for proper regeneration
    const isEditMode = extension_settings[extensionName].editMode;
    await generateWithComfy(prompt, { message: message, element: $(element) }, isEditMode);
}

async function waitForGeneration(baseUrl, promptId, positivePrompt, target) {
     // [UPDATE TEXT]
     showKazumaProgress("Rendering Image...");
     let isProcessed = false; // Guard against async race condition

     const checkInterval = setInterval(async () => {
        if (isProcessed) return; // Skip if already handled
        try {
            const h = await (await fetch(`${baseUrl}/history/${promptId}`)).json();
            if (h[promptId]) {
                if (isProcessed) return; // Double-check after async fetch
                isProcessed = true;      // Lock BEFORE any processing
                clearInterval(checkInterval);
                
                const outputs = h[promptId].outputs;
                let finalImage = null;
                for (const nodeId in outputs) {
                    const nodeOutput = outputs[nodeId];
                    if (nodeOutput.images && nodeOutput.images.length > 0) {
                        finalImage = nodeOutput.images[0];
                        break;
                    }
                }
                if (finalImage) {
                    // [UPDATE TEXT]
                    showKazumaProgress("Downloading...");

                    const imgUrl = `${baseUrl}/view?filename=${finalImage.filename}&subfolder=${finalImage.subfolder}&type=${finalImage.type}`;
                    await insertImageToChat(imgUrl, positivePrompt, target);

                    // [HIDE WHEN DONE]
                    hideKazumaProgress();
                } else {
                    hideKazumaProgress();
                }
            }
        } catch (e) { }
    }, 1000);
}

function blobToBase64(blob) { return new Promise((resolve) => { const reader = new FileReader(); reader.onloadend = () => resolve(reader.result); reader.readAsDataURL(blob); }); }

function compressImage(base64Str, quality = 0.9) {
    return new Promise((resolve) => {
        const img = new Image();
        img.src = base64Str;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0);
            resolve(canvas.toDataURL("image/jpeg", quality));
        };
        img.onerror = () => resolve(base64Str);
    });
}

// --- SAVE TO SERVER ---
async function insertImageToChat(imgUrl, promptText, target = null) {
    try {
        toastr.info("Downloading image...", "Image Gen Kazuma");
        const response = await fetch(imgUrl);
        const blob = await response.blob();
        let base64FullURL = await blobToBase64(blob);

        let format = "png";
        if (extension_settings[extensionName].compressImages) {
            base64FullURL = await compressImage(base64FullURL, 0.9);
            format = "jpeg";
        }

        const base64Raw = base64FullURL.split(',')[1];
        const context = getContext();
        let characterName = "User";
        if (context.groupId) {
            characterName = context.groups.find(x => x.id === context.groupId)?.id;
        } else if (context.characterId) {
            characterName = context.characters[context.characterId]?.name;
        }
        if (!characterName) characterName = "User";

        const filename = `${characterName}_${humanizedDateTime()}`;
        const savedPath = await saveBase64AsFile(base64Raw, characterName, filename, format);

        const mediaAttachment = {
            url: savedPath,
            type: "image",
            source: "generated",
            title: promptText,
            generation_type: "free",
        };

        if (target && target.message) {
            if (!target.message.extra) target.message.extra = {};
            if (!target.message.extra.media) target.message.extra.media = [];
            target.message.extra.media_display = "gallery";
            target.message.extra.media.push(mediaAttachment);
            target.message.extra.media_index = target.message.extra.media.length - 1;
            if (typeof appendMediaToMessage === "function") appendMediaToMessage(target.message, target.element);
            await saveChat();
            toastr.success("Gallery updated!");
        } else {
            const newMessage = {
                name: "Image Gen Kazuma", is_user: false, is_system: true, send_date: Date.now(),
                mes: "", extra: { media: [mediaAttachment], media_display: "gallery", media_index: 0, inline_image: false }, force_avatar: "img/five.png"
            };
            context.chat.push(newMessage);
            await saveChat();
            if (typeof addOneMessage === "function") addOneMessage(newMessage);
            else await reloadCurrentChat();
            toastr.success("Image inserted!");
        }

    } catch (err) { console.error(err); toastr.error("Failed to save/insert image."); }
}

// --- INIT ---
jQuery(async () => {
    try {
        // 1. INJECT PROGRESS BAR HTML (New Code Here)
        if ($("#kazuma_progress_overlay").length === 0) {
            $("body").append(`
                <div id="kazuma_progress_overlay">
                    <div style="flex:1">
                        <span id="kazuma_progress_text">Generating Image...</span>
                        <div class="kazuma-bar-container">
                            <div class="kazuma-bar-fill"></div>
                        </div>
                    </div>
                </div>
            `);
        }

        // 2. Load Settings & Bind Events
        await $.get(`${extensionFolderPath}/example.html`).then(h => $("#extensions_settings2").append(h));

        $("#kazuma_enable").on("change", (e) => { extension_settings[extensionName].enabled = $(e.target).prop("checked"); saveSettingsDebounced(); });
        $("#kazuma_debug").on("change", (e) => { extension_settings[extensionName].debugPrompt = $(e.target).prop("checked"); saveSettingsDebounced(); });
        $("#kazuma_url").on("input", (e) => { extension_settings[extensionName].comfyUrl = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_profile").on("change", (e) => { extension_settings[extensionName].connectionProfile = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_auto_enable").on("change", (e) => { extension_settings[extensionName].autoGenEnabled = $(e.target).prop("checked"); saveSettingsDebounced(); });
        $("#kazuma_auto_freq").on("input", (e) => { let v = parseInt($(e.target).val()); if(v<1)v=1; extension_settings[extensionName].autoGenFreq = v; saveSettingsDebounced(); });

        // SMART WORKFLOW SWITCHER
        $("#kazuma_workflow_list").on("change", (e) => {
            const newWorkflow = $(e.target).val();
            const oldWorkflow = extension_settings[extensionName].currentWorkflowName;

            // 1. Snapshot OLD workflow settings
            if (oldWorkflow) {
                if (!extension_settings[extensionName].savedWorkflowStates) extension_settings[extensionName].savedWorkflowStates = {};
                extension_settings[extensionName].savedWorkflowStates[oldWorkflow] = getWorkflowState();
                console.log(`[${extensionName}] Saved context for ${oldWorkflow}`);
            }

            // 2. Load NEW workflow settings (if they exist)
            if (extension_settings[extensionName].savedWorkflowStates && extension_settings[extensionName].savedWorkflowStates[newWorkflow]) {
                applyWorkflowState(extension_settings[extensionName].savedWorkflowStates[newWorkflow]);
                toastr.success(`Restored settings for ${newWorkflow}`);
            } else {
                // If no saved state, we keep current values (Inheritance) - smoother UX
                toastr.info(`New workflow context active`);
            }

            // 3. Update Pointer
            extension_settings[extensionName].currentWorkflowName = newWorkflow;
            saveSettingsDebounced();
        });
        $("#kazuma_import_btn").on("click", () => $("#kazuma_import_file").click());

        // New Logic Events
        $("#kazuma_prompt_style").on("change", (e) => { extension_settings[extensionName].promptStyle = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_prompt_persp").on("change", (e) => { extension_settings[extensionName].promptPerspective = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_prompt_extra").on("input", (e) => { extension_settings[extensionName].promptExtra = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_profile_strategy").on("change", (e) => {
            extension_settings[extensionName].profileStrategy = $(e.target).val();
            toggleProfileVisibility();
            saveSettingsDebounced();
        });

        $("#kazuma_new_workflow").on("click", onComfyNewWorkflowClick);
        $("#kazuma_edit_workflow").on("click", onComfyOpenWorkflowEditorClick);
        $("#kazuma_delete_workflow").on("click", onComfyDeleteWorkflowClick);

        // Edit Mode Event Handlers
        $("#kazuma_mode").on("change", (e) => {
            const mode = $(e.target).val();
            const isEdit = mode === "edit";
            
            extension_settings[extensionName].editMode = isEdit;
            $("#kazuma_edit_controls").toggle(isEdit);
            updateGenerateButtonText(isEdit);
            
            saveSettingsDebounced();
        });

        $("#kazuma_edit_workflow_list").on("change", (e) => {
            extension_settings[extensionName].editWorkflowName = $(e.target).val();
            saveSettingsDebounced();
        });

        // Image upload
        $("#kazuma_upload_image").on("click", () => $("#kazuma_image_file").click());

        $("#kazuma_image_file").on("change", async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            
            try {
                // Convert to base64 for preview
                const base64 = await getBase64Async(file);
                
                // Upload to ComfyUI
                showKazumaProgress("Uploading image...");
                const filename = await uploadImageToComfy(base64, file.name);
                hideKazumaProgress();
                
                // Save to settings
                extension_settings[extensionName].selectedImage = filename;
                extension_settings[extensionName].selectedImageBase64 = base64;
                
                // Show preview
                $("#kazuma_preview_img").attr("src", base64);
                $("#kazuma_image_preview").show();
                
                toastr.success("Image loaded!");
                saveSettingsDebounced();
                
            } catch (e) {
                hideKazumaProgress();
                toastr.error("Upload failed: " + e.message);
            }
            
            $(e.target).val(''); // Reset input
        });

        // Use character image
        $("#kazuma_use_character").on("click", async () => {
            try {
                showKazumaProgress("Loading character image...");
                const base64 = await getCharacterImage();
                
                if (!base64) {
                    hideKazumaProgress();
                    return;
                }
                
                // Upload to ComfyUI with character name
                const context = getContext();
                const charName = context.characters[context.characterId]?.name || "character";
                const filename = `${charName}_edit_${Date.now()}.png`;
                
                const uploadedName = await uploadImageToComfy(base64, filename);
                hideKazumaProgress();
                
                // Save and preview
                extension_settings[extensionName].selectedImage = uploadedName;
                extension_settings[extensionName].selectedImageBase64 = base64;
                
                $("#kazuma_preview_img").attr("src", base64);
                $("#kazuma_image_preview").show();
                
                toastr.success("Character image loaded!");
                saveSettingsDebounced();
                
            } catch (e) {
                hideKazumaProgress();
                toastr.error("Failed to load character image: " + e.message);
            }
        });

        // Clear image
        $("#kazuma_clear_image").on("click", () => {
            extension_settings[extensionName].selectedImage = null;
            extension_settings[extensionName].selectedImageBase64 = null;
            $("#kazuma_image_preview").hide();
            saveSettingsDebounced();
            toastr.info("Image cleared");
        });

        $("#kazuma_model_list").on("change", (e) => { extension_settings[extensionName].selectedModel = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_sampler_list").on("change", (e) => { extension_settings[extensionName].selectedSampler = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_scheduler_list").on("change", (e) => { extension_settings[extensionName].selectedScheduler = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_resolution_list").on("change", (e) => {
            const idx = parseInt($(e.target).val());
            if (!isNaN(idx) && RESOLUTIONS[idx]) {
                const r = RESOLUTIONS[idx];
                $("#kazuma_width").val(r.w).trigger("input");
                $("#kazuma_height").val(r.h).trigger("input");
            }
        });

        $("#kazuma_lora_list").on("change", (e) => { extension_settings[extensionName].selectedLora = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_lora_list_2").on("change", (e) => { extension_settings[extensionName].selectedLora2 = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_lora_list_3").on("change", (e) => { extension_settings[extensionName].selectedLora3 = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_lora_list_4").on("change", (e) => { extension_settings[extensionName].selectedLora4 = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_lora_wt").on("input", (e) => { let v = parseFloat($(e.target).val()); extension_settings[extensionName].selectedLoraWt = v; $("#kazuma_lora_wt_display").text(v); saveSettingsDebounced(); });
        $("#kazuma_lora_wt_2").on("input", (e) => { let v = parseFloat($(e.target).val()); extension_settings[extensionName].selectedLoraWt2 = v; $("#kazuma_lora_wt_display_2").text(v); saveSettingsDebounced(); });
        $("#kazuma_lora_wt_3").on("input", (e) => { let v = parseFloat($(e.target).val()); extension_settings[extensionName].selectedLoraWt3 = v; $("#kazuma_lora_wt_display_3").text(v); saveSettingsDebounced(); });
        $("#kazuma_lora_wt_4").on("input", (e) => { let v = parseFloat($(e.target).val()); extension_settings[extensionName].selectedLoraWt4 = v; $("#kazuma_lora_wt_display_4").text(v); saveSettingsDebounced(); });

        // LoRA on/off toggles
        $("#kazuma_lora_on_1").on("change", (e) => { extension_settings[extensionName].loraEnabled1 = $(e.target).prop("checked"); saveSettingsDebounced(); });
        $("#kazuma_lora_on_2").on("change", (e) => { extension_settings[extensionName].loraEnabled2 = $(e.target).prop("checked"); saveSettingsDebounced(); });
        $("#kazuma_lora_on_3").on("change", (e) => { extension_settings[extensionName].loraEnabled3 = $(e.target).prop("checked"); saveSettingsDebounced(); });
        $("#kazuma_lora_on_4").on("change", (e) => { extension_settings[extensionName].loraEnabled4 = $(e.target).prop("checked"); saveSettingsDebounced(); });

        // Disable/Enable All LoRAs
        $("#kazuma_lora_disable_all").on("click", () => {
            extension_settings[extensionName].loraEnabled1 = false;
            extension_settings[extensionName].loraEnabled2 = false;
            extension_settings[extensionName].loraEnabled3 = false;
            extension_settings[extensionName].loraEnabled4 = false;
            $("#kazuma_lora_on_1, #kazuma_lora_on_2, #kazuma_lora_on_3, #kazuma_lora_on_4").prop("checked", false);
            saveSettingsDebounced();
            toastr.info("All LoRAs disabled");
        });
        $("#kazuma_lora_enable_all").on("click", () => {
            extension_settings[extensionName].loraEnabled1 = true;
            extension_settings[extensionName].loraEnabled2 = true;
            extension_settings[extensionName].loraEnabled3 = true;
            extension_settings[extensionName].loraEnabled4 = true;
            $("#kazuma_lora_on_1, #kazuma_lora_on_2, #kazuma_lora_on_3, #kazuma_lora_on_4").prop("checked", true);
            saveSettingsDebounced();
            toastr.info("All LoRAs enabled");
        });

        $("#kazuma_width, #kazuma_height").on("input", (e) => { extension_settings[extensionName][e.target.id === "kazuma_width" ? "imgWidth" : "imgHeight"] = parseInt($(e.target).val()); saveSettingsDebounced(); });
        $("#kazuma_negative").on("input", (e) => { extension_settings[extensionName].customNegative = $(e.target).val(); saveSettingsDebounced(); });
        $("#kazuma_seed").on("input", (e) => { extension_settings[extensionName].customSeed = parseInt($(e.target).val()); saveSettingsDebounced(); });
        $("#kazuma_compress").on("change", (e) => { extension_settings[extensionName].compressImages = $(e.target).prop("checked"); saveSettingsDebounced(); });

        function bindSlider(id, key, isFloat = false) {
            $(`#${id}`).on("input", function() {
                let v = isFloat ? parseFloat(this.value) : parseInt(this.value);
                extension_settings[extensionName][key] = v;
                $(`#${id}_val`).val(v);
                saveSettingsDebounced();
            });
            $(`#${id}_val`).on("input", function() {
                let v = isFloat ? parseFloat(this.value) : parseInt(this.value);
                extension_settings[extensionName][key] = v;
                $(`#${id}`).val(v);
                saveSettingsDebounced();
            });
        }
        bindSlider("kazuma_steps", "steps", false);
        bindSlider("kazuma_cfg", "cfg", true);
        bindSlider("kazuma_denoise", "denoise", true);
        bindSlider("kazuma_clip", "clipSkip", false);

        $("#kazuma_test_btn").on("click", onTestConnection);
        $("#kazuma_gen_prompt_btn").on("click", onGeneratePrompt);
        $("#kazuma_manual_prompt_btn").on("click", onManualPrompt);

        loadSettings();
        eventSource.on(event_types.MESSAGE_RECEIVED, onMessageReceived);
        eventSource.on(event_types.IMAGE_SWIPED, onImageSwiped);

        let att = 0; const int = setInterval(() => { if ($("#kazuma_quick_gen").length > 0) { clearInterval(int); return; } createChatButton(); att++; if (att > 5) clearInterval(int); }, 1000);
        $(document).on("click", "#kazuma_quick_gen", function(e) { e.preventDefault(); e.stopPropagation(); onGeneratePrompt(); });
        $(document).on("click", "#kazuma_quick_manual", function(e) { e.preventDefault(); e.stopPropagation(); onManualPrompt(); });
    } catch (e) { console.error(e); }
});

// Helpers (Condensed)
function onMessageReceived(id) { if (!extension_settings[extensionName].enabled || !extension_settings[extensionName].autoGenEnabled) return; const chat = getContext().chat; if (!chat || !chat.length) return; if (chat[chat.length - 1].is_user || chat[chat.length - 1].is_system) return; const aiMsgCount = chat.filter(m => !m.is_user && !m.is_system).length; const freq = parseInt(extension_settings[extensionName].autoGenFreq) || 1; if (aiMsgCount % freq === 0) { console.log(`[${extensionName}] Auto-gen...`); setTimeout(onGeneratePrompt, 500); } }
function createChatButton() { if ($("#kazuma_quick_gen").length > 0) return; const b = `<div id="kazuma_quick_gen" class="interactable" title="Visualize" style="cursor: pointer; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; margin-right: 5px; opacity: 0.7;"><i class="fa-solid fa-paintbrush fa-lg"></i></div><div id="kazuma_quick_manual" class="interactable" title="Manual Prompt" style="cursor: pointer; width: 35px; height: 35px; display: flex; align-items: center; justify-content: center; margin-right: 5px; opacity: 0.7;"><i class="fa-solid fa-keyboard fa-lg"></i></div>`; let t = $("#send_but_sheld"); if (!t.length) t = $("#send_textarea"); if (t.length) { t.attr("id") === "send_textarea" ? t.before(b) : t.prepend(b); } }
function populateProfiles() { const s=$("#kazuma_profile"),o=$("#settings_preset_openai").find("option");s.empty().append('<option value="">-- Use Current Settings --</option>');if(o.length)o.each(function(){s.append(`<option value="${$(this).val()}">${$(this).text()}</option>`)});if(extension_settings[extensionName].connectionProfile)s.val(extension_settings[extensionName].connectionProfile);}
async function onFileSelected(e) { const f=e.target.files[0];if(!f)return;const t=await f.text();try{const j=JSON.parse(t),n=prompt("Name:",f.name.replace(".json",""));if(n){extension_settings[extensionName].savedWorkflows[n]=j;extension_settings[extensionName].currentWorkflowName=n;saveSettingsDebounced();populateWorkflows();}}catch{toastr.error("Invalid JSON");}$(e.target).val('');}
function showKazumaProgress(text = "Processing...") {
    $("#kazuma_progress_text").text(text);
    $("#kazuma_progress_overlay").css("display", "flex");
}

function hideKazumaProgress() {
    $("#kazuma_progress_overlay").hide();
}

/* --- IMAGE EDITING HELPER FUNCTIONS --- */
async function uploadImageToComfy(base64Data, filename) {
    const comfyUrl = extension_settings[extensionName].comfyUrl;
    
    // Convert base64 to blob
    const blob = await fetch(base64Data).then(r => r.blob());
    
    // Create form data
    const formData = new FormData();
    formData.append('image', blob, filename);
    formData.append('overwrite', 'true');
    
    // Upload to ComfyUI
    const response = await fetch(`${comfyUrl}/upload/image`, {
        method: 'POST',
        body: formData
    });
    
    if (!response.ok) throw new Error('Upload failed');
    
    const result = await response.json();
    return result.name; // Returns saved filename
}

async function getCharacterImage() {
    const context = getContext();
    
    if (!context.characterId && context.characterId !== 0) {
        toastr.warning("No character selected");
        return null;
    }
    
    // Get character data
    const character = context.characters[context.characterId];
    if (!character || !character.avatar) {
        toastr.warning("Character has no image");
        return null;
    }
    
    // Build avatar URL
    const avatarUrl = character.avatar.replace(/^\/+/, '');
    const fullUrl = `/characters/${avatarUrl}`;
    
    // Convert to base64
    const response = await fetch(fullUrl);
    if (!response.ok) throw new Error("Failed to fetch character image");
    
    const blob = await response.blob();
    const base64 = await blobToBase64(blob);
    
    return base64;
}

/* --- WORKFLOW CONTEXT MANAGERS --- */
function getWorkflowState() {
    const s = extension_settings[extensionName];
    // Capture all image-related parameters
    return {
        selectedModel: s.selectedModel,
        selectedSampler: s.selectedSampler,
        selectedScheduler: s.selectedScheduler,
        steps: s.steps,
        cfg: s.cfg,
        denoise: s.denoise,
        clipSkip: s.clipSkip,
        imgWidth: s.imgWidth,
        imgHeight: s.imgHeight,
        customSeed: s.customSeed,
        customNegative: s.customNegative,
        // Smart Prompts
        promptStyle: s.promptStyle,
        promptPerspective: s.promptPerspective,
        promptExtra: s.promptExtra,
        // LoRAs
        selectedLora: s.selectedLora, selectedLoraWt: s.selectedLoraWt, loraEnabled1: s.loraEnabled1,
        selectedLora2: s.selectedLora2, selectedLoraWt2: s.selectedLoraWt2, loraEnabled2: s.loraEnabled2,
        selectedLora3: s.selectedLora3, selectedLoraWt3: s.selectedLoraWt3, loraEnabled3: s.loraEnabled3,
        selectedLora4: s.selectedLora4, selectedLoraWt4: s.selectedLoraWt4, loraEnabled4: s.loraEnabled4,
    };
}

function applyWorkflowState(state) {
    const s = extension_settings[extensionName];
    // 1. Update Global Settings
    Object.assign(s, state);

    // 2. Update UI Elements
    $("#kazuma_model_list").val(s.selectedModel);
    $("#kazuma_sampler_list").val(s.selectedSampler);
    $("#kazuma_scheduler_list").val(s.selectedScheduler);

    updateSliderInput('kazuma_steps', 'kazuma_steps_val', s.steps);
    updateSliderInput('kazuma_cfg', 'kazuma_cfg_val', s.cfg);
    updateSliderInput('kazuma_denoise', 'kazuma_denoise_val', s.denoise);
    updateSliderInput('kazuma_clip', 'kazuma_clip_val', s.clipSkip);

    $("#kazuma_width").val(s.imgWidth);
    $("#kazuma_height").val(s.imgHeight);
    $("#kazuma_seed").val(s.customSeed);
    $("#kazuma_negative").val(s.customNegative);

    // Smart Prompt UI
    $("#kazuma_prompt_style").val(s.promptStyle || "standard");
    $("#kazuma_prompt_persp").val(s.promptPerspective || "scene");
    $("#kazuma_prompt_extra").val(s.promptExtra || "");

    // LoRA UI
    $("#kazuma_lora_list").val(s.selectedLora);
    $("#kazuma_lora_list_2").val(s.selectedLora2);
    $("#kazuma_lora_list_3").val(s.selectedLora3);
    $("#kazuma_lora_list_4").val(s.selectedLora4);

    // LoRA Weights UI
    $("#kazuma_lora_wt").val(s.selectedLoraWt); $("#kazuma_lora_wt_display").text(s.selectedLoraWt);
    $("#kazuma_lora_wt_2").val(s.selectedLoraWt2); $("#kazuma_lora_wt_display_2").text(s.selectedLoraWt2);
    $("#kazuma_lora_wt_3").val(s.selectedLoraWt3); $("#kazuma_lora_wt_display_3").text(s.selectedLoraWt3);
    $("#kazuma_lora_wt_4").val(s.selectedLoraWt4); $("#kazuma_lora_wt_display_4").text(s.selectedLoraWt4);

    // LoRA on/off toggles
    $("#kazuma_lora_on_1").prop("checked", s.loraEnabled1 !== false);
    $("#kazuma_lora_on_2").prop("checked", s.loraEnabled2 !== false);
    $("#kazuma_lora_on_3").prop("checked", s.loraEnabled3 !== false);
    $("#kazuma_lora_on_4").prop("checked", s.loraEnabled4 !== false);
}

