import mongoose from 'mongoose';

const projectSchema = new mongoose.Schema({
    title: { type: String, required: true },
    category: { type: String, required: true },
    tags: [String],
    description: { type: String, required: true },
    image: { type: String, default: '' },
    showOnHomepage: { type: Boolean, default: true }
}, { timestamps: true });

projectSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

export default mongoose.model('Project', projectSchema);
