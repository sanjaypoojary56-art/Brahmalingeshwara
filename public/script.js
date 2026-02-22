let products = [];
const slider = document.getElementById('slider');
const productsDiv = document.getElementById('products');
const searchInput = document.getElementById('search');

// Fetch products
async function fetchProducts(){
  const res = await fetch('/products');
  products = await res.json();
  renderProducts(products);
  renderSlider(products);
}

function renderProducts(list){
  productsDiv.innerHTML = '';
  list.forEach(p=>{
    const card = document.createElement('div');
    card.className = 'product-card';
    card.innerHTML = `
      <img src="${p.image_url}" alt="${p.name}">
      <div class="product-info">
        <h3>${p.name}</h3>
        <p>${p.description}</p>
        <p>₹${p.price}</p>
        <button onclick="addToCart(${p.id})">Add to Cart</button>
      </div>
    `;
    productsDiv.appendChild(card);
  });
}

function renderSlider(list){
  if(list.length===0) return;
  slider.innerHTML = `<img src="${list[0].image_url}" id="slide-img">`;
  let index = 0;
  setInterval(()=>{
    index = (index+1)%list.length;
    document.getElementById('slide-img').src = list[index].image_url;
  },3000);
}

searchInput.addEventListener('input',()=>{
  const q = searchInput.value.toLowerCase();
  renderProducts(products.filter(p=>p.name.toLowerCase().includes(q)||p.description.toLowerCase().includes(q)));
});

async function addToCart(productId){
  const res = await fetch('/cart/add',{method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({product_id: productId})});
  const data = await res.json();
  alert(data.message);
}

fetchProducts();
