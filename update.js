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
let companyBannerObjectUrl = null;
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

function showCompanyBannerPreview(source) {
  if (companyBannerObjectUrl) {
    URL.revokeObjectURL(companyBannerObjectUrl);
    companyBannerObjectUrl = null;
  }

  const preview = document.querySelector(".company-banner-preview");
  const emptyMessage = document.querySelector(".company-banner-empty");
  preview.hidden = !source;
  emptyMessage.hidden = Boolean(source);
  preview.src = source || "";
}

function fillCompanySettings(user) {
  document.getElementById("company-name").value = user.nome || "";
  document.getElementById("company-color").value = normalizedSystemColor(user.corSistema);
  showCompanyBannerPreview(companyBannerUrl(user));
  document.getElementById("company-banner").value = "";
  document.querySelector(".company-banner-message").textContent = "";
  setCompanyMessage("");
}

const openCompanySettingsButton = document.querySelector(".edit-company");
if (openCompanySettingsButton && companySettings) {
  openCompanySettingsButton.disabled = true;
  openCompanySettingsButton.addEventListener("click", () => {
    if (!empresaAtual) return;
    fillCompanySettings(empresaAtual);
    companySettings.classList.add("is-open");
    companySettings.setAttribute("aria-hidden", "false");
  });
}

const closeCompanySettingsButton = document.querySelector(".company-settings-close");
if (closeCompanySettingsButton && companySettings) {
  closeCompanySettingsButton.addEventListener("click", () => {
    companySettings.classList.remove("is-open");
    companySettings.setAttribute("aria-hidden", "true");
  });
}

if (companyBannerInput) {
  companyBannerInput.addEventListener("change", async () => {
    const file = companyBannerInput.files[0];
    const message = document.querySelector(".company-banner-message");
    if (!file) {
      message.textContent = "";
      showCompanyBannerPreview(companyBannerUrl(empresaAtual || {}));
      return;
    }

    message.textContent = "Validando banner...";
    const imageError = await validateImageFile(file);
    if (companyBannerInput.files[0] !== file) return;
    if (imageError) {
      companyBannerInput.value = "";
      message.textContent = imageError;
      message.classList.add("is-error");
      showCompanyBannerPreview(companyBannerUrl(empresaAtual || {}));
      return;
    }

    message.textContent = file.name;
    message.classList.remove("is-error");
    companyBannerObjectUrl = URL.createObjectURL(file);
    const preview = document.querySelector(".company-banner-preview");
    preview.src = companyBannerObjectUrl;
    preview.hidden = false;
    document.querySelector(".company-banner-empty").hidden = true;
  });
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

  products.forEach((product) => {
    const categoryId = String(product.categoriaId ?? product.categoryId ?? "");
    const group = productsByCategory.get(categoryId);
    if (group) group.push(product);
    else uncategorizedProducts.push(product);
  });

  categories.forEach((category) => {
    renderProductGroup(container, category.name, productsByCategory.get(category.id));
  });
  if (uncategorizedProducts.length) renderProductGroup(container, "Sem categoria", uncategorizedProducts);

  const meuSistema = document.querySelector(".meuSistema");
  meuSistema.href = `https://comercio-zap.netlify.app/${id_user}`;
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
  try {
    const response = await fetch(`${urlNetixZae}/sessions-list-counts`);
    if (!response.ok) throw new Error(`Erro na API: ${response.status}`);

    const users = await response.json();
    const user = users.find((item) => item._id === id_user);
    if (!user) throw new Error("Usuário não encontrado.");
    empresaAtual = user;
    fillCompanySettings(user);
    if (openCompanySettingsButton) openCompanySettingsButton.disabled = false;

    const corSistema = normalizedSystemColor(user.corSistema);

    document.documentElement.style.setProperty("--system-primary-color", corSistema);
    document.querySelector(".name").textContent = `Olá, ${user.nome || nome || "usuário"}`;
  } catch (error) {
    console.error("Erro ao carregar o perfil do usuário:", error);
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
  const companyName = document.getElementById("company-name").value.trim();
  const systemColor = document.getElementById("company-color").value;

  if (!companyName) {
    setCompanyMessage("Informe o nome da empresa.", "error");
    return;
  }

  saveButton.disabled = true;
  try {
    const formData = new FormData();
    let hasChanges = false;

    if (companyName !== (empresaAtual.nome || "")) {
      formData.append("nome", companyName);
      hasChanges = true;
    }
    if (systemColor.toLowerCase() !== normalizedSystemColor(empresaAtual.corSistema).toLowerCase()) {
      formData.append("corSistema", systemColor);
      hasChanges = true;
    }
    if (bannerFile) {
      setCompanyMessage("Validando banner...", "loading");
      const imageError = await validateImageFile(bannerFile);
      if (imageError) throw new Error(imageError);
      formData.append("banner", bannerFile);
      hasChanges = true;
    }

    if (!hasChanges) {
      setCompanyMessage("Não há alterações para salvar.", "error");
      return;
    }

    setCompanyMessage(bannerFile ? "Enviando alterações e banner..." : "Salvando alterações...", "loading");
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
      };
      if (imageFile) payload.thumbnail = await uploadProductImage(imageFile);

      const reqAtt = await fetch(`${urlNetixZae}/atualizar/${id}`, {
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
let categoryOrderDirty = false;
let isSavingCategoryOrder = false;

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

if (addProduto && newConteiner) {
  addProduto.addEventListener("click", async function () {
    if (!hasCurrentUser()) return;
    document.querySelector(".new-product-message").textContent = "";
    populateCategorySelect(document.getElementById("new-category"), pendingProductCategoryId);
    newConteiner.style = "display: flex;";
    try {
      await loadCategories();
      populateCategorySelect(document.getElementById("new-category"), pendingProductCategoryId);
    } catch (error) {
      const message = document.querySelector(".new-product-message");
      message.textContent = `Não foi possível carregar as categorias: ${error.message}`;
      message.classList.add("is-visible");
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

if (closeNew && newConteiner) {
  closeNew.addEventListener("click", function () {
    newConteiner.style = "display: none;";
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

    const reqNew = await fetch(`${urlNetixZae}/add-produto`, {
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
      }),
    });

    if (!reqNew.ok) {
      throw new Error(`Erro na API: ${reqNew.status}`);
    }

    const newConteiner = document.querySelector(".new-conteiner");
    newConteiner.style.display = "none";
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
