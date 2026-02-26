const addBtn = document.getElementById('add-product-btn');
const categorySelect = document.getElementById('product-category');

async function loadCategories() {
  const res = await fetch('/api/categories');
  const data = await res.json();

  if (!data.success || !data.categories.length) {
    categorySelect.innerHTML = '<option value="">No category found</option>';
    return;
  }

  categorySelect.innerHTML = data.categories
    .map((category) => `<option value="${category.id}">${category.name}</option>`)
    .join('');
}

addBtn.onclick = async () => {
  const formData = new FormData();
  formData.append('name', document.getElementById('product-name').value);
  formData.append('price', document.getElementById('product-price').value);
  formData.append('stock', document.getElementById('product-stock').value || 0);
  formData.append('category_id', categorySelect.value);

  const image = document.getElementById('product-image').files[0];
  if (image) {
    formData.append('image', image);
  }

  const res = await fetch('/api/products', {
    method: 'POST',
    body: formData
  });

  const data = await res.json();

  if (data.success) {
    alert('Product added successfully!');
    document.getElementById('product-name').value = '';
    document.getElementById('product-price').value = '';
    document.getElementById('product-stock').value = '';
    document.getElementById('product-image').value = '';
  } else {
    alert(data.message || 'Unable to add product. Please login as seller.');
  }
};

function statusDropdown(orderId, currentStatus) {
  const statuses = ['Processing', 'Packed', 'Shipped', 'Delivered', 'Cancelled'];
  return `
    <select data-order-id="${orderId}" class="order-status-select">
      ${statuses
        .map(
          (status) =>
            `<option value="${status}" ${status === currentStatus ? 'selected' : ''}>${status}</option>`
        )
        .join('')}
    </select>
  `;
}

async function updateOrderStatus(orderId, status) {
  const res = await fetch(`/api/seller/orders/${orderId}/status`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ status })
  });

  const data = await res.json();

  if (!data.success) {
    alert(data.message || 'Could not update order status');
  }
}

async function fetchOrders() {
  const res = await fetch('/api/seller/orders');
  const data = await res.json();

  const tbody = document.querySelector('#orders-table tbody');
  tbody.innerHTML = '';

  if (!data.success || !data.orders.length) {
    tbody.innerHTML = '<tr><td colspan="8">No orders yet.</td></tr>';
    return;
  }

  data.orders.forEach((order) => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td>${order.id}</td>
      <td>${order.product_name}</td>
      <td>${order.quantity}</td>
      <td>${order.buyer_name}</td>
      <td>${order.address}</td>
      <td>${order.payment_method}</td>
      <td>${order.status}</td>
      <td>
        ${statusDropdown(order.id, order.status)}
        <button class="status-update-btn" data-order-id="${order.id}">Save</button>
      </td>
    `;
    tbody.appendChild(tr);
  });

  document.querySelectorAll('.status-update-btn').forEach((button) => {
    button.addEventListener('click', async () => {
      const orderId = button.getAttribute('data-order-id');
      const select = document.querySelector(`.order-status-select[data-order-id="${orderId}"]`);
      await updateOrderStatus(orderId, select.value);
      await fetchOrders();
    });
  });
}

window.onload = async () => {
  await loadCategories();
  await fetchOrders();
};
