import mongoose from 'mongoose';

const storeProductSchema = new mongoose.Schema({
    title: { type: String, required: true },
    price: { type: String, required: true },
    originalPrice: { type: String, default: '' },
    category: { type: String, required: true },
    stock: { type: Number, default: 0 },
    tags: [String],
    description: { type: String, required: true },
    includedComponents: { type: String, default: '' },
    image: { type: String, default: '' }
}, { timestamps: true });

storeProductSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

export default mongoose.model('StoreProduct', storeProductSchema);
