const cartList = document.getElementById('cart-list');

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
