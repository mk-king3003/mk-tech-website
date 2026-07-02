import mongoose from 'mongoose';
import dns from 'dns';

// Use Google DNS for reliable SRV resolution on all networks
dns.setServers(['8.8.8.8', '8.8.4.4']);

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mktech:mktech3003@mktech1.k9ebxva.mongodb.net/mktech?retryWrites=true&w=majority';

export async function connectDB() {
    const uri = process.env.MONGO_URI || MONGO_URI;

    try {
        await mongoose.connect(uri);
        console.log(`\x1b[32mMongoDB connected to Atlas cluster\x1b[0m`);
    } catch (err) {
        console.error('MongoDB connection failed.');
        throw err;
    }
}

export default mongoose;
