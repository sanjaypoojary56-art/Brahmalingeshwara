const productGrid = document.getElementById('product-grid');
const slideshow = document.getElementById('slideshow');
const searchInput = document.getElementById('search');
let products = [];

async function fetchProducts(){
  const res = await fetch('/api/products');
  products = await res.json();
  displayProducts(products);
  displaySlideshow(products.slice(0,5));
}

function displayProducts(list){
  productGrid.innerHTML = '';
  list.forEach(p => {
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `<img src="${p.image_url}"><h3>${p.name}</h3><p>₹${p.price}</p>`;
    card.onclick = () => openModal(p);
    productGrid.appendChild(card);
  });
}

function displaySlideshow(list){
  slideshow.innerHTML = '';
  list.forEach(p => {
    const img = document.createElement('img');
    img.src = p.image_url;
    slideshow.appendChild(img);
  });
}

searchInput.addEventListener('input', () => {
  const search = searchInput.value.toLowerCase();
  const filtered = products.filter(p => p.name.toLowerCase().includes(search));
  displayProducts(filtered);
});

const modal = document.getElementById('product-modal');
const modalImg = document.getElementById('modal-img');
const modalName = document.getElementById('modal-name');
const modalPrice = document.getElementById('modal-price');
const qty = document.getElementById('modal-qty');
const buyBtn = document.getElementById('buy-now');
const cartBtn = document.getElementById('add-cart');
const spanClose = document.getElementsByClassName('close')[0];
let selectedProduct = null;

function openModal(p){
  selectedProduct = p;
  modalImg.src = p.image_url;
  modalName.textContent = p.name;
  modalPrice.textContent = `₹${p.price}`;
  modal.style.display = 'flex';
}

spanClose.onclick = () => { modal.style.display = 'none'; };

buyBtn.onclick = async () => {
  const address = prompt('Enter delivery address:');
  if(address){
    await fetch('/api/orders',{
      method:'POST',
      headers:{'Content-Type':'application/json'},
      body:JSON.stringify({product_id:selectedProduct.id, quantity:qty.value, address, payment_method:'Cash on Delivery'})
    });
    alert('Order placed!');
  }
};

cartBtn.onclick = async () => {
  await fetch('/api/cart',{
    method:'POST',
    headers:{'Content-Type':'application/json'},
    body:JSON.stringify({product_id:selectedProduct.id, quantity:qty.value})
  });
  alert('Added to cart!');
};

window.onload = fetchProducts;
