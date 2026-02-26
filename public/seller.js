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
 (cd "$(git rev-parse --show-toplevel)" && git apply --3way <<'EOF' 
diff --git a/public/seller.js b/public/seller.js
index 2a3984679900d61fd4ee643668a5006445306b1f..f38d896143390356d2c46861a5577dea657cba13 100644
--- a/public/seller.js
+++ b/public/seller.js
@@ -1,29 +1,78 @@
-const addBtn=document.getElementById('add-product-btn');
-addBtn.onclick=async ()=>{
-  const formData=new FormData();
-  formData.append('name',document.getElementById('product-name').value);
-  formData.append('price',document.getElementById('product-price').value);
-  formData.append('stock',document.getElementById('product-stock').value);
-  formData.append('category_id',document.getElementById('product-category').value);
-  formData.append('image',document.getElementById('product-image').files[0]);
-  const res=await fetch('/api/products',{
-    method:'POST',
-    body:formData
+const addBtn = document.getElementById('add-product-btn');
+const categorySelect = document.getElementById('product-category');
+
+async function loadCategories() {
+  const res = await fetch('/api/categories');
+  const data = await res.json();
+
+  if (!data.success || !data.categories.length) {
+    categorySelect.innerHTML = '<option value="">No category found</option>';
+    return;
+  }
+
+  categorySelect.innerHTML = data.categories
+    .map((category) => `<option value="${category.id}">${category.name}</option>`)
+    .join('');
+}
+
+addBtn.onclick = async () => {
+  const formData = new FormData();
+  formData.append('name', document.getElementById('product-name').value);
+  formData.append('price', document.getElementById('product-price').value);
+  formData.append('stock', document.getElementById('product-stock').value || 0);
+  formData.append('category_id', categorySelect.value);
+
+  const image = document.getElementById('product-image').files[0];
+  if (image) {
+    formData.append('image', image);
+  }
+
+  const res = await fetch('/api/products', {
+    method: 'POST',
+    body: formData
   });
-  const data=await res.json();
-  if(data.success) alert('Product added!');
+
+  const data = await res.json();
+
+  if (data.success) {
+    alert('Product added successfully!');
+    document.getElementById('product-name').value = '';
+    document.getElementById('product-price').value = '';
+    document.getElementById('product-stock').value = '';
+    document.getElementById('product-image').value = '';
+  } else {
+    alert(data.message || 'Unable to add product. Please login as seller.');
+  }
 };
 
-async function fetchOrders(){
-  const res=await fetch('/api/orders');
-  const orders=await res.json();
-  const tbody=document.querySelector('#orders-table tbody');
-  tbody.innerHTML='';
-  orders.forEach(o=>{
-    const tr=document.createElement('tr');
-    tr.innerHTML=`<td>${o.id}</td><td>${o.product_id}</td><td>${o.quantity}</td><td>${o.buyer_id}</td><td>${o.address}</td><td>${o.payment_method}</td><td>${o.status}</td>`;
+async function fetchOrders() {
+  const res = await fetch('/api/seller/orders');
+  const data = await res.json();
+
+  const tbody = document.querySelector('#orders-table tbody');
+  tbody.innerHTML = '';
+
+  if (!data.success || !data.orders.length) {
+    tbody.innerHTML = '<tr><td colspan="7">No orders yet.</td></tr>';
+    return;
+  }
+
+  data.orders.forEach((order) => {
+    const tr = document.createElement('tr');
+    tr.innerHTML = `
+      <td>${order.id}</td>
+      <td>${order.product_name}</td>
+      <td>${order.quantity}</td>
+      <td>${order.buyer_name}</td>
+      <td>${order.address}</td>
+      <td>${order.payment_method}</td>
+      <td>${order.status}</td>
+    `;
     tbody.appendChild(tr);
   });
 }
 
-window.onload=fetchOrders;
+window.onload = async () => {
+  await loadCategories();
+  await fetchOrders();
+};
 
EOF
)
