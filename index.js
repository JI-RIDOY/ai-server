// server.js (update the existing file)
const express = require("express");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const port = process.env.PORT || 5000;

// Socket.io configuration
const io = new Server(server, {
  cors: {
    origin: "http://localhost:5173",
    credentials: true
  }
});

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
let connectionsCollection;
let messagesCollection;
let paymentsCollection;
let atsScoresCollection;
let interviewsCollection;
let postsCollection;
let jobsCollection;
let applicationsCollection;

// Socket.io connection handling
const onlineUsers = new Map(); // Map to track online users: userId -> socketId

io.on('connection', (socket) => {
  console.log('New client connected:', socket.id);

  // User goes online
  socket.on('user-online', (userId) => {
    onlineUsers.set(userId, socket.id);
    console.log(`User ${userId} is online`);
    
    // Notify connections that user is online
    socket.broadcast.emit('user-status-changed', {
      userId,
      status: 'online'
    });
  });

  // Join a conversation room
  socket.on('join-conversation', (conversationId) => {
    socket.join(conversationId);
    console.log(`Socket ${socket.id} joined conversation ${conversationId}`);
  });

  // Leave a conversation room
  socket.on('leave-conversation', (conversationId) => {
    socket.leave(conversationId);
    console.log(`Socket ${socket.id} left conversation ${conversationId}`);
  });

  // Send message
  socket.on('send-message', async (data) => {
    try {
      const { conversationId, senderId, receiverId, content } = data;
      
      // Save message to database
      const message = {
        conversationId,
        senderId,
        receiverId,
        content,
        timestamp: new Date(),
        read: false
      };

      const result = await messagesCollection.insertOne(message);
      message._id = result.insertedId;

      // Emit to receiver
      io.to(conversationId).emit('receive-message', message);
      
      // Emit to sender (for confirmation)
      socket.emit('message-sent', message);

      // Notify receiver if not in conversation
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('new-message-notification', {
          senderId,
          content: content.substring(0, 50) + (content.length > 50 ? '...' : '')
        });
      }

    } catch (error) {
      console.error('Error sending message:', error);
      socket.emit('message-error', { error: 'Failed to send message' });
    }
  });

  // Typing indicator
  socket.on('typing', (data) => {
    const { conversationId, userId, isTyping } = data;
    socket.to(conversationId).emit('user-typing', {
      userId,
      isTyping
    });
  });

  // Mark messages as read
  socket.on('mark-read', async (data) => {
    try {
      const { conversationId, userId } = data;
      
      await messagesCollection.updateMany(
        {
          conversationId,
          receiverId: userId,
          read: false
        },
        {
          $set: { read: true, readAt: new Date() }
        }
      );

      socket.to(conversationId).emit('messages-read', { userId });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });

  // User goes offline
  socket.on('disconnect', () => {
    // Find user by socketId and remove
    for (const [userId, socketId] of onlineUsers.entries()) {
      if (socketId === socket.id) {
        onlineUsers.delete(userId);
        console.log(`User ${userId} disconnected`);
        
        // Notify connections that user is offline
        socket.broadcast.emit('user-status-changed', {
          userId,
          status: 'offline'
        });
        break;
      }
    }
  });
});

async function run() {
  try {
    await client.connect();
    db = client.db(process.env.DB_NAME || "career_connect");
    usersCollection = db.collection("users");
    connectionsCollection = db.collection("connections");
    messagesCollection = db.collection("messages");
    paymentsCollection = db.collection("payments");
    atsScoresCollection = db.collection("ats_scores");
    interviewsCollection = db.collection("interviews");
    postsCollection = db.collection("posts");
    jobsCollection = db.collection("jobs");
    applicationsCollection = db.collection("applications");

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

  // Connections Routes
  const connectionRoutes = require('./routes/connections')(usersCollection, connectionsCollection);
  app.use('/api/connections', connectionRoutes);

  // Messages Routes
  const messageRoutes = require('./routes/messages')(usersCollection, connectionsCollection, messagesCollection);
  app.use('/api/messages', messageRoutes);

  // Payment Routes
  const paymentRoutes = require('./routes/payments')(usersCollection, paymentsCollection);
  app.use('/api/payments', paymentRoutes);

  // ATS Score Routes
  const atsScoreRoutes = require('./routes/atsScore')(atsScoresCollection);
  app.use('/api/ats', atsScoreRoutes);

  // Interview Routes
  const interviewRoutes = require('./routes/interviews')(interviewsCollection);
  app.use('/api/interviews', interviewRoutes);

  const postRoutes = require('./routes/posts')(postsCollection);
  app.use('/api/posts', postRoutes);

  const jobRoutes = require('./routes/jobs')(jobsCollection, applicationsCollection, usersCollection);
  app.use('/api/jobs', jobRoutes);

  console.log("✅ Routes initialized successfully!");
}

// Root route
app.get("/", (req, res) => {
  res.json({
    message: "Creative Career AI Server is running!",
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
server.listen(port, () => {
  console.log(`🚀 Server running on port ${port}`);
  console.log(`📱 API available at http://localhost:${port}`);
  console.log("🔌 Socket.io is ready");
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