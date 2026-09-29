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

fecharSucess = () => {
  sucess.style = "display:none";
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
  productsById = new Map(products.map((product) => [product._id, product]));
  const elements = products.map(
    (product) => `
   <div class="product">
      <img src="${product.thumbnail_url}" alt="carregando.." loading="lazy" />
      <p class="description">${product.description}</p>
      <p class="prince"><strong>R$ ${parseFloat(product.price)
        .toFixed(2)
        .replace(".", ",")}</strong></p>
      <div class="btn">
        <button 
          onclick="toggleProductStatus('${product.id}', ${product.status})"
          class="${product.status ? "btn-pausar" : "btn-ativar"}">
          ${product.status ? "Pausar" : "Ativar"}
        </button>
         <i class="fa-solid fa-pen" onclick="openEdit('${product._id}')"></i>
      </div>
    </div>
  `
  );

  container.innerHTML = elements.join("");
  const meuSistema = document.querySelector(".meuSistema");
  meuSistema.href = `https://comercio-zap.netlify.app/${id_user}`;
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
      sucess.style = "display:flex";
      mensagem.innerHTML = `Produto ${
        newStatus ? "ativado" : "pausado"
      } com sucesso!`;
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
  buscarDisponiveis();
});

async function carregarPerfilUsuario() {
  try {
    const response = await fetch(`${urlNetixZae}/sessions-list-counts`);
    if (!response.ok) throw new Error(`Erro na API: ${response.status}`);

    const users = await response.json();
    const user = users.find((item) => item._id === id_user);
    if (!user) throw new Error("Usuário não encontrado.");

    const corRecebida = typeof user.corSistema === "string" ? user.corSistema.trim() : "";
    const corSistema = /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(corRecebida)
      ? corRecebida
      : "#2ECC71";

    document.documentElement.style.setProperty("--system-primary-color", corSistema);
    document.querySelector(".name").textContent = `Olá, ${user.nome || nome || "usuário"}`;
  } catch (error) {
    console.error("Erro ao carregar o perfil do usuário:", error);
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
      sucess.style = "display:flex";
      mensagem.textContent = "Produto atualizado com sucesso!";
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
      sucess.style = "display:flex";
      mensagem.innerHTML = res.Mensagem;
      fetchProducts();
      edit.style.display = "none";
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

if (addProduto && newConteiner) {
  addProduto.addEventListener("click", function () {
    newConteiner.style = "display: flex;";
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
      }),
    });

    if (!reqNew.ok) {
      throw new Error(`Erro na API: ${reqNew.status}`);
    }

    const newConteiner = document.querySelector(".new-conteiner");
    newConteiner.style.display = "none";
    localStorage.removeItem(`products:${id_user}`);
    mensagem.textContent = "Produto criado com sucesso!";
    sucess.style = "display:flex";
    await fetchProducts();
  } catch (error) {
    console.error("Erro na criação:", error);
    formMessage.textContent = `Não foi possível criar o produto: ${error.message}`;
    formMessage.classList.add("is-visible");
  } finally {
    createButton.disabled = false;
  }
}
