require('dotenv').config();

const express = require('express');
const session = require('express-session');
const bcrypt = require('bcrypt');
const { Pool } = require('pg');
const cloudinary = require('cloudinary').v2;
const multer = require('multer');
const nodemailer = require('nodemailer');
const twilio = require('twilio');

const app = express();
const upload = multer({ dest: 'uploads/' });

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static('public'));

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false
}));

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

cloudinary.config({
  secure: true
});

const twilioClient = twilio(
  process.env.TWILIO_ACCOUNT_SID,
  process.env.TWILIO_AUTH_TOKEN
);

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Login required' });
  next();
}

function requireSeller(req, res, next) {
  if (!req.session.user || req.session.user.role !== 'seller')
    return res.status(403).json({ error: 'Seller only' });
  next();
}

app.post('/api/register', async (req, res) => {
  const { username, email, password, role, phone } = req.body;
  const hash = await bcrypt.hash(password, 10);

  await pool.query(
    'INSERT INTO users(username,email,password,role,phone) VALUES($1,$2,$3,$4,$5)',
    [username, email, hash, role, phone]
  );

  res.json({ message: 'Registered successfully' });
});

app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  const result = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
  if (result.rows.length === 0) return res.status(400).json({ error: 'Invalid email' });

  const user = result.rows[0];
  const match = await bcrypt.compare(password, user.password);
  if (!match) return res.status(400).json({ error: 'Wrong password' });

  req.session.user = {
    id: user.id,
    username: user.username,
    role: user.role
  };

  res.json({ message: 'Login successful' });
});

app.post('/api/products', requireSeller, upload.single('image'), async (req, res) => {
  const { name, price, description } = req.body;

  const result = await cloudinary.uploader.upload(req.file.path);

  await pool.query(
    'INSERT INTO products(name,price,description,image_url,seller_id) VALUES($1,$2,$3,$4,$5)',
    [name, price, description, result.secure_url, req.session.user.id]
  );

  res.json({ message: 'Product added' });
});

app.get('/api/products', async (req, res) => {
  const result = await pool.query('SELECT * FROM products');
  res.json(result.rows);
});

app.post('/api/orders', requireLogin, async (req, res) => {
  const { product_id, quantity, address } = req.body;

  const productRes = await pool.query(
    'SELECT * FROM products WHERE id=$1',
    [product_id]
  );

  if (productRes.rows.length === 0)
    return res.status(404).json({ error: 'Product not found' });

  const product = productRes.rows[0];

  await pool.query(
    'INSERT INTO orders(product_id,buyer_id,quantity,address) VALUES($1,$2,$3,$4)',
    [product_id, req.session.user.id, quantity, address]
  );

  const sellerRes = await pool.query(
    'SELECT email, phone FROM users WHERE id=$1',
    [product.seller_id]
  );

  const seller = sellerRes.rows[0];

  const message = `New Order!
Product: ${product.name}
Quantity: ${quantity}
Buyer: ${req.session.user.username}
Address: ${address}`;

  await transporter.sendMail({
    from: process.env.EMAIL_USER,
    to: seller.email,
    subject: 'New Order Received',
    text: message
  });

  await twilioClient.messages.create({
    body: message,
    from: process.env.TWILIO_PHONE,
    to: seller.phone
  });

  res.json({ message: 'Order placed and seller notified' });
});

app.get('/api/seller/orders', requireSeller, async (req, res) => {
  const result = await pool.query(
    `SELECT o.*, p.name 
     FROM orders o 
     JOIN products p ON o.product_id = p.id
     WHERE p.seller_id=$1`,
    [req.session.user.id]
  );

  res.json(result.rows);
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
});
