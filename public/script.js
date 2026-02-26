diff --git a/public/script.js b/public/script.js
index a58937930c753a83d1e51e0766334cda421b2e07..3ea5cb47bafbf22d80226a405c14bd37bc9ec897 100644
--- a/public/script.js
+++ b/public/script.js
@@ -1,80 +1,169 @@
 const productGrid = document.getElementById('product-grid');
 const slideshow = document.getElementById('slideshow');
 const searchInput = document.getElementById('search');
+const menuToggle = document.getElementById('menu-toggle');
+const menuDropdown = document.getElementById('menu-dropdown');
+
+const modal = document.getElementById('product-modal');
+const modalImg = document.getElementById('modal-img');
+const modalName = document.getElementById('modal-name');
+const modalPrice = document.getElementById('modal-price');
+const modalCategory = document.getElementById('modal-category');
+const qty = document.getElementById('modal-qty');
+const buyBtn = document.getElementById('buy-now');
+const cartBtn = document.getElementById('add-cart');
+const closeModal = document.getElementById('close-modal');
+
 let products = [];
+let selectedProduct = null;
+
+menuToggle.addEventListener('click', () => {
+  menuDropdown.classList.toggle('hidden');
+});
+
+document.addEventListener('click', (event) => {
+  if (!menuToggle.contains(event.target) && !menuDropdown.contains(event.target)) {
+    menuDropdown.classList.add('hidden');
+  }
+});
 
-async function fetchProducts(){
+async function fetchProducts() {
   const res = await fetch('/api/products');
   products = await res.json();
+
   displayProducts(products);
-  displaySlideshow(products.slice(0,5));
+
+  const uniqueByCategory = [];
+  const seen = new Set();
+  products.forEach((product) => {
+    const categoryKey = product.category_id || product.category_name || product.id;
+    if (!seen.has(categoryKey)) {
+      seen.add(categoryKey);
+      uniqueByCategory.push(product);
+    }
+  });
+
+  displaySlideshow(uniqueByCategory.slice(0, 8));
 }
 
-function displayProducts(list){
+function displayProducts(list) {
   productGrid.innerHTML = '';
-  list.forEach(p => {
-    const card = document.createElement('div');
+
+  if (!list.length) {
+    productGrid.innerHTML = '<p class="empty-state">No products found.</p>';
+    return;
+  }
+
+  list.forEach((product) => {
+    const card = document.createElement('article');
     card.className = 'product-card';
-    card.innerHTML = `<img src="${p.image_url}"><h3>${p.name}</h3><p>₹${p.price}</p>`;
-    card.onclick = () => openModal(p);
+    card.innerHTML = `
+      <img src="${product.image_url || 'https://via.placeholder.com/300x220?text=Lamp'}" alt="${product.name}">
+      <h3>${product.name}</h3>
+      <p>₹${Number(product.price).toFixed(2)}</p>
+    `;
+
+    card.addEventListener('click', () => {
+      document.querySelectorAll('.product-card.active').forEach((element) => {
+        element.classList.remove('active');
+      });
+      card.classList.add('active');
+      openModal(product);
+    });
+
     productGrid.appendChild(card);
   });
 }
 
-function displaySlideshow(list){
+function displaySlideshow(list) {
   slideshow.innerHTML = '';
-  list.forEach(p => {
-    const img = document.createElement('img');
-    img.src = p.image_url;
-    slideshow.appendChild(img);
+
+  list.forEach((product) => {
+    const item = document.createElement('div');
+    item.className = 'slide-item';
+    item.innerHTML = `
+      <img src="${product.image_url || 'https://via.placeholder.com/260x180?text=Lamp'}" alt="${product.name}">
+      <span>${product.name}</span>
+    `;
+    item.addEventListener('click', () => openModal(product));
+    slideshow.appendChild(item);
   });
 }
 
+function openModal(product) {
+  selectedProduct = product;
+  modalImg.src = product.image_url || 'https://via.placeholder.com/300x220?text=Lamp';
+  modalName.textContent = product.name;
+  modalPrice.textContent = `Price: ₹${Number(product.price).toFixed(2)}`;
+  modalCategory.textContent = `Category: ${product.category_name || 'General'}`;
+  qty.value = 1;
+  modal.style.display = 'flex';
+}
+
+closeModal.addEventListener('click', () => {
+  modal.style.display = 'none';
+});
+
+window.addEventListener('click', (event) => {
+  if (event.target === modal) {
+    modal.style.display = 'none';
+  }
+});
+
 searchInput.addEventListener('input', () => {
-  const search = searchInput.value.toLowerCase();
-  const filtered = products.filter(p => p.name.toLowerCase().includes(search));
+  const search = searchInput.value.toLowerCase().trim();
+  const filtered = products.filter((product) => product.name.toLowerCase().includes(search));
   displayProducts(filtered);
 });
 
-const modal = document.getElementById('product-modal');
-const modalImg = document.getElementById('modal-img');
-const modalName = document.getElementById('modal-name');
-const modalPrice = document.getElementById('modal-price');
-const qty = document.getElementById('modal-qty');
-const buyBtn = document.getElementById('buy-now');
-const cartBtn = document.getElementById('add-cart');
-const spanClose = document.getElementsByClassName('close')[0];
-let selectedProduct = null;
+buyBtn.addEventListener('click', async () => {
+  if (!selectedProduct) return;
 
-function openModal(p){
-  selectedProduct = p;
-  modalImg.src = p.image_url;
-  modalName.textContent = p.name;
-  modalPrice.textContent = `₹${p.price}`;
-  modal.style.display = 'flex';
-}
+  const address = prompt('Enter delivery address:');
+  if (!address) {
+    alert('Address is required to place order.');
+    return;
+  }
 
-spanClose.onclick = () => { modal.style.display = 'none'; };
+  const response = await fetch('/api/orders', {
+    method: 'POST',
+    headers: { 'Content-Type': 'application/json' },
+    body: JSON.stringify({
+      product_id: selectedProduct.id,
+      quantity: Number(qty.value) || 1,
+      address,
+      payment_method: 'Cash on Delivery'
+    })
+  });
 
-buyBtn.onclick = async () => {
-  const address = prompt('Enter delivery address:');
-  if(address){
-    await fetch('/api/orders',{
-      method:'POST',
-      headers:{'Content-Type':'application/json'},
-      body:JSON.stringify({product_id:selectedProduct.id, quantity:qty.value, address, payment_method:'Cash on Delivery'})
-    });
-    alert('Order placed!');
+  const data = await response.json();
+
+  if (data.success) {
+    alert('Order placed successfully with Cash on Delivery.');
+    modal.style.display = 'none';
+  } else {
+    alert(data.message || 'Failed to place order. Please login as buyer.');
   }
-};
+});
+
+cartBtn.addEventListener('click', async () => {
+  if (!selectedProduct) return;
 
-cartBtn.onclick = async () => {
-  await fetch('/api/cart',{
-    method:'POST',
-    headers:{'Content-Type':'application/json'},
-    body:JSON.stringify({product_id:selectedProduct.id, quantity:qty.value})
+  const response = await fetch('/api/cart', {
+    method: 'POST',
+    headers: { 'Content-Type': 'application/json' },
+    body: JSON.stringify({
+      product_id: selectedProduct.id,
+      quantity: Number(qty.value) || 1
+    })
   });
-  alert('Added to cart!');
-};
 
-window.onload = fetchProducts;
+  const data = await response.json();
+  if (data.success) {
+    alert('Added to cart successfully.');
+  } else {
+    alert(data.message || 'Please login as buyer to add to cart.');
+  }
+});
+
+fetchProducts();
