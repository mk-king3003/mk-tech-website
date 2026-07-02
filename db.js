import crypto from 'crypto';
import Admin from './db/models/Admin.js';
import Project from './db/models/Project.js';
import StoreProduct from './db/models/StoreProduct.js';
import Profile from './db/models/Profile.js';
import Inquiry from './db/models/Inquiry.js';
import Customer from './db/models/Customer.js';

// Default initial data seeds
const DEFAULT_PROJECTS = [
    {
        id: 'proj-1',
        title: 'Blind Walking Stick',
        category: 'Arduino',
        tags: ['Ultrasonic Sensor', 'Buzzer', 'Arduino Nano'],
        description: 'An intelligent guidance cane designed for the visually impaired. It utilizes ultrasonic sensors to detect obstacles within a 2-meter range, triggering distinct audible buzzers and vibration-motor alerts for navigation safety.',
        image: 'https://images.unsplash.com/photo-1516321318423-f06f85e504b3?w=500&auto=format&fit=crop&q=80',
        showOnHomepage: true
    },
    {
        id: 'proj-2',
        title: 'GPS Tracker',
        category: 'ESP32',
        tags: ['Neo-6M GPS', 'SIM800L', 'IoT'],
        description: 'Real-time geographical tracking device that logs location coordinates. It integrates a high-sensitivity GPS module to track physical assets, pushing coordinates to an active server dashboard and sending location links via SMS.',
        image: 'https://images.unsplash.com/photo-1524661135-423995f22d0b?w=500&auto=format&fit=crop&q=80',
        showOnHomepage: true
    },
    {
        id: 'proj-3',
        title: 'Smart Greenhouse',
        category: 'IoT',
        tags: ['DHT22 Sensor', 'Soil Moisture', 'Wi-Fi'],
        description: 'Autonomous crop-monitoring micro-climate system. It measures air temperature, moisture, and soil dryness. Triggers water solenoid valves automatically and sends environmental analytics to a remote cloud app.',
        image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500&auto=format&fit=crop&q=80',
        showOnHomepage: true
    },
    {
        id: 'proj-4',
        title: 'Home Automation System',
        category: 'ESP32',
        tags: ['Relay Board', 'Wi-Fi', 'Web Server'],
        description: 'Secure wireless controller enabling users to toggle home lights and appliances. Serves a responsive HTML/CSS control page directly from the ESP32 chip, allowing device switching over local networks.',
        image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=500&auto=format&fit=crop&q=80',
        showOnHomepage: true
    },
    {
        id: 'proj-5',
        title: 'WiFi Surveillance Robot',
        category: 'Custom',
        tags: ['L298N Driver', 'DC Motors', 'ESP32-CAM'],
        description: 'An autonomous or manually operated dual-motor robotics vehicle. Incorporates an onboard ESP32 camera module to broadcast live video feeds, controlled wirelessly via a custom joystick browser interface.',
        image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=500&auto=format&fit=crop&q=80',
        showOnHomepage: true
    },
    {
        id: 'proj-6',
        title: 'RFID Attendance System',
        category: 'Arduino',
        tags: ['RC522 RFID', 'LCD Display', 'RTC Module'],
        description: 'Digital security logging system for labs and classrooms. Reads high-frequency RFID cards, displays greetings and timestamps on an character LCD module, and logs attendance logs securely.',
        image: 'https://images.unsplash.com/photo-1563013544-824ae1d704d3?w=500&auto=format&fit=crop&q=80',
        showOnHomepage: true
    },
    {
        id: 'proj-7',
        title: 'Weather Monitoring Station',
        category: 'IoT',
        tags: ['BMP280 Sensor', 'ESP8266', 'ThingSpeak'],
        description: 'Compact atmospheric telemetric center. Captures exact temperature, humidity, and barometric air pressure. Uploads detailed analytical trends to the ThingSpeak Cloud dashboard for remote weather tracking.',
        image: 'https://images.unsplash.com/photo-1504608524841-42fe6f032b4b?w=500&auto=format&fit=crop&q=80',
        showOnHomepage: true
    },
    {
        id: 'proj-8',
        title: 'Smart Irrigation System',
        category: 'Arduino',
        tags: ['Soil Hydrometer', 'Submersible Pump', 'Solar'],
        description: 'Eco-conscious automated agriculture setup. Evaluates real-time moisture conditions in soil and operates a low-voltage water pump selectively. Engineered with low standby power for solar-panel setups.',
        image: 'https://images.unsplash.com/photo-1463123081488-729f60801520?w=500&auto=format&fit=crop&q=80',
        showOnHomepage: true
    }
];

