require('dotenv').config();
const express = require('express');
const bcrypt = require('bcrypt');
const session = require('express-session');
const { Pool } = require('pg');
const path = require('path');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;

const app = express();
const port = process.env.PORT || 3000;

// PostgreSQL connection
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Cloudinary config
cloudinary.config({ secure: true });

// Multer for file uploads
const upload = multer({ dest: 'temp/' });

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));
app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: true
}));

// ------------------- AUTH -------------------
// Register
app.post('/register', async (req,res)=>{
  const {username,password,role='buyer'} = req.body;
  try{
    const hash = await bcrypt.hash(password,10);
    const result = await pool.query(
      "INSERT INTO users (username,password_hash,role) VALUES ($1,$2,$3) RETURNING id,role",
      [username,hash,role]
    );
    res.json({success:true, message:'Registered'});
  } catch(e){
    res.json({success:false, message:'Username exists'});
  }
});

// Login
app.post('/login', async (req,res)=>{
  const {username,password} = req.body;
  const userRes = await pool.query("SELECT * FROM users WHERE username=$1",[username]);
  if(userRes.rows.length===0) return res.json({success:false,message:'User not found'});

  const user = userRes.rows[0];
  const valid = await bcrypt.compare(password,user.password_hash);
  if(!valid) return res.json({success:false,message:'Invalid password'});

  req.session.user = {id:user.id,role:user.role,username:user.username};
  res.json({success:true,message:'Logged in',role:user.role});
});

// Logout
app.post('/logout',(req,res)=>{
  req.session.destroy();
  res.json({success:true,message:'Logged out'});
});

// ------------------- PRODUCTS -------------------
// Get all products
app.get('/products', async (req,res)=>{
  const result = await pool.query("SELECT * FROM products ORDER BY created_at DESC");
  res.json(result.rows);
});

// Search products
app.get('/products/search', async (req,res)=>{
  const {q} = req.query;
  const result = await pool.query("SELECT * FROM products WHERE name ILIKE $1 OR description ILIKE $1",[`%${q}%`]);
  res.json(result.rows);
});

// Seller adds product
app.post('/seller/add-product', upload.single('image'), async (req,res)=>{
  const user = req.session.user;
  if(!user || user.role!=='seller') return res.status(403).json({message:'Forbidden'});

  let image_url = req.body.image_url || '';
  if(req.file){
    const result = await cloudinary.uploader.upload(req.file.path, { folder: 'lamp-shop' });
    image_url = result.secure_url;
  }

  const {name,description,price} = req.body;
  const productRes = await pool.query(
    "INSERT INTO products (seller_id,name,description,price,image_url) VALUES ($1,$2,$3,$4,$5) RETURNING *",
    [user.id,name,description,price,image_url]
  );
  res.json({message:'Product added', product: productRes.rows[0]});
});

// ------------------- CART -------------------
app.get('/cart', async (req,res)=>{
  const user = req.session.user;
  if(!user) return res.status(403).json({message:'Login required'});

  let cartRes = await pool.query("SELECT * FROM carts WHERE user_id=$1",[user.id]);
  if(cartRes.rows.length===0){
    const newCart = await pool.query("INSERT INTO carts (user_id) VALUES ($1) RETURNING *",[user.id]);
    cartRes = newCart;
  }

  const cartId = cartRes.rows[0].id;
  const items = await pool.query(
    "SELECT ci.quantity, p.* FROM cart_items ci JOIN products p ON ci.product_id=p.id WHERE ci.cart_id=$1",
    [cartId]
  );
  res.json(items.rows);
});

// Add to cart
app.post('/cart/add', async (req,res)=>{
  const user = req.session.user;
  if(!user) return res.status(403).json({message:'Login required'});

  const {product_id,quantity=1} = req.body;
  let cartRes = await pool.query("SELECT * FROM carts WHERE user_id=$1",[user.id]);
  if(cartRes.rows.length===0){
    const newCart = await pool.query("INSERT INTO carts (user_id) VALUES ($1) RETURNING *",[user.id]);
    cartRes = newCart;
  }
  const cartId = cartRes.rows[0].id;

  const exist = await pool.query("SELECT * FROM cart_items WHERE cart_id=$1 AND product_id=$2",[cartId,product_id]);
  if(exist.rows.length>0){
    await pool.query("UPDATE cart_items SET quantity=quantity+$1 WHERE cart_id=$2 AND product_id=$3",[quantity,cartId,product_id]);
  } else {
    await pool.query("INSERT INTO cart_items (cart_id,product_id,quantity) VALUES ($1,$2,$3)",[cartId,product_id,quantity]);
  }
  res.json({message:'Added to cart'});
});

// Checkout
app.post('/checkout', async (req,res)=>{
  const user = req.session.user;
  if(!user) return res.status(403).json({message:'Login required'});

  const cartRes = await pool.query("SELECT * FROM carts WHERE user_id=$1",[user.id]);
  if(cartRes.rows.length===0) return res.json({message:'Cart empty'});
  const cartId = cartRes.rows[0].id;

  const itemsRes = await pool.query(
    "SELECT ci.quantity, p.* FROM cart_items ci JOIN products p ON ci.product_id=p.id WHERE ci.cart_id=$1",
    [cartId]
  );
  if(itemsRes.rows.length===0) return res.json({message:'Cart empty'});

  const total = itemsRes.rows.reduce((sum,i)=>sum+i.price*i.quantity,0);
  const orderRes = await pool.query("INSERT INTO orders (user_id,total) VALUES ($1,$2) RETURNING *",[user.id,total]);
  const orderId = orderRes.rows[0].id;

  for(const item of itemsRes.rows){
    await pool.query("INSERT INTO order_items (order_id,product_id,quantity,price) VALUES ($1,$2,$3,$4)",[orderId,item.id,item.quantity,item.price]);
  }

  await pool.query("DELETE FROM cart_items WHERE cart_id=$1",[cartId]);
  res.json({message:'Order placed', order_id:orderId});
});

app.listen(port, ()=>console.log(`Server running on port ${port}`));
