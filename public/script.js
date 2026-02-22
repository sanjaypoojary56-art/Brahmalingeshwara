document.addEventListener('DOMContentLoaded', async ()=>{
    const container = document.querySelector('#product-container');
    container.innerHTML = '<p>Loading products...</p>';
    try{
        const res = await fetch('/api/products');
        const products = await res.json();
        container.innerHTML = '';
        products.forEach(p=>{
            const card = document.createElement('div');
            card.className = 'product-card';
            card.innerHTML = `
                <img src="${p.image_url}" />
                <h3>${p.name}</h3>
                <p>${p.description}</p>
                <p>$${p.price}</p>
            `;
            container.appendChild(card);
        });
    } catch(err){
        console.error(err);
        container.innerHTML = '<p>Error loading products</p>';
    }
});
