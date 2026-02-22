const addBtn=document.getElementById('add-product-btn');
addBtn.onclick=async ()=>{
  const formData=new FormData();
  formData.append('name',document.getElementById('product-name').value);
  formData.append('price',document.getElementById('product-price').value);
  formData.append('stock',document.getElementById('product-stock').value);
  formData.append('category_id',document.getElementById('product-category').value);
  formData.append('image',document.getElementById('product-image').files[0]);
  const res=await fetch('/api/products',{
    method:'POST',
    body:formData
  });
  const data=await res.json();
  if(data.success) alert('Product added!');
};

async function fetchOrders(){
  const res=await fetch('/api/orders');
  const orders=await res.json();
  const tbody=document.querySelector('#orders-table tbody');
  tbody.innerHTML='';
  orders.forEach(o=>{
    const tr=document.createElement('tr');
    tr.innerHTML=`<td>${o.id}</td><td>${o.product_id}</td><td>${o.quantity}</td><td>${o.buyer_id}</td><td>${o.address}</td><td>${o.payment_method}</td><td>${o.status}</td>`;
    tbody.appendChild(tr);
  });
}

window.onload=fetchOrders;
