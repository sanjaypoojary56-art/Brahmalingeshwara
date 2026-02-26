const cartList = document.getElementById('cart-list');
const fallbackImage =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="%23ffb347"/><stop offset="100%" stop-color="%236a82fb"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="18" font-family="Arial">Lamp</text></svg>';

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
      <img src="${item.image_url || fallbackImage}" alt="${item.name}" onerror="this.onerror=null;this.src='${fallbackImage}'">
      <img src="${item.image_url || 'https://via.placeholder.com/120x90?text=Lamp'}" alt="${item.name}">
      <div>
        <h3>${item.name}</h3>
        <p>Qty: ${item.quantity}</p>
        <p>Price: ₹${Number(item.price).toFixed(2)}</p>
        <p><strong>Subtotal: ₹${subtotal.toFixed(2)}</strong></p>
      </div>
    `;

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

window.onload = loadCart;
