require('dotenv').config();
const express=require('express');
const session=require('express-session');
const bcrypt=require('bcrypt');
const { Pool } = require('pg');
const multer = require('multer');
const { v2: cloudinary } = require('cloudinary');
const { CloudinaryStorage } = require('multer-storage-cloudinary');

const app=express();
app.use(express.json());
app.use(express.urlencoded({extended:true}));
app.use(express.static('public'));
app.use(session({secret:process.env.SESSION_SECRET,resave:false,saveUninitialized:true}));

// Neon DB
const pool = new Pool({ connectionString: process.env.DATABASE_URL, ssl:{rejectUnauthorized:false} });

// Cloudinary
cloudinary.config({cloudinary_url:process.env.CLOUDINARY_URL});
const storage=new CloudinaryStorage({cloudinary,params:{folder:'lamp-shop',allowed_formats:['jpg','png','jpeg']}});
const parser=multer({storage});

// Register
app.post('/api/register', async (req,res)=>{
  const {username,email,password,phone,role}=req.body;
  const hash=await bcrypt.hash(password,10);
  try{
    await pool.query('INSERT INTO users(username,email,password_hash,phone,role) VALUES($1,$2,$3,$4,$5)',[username,email,hash,phone,role]);
    res.json({success:true});
  }catch(e){ res.json({success:false,error:e.message}); }
});

// Login
app.post('/api/login', async (req,res)=>{
  const {email,password}=req.body;
  const userRes=await pool.query('SELECT * FROM users WHERE email=$1',[email]);
  if(userRes.rows.length===0) return res.json({success:false});
  const user=userRes.rows[0];
  const match=await bcrypt.compare(password,user.password_hash);
  if(match){ req.session.user=user; res.json({success:true,role:user.role}); }
  else res.json({success:false});
});

// Get products
app.get('/api/products', async (req,res)=>{
  const p=await pool.query('SELECT * FROM products ORDER BY created_at DESC');
  res.json(p.rows);
});

// Add product (seller)
app.post('/api/products', parser.single('image'), async (req,res)=>{
  if(!req.session.user || req.session.user.role!=='seller') return res.json({success:false,message:'Unauthorized'});
  const {name,price,stock,category_id}=req.body;
  const image_url=req.file.path;
  try{
    await pool.query('INSERT INTO products(seller_id,name,price,stock,category_id,image_url) VALUES($1,$2,$3,$4,$5,$6)',
      [req.session.user.id,name,price,stock,category_id,image_url]);
    res.json({success:true});
  }catch(e){ res.json({success:false,error:e.message}); }
});

// Add to cart
app.post('/api/cart', async (req,res)=>{
  if(!req.session.user || req.session.user.role!=='buyer') return res.json({success:false});
  const {product_id,quantity}=req.body;
  await pool.query('INSERT INTO cart(buyer_id,product_id,quantity) VALUES($1,$2,$3)',[req.session.user.id,product_id,quantity]);
  res.json({success:true});
});

// Place order
app.post('/api/orders', async (req,res)=>{
  if(!req.session.user || req.session.user.role!=='buyer') return res.json({success:false});
  const {product_id,quantity,address,payment_method}=req.body;
  const pRes=await pool.query('SELECT price FROM products WHERE id=$1',[product_id]);
  const total_price=pRes.rows[0].price * quantity;
  await pool.query('INSERT INTO orders(buyer_id,product_id,quantity,total_price,address,payment_method) VALUES($1,$2,$3,$4,$5,$6)',
    [req.session.user.id,product_id,quantity,total_price,address,payment_method]);
  // Notification: For simplicity, just console.log
  console.log(`New order! Buyer:${req.session.user.username} Product:${product_id} Address:${address}`);
  res.json({success:true});
});

// Get all orders (seller)
app.get('/api/orders', async (req,res)=>{
  if(!req.session.user || req.session.user.role!=='seller') return res.json({success:false});
  const o=await pool.query('SELECT * FROM orders ORDER BY created_at DESC');
  res.json(o.rows);
});

app.listen(process.env.PORT||3000,()=>console.log('Server running'));