const DEFAULT_PROFILE = {
    whatsapp: '+91 98765 43210',
    instagram: 'mktech_projects',
    email: 'support@mktechprojects.com',
    youtube: 'mktech_projects',
    address: 'Tech Park Sector-62, Block C, Noida, India',
    priceBasic: '2,999',
    priceIntermediate: '6,999',
    priceAdvanced: '14,999',
    featuresBasic: [
        'Standard Arduino UNO/Nano Core',
        'Interfacing up to 2 basic sensors',
        'Fully commented source code',
        'Circuit connection diagram',
        '1-Week post-delivery troubleshooting'
    ].join('\n'),
    featuresIntermediate: [
        'ESP32 / Arduino Mega Hardware',
        'Up to 4 active sensors and actuators',
        'Custom algorithm optimization',
        'Step-by-step assembly guide',
        'High-quality circuit design',
        '2-Weeks active technical support'
    ].join('\n'),
    featuresAdvanced: [
        'Cloud telemetry (Blynk, Adafruit, AWS)',
        'Custom high-density PCB schematic',
        'Multi-sensor data logging & dashboards',
        'Professional project report structure',
        'Live video demonstration & guide',
        '30 days premium support'
    ].join('\n'),
    featuresCustom: [
        'Fully customized component sourcing',
        'Multi-layer high precision PCB layouts',
        'Full tech stack web-control integration',
        'Comprehensive patent/report documentation',
        'Continuous dedicated support'
    ].join('\n'),
    priceWeb: '4,999',
    featuresWeb: [
        'Responsive frontend (HTML/CSS/JS)',
        'Backend API & database integration',
        'Custom admin dashboard panel',
        'SEO optimization & performance',
        '1-month post-launch support'
    ].join('\n')
};

const DEFAULT_INQUIRIES = [
    {
        id: 'inq-1',
        date: new Date().toLocaleString(),
        name: 'Amit Patel',
        phone: '+91 99887 76655',
        email: 'amit.patel@gmail.com',
        category: 'IoT',
        project: 'Smart Greenhouse',
        message: 'I want this project for my final year submission. I need Altium PCB designs and full coding support using Blynk Cloud. Please send me quotes.'
    },
    {
        id: 'inq-2',
        date: new Date().toLocaleString(),
        name: 'Sneha Rao',
        phone: '+91 88776 65544',
        email: 'sneha.r@outlook.com',
        category: 'Arduino',
        project: 'Blind Walking Stick',
        message: 'Can you deliver this by next Friday? I also want to add a GSM module to send SMS notifications to guardians. Please let me know the extra cost.'
    }
];

const DEFAULT_STORE = [
    {
        id: 'kit-1',
        title: 'Blynk Home Automation Kit',
        price: '1,899',
        originalPrice: '2,499',
        category: 'IoT Automation',
        stock: 5,
        tags: ['ESP32', 'Relays', 'Blynk App', 'Home Automation'],
        description: 'Complete 4-channel smart home automation kit. Control lights, fans, and home appliances wirelessly over local Wi-Fi or cellular networks using the Blynk cloud application dashboard. Fully soldered with isolation optocouplers and step-down power adapters.',
        includedComponents: 'Fully soldered ESP32 control board, 4-Channel isolated relay block, acrylic layout frame, 5V power adapter, connecting wires, full source code and setup manual.',
        image: 'https://images.unsplash.com/photo-1558002038-1055907df827?w=500&auto=format&fit=crop&q=80'
    },
    {
        id: 'kit-2',
        title: 'Obstacle Avoiding Robot Kit',
        price: '3,499',
        originalPrice: '4,299',
        category: 'Robotics',
        stock: 3,
        tags: ['Arduino', 'HC-SR04 Sensor', 'Motor Driver', 'Autonomous Rover'],
        description: 'An advanced, autonomous vehicular robotics chassis designed to dynamically scan environments and avoid collisions. Features ultrasonic panning servo arrays and high-traction dual gearboxes.',
        includedComponents: 'Arduino UNO microcontroller, pre-wired L298N motor driver module, SG90 panning micro-servo, HC-SR04 sonar proximity sensor, dual-level acrylic robot chassis, gearbox DC motors, battery holders, firmware code, and schematic drawings.',
        image: 'https://images.unsplash.com/photo-1485827404703-89b55fcc595e?w=500&auto=format&fit=crop&q=80'
    },
    {
        id: 'kit-3',
        title: 'Smart Indoor Greenhouse Kit',
        price: '4,999',
        originalPrice: '6,499',
        category: 'Smart Agriculture',
        stock: 2,
        tags: ['ESP32', 'Soil Moisture', 'Telemetry', 'Water Pump'],
        description: 'High-accuracy automated agricultural sensor hub. Monitors temperature, humidity, and capacitive soil dryness. Dynamically logs readings to an active web dashboard and triggers micro-submersible pumps automatically.',
        includedComponents: 'ESP32 NodeMCU board, DHT22 high-precision air sensor, waterproof capacitive soil moisture sensor, 5V mini water pump with silicone tubing, single-channel isolated relay shield, status LCD module, source code, and full wiring assembly schematics.',
        image: 'https://images.unsplash.com/photo-1585320806297-9794b3e4eeae?w=500&auto=format&fit=crop&q=80'
    }
];

