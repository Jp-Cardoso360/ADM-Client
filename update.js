// Configurações iniciais
const isLocalDevelopment =
  window.location.protocol !== "file:" &&
  ["localhost", "127.0.0.1"].includes(window.location.hostname);
const urlNetixZae = isLocalDevelopment
  ? "http://localhost:3333"
  : "https://netix-zae-api.vercel.app";
const MAX_IMAGE_SIZE = 5 * 1024 * 1024;
const id_user = localStorage.getItem("id_user");
const nome = localStorage.getItem("nome");
let productsById = new Map();
let categories = [];
let pendingProductCategoryId = "";
let empresaAtual = null;
const companyImageObjectUrls = { banner: null, logo: null };
let companySettingsDirty = false;
let companyProfileLoading = false;
const sucess = document.querySelector(".sucess");
const mensagem = document.querySelector(".mensagem");
const failed = document.querySelector(".failed");
const mensagemErro = document.querySelector(".mensagemErro");

async function validateImageFile(file) {
  if (!file) return "Selecione uma imagem.";
  if (file.size > MAX_IMAGE_SIZE) return "A imagem deve ter no máximo 5 MB.";
  if (file.type && !file.type.startsWith("image/")) {
    return "O arquivo selecionado não é uma imagem.";
  }

  try {
    if (typeof createImageBitmap === "function") {
      const bitmap = await createImageBitmap(file);
      bitmap.close();
      return "";
    }

    const isValid = await new Promise((resolve) => {
      const objectUrl = URL.createObjectURL(file);
      const image = new Image();
      image.onload = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(true);
      };
      image.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(false);
      };
      image.src = objectUrl;
    });
    return isValid ? "" : "O arquivo selecionado não contém uma imagem válida.";
  } catch {
    return "O arquivo selecionado não contém uma imagem válida.";
  }
}

async function updateImageSelection(input, message) {
  const file = input.files[0];
  if (!file) {
    message.textContent = "";
    message.classList.remove("is-visible", "is-error");
    return;
  }

  message.textContent = "Validando imagem...";
  message.classList.add("is-visible");
  message.classList.remove("is-error");
  const error = await validateImageFile(file);
  if (input.files[0] !== file) return;

  if (error) {
    input.value = "";
    message.textContent = error;
    message.classList.add("is-visible", "is-error");
    return;
  }

  message.textContent = file.name;
  message.classList.add("is-visible");
  message.classList.remove("is-error");
}

async function uploadProductImage(file) {
  const formData = new FormData();
  formData.append("imagem", file);
  formData.append("empresaId", id_user);

  const response = await fetch(`${urlNetixZae}/upload`, {
    method: "POST",
    body: formData,
  });

  const result = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(result.mensagem || result.message || `Erro no upload: ${response.status}`);
  }
  if (!result.url) throw new Error("A API não retornou a URL da imagem.");
  return result.url;
}

const createImageInput = document.getElementById("linkImg");
if (createImageInput) {
  createImageInput.addEventListener("change", () => {
    updateImageSelection(createImageInput, document.querySelector(".new-product-message"));
  });
}

const updateImageInput = document.getElementById("att-thumbnail");
if (updateImageInput) {
  updateImageInput.addEventListener("change", () => {
    updateImageSelection(updateImageInput, document.getElementById("att-image-message"));
  });
}

const companySettings = document.querySelector(".company-settings");
const companySettingsForm = document.getElementById("company-settings-form");
const companyBannerInput = document.getElementById("company-banner");
const companyLogoInput = document.getElementById("company-logo");
const companyProfileStatus = document.querySelector(".company-profile-status");
const companyWeekdays = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const defaultCompanyHours = companyWeekdays.map((_, diaSemana) => ({
  diaSemana,
  ativo: false,
  abertura: "09:00",
  fechamento: "18:00",
}));

function setCompanyMessage(text, state = "") {
  const message = document.querySelector(".company-settings-message");
  message.textContent = text;
  message.dataset.state = state;
}

function normalizedSystemColor(color) {
  const value = typeof color === "string" ? color.trim() : "";
  if (/^#[0-9a-fA-F]{6}$/.test(value)) return value;
  if (/^#[0-9a-fA-F]{3}$/.test(value)) {
    return `#${value[1]}${value[1]}${value[2]}${value[2]}${value[3]}${value[3]}`;
  }
  return "#2ECC71";
}

function companyBannerUrl(user) {
  return user.banner || user.banner_url || user.bannerUrl || "";
}

function companyLogoUrl(user) {
  return user.logo || user.logo_url || user.logoUrl || "";
}

function showCompanyImagePreview(source, imageSelector, emptySelector, objectUrlKey) {
  if (companyImageObjectUrls[objectUrlKey]) {
    URL.revokeObjectURL(companyImageObjectUrls[objectUrlKey]);
    companyImageObjectUrls[objectUrlKey] = null;
  }

  const preview = document.querySelector(imageSelector);
  const emptyMessage = document.querySelector(emptySelector);
  preview.hidden = !source;
  emptyMessage.hidden = Boolean(source);
  preview.src = source || "";
}

function parseCompanyHours(value) {
  if (typeof value === "string" && value.trim()) {
    try {
      value = JSON.parse(value);
    } catch {
      throw new Error("Os horários de funcionamento retornados pela API são inválidos.");
    }
  }
  if (!Array.isArray(value) || value.length === 0) return defaultCompanyHours.map((day) => ({ ...day }));

  return defaultCompanyHours.map((fallback, diaSemana) => {
    const existing = value.find((day) => day && Number(day.diaSemana) === diaSemana);
    if (!existing) return { ...fallback };
    return {
      diaSemana,
      ativo: existing.ativo === true,
      abertura: isValidCompanyTime(existing.abertura) ? existing.abertura : fallback.abertura,
      fechamento: isValidCompanyTime(existing.fechamento) ? existing.fechamento : fallback.fechamento,
    };
  });
}

function isValidCompanyTime(value) {
  return typeof value === "string" && /^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value);
}

function renderCompanyHours(value) {
  const days = parseCompanyHours(value);
  const list = document.querySelector(".company-hours-list");
  list.replaceChildren();

  days.forEach((day, index) => {
    const row = document.createElement("div");
    row.className = "company-hours-row";
    row.innerHTML = `
      <label class="company-hours-day" for="company-hours-active-${index}">
        <input type="checkbox" id="company-hours-active-${index}" data-day="${index}" ${day.ativo ? "checked" : ""} />
        <span>${companyWeekdays[index]}</span>
      </label>
      <div class="company-hours-time">
        <label for="company-hours-opening-${index}">Abertura</label>
        <input type="time" id="company-hours-opening-${index}" data-opening="${index}" value="${day.abertura}" ${day.ativo ? "" : "disabled"} />
      </div>
      <div class="company-hours-time">
        <label for="company-hours-closing-${index}">Fechamento</label>
        <input type="time" id="company-hours-closing-${index}" data-closing="${index}" value="${day.fechamento}" ${day.ativo ? "" : "disabled"} />
      </div>
    `;
    row.querySelector(`[data-day="${index}"]`).addEventListener("change", (event) => {
      row.querySelectorAll('input[type="time"]').forEach((input) => {
        input.disabled = !event.currentTarget.checked;
      });
    });
    list.append(row);
  });
}

function collectCompanyHours() {
  return companyWeekdays.map((_, diaSemana) => ({
    diaSemana,
    ativo: document.getElementById(`company-hours-active-${diaSemana}`).checked,
    abertura: document.getElementById(`company-hours-opening-${diaSemana}`).value,
    fechamento: document.getElementById(`company-hours-closing-${diaSemana}`).value,
  }));
}

function fillCompanySettings(user) {
  document.getElementById("company-name").value = user.nome || "";
  document.getElementById("company-color").value = normalizedSystemColor(user.corSistema);
  document.getElementById("company-about").value = user.sobre || "";
  showCompanyImagePreview(companyBannerUrl(user), ".company-banner-preview", ".company-banner-empty", "banner");
  showCompanyImagePreview(companyLogoUrl(user), ".company-logo-preview", ".company-logo-empty", "logo");
  companyBannerInput.value = "";
  companyLogoInput.value = "";
  document.querySelector(".company-banner-message").textContent = "";
  document.querySelector(".company-logo-message").textContent = "";
  renderCompanyHours(user.horariosFuncionamento);
  companySettingsDirty = false;
  setCompanyMessage("");
}

const openCompanySettingsButton = document.querySelector(".edit-company");
if (openCompanySettingsButton && companySettings) {
  openCompanySettingsButton.disabled = true;
  openCompanySettingsButton.addEventListener("click", () => {
    companySettings.classList.add("is-open");
    companySettings.setAttribute("aria-hidden", "false");
    document.body.classList.add("company-settings-active");
    if (empresaAtual) {
      fillCompanySettings(empresaAtual);
      document.getElementById("company-name").focus();
    } else {
      setCompanyMessage(companyProfileLoading ? "Carregando configurações..." : "Não foi possível carregar os dados da loja.", companyProfileLoading ? "loading" : "error");
    }
  });
}

