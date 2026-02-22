// seller.js

document.addEventListener('DOMContentLoaded', () => {

    // ======== Image Preview ========
    const imgInput = document.querySelector('#product-image');
    const preview = document.querySelector('#img-preview');

    imgInput.addEventListener('change', function() {
        const file = this.files[0];
        if(file){
            const reader = new FileReader();
            reader.onload = function(e){
                preview.src = e.target.result;
            }
            reader.readAsDataURL(file);
        } else {
            preview.src = '';
        }
    });

    // ======== Add Product Form Submission ========
    const form = document.querySelector('#seller-form');
    const msgDiv = document.querySelector('#seller-msg');

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        msgDiv.textContent = '';
        const formData = new FormData(form);

        // Basic validation
        if(!formData.get('name') || !formData.get('price') || !formData.get('description') || !formData.get('image')){
            msgDiv.textContent = 'All fields are required!';
            msgDiv.style.color = 'red';
            return;
        }

        try {
            const res = await fetch('/api/products', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if(data.success){
                msgDiv.textContent = 'Product added successfully!';
                msgDiv.style.color = 'green';
                form.reset();
                preview.src = '';
                loadSellerProducts(); // refresh products list
            } else {
                msgDiv.textContent = data.message || 'Error adding product';
                msgDiv.style.color = 'red';
            }
        } catch(err){
            console.error(err);
            msgDiv.textContent = 'Server error!';
            msgDiv.style.color = 'red';
        }
    });

    // ======== Load Seller Products ========
    const productsContainer = document.querySelector('#seller-products');

    async function loadSellerProducts(){
        productsContainer.innerHTML = '<p>Loading...</p>';
        try {
            const res = await fetch('/api/seller/products');
            const products = await res.json();

            if(products.length === 0){
                productsContainer.innerHTML = '<p>No products yet.</p>';
                return;
            }

            productsContainer.innerHTML = '';
            products.forEach(p => {
                const card = document.createElement('div');
                card.classList.add('seller-product-card');
                card.innerHTML = `
                    <img src="${p.image_url}" alt="${p.name}" />
                    <div class="seller-product-info">
                        <h3>${p.name}</h3>
                        <p>${p.description}</p>
                        <p>$${p.price}</p>
                        <button class="delete-btn" data-id="${p.id}">Delete</button>
                    </div>
                `;
                productsContainer.appendChild(card);
            });

            // Attach delete event
            document.querySelectorAll('.delete-btn').forEach(btn => {
                btn.addEventListener('click', async () => {
                    const productId = btn.getAttribute('data-id');
                    if(confirm('Delete this product?')){
                        const delRes = await fetch(`/api/products/${productId}`, { method:'DELETE' });
                        const delData = await delRes.json();
                        if(delData.success){
                            loadSellerProducts();
                        } else {
                            alert('Error deleting product');
                        }
                    }
                });
            });

        } catch(err){
            console.error(err);
            productsContainer.innerHTML = '<p>Error loading products</p>';
        }
    }

    // Initial load
    loadSellerProducts();

});
