import mongoose from 'mongoose';

const adminSchema = new mongoose.Schema({
    salt: { type: String, required: true },
    hash: { type: String, required: true },
    tokens: [{
        token: String,
        expiry: Date
    }]
}, { timestamps: true, toJSON: { virtuals: true } });

adminSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

export default mongoose.model('Admin', adminSchema);
