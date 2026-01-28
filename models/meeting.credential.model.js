import mongoose from 'mongoose';

const meetingCredentialSchema = new mongoose.Schema({
    tenantId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Tenant',
        required: true,
    },
    zoomApiKey: {
        type: String,
        required: true,
    },
    zoomApiSecret: {
        type: String,
        required: true,
    },
    zoomApiId:{
        type:String,
        required:true,
    }
});

const MeetingCredential = mongoose.model('MeetingCredential', meetingCredentialSchema);

export default MeetingCredential;

