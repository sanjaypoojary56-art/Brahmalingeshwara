const ordersList = document.getElementById('orders-list');

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
      <img src="${order.image_url || 'https://via.placeholder.com/120x90?text=Lamp'}" alt="${order.product_name}">
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
