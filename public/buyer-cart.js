const cartList = document.getElementById('cart-list');
const cartModal = document.getElementById('cart-product-modal');
const cartModalImage = document.getElementById('cart-modal-image');
const cartModalName = document.getElementById('cart-modal-name');
const cartModalPrice = document.getElementById('cart-modal-price');
const cartModalQty = document.getElementById('cart-modal-qty');
const cartAddressHomeInput = document.getElementById('cart-address-home');
const cartAddressStreetInput = document.getElementById('cart-address-street');
const cartAddressLandmarkInput = document.getElementById('cart-address-landmark');
const cartAddressVillageInput = document.getElementById('cart-address-village');
const cartAddressTownInput = document.getElementById('cart-address-town');
const closeCartModal = document.getElementById('close-cart-modal');
const cartBuyNowBtn = document.getElementById('cart-buy-now');
const cartPrevImageBtn = document.getElementById('cart-modal-prev-image');
const cartNextImageBtn = document.getElementById('cart-modal-next-image');
const lightbox = document.getElementById('image-lightbox');
const lightboxImage = document.getElementById('lightbox-image');
const closeLightbox = document.getElementById('close-lightbox');

const fallbackImage =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="%23ffb347"/><stop offset="100%" stop-color="%236a82fb"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="18" font-family="Arial">Product</text></svg>';

let selectedCartItem = null;
let selectedImages = [];
let selectedImageIndex = 0;

function getProductImages(item) {
  if (Array.isArray(item?.image_urls) && item.image_urls.length) {
    return item.image_urls.map((url) => resolveImageUrl(url));
  }

  return [resolveImageUrl(item?.image_url)];
}

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return fallbackImage;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith('/')) return imageUrl;
  if (imageUrl.startsWith('uploads/')) return `/${imageUrl}`;
  return `/uploads/${imageUrl}`;
}

function updateModalImage() {
  cartModalImage.src = selectedImages[selectedImageIndex] || fallbackImage;
  cartPrevImageBtn.disabled = selectedImages.length <= 1;
  cartNextImageBtn.disabled = selectedImages.length <= 1;
}

function openCartModal(item) {
  selectedCartItem = item;
  selectedImages = getProductImages(item);
  selectedImageIndex = 0;

  cartModalName.textContent = item.name;
  cartModalPrice.textContent = `Price: ₹${Number(item.price).toFixed(2)}`;
  cartModalQty.value = item.quantity;

  cartAddressHomeInput.value = '';
  cartAddressStreetInput.value = '';
  cartAddressLandmarkInput.value = '';
  cartAddressVillageInput.value = '';
  cartAddressTownInput.value = '';

  updateModalImage();
  cartModal.style.display = 'flex';
}

function renderCart(items) {
  cartList.innerHTML = '';

  if (!items.length) {
    cartList.innerHTML = '<p class="empty-state">Your cart is empty.</p>';
    return;
  }

  let total = 0;

  items.forEach((item) => {
    const subtotal = Number(item.price) * Number(item.quantity);
    total += subtotal;

    const card = document.createElement('article');
    card.className = 'cart-item';
    card.innerHTML = `
      <img src="${getProductImages(item)[0]}" alt="${item.name}" onerror="this.onerror=null;this.src='${fallbackImage}'">
      <div>
        <h3>${item.name}</h3>
        <p>Qty: ${item.quantity}</p>
        <p>Price: ₹${Number(item.price).toFixed(2)}</p>
        <p><strong>Subtotal: ₹${subtotal.toFixed(2)}</strong></p>
        <button class="cart-buy-btn" type="button">Buy Now</button>
      </div>
    `;

    card.querySelector('.cart-buy-btn').addEventListener('click', () => openCartModal(item));
    card.querySelector('img').addEventListener('click', () => openCartModal(item));

    cartList.appendChild(card);
  });

  const totalRow = document.createElement('div');
  totalRow.className = 'cart-total';
  totalRow.textContent = `Total: ₹${total.toFixed(2)}`;
  cartList.appendChild(totalRow);
}

async function loadCart() {
  try {
    const response = await fetch('/api/cart');
    const data = await response.json();

    if (!data.success) {
      cartList.innerHTML = `<p class="empty-state">${data.message || 'Please login as buyer to view cart.'}</p>`;
      return;
    }

    renderCart(data.items);
  } catch (_error) {
    cartList.innerHTML = '<p class="empty-state">Could not load cart right now.</p>';
  }
}

cartModalImage.addEventListener('click', () => {
  lightboxImage.src = selectedImages[selectedImageIndex] || fallbackImage;
  lightbox.style.display = 'flex';
});

cartPrevImageBtn.addEventListener('click', () => {
  if (selectedImages.length <= 1) return;
  selectedImageIndex = (selectedImageIndex - 1 + selectedImages.length) % selectedImages.length;
  updateModalImage();
});

cartNextImageBtn.addEventListener('click', () => {
  if (selectedImages.length <= 1) return;
  selectedImageIndex = (selectedImageIndex + 1) % selectedImages.length;
  updateModalImage();
});

closeCartModal.addEventListener('click', () => {
  cartModal.style.display = 'none';
});

closeLightbox.addEventListener('click', () => {
  lightbox.style.display = 'none';
});

window.addEventListener('click', (event) => {
  if (event.target === cartModal) {
    cartModal.style.display = 'none';
  }

  if (event.target === lightbox) {
    lightbox.style.display = 'none';
  }
});

cartBuyNowBtn.addEventListener('click', async () => {
  if (!selectedCartItem) return;

  const addressParts = {
    homeNumber: cartAddressHomeInput.value.trim(),
    street: cartAddressStreetInput.value.trim(),
    landmark: cartAddressLandmarkInput.value.trim(),
    village: cartAddressVillageInput.value.trim(),
    town: cartAddressTownInput.value.trim()
  };

  if (Object.values(addressParts).some((value) => !value)) {
    alert('Please fill Home Number, Street, Landmark, Village, and Town.');
    return;
  }

  const response = await fetch('/api/orders', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      product_id: selectedCartItem.product_id,
      quantity: Number(cartModalQty.value) || 1,
      address: `${addressParts.homeNumber}, ${addressParts.street}, ${addressParts.landmark}, ${addressParts.village}, ${addressParts.town}`,
      payment_method: 'Cash on Delivery'
    })
  });

  const data = await response.json();

  if (!data.success) {
    alert(data.message || 'Could not place order.');
    return;
  }

  alert('Order placed successfully with Cash on Delivery.');
  cartModal.style.display = 'none';
  await loadCart();
});

window.onload = loadCart;