const closeCompanySettingsButton = document.querySelector(".company-settings-close");
function closeCompanySettingsModal() {
  if (companySettingsDirty && !window.confirm("Há alterações não salvas. Deseja descartá-las?")) return;
  companySettingsDirty = false;
  companySettings.classList.remove("is-open");
  companySettings.setAttribute("aria-hidden", "true");
  document.body.classList.remove("company-settings-active");
  openCompanySettingsButton?.focus();
}

if (closeCompanySettingsButton && companySettings) {
  closeCompanySettingsButton.addEventListener("click", closeCompanySettingsModal);
  companySettings.addEventListener("click", (event) => {
    if (event.target === companySettings) closeCompanySettingsModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && companySettings.classList.contains("is-open")) {
      closeCompanySettingsModal();
    }
  });
}

if (companySettingsForm) {
  companySettingsForm.addEventListener("input", () => {
    companySettingsDirty = true;
  });
  companySettingsForm.addEventListener("change", () => {
    companySettingsDirty = true;
  });
  window.addEventListener("beforeunload", (event) => {
    if (!companySettingsDirty || !companySettings.classList.contains("is-open")) return;
    event.preventDefault();
    event.returnValue = "";
  });
}

async function handleCompanyImageSelection(input, messageSelector, imageSelector, emptySelector, objectUrlKey, urlGetter) {
  const file = input.files[0];
  const message = document.querySelector(messageSelector);
  if (!file) {
    message.textContent = "";
    message.classList.remove("is-error");
    showCompanyImagePreview(urlGetter(empresaAtual || {}), imageSelector, emptySelector, objectUrlKey);
    return;
  }

  message.textContent = "Validando imagem...";
  message.classList.remove("is-error");
  const imageError = await validateImageFile(file);
  if (input.files[0] !== file) return;
  if (imageError) {
    input.value = "";
    message.textContent = imageError;
    message.classList.add("is-error");
    showCompanyImagePreview(urlGetter(empresaAtual || {}), imageSelector, emptySelector, objectUrlKey);
    return;
  }

  message.textContent = file.name;
  message.classList.remove("is-error");
  if (companyImageObjectUrls[objectUrlKey]) URL.revokeObjectURL(companyImageObjectUrls[objectUrlKey]);
  companyImageObjectUrls[objectUrlKey] = URL.createObjectURL(file);
  const preview = document.querySelector(imageSelector);
  preview.src = companyImageObjectUrls[objectUrlKey];
  preview.hidden = false;
  document.querySelector(emptySelector).hidden = true;
}

if (companyBannerInput) {
  companyBannerInput.addEventListener("change", () => handleCompanyImageSelection(
    companyBannerInput,
    ".company-banner-message",
    ".company-banner-preview",
    ".company-banner-empty",
    "banner",
    companyBannerUrl,
  ));
}

if (companyLogoInput) {
  companyLogoInput.addEventListener("change", () => handleCompanyImageSelection(
    companyLogoInput,
    ".company-logo-message",
    ".company-logo-preview",
    ".company-logo-empty",
    "logo",
    companyLogoUrl,
  ));
}

if (companySettingsForm) {
  companySettingsForm.addEventListener("submit", salvarDadosEmpresa);
}

fecharSucess = () => {
  sucess.style.display = "none";
};

function mostrarSucesso(text) {
  mensagem.textContent = text;
  sucess.style.display = "flex";
};
fecharFailed = () => {
  failed.style = "display:none";
};

async function logar(event) {
  event.preventDefault();

  const email = document.getElementById("email").value;
  const senha = document.getElementById("password").value;
  const load = document.querySelector(".load");
  const mgsLogin = document.querySelector(".mgsLogin");
  const resLogin = document.querySelector(".resLogin");

  if (email === "" || senha === "") {
    resLogin.innerHTML = "Preencha todos os campos";
    setTimeout(() => {
      resLogin.innerHTML = "";
    }, 2000);
    return;
  }

  try {
    load.style = "display:flex;";
    mgsLogin.style = "display:none;";

    const req = await fetch(`${urlNetixZae}/carrinho/login/users`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        email: email,
        senha: senha,
      }),
    });
    const res = await req.json();

    if (req.ok) {
      document.querySelector(".ok").style = "display:flex";
      load.style = "display:none;";
      mgsLogin.style = "display:none;";
      localStorage.setItem("id_user", res.userId);
      localStorage.setItem("nome", res.nome);
      setInterval(() => {
        window.location.href = "atualizar.html";
      }, 1000);
    } else {
      resLogin.innerHTML = res.mensagem || "Erro inesperado.";
      load.style = "display:none;";
      mgsLogin.style = "display:flex;";
      setTimeout(() => {
        resLogin.innerHTML = "";
      }, 4000);
    }
  } catch (error) {
    console.error("Erro capturado:", error);
    load.style = "display:none;";
    mgsLogin.style = "display:flex;";
    alert("Erro ao tentar logar. Por favor, tente novamente.");
  }
}

async function fetchProducts() {
  const load = document.getElementById("loading");
  const container = document.querySelector(".conteiner-produtos-att");

  try {
    const now = Date.now();
    const cacheKey = `products:${id_user}`;
    const cached = JSON.parse(localStorage.getItem(cacheKey));

    if (cached && now - cached.timestamp < 3000) {
      console.log("Usando cache.");
      renderProducts(cached.data);
      load.style = "display:none";
      return;
    }

    console.log("Buscando dados da API...");
    const response = await fetch(`${urlNetixZae}/dashboard/${id_user}`);
    let products = await response.json();

    localStorage.setItem(cacheKey, JSON.stringify({ data: products, timestamp: now }));

    renderProducts(products);

    load.style = "display:none";
  } catch (error) {
    console.error("Erro ao buscar os produtos:", error);
    load.style = "display:none";
  }
}

function renderProducts(products) {
  const container = document.querySelector(".conteiner-produtos-att");
  productsById = new Map(products.map((product) => [product._id ?? product.id, product]));
  container.replaceChildren();
  const productsByCategory = new Map(categories.map((category) => [category.id, []]));
  const uncategorizedProducts = [];

  products.forEach((product, order) => {
    const categoryId = String(product.categoriaId ?? product.categoryId ?? "");
    const group = productsByCategory.get(categoryId);
    const orderedProduct = { product, order };
    if (group) group.push(orderedProduct);
    else uncategorizedProducts.push(orderedProduct);
  });

  categories.forEach((category) => {
    const orderedProducts = productsByCategory.get(category.id)
      .sort((first, second) => first.order - second.order)
      .map(({ product }) => product);
    renderProductGroup(container, category.name, orderedProducts);
  });
  if (uncategorizedProducts.length) {
    const orderedProducts = uncategorizedProducts
      .sort((first, second) => first.order - second.order)
      .map(({ product }) => product);
    renderProductGroup(container, "Sem categoria", orderedProducts);
  }
const meuSistema = document.querySelector(".meuSistema");

async function abrirMeuCatalogo() {
  try {
    const userId = localStorage.getItem("id_user");

    if (!userId) {
      throw new Error("ID do comerciante não encontrado.");
    }

    const resposta = await fetch(
      `${urlNetixZae}/sessions-list-counts`
    );

    if (!resposta.ok) {
      throw new Error("Erro ao buscar empresas.");
    }

    const empresas = await resposta.json();

    const minhaEmpresa = empresas.find(
      empresa => empresa._id === userId
    );

    if (minhaEmpresa?.slug) {
      document.querySelector(".meuSistema").href =
        `https://conectazap-lojas.vercel.app/${minhaEmpresa.slug}`;
    } else {
      console.error("Empresa ou slug não encontrado.");
    }
  } catch (erro) {
    console.error("Erro ao carregar catálogo:", erro);
  }
}

abrirMeuCatalogo();

 
}

function renderProductGroup(container, title, products) {
  const section = document.createElement("section");
  section.className = "product-category-section";

  const heading = document.createElement("h3");
  heading.textContent = title;

  const productList = document.createElement("div");
  productList.className = "category-products";
  if (!products.length) {
    const emptyMessage = document.createElement("p");
    emptyMessage.className = "category-empty-message";
    emptyMessage.textContent = "Nenhum produto nesta categoria.";
    productList.append(emptyMessage);
  }

  products.forEach((product) => {
    const card = document.createElement("article");
    card.className = "product";

    const image = document.createElement("img");
    image.src = product.thumbnail_url || product.thumbnail || "";
    image.alt = product.description || "Imagem do produto";
    image.loading = "lazy";

    const description = document.createElement("p");
    description.className = "description";
    description.textContent = product.description || "";

    const price = document.createElement("p");
    price.className = "prince";
    const priceValue = document.createElement("strong");
    const parsedPrice = Number(product.price);
    priceValue.textContent = `R$ ${Number.isFinite(parsedPrice) ? parsedPrice.toFixed(2).replace(".", ",") : "0,00"}`;
    price.append(priceValue);

    const actions = document.createElement("div");
    actions.className = "btn";
    const statusButton = document.createElement("button");
    statusButton.type = "button";
    statusButton.className = product.status ? "btn-pausar" : "btn-ativar";
    statusButton.textContent = product.status ? "Pausar" : "Ativar";
    statusButton.addEventListener("click", () => toggleProductStatus(product.id ?? product._id, product.status));

    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "product-edit-button";
    editButton.setAttribute("aria-label", `Editar ${product.description || "produto"}`);
    const editIcon = document.createElement("i");
    editIcon.className = "fa-solid fa-pen";
    editIcon.setAttribute("aria-hidden", "true");
    editButton.append(editIcon);
    editButton.addEventListener("click", () => openEdit(product._id ?? product.id));

    actions.append(statusButton, editButton);
    card.append(image, description, price, actions);
    productList.append(card);
  });

  section.append(heading, productList);
  container.append(section);
}

