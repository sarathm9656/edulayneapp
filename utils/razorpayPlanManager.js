import razorpay from '../config/razorpay.js';

// Utility to manage Razorpay plans for batch subscriptions
export class RazorpayPlanManager {
    
    // Create a plan for a specific batch
    static async createBatchPlan(batchName, amount, batchId) {
        try {
            const plan = await razorpay.plans.create({
                period: 'monthly',
                interval: 1,
                item: {
                    name: `Batch Subscription - ${batchName}`,
                    amount: amount * 100, // Convert to paise
                    currency: 'INR',
                    description: `Monthly subscription for ${batchName}`
                },
                notes: {
                    batch_id: batchId,
                    batch_name: batchName,
                    type: 'batch_subscription'
                }
            });
            
            console.log(`Created plan for batch ${batchName}: ${plan.id}`);
            return plan;
        } catch (error) {
            console.error('Error creating Razorpay plan:', error);
            throw error;
        }
    }

    // Get existing plan for a batch (if exists)
    static async getBatchPlan(batchId) {
        try {
            const plans = await razorpay.plans.all({
                count: 100
            });
            
            const batchPlan = plans.items.find(plan => 
                plan.notes && plan.notes.batch_id === batchId
            );
            
            return batchPlan;
        } catch (error) {
            console.error('Error fetching batch plan:', error);
            return null;
        }
    }

    // Create or get existing plan for a batch
    static async createOrGetBatchPlan(batchName, amount, batchId) {
        try {
            // First try to get existing plan
            let plan = await this.getBatchPlan(batchId);
            
            if (!plan) {
                // Create new plan if doesn't exist
                plan = await this.createBatchPlan(batchName, amount, batchId);
            }
            
            return plan;
        } catch (error) {
            console.error('Error creating/getting batch plan:', error);
            throw error;
        }
    }

    // Delete a plan (if needed)
    static async deleteBatchPlan(planId) {
        try {
            // Note: Razorpay doesn't allow deleting plans that have been used
            // This is just for reference
            console.log(`Plan ${planId} cannot be deleted if it has been used for subscriptions`);
            return false;
        } catch (error) {
            console.error('Error deleting plan:', error);
            throw error;
        }
    }

    // List all plans
    static async listAllPlans() {
        try {
            const plans = await razorpay.plans.all({
                count: 100
            });
            return plans.items;
        } catch (error) {
            console.error('Error listing plans:', error);
            throw error;
        }
    }
}

// Default plan configuration
export const DEFAULT_PLAN_CONFIG = {
    period: 'monthly',
    interval: 1,
    currency: 'INR'
};

// Batch-specific plan configuration
export const createBatchPlanConfig = (batchName, amount, batchId) => ({
    period: 'monthly',
    interval: 1,
    item: {
        name: `Batch Subscription - ${batchName}`,
        amount: amount * 100, // Convert to paise
        currency: 'INR',
        description: `Monthly subscription for ${batchName}`
    },
    notes: {
        batch_id: batchId,
        batch_name: batchName,
        type: 'batch_subscription'
    }
});
