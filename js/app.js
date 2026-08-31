(() => {
  "use strict";
  const config = window.APP_DATA;
  const SETTINGS_KEY = "tire-consultation-settings-v4";
  const CATALOG_KEY = "tire-consultation-catalog-v2";
  const SEASON_CATALOG_KEY = "tire-consultation-season-catalog-v4";
  const APP_VERSION = "2.4.1";
  const SEASONS = {
    summer: { label: "夏タイヤ", empty: "夏価格表を読み込んでください" },
    winter: { label: "冬タイヤ", empty: "冬価格表を読み込んでください" }
  };
  const $ = selector => document.querySelector(selector);
  const state = {
    activeSeason: "summer",
    catalogs: { summer: createEmptyCatalog(), winter: createEmptyCatalog() },
    products: [],
    sheets: [],
    fileName: "",
    loadedAt: "",
    dataSource: "未読込",
    diagnostics: null,
    brands: [],
    selected: { brands: [], products: [], inch: "", size: "" },
    autoLabor: { inch: 0, autoKey: "", selectedKey: "", label: "未判定", amount: 0 },
    currentProduct: null,
    printMode: "single",
    proposals: [],
    settings: loadSettings()
  };
  const el = {
    admin: $("#adminPanel"), adminSummary: $("#adminSummary"), file: $("#fileInput"), drop: $("#dropZone"),
    status: $("#importStatus"), sheets: $("#sheetList"), addition: $("#addition"), tax: $("#taxRate"),
    rates: $("#rateGrid"), labor: $("#laborGrid"), includeLabor: $("#includeLabor"),
    laborPerTire: $("#laborPerTire"), laborFourTires: $("#laborFourTires"),
    autoLaborInch: $("#autoLaborInch"), autoLaborCategory: $("#autoLaborCategory"),
    autoLaborAmount: $("#autoLaborAmount"), manualLaborCategory: $("#manualLaborCategory"),
    restoreAutoLabor: $("#restoreAutoLabor"),
    storeName: $("#storeName"), storeAddress: $("#storeAddress"), storePhone: $("#storePhone"),
    storeStaff: $("#storeStaff"), storeNote: $("#storeNote"),
    optionButtons: $("#optionButtons"), quoteOptionButtons: $("#quoteOptionButtons"), printQuote: $("#printQuote"),
    customPrintItems: $("#customPrintItems"), addCustomPrintItem: $("#addCustomPrintItem"),
    proposalList: $("#proposalList"), proposalCount: $("#proposalCount"), openCompareProposal: $("#openCompareProposal"),
    singleQuoteTab: $("#singleQuoteTab"), compareQuoteTab: $("#compareQuoteTab"), quoteSheet: $("#quoteSheet"), compareSheet: $("#compareSheet"),
    reset: $("#resetSettings"), clearSelection: $("#clearSelection"), search: $("#searchButton"),
    clearData: $("#clearData"), selectAllBrands: $("#selectAllBrands"), clearAllBrands: $("#clearAllBrands"),
    selectAllProducts: $("#selectAllProducts"), clearAllProducts: $("#clearAllProducts"),
    brandChoices: $("#brandChoices"), subbrandChoices: $("#subbrandChoices"), inchChoices: $("#inchChoices"),
    sizeChoices: $("#sizeChoices"), resultGrid: $("#resultGrid"), resultCount: $("#resultCount"),
    resultMessage: $("#resultMessage"), results: $("#resultsSection"), template: $("#resultTemplate"),
    presentation: $("#presentation"), presentationClose: $("#presentationClose"),
    sourceFileName: $("#sourceFileName"), sourceLoadedAt: $("#sourceLoadedAt"),
    sourceSheetCount: $("#sourceSheetCount"), sourceProductCount: $("#sourceProductCount"), sourceType: $("#sourceType"),
    dataQualityPanel: $("#dataQualityPanel"), dataQualityStatus: $("#dataQualityStatus"),
    dataQualitySummary: $("#dataQualitySummary"), dataQualitySheets: $("#dataQualitySheets"),
    dataQualityCounts: $("#dataQualityCounts"), dataQualityWarnings: $("#dataQualityWarnings"),
    summerTireButton: $("#summerTireButton"), winterTireButton: $("#winterTireButton"),
    seasonCurrentLabel: $("#seasonCurrentLabel"), seasonStatus: $("#seasonStatus"), seasonImportNote: $("#seasonImportNote"),
    versionButton: $("#versionButton"), versionDialog: $("#versionDialog"), versionClose: $("#versionClose"),
    versionSummerFile: $("#versionSummerFile"), versionWinterFile: $("#versionWinterFile"),
    domesticVehicleButton: $("#domesticVehicleButton"), importVehicleButton: $("#importVehicleButton"),
    runFlatTire: $("#runFlatTire")
  };

  initialize();

  function initialize() {
    renderLaborCategoryOptions();
    applySettings();
    bindEvents();
    renderProposalList();
    if (!restoreSavedCatalogs()) clearData({ announce: false });
    renderVersionInfo();
  }

  function bindEvents() {
    el.file.addEventListener("change", event => event.target.files[0] && importWorkbook(event.target.files[0]));
    ["dragenter", "dragover"].forEach(name => el.drop.addEventListener(name, event => {
      event.preventDefault();
      el.drop.classList.add("dragging");
    }));
    ["dragleave", "drop"].forEach(name => el.drop.addEventListener(name, event => {
      event.preventDefault();
      el.drop.classList.remove("dragging");
    }));
    el.drop.addEventListener("drop", event => event.dataTransfer.files[0] && importWorkbook(event.dataTransfer.files[0]));
    el.addition.addEventListener("input", saveSettings);
    el.tax.addEventListener("input", saveSettings);
    el.rates.addEventListener("input", saveSettings);
    el.labor.addEventListener("input", saveSettings);
    el.customPrintItems.addEventListener("input", event => {
      if (event.target.matches("[data-custom-label], [data-custom-value]")) saveCustomPrintItems({ deferRender: true });
    });
    el.customPrintItems.addEventListener("focusout", event => {
      if (event.target.matches("[data-custom-label], [data-custom-value]")) refreshQuotesAfterCustomInput();
    });
    el.customPrintItems.addEventListener("click", event => {
      const toggle = event.target.closest("[data-custom-toggle]");
      const remove = event.target.closest("[data-custom-remove]");
      if (toggle) toggleCustomPrintItem(toggle.dataset.customToggle);
      if (remove) removeCustomPrintItem(remove.dataset.customRemove);
    });
    el.addCustomPrintItem.addEventListener("click", addCustomPrintItem);
    el.includeLabor.addEventListener("change", saveSettings);
    el.domesticVehicleButton.addEventListener("click", () => setVehicleType("domestic"));
    el.importVehicleButton.addEventListener("click", () => setVehicleType("import"));
    el.runFlatTire.addEventListener("change", saveSettings);
    el.manualLaborCategory.addEventListener("change", () => applyLaborCategory(el.manualLaborCategory.value, { save: true, rerun: true }));
    el.restoreAutoLabor.addEventListener("click", () => restoreAutoLabor({ save: true, rerun: true }));
    [el.storeName, el.storeAddress, el.storePhone, el.storeStaff, el.storeNote].forEach(input => input.addEventListener("input", saveSettings));
    [el.optionButtons, el.quoteOptionButtons].forEach(container => container.addEventListener("click", event => {
      const button = event.target.closest("[data-option]");
      if (button) toggleQuoteOption(button.dataset.option);
    }));
    el.openCompareProposal.addEventListener("click", () => openComparePresentation());
    el.singleQuoteTab.addEventListener("click", () => setPrintMode("single"));
    el.compareQuoteTab.addEventListener("click", () => setPrintMode("compare"));
    el.proposalList.addEventListener("click", event => handleProposalListClick(event));
    el.proposalList.addEventListener("change", event => {
      if (event.target.matches("[data-proposal-rank]")) updateProposalRank(event.target.dataset.proposalRank, event.target.value);
    });
    el.printQuote.addEventListener("click", () => window.print());
    el.reset.addEventListener("click", resetSettings);
    el.clearSelection.addEventListener("click", clearSearchSelection);
    el.clearData.addEventListener("click", () => clearData({ announce: true }));
    el.selectAllBrands.addEventListener("click", selectAllBrands);
    el.clearAllBrands.addEventListener("click", clearAllBrands);
    el.selectAllProducts.addEventListener("click", selectAllProducts);
    el.clearAllProducts.addEventListener("click", clearAllProducts);
    el.search.addEventListener("click", runSearch);
    el.summerTireButton.addEventListener("click", () => switchSeason("summer"));
    el.winterTireButton.addEventListener("click", () => switchSeason("winter"));
    el.versionButton.addEventListener("click", openVersionDialog);
    el.versionClose.addEventListener("click", () => closeVersionDialog());
    el.versionDialog.addEventListener("click", event => {
      if (event.target === el.versionDialog) closeVersionDialog();
    });
    el.presentationClose.addEventListener("click", closePresentation);
    el.presentation.addEventListener("click", event => event.target === el.presentation && closePresentation());
    document.addEventListener("keydown", event => event.key === "Escape" && closePresentation());
    document.querySelectorAll(".step-trigger").forEach(button => button.addEventListener("click", () => {
      const section = button.closest(".filter-step");
      if (!section.classList.contains("disabled")) toggleStep(section.dataset.step);
    }));
  }

  function openStep(step) {
    document.querySelectorAll(".filter-step").forEach(section => {
      section.classList.toggle("open", section.dataset.step === step && !section.classList.contains("disabled"));
    });
  }

  function toggleStep(step) {
    const target = document.querySelector(`.filter-step[data-step="${step}"]`);
    if (!target || target.classList.contains("disabled")) return;
    const shouldOpen = !target.classList.contains("open");
    document.querySelectorAll(".filter-step").forEach(section => section.classList.remove("open"));
    if (shouldOpen) target.classList.add("open");
  }

  async function importWorkbook(file) {
    if (!/\.(xlsm|xlsx)$/i.test(file.name)) {
      clearData({ announce: false });
      setStatus("error", "対応形式は .xlsm / .xlsx です");
      return;
    }

    // 入替時は、選択中の季節データだけを解析開始前に破棄する。
    clearData({ announce: false, clearFileInput: false });
    state.fileName = file.name;
    state.dataSource = "Excel（解析中）";
    updateDataSourceDisplay();
    setStatus("", `${file.name} を解析しています…`);

    try {
      const catalog = await window.CatalogParser.parse(await file.arrayBuffer());
      const products = catalog.products.filter(product => product.brand && product.inch);
      if (!products.length) throw new Error("商品データを取得できませんでした");

      state.fileName = file.name;
      state.sheets = catalog.sheets;
      state.products = products;
      state.diagnostics = catalog.diagnostics || createBasicDiagnostics(catalog.sheets, products);
      state.loadedAt = formatDateTime(new Date());
      state.dataSource = "Excel";
      state.brands = sortBrands([...new Set(products.map(product => product.brand))]);
      syncCurrentCatalog();
      ensureRates();
      renderRates();
      renderBrands();
      renderSheets();
      renderDataQuality();
      clearSearchSelection();
      updateDataSourceDisplay();
      saveCatalogs();
      el.clearData.disabled = false;
      setStatus("success", `${file.name}　${state.sheets.length}シート / ${state.products.length.toLocaleString("ja-JP")}商品`);
      el.adminSummary.textContent = `${seasonLabel()}：${file.name} を読込済み`;
      el.admin.open = false;
    } catch (error) {
      console.error(error);
      clearData({ announce: false });
      const reason = error instanceof Error && error.message ? `（${error.message}）` : "";
      setStatus("error", `${file.name} の読込に失敗しました${reason}`);
      el.admin.open = true;
    }
  }

  function clearData({ announce, clearFileInput = true }) {
    state.products = [];
    state.sheets = [];
    state.fileName = "";
    state.loadedAt = "";
    state.dataSource = "未読込";
    state.diagnostics = null;
    state.brands = [];
    state.selected = { brands: [], products: [], inch: "", size: "" };
    resetAutoLaborState();
    state.currentProduct = null;
    state.proposals = [];
    state.catalogs[state.activeSeason] = createEmptyCatalog();
    saveCatalogs();
    if (clearFileInput) el.file.value = "";
    el.sheets.replaceChildren();
    el.brandChoices.replaceChildren();
    el.subbrandChoices.replaceChildren();
    el.inchChoices.replaceChildren();
    el.sizeChoices.replaceChildren();
    renderDataQuality();
    renderRates();
    renderProposalList();
    updateDataSourceDisplay();
    updateSelectionUI();
    resetResults("価格表を読み込んでください", "新しい価格表をドラッグ＆ドロップすると検索できます。");
    el.clearData.disabled = true;
    el.adminSummary.textContent = `${seasonLabel()}の価格表を読み込んでください`;
    if (announce) setStatus("", `${seasonLabel()}の価格データをクリアしました`);
    else setStatus("", SEASONS[state.activeSeason].empty);
    openStep("brand");
  }

  function saveCatalogs() {
    try {
      localStorage.setItem(SEASON_CATALOG_KEY, JSON.stringify({
        version: 4,
        activeSeason: state.activeSeason,
        catalogs: state.catalogs
      }));
      localStorage.removeItem(CATALOG_KEY);
      renderSeasonSwitcher();
      renderVersionInfo();
    } catch (error) {
      console.warn("価格表データの保存に失敗しました", error);
    }
  }

  function restoreSavedCatalogs() {
    try {
      const saved = JSON.parse(localStorage.getItem(SEASON_CATALOG_KEY));
      if (saved?.version === 4 && saved.catalogs) {
        state.activeSeason = SEASONS[saved.activeSeason] ? saved.activeSeason : "summer";
        state.catalogs = {
          summer: normalizeCatalog(saved.catalogs.summer),
          winter: normalizeCatalog(saved.catalogs.winter)
        };
      } else {
        const legacy = JSON.parse(localStorage.getItem(CATALOG_KEY));
        if (!legacy || ![2, 3].includes(legacy.version)) return false;
        state.catalogs.summer = normalizeCatalog(legacy);
        state.activeSeason = "summer";
      }
      if (!normalizeCatalog(state.catalogs[state.activeSeason]).products.length) {
        if (normalizeCatalog(state.catalogs.summer).products.length) state.activeSeason = "summer";
        else if (normalizeCatalog(state.catalogs.winter).products.length) state.activeSeason = "winter";
      }
      loadActiveCatalog();
      renderSeasonSwitcher();
      if (!state.products.length) return false;
      ensureRates();
      renderRates();
      renderBrands();
      renderSheets();
      renderDataQuality();
      clearSearchSelection();
      updateDataSourceDisplay();
      el.clearData.disabled = false;
      setStatus("success", `${seasonLabel()}：${state.fileName} の保存データを復元しました　${state.sheets.length}シート / ${state.products.length.toLocaleString("ja-JP")}商品`);
      el.adminSummary.textContent = `${seasonLabel()}：${state.fileName} を復元済み`;
      el.admin.open = false;
      return true;
    } catch (error) {
      console.warn("保存データの復元に失敗しました", error);
      localStorage.removeItem(SEASON_CATALOG_KEY);
      return false;
    }
  }

  function clearSearchSelection() {
    state.selected = { brands: defaultSelectedBrands(), products: [], inch: "", size: "" };
    resetAutoLaborState();
    state.selected.products = availableProductKeys();
    el.inchChoices.replaceChildren();
    el.sizeChoices.replaceChildren();
    renderBrands();
    renderProducts();
    renderInches();
    updateSelectionUI();
    resetResults(
      state.products.length ? "タイヤを選択してください" : "価格表を読み込んでください",
      state.products.length ? "ブランドと商品を複数選択して比較できます。" : "新しい価格表をドラッグ＆ドロップすると検索できます。"
    );
    openStep("brand");
  }

  function toggleMultiChoice(type, value) {
    const selected = state.selected[type];
    const index = selected.indexOf(value);
    const wasSelected = index >= 0;
    if (wasSelected) selected.splice(index, 1);
    else selected.push(value);

    if (type === "brands") {
      if (wasSelected) {
        state.selected.products = state.selected.products.filter(key => String(key).split("\u001f")[0] !== value);
      } else {
        state.selected.products = [...new Set([...state.selected.products, ...productKeysForBrand(value)])];
      }
      state.selected.inch = "";
      state.selected.size = "";
      renderProducts();
      renderInches();
      el.sizeChoices.replaceChildren();
    } else {
      state.selected.inch = "";
      state.selected.size = "";
      renderInches();
      el.sizeChoices.replaceChildren();
    }
    renderAllSelectedStates();
    updateSelectionUI();
  }

  function selectAllBrands() {
    if (!state.products.length) return;
    state.selected.brands = [...state.brands];
    state.selected.products = availableProductKeys();
    state.selected.inch = "";
    state.selected.size = "";
    renderBrands();
    renderProducts();
    renderInches();
    el.sizeChoices.replaceChildren();
    updateSelectionUI();
  }

  function clearAllBrands() {
    state.selected.brands = [];
    state.selected.products = [];
    state.selected.inch = "";
    state.selected.size = "";
    renderBrands();
    el.subbrandChoices.replaceChildren();
    el.inchChoices.replaceChildren();
    el.sizeChoices.replaceChildren();
    updateSelectionUI();
  }

  function selectAllProducts() {
    if (!state.selected.brands.length) return;
    state.selected.products = availableProductKeys();
    state.selected.inch = "";
    state.selected.size = "";
    renderProducts();
    renderInches();
    el.sizeChoices.replaceChildren();
    updateSelectionUI();
  }

  function clearAllProducts() {
    state.selected.products = [];
    state.selected.inch = "";
    state.selected.size = "";
    renderProducts();
    el.inchChoices.replaceChildren();
    el.sizeChoices.replaceChildren();
    updateSelectionUI();
  }

  function selectSingle(type, value) {
    state.selected[type] = value;
    if (type === "inch") {
      state.selected.size = "";
      resetAutoLaborState();
      renderSizes();
      openStep("size");
    } else if (type === "size") {
      applyAutoLaborForSize(value, { save: true, rerun: false });
    }
    renderAllSelectedStates();
    updateSelectionUI();
  }

  function renderBrands() {
    renderChoices(el.brandChoices, state.brands, "brands", brand => ({
      value: brand, title: brand, detail: presentationFor(brand).mood
    }), true);
  }

  function renderProducts() {
    const entries = availableProductEntries();
    renderChoices(el.subbrandChoices, entries, "products", entry => ({
      value: entry.key,
      title: entry.subbrand,
      detail: `${entry.brand} · ${entry.count}件`
    }), true);
  }

  function renderInches() {
    const values = uniqueProducts("inch", product => productIsSelected(product)).sort((a, b) => Number(a) - Number(b));
    renderChoices(el.inchChoices, values, "inch", value => ({
      value: String(value), title: `${value}"`, detail: "インチ"
    }), false);
  }

  function renderSizes() {
    const counts = new Map();
    state.products
      .filter(product => productIsSelected(product) && String(product.inch) === String(state.selected.inch))
      .forEach(product => {
        const baseSize = baseTireSize(product.size);
        if (baseSize) counts.set(baseSize, (counts.get(baseSize) || 0) + 1);
      });
    const values = [...counts.entries()]
      .map(([value, count]) => ({ value, count }))
      .sort((a, b) => sizeSort(a.value, b.value));
    renderChoices(el.sizeChoices, values, "size", entry => ({
      value: entry.value,
      title: entry.value,
      detail: `${entry.count} 商品`
    }), false);
  }

  function renderChoices(container, values, type, describe, multiple) {
    container.replaceChildren();
    if (!values.length) {
      const message = document.createElement("p");
      message.className = "no-options";
      message.textContent = state.products.length ? "選択できる項目がありません" : "価格表を読み込んでください";
      container.append(message);
      return;
    }
    const fragment = document.createDocumentFragment();
    values.forEach(rawValue => {
      const item = describe(rawValue);
      const button = document.createElement("button");
      button.type = "button";
      button.className = `choice${isSelected(type, item.value) ? " selected" : ""}`;
      button.dataset.value = item.value;
      button.setAttribute("aria-pressed", String(isSelected(type, item.value)));
      button.innerHTML = `<strong>${escapeHtml(item.title)}</strong><small>${escapeHtml(item.detail || "")}</small>`;
      button.addEventListener("click", () => multiple ? toggleMultiChoice(type, item.value) : selectSingle(type, item.value));
      fragment.append(button);
    });
    container.append(fragment);
  }

  function renderAllSelectedStates() {
    [["brands", el.brandChoices], ["products", el.subbrandChoices], ["inch", el.inchChoices], ["size", el.sizeChoices]].forEach(([type, container]) => {
      container.querySelectorAll(".choice").forEach(button => {
        const selected = isSelected(type, button.dataset.value);
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    });
  }

  function updateSelectionUI() {
    const hasData = state.products.length > 0;
    const labels = {
      brand: selectionLabel(state.selected.brands, hasData ? "未選択" : "価格表未読込"),
      subbrand: selectionLabel(state.selected.products.map(productLabelFromKey), state.selected.brands.length ? "商品を選択" : "ブランドを先に選択"),
      inch: state.selected.inch ? `${state.selected.inch}インチ` : (state.selected.products.length ? "インチを選択" : "商品を先に選択"),
      size: state.selected.size || (state.selected.inch ? "サイズを選択" : "インチを先に選択")
    };
    Object.entries(labels).forEach(([key, value]) => $(`#${key}Value`).textContent = value);

    document.querySelectorAll(".filter-step").forEach(section => {
      const type = section.dataset.step;
      const enabled = hasData && (
        type === "brand" ||
        (type === "subbrand" && state.selected.brands.length) ||
        (type === "inch" && state.selected.products.length) ||
        (type === "size" && state.selected.inch)
      );
      section.classList.toggle("disabled", !enabled);
      if (!enabled) section.classList.remove("open");
    });

    const summaryValues = [
      labels.brand,
      selectionLabel(state.selected.products.map(productLabelFromKey), "未選択"),
      state.selected.inch ? `${state.selected.inch}"` : "未選択",
      state.selected.size || "未選択"
    ];
    document.querySelectorAll("#selectionSummary b").forEach((node, index) => node.textContent = summaryValues[index]);
    el.search.disabled = !(hasData && state.selected.brands.length && state.selected.products.length && state.selected.inch && state.selected.size);
    el.selectAllBrands.disabled = !hasData;
    el.clearAllBrands.disabled = !state.selected.brands.length;
    el.selectAllProducts.disabled = !state.selected.brands.length;
    el.clearAllProducts.disabled = !state.selected.products.length;
    applyBrandTheme(state.selected.brands.length === 1 ? state.selected.brands[0] : "");
  }

  function runSearch({ scroll = true } = {}) {
    if (el.search.disabled) return;
    const brandPriority = new Map(config.preferredBrandOrder.map((brand, index) => [brand.toUpperCase(), index]));
    const results = state.products
      .filter(product => productIsSelected(product))
      .filter(product => String(product.inch) === String(state.selected.inch))
      .filter(product => normalizeSize(baseTireSize(product.size)) === normalizeSize(state.selected.size))
      .map(product => ({ ...product, singlePrice: window.PriceEngine.calculate(product.cost, product.brand, state.settings) }))
      .sort((a, b) =>
        (brandPriority.get(a.brand.toUpperCase()) ?? 999) - (brandPriority.get(b.brand.toUpperCase()) ?? 999) ||
        a.subbrand.localeCompare(b.subbrand, "ja") ||
        a.singlePrice - b.singlePrice
    );
    renderResults(results);
    safeScrollIntoView(el.results, { behavior: "smooth", block: "start" }, scroll);
  }

  function renderResults(results) {
    el.resultGrid.replaceChildren();
    el.resultCount.textContent = `${results.length}件`;
    el.resultMessage.textContent = results.length ? `${state.selected.size} の比較候補` : "該当商品がありません";
    if (!results.length) return renderEmpty("該当する商品がありません", "別の条件を選択してください。");
    const fragment = document.createDocumentFragment();
    results.forEach(product => {
      const card = el.template.content.firstElementChild.cloneNode(true);
      card.querySelector(".brand-badge").textContent = product.brand;
      card.querySelector(".source-badge").textContent = product.source;
      card.querySelector(".product-name").textContent = product.subbrand;
      card.querySelector(".tire-size").textContent = product.size;
      card.querySelector(".product-code").textContent = product.code ? `商品コード ${product.code}` : "商品コード記載なし";
      card.querySelector(".auto-labor-badge").textContent = autoLaborText(product.size);
      const proposalCheckbox = card.querySelector(".proposal-checkbox");
      proposalCheckbox.checked = proposalIndex(proposalId(product)) >= 0;
      proposalCheckbox.addEventListener("change", event => toggleProposal(product, event.target.checked));
      card.querySelector(".single-price").textContent = window.PriceEngine.format(product.singlePrice);
      const totals = proposalTotals(product);
      card.querySelector(".four-price").textContent = window.PriceEngine.format(totals.tireFour);
      card.querySelector(".labor-price").textContent = window.PriceEngine.format(totals.optionTotal);
      card.querySelector(".total-price").textContent = window.PriceEngine.format(totals.totalFour);
      card.querySelector(".labor-total").hidden = !totals.optionLines.length;
      card.querySelector(".presentation-button").addEventListener("click", () => openPresentation(product));
      card.querySelector(".copy-button").addEventListener("click", event => copyProposal(product, event.currentTarget));
      fragment.append(card);
    });
    el.resultGrid.append(fragment);
  }

  function openPresentation(product) {
    const theme = presentationFor(product.brand);
    state.currentProduct = product;
    setPrintMode("single");
    el.presentation.style.setProperty("--present-accent", theme.accent);
    el.presentation.style.setProperty("--present-soft", theme.soft);
    renderQuote(product);
    el.presentation.hidden = false;
    document.body.classList.add("presentation-open");
  }

  function renderQuote(product) {
    if (!product) return;
    const totals = proposalTotals(product);
    const store = state.settings.store;
    $("#presentationBrand").textContent = product.brand;
    $("#presentationSubbrand").textContent = product.subbrand;
    $("#presentationSize").textContent = product.size;
    $("#presentationCode").textContent = product.code ? `商品コード：${product.code}` : "商品コード記載なし";
    $("#presentationAutoLabor").textContent = vehiclePrintText();
    $("#presentationSingle").textContent = window.PriceEngine.format(product.singlePrice);
    $("#presentationFour").textContent = window.PriceEngine.format(totals.tireFour);
    $("#presentationTotal").textContent = window.PriceEngine.format(totals.totalFour);
    $("#quoteDate").textContent = formatDate(new Date());
    $("#quoteStoreName").textContent = store.name || "タイヤ館 箕輪";
    $("#quoteStoreAddress").textContent = store.address || config.defaultStoreSettings.address || "";
    $("#quoteStorePhone").textContent = store.phone || config.defaultStoreSettings.phone ? `TEL ${store.phone || config.defaultStoreSettings.phone}` : "";
    $("#quoteStoreStaff").textContent = store.staff ? `担当：${store.staff}` : "";
    $("#quoteNote").textContent = store.note || "表示価格は税込です。有効期限・在庫状況は店頭にてご確認ください。";
    renderQuoteLines(totals.optionLines);
    renderOptionButtons();
    renderCompareQuote();
  }

  function closePresentation() {
    el.presentation.hidden = true;
    document.body.classList.remove("presentation-open");
  }

  async function copyProposal(product, button) {
    const totals = proposalTotals(product);
    const lines = [
      state.settings.store.name || "タイヤ館 箕輪",
      "お見積書",
      `${product.brand} ${product.subbrand}`,
      product.size,
      product.code ? `商品コード：${product.code}` : "",
      vehiclePrintText(),
      `本数：4本`,
      `1本価格（税込）：¥${window.PriceEngine.format(product.singlePrice)}`,
      `タイヤ4本（税込）：¥${window.PriceEngine.format(totals.tireFour)}`,
      ...totals.optionLines.map(line => `${line.label}：¥${window.PriceEngine.format(line.total)}`),
      `税込合計：¥${window.PriceEngine.format(totals.totalFour)}`
    ].filter(Boolean);
    const copied = await copyText(lines.join("\n"));
    const original = button.textContent;
    button.textContent = copied ? "コピーしました" : "コピーできませんでした";
    button.classList.toggle("copied", copied);
    window.setTimeout(() => {
      button.textContent = original;
      button.classList.remove("copied");
    }, 1800);
  }

  async function copyText(value) {
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(value);
        return true;
      }
    } catch {
      // file:// でClipboard APIが制限される場合は従来方式へ切り替える。
    }
    const area = document.createElement("textarea");
    area.value = value;
    area.setAttribute("readonly", "");
    area.style.position = "fixed";
    area.style.opacity = "0";
    document.body.append(area);
    area.select();
    const copied = document.execCommand("copy");
    area.remove();
    return copied;
  }

  function availableProductEntries() {
    const counts = new Map();
    state.products
      .filter(product => state.selected.brands.includes(product.brand))
      .forEach(product => {
        const key = productKey(product);
        const current = counts.get(key) || { key, brand: product.brand, subbrand: product.subbrand, count: 0 };
        current.count += 1;
        counts.set(key, current);
      });
    const priority = new Map(config.preferredBrandOrder.map((brand, index) => [brand.toUpperCase(), index]));
    return [...counts.values()].sort((a, b) =>
      (priority.get(a.brand.toUpperCase()) ?? 999) - (priority.get(b.brand.toUpperCase()) ?? 999) ||
      a.subbrand.localeCompare(b.subbrand, "ja")
    );
  }

  function availableProductKeys() {
    return availableProductEntries().map(entry => entry.key);
  }

  function productIsSelected(product) {
    return state.selected.brands.includes(product.brand) && state.selected.products.includes(productKey(product));
  }

  function productKey(product) {
    return `${product.brand}\u001f${product.subbrand}`;
  }

  function productLabelFromKey(key) {
    return String(key).split("\u001f")[1] || key;
  }

  function isSelected(type, value) {
    return Array.isArray(state.selected[type]) ? state.selected[type].includes(value) : String(state.selected[type]) === String(value);
  }

  function selectionLabel(values, emptyLabel) {
    if (!values.length) return emptyLabel;
    if (values.length === 1) return values[0];
    return `${values.length}件選択`;
  }

  function renderRates() {
    el.rates.replaceChildren();
    const brands = state.brands.length ? state.brands : config.preferredBrandOrder;
    brands.forEach(brand => {
      const label = document.createElement("label");
      label.className = "rate-item";
      label.innerHTML = `<span>${escapeHtml(brand)}</span><input type="number" min="0" step="0.01" inputmode="decimal" data-brand="${escapeHtml(brand)}" value="${state.settings.rates[brand] ?? state.settings.defaultRate}">`;
      el.rates.append(label);
    });
  }

  function renderSheets() {
    el.sheets.replaceChildren();
    state.sheets.forEach(name => {
      const span = document.createElement("span");
      span.textContent = name;
      el.sheets.append(span);
    });
  }

  function renderDataQuality() {
    const diagnostics = state.diagnostics;
    if (!diagnostics || !state.products.length) {
      el.dataQualityPanel.hidden = true;
      el.dataQualitySummary.replaceChildren();
      el.dataQualitySheets.replaceChildren();
      el.dataQualityCounts.replaceChildren();
      el.dataQualityWarnings.replaceChildren();
      return;
    }

    const totals = diagnostics.totals || {};
    const warningCount = Number(totals.warningCount || 0);
    el.dataQualityPanel.hidden = false;
    el.dataQualityStatus.textContent = warningCount ? `警告 ${warningCount.toLocaleString("ja-JP")}件` : "警告なし";
    el.dataQualityStatus.classList.toggle("has-warning", warningCount > 0);
    el.dataQualitySummary.innerHTML = [
      ["抽出件数", totals.productCount ?? state.products.length],
      ["サイズ件数", totals.sizeCount ?? new Set(state.products.map(product => product.size)).size],
      ["警告件数", warningCount],
      ["価格不明", totals.priceMissingCount ?? 0],
      ["サイズ不明", totals.sizeMissingCount ?? 0],
      ["重複", totals.duplicateCount ?? 0]
    ].map(([label, value]) => `<div><span>${escapeHtml(label)}</span><strong>${formatCount(value)}</strong></div>`).join("");

    el.dataQualitySheets.innerHTML = (diagnostics.sheetSummaries || []).map(sheet => `
      <p>
        <span>${escapeHtml(sheet.name)}</span>
        <strong>${formatCount(sheet.productCount)}件抽出</strong>
        <small>サイズ ${formatCount(sheet.sizeCount)} / 警告 ${formatCount(sheet.warningCount)} / 価格不明 ${formatCount(sheet.priceMissingCount)} / サイズ不明 ${formatCount(sheet.sizeMissingCount)}</small>
      </p>
    `).join("") || `<p><span>シート情報なし</span><strong>0件</strong></p>`;

    el.dataQualityCounts.innerHTML = [
      ["ブランド別", diagnostics.counts?.byBrand],
      ["商品別", diagnostics.counts?.byProduct],
      ["サイズ別", diagnostics.counts?.bySize],
      ["インチ別", diagnostics.counts?.byInch]
    ].map(([label, counts]) => `
      <details>
        <summary>${escapeHtml(label)}</summary>
        <div>${topCountEntries(counts).map(([name, count]) => `<p><span>${escapeHtml(name)}</span><strong>${formatCount(count)}</strong></p>`).join("")}</div>
      </details>
    `).join("");

    const issues = diagnostics.issues || [];
    el.dataQualityWarnings.innerHTML = issues.length
      ? issues.slice(0, 20).map(issue => `
        <p>
          <span>${escapeHtml(issue.reason)}：${escapeHtml(issue.sheet || "不明")} ${issue.row ? `${issue.row}行` : ""}</span>
          <small>${escapeHtml([issue.brand, issue.product, issue.size, issue.code, issue.value].filter(Boolean).join(" / ") || "詳細なし")}</small>
        </p>
      `).join("") + ((issues.length > 20 || diagnostics.issueOverflowCount) ? `<p><span>ほか ${formatCount(Math.max(0, issues.length - 20) + Number(diagnostics.issueOverflowCount || 0))}件</span><small>詳細は元データをご確認ください</small></p>` : "")
      : `<p><span>読み飛ばし警告はありません</span><small>抽出できるデータは正常に読み込まれています</small></p>`;
  }

  function createBasicDiagnostics(sheets, products) {
    const sheetSummaries = sheets.map(name => {
      const sheetProducts = products.filter(product => product.source === name);
      return {
        name,
        productCount: sheetProducts.length,
        sizeCount: new Set(sheetProducts.map(product => product.size)).size,
        warningCount: 0,
        priceMissingCount: 0,
        sizeMissingCount: 0,
        unknownProductCount: sheetProducts.filter(product => product.subbrand === "商品名記載なし").length
      };
    });
    return {
      sheets,
      sheetSummaries,
      totals: {
        productCount: products.length,
        sizeCount: new Set(products.map(product => product.size)).size,
        skippedRowCount: 0,
        warningCount: 0,
        unknownProductCount: products.filter(product => product.subbrand === "商品名記載なし").length,
        priceMissingCount: 0,
        sizeMissingCount: 0,
        duplicateCount: 0
      },
      counts: {
        byBrand: countProducts(products, product => product.brand),
        byProduct: countProducts(products, product => product.subbrand),
        bySize: countProducts(products, product => product.size),
        byInch: countProducts(products, product => product.inch ? `${product.inch}インチ` : "インチ不明")
      },
      issues: []
    };
  }

  function countProducts(products, getter) {
    return Object.fromEntries([...products.reduce((map, product) => {
      const key = getter(product) || "不明";
      map.set(key, (map.get(key) || 0) + 1);
      return map;
    }, new Map())].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0], "ja")));
  }

  function topCountEntries(counts, limit = 40) {
    return Object.entries(counts || {}).slice(0, limit);
  }

  function formatCount(value) {
    return Number(value || 0).toLocaleString("ja-JP");
  }

  function updateDataSourceDisplay() {
    el.sourceFileName.textContent = state.fileName || "未読込";
    el.sourceLoadedAt.textContent = state.loadedAt || "―";
    el.sourceSheetCount.textContent = state.sheets.length.toLocaleString("ja-JP");
    el.sourceProductCount.textContent = state.products.length.toLocaleString("ja-JP");
    el.sourceType.textContent = state.dataSource;
    renderSeasonSwitcher();
  }

  function switchSeason(season) {
    if (!SEASONS[season] || state.activeSeason === season) return;
    syncCurrentCatalog();
    state.activeSeason = season;
    loadActiveCatalog();
    renderRates();
    renderBrands();
    renderSheets();
    renderDataQuality();
    clearSearchSelection();
    updateDataSourceDisplay();
    renderSeasonSwitcher();
    saveCatalogs();
    el.clearData.disabled = !state.products.length;
    if (state.products.length) {
      setStatus("success", `${seasonLabel()}：${state.fileName} を表示中`);
      el.adminSummary.textContent = `${seasonLabel()}：${state.fileName} を読込済み`;
    } else {
      setStatus("", SEASONS[state.activeSeason].empty);
      el.adminSummary.textContent = SEASONS[state.activeSeason].empty;
    }
  }

  function renderSeasonSwitcher() {
    const current = SEASONS[state.activeSeason];
    el.summerTireButton.classList.toggle("selected", state.activeSeason === "summer");
    el.winterTireButton.classList.toggle("selected", state.activeSeason === "winter");
    el.summerTireButton.setAttribute("aria-pressed", String(state.activeSeason === "summer"));
    el.winterTireButton.setAttribute("aria-pressed", String(state.activeSeason === "winter"));
    el.seasonCurrentLabel.textContent = `現在：${current.label}`;
    el.seasonStatus.textContent = state.fileName ? `${state.fileName} / ${state.products.length.toLocaleString("ja-JP")}商品` : current.empty;
    el.seasonImportNote.textContent = `現在選択中：${current.label}`;
  }

  function syncCurrentCatalog() {
    state.catalogs[state.activeSeason] = {
      fileName: state.fileName,
      loadedAt: state.loadedAt,
      sheets: state.sheets,
      products: state.products,
      diagnostics: state.diagnostics,
      dataSource: state.dataSource
    };
  }

  function loadActiveCatalog() {
    const catalog = normalizeCatalog(state.catalogs[state.activeSeason]);
    state.fileName = catalog.fileName;
    state.loadedAt = catalog.loadedAt;
    state.sheets = catalog.sheets;
    state.products = catalog.products;
    state.diagnostics = catalog.diagnostics;
    state.dataSource = catalog.products.length ? (catalog.dataSource || "保存データ（Excel）") : "未読込";
    state.brands = sortBrands([...new Set(state.products.map(product => product.brand))]);
    resetAutoLaborState();
    state.currentProduct = null;
    state.proposals = [];
  }

  function normalizeCatalog(raw) {
    const catalog = raw || {};
    const sheets = Array.isArray(catalog.sheets) ? catalog.sheets : [];
    const products = Array.isArray(catalog.products)
      ? catalog.products.filter(product => product.brand && product.size && product.inch && Number.isFinite(Number(product.cost)))
      : [];
    return {
      fileName: products.length ? (catalog.fileName || "保存済み価格表") : "",
      loadedAt: products.length ? (catalog.loadedAt || "") : "",
      sheets,
      products,
      diagnostics: products.length ? (catalog.diagnostics || createBasicDiagnostics(sheets, products)) : null,
      dataSource: products.length ? (catalog.dataSource || "保存データ（Excel）") : "未読込"
    };
  }

  function createEmptyCatalog() {
    return { fileName: "", loadedAt: "", sheets: [], products: [], diagnostics: null, dataSource: "未読込" };
  }

  function seasonLabel(season = state.activeSeason) {
    return SEASONS[season]?.label || "夏タイヤ";
  }

  function renderLaborCategoryOptions() {
    el.manualLaborCategory.replaceChildren();
    laborSettingsForVehicle().categories.forEach(category => {
      const option = document.createElement("option");
      option.value = category.key;
      option.textContent = `${category.label}（${window.PriceEngine.format(window.PriceEngine.autoLaborTotal(category) + window.PriceEngine.runFlatAmount(state.settings.vehicle))}円）`;
      el.manualLaborCategory.append(option);
    });
  }

  function renderQuoteLines(optionLines) {
    const body = $("#quoteLineBody");
    body.replaceChildren();
    optionLines.forEach(line => {
      const row = document.createElement("tr");
      const detail = line.details?.length
        ? `<div class="quote-detail">${line.details.map(([label, amount]) => `${escapeHtml(label)}：${amount ? `${window.PriceEngine.format(amount)}円` : "無料"}`).join("<br>")}</div>`
        : "";
      row.innerHTML = `
        <td>${escapeHtml(line.label)}${detail}</td>
        <td>${line.unit ? `¥${window.PriceEngine.format(line.unit)}` : "―"}</td>
        <td>${line.quantity || "―"}</td>
        <td>${escapeHtml(line.value || (line.total ? `¥${window.PriceEngine.format(line.total)}` : "無料"))}</td>
      `;
      body.append(row);
    });
    if (!optionLines.length) {
      const row = document.createElement("tr");
      row.innerHTML = `<td colspan="4">選択中の作業・オプションはありません</td>`;
      body.append(row);
    }
  }

  function proposalId(product) {
    return [product.brand, product.subbrand, product.size, product.code, product.cost, product.source].join("|");
  }

  function proposalIndex(id) {
    return state.proposals.findIndex(item => item.id === id);
  }

  function toggleProposal(product, selected) {
    const id = proposalId(product);
    const index = proposalIndex(id);
    if (selected && index < 0) {
      state.proposals.push({ id, product: { ...product }, rank: state.proposals.length ? "○ おすすめ" : "◎ 一番おすすめ" });
    } else if (!selected && index >= 0) {
      state.proposals.splice(index, 1);
    }
    renderProposalList();
    renderAllProposalCheckboxes();
    if (state.printMode === "compare") renderCompareQuote();
  }

  function renderAllProposalCheckboxes() {
    el.resultGrid.querySelectorAll(".result-card").forEach(card => {
      const brand = card.querySelector(".brand-badge")?.textContent || "";
      const subbrand = card.querySelector(".product-name")?.textContent || "";
      const size = card.querySelector(".tire-size")?.textContent || "";
      const checkbox = card.querySelector(".proposal-checkbox");
      if (!checkbox) return;
      checkbox.checked = state.proposals.some(item => item.product.brand === brand && item.product.subbrand === subbrand && item.product.size === size);
    });
  }

  function renderProposalList() {
    el.proposalCount.textContent = `${state.proposals.length}件`;
    el.openCompareProposal.disabled = !state.proposals.length;
    el.proposalList.replaceChildren();
    if (!state.proposals.length) {
      renderProposalEmpty();
      return;
    }
    const fragment = document.createDocumentFragment();
    state.proposals.forEach((item, index) => {
      const row = document.createElement("div");
      row.className = "proposal-item";
      row.innerHTML = `
        <span class="proposal-rank">${index + 1}</span>
        <div class="proposal-info">
          <strong>${escapeHtml(item.product.brand)} ${escapeHtml(item.product.subbrand)}</strong>
          <span>${escapeHtml(item.product.size)}${item.product.code ? ` / 商品コード：${escapeHtml(item.product.code)}` : ""}</span>
        </div>
        <input type="text" data-proposal-rank="${escapeHtml(item.id)}" value="${escapeHtml(item.rank || "")}" placeholder="◎ 一番おすすめ">
        <div>
          <button class="proposal-move" type="button" data-proposal-up="${escapeHtml(item.id)}" ${index === 0 ? "disabled" : ""}>↑</button>
          <button class="proposal-move" type="button" data-proposal-down="${escapeHtml(item.id)}" ${index === state.proposals.length - 1 ? "disabled" : ""}>↓</button>
        </div>
        <button class="proposal-remove" type="button" data-proposal-remove="${escapeHtml(item.id)}">削除</button>
      `;
      fragment.append(row);
    });
    el.proposalList.append(fragment);
  }

  function renderProposalEmpty() {
    const empty = document.createElement("div");
    empty.className = "empty-state";
    empty.innerHTML = `<span class="empty-ring"></span><strong>提案商品が未選択です</strong><p>検索結果の「提案する」をチェックすると、比較提案に追加されます。</p>`;
    el.proposalList.append(empty);
  }

  function handleProposalListClick(event) {
    const remove = event.target.closest("[data-proposal-remove]");
    const up = event.target.closest("[data-proposal-up]");
    const down = event.target.closest("[data-proposal-down]");
    if (remove) removeProposal(remove.dataset.proposalRemove);
    if (up) moveProposal(up.dataset.proposalUp, -1);
    if (down) moveProposal(down.dataset.proposalDown, 1);
  }

  function removeProposal(id) {
    const index = proposalIndex(id);
    if (index >= 0) state.proposals.splice(index, 1);
    renderProposalList();
    renderAllProposalCheckboxes();
    if (state.printMode === "compare") renderCompareQuote();
  }

  function moveProposal(id, direction) {
    const index = proposalIndex(id);
    const next = index + direction;
    if (index < 0 || next < 0 || next >= state.proposals.length) return;
    [state.proposals[index], state.proposals[next]] = [state.proposals[next], state.proposals[index]];
    renderProposalList();
    if (state.printMode === "compare") renderCompareQuote();
  }

  function updateProposalRank(id, rank) {
    const item = state.proposals[proposalIndex(id)];
    if (!item) return;
    item.rank = rank;
    renderProposalList();
    if (state.printMode === "compare") renderCompareQuote();
  }

  function openComparePresentation() {
    const product = state.proposals[0]?.product || state.currentProduct;
    if (product) state.currentProduct = product;
    setPrintMode("compare");
    renderCompareQuote();
    el.presentation.hidden = false;
    document.body.classList.add("presentation-open");
  }

  function setPrintMode(mode) {
    state.printMode = mode;
    el.singleQuoteTab.classList.toggle("selected", mode === "single");
    el.compareQuoteTab.classList.toggle("selected", mode === "compare");
    el.quoteSheet.hidden = mode !== "single";
    el.compareSheet.hidden = mode !== "compare";
    if (mode === "single" && state.currentProduct) renderQuote(state.currentProduct);
    if (mode === "compare") renderCompareQuote();
  }

  function renderCompareQuote() {
    const store = state.settings.store;
    $("#compareDate").textContent = formatDate(new Date());
    $("#compareStoreName").textContent = store.name || "タイヤ館 箕輪";
    $("#compareStoreAddress").textContent = store.address || config.defaultStoreSettings.address || "";
    $("#compareStorePhone").textContent = store.phone || config.defaultStoreSettings.phone ? `TEL ${store.phone || config.defaultStoreSettings.phone}` : "";
    $("#compareStoreStaff").textContent = store.staff ? `担当：${store.staff}` : "";
    $("#compareNote").textContent = store.note || "表示価格は税込です。比較提案は選択中の作業・オプション条件で計算しています。";
    const pages = $("#comparePages");
    pages.replaceChildren();
    const items = state.proposals.length ? state.proposals : (state.currentProduct ? [{ id: proposalId(state.currentProduct), product: state.currentProduct, rank: "◎ 一番おすすめ" }] : []);
    for (let i = 0; i < items.length; i += 4) {
      const page = document.createElement("section");
      page.className = "compare-page";
      const grid = document.createElement("div");
      grid.className = "compare-grid";
      items.slice(i, i + 4).forEach(item => grid.append(renderCompareCard(item)));
      page.append(grid);
      pages.append(page);
    }
  }

  function renderCompareCard(item) {
    const product = item.product;
    const totals = proposalTotals(product);
    const card = document.createElement("article");
    card.className = "compare-card";
    card.innerHTML = `
      <span class="compare-recommend">${escapeHtml(item.rank || "○ おすすめ")}</span>
      <h3>${escapeHtml(product.brand)}<br>${escapeHtml(product.subbrand)}</h3>
      <p class="compare-meta">${escapeHtml(product.size)}<br>${product.code ? `商品コード：${escapeHtml(product.code)}` : "商品コード記載なし"}</p>
      <div class="compare-price-list">
        <p><span>本数</span><strong>4本</strong></p>
        <p><span>タイヤ単価</span><strong>¥${window.PriceEngine.format(product.singlePrice || window.PriceEngine.calculate(product.cost, product.brand, state.settings))}</strong></p>
        <p><span>タイヤ合計</span><strong>¥${window.PriceEngine.format(totals.tireFour)}</strong></p>
        ${totals.optionLines.map(line => `
          <p><span>${escapeHtml(line.label)}</span><strong>${escapeHtml(line.value || (line.total ? `¥${window.PriceEngine.format(line.total)}` : "無料"))}</strong></p>
        `).join("")}
      </div>
      <div class="compare-total"><span>税込合計</span><strong>¥${window.PriceEngine.format(totals.totalFour)}</strong></div>
    `;
    return card;
  }

  function renderOptionButtons() {
    [el.optionButtons, el.quoteOptionButtons].forEach(container => {
      container.querySelectorAll("[data-option]").forEach(button => {
        const selected = Boolean(state.settings.options?.[button.dataset.option]);
        button.classList.toggle("selected", selected);
        button.setAttribute("aria-pressed", String(selected));
      });
    });
    el.includeLabor.checked = Boolean(state.settings.options?.labor);
    if (!isEditingCustomPrintItem()) renderCustomPrintItems();
  }

  function toggleQuoteOption(key) {
    state.settings.options[key] = !state.settings.options[key];
    if (key === "labor") state.settings.includeLabor = state.settings.options.labor;
    renderOptionButtons();
    persistSettings(true);
    if (state.currentProduct) renderQuote(state.currentProduct);
  }

  function renderCustomPrintItems() {
    el.customPrintItems.replaceChildren();
    const fragment = document.createDocumentFragment();
    state.settings.customPrintItems.forEach(item => {
      const row = document.createElement("div");
      row.className = "custom-print-row";
      row.innerHTML = `
        <button class="custom-print-toggle ${item.enabled ? "selected" : ""}" type="button" data-custom-toggle="${escapeHtml(item.id)}" aria-pressed="${String(Boolean(item.enabled))}">${item.enabled ? "印刷する" : "印刷しない"}</button>
        <label><span>項目名</span><input type="text" data-custom-label="${escapeHtml(item.id)}" value="${escapeHtml(item.label || "")}" placeholder="項目名"></label>
        <label><span>金額または内容</span><input type="text" data-custom-value="${escapeHtml(item.id)}" value="${escapeHtml(item.value || "")}" placeholder="例：12000円 / 作業内容"></label>
        <button class="custom-print-remove" type="button" data-custom-remove="${escapeHtml(item.id)}" ${item.locked ? "disabled" : ""}>削除</button>
      `;
      fragment.append(row);
    });
    el.customPrintItems.append(fragment);
  }

  function saveCustomPrintItems({ deferRender = false } = {}) {
    state.settings.customPrintItems = state.settings.customPrintItems.map(item => ({
      ...item,
      label: el.customPrintItems.querySelector(`[data-custom-label="${cssEscape(item.id)}"]`)?.value.trim() || "",
      value: el.customPrintItems.querySelector(`[data-custom-value="${cssEscape(item.id)}"]`)?.value.trim() || ""
    }));
    persistSettings(!deferRender);
    if (!deferRender) refreshQuotesAfterCustomInput();
  }

  function refreshQuotesAfterCustomInput() {
    if (state.currentProduct) renderQuote(state.currentProduct);
    if (state.printMode === "compare") renderCompareQuote();
  }

  function toggleCustomPrintItem(id) {
    saveCustomPrintItems();
    const item = state.settings.customPrintItems.find(entry => entry.id === id);
    if (!item) return;
    item.enabled = !item.enabled;
    persistSettings(true);
    renderCustomPrintItems();
    if (state.currentProduct) renderQuote(state.currentProduct);
    if (state.printMode === "compare") renderCompareQuote();
  }

  function addCustomPrintItem() {
    saveCustomPrintItems();
    const nextNumber = state.settings.customPrintItems
      .filter(item => /^その他/.test(item.label || ""))
      .length + 1;
    state.settings.customPrintItems.push({
      id: `custom-${Date.now()}`,
      label: `その他${nextNumber}`,
      value: "",
      enabled: true
    });
    persistSettings(true);
    renderCustomPrintItems();
  }

  function removeCustomPrintItem(id) {
    saveCustomPrintItems();
    state.settings.customPrintItems = state.settings.customPrintItems.filter(item => item.id !== id || item.locked);
    persistSettings(true);
    renderCustomPrintItems();
    if (state.currentProduct) renderQuote(state.currentProduct);
    if (state.printMode === "compare") renderCompareQuote();
  }

  function setVehicleType(type) {
    state.settings.vehicle = {
      type: type === "import" ? "import" : "domestic",
      runFlat: Boolean(state.settings.vehicle?.runFlat)
    };
    renderLaborCategoryOptions();
    renderVehicleSettings();
    if (state.selected.size) applyAutoLaborForSize(state.selected.size, { save: false, rerun: false });
    updateLaborSummary();
    persistSettings(true);
    if (state.currentProduct) renderQuote(state.currentProduct);
    if (state.printMode === "compare") renderCompareQuote();
  }

  function renderVehicleSettings() {
    const vehicle = state.settings.vehicle || { type: "domestic", runFlat: false };
    const isImport = vehicle.type === "import";
    el.domesticVehicleButton.classList.toggle("selected", !isImport);
    el.importVehicleButton.classList.toggle("selected", isImport);
    el.domesticVehicleButton.setAttribute("aria-pressed", String(!isImport));
    el.importVehicleButton.setAttribute("aria-pressed", String(isImport));
    el.runFlatTire.checked = Boolean(vehicle.runFlat);
    el.runFlatTire.disabled = false;
  }

  function laborSettingsForVehicle() {
    return state.settings.vehicle?.type === "import" ? config.importLaborSettings : config.autoLaborSettings;
  }

  function applyAutoLaborForSize(size, { save, rerun } = {}) {
    const category = window.PriceEngine.autoLaborCategory(size, laborSettingsForVehicle());
    state.autoLabor.autoKey = category.key;
    applyLaborCategory(category.key, { save, rerun, size, auto: true });
  }

  function applyLaborCategory(key, { save, rerun, size = state.selected.size, auto = false } = {}) {
    const category = window.PriceEngine.autoLaborByKey(key, laborSettingsForVehicle(), size);
    state.autoLabor = {
      inch: category.inch || window.PriceEngine.tireInch(size),
      autoKey: auto ? category.key : state.autoLabor.autoKey,
      selectedKey: category.key,
      label: category.label,
      amount: window.PriceEngine.autoLaborTotal(category)
    };
    state.settings.labor = window.PriceEngine.laborFromAutoCategory(category);
    renderLaborInputs();
    updateAutoLaborDisplay();
    updateLaborSummary();
    if (save) persistSettings(rerun);
  }

  function restoreAutoLabor({ save, rerun } = {}) {
    if (!state.selected.size) return;
    applyAutoLaborForSize(state.selected.size, { save, rerun });
  }

  function resetAutoLaborState() {
    state.autoLabor = { inch: 0, autoKey: "", selectedKey: "", label: "未判定", amount: 0 };
    updateAutoLaborDisplay();
  }

  function updateAutoLaborDisplay() {
    el.autoLaborInch.textContent = state.autoLabor.inch ? `${state.autoLabor.inch}インチ` : "未判定";
    el.autoLaborCategory.textContent = state.autoLabor.label || "未判定";
    el.autoLaborAmount.textContent = `${window.PriceEngine.format((state.autoLabor.amount || 0) + window.PriceEngine.runFlatAmount(state.settings.vehicle))}円`;
    el.manualLaborCategory.value = state.autoLabor.selectedKey || laborSettingsForVehicle().categories[0]?.key || "";
    el.restoreAutoLabor.disabled = !state.selected.size || !state.autoLabor.autoKey;
  }

  function renderLaborInputs() {
    el.labor.querySelectorAll("[data-labor]").forEach(input => {
      input.value = state.settings.labor[input.dataset.labor] ?? 0;
    });
  }

  function persistSettings(rerun = true) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(state.settings));
    if (rerun && !el.resultGrid.querySelector(".empty-state") && !el.search.disabled) runSearch({ scroll: false });
  }

  function autoLaborText(size = state.selected.size) {
    const selected = state.autoLabor.selectedKey
      ? window.PriceEngine.autoLaborByKey(state.autoLabor.selectedKey, laborSettingsForVehicle(), size)
      : window.PriceEngine.autoLaborCategory(size, laborSettingsForVehicle());
    const inch = selected.inch || window.PriceEngine.tireInch(size);
    const amount = window.PriceEngine.autoLaborTotal(selected) + window.PriceEngine.runFlatAmount(state.settings.vehicle);
    const runFlat = window.PriceEngine.runFlatAmount(state.settings.vehicle) ? " / ランフラットあり" : "";
    return inch ? `${window.PriceEngine.vehicleLabel(state.settings.vehicle)} / ${inch}インチ / ${selected.label}${runFlat} / お買上時 ${window.PriceEngine.format(amount)}円` : "工賃区分 未判定";
  }

  function saveSettings() {
    state.settings.addition = Math.max(0, Number(el.addition.value) || 0);
    state.settings.taxRate = Math.max(0, Number(el.tax.value) || 0);
    state.settings.includeLabor = el.includeLabor.checked;
    state.settings.options.labor = el.includeLabor.checked;
    state.settings.vehicle = {
      type: state.settings.vehicle?.type === "import" ? "import" : "domestic",
      runFlat: el.runFlatTire.checked
    };
    state.settings.store = {
      name: el.storeName.value.trim() || "タイヤ館 箕輪",
      address: el.storeAddress.value.trim() || config.defaultStoreSettings.address,
      phone: el.storePhone.value.trim() || config.defaultStoreSettings.phone,
      staff: el.storeStaff.value.trim(),
      note: el.storeNote.value.trim()
    };
    el.rates.querySelectorAll("[data-brand]").forEach(input => {
      state.settings.rates[input.dataset.brand] = Math.max(0, Number(input.value) || 0);
    });
    el.labor.querySelectorAll("[data-labor]").forEach(input => {
      state.settings.labor[input.dataset.labor] = Math.max(0, Number(input.value) || 0);
    });
    updateLaborSummary();
    renderLaborCategoryOptions();
    updateAutoLaborDisplay();
    renderVehicleSettings();
    renderOptionButtons();
    if (state.currentProduct) renderQuote(state.currentProduct);
    persistSettings(true);
  }

  function resetSettings() {
    state.settings = createDefaultSettings();
    ensureRates();
    applySettings();
    renderRates();
    persistSettings(true);
  }

  function applySettings() {
    el.addition.value = state.settings.addition;
    el.tax.value = state.settings.taxRate;
    el.storeName.value = state.settings.store.name || "タイヤ館 箕輪";
    el.storeAddress.value = state.settings.store.address || config.defaultStoreSettings.address || "";
    el.storePhone.value = state.settings.store.phone || config.defaultStoreSettings.phone || "";
    el.storeStaff.value = state.settings.store.staff || "";
    el.storeNote.value = state.settings.store.note || "";
    el.includeLabor.checked = Boolean(state.settings.options?.labor);
    renderVehicleSettings();
    renderLaborInputs();
    updateAutoLaborDisplay();
    updateLaborSummary();
    renderOptionButtons();
  }

  function ensureRates() {
    state.brands.forEach(brand => state.settings.rates[brand] ??= state.settings.defaultRate);
  }

  function loadSettings() {
    try {
      const saved = JSON.parse(localStorage.getItem(SETTINGS_KEY));
      const defaults = createDefaultSettings();
      return saved ? {
        ...defaults,
        ...saved,
        rates: { ...defaults.rates, ...(saved.rates || {}) },
        labor: { ...defaults.labor, ...(saved.labor || {}) },
        store: { ...defaults.store, ...(saved.store || {}) },
        options: { ...defaults.options, ...(saved.options || {}), labor: saved.includeLabor ?? saved.options?.labor ?? true },
        customPrintItems: normalizeCustomPrintItems(saved.customPrintItems, defaults.customPrintItems),
        vehicle: { ...defaults.vehicle, ...(saved.vehicle || {}) },
        includeLabor: saved.includeLabor ?? true
      } : defaults;
    } catch {
      return createDefaultSettings();
    }
  }

  function createDefaultSettings() {
    return {
      ...config.defaultPriceSettings,
      rates: Object.fromEntries(config.preferredBrandOrder.map(brand => [brand, config.defaultPriceSettings.defaultRate])),
      labor: { ...config.defaultLaborSettings },
      store: { ...config.defaultStoreSettings },
      options: { ...config.defaultOptionSettings },
      customPrintItems: defaultCustomPrintItems(),
      vehicle: { type: "domestic", runFlat: false },
      includeLabor: true
    };
  }

  function updateLaborSummary() {
    const one = window.PriceEngine.laborPerTire(state.settings.labor) + window.PriceEngine.runFlatAmount(state.settings.vehicle);
    el.laborPerTire.textContent = window.PriceEngine.format(one);
    el.laborFourTires.textContent = window.PriceEngine.format(one * 4);
  }

  function proposalTotals(product) {
    const singlePrice = window.PriceEngine.calculate(product.cost, product.brand, state.settings);
    product.singlePrice = singlePrice;
    const tireFour = window.PriceEngine.fourTires(singlePrice);
    const optionLines = window.PriceEngine.quoteOptionLines(state.settings.labor, state.settings.options, 4, state.settings.customPrintItems, state.settings.vehicle);
    const optionTotal = optionLines.reduce((sum, line) => sum + line.total, 0);
    return {
      tireFour,
      optionLines,
      optionTotal,
      totalFour: tireFour + optionTotal
    };
  }

  function vehiclePrintText({ compact = false } = {}) {
    const vehicle = state.settings.vehicle || { type: "domestic", runFlat: false };
    const label = window.PriceEngine.vehicleLabel(vehicle);
    const runFlat = `ランフラット：${vehicle.runFlat ? "あり" : "なし"}`;
    return compact ? `${label} / ${vehicle.runFlat ? "RFあり" : "RFなし"}` : `車両区分：${label}　${runFlat}`;
  }

  function isEditingCustomPrintItem() {
    return Boolean(document.activeElement?.matches?.("#customPrintItems input, #customPrintItems textarea"));
  }

  function defaultSelectedBrands() {
    return [...state.brands];
  }

  function productKeysForBrand(brand) {
    return [...new Set(state.products
      .filter(product => product.brand === brand)
      .map(productKey))];
  }

  function setStatus(type, message) {
    el.status.className = `import-status ${type}`.trim();
    el.status.querySelector("span").textContent = message;
  }

  function openVersionDialog() {
    renderVersionInfo();
    if (el.versionDialog.showModal) el.versionDialog.showModal();
    else el.versionDialog.setAttribute("open", "");
  }

  function closeVersionDialog() {
    if (el.versionDialog.close) el.versionDialog.close();
    else el.versionDialog.removeAttribute("open");
  }

  function renderVersionInfo() {
    el.versionButton.textContent = `商談ナビ Ver ${APP_VERSION}`;
    el.versionSummerFile.textContent = state.catalogs.summer?.fileName || "未読込";
    el.versionWinterFile.textContent = state.catalogs.winter?.fileName || "未読込";
  }

  function safeScrollIntoView(target, options, enabled = true) {
    if (!enabled || isFormEditing()) return;
    target?.scrollIntoView?.(options);
  }

  function isFormEditing() {
    const active = document.activeElement;
    return Boolean(active?.matches?.("input, textarea, select, [contenteditable='true']"));
  }

  function resetResults(title, copy) {
    el.resultCount.textContent = "0件";
    el.resultMessage.textContent = state.products.length ? "条件を選択すると価格を表示します" : "価格表を読み込んでください";
    renderEmpty(title, copy);
  }

  function renderEmpty(title, copy) {
    el.resultGrid.innerHTML = `<div class="empty-state"><span class="empty-ring"></span><strong>${escapeHtml(title)}</strong><p>${escapeHtml(copy)}</p></div>`;
  }

  function uniqueProducts(field, predicate) {
    return [...new Set(state.products.filter(predicate).map(product => String(product[field])).filter(Boolean))];
  }

  function sortBrands(brands) {
    const priority = new Map(config.preferredBrandOrder.map((brand, index) => [brand.toUpperCase(), index]));
    return brands.sort((a, b) =>
      (priority.get(a.toUpperCase()) ?? 999) - (priority.get(b.toUpperCase()) ?? 999) ||
      a.localeCompare(b, "ja")
    );
  }

  function sizeSort(a, b) {
    const numbers = value => normalizeSize(value).match(/\d+/g)?.map(Number) || [];
    const aa = numbers(a), bb = numbers(b);
    for (let i = 0; i < Math.max(aa.length, bb.length); i++) {
      if ((aa[i] || 0) !== (bb[i] || 0)) return (aa[i] || 0) - (bb[i] || 0);
    }
    return a.localeCompare(b, "ja");
  }

  function formatDate(date) {
    return new Intl.DateTimeFormat("ja-JP", {
      year: "numeric", month: "2-digit", day: "2-digit"
    }).format(date);
  }

  function formatDateTime(date) {
    return formatDate(date);
  }

  function defaultCustomPrintItems() {
    return [
      { id: "alignment", label: "アライメント", value: "", enabled: true, locked: true },
      { id: "puncture", label: "パンク補償", value: "", enabled: true, locked: true },
      { id: "other-1", label: "その他1", value: "", enabled: true }
    ];
  }

  function normalizeCustomPrintItems(savedItems, defaultItems) {
    const saved = Array.isArray(savedItems) ? savedItems : [];
    const byId = new Map(saved.map(item => [item.id, item]));
    const fixed = defaultItems.filter(item => item.locked).map(item => ({ ...item, ...(byId.get(item.id) || {}), locked: true }));
    const flexible = saved
      .filter(item => item && !fixed.some(fixedItem => fixedItem.id === item.id))
      .map(item => ({
        id: item.id || `custom-${Date.now()}-${Math.random().toString(36).slice(2)}`,
        label: item.label || "",
        value: item.value || "",
        enabled: item.enabled !== false
      }));
    const otherDefault = defaultItems.find(item => item.id === "other-1");
    if (!flexible.length && otherDefault) flexible.push({ ...otherDefault });
    return [...fixed, ...flexible];
  }

  function normalizeSize(value) {
    return String(value).normalize("NFKC").toUpperCase().replace(/\s+/g, "");
  }

  function baseTireSize(value) {
    return window.CatalogParser.baseTireSize(value);
  }

  function presentationFor(brand) {
    return config.brandPresentation[brand] || config.defaultPresentation;
  }

  function applyBrandTheme(brand) {
    const theme = presentationFor(brand);
    document.documentElement.style.setProperty("--brand-accent", theme.accent);
    document.documentElement.style.setProperty("--brand-soft", theme.soft);
  }

  function escapeHtml(value) {
    return String(value).replace(/[&<>"']/g, char => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
    })[char]);
  }

  function cssEscape(value) {
    return window.CSS?.escape ? CSS.escape(value) : String(value).replace(/["\\]/g, "\\$&");
  }
})();