async function toggleProductStatus(productId, currentStatus) {
  try {
    const newStatus = !currentStatus;

    const response = await fetch(`${urlNetixZae}/atualizar/${productId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        user_id: id_user,
      },
      body: JSON.stringify({
        status: newStatus,
      }),
    });

    if (response.ok) {
      mostrarSucesso(`Produto ${
        newStatus ? "ativado" : "pausado"
      } com sucesso!`);
      fetchProducts();
      buscarDisponiveis();
    } else {
      console.error(
        "Erro ao atualizar o status do produto:",
        await response.text()
      );
      failed.style = "display:flex";
      mensagemErro.innerHTML =
        "Não foi possível atualizar o status do produto.";
    }
  } catch (error) {
    failed.style = "display:flex";
    mensagemErro.innerHTML = "Erro de conexão. Tente novamente.";
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.querySelector(".conteiner-produtos-att")) return;
  if (!id_user) {
    window.location.href = "index.html";
    return;
  }

  carregarPerfilUsuario();
  fetchProducts();
  loadCategories().catch((error) => {
    document.querySelector(".category-feedback").textContent = `Não foi possível carregar as categorias: ${error.message}`;
  });
  buscarDisponiveis();
});

async function carregarPerfilUsuario() {
  companyProfileLoading = true;
  if (companyProfileStatus) {
    companyProfileStatus.textContent = "Carregando configurações da loja...";
    companyProfileStatus.dataset.state = "loading";
    companyProfileStatus.hidden = false;
  }
  setCompanyMessage("Carregando configurações...", "loading");
  try {
    const response = await fetch(`${urlNetixZae}/sessions-list-counts`);
    if (!response.ok) throw new Error(`Erro na API: ${response.status}`);

    const users = await response.json();
    const user = users.find((item) => item._id === id_user);
    if (!user) throw new Error("Usuário não encontrado.");
    empresaAtual = user;
    fillCompanySettings(user);
    if (openCompanySettingsButton) openCompanySettingsButton.disabled = false;
    if (companyProfileStatus) companyProfileStatus.hidden = true;
    if (companySettings.classList.contains("is-open")) document.getElementById("company-name").focus();

    const corSistema = normalizedSystemColor(user.corSistema);

    document.documentElement.style.setProperty("--system-primary-color", corSistema);
    document.querySelector(".name").textContent = `Olá, ${user.nome || nome || "usuário"}`;
  } catch (error) {
    console.error("Erro ao carregar o perfil do usuário:", error);
    const message = error.message || "Não foi possível carregar as configurações da loja.";
    setCompanyMessage(message, "error");
    if (companyProfileStatus) {
      companyProfileStatus.textContent = `Não foi possível carregar as configurações: ${message}`;
      companyProfileStatus.dataset.state = "error";
      companyProfileStatus.hidden = false;
    }
  } finally {
    companyProfileLoading = false;
  }
}

async function salvarDadosEmpresa(event) {
  event.preventDefault();
  const saveButton = document.querySelector(".company-settings-save");
  if (!empresaAtual) {
    setCompanyMessage("Os dados da empresa ainda não foram carregados.", "error");
    return;
  }
  const bannerFile = companyBannerInput.files[0];
  const logoFile = companyLogoInput.files[0];
  const companyName = document.getElementById("company-name").value.trim();
  const systemColor = document.getElementById("company-color").value;
  const about = document.getElementById("company-about").value.trim();
  const hours = collectCompanyHours();

  if (!companyName) {
    setCompanyMessage("Informe o nome da empresa.", "error");
    return;
  }

  for (const day of hours) {
    if (!day.ativo) continue;
    if (!isValidCompanyTime(day.abertura) || !isValidCompanyTime(day.fechamento)) {
      setCompanyMessage(`Informe horários válidos para ${companyWeekdays[day.diaSemana]} (HH:mm).`, "error");
      return;
    }
    if (day.fechamento < day.abertura) {
      setCompanyMessage(`O fechamento de ${companyWeekdays[day.diaSemana]} não pode ser anterior à abertura.`, "error");
      return;
    }
  }

  const existingHours = parseCompanyHours(empresaAtual.horariosFuncionamento);
  const hoursChanged = JSON.stringify(hours) !== JSON.stringify(existingHours);
  const nameChanged = companyName !== (empresaAtual.nome || "");
  const colorChanged = systemColor.toLowerCase() !== normalizedSystemColor(empresaAtual.corSistema).toLowerCase();
  const aboutChanged = about !== (empresaAtual.sobre || "");
  if (!nameChanged && !colorChanged && !aboutChanged && !hoursChanged && !bannerFile && !logoFile) {
    setCompanyMessage("Não há alterações para salvar.", "error");
    return;
  }

  saveButton.disabled = true;
  try {
    const formData = new FormData();
    formData.append("nome", companyName);
    formData.append("corSistema", systemColor);
    formData.append("sobre", about);
    formData.append("horariosFuncionamento", JSON.stringify(hours));

    if (bannerFile) {
      setCompanyMessage("Validando banner...", "loading");
      const imageError = await validateImageFile(bannerFile);
      if (imageError) throw new Error(imageError);
      formData.append("banner", bannerFile);
    }
    if (logoFile) {
      setCompanyMessage("Validando logo...", "loading");
      const imageError = await validateImageFile(logoFile);
      if (imageError) throw new Error(imageError);
      formData.append("logo", logoFile);
    }

    setCompanyMessage(bannerFile || logoFile ? "Enviando alterações e imagens..." : "Salvando alterações...", "loading");
    const response = await fetch(`${urlNetixZae}/users/${id_user}`, {
      method: "PUT",
      headers: {
        user_id: id_user,
      },
      body: formData,
    });
    const result = await response.json().catch(() => ({}));
    if (!response.ok || result.ok !== true || !result.user) {
      throw new Error(result.mensagem || result.message || `Erro ao atualizar empresa: ${response.status}`);
    }

    empresaAtual = { ...empresaAtual, ...result.user };
    localStorage.setItem("nome", empresaAtual.nome || companyName);
    document.querySelector(".name").textContent = `Olá, ${empresaAtual.nome || nome || "usuário"}`;
    const updatedColor = normalizedSystemColor(empresaAtual.corSistema);
    document.documentElement.style.setProperty("--system-primary-color", updatedColor);
    fillCompanySettings(empresaAtual);
    companySettings.classList.remove("is-open");
    companySettings.setAttribute("aria-hidden", "true");
    document.body.classList.remove("company-settings-active");
    mostrarSucesso("Dados da empresa atualizados com sucesso!");
  } catch (error) {
    console.error("Erro ao atualizar dados da empresa:", error);
    setCompanyMessage(error.message || "Não foi possível atualizar os dados da empresa.", "error");
  } finally {
    saveButton.disabled = false;
  }
}

async function buscarDisponiveis() {
  try {
    const response = await fetch(`${urlNetixZae}/dashboard/${id_user}`);
    if (!response.ok) {
      throw new Error("Erro ao buscar informações da API");
    }

    const trueAndFalse = await response.json();

    const totalTrue = trueAndFalse.reduce((contador, item) => {
      return item.status ? contador + 1 : contador;
    }, 0);

    const totalFalse = trueAndFalse.reduce((contador, item) => {
      return !item.status ? contador + 1 : contador;
    }, 0);

    document.querySelector(
      ".disponivel"
    ).innerHTML = `Disponível<br> ${totalTrue}`;
    document.querySelector(
      ".pausados"
    ).innerHTML = `Pausados<br> ${totalFalse}`;
  } catch (error) {
    console.error("Erro:", error.message);
  }
}

let addonGroups = [];
let addonGroupsLoaded = false;
let addonGroupProducts = [];
let isSavingAddonGroup = false;

function getAddonGroupId(group) {
  const id = group?._id ?? group?.id;
  return id === undefined || id === null ? "" : String(id);
}

function normalizeAddonGroup(value) {
  if (!value || typeof value !== "object") return null;
  const id = getAddonGroupId(value);
  const titulo = value.titulo ?? value.title ?? value.name ?? value.nome;
  if (!id || typeof titulo !== "string" || !titulo.trim()) return null;
  const min = Number(value.min ?? 0);
  const max = Number(value.max ?? 1);
  if (!Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < min) return null;
  return {
    id,
    titulo: titulo.trim(),
    obrigatorio: Boolean(value.obrigatorio ?? value.required),
    min,
    max,
    itens: Array.isArray(value.itens) ? value.itens : Array.isArray(value.items) ? value.items : [],
  };
}

function addonGroupResponseValues(body) {
  if (Array.isArray(body)) return body;
  return body?.groups ?? body?.addonGroups ?? body?.gruposAdicionais ?? body?.data;
}

function extractAddonGroupIds(product) {
  const groups = product.gruposAdicionaisIds ?? product.gruposAdicionais ?? product.addonGroupIds ?? [];
  if (!Array.isArray(groups)) return [];
  return groups
    .map((group) => (typeof group === "object" && group !== null ? getAddonGroupId(group) : String(group)))
    .filter(Boolean);
}

function renderProductAddonSelector(container, selectedIds = []) {
  if (!container) return;
  container.replaceChildren();
  const selected = new Set(selectedIds.map(String));
  if (!addonGroups.length) {
    const empty = document.createElement("p");
    empty.className = "addon-selector-empty";
    empty.textContent = addonGroupsLoaded
      ? "Nenhum grupo cadastrado. Crie grupos em “Meus Grupos de Adicionais”."
      : "Carregando grupos de adicionais...";
    container.append(empty);
    return;
  }

  addonGroups.forEach((group) => {
    const label = document.createElement("label");
    label.className = "product-addon-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "gruposAdicionaisIds";
    checkbox.value = group.id;
    checkbox.checked = selected.has(group.id);
    const content = document.createElement("span");
    const title = document.createElement("strong");
    title.textContent = group.titulo;
    const rules = document.createElement("small");
    rules.textContent = `${group.obrigatorio ? "Obrigatório" : "Opcional"} · mínimo ${group.min} · máximo ${group.max}`;
    content.append(title, rules);
    label.append(checkbox, content);
    container.append(label);
  });
}

function collectSelectedAddonGroupIds(container) {
  return [...container.querySelectorAll('input[name="gruposAdicionaisIds"]:checked')].map((input) => input.value);
}

async function loadAddonGroups() {
  if (!hasCurrentUser()) throw new Error("Selecione um cliente válido para carregar grupos de adicionais.");
  const response = await fetch(`${urlNetixZae}/addon-groups`, {
    headers: { user_id: id_user },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(categoryApiError(body, response.status));
  const values = addonGroupResponseValues(body);
  if (!Array.isArray(values)) throw new Error("Resposta inválida ao carregar grupos de adicionais.");
  const normalized = values.map(normalizeAddonGroup);
  if (normalized.some((group) => !group)) throw new Error("A API retornou um grupo sem ID ou título válido.");
  addonGroups = normalized;
  addonGroupsLoaded = true;
  renderAddonGroupList();
  renderAddonGroupSelect();
  return addonGroups;
}

function renderAddonGroupList() {
  const list = document.querySelector(".global-addon-list");
  if (!list) return;
  list.replaceChildren();
  if (!addonGroups.length) {
    const empty = document.createElement("li");
    empty.className = "addon-list-empty";
    empty.textContent = "Você ainda não cadastrou grupos de adicionais.";
    list.append(empty);
    return;
  }

  addonGroups.forEach((group) => {
    const row = document.createElement("li");
    row.className = "global-addon-card";
    const content = document.createElement("div");
    content.className = "global-addon-content";
    const title = document.createElement("h3");
    title.textContent = group.titulo;
    const rules = document.createElement("p");
    rules.textContent = `${group.obrigatorio ? "Obrigatório" : "Opcional"} · mínimo ${group.min} · máximo ${group.max}`;
    const items = document.createElement("ul");
    items.className = "global-addon-items";
    group.itens.forEach((item) => {
      const itemRow = document.createElement("li");
      const itemName = item.nome ?? item.name ?? "Item sem nome";
      const itemPrice = Number(item.preco ?? item.price ?? 0);
      itemRow.textContent = `${itemName} · ${Number.isFinite(itemPrice) ? itemPrice.toLocaleString("pt-BR", { style: "currency", currency: "BRL" }) : "Preço inválido"}${item.disponivel === false || item.available === false ? " · indisponível" : ""}`;
      items.append(itemRow);
    });
    content.append(title, rules, items);
    const actions = document.createElement("div");
    actions.className = "global-addon-actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.textContent = "Editar";
    editButton.addEventListener("click", () => openAddonGroupEditor(group));
    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "global-addon-delete";
    deleteButton.textContent = "Excluir";
    deleteButton.addEventListener("click", () => deleteAddonGroup(group, deleteButton));
    actions.append(editButton, deleteButton);
    row.append(content, actions);
    list.append(row);
  });
}

function renderAddonGroupSelect() {
  const select = document.getElementById("addon-link-group");
  if (!select) return;
  const selectedId = select.value;
  select.replaceChildren(new Option("Selecione um grupo", ""));
  addonGroups.forEach((group) => select.add(new Option(group.titulo, group.id)));
  select.value = addonGroups.some((group) => group.id === selectedId) ? selectedId : "";
}

function renderProductAddonGroups(container, selectedIds = []) {
  renderProductAddonSelector(container, selectedIds);
}

function setAddonManagerFeedback(message, isError = false) {
  const feedback = document.querySelector(".addon-manager-feedback");
  feedback.textContent = message;
  feedback.dataset.state = isError ? "error" : "success";
}

function addAddonEditorItem(item = {}) {
  const container = document.querySelector(".addon-editor-items");
  const row = document.createElement("div");
  row.className = "addon-editor-item";
  const nameLabel = document.createElement("label");
  nameLabel.textContent = "Nome do item";
  const name = document.createElement("input");
  name.type = "text";
  name.className = "addon-editor-item-name";
  name.value = item.nome ?? item.name ?? "";
  name.placeholder = "Ex.: Catupiry";
  name.required = true;
  nameLabel.append(name);

  const priceLabel = document.createElement("label");
  priceLabel.textContent = "Preço adicional (R$)";
  const price = document.createElement("input");
  price.type = "number";
  price.className = "addon-editor-item-price";
  price.min = "0";
  price.step = "0.01";
  price.value = item.preco ?? item.price ?? 0;
  price.required = true;
  priceLabel.append(price);

  const availableLabel = document.createElement("label");
  availableLabel.className = "addon-editor-checkbox";
  const available = document.createElement("input");
  available.type = "checkbox";
  available.className = "addon-editor-item-available";
  available.checked = item.disponivel !== false && item.available !== false;
  availableLabel.append(available, document.createTextNode("Disponível"));

  const remove = document.createElement("button");
  remove.type = "button";
  remove.className = "addon-editor-remove-item";
  remove.setAttribute("aria-label", "Remover item");
  remove.innerHTML = '<i class="fa-solid fa-trash" aria-hidden="true"></i>';
  remove.addEventListener("click", () => row.remove());
  row.append(nameLabel, priceLabel, availableLabel, remove);
  container.append(row);
}

function resetAddonGroupEditor() {
  const form = document.getElementById("addon-group-form");
  form.reset();
  document.getElementById("addon-group-id").value = "";
  document.getElementById("addon-group-min").value = "0";
  document.getElementById("addon-group-max").value = "1";
  document.querySelector(".addon-editor-items").replaceChildren();
  document.querySelector(".addon-editor-title").textContent = "Novo grupo";
  document.querySelector(".addon-editor-save").textContent = "Salvar grupo";
  document.querySelector(".addon-editor-feedback").textContent = "";
  form.hidden = false;
  document.getElementById("addon-group-title").focus();
}

function openAddonGroupEditor(group) {
  resetAddonGroupEditor();
  if (!group) return;
  document.getElementById("addon-group-id").value = group.id;
  document.getElementById("addon-group-title").value = group.titulo;
  document.getElementById("addon-group-required").checked = group.obrigatorio;
  document.getElementById("addon-group-min").value = group.min;
  document.getElementById("addon-group-max").value = group.max;
  group.itens.forEach(addAddonEditorItem);
  document.querySelector(".addon-editor-title").textContent = "Editar grupo";
  document.querySelector(".addon-editor-save").textContent = "Salvar alterações";
}

function collectAddonGroupEditor() {
  const titulo = document.getElementById("addon-group-title").value.trim();
  const minValue = document.getElementById("addon-group-min").value;
  const maxValue = document.getElementById("addon-group-max").value;
  const min = Number(minValue);
  const max = Number(maxValue);
  if (!titulo) throw new Error("Informe o título do grupo.");
  if (!minValue || !maxValue || !Number.isInteger(min) || !Number.isInteger(max) || min < 0 || max < 0) {
    throw new Error("Informe mínimo e máximo como números inteiros iguais ou maiores que zero.");
  }
  if (min > max) throw new Error("O mínimo não pode ser maior que o máximo.");
  const itens = [...document.querySelectorAll(".addon-editor-item")].map((row, index) => {
    const nome = row.querySelector(".addon-editor-item-name").value.trim();
    const precoValue = row.querySelector(".addon-editor-item-price").value;
    const preco = Number(precoValue);
    if (!nome) throw new Error(`Informe o nome do item ${index + 1}.`);
    if (!precoValue || !Number.isFinite(preco) || preco < 0) throw new Error(`Informe um preço válido para "${nome}".`);
    return {
      nome,
      preco,
      disponivel: row.querySelector(".addon-editor-item-available").checked,
    };
  });
  return {
    titulo,
    obrigatorio: document.getElementById("addon-group-required").checked,
    min,
    max,
    itens,
  };
}

async function deleteAddonGroup(group, button) {
  if (isSavingAddonGroup || !window.confirm(`Excluir o grupo "${group.titulo}"?`)) return;
  button.disabled = true;
  try {
    const response = await fetch(`${urlNetixZae}/addon-groups/${encodeURIComponent(group.id)}`, {
      method: "DELETE",
      headers: { user_id: id_user },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(categoryApiError(body, response.status));
    await loadAddonGroups();
    setAddonManagerFeedback(`Grupo "${group.titulo}" excluído.`);
  } catch (error) {
    setAddonManagerFeedback(`Não foi possível excluir o grupo: ${error.message}`, true);
  } finally {
    button.disabled = false;
  }
}

const addonGroupManager = document.getElementById("addon-group-manager");
const manageAddonGroupsButton = document.querySelector(".manage-addon-groups");
const addonGroupForm = document.getElementById("addon-group-form");
const addonLinkForm = document.getElementById("addon-link-form");
const addonLinkFeedback = document.querySelector(".addon-link-feedback");

function renderAddonProductChecklist() {
  const container = document.querySelector(".addon-product-checklist");
  container.replaceChildren();
  if (!addonGroupProducts.length) {
    const empty = document.createElement("p");
    empty.textContent = "Nenhum produto encontrado.";
    container.append(empty);
    return;
  }
  addonGroupProducts.forEach((product) => {
    const id = String(product._id ?? product.id ?? "");
    if (!id) return;
    const label = document.createElement("label");
    label.className = "addon-product-option";
    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.name = "addon-product-id";
    checkbox.value = id;
    const name = document.createElement("span");
    name.textContent = product.description ?? product.name ?? "Produto sem nome";
    label.append(checkbox, name);
    container.append(label);
  });
}

async function loadAddonLinkProducts() {
  const response = await fetch(`${urlNetixZae}/dashboard/${id_user}`);
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(categoryApiError(body, response.status));
  if (!Array.isArray(body)) throw new Error("Resposta inválida ao carregar produtos.");
  addonGroupProducts = body;
  productsById = new Map(body.map((product) => [String(product._id ?? product.id), product]));
  renderAddonProductChecklist();
}

async function openAddonGroupManager() {
  if (!hasCurrentUser()) return;
  addonGroupManager.classList.add("is-open");
  addonGroupManager.setAttribute("aria-hidden", "false");
  document.querySelector(".addon-editor-feedback").textContent = "";
  document.getElementById("addon-group-form").hidden = true;
  setAddonManagerFeedback("Carregando grupos...");
  try {
    const results = await Promise.all([loadAddonGroups(), loadAddonLinkProducts()]);
    renderAddonProductChecklist();
    setAddonManagerFeedback(`${results[0].length} grupo(s) carregado(s).`);
  } catch (error) {
    setAddonManagerFeedback(`Não foi possível carregar os dados: ${error.message}`, true);
  }
}

function closeAddonGroupManager() {
  addonGroupManager.classList.remove("is-open");
  addonGroupManager.setAttribute("aria-hidden", "true");
  manageAddonGroupsButton?.focus();
}

if (manageAddonGroupsButton && addonGroupManager) {
  manageAddonGroupsButton.addEventListener("click", openAddonGroupManager);
  document.querySelector(".addon-manager-close").addEventListener("click", closeAddonGroupManager);
  addonGroupManager.addEventListener("click", (event) => {
    if (event.target === addonGroupManager) closeAddonGroupManager();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && addonGroupManager.classList.contains("is-open")) closeAddonGroupManager();
  });
}

document.querySelector(".addon-new-group")?.addEventListener("click", () => openAddonGroupEditor());
document.querySelector(".addon-editor-add-item")?.addEventListener("click", () => addAddonEditorItem());
document.querySelector(".addon-editor-cancel")?.addEventListener("click", () => {
  addonGroupForm.hidden = true;
  addonGroupForm.reset();
});

addonGroupForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (isSavingAddonGroup) return;
  const feedback = document.querySelector(".addon-editor-feedback");
  let payload;
  try {
    payload = collectAddonGroupEditor();
  } catch (error) {
    feedback.textContent = error.message;
    return;
  }

  const groupId = document.getElementById("addon-group-id").value;
  const method = groupId ? "PUT" : "POST";
  isSavingAddonGroup = true;
  document.querySelector(".addon-editor-save").disabled = true;
  feedback.textContent = "Salvando grupo...";
  try {
    const response = await fetch(
      groupId ? `${urlNetixZae}/addon-groups/${encodeURIComponent(groupId)}` : `${urlNetixZae}/addon-groups`,
      {
        method,
        headers: { "Content-Type": "application/json", user_id: id_user },
        body: JSON.stringify(payload),
      }
    );
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(categoryApiError(body, response.status));
    await loadAddonGroups();
    addonGroupForm.hidden = true;
    feedback.textContent = "";
    setAddonManagerFeedback(groupId ? "Grupo atualizado com sucesso." : "Grupo criado com sucesso.");
  } catch (error) {
    feedback.textContent = `Não foi possível salvar o grupo: ${error.message}`;
  } finally {
    isSavingAddonGroup = false;
    document.querySelector(".addon-editor-save").disabled = false;
  }
});

addonLinkForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  addonLinkFeedback.textContent = "";
  const groupId = document.getElementById("addon-link-group").value;
  const payload = { groupId };
  if (!groupId) {
    addonLinkFeedback.textContent = "Selecione um grupo para vincular.";
    return;
  }
  const productIds = [...document.querySelectorAll('input[name="addon-product-id"]:checked')].map((input) => input.value);
  if (!productIds.length) {
    addonLinkFeedback.textContent = "Selecione ao menos um produto.";
    return;
  }
  payload.productIds = productIds;

  const submitButton = document.querySelector(".addon-link-submit");
  submitButton.disabled = true;
  addonLinkFeedback.textContent = "Vinculando grupo...";
  try {
    const response = await fetch(`${urlNetixZae}/addon-groups/vincular`, {
      method: "POST",
      headers: { "Content-Type": "application/json", user_id: id_user },
      body: JSON.stringify(payload),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(categoryApiError(body, response.status));
    addonLinkFeedback.textContent = "Grupo vinculado com sucesso.";
  } catch (error) {
    addonLinkFeedback.textContent = `Não foi possível vincular o grupo: ${error.message}`;
  } finally {
    submitButton.disabled = false;
  }
});

const edit = document.querySelector(".edit");
function openEdit(id) {
  const product = productsById.get(id);
  if (!product) return;

  edit.style.display = "flex";

  document.getElementById("att-nome").value = product.description || "";
  document.getElementById("att-description2").value = product.description2 || "";
  document.querySelector(".nomeP").textContent = product.description || "";
  document.getElementById("att-valor").value = product.price ?? "";
  document.getElementById("att-status").checked = Boolean(product.status);
  const addonOptions = document.getElementById("att-addon-options");
  const addonFeedback = document.getElementById("att-addon-feedback");
  addonFeedback.textContent = "Carregando grupos de adicionais...";
  renderProductAddonGroups(addonOptions, extractAddonGroupIds(product));
  loadAddonGroups()
    .then(() => {
      renderProductAddonGroups(addonOptions, extractAddonGroupIds(product));
      addonFeedback.textContent = "";
    })
    .catch((error) => {
      addonFeedback.textContent = `Não foi possível carregar os grupos: ${error.message}`;
    });
  populateCategorySelect(document.getElementById("att-category"), product.categoriaId ?? product.categoryId ?? "");
  const categoryMessage = document.getElementById("att-category-message");
  if (categoryMessage) categoryMessage.textContent = "";
  if (!categories.length) {
    loadCategories().then(() => {
      populateCategorySelect(document.getElementById("att-category"), product.categoriaId ?? product.categoryId ?? "");
      if (categoryMessage) categoryMessage.textContent = "";
    }).catch((error) => {
      const message = `Não foi possível carregar as categorias: ${error.message}`;
      if (categoryMessage) categoryMessage.textContent = message;
      else document.querySelector(".category-feedback").textContent = message;
    });
  }
  document.getElementById("att-thumbnail").value = "";
  const updateImageMessage = document.getElementById("att-image-message");
  updateImageMessage.textContent = "";
  updateImageMessage.classList.remove("is-error");
  document.querySelector(".imgProduto").src =
    product.thumbnail_url || product.thumbnail || "";

  const atualizarButton = document.querySelector(".att-produtos");
  atualizarButton.onclick = function () {
    atualizarP(id);
  };

  const apagar = document.querySelector(".apagarProduto");

  apagar.onclick = function () {
    apagarProduto(id);
  };
  async function atualizarP(id) {
    const atualizarButton = document.querySelector(".att-produtos");
    atualizarButton.disabled = true;
    try {
      const attNome = document.getElementById("att-nome").value.trim();
      const attDescription2 = document.getElementById("att-description2").value.trim();
      const priceValue = document.getElementById("att-valor").value;
      const imageFile = document.getElementById("att-thumbnail").files[0];
      const attValor = Number(priceValue);
      const attStatus = document.getElementById("att-status").checked;

      if (!attNome || !attDescription2 || !priceValue || !Number.isFinite(attValor)) {
        failed.style = "display:flex";
        mensagemErro.textContent = "Preencha todos os campos do produto.";
        return;
      }

      if (!addonGroupsLoaded) await loadAddonGroups();
      if (imageFile) {
        const imageMessage = document.getElementById("att-image-message");
        imageMessage.textContent = "Validando imagem...";
        imageMessage.classList.remove("is-error");
        const imageError = await validateImageFile(imageFile);
        if (imageError) throw new Error(imageError);
        imageMessage.textContent = "Enviando imagem...";
      }

      const payload = {
        description: attNome,
        description2: attDescription2,
        price: attValor,
        status: attStatus,
        categoriaId: document.getElementById("att-category").value || null,
        gruposAdicionaisIds: collectSelectedAddonGroupIds(document.getElementById("att-addon-options")),
      };
      if (imageFile) payload.thumbnail = await uploadProductImage(imageFile);

      const reqAtt = await fetch(`${urlNetixZae}/products/${encodeURIComponent(id)}`, {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          user_id: id_user,
        },
        body: JSON.stringify(payload),
      });

      if (!reqAtt.ok) {
        throw new Error(`Erro na API: ${reqAtt.status}`);
      }

      await reqAtt.json();

      const edit = document.querySelector(".edit");
      edit.style.display = "none";
      localStorage.removeItem(`products:${id_user}`);
      await fetchProducts();
      await buscarDisponiveis();
      mostrarSucesso("Produto atualizado com sucesso!");
    } catch (error) {
      console.error("Erro na atualização:", error);
      failed.style = "display:flex";
      mensagemErro.textContent = "Erro ao atualizar produto: " + error.message;
    } finally {
      atualizarButton.disabled = false;
    }
  }

  async function apagarProduto(id) {
    const reqDelete = await fetch(`${urlNetixZae}/produto/${id}`, {
      method: "DELETE",
      headers: {
        "Content-Type": "application/json",
        user_id: id_user,
      },
    });
    if (!reqDelete.ok) {
      failed.style = "display:flex";
      mensagemErro.innerHTML = "Falha ao atualizar!";
    } else {
      const res = await reqDelete.json();
      fetchProducts();
      edit.style.display = "none";
      mostrarSucesso(res.Mensagem || "Produto apagado com sucesso!");
    }
  }
}

const closeEdit = document.querySelector(".closeEdit");

if (closeEdit) {
  closeEdit.onclick = function () {
    edit.style = "display: none;";
  };
}

const addProduto = document.querySelector(".add-product");
const newConteiner = document.querySelector(".new-conteiner");
const categoryManager = document.querySelector(".category-manager");
const categoryList = document.querySelector(".category-list");
const categoryListMessage = document.querySelector(".category-list-message");
const categoryFormMessage = document.querySelector(".category-form-message");
const categoryOrderMessage = document.querySelector(".category-order-message");
const categoryOrderSaveButton = document.querySelector(".category-order-save");
const categoryCreateButton = document.querySelector(".category-create-button");
const categoryCreateForm = document.querySelector(".category-create-form");
const manageCategoriesButton = document.querySelector(".manage-categories");
const managePlacesButton = document.querySelector(".manage-places");
let categoryOrderDirty = false;
let isSavingCategoryOrder = false;
const placesModal = document.getElementById("modal-lugares");
const placesForm = document.getElementById("form-lugar");
const placesFeedback = document.getElementById("lugares-feedback");
const placesListFeedback = document.getElementById("lugares-list-feedback");
const placesList = document.getElementById("lista-lugares");
const placesCount = document.getElementById("lugares-count");
const placeSubmitButton = document.getElementById("lugar-submit");
const cancelPlaceEditButton = document.getElementById("lugar-cancel-edit");
let places = [];
let editingPlaceId = null;
let isSavingPlace = false;

function hasCurrentUser() {
  return Boolean(id_user && id_user !== "null" && id_user !== "undefined");
}

function categoryApiError(body, status) {
  return body?.mensagem || body?.message || body?.error || `Erro na API: ${status}`;
}

function normalizeCategory(value) {
  if (!value || typeof value !== "object") return null;
  const id = value._id ?? value.id;
  const name = value.name ?? value.nome;
  if (id === undefined || id === null || typeof name !== "string" || !name.trim()) return null;
  const order = Number(value.ordem);
  return {
    id: String(id),
    name: name.trim(),
    order: Number.isFinite(order) ? order : Number.MAX_SAFE_INTEGER,
  };
}

function populateCategorySelect(select, selectedId = "") {
  if (!select) return;
  const placeholder = document.createElement("option");
  placeholder.value = "";
  placeholder.textContent = "Sem categoria";
  select.replaceChildren(placeholder);
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category.id;
    option.textContent = category.name;
    select.append(option);
  });
  select.value = categories.some((category) => category.id === String(selectedId)) ? String(selectedId) : "";
}

function updateProductCategorySelects() {
  const newCategorySelect = document.getElementById("new-category");
  const selectedNewCategoryId = newCategorySelect?.value || pendingProductCategoryId;
  populateCategorySelect(newCategorySelect, selectedNewCategoryId);
  populateCategorySelect(document.getElementById("att-category"), document.getElementById("att-category")?.value || "");
  renderProducts([...productsById.values()]);
}

function renderCategories() {
  categoryList.replaceChildren();
  categoryListMessage.textContent = categories.length ? "" : "Nenhuma categoria cadastrada.";
  categories.forEach((category, index) => {
    const item = document.createElement("li");
    const name = document.createElement("span");
    name.className = "category-name";
    name.textContent = category.name;

    const position = document.createElement("span");
    position.className = "category-position";
    position.textContent = String(index + 1);
    position.setAttribute("aria-label", `Posição ${index + 1}`);

    const controls = document.createElement("div");
    controls.className = "category-row-controls";

    const moveUpButton = document.createElement("button");
    moveUpButton.type = "button";
    moveUpButton.className = "category-move-button";
    moveUpButton.setAttribute("aria-label", `Mover ${category.name} para cima`);
    moveUpButton.title = `Mover ${category.name} para cima`;
    moveUpButton.disabled = index === 0 || isSavingCategoryOrder;
    const upIcon = document.createElement("i");
    upIcon.className = "fa-solid fa-chevron-up";
    upIcon.setAttribute("aria-hidden", "true");
    moveUpButton.append(upIcon);
    moveUpButton.addEventListener("click", () => moveCategory(category.id, -1));

    const moveDownButton = document.createElement("button");
    moveDownButton.type = "button";
    moveDownButton.className = "category-move-button";
    moveDownButton.setAttribute("aria-label", `Mover ${category.name} para baixo`);
    moveDownButton.title = `Mover ${category.name} para baixo`;
    moveDownButton.disabled = index === categories.length - 1 || isSavingCategoryOrder;
    const downIcon = document.createElement("i");
    downIcon.className = "fa-solid fa-chevron-down";
    downIcon.setAttribute("aria-hidden", "true");
    moveDownButton.append(downIcon);

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "category-delete-button";
    deleteButton.setAttribute("aria-label", `Apagar categoria ${category.name}`);
    deleteButton.title = `Apagar ${category.name}`;
    deleteButton.disabled = categoryOrderDirty || isSavingCategoryOrder;
    const icon = document.createElement("i");
    icon.className = "fa-solid fa-trash";
    icon.setAttribute("aria-hidden", "true");
    deleteButton.append(icon);
    deleteButton.addEventListener("click", () => deleteCategory(category, deleteButton));
    controls.append(moveUpButton, moveDownButton, deleteButton);
    item.append(name, position, controls);
    categoryList.append(item);
  });
  updateCategoryOrderControls();
}

function updateCategoryOrderControls() {
  if (categoryOrderSaveButton) {
    categoryOrderSaveButton.disabled = !categoryOrderDirty || isSavingCategoryOrder;
  }
  if (categoryCreateButton) {
    categoryCreateButton.disabled = categoryOrderDirty || isSavingCategoryOrder;
  }
  categoryList.querySelectorAll(".category-delete-button").forEach((button) => {
    button.disabled = categoryOrderDirty || isSavingCategoryOrder;
  });
}

function moveCategory(categoryId, direction) {
  if (isSavingCategoryOrder) return;
  const currentIndex = categories.findIndex((category) => category.id === categoryId);
  const nextIndex = currentIndex + direction;
  if (currentIndex < 0 || nextIndex < 0 || nextIndex >= categories.length) return;

  [categories[currentIndex], categories[nextIndex]] = [categories[nextIndex], categories[currentIndex]];
  categoryOrderDirty = true;
  categoryOrderMessage.textContent = "Ordem alterada. Salve para atualizar as posições no banco de dados.";
  renderCategories();
}

async function loadCategories() {
  if (!hasCurrentUser()) throw new Error("Selecione um cliente válido antes de gerenciar categorias.");
  categoryListMessage.textContent = "Carregando categorias...";
  categoryList.replaceChildren();
  const response = await fetch(`${urlNetixZae}/categories`, {
    headers: { user_id: id_user },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(categoryApiError(body, response.status));
  const values = Array.isArray(body) ? body : body?.categories;
  if (!Array.isArray(values)) throw new Error("Resposta inválida ao carregar categorias.");
  const normalized = values.map(normalizeCategory);
  if (normalized.some((category) => !category)) throw new Error("A API retornou uma categoria sem ID ou nome válido.");
  categories = normalized
    .map((category, index) => ({ ...category, index }))
    .sort((first, second) => first.order - second.order || first.index - second.index)
    .map(({ index, ...category }) => category);
  categoryOrderDirty = false;
  categoryOrderMessage.textContent = "";
  renderCategories();
  updateProductCategorySelects();
  return categories;
}

function closeCategoryManager() {
  if (categoryOrderDirty && !window.confirm("Descartar a nova ordem das categorias?")) return;
  categoryOrderDirty = false;
  categoryManager.classList.remove("is-open");
  categoryManager.setAttribute("aria-hidden", "true");
}

if (addProduto && manageCategoriesButton && hasCurrentUser()) {
  addProduto.disabled = false;
  manageCategoriesButton.disabled = false;
  if (manageAddonGroupsButton) manageAddonGroupsButton.disabled = false;
  if (managePlacesButton) managePlacesButton.disabled = false;
}

if (manageCategoriesButton && categoryManager) manageCategoriesButton.addEventListener("click", async () => {
  if (!hasCurrentUser()) return;
  categoryManager.classList.add("is-open");
  categoryManager.setAttribute("aria-hidden", "false");
  categoryFormMessage.textContent = "";
  try {
    await loadCategories();
  } catch (error) {
    categoryListMessage.textContent = `Não foi possível carregar as categorias: ${error.message}`;
  }
});

const closeCategoryManagerButton = document.querySelector(".category-manager-close");
if (closeCategoryManagerButton) closeCategoryManagerButton.addEventListener("click", closeCategoryManager);

if (categoryOrderSaveButton) categoryOrderSaveButton.addEventListener("click", salvarOrdemCategorias);

async function salvarOrdemCategorias() {
  if (!hasCurrentUser() || !categoryOrderDirty || isSavingCategoryOrder) return;

  isSavingCategoryOrder = true;
  categoryOrderMessage.textContent = "Salvando ordem das categorias...";
  updateCategoryOrderControls();
  try {
    for (const [order, category] of categories.entries()) {
      const response = await fetch(`${urlNetixZae}/categories/${encodeURIComponent(category.id)}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json", user_id: id_user },
        body: JSON.stringify({ ordem: order }),
      });
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(categoryApiError(body, response.status));
      const updatedCategory = normalizeCategory(body?.category ?? body);
      if (!updatedCategory || updatedCategory.id !== category.id || updatedCategory.order !== order) {
        throw new Error(`A API não confirmou a posição de “${category.name}”.`);
      }
    }

    categories = categories.map((category, order) => ({ ...category, order }));
    categoryOrderDirty = false;
    updateProductCategorySelects();
    closeCategoryManager();
    mostrarSucesso("Ordem das categorias salva com sucesso!");
  } catch (error) {
    categoryOrderMessage.textContent = `Não foi possível salvar a ordem: ${error.message}. Você pode tentar novamente.`;
  } finally {
    isSavingCategoryOrder = false;
    updateCategoryOrderControls();
    renderCategories();
  }
}

