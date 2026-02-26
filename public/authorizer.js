async function fetchAuthorizerOrders() {
  const tbody = document.querySelector('#authorizer-orders-table tbody');

  try {
    const res = await fetch('/api/authorizer/orders');
    const data = await res.json();

    if (!data.success) {
      tbody.innerHTML = `<tr><td colspan="8">${data.message || 'Access denied'}</td></tr>`;
      return;
    }

    if (!data.orders.length) {
      tbody.innerHTML = '<tr><td colspan="8">No orders yet.</td></tr>';
      return;
    }

    tbody.innerHTML = data.orders
      .map(
        (order) => `
          <tr>
            <td>${order.id}</td>
            <td>${order.product_name}</td>
            <td>${order.quantity}</td>
            <td>${order.seller_name}</td>
            <td>${order.buyer_name}</td>
            <td>${order.address}</td>
            <td>${order.payment_method}</td>
            <td>${order.status}</td>
          </tr>
        `
      )
      .join('');
  } catch (_error) {
    tbody.innerHTML = '<tr><td colspan="8">Could not load authorizer orders.</td></tr>';
  }
}

window.addEventListener('DOMContentLoaded', fetchAuthorizerOrders);
