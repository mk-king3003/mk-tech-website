import mongoose from 'mongoose';
import dns from 'dns';

// Use Google DNS to avoid SRV resolution issues on some networks
dns.setServers(['8.8.8.8', '8.8.4.4']);

const MONGO_URI = process.env.MONGO_URI || 'mongodb+srv://mktech:mktech3003@mktech1.k9ebxva.mongodb.net/mktech?retryWrites=true&w=majority';

const FALLBACK_URI = 'mongodb://mktech:mktech3003@ac-pm1e9k2-shard-00-00.k9ebxva.mongodb.net:27017,ac-pm1e9k2-shard-00-01.k9ebxva.mongodb.net:27017,ac-pm1e9k2-shard-00-02.k9ebxva.mongodb.net:27017/mktech?ssl=true&authSource=admin&retryWrites=true&w=majority';

export async function connectDB() {
    const uri = process.env.MONGO_URI || MONGO_URI;
    let connected = false;

    // Try primary URI first
    try {
        await mongoose.connect(uri);
        connected = true;
    } catch (err) {
        if (FALLBACK_URI) {
            try {
                await mongoose.connect(FALLBACK_URI);
                connected = true;
            } catch (err2) {
                console.error('MongoDB connection failed with both URIs.');
                throw err2;
            }
        } else {
            console.error('MongoDB connection failed.');
            throw err;
        }
    }

    if (connected) {
        console.log(`\x1b[32mMongoDB connected to Atlas cluster\x1b[0m`);
    }
}

export default mongoose;