if (categoryCreateForm) categoryCreateForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  if (categoryOrderDirty) {
    categoryOrderMessage.textContent = "Salve ou descarte a nova ordem antes de criar uma categoria.";
    return;
  }
  const name = document.getElementById("category-name").value.trim();
  if (!name) {
    categoryFormMessage.textContent = "Informe o nome da categoria.";
    return;
  }
  if (!hasCurrentUser()) {
    categoryFormMessage.textContent = "Cliente inválido. Entre novamente para continuar.";
    return;
  }

  categoryCreateButton.disabled = true;
  categoryFormMessage.textContent = "Criando categoria...";
  const previousIds = new Set(categories.map((category) => category.id));
  try {
    const response = await fetch(`${urlNetixZae}/categories`, {
      method: "POST",
      headers: { "Content-Type": "application/json", user_id: id_user },
      body: JSON.stringify({ nome: name, ordem: categories.length }),
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(categoryApiError(body, response.status));
    await loadCategories();
    const returnedCategory = normalizeCategory(body?.category ?? body);
    const createdCategory = (returnedCategory && categories.find((category) => category.id === returnedCategory.id)) ||
      categories.find((category) => category.name === name && !previousIds.has(category.id));
    if (!createdCategory) throw new Error("A API não confirmou o ID da categoria criada. Verifique a resposta do backend.");
    pendingProductCategoryId = createdCategory.id;
    document.getElementById("category-name").value = "";
    closeCategoryManager();
    document.querySelector(".category-feedback").textContent = `Categoria “${createdCategory.name}” criada com sucesso.`;
    mostrarSucesso(`Categoria “${createdCategory.name}” criada com sucesso!`);
  } catch (error) {
    categoryFormMessage.textContent = `Não foi possível criar a categoria: ${error.message}`;
  } finally {
    categoryCreateButton.disabled = false;
  }
});

