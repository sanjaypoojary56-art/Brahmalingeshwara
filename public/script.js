const productGrid = document.getElementById('product-grid');
const slideshow = document.getElementById('slideshow');
const searchInput = document.getElementById('search');
const menuToggle = document.getElementById('menu-toggle');
const menuDropdown = document.getElementById('menu-dropdown');

const modal = document.getElementById('product-modal');
const modalName = document.getElementById('modal-name');
const modalPrice = document.getElementById('modal-price');
const modalCategory = document.getElementById('modal-category');
const modalImage = document.getElementById('modal-image');
const qty = document.getElementById('modal-qty');
const addressHomeInput = document.getElementById('address-home');
const addressStreetInput = document.getElementById('address-street');
const addressLandmarkInput = document.getElementById('address-landmark');
const addressVillageInput = document.getElementById('address-village');
const addressTownInput = document.getElementById('address-town');
const buyBtn = document.getElementById('buy-now');
const cartBtn = document.getElementById('add-cart');
const closeModal = document.getElementById('close-modal');
const prevImageBtn = document.getElementById('modal-prev-image');
const nextImageBtn = document.getElementById('modal-next-image');

const lightbox = document.getElementById('image-lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const closeLightbox = document.getElementById('close-lightbox');

let products = [];
let selectedProduct = null;
let selectedImages = [];
let selectedImageIndex = 0;
const fallbackImage =
  'https://images.unsplash.com/photo-1556740749-887f6717d7e4?auto=format&fit=crop&w=800&q=80';

menuToggle.addEventListener('click', () => {
  menuDropdown.classList.toggle('hidden');
});

document.addEventListener('click', (event) => {
  if (!menuToggle.contains(event.target) && !menuDropdown.contains(event.target)) {
    menuDropdown.classList.add('hidden');
  }
});

function getProductImages(product) {
  if (Array.isArray(product?.image_urls) && product.image_urls.length) {
    return product.image_urls.map((imageUrl) => getProductImageUrl(imageUrl));
  }

  return [getProductImageUrl(product?.image_url)];
}

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

    const name = document.createElement('h3');
    name.textContent = product.name;

    const image = document.createElement('img');
    image.src = getProductImages(product)[0];
    image.alt = `${product.name} product image`;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      image.src = fallbackImage;
    });

    const price = document.createElement('p');
    price.textContent = `₹${Number(product.price).toFixed(2)}`;

    card.appendChild(image);
    card.appendChild(name);
    card.appendChild(price);

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

function getProductImageUrl(imageUrl) {
  if (!imageUrl) return fallbackImage;

  const normalized = String(imageUrl).replace(/\\/g, '/').trim();

  if (!normalized) return fallbackImage;

  if (normalized.startsWith('http://') || normalized.startsWith('https://') || normalized.startsWith('data:')) {
    return normalized;
  }

  const uploadsIndex = normalized.lastIndexOf('/uploads/');
  if (uploadsIndex >= 0) {
    return normalized.slice(uploadsIndex);
  }

  if (normalized.startsWith('uploads/')) {
    return `/${normalized}`;
  }

  if (normalized.startsWith('/')) {
    return normalized;
  }

  return `/${normalized.replace(/^\.\//, '')}`;
}

function displaySlideshow(list) {
  slideshow.innerHTML = '';

  list.forEach((product) => {
    const item = document.createElement('div');
    item.className = 'slide-item';

    const name = document.createElement('span');
    name.textContent = product.name;

    const image = document.createElement('img');
    image.src = getProductImages(product)[0];
    image.alt = `${product.name} product image`;
    image.loading = 'lazy';
    image.addEventListener('error', () => {
      image.src = fallbackImage;
    });

    item.appendChild(image);
    item.appendChild(name);
    item.addEventListener('click', () => openModal(product));
    slideshow.appendChild(item);
  });
}

function updateModalImage() {
  if (!selectedImages.length) {
    modalImage.src = fallbackImage;
    prevImageBtn.disabled = true;
    nextImageBtn.disabled = true;
    return;
  }

  modalImage.src = selectedImages[selectedImageIndex];
  prevImageBtn.disabled = selectedImages.length === 1;
  nextImageBtn.disabled = selectedImages.length === 1;
}

function openModal(product) {
  selectedProduct = product;
  selectedImages = getProductImages(product);
  selectedImageIndex = 0;

  modalName.textContent = product.name;
  modalPrice.textContent = `Price: ₹${Number(product.price).toFixed(2)}`;
  modalCategory.textContent = `Category: ${product.category_name || 'General'}`;
  qty.value = 1;
  addressHomeInput.value = '';
  addressStreetInput.value = '';
  addressLandmarkInput.value = '';
  addressVillageInput.value = '';
  addressTownInput.value = '';
  updateModalImage();
  modal.style.display = 'flex';
}

modalImage.addEventListener('click', () => {
  lightboxImage.src = selectedImages[selectedImageIndex] || fallbackImage;
  lightbox.style.display = 'flex';
});

prevImageBtn.addEventListener('click', () => {
  if (selectedImages.length < 2) return;
  selectedImageIndex = (selectedImageIndex - 1 + selectedImages.length) % selectedImages.length;
  updateModalImage();
});

nextImageBtn.addEventListener('click', () => {
  if (selectedImages.length < 2) return;
  selectedImageIndex = (selectedImageIndex + 1) % selectedImages.length;
  updateModalImage();
});

closeModal.addEventListener('click', () => {
  modal.style.display = 'none';
});

window.addEventListener('click', (event) => {
  if (event.target === modal) {
    modal.style.display = 'none';
  }

  if (event.target === lightbox) {
    lightbox.style.display = 'none';
  }
});

closeLightbox.addEventListener('click', () => {
  lightbox.style.display = 'none';
});

searchInput.addEventListener('input', () => {
  const search = searchInput.value.toLowerCase().trim();
  const filtered = products.filter((product) => product.name.toLowerCase().includes(search));
  displayProducts(filtered);
});

buyBtn.addEventListener('click', async () => {
  if (!selectedProduct) return;

  const addressParts = {
    homeNumber: addressHomeInput.value.trim(),
    street: addressStreetInput.value.trim(),
    landmark: addressLandmarkInput.value.trim(),
    village: addressVillageInput.value.trim(),
    town: addressTownInput.value.trim()
  };

  if (Object.values(addressParts).some((field) => !field)) {
    alert('Please fill Home Number, Street, Landmark, Village, and Town.');
    return;
  }

  const address = `${addressParts.homeNumber}, ${addressParts.street}, ${addressParts.landmark}, ${addressParts.village}, ${addressParts.town}`;

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
