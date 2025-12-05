import mongoose from 'mongoose';

const connectDB = async (): Promise<void> => {
  try {
    const mongoURI: string = "mongodb+srv://Omify:Omify2025@cluster0.yzkok.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
    
    // Log for debugging
    console.log('Connecting to MongoDB...');
    
    // Connect using mongoose
    await mongoose.connect(mongoURI, {
      // Serverless optimized options
      maxPoolSize: 10, // Limit connections
      serverSelectionTimeoutMS: 5000, // Timeout after 5s
      socketTimeoutMS: 45000, // Close sockets after 45s of inactivity
    });

    console.log('✅ MongoDB Connected Successfully');

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      console.error('❌ MongoDB connection error:', err);
    });

    mongoose.connection.on('disconnected', () => {
      console.log('⚠️ MongoDB disconnected');
    });

    mongoose.connection.on('reconnected', () => {
      console.log('✅ MongoDB reconnected');
    });

    // Graceful shutdown for serverless
    process.on('SIGINT', async () => {
      await mongoose.connection.close();
      console.log('MongoDB connection closed through app termination');
      process.exit(0);
    });

  } catch (err) {
    console.error("❌ Error connecting to MongoDB:", err);
    // Don't exit process in serverless - just log error
    throw err;
  }
};

export default connectDB;