async function deleteCategory(category, button) {
  if (categoryOrderDirty) return;
  if (!hasCurrentUser()) return;
  if (!window.confirm(`Apagar a categoria “${category.name}”?`)) return;
  button.disabled = true;
  categoryFormMessage.textContent = `Apagando “${category.name}”...`;
  try {
    const response = await fetch(`${urlNetixZae}/categories/${encodeURIComponent(category.id)}`, {
      method: "DELETE",
      headers: { user_id: id_user },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(categoryApiError(body, response.status));
    categories = categories.filter((item) => item.id !== category.id);
    if (pendingProductCategoryId === category.id) pendingProductCategoryId = "";
    updateProductCategorySelects();
    renderCategories();
    closeCategoryManager();
    mostrarSucesso(`Categoria “${category.name}” apagada com sucesso!`);
  } catch (error) {
    button.disabled = false;
    categoryFormMessage.textContent = `Não foi possível apagar a categoria: ${error.message}`;
  }
}

function normalizePlace(value) {
  if (!value || typeof value !== "object") return null;
  const id = value._id ?? value.id;
  const name = typeof value.name === "string" ? value.name.trim() : "";
  const fee = Number(value.fee);
  if (id === undefined || id === null || !name || !Number.isFinite(fee) || fee < 0) return null;
  return { id: String(id), name, fee };
}

function formatDeliveryFee(fee) {
  return new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(fee);
}

function setPlacesFeedback(message, state = "") {
  placesFeedback.textContent = message;
  placesFeedback.dataset.state = state;
}

function resetPlaceForm() {
  editingPlaceId = null;
  placesForm.reset();
  placeSubmitButton.textContent = "Adicionar bairro";
  cancelPlaceEditButton.hidden = true;
  setPlacesFeedback("");
}

function closePlacesModal() {
  placesModal.style.display = "none";
  placesModal.setAttribute("aria-hidden", "true");
  resetPlaceForm();
  if (managePlacesButton) managePlacesButton.focus();
}

function renderPlaces() {
  placesList.replaceChildren();
  placesCount.textContent = String(places.length);

  if (!places.length) {
    placesListFeedback.textContent = "Nenhum bairro cadastrado. Adicione o primeiro acima.";
    return;
  }

  placesListFeedback.textContent = "";
  places.forEach((place) => {
    const item = document.createElement("li");
    item.className = "lugar-row";

    const details = document.createElement("div");
    details.className = "lugar-details";
    const name = document.createElement("span");
    name.className = "lugar-row-name";
    name.textContent = place.name;
    const fee = document.createElement("span");
    fee.className = "lugar-row-fee";
    fee.textContent = formatDeliveryFee(place.fee);
    details.append(name, fee);

    const actions = document.createElement("div");
    actions.className = "lugar-row-actions";
    const editButton = document.createElement("button");
    editButton.type = "button";
    editButton.className = "lugar-edit-button";
    editButton.textContent = "Editar";
    editButton.disabled = isSavingPlace;
    editButton.addEventListener("click", () => beginPlaceEdit(place));

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.className = "lugar-delete-button";
    deleteButton.textContent = "Apagar";
    deleteButton.disabled = isSavingPlace;
    deleteButton.addEventListener("click", () => deletePlace(place));

    actions.append(editButton, deleteButton);
    item.append(details, actions);
    placesList.append(item);
  });
}

async function loadPlaces() {
  if (!hasCurrentUser()) throw new Error("Cliente inválido. Entre novamente para continuar.");
  placesListFeedback.textContent = "Carregando bairros...";
  placesList.replaceChildren();

  const response = await fetch(`${urlNetixZae}/lugares`, {
    headers: { user_id: id_user },
  });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(categoryApiError(body, response.status));

  const values = Array.isArray(body) ? body : body?.lugares;
  if (!Array.isArray(values)) throw new Error("A API retornou uma lista de bairros inválida.");
  const normalized = values.map(normalizePlace);
  if (normalized.some((place) => !place)) throw new Error("A API retornou um bairro com dados inválidos.");

  places = normalized;
  renderPlaces();
}

function beginPlaceEdit(place) {
  editingPlaceId = place.id;
  document.getElementById("lugar-name").value = place.name;
  document.getElementById("lugar-fee").value = place.fee.toFixed(2);
  placeSubmitButton.textContent = "Salvar alterações";
  cancelPlaceEditButton.hidden = false;
  setPlacesFeedback(`Editando ${place.name}.`);
  document.getElementById("lugar-name").focus();
}

if (placesForm && placesModal) {
  placesForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    if (isSavingPlace) return;

    const name = document.getElementById("lugar-name").value.trim();
    const feeValue = document.getElementById("lugar-fee").value;
    const fee = Number(feeValue);
    if (!name) {
      setPlacesFeedback("Informe o nome do bairro.", "error");
      document.getElementById("lugar-name").focus();
      return;
    }
    if (!feeValue || !Number.isFinite(fee) || fee < 0) {
      setPlacesFeedback("Informe uma taxa válida, igual ou maior que zero.", "error");
      document.getElementById("lugar-fee").focus();
      return;
    }
    if (!hasCurrentUser()) {
      setPlacesFeedback("Cliente inválido. Entre novamente para continuar.", "error");
      return;
    }

    const wasEditing = Boolean(editingPlaceId);
    const placeId = editingPlaceId;
    isSavingPlace = true;
    placeSubmitButton.disabled = true;
    setPlacesFeedback(wasEditing ? "Salvando alterações..." : "Adicionando bairro...");
    renderPlaces();

    try {
      const response = await fetch(
        wasEditing ? `${urlNetixZae}/lugares/${encodeURIComponent(placeId)}` : `${urlNetixZae}/lugares`,
        {
          method: wasEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json", user_id: id_user },
          body: JSON.stringify({ name, fee }),
        }
      );
      const body = await response.json().catch(() => null);
      if (!response.ok) throw new Error(categoryApiError(body, response.status));

      const savedPlace = normalizePlace(body?.lugar ?? body);
      if (!savedPlace || (wasEditing && savedPlace.id !== placeId)) {
        throw new Error("A API não confirmou os dados do bairro salvo.");
      }

      places = wasEditing
        ? places.map((place) => (place.id === savedPlace.id ? savedPlace : place))
        : [...places, savedPlace];
      renderPlaces();
      closePlacesModal();
      mostrarSucesso(wasEditing ? "Bairro atualizado com sucesso!" : "Bairro adicionado com sucesso!");
    } catch (error) {
      setPlacesFeedback(`Não foi possível salvar o bairro: ${error.message}`, "error");
      renderPlaces();
    } finally {
      isSavingPlace = false;
      placeSubmitButton.disabled = false;
      renderPlaces();
    }
  });
}

