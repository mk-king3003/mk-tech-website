import mongoose from 'mongoose';
import dns from 'dns';
import { promisify } from 'util';

const resolveSrv = promisify(dns.resolveSrv);
const resolve4 = promisify(dns.resolve4);

// Use Google DNS for reliable SRV resolution on all networks
dns.setServers(['8.8.8.8', '8.8.4.4']);

const MONGO_SRV = process.env.MONGO_URI || 'mongodb+srv://mktech:mktech3003@mktech1.k9ebxva.mongodb.net/mktech?retryWrites=true&w=majority';

const MONGO_OPTS = {
    serverSelectionTimeoutMS: 15000,
    connectTimeoutMS: 15000
};

async function buildNonSrvUri(srvUri) {
    // Parse SRV URI to extract credentials and options
    const match = srvUri.match(/mongodb\+srv:\/\/(.+?)@(.+?)\/(.+?)(\?.*)?$/);
    if (!match) return null;
    const creds = match[1];
    const host = match[2].split('?')[0];
    const db = match[3].split('?')[0];
    const params = match[4] || '';

    const srvHost = `_mongodb._tcp.${host}`;
    const records = await resolveSrv(srvHost);
    const hosts = records.map(r => `${r.name}:${r.port}`);

    if (hosts.length === 0) return null;

    const nonSrv = `mongodb://${creds}@${hosts.join(',')}/${db}?ssl=true&authSource=admin${params}`;
    return nonSrv;
}

export async function connectDB() {
    // Try SRV URI first
    try {
        await mongoose.connect(MONGO_SRV, MONGO_OPTS);
        console.log(`\x1b[32mMongoDB connected via SRV\x1b[0m`);
        return;
    } catch (err) {
        console.warn('SRV connection failed:', err.message);
    }

    // Fallback: resolve SRV records manually and build non-SRV URI
    try {
        const nonSrvUri = await buildNonSrvUri(MONGO_SRV);
        if (nonSrvUri) {
            console.log('Trying non-SRV fallback...');
            await mongoose.connect(nonSrvUri, MONGO_OPTS);
            console.log(`\x1b[32mMongoDB connected via non-SRV fallback\x1b[0m`);
            return;
        }
    } catch (err) {
        console.warn('Non-SRV fallback also failed:', err.message);
    }

    console.error('MongoDB connection failed with all methods.');
    process.exit(1);
}

export default mongoose;
