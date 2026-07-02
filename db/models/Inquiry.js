import mongoose from 'mongoose';

const inquirySchema = new mongoose.Schema({
    name: { type: String, required: true },
    phone: { type: String, default: '' },
    email: { type: String, default: '' },
    category: { type: String, default: 'Inquiry Card' },
    project: { type: String, default: '' },
    message: { type: String, required: true },
    date: { type: String, default: () => new Date().toLocaleString() }
}, { timestamps: true });

inquirySchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

export default mongoose.model('Inquiry', inquirySchema);