async function deletePlace(place) {
  if (!hasCurrentUser() || isSavingPlace) return;
  if (!window.confirm(`Apagar o bairro “${place.name}” e sua taxa de entrega?`)) return;

  isSavingPlace = true;
  setPlacesFeedback(`Apagando ${place.name}...`);
  renderPlaces();
  try {
    const response = await fetch(`${urlNetixZae}/lugares/${encodeURIComponent(place.id)}`, {
      method: "DELETE",
      headers: { user_id: id_user },
    });
    const body = await response.json().catch(() => null);
    if (!response.ok) throw new Error(categoryApiError(body, response.status));

    places = places.filter((item) => item.id !== place.id);
    renderPlaces();
    closePlacesModal();
    mostrarSucesso(`Bairro “${place.name}” apagado com sucesso!`);
  } catch (error) {
    setPlacesFeedback(`Não foi possível apagar o bairro: ${error.message}`, "error");
  } finally {
    isSavingPlace = false;
    renderPlaces();
  }
}

if (managePlacesButton && placesModal) {
  managePlacesButton.addEventListener("click", async () => {
    if (!hasCurrentUser()) return;
    resetPlaceForm();
    placesModal.style.display = "flex";
    placesModal.setAttribute("aria-hidden", "false");
    document.getElementById("lugar-name").focus();
    try {
      await loadPlaces();
    } catch (error) {
      placesListFeedback.textContent = `Não foi possível carregar os bairros: ${error.message}`;
    }
  });

  placesModal.addEventListener("click", (event) => {
    if (event.target === placesModal) closePlacesModal();
  });

  document.querySelectorAll(".lugares-close, .lugares-cancel").forEach((button) => {
    button.addEventListener("click", closePlacesModal);
  });

  cancelPlaceEditButton.addEventListener("click", resetPlaceForm);
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && placesModal.style.display === "flex") closePlacesModal();
  });
}

