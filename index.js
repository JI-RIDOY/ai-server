const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: "http://localhost:5173",
  credentials: true
}));
app.use(express.json());

// MongoDB connection
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASSWORD}@cluster0.tjauch4.mongodb.net/?retryWrites=true&w=majority`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Database collections
let db;
let usersCollection;
let paymentsCollection;
let atsScoresCollection; // Add this line

async function run() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || "career_connect");
    usersCollection = db.collection("users");
    paymentsCollection = db.collection("payments");
    atsScoresCollection = db.collection("ats_scores"); // Add this line
    
    await client.db("admin").command({ ping: 1 });
    console.log("✅ Successfully connected to MongoDB!");
    
    // Initialize routes after successful connection
    initializeRoutes();
    
  } catch (err) {
    console.error("❌ MongoDB connection failed:", err);
    process.exit(1);
  }
}

function initializeRoutes() {
  // User Routes
  const userRoutes = require('./routes/users')(usersCollection);
  app.use('/api/users', userRoutes);

  // Payment Routes
  const paymentRoutes = require('./routes/payments')(usersCollection, paymentsCollection);
  app.use('/api/payments', paymentRoutes);

  // ATS Score Routes - Add this
  const atsScoreRoutes = require('./routes/atsScore')(atsScoresCollection);
  app.use('/api/ats', atsScoreRoutes);

  console.log("✅ Routes initialized successfully!");
}

// Root route
app.get("/", (req, res) => {
  res.json({ 
    message: "Career Connect AI Server is running!",
    timestamp: new Date().toISOString()
  });
});

// Health check route
app.get("/health", async (req, res) => {
  try {
    // Check database connection
    await client.db("admin").command({ ping: 1 });
    res.json({ 
      status: "OK", 
      database: "Connected",
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      status: "Error", 
      database: "Disconnected",
      error: error.message 
    });
  }
});

// Start server
app.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📱 API available at http://localhost:${port}`);
  console.log("⏳ Connecting to MongoDB...");
  
  // Initialize database connection
  run().catch(console.dir);
});

// Graceful shutdown
process.on('SIGINT', async () => {
  console.log('Shutting down gracefully...');
  await client.close();
  process.exit(0);
});