import mongoose, { connect } from 'mongoose';

const connectDB = async (): Promise<void> => {
    try {
      const mongoURI: string = "mongodb+srv://Omify:Omify2025@cluster0.yzkok.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0";
      connect(mongoURI);

      console.log(mongoURI,"delmk")
  
      mongoose.connection.on('error', (err) => {
        throw new Error(`unable to connect to database: ${mongoURI}`);
      });
  
      mongoose.connection.on('connected', () => {
        console.log('MongoDB Connected...');
      });
    } catch (err) {
      console.error("Error connecting to MongoDB:", err);
      process.exit(1);
    }
  };
  

// Export the function, don't call it here
export default connectDB;
