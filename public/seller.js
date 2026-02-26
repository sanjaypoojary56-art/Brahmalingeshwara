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

async function fetchOrders() {
  const res = await fetch('/api/seller/orders');
  const data = await res.json();

  const tbody = document.querySelector('#orders-table tbody');
  tbody.innerHTML = '';

  if (!data.success || !data.orders.length) {
    tbody.innerHTML = '<tr><td colspan="7">No orders yet.</td></tr>';
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
    `;
    tbody.appendChild(tr);
  });
}

window.onload = async () => {
  await loadCategories();
  await fetchOrders();
};