const DEFAULT_CUSTOMERS = [
    {
        id: 'cust-1',
        name: 'Rohan Sharma',
        phone: '+91 99999 88888',
        address: 'Flat 402, Royal Enclave, Sector-15, Rohini, Delhi, India',
        dateJoined: new Date().toLocaleDateString()
    }
];

// Helper to hash password
function hashPassword(password, salt) {
    return crypto.pbkdf2Sync(password, salt, 10000, 64, 'sha512').toString('hex');
}

// Database initialisation with MongoDB
export async function initDb() {
    const collections = {
        projects: { model: Project, data: DEFAULT_PROJECTS },
        profile: { model: Profile, data: DEFAULT_PROFILE },
        inquiries: { model: Inquiry, data: DEFAULT_INQUIRIES },
        store: { model: StoreProduct, data: DEFAULT_STORE },
        customers: { model: Customer, data: DEFAULT_CUSTOMERS }
    };

    for (const [key, { model, data }] of Object.entries(collections)) {
        const count = await model.countDocuments();
        if (count === 0) {
            if (Array.isArray(data)) {
                await model.insertMany(data);
            } else {
                await model.create(data);
            }
            console.log(`\x1b[32mSeeded ${key} collection\x1b[0m`);
        }
    }

    // Auth DB Seed (Use env var or generate random)
    const adminCount = await Admin.countDocuments();
    if (adminCount === 0) {
        const defaultPass = process.env.ADMIN_PASSCODE || 'mktech123';
        const salt = crypto.randomBytes(16).toString('hex');
        const hash = hashPassword(defaultPass, salt);
        await Admin.create({ salt, hash, tokens: [] });
        if (!process.env.ADMIN_PASSCODE) {
            console.log(`\x1b[33m[!] No ADMIN_PASSCODE env var set. Generated random password: ${defaultPass}\x1b[0m`);
            console.log(`\x1b[33m[!] Set ADMIN_PASSCODE env variable to use a custom password.\x1b[0m`);
        }
    }
}

// Read API - returns plain JS object or array
export async function readData(collectionName) {
    const modelMap = {
        projects: Project,
        profile: Profile,
        inquiries: Inquiry,
        store: StoreProduct,
        auth: Admin,
        customers: Customer
    };
    const model = modelMap[collectionName];
    if (!model) throw new Error(`Unknown collection: ${collectionName}`);

    if (collectionName === 'profile') {
        const doc = await model.findOne().lean();
        if (doc && doc._id) doc.id = doc._id.toString();
        return doc || {};
    }
    if (collectionName === 'auth') {
        const doc = await model.findOne().lean();
        if (doc && doc._id) doc.id = doc._id.toString();
        return doc || { salt: '', hash: '', tokens: [] };
    }
    const docs = await model.find().lean();
    return docs.map(doc => {
        if (doc._id) doc.id = doc._id.toString();
        return doc;
    });
}

// Write API
export async function writeData(collectionName, data) {
    const modelMap = {
        projects: Project,
        profile: Profile,
        inquiries: Inquiry,
        store: StoreProduct,
        auth: Admin,
        customers: Customer
    };
    const model = modelMap[collectionName];
    if (!model) throw new Error(`Unknown collection: ${collectionName}`);

    if (collectionName === 'profile') {
        const doc = await model.findOne();
        if (doc) {
            Object.assign(doc, data);
            await doc.save();
        } else {
            await model.create(data);
        }
        return;
    }
    if (collectionName === 'auth') {
        const doc = await model.findOne();
        if (doc) {
            Object.assign(doc, data);
            await doc.save();
        } else {
            await model.create(data);
        }
        return;
    }
    // Replace entire collection
    await model.deleteMany({});
    if (Array.isArray(data)) {
        await model.insertMany(data);
    }
}

// Hashing helper export
export function verifyPassword(password, salt, hash) {
    const checkHash = hashPassword(password, salt);
    return checkHash === hash;
}

export function generateNewHash(password) {
    const salt = crypto.randomBytes(16).toString('hex');
    const hash = hashPassword(password, salt);
    return { salt, hash };
}