if (addProduto && newConteiner) {
  addProduto.addEventListener("click", async function () {
    if (!hasCurrentUser()) return;
    document.querySelector(".new-product-message").textContent = "";
    document.getElementById("new-addon-feedback").textContent = "Carregando grupos de adicionais...";
    renderProductAddonGroups(document.getElementById("new-addon-options"));
    populateCategorySelect(document.getElementById("new-category"), pendingProductCategoryId);
    newConteiner.style.display = "flex";
    newConteiner.setAttribute("aria-hidden", "false");
    document.getElementById("new-nome").focus();
    try {
      await loadCategories();
      populateCategorySelect(document.getElementById("new-category"), pendingProductCategoryId);
    } catch (error) {
      const message = document.querySelector(".new-product-message");
      message.textContent = `Não foi possível carregar as categorias: ${error.message}`;
      message.classList.add("is-visible");
    }
    try {
      await loadAddonGroups();
      renderProductAddonGroups(document.getElementById("new-addon-options"));
      document.getElementById("new-addon-feedback").textContent = "";
    } catch (error) {
      document.getElementById("new-addon-feedback").textContent = `Não foi possível carregar os grupos: ${error.message}`;
    }
  });
}

const criarButton = document.querySelector(".new-produto");
if (criarButton) {
  criarButton.onclick = function () {
    novoProduto();
  };
}

