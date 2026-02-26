const productGrid = document.getElementById('product-grid');
const slideshow = document.getElementById('slideshow');
const searchInput = document.getElementById('search');
const menuToggle = document.getElementById('menu-toggle');
const menuDropdown = document.getElementById('menu-dropdown');

const modal = document.getElementById('product-modal');
const modalImg = document.getElementById('modal-img');
const modalName = document.getElementById('modal-name');
const modalPrice = document.getElementById('modal-price');
const modalCategory = document.getElementById('modal-category');
const qty = document.getElementById('modal-qty');
const buyBtn = document.getElementById('buy-now');
const cartBtn = document.getElementById('add-cart');
const closeModal = document.getElementById('close-modal');

let products = [];
let selectedProduct = null;
const fallbackImage =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="300" height="220"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="%23ffb347"/><stop offset="100%" stop-color="%236a82fb"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="28" font-family="Arial">Lamp</text></svg>';

menuToggle.addEventListener('click', () => {
  menuDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (event) => {
  if (!menuToggle.contains(event.target) && !menuDropdown.contains(event.target)) {
    menuDropdown.classList.add('hidden');
  }
});

async function fetchProducts() {
  const res = await fetch('/api/products');
  products = await res.json();

  displayProducts(products);

  const uniqueByCategory = [];
  const seen = new Set();
  products.forEach((product) => {
    const categoryKey = product.category_id || product.category_name || product.id;
    if (!seen.has(categoryKey)) {
      seen.add(categoryKey);
      uniqueByCategory.push(product);
    }
  });

  displaySlideshow(uniqueByCategory.slice(0, 8));
}

function displayProducts(list) {
  productGrid.innerHTML = '';

  if (!list.length) {
    productGrid.innerHTML = '<p class="empty-state">No products found.</p>';
    return;
  }

  list.forEach((product) => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${product.image_url || fallbackImage}" alt="${product.name}" onerror="this.onerror=null;this.src='${fallbackImage}'">
      <h3>${product.name}</h3>
      <p>₹${Number(product.price).toFixed(2)}</p>
    `;

    card.addEventListener('click', () => {
      document.querySelectorAll('.product-card.active').forEach((element) => {
        element.classList.remove('active');
      });
      card.classList.add('active');
      openModal(product);
    });

    productGrid.appendChild(card);
  });
}

function displaySlideshow(list) {
  slideshow.innerHTML = '';

  list.forEach((product) => {
    const item = document.createElement('div');
    item.className = 'slide-item';
    item.innerHTML = `
      <img src="${product.image_url || fallbackImage}" alt="${product.name}" onerror="this.onerror=null;this.src='${fallbackImage}'">
      <span>${product.name}</span>
    `;
    item.addEventListener('click', () => openModal(product));
    slideshow.appendChild(item);
  });
}

function openModal(product) {
  selectedProduct = product;
  modalImg.src = product.image_url || fallbackImage;
  modalImg.onerror = () => {
    modalImg.onerror = null;
    modalImg.src = fallbackImage;
  };
  modalName.textContent = product.name;
  modalPrice.textContent = `Price: ₹${Number(product.price).toFixed(2)}`;
  modalCategory.textContent = `Category: ${product.category_name || 'General'}`;
  qty.value = 1;
  modal.style.display = 'flex';
}

closeModal.addEventListener('click', () => {
  modal.style.display = 'none';
});

window.addEventListener('click', (event) => {
  if (event.target === modal) {
    modal.style.display = 'none';
  }
});

searchInput.addEventListener('input', () => {
  const search = searchInput.value.toLowerCase().trim();
  const filtered = products.filter((product) => product.name.toLowerCase().includes(search));
  displayProducts(filtered);
});

buyBtn.addEventListener('click', async () => {
  if (!selectedProduct) return;

  const address = prompt('Enter delivery address:');
  if (!address) {
    alert('Address is required to place order.');
    return;
  }

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: selectedProduct.id,
      quantity: Number(qty.value) || 1,
      address,
      payment_method: 'Cash on Delivery'
    })
  });

  const data = await response.json();

  if (data.success) {
    alert('Order placed successfully with Cash on Delivery.');
    modal.style.display = 'none';
  } else {
    alert(data.message || 'Failed to place order. Please login as buyer.');
  }
});

cartBtn.addEventListener('click', async () => {
  if (!selectedProduct) return;

  const response = await fetch('/api/cart', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: selectedProduct.id,
      quantity: Number(qty.value) || 1
    })
  });

  const data = await response.json();
  if (data.success) {
    alert('Added to cart successfully.');
  } else {
    alert(data.message || 'Please login as buyer to add to cart.');
  }
});

fetchProducts();
