
/**
 * Parse time string "HH:MM AM/PM" to minutes from midnight.
 */
function parseTimeToMinutes(timeStr) {
    if (!timeStr) return null;
    const match = timeStr.match(/(\d+):(\d+)\s+(AM|PM)/i);
    if (!match) return null;

    let [_, hours, minutes, period] = match;
    hours = parseInt(hours, 10);
    minutes = parseInt(minutes, 10);
    period = period.toUpperCase();

    if (period === "PM" && hours < 12) hours += 12;
    if (period === "AM" && hours === 12) hours = 0;

    return hours * 60 + minutes;
}

/**
 * Check if two time ranges overlap.
 * Range format: "HH:MM AM - HH:MM PM"
 */
function isTimeOverlap(timeRange1, timeRange2) {
    if (!timeRange1 || !timeRange2) return false;

    const [start1Str, end1Str] = timeRange1.split(" - ");
    const [start2Str, end2Str] = timeRange2.split(" - ");

    const start1 = parseTimeToMinutes(start1Str);
    const end1 = parseTimeToMinutes(end1Str);
    const start2 = parseTimeToMinutes(start2Str);
    const end2 = parseTimeToMinutes(end2Str);

    if (start1 === null || end1 === null || start2 === null || end2 === null) return false;

    // Overlap condition: Start1 < End2 && Start2 < End1
    return start1 < end2 && start2 < end1;
}

/**
 * Check if two day arrays share any common day.
 */
function isDayOverlap(days1, days2) {
    if (!days1 || !days2) return false;
    return days1.some(day => days2.includes(day));
}

/**
 * Check for batch conflicts for a student.
 * @param {Object} targetBatch - The batch being enrolled in.
 * @param {Array} existingBatches - Array of batches the student is already enrolled in.
 * @returns {Object|null} - Returns the conflicting batch if found, otherwise null.
 */
export function findBatchConflict(targetBatch, existingBatches) {
    if (!targetBatch.recurring_days || !targetBatch.batch_time) return null;

    for (const batch of existingBatches) {
        if (batch._id.toString() === targetBatch._id.toString()) continue; // Skip self if present
        if (batch.status !== 'active') continue; // Only check active batches

        if (isDayOverlap(targetBatch.recurring_days, batch.recurring_days)) {
            if (isTimeOverlap(targetBatch.batch_time, batch.batch_time)) {
                return batch;
            }
        }
    }
    return null;
}