const closeNew = document.querySelector(".closeNew");

function closeNewProductModal() {
  newConteiner.style.display = "none";
  newConteiner.setAttribute("aria-hidden", "true");
  addProduto?.focus();
}

if (closeNew && newConteiner) {
  closeNew.addEventListener("click", closeNewProductModal);
  newConteiner.addEventListener("click", (event) => {
    if (event.target === newConteiner) closeNewProductModal();
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && newConteiner.style.display === "flex") {
      closeNewProductModal();
    }
  });
}

async function novoProduto() {
  const formMessage = document.querySelector(".new-product-message");
  const createButton = document.querySelector(".new-produto");
  formMessage.textContent = "";
  formMessage.classList.remove("is-visible");

  const newNome = document.getElementById("new-nome").value.trim();
  const description2 = document.getElementById("new-description2").value.trim();
  const newValor = document.getElementById("new-valor").value;
  const imageFile = document.getElementById("linkImg").files[0];
  const newValorNumber = Number(newValor);

  if (!newNome || !description2 || !newValor || !Number.isFinite(newValorNumber) || !imageFile) {
    formMessage.textContent = "Preencha todos os campos para criar o produto.";
    formMessage.classList.add("is-visible");
    return;
  }

  let gruposAdicionaisIds;
  try {
    if (!addonGroupsLoaded) await loadAddonGroups();
    gruposAdicionaisIds = collectSelectedAddonGroupIds(document.getElementById("new-addon-options"));
  } catch (error) {
    formMessage.textContent = error.message;
    formMessage.classList.add("is-visible");
    return;
  }

  formMessage.textContent = "Validando imagem...";
  formMessage.classList.add("is-visible");
  const imageError = await validateImageFile(imageFile);
  if (imageError) {
    formMessage.textContent = imageError;
    formMessage.classList.add("is-visible");
    return;
  }

  createButton.disabled = true;
  try {
    formMessage.textContent = "Enviando imagem...";
    formMessage.classList.add("is-visible");
    const imageUrl = await uploadProductImage(imageFile);
    formMessage.textContent = "Imagem enviada. Cadastrando produto...";

    const reqNew = await fetch(`${urlNetixZae}/products`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        user_id: id_user,
      },
      body: JSON.stringify({
        user_id: id_user,
        description: newNome,
        description2,
        price: newValor,
        status: true,
        thumbnail: imageUrl,
        categoriaId: document.getElementById("new-category").value || null,
        gruposAdicionaisIds,
      }),
    });

    if (!reqNew.ok) {
      throw new Error(`Erro na API: ${reqNew.status}`);
    }

    closeNewProductModal();
    localStorage.removeItem(`products:${id_user}`);
    await fetchProducts();
    mostrarSucesso("Produto criado com sucesso!");
  } catch (error) {
    console.error("Erro na criação:", error);
    formMessage.textContent = `Não foi possível criar o produto: ${error.message}`;
    formMessage.classList.add("is-visible");
  } finally {
    createButton.disabled = false;
  }
}
