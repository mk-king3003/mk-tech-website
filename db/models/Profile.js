import mongoose from 'mongoose';

const profileSchema = new mongoose.Schema({
    whatsapp: { type: String, default: '+91 98765 43210' },
    instagram: { type: String, default: 'mktech_projects' },
    email: { type: String, default: 'support@mktechprojects.com' },
    youtube: { type: String, default: 'mktech_projects' },
    address: { type: String, default: 'Tech Park Sector-62, Block C, Noida, India' },
    priceBasic: { type: String, default: '2,999' },
    priceIntermediate: { type: String, default: '6,999' },
    priceAdvanced: { type: String, default: '14,999' },
    priceWeb: { type: String, default: '4,999' },
    featuresBasic: { type: String, default: '' },
    featuresIntermediate: { type: String, default: '' },
    featuresAdvanced: { type: String, default: '' },
    featuresCustom: { type: String, default: '' },
    featuresWeb: { type: String, default: '' }
}, { timestamps: true });

profileSchema.set('toJSON', {
    virtuals: true,
    transform: (doc, ret) => {
        ret.id = ret._id.toString();
        delete ret._id;
        delete ret.__v;
        return ret;
    }
});

export default mongoose.model('Profile', profileSchema);
