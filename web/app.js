(() => {
  const INPUT_STATE_KEY = "autofigure_input_state_v4";

  const page = document.body.dataset.page;
  if (page === "input") {
    initInputPage();
  } else if (page === "canvas") {
    initCanvasPage();
  }

  function $(id) {
    return document.getElementById(id);
  }

  async function initInputPage() {
    const confirmBtn = $("confirmBtn");
    const errorMsg = $("errorMsg");
    const uploadZone = $("uploadZone");
    const referenceFile = $("referenceFile");
    const referencePreview = $("referencePreview");
    const referenceStatus = $("referenceStatus");
    const clearUploadBtn = $("clearUploadBtn");
    const uploadText = $("uploadText");
    const uploadLabel = $("uploadLabel");
    const methodText = $("methodText");
    const methodTextLabel = $("methodTextLabel");
    const methodTextHint = $("methodTextHint");
    const inputMode = $("inputMode");
    const inputModeHint = $("inputModeHint");
    const providerSelect = $("provider");
    const providerHint = $("providerHint");
    const apiKeyHint = $("apiKeyHint");
    const imageSizeGroup = $("imageSizeGroup");
    const imageSizeInput = $("imageSize");
    const imageModelGroup = $("imageModelGroup");
    const imageModelInput = $("imageModel");
    const imageModelHint = $("imageModelHint");
    const svgModelInput = $("svgModel");
    const baseUrlGroup = $("baseUrlGroup");
    const baseUrlInput = $("baseUrl");
    const baseUrlHint = $("baseUrlHint");
    const samBackend = $("samBackend");
    const samBackendHint = $("samBackendHint");
    const samPrompt = $("samPrompt");
    const samPromptHint = $("samPromptHint");
    const samApiKeyGroup = $("samApiKeyGroup");
    const samApiKeyInput = $("samApiKey");
    const samMaxMasksInput = $("samMaxMasks");
    const placeholderModeInput = $("placeholderMode");
    const mergeThresholdInput = $("mergeThreshold");
    const minScoreInput = $("minScore");
    const optimizeIterationsInput = $("optimizeIterations");
    const optimizeHint = $("optimizeHint");

    let providerConfigs = {
      openrouter: {
        base_url: "https://openrouter.ai/api/v1",
        default_image_model: "google/gemini-3-pro-image-preview",
        default_svg_model: "google/gemini-3.1-pro-preview",
      },
      bianxie: {
        base_url: "https://api.bianxie.ai/v1",
        default_image_model: "gemini-3-pro-image-preview",
        default_svg_model: "gemini-3.1-pro-preview",
      },
      gemini: {
        base_url: "https://generativelanguage.googleapis.com/v1beta",
        default_image_model: "gemini-3-pro-image-preview",
        default_svg_model: "gemini-3.1-pro",
      },
      openai_compatible: {
        base_url: "http://localhost:8000/v1",
        default_image_model: "gpt-image-1",
        default_svg_model: "gpt-4.1",
      },
    };
    let defaults = {
      sam_prompt: "icon,person,robot,animal",
      placeholder_mode: "label",
      merge_threshold: 0.9,
      min_score: 0.0,
      optimize_iterations: 0,
    };
    let formDefaults = {
      provider: "gemini",
      baseUrl: "",
      imageModel: "",
      svgModel: "",
      imageSize: "4K",
      samBackend: "roboflow",
      samPrompt: "icon,person,robot,animal",
      samMaxMasks: 32,
      placeholderMode: "label",
      mergeThreshold: 0.9,
      minScore: 0.0,
      optimizeIterations: 0,
      apiKeyConfiguredByProvider: {},
    };
    let geminiSupportsCustomBaseUrl = false;
    let activeUploadPath = null;
    let uploadsByMode = {
      generate_from_text: null,
      upload_figure: null,
    };

    function trimOrNull(value) {
      const text = String(value ?? "").trim();
      return text || null;
    }

    function parseOptionalInt(value) {
      const parsed = Number.parseInt(String(value ?? ""), 10);
      return Number.isFinite(parsed) ? parsed : null;
    }

    function parseOptionalFloat(value) {
      const parsed = Number.parseFloat(String(value ?? ""));
      return Number.isFinite(parsed) ? parsed : null;
    }

    function getProviderConfig(provider) {
      return providerConfigs[provider] || {};
    }

    function getActiveMode() {
      return inputMode?.value || "generate_from_text";
    }

    function getOtherMode(mode = getActiveMode()) {
      return mode === "upload_figure" ? "generate_from_text" : "upload_figure";
    }

    function buildStatusText(mode, uploadInfo) {
      if (!uploadInfo) {
        return mode === "upload_figure"
          ? "No source figure uploaded."
          : "No reference image uploaded.";
      }
      return mode === "upload_figure"
        ? `Using uploaded source figure: ${uploadInfo.name}`
        : `Using uploaded reference image: ${uploadInfo.name}`;
    }

    function renderCurrentUploadState(customStatus) {
      const mode = getActiveMode();
      const uploadInfo = uploadsByMode[mode];
      activeUploadPath = uploadInfo?.path || null;

      if (referencePreview) {
        if (uploadInfo?.url) {
          referencePreview.src = uploadInfo.url;
          referencePreview.classList.add("visible");
        } else {
          referencePreview.removeAttribute("src");
          referencePreview.classList.remove("visible");
        }
      }

      if (referenceStatus) {
        referenceStatus.textContent =
          typeof customStatus === "string" ? customStatus : buildStatusText(mode, uploadInfo);
      }

      if (clearUploadBtn) {
        clearUploadBtn.classList.toggle("is-hidden", !uploadInfo);
        clearUploadBtn.disabled = false;
      }

      if (referenceFile) {
        referenceFile.value = "";
      }
    }

    async function loadRuntimeConfig() {
      try {
        const response = await fetch("/api/config");
        if (!response.ok) {
          return;
        }
        const data = await response.json();
        if (data && typeof data === "object") {
          if (data.providers && typeof data.providers === "object") {
            providerConfigs = data.providers;
          }
          if (data.defaults && typeof data.defaults === "object") {
            defaults = { ...defaults, ...data.defaults };
          }
          if (data.formDefaults && typeof data.formDefaults === "object") {
            formDefaults = { ...formDefaults, ...data.formDefaults };
          }
          if (data.capabilities && typeof data.capabilities === "object") {
            geminiSupportsCustomBaseUrl = Boolean(
              data.capabilities.geminiSupportsCustomBaseUrl,
            );
          }
        }
      } catch (_err) {
        // Keep local fallbacks.
      }
    }

    function loadInputState() {
      try {
        const raw = window.sessionStorage.getItem(INPUT_STATE_KEY);
        if (!raw) {
          return null;
        }
        const parsed = JSON.parse(raw);
        return parsed && typeof parsed === "object" ? parsed : null;
      } catch (_err) {
        return null;
      }
    }

    function saveInputState() {
      const state = {
        inputMode: getActiveMode(),
        methodText: methodText?.value ?? "",
        provider: providerSelect?.value ?? "gemini",
        apiKey: $("apiKey")?.value ?? "",
        baseUrl: baseUrlInput?.value ?? "",
        imageModel: imageModelInput?.value ?? "",
        svgModel: svgModelInput?.value ?? "",
        placeholderMode: placeholderModeInput?.value ?? "label",
        mergeThreshold: mergeThresholdInput?.value ?? "0.9",
        minScore: minScoreInput?.value ?? "0.0",
        optimizeIterations: optimizeIterationsInput?.value ?? "0",
        imageSize: imageSizeInput?.value ?? "4K",
        samBackend: samBackend?.value ?? "roboflow",
        samPrompt: samPrompt?.value ?? defaults.sam_prompt,
        samApiKey: samApiKeyInput?.value ?? "",
        samMaxMasks: samMaxMasksInput?.value ?? "32",
        uploads: uploadsByMode,
      };
      try {
        window.sessionStorage.setItem(INPUT_STATE_KEY, JSON.stringify(state));
      } catch (_err) {
        // Ignore storage failures (e.g. private mode / quota)
      }
    }

    function applyProviderDefaults(force) {
      const provider = providerSelect?.value || "gemini";
      const cfg = getProviderConfig(provider);
      if (baseUrlInput && (force || !baseUrlInput.value.trim())) {
        baseUrlInput.value =
          formDefaults.provider === provider && formDefaults.baseUrl
            ? formDefaults.baseUrl
            : cfg.base_url || "";
      }
      if (imageModelInput && (force || !imageModelInput.value.trim())) {
        imageModelInput.value =
          formDefaults.provider === provider && formDefaults.imageModel
            ? formDefaults.imageModel
            : cfg.default_image_model || "";
      }
      if (svgModelInput && (force || !svgModelInput.value.trim())) {
        svgModelInput.value =
          formDefaults.provider === provider && formDefaults.svgModel
            ? formDefaults.svgModel
            : cfg.default_svg_model || "";
      }
    }

    function applyDefaultsIfEmpty() {
      if (providerSelect && !providerSelect.value.trim()) {
        providerSelect.value = formDefaults.provider || "gemini";
      }
      if (samBackend && !samBackend.value.trim()) {
        samBackend.value = formDefaults.samBackend || "roboflow";
      }
      if (samPrompt && !samPrompt.value.trim()) {
        samPrompt.value =
          formDefaults.samPrompt || defaults.sam_prompt || "icon,person,robot,animal";
      }
      if (placeholderModeInput && !placeholderModeInput.value.trim()) {
        placeholderModeInput.value =
          formDefaults.placeholderMode || defaults.placeholder_mode || "label";
      }
      if (mergeThresholdInput && !mergeThresholdInput.value.trim()) {
        mergeThresholdInput.value = String(
          formDefaults.mergeThreshold ?? defaults.merge_threshold ?? 0.9,
        );
      }
      if (minScoreInput && !minScoreInput.value.trim()) {
        minScoreInput.value = String(
          formDefaults.minScore ?? defaults.min_score ?? 0.0,
        );
      }
      if (optimizeIterationsInput && !optimizeIterationsInput.value.trim()) {
        optimizeIterationsInput.value = String(
          formDefaults.optimizeIterations ?? defaults.optimize_iterations ?? 0,
        );
      }
      if (samMaxMasksInput && !samMaxMasksInput.value.trim()) {
        samMaxMasksInput.value = String(formDefaults.samMaxMasks ?? 32);
      }
      if (imageSizeInput && !imageSizeInput.value.trim()) {
        imageSizeInput.value = formDefaults.imageSize || "4K";
      }
    }

    function applyFormDefaults() {
      if (providerSelect && formDefaults.provider) {
        providerSelect.value = formDefaults.provider;
      }
      if (baseUrlInput && formDefaults.baseUrl) {
        baseUrlInput.value = formDefaults.baseUrl;
      }
      if (imageModelInput && formDefaults.imageModel) {
        imageModelInput.value = formDefaults.imageModel;
      }
      if (svgModelInput && formDefaults.svgModel) {
        svgModelInput.value = formDefaults.svgModel;
      }
      if (imageSizeInput && formDefaults.imageSize) {
        imageSizeInput.value = formDefaults.imageSize;
      }
      if (samBackend && formDefaults.samBackend) {
        samBackend.value = formDefaults.samBackend;
      }
      if (samPrompt && formDefaults.samPrompt) {
        samPrompt.value = formDefaults.samPrompt;
      }
      if (samMaxMasksInput && formDefaults.samMaxMasks != null) {
        samMaxMasksInput.value = String(formDefaults.samMaxMasks);
      }
      if (placeholderModeInput && formDefaults.placeholderMode) {
        placeholderModeInput.value = formDefaults.placeholderMode;
      }
      if (mergeThresholdInput && formDefaults.mergeThreshold != null) {
        mergeThresholdInput.value = String(formDefaults.mergeThreshold);
      }
      if (minScoreInput && formDefaults.minScore != null) {
        minScoreInput.value = String(formDefaults.minScore);
      }
      if (optimizeIterationsInput && formDefaults.optimizeIterations != null) {
        optimizeIterationsInput.value = String(formDefaults.optimizeIterations);
      }
    }

    function applyInputState() {
      const state = loadInputState();
      if (!state) {
        return false;
      }

      if (typeof state.inputMode === "string" && inputMode) {
        inputMode.value = state.inputMode;
      }
      if (typeof state.methodText === "string" && methodText) {
        methodText.value = state.methodText;
      }
      if (typeof state.provider === "string" && providerSelect) {
        providerSelect.value = state.provider;
      }
      if (typeof state.apiKey === "string" && $("apiKey")) {
        $("apiKey").value = state.apiKey;
      }
      if (typeof state.baseUrl === "string" && baseUrlInput) {
        baseUrlInput.value = state.baseUrl;
      }
      if (typeof state.imageModel === "string" && imageModelInput) {
        imageModelInput.value = state.imageModel;
      }
      if (typeof state.svgModel === "string" && svgModelInput) {
        svgModelInput.value = state.svgModel;
      }
      if (typeof state.placeholderMode === "string" && placeholderModeInput) {
        placeholderModeInput.value = state.placeholderMode;
      }
      if (typeof state.mergeThreshold === "string" && mergeThresholdInput) {
        mergeThresholdInput.value = state.mergeThreshold;
      }
      if (typeof state.minScore === "string" && minScoreInput) {
        minScoreInput.value = state.minScore;
      }
      if (
        typeof state.optimizeIterations === "string" &&
        optimizeIterationsInput
      ) {
        optimizeIterationsInput.value = state.optimizeIterations;
      }
      if (typeof state.imageSize === "string" && imageSizeInput) {
        imageSizeInput.value = state.imageSize;
      }
      if (typeof state.samBackend === "string" && samBackend) {
        samBackend.value = state.samBackend;
      }
      if (typeof state.samPrompt === "string" && samPrompt) {
        samPrompt.value = state.samPrompt;
      }
      if (typeof state.samApiKey === "string" && samApiKeyInput) {
        samApiKeyInput.value = state.samApiKey;
      }
      if (typeof state.samMaxMasks === "string" && samMaxMasksInput) {
        samMaxMasksInput.value = state.samMaxMasks;
      }
      if (state.uploads && typeof state.uploads === "object") {
        uploadsByMode = {
          generate_from_text:
            state.uploads.generate_from_text &&
            typeof state.uploads.generate_from_text === "object"
              ? state.uploads.generate_from_text
              : null,
          upload_figure:
            state.uploads.upload_figure &&
            typeof state.uploads.upload_figure === "object"
              ? state.uploads.upload_figure
              : null,
        };
      }
      return true;
    }

    function syncInputModeView() {
      const mode = getActiveMode();
      const isUploadMode = mode === "upload_figure";

      if (methodTextLabel) {
        methodTextLabel.textContent = isUploadMode
          ? "Method Text (Optional)"
          : "Method Text";
      }
      if (methodTextHint) {
        methodTextHint.textContent = isUploadMode
          ? "Optional in upload mode. You can still provide notes for context."
          : "Tip: concise, structured method text yields cleaner templates.";
      }
      if (methodText) {
        methodText.placeholder = isUploadMode
          ? "Optional notes about the uploaded figure..."
          : "Paste your paper method text here...";
      }
      if (inputModeHint) {
        inputModeHint.textContent = isUploadMode
          ? "The uploaded image is used as figure.png and the workflow starts from SAM segmentation."
          : "Text mode runs full pipeline; uploaded image is only used as style reference.";
      }
      if (uploadLabel) {
        uploadLabel.textContent = isUploadMode ? "Source Figure" : "Reference Image";
      }
      if (uploadText) {
        uploadText.textContent = isUploadMode
          ? "Drop source figure here or click to upload"
          : "Drop reference image here or click to upload";
      }
      if (uploadZone) {
        uploadZone.setAttribute(
          "aria-label",
          isUploadMode ? "Upload source figure" : "Upload reference image",
        );
      }
      if (imageModelGroup) {
        imageModelGroup.hidden = isUploadMode;
      }
    }

    function syncFieldHints() {
      const isUploadMode = getActiveMode() === "upload_figure";
      if (samPromptHint) {
        samPromptHint.textContent =
          "Used only by SAM3 segmentation to find icon-like regions. It is not sent to the SVG model.";
      }
      if (imageModelHint) {
        imageModelHint.textContent = isUploadMode
          ? "Ignored in upload mode because step 1 is skipped."
          : "Used only in text mode to generate figure.png before SVG reconstruction.";
      }
      if (optimizeHint) {
        optimizeHint.textContent =
          "0 skips LLM refinement. 1-2 asks the model to re-align layout and style after template generation.";
      }
      if (samBackendHint) {
        samBackendHint.textContent =
          "Choose Roboflow API to use Roboflow. CLI alias `api` maps to fal, not Roboflow.";
      }
    }

    function syncImageSizeVisibility() {
      const provider = providerSelect?.value ?? "gemini";
      const mode = getActiveMode();
      const show =
        (provider === "gemini" || provider === "openai_compatible") &&
        mode === "generate_from_text";
      if (imageSizeGroup) {
        imageSizeGroup.hidden = !show;
      }
    }

    function syncSamApiKeyVisibility() {
      const backend = samBackend?.value;
      const shouldShow = backend === "fal" || backend === "roboflow";
      if (samApiKeyGroup) {
        samApiKeyGroup.hidden = !shouldShow;
      }
      if (!shouldShow && samApiKeyInput) {
        samApiKeyInput.value = "";
      }
    }

    function syncSamMaxMasksVisibility() {
      const backend = samBackend?.value;
      const shouldShow = backend === "fal" || backend === "api";
      if (samMaxMasksInput) {
        const group = samMaxMasksInput.closest(".field-group");
        if (group) {
          group.hidden = !shouldShow;
        }
      }
    }

    function syncProviderHint() {
      const provider = providerSelect?.value || "gemini";
      if (providerHint) {
        if (provider === "openai_compatible") {
          providerHint.textContent =
            "Use custom OpenAI-compatible endpoint with editable base URL and model IDs.";
        } else if (provider === "gemini") {
          providerHint.textContent =
            "Gemini uses official google-genai SDK. Base URL customization is disabled.";
        } else {
          providerHint.textContent = "You can edit base URL and model IDs.";
        }
      }
      if (baseUrlGroup && baseUrlInput && baseUrlHint) {
        const disableBaseUrl = provider === "gemini" && !geminiSupportsCustomBaseUrl;
        baseUrlInput.disabled = disableBaseUrl;
        baseUrlHint.textContent = disableBaseUrl
          ? "Current Gemini implementation ignores custom base URL."
          : "Custom base URL will be passed to backend pipeline.";
      }
      if (apiKeyHint) {
        const configured =
          Boolean(formDefaults.apiKeyConfiguredByProvider?.[provider]);
        apiKeyHint.textContent = configured
          ? "Optional. Server-side .env already provides an API key for this provider."
          : "Optional if this provider is configured in server-side .env.";
      }
    }

    function syncAllViews() {
      syncInputModeView();
      syncFieldHints();
      syncImageSizeVisibility();
      syncSamApiKeyVisibility();
      syncSamMaxMasksVisibility();
      syncProviderHint();
      renderCurrentUploadState();
    }

    async function deleteUploadedFile(uploadPath) {
      const normalized = String(uploadPath || "").trim();
      if (!normalized.startsWith("uploads/")) {
        return;
      }
      const filename = normalized.slice("uploads/".length);
      if (!filename) {
        return;
      }
      const response = await fetch(
        `/api/uploads/${encodeURIComponent(filename)}`,
        { method: "DELETE" },
      );
      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Failed to delete uploaded image");
      }
    }

    async function setUploadForCurrentMode(uploadInfo) {
      const mode = getActiveMode();
      const previous = uploadsByMode[mode];
      uploadsByMode[mode] = uploadInfo;
      renderCurrentUploadState();
      saveInputState();

      if (
        previous?.path &&
        previous.path !== uploadInfo?.path &&
        previous.path !== uploadsByMode[getOtherMode(mode)]?.path
      ) {
        try {
          await deleteUploadedFile(previous.path);
        } catch (_err) {
          // Keep UX smooth even if cleanup fails.
        }
      }
    }

    async function clearCurrentUpload() {
      const mode = getActiveMode();
      const current = uploadsByMode[mode];
      if (!current) {
        renderCurrentUploadState();
        return;
      }

      const otherPath = uploadsByMode[getOtherMode(mode)]?.path || null;
      const pathToDelete = current.path && current.path !== otherPath ? current.path : null;

      uploadsByMode[mode] = null;
      renderCurrentUploadState();
      saveInputState();

      if (!pathToDelete) {
        return;
      }

      if (clearUploadBtn) {
        clearUploadBtn.disabled = true;
      }
      try {
        await deleteUploadedFile(pathToDelete);
      } catch (err) {
        renderCurrentUploadState("Selection cleared, but server cleanup failed.");
      } finally {
        if (clearUploadBtn) {
          clearUploadBtn.disabled = false;
        }
      }
    }

    await loadRuntimeConfig();
    const hasState = applyInputState();
    if (!hasState) {
      applyFormDefaults();
    }
    applyProviderDefaults(!hasState);
    applyDefaultsIfEmpty();
    syncAllViews();

    if (samBackend) {
      samBackend.addEventListener("change", () => {
        syncSamApiKeyVisibility();
        syncSamMaxMasksVisibility();
        saveInputState();
      });
    }

    if (providerSelect) {
      providerSelect.addEventListener("change", () => {
        applyProviderDefaults(true);
        syncProviderHint();
        syncImageSizeVisibility();
        saveInputState();
      });
    }

    if (inputMode) {
      inputMode.addEventListener("change", () => {
        syncAllViews();
        saveInputState();
      });
    }

    if (clearUploadBtn) {
      clearUploadBtn.addEventListener("click", async () => {
        await clearCurrentUpload();
      });
    }

    if (uploadZone && referenceFile) {
      uploadZone.addEventListener("click", () => referenceFile.click());
      uploadZone.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          referenceFile.click();
        }
      });
      uploadZone.addEventListener("dragover", (event) => {
        event.preventDefault();
        uploadZone.classList.add("dragging");
      });
      uploadZone.addEventListener("dragleave", () => {
        uploadZone.classList.remove("dragging");
      });
      uploadZone.addEventListener("drop", async (event) => {
        event.preventDefault();
        uploadZone.classList.remove("dragging");
        const file = event.dataTransfer.files[0];
        if (file) {
          const uploadedRef = await uploadReference(
            file,
            confirmBtn,
            referencePreview,
            referenceStatus,
            getActiveMode(),
          );
          if (uploadedRef) {
            await setUploadForCurrentMode(uploadedRef);
          }
        }
      });
      referenceFile.addEventListener("change", async () => {
        const file = referenceFile.files[0];
        if (file) {
          const uploadedRef = await uploadReference(
            file,
            confirmBtn,
            referencePreview,
            referenceStatus,
            getActiveMode(),
          );
          if (uploadedRef) {
            await setUploadForCurrentMode(uploadedRef);
          }
        }
      });
    }

    const autoSaveFields = [
      inputMode,
      methodText,
      providerSelect,
      $("apiKey"),
      baseUrlInput,
      imageModelInput,
      svgModelInput,
      placeholderModeInput,
      mergeThresholdInput,
      minScoreInput,
      optimizeIterationsInput,
      imageSizeInput,
      samBackend,
      samPrompt,
      samApiKeyInput,
      samMaxMasksInput,
    ];
    for (const field of autoSaveFields) {
      if (!field) {
        continue;
      }
      field.addEventListener("input", saveInputState);
      field.addEventListener("change", saveInputState);
    }

    confirmBtn.addEventListener("click", async () => {
      errorMsg.textContent = "";

      const mode = getActiveMode();
      const methodTextValue = methodText?.value.trim() || "";
      if (mode === "generate_from_text" && !methodTextValue) {
        errorMsg.textContent = "Please provide method text.";
        return;
      }
      if (mode === "upload_figure" && !activeUploadPath) {
        errorMsg.textContent = "Please upload a source figure first.";
        return;
      }

      confirmBtn.disabled = true;
      confirmBtn.textContent = "Starting...";

      const payload = {
        input_mode: mode,
        method_text: methodTextValue || null,
        provider: providerSelect?.value || "gemini",
        api_key: trimOrNull($("apiKey")?.value),
        base_url:
          providerSelect?.value === "gemini" && !geminiSupportsCustomBaseUrl
            ? null
            : trimOrNull(baseUrlInput?.value),
        image_model: trimOrNull(imageModelInput?.value),
        image_size:
          (providerSelect?.value === "gemini" ||
            providerSelect?.value === "openai_compatible") &&
          mode === "generate_from_text"
            ? imageSizeInput?.value || "4K"
            : null,
        svg_model: trimOrNull(svgModelInput?.value),
        min_score: parseOptionalFloat(minScoreInput?.value),
        optimize_iterations: parseOptionalInt(optimizeIterationsInput?.value),
        placeholder_mode: placeholderModeInput?.value || "label",
        merge_threshold: parseOptionalFloat(mergeThresholdInput?.value),
        reference_image_path:
          mode === "generate_from_text"
            ? uploadsByMode.generate_from_text?.path || null
            : null,
        source_image_path:
          mode === "upload_figure"
            ? uploadsByMode.upload_figure?.path || null
            : null,
        sam_backend: samBackend?.value || "roboflow",
        sam_prompt: trimOrNull(samPrompt?.value),
        sam_api_key: trimOrNull(samApiKeyInput?.value),
        sam_max_masks: parseOptionalInt(samMaxMasksInput?.value),
      };

      if (payload.sam_backend === "local") {
        payload.sam_api_key = null;
      }
      if (payload.sam_backend !== "fal" && payload.sam_backend !== "api") {
        payload.sam_max_masks = null;
      }

      saveInputState();

      try {
        const response = await fetch("/api/run", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });

        if (!response.ok) {
          const text = await response.text();
          throw new Error(text || "Request failed");
        }

        const data = await response.json();
        window.location.href = `/canvas.html?job=${encodeURIComponent(data.job_id)}`;
      } catch (err) {
        errorMsg.textContent = err.message || "Failed to start job";
        confirmBtn.disabled = false;
        confirmBtn.textContent = "Confirm -> Canvas";
      }
    });
  }

  async function uploadReference(
    file,
    confirmBtn,
    previewEl,
    statusEl,
    inputMode = "generate_from_text",
  ) {
    if (!file.type.startsWith("image/")) {
      statusEl.textContent = "Only image files are supported.";
      return null;
    }

    confirmBtn.disabled = true;
    statusEl.textContent = "Uploading image...";

    const formData = new FormData();
    formData.append("file", file);

    try {
      const response = await fetch("/api/upload", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || "Upload failed");
      }

      const data = await response.json();
      if (previewEl) {
        previewEl.src = data.url || "";
        previewEl.classList.add("visible");
      }
      if (statusEl) {
        statusEl.textContent =
          inputMode === "upload_figure"
            ? `Using uploaded source figure: ${data.name}`
            : `Using uploaded reference image: ${data.name}`;
      }
      return {
        path: data.path || null,
        url: data.url || "",
        name: data.name || "",
      };
    } catch (err) {
      statusEl.textContent = err.message || "Upload failed";
      return null;
    } finally {
      confirmBtn.disabled = false;
    }
  }

  async function initCanvasPage() {
    const params = new URLSearchParams(window.location.search);
    const jobId = params.get("job");
    const statusText = $("statusText");
    const jobIdEl = $("jobId");
    const artifactPanel = $("artifactPanel");
    const artifactList = $("artifactList");
    const toggle = $("artifactToggle");
    const logToggle = $("logToggle");
    const backToConfigBtn = $("backToConfigBtn");
    const logPanel = $("logPanel");
    const logBody = $("logBody");
    const iframe = $("svgEditorFrame");
    const fallback = $("svgFallback");
    const fallbackObject = $("fallbackObject");

    if (!jobId) {
      statusText.textContent = "Missing job id";
      return;
    }

    jobIdEl.textContent = jobId;

    toggle.addEventListener("click", () => {
      artifactPanel.classList.toggle("open");
    });

    logToggle.addEventListener("click", () => {
      logPanel.classList.toggle("open");
    });
    if (backToConfigBtn) {
      backToConfigBtn.addEventListener("click", () => {
        window.location.href = "/";
      });
    }

    let svgEditAvailable = false;
    let svgEditPath = null;
    try {
      const configRes = await fetch("/api/config");
      if (configRes.ok) {
        const config = await configRes.json();
        svgEditAvailable = Boolean(config.svgEditAvailable);
        svgEditPath = config.svgEditPath || null;
      }
    } catch (err) {
      svgEditAvailable = false;
    }

    if (svgEditAvailable && svgEditPath) {
      iframe.src = svgEditPath;
    } else {
      fallback.classList.add("active");
      iframe.style.display = "none";
    }

    let svgReady = false;
    let pendingSvgText = null;

    iframe.addEventListener("load", () => {
      svgReady = true;
      if (pendingSvgText) {
        tryLoadSvg(pendingSvgText);
        pendingSvgText = null;
      }
    });

    const stepMap = {
      figure: { step: 1, label: "Figure generated" },
      samed: { step: 2, label: "SAM3 segmentation" },
      icon_raw: { step: 3, label: "Icons extracted" },
      icon_nobg: { step: 3, label: "Icons refined" },
      template_svg: { step: 4, label: "Template SVG ready" },
      optimized_template_svg: { step: 4, label: "Optimized template ready" },
      final_svg: { step: 5, label: "Final SVG ready" },
    };

    let currentStep = 0;

    const artifacts = new Set();
    const eventSource = new EventSource(`/api/events/${jobId}`);
    let isFinished = false;

    eventSource.addEventListener("artifact", async (event) => {
      const data = JSON.parse(event.data);
      if (!artifacts.has(data.path)) {
        artifacts.add(data.path);
        addArtifactCard(artifactList, data);
      }

      if (
        data.kind === "template_svg" ||
        data.kind === "optimized_template_svg" ||
        data.kind === "final_svg"
      ) {
        await loadSvgAsset(data.url);
      }

      if (stepMap[data.kind] && stepMap[data.kind].step > currentStep) {
        currentStep = stepMap[data.kind].step;
        statusText.textContent = `Step ${currentStep}/5 - ${stepMap[data.kind].label}`;
      }
    });

    eventSource.addEventListener("status", (event) => {
      const data = JSON.parse(event.data);
      if (data.state === "started") {
        statusText.textContent = "Running";
      } else if (data.state === "finished") {
        isFinished = true;
        if (typeof data.code === "number" && data.code !== 0) {
          statusText.textContent = `Failed (code ${data.code})`;
        } else {
          statusText.textContent = "Done";
        }
      }
    });

    eventSource.addEventListener("log", (event) => {
      const data = JSON.parse(event.data);
      appendLogLine(logBody, data);
    });

    eventSource.onerror = () => {
      if (isFinished) {
        eventSource.close();
        return;
      }
      statusText.textContent = "Disconnected";
    };

    async function loadSvgAsset(url) {
      let svgText = "";
      try {
        const response = await fetch(url);
        svgText = await response.text();
      } catch (err) {
        return;
      }

      if (svgEditAvailable) {
        if (!svgEditPath) {
          return;
        }
        if (!svgReady) {
          pendingSvgText = svgText;
          return;
        }

        const loaded = tryLoadSvg(svgText);
        if (!loaded) {
          iframe.src = `${svgEditPath}?url=${encodeURIComponent(url)}`;
        }
      } else {
        fallbackObject.data = url;
      }
    }

    function tryLoadSvg(svgText) {
      if (!iframe.contentWindow) {
        return false;
      }

      const win = iframe.contentWindow;
      if (win.svgEditor && typeof win.svgEditor.loadFromString === "function") {
        win.svgEditor.loadFromString(svgText);
        return true;
      }
      if (win.svgCanvas && typeof win.svgCanvas.setSvgString === "function") {
        win.svgCanvas.setSvgString(svgText);
        return true;
      }
      return false;
    }
  }

  function appendLogLine(container, data) {
    const line = `[${data.stream}] ${data.line}`;
    const lines = container.textContent.split("\n").filter(Boolean);
    lines.push(line);
    if (lines.length > 200) {
      lines.splice(0, lines.length - 200);
    }
    container.textContent = lines.join("\n");
    container.scrollTop = container.scrollHeight;
  }

  function addArtifactCard(container, data) {
    const card = document.createElement("a");
    card.className = "artifact-card";
    card.href = data.url;
    card.target = "_blank";
    card.rel = "noreferrer";

    const img = document.createElement("img");
    img.src = data.url;
    img.alt = data.name;
    img.loading = "lazy";

    const meta = document.createElement("div");
    meta.className = "artifact-meta";

    const name = document.createElement("div");
    name.className = "artifact-name";
    name.textContent = data.name;

    const badge = document.createElement("div");
    badge.className = "artifact-badge";
    badge.textContent = formatKind(data.kind);

    meta.appendChild(name);
    meta.appendChild(badge);
    card.appendChild(img);
    card.appendChild(meta);
    container.prepend(card);
  }

  function formatKind(kind) {
    switch (kind) {
      case "figure":
        return "figure";
      case "samed":
        return "samed";
      case "icon_raw":
        return "icon raw";
      case "icon_nobg":
        return "icon no-bg";
      case "template_svg":
        return "template";
      case "optimized_template_svg":
        return "template opt";
      case "final_svg":
        return "final";
      default:
        return "artifact";
    }
  }
})();
