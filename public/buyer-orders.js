const ordersList = document.getElementById('orders-list');
const fallbackImage =
  'data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" width="120" height="90"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0%" stop-color="%23ffb347"/><stop offset="100%" stop-color="%236a82fb"/></linearGradient></defs><rect width="100%" height="100%" fill="url(%23g)"/><text x="50%" y="50%" dominant-baseline="middle" text-anchor="middle" fill="white" font-size="18" font-family="Arial">Product</text></svg>';

function resolveImageUrl(imageUrl) {
  if (!imageUrl) return fallbackImage;
  if (/^(https?:|data:|blob:)/i.test(imageUrl)) return imageUrl;
  if (imageUrl.startsWith('/')) return imageUrl;
  return `/uploads/${imageUrl}`;
}


function renderStatusChip(status) {
  const cls = `status-chip status-${String(status || '').toLowerCase()}`;
  return `<span class="${cls}">${status}</span>`;
}

function renderOrders(orders) {
  ordersList.innerHTML = '';

  if (!orders.length) {
    ordersList.innerHTML = '<p class="empty-state">No orders yet.</p>';
    return;
  }

  orders.forEach((order) => {
    const card = document.createElement('article');
    card.className = 'order-item';

    card.innerHTML = `
      <img src="${resolveImageUrl(order.image_url)}" alt="${order.product_name}" onerror="this.onerror=null;this.src='${fallbackImage}'">
      <div>
        <h3>${order.product_name}</h3>
        <p>Qty: ${order.quantity}</p>
        <p>Total: ₹${Number(order.total_price).toFixed(2)}</p>
        <p>Address: ${order.address}</p>
        <p>Payment: ${order.payment_method}</p>
        <p>Status: ${renderStatusChip(order.status)}</p>
      </div>
    `;

    ordersList.appendChild(card);
  });
}

async function loadOrders() {
  try {
    const response = await fetch('/api/buyer/orders');
    const data = await response.json();

    if (!data.success) {
      ordersList.innerHTML = `<p class="empty-state">${data.message || 'Please login as buyer.'}</p>`;
      return;
    }

    renderOrders(data.orders);
  } catch (_error) {
    ordersList.innerHTML = '<p class="empty-state">Could not load delivery status right now.</p>';
  }
}

window.onload = loadOrders;
