import Razorpay from 'razorpay';
import dotenv from 'dotenv';

dotenv.config();

console.log('Razorpay Key ID:', process.env.RZP_KEY_ID ? 'Set' : 'Not set');
console.log('Razorpay Key Secret:', process.env.RZP_KEY_SECRET ? 'Set' : 'Not set');

const razorpay = new Razorpay({
    key_id: process.env.RZP_KEY_ID,
    key_secret: process.env.RZP_KEY_SECRET,
});

export default razorpay;
    