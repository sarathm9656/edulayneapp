import LiveSession from "../../models/Live_Session.model.js";
import Batch from "../../models/Batch_table.js";
import Login from "../../models/login.model.js";
import InstructorPricing from "../../models/instructor_pricing.js";
import InstructorPayment from "../../models/instructor_payment.js";
import axios from 'axios';

// Dyte API Configuration
const DYTE_API_BASE_URL = 'https://api.dyte.io/v2';
const getDyteAuth = () => {
  const orgId = process.env.DYTE_ORG_ID;
  const apiKey = process.env.DYTE_API_KEY;
  return Buffer.from(`${orgId}:${apiKey}`).toString('base64');
};

// 🎯 Auto-generate payroll for instructor when session is completed
const generateInstructorPayroll = async (
  instructorId,
  tenantId,
  completedSession
) => {
  try {
    console.log(
      `🎯 Auto-generating payroll for instructor ${instructorId} after session completion`
    );

    // Get instructor pricing
    const instructorPricing = await InstructorPricing.findOne({
      instructor_id: instructorId,
      tenant_id: tenantId,
    });

    if (!instructorPricing) {
      console.log(`No pricing found for instructor ${instructorId}`);
      return;
    }

    // Calculate hours from completed session
    const sessionDuration =
      parseInt(completedSession.meeting_duration_completed) || 0;
    const sessionHours = sessionDuration / 60; // Convert minutes to hours
    const hourlyRate = instructorPricing.price_per_hour || 0;
    const sessionAmount = sessionHours * hourlyRate;

    // Get session date (use scheduled start time or now)
    const sessionDate = completedSession.scheduled_start_time
      ? new Date(completedSession.scheduled_start_time)
      : new Date();

    const startOfMonth = new Date(
      sessionDate.getFullYear(),
      sessionDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      sessionDate.getFullYear(),
      sessionDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    let paymentRecord = await InstructorPayment.findOne({
      instructor_id: instructorId,
      tenant_id: tenantId,
      payment_date: { $gte: startOfMonth, $lte: endOfMonth },
    });

    if (paymentRecord) {
      // Update existing payment record with new session data
      const existingHours = paymentRecord.total_hours || 0;
      const existingAmount = paymentRecord.calculated_amount || 0;

      paymentRecord.total_hours = existingHours + sessionHours;
      paymentRecord.calculated_amount = existingAmount + sessionAmount;
      paymentRecord.updated_at = new Date();

      await paymentRecord.save();
      console.log(
        `✅ Updated existing payroll record for instructor ${instructorId}: +${sessionHours}hrs, +₹${sessionAmount}`
      );
    } else {
      // Create new payment record
      const paymentData = {
        instructor_id: instructorId,
        tenant_id: tenantId,
        amount: sessionAmount,
        calculated_amount: sessionAmount,
        payment_method: "manual",
        note: `Auto-generated payment for completed session: ${completedSession.topic}`,
        payment_date: sessionDate, // Use the actual session date
        status: "pending",
        total_hours: sessionHours,
        hourly_rate: hourlyRate,
        transaction_id: `AUTO-${Date.now()}-${instructorId}`,
        processed_by: instructorId, // Use instructor as processed_by for auto-generated payments
      };

      const newPayment = await InstructorPayment.create(paymentData);
      console.log(
        `✅ Created new payroll record for instructor ${instructorId}: ${sessionHours}hrs, ₹${sessionAmount}`
      );
    }
  } catch (error) {
    console.error("Error in generateInstructorPayroll:", error);
  }
};



export const getMeetings = async (req, res) => {
  const tenantId = req.user.tenant_id;
  console.log("tenantId:", tenantId);

  try {
    // 🗄 Fetch from DB
    const dbMeetings = await LiveSession.find({ tenant_id: tenantId }).populate(
      {
        path: "batch_id",
        select: "batch_name course_id instructor_id",
        populate: {
          path: "course_id",
          select: "course_title",
        },
      }
    );

    // 📅 Monthly calculations
    const currentDate = new Date();
    const startOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth(),
      1
    );
    const endOfMonth = new Date(
      currentDate.getFullYear(),
      currentDate.getMonth() + 1,
      0,
      23,
      59,
      59,
      999
    );

    const monthlyMeetings = await LiveSession.find({
      tenant_id: tenantId,
      status: "completed",
      created_at: { $gte: startOfMonth, $lte: endOfMonth },
      meeting_duration_completed: { $exists: true, $ne: null },
    }).populate({
      path: "batch_id",
      select: "batch_name course_id instructor_id",
      populate: [
        {
          path: "course_id",
          select: "course_title",
        },
        {
          path: "instructor_id",
          select: "user_id",
          populate: {
            path: "user_id",
            select: "fname lname",
          },
        },
      ],
    });

    const totalMonthlyDuration = monthlyMeetings.reduce(
      (total, m) => total + (parseInt(m.meeting_duration_completed) || 0),
      0
    );

    // 📊 Batch working hours
    const batchWorkingHours = {};
    monthlyMeetings.forEach((meeting) => {
      try {
        if (meeting.batch_id) {
          const batchId = meeting.batch_id._id.toString();
          if (!batchWorkingHours[batchId]) {
            batchWorkingHours[batchId] = {
              batch_id: batchId,
              batch_name: meeting.batch_id.batch_name,
              instructor_id: meeting.batch_id.instructor_id
                ? meeting.batch_id.instructor_id._id.toString()
                : null,
              total_duration: 0,
              meeting_count: 0,
            };
          }
          batchWorkingHours[batchId].total_duration +=
            parseInt(meeting.meeting_duration_completed) || 0;
          batchWorkingHours[batchId].meeting_count++;
        }
      } catch (error) {
        console.error(
          "Error processing batch working hours for meeting:",
          meeting._id,
          error.message
        );
      }
    });

    // 👩‍🏫 Instructor working hours
    const instructorWorkingHours = {};
    monthlyMeetings.forEach((meeting) => {
      try {
        if (meeting.batch_id && meeting.batch_id.instructor_id) {
          const instructorId = meeting.batch_id.instructor_id._id.toString();
          const instructorName = meeting.batch_id.instructor_id.user_id
            ? `${meeting.batch_id.instructor_id.user_id.fname} ${meeting.batch_id.instructor_id.user_id.lname}`
            : "Unknown Instructor";

          if (!instructorWorkingHours[instructorId]) {
            instructorWorkingHours[instructorId] = {
              instructor_id: instructorId,
              instructor_name: instructorName,
              total_duration: 0,
              meeting_count: 0,
            };
          }
          instructorWorkingHours[instructorId].total_duration +=
            parseInt(meeting.meeting_duration_completed) || 0;
          instructorWorkingHours[instructorId].meeting_count++;
        }
      } catch (error) {
        console.error(
          "Error processing instructor working hours for meeting:",
          meeting._id,
          error.message
        );
      }
    });

    console.log("instructorWorkingHours found:", instructorWorkingHours);

    // 💰 Instructor income calculation
    const instructorIncomeData = [];
    for (const [instructorId, instructorData] of Object.entries(
      instructorWorkingHours
    )) {
      try {
        const instructorPricing = await InstructorPricing.findOne({
          instructor_id: instructorId,
          tenant_id: tenantId,
        });
        const totalHours = instructorData.total_duration / 60;
        const hourlyRate = instructorPricing
          ? instructorPricing.price_per_hour
          : 0;
        const calculatedAmount = totalHours * hourlyRate;

        const existingPayment = await InstructorPayment.findOne({
          instructor_id: instructorId,
          tenant_id: tenantId,
          payment_date: { $gte: startOfMonth, $lte: endOfMonth },
        });

        if (!existingPayment && instructorPricing) {
          const paymentData = {
            instructor_id: instructorId,
            tenant_id: tenantId,
            amount: calculatedAmount,
            calculated_amount: calculatedAmount,
            payment_method: "manual",
            note: `Monthly payment for ${currentDate.toLocaleDateString(
              "en-US",
              { month: "long", year: "numeric" }
            )}`,
            payment_date: new Date(),
            status: "pending",
            total_hours: totalHours,
            hourly_rate: hourlyRate,
            transaction_id: `PAY-${Date.now()}-${instructorId}`,
            processed_by: req.user._id,
          };
          const newPayment = await InstructorPayment.create(paymentData);
          instructorIncomeData.push({
            ...paymentData,
            payment_id: newPayment._id,
          });
        } else {
          instructorIncomeData.push({
            instructor_id: instructorId,
            instructor_name: instructorData.instructor_name,
            total_hours: totalHours,
            hourly_rate: hourlyRate,
            calculated_amount: calculatedAmount,
            payment_status: existingPayment
              ? existingPayment.status
              : "no_pricing",
            payment_id: existingPayment ? existingPayment._id : null,
            transaction_id: existingPayment
              ? existingPayment.transaction_id
              : null,
          });
        }
      } catch (err) {
        console.error("Error processing instructor:", err.message);
      }
    }

    // Process meetings for status updates based on time
    const processedMeetings = await Promise.all(
      dbMeetings.map(async (dbMeeting) => {
        const now = new Date();
        let updatedStatus = dbMeeting.status;

        // ✅ Handle status update based on time
        if (dbMeeting.scheduled_start_time) {
          const startDate = new Date(dbMeeting.scheduled_start_time); // Ensure stored as ISO string or handle accordingly
          // If stored as "HH:mm" + date context, we need to respect that. 
          // The previous code implied scheduled_start_time was "HH:mm" but also used `zoomMeeting.start_time` which was ISO.
          // In our new createMeeting we will store ISO in scheduled_start_time to be consistent.

          // Fallback if stored as simple string or ISO
          const startTime = new Date(dbMeeting.scheduled_start_time);

          // Assume 60 mins if no duration
          const duration = parseInt(dbMeeting.duration) || 60;
          const endTime = new Date(startTime.getTime() + duration * 60000);

          const nowTs = now.getTime();
          if (nowTs > endTime.getTime()) {
            updatedStatus = "completed";
            // Auto-calculate duration if not set
            if (!dbMeeting.meeting_duration_completed) {
              dbMeeting.meeting_duration_completed = duration.toString();
            }
          } else if (
            nowTs >= startTime.getTime() &&
            nowTs <= endTime.getTime()
          ) {
            updatedStatus = "ongoing";
          } else {
            updatedStatus = "scheduled";
          }

          if (updatedStatus !== dbMeeting.status) {
            dbMeeting.status = updatedStatus;
            dbMeeting.updated_at = new Date();
            await dbMeeting.save();

            // 🎯 Auto-generate payroll when session is completed
            if (
              updatedStatus === "completed" &&
              dbMeeting.batch_id &&
              dbMeeting.batch_id.instructor_id
            ) {
              try {
                await generateInstructorPayroll(
                  dbMeeting.batch_id.instructor_id._id,
                  tenantId,
                  dbMeeting
                );
              } catch (error) {
                console.error("Error auto-generating payroll:", error);
              }
            }
          }
        }

        const processedMeeting = {
          live_session_Id: dbMeeting._id,
          topic: dbMeeting.topic,
          agenda: dbMeeting.agenda,
          start_time: dbMeeting.scheduled_start_time,
          date: new Date(dbMeeting.scheduled_start_time).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          duration: dbMeeting.duration || 60,
          scheduled_start_time: dbMeeting.scheduled_start_time,
          scheduled_end_time: dbMeeting.scheduled_end_time,
          dyte_meeting_id: dbMeeting.dyte_meeting_id,
          host_url: dbMeeting.host_url,
          join_url: dbMeeting.join_url,
          status: updatedStatus,
          meeting_duration_completed:
            dbMeeting?.meeting_duration_completed || "",
          meeting_participants_count:
            dbMeeting?.meeting_participants_count || "",
          batch_id: dbMeeting.batch_id,
          tenant_id: dbMeeting.tenant_id,
          created_at: dbMeeting.created_at,
          updated_at: dbMeeting.updated_at,
        };

        return processedMeeting;
      })
    );

    res.json({
      meetings: processedMeetings,
      total_count: processedMeetings.length,
      dyte_meetings_count: processedMeetings.length,
      db_meetings_count: dbMeetings.length,
      total_monthly_duration: totalMonthlyDuration,
      batch_working_hours: Object.values(batchWorkingHours),
      instructor_working_hours: Object.values(instructorWorkingHours),
      instructor_income_data: instructorIncomeData,
    });
  } catch (error) {
    console.error("Error in getMeetings:", error);
    res
      .status(500)
      .json({ error: "Failed to fetch meetings", details: error.message });
  }
};

// Get instructor payments and work history
export const getInstructorPayments = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { instructorId } = req.query;

    let targetInstructorId = instructorId;

    // Security: If user is instructor, force view only their own
    if (req.user.role === 'instructor') {
      targetInstructorId = req.user.id || req.user.user_id;
    }

    if (!targetInstructorId) {
      return res.status(400).json({ error: "Instructor ID is required" });
    }

    // 1. Get Pricing
    const pricing = await InstructorPricing.findOne({
      instructor_id: targetInstructorId,
      tenant_id: tenantId,
    });

    const hourlyRate = pricing?.price_per_hour || 0;

    // 2. Get Completed Live Sessions (Daily Work)
    // We look for sessions where the BATCH belongs to this instructor
    // First find batches for this instructor
    const instructorBatches = await Batch.find({
      instructor_id: targetInstructorId,
      tenant_id: tenantId,
    }).select('_id');

    const batchIds = instructorBatches.map(b => b._id);

    // Find completed sessions for these batches
    const sessions = await LiveSession.find({
      batch_id: { $in: batchIds },
      status: 'completed',
      tenant_id: tenantId
    }).sort({ scheduled_start_time: -1 });

    const dailyWork = sessions.map(session => {
      const durationHours = (parseInt(session.meeting_duration_completed) || 0) / 60;
      const amount = durationHours * hourlyRate;
      const date = session.scheduled_start_time ? new Date(session.scheduled_start_time) : session.created_at;

      return {
        date: date,
        hours: parseFloat(durationHours.toFixed(2)),
        amount: Math.round(amount),
        status: 'approved', // Default to approved if completed
        topic: session.topic
      };
    });

    // 3. Get Payments (Monthly History)
    const payments = await InstructorPayment.find({
      instructor_id: targetInstructorId,
      tenant_id: tenantId
    }).sort({ payment_date: -1 });

    const monthlyBreakdown = payments.map(p => ({
      month: new Date(p.payment_date).toLocaleDateString('en-US', { month: 'long', year: 'numeric' }),
      hours: p.total_hours,
      amount: p.amount,
      status: p.status
    }));

    // 4. Calculate Stats
    const totalEarnings = payments.reduce((acc, curr) => acc + curr.amount, 0);
    const totalHours = sessions.reduce((acc, curr) => acc + ((parseInt(curr.meeting_duration_completed) || 0) / 60), 0);

    // Current Month Earnings (from sessions this month, or payments this month)
    // Let's use sessions for real-time "earned so far"
    const now = new Date();
    const currentMonthSessions = sessions.filter(s => {
      const d = s.scheduled_start_time ? new Date(s.scheduled_start_time) : new Date(s.created_at);
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    });
    const currentMonthEarnings = currentMonthSessions.reduce((acc, curr) => {
      return acc + (((parseInt(curr.meeting_duration_completed) || 0) / 60) * hourlyRate);
    }, 0);


    res.json({
      success: true,
      stats: {
        totalEarnings,
        currentMonthEarnings,
        totalHours: parseFloat(totalHours.toFixed(2))
      },
      pricing: {
        price_per_hour: hourlyRate
      },
      dailyWork: dailyWork.slice(0, 50), // Limit to last 50 entries
      monthlyBreakdown
    });

  } catch (error) {
    console.error("Error getting instructor payments:", error);
    res.status(500).json({
      error: "Failed to get instructor payments",
      details: error.message,
    });
  }
};

// Update payment status
export const updatePaymentStatus = async (req, res) => {
  try {
    const { paymentId } = req.params;
    const { status, note } = req.body;

    const payment = await InstructorPayment.findById(paymentId);
    if (!payment) {
      return res.status(404).json({ error: "Payment not found" });
    }

    payment.status = status;
    if (note) payment.note = note;
    payment.updated_at = new Date();

    await payment.save();

    res.json({
      success: true,
      message: "Payment status updated successfully",
      payment: {
        payment_id: payment._id,
        status: payment.status,
        note: payment.note,
        updated_at: payment.updated_at,
      },
    });
  } catch (error) {
    console.error("Error updating payment status:", error);
    res.status(500).json({
      error: "Failed to update payment status",
      details: error.message,
    });
  }
};

export const createMeeting = async (req, res) => {
  try {
    console.log("Creating new Dyte meeting with data:", req.body);
    const tenantId = req.user.tenant_id;
    const { topic, start_time, duration, agenda, batch_id } = req.body;

    // 1. Create Dyte Meeting via API
    const dyteResponse = await axios.post(
      `${DYTE_API_BASE_URL}/meetings`,
      {
        title: topic,
        preferred_region: 'ap-south-1',
        record_on_start: false,
      },
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Basic ${getDyteAuth()}`,
        },
      }
    );

    if (!dyteResponse.data || !dyteResponse.data.data) {
      throw new Error("Failed to create meeting on Dyte");
    }

    const dyteMeeting = dyteResponse.data.data;
    const dyteMeetingId = dyteMeeting.id;

    // Calculate end time
    const startTimeDate = new Date(start_time);
    const endTimeDate = new Date(startTimeDate.getTime() + (parseInt(duration) || 60) * 60000);

    const newMeeting = new LiveSession({
      tenant_id: tenantId,
      batch_id: batch_id || null,
      dyte_meeting_id: dyteMeetingId,
      topic,
      agenda,
      scheduled_start_time: start_time,
      scheduled_end_time: endTimeDate.toISOString(),
      duration,
      host_url: `https://app.dyte.io/meeting/${dyteMeetingId}`,
      join_url: `https://app.dyte.io/meeting/${dyteMeetingId}`,
      status: "scheduled",
    });

    await newMeeting.save();

    res.json({
      success: true,
      message: "Dyte meeting created successfully",
      live_session_Id: newMeeting._id,
      meeting: newMeeting,
    });
  } catch (error) {
    console.error("Error creating Dyte meeting:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to create Dyte meeting",
      details: error.response?.data?.message || error.message,
    });
  }
};


export const updateMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { topic, agenda, start_time, duration, status } = req.body;

    const meeting = await LiveSession.findOne({ dyte_meeting_id: meetingId });
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    // Update on Dyte
    try {
      await axios.patch(
        `${DYTE_API_BASE_URL}/meetings/${meetingId}`,
        { title: topic },
        {
          headers: {
            Authorization: `Basic ${getDyteAuth()}`,
          },
        }
      );
    } catch (apiErr) {
      console.error("Dyte API update error:", apiErr.response?.data || apiErr.message);
    }

    const startTimeDate = new Date(start_time);
    const endTimeDate = new Date(startTimeDate.getTime() + (parseInt(duration) || 60) * 60000);

    meeting.topic = topic;
    meeting.agenda = agenda;
    meeting.scheduled_start_time = start_time;
    meeting.scheduled_end_time = endTimeDate.toISOString();
    if (status) meeting.status = status;
    meeting.updated_at = new Date();

    await meeting.save();

    res.json({
      success: true,
      message: "Meeting updated successfully",
      meeting,
    });
  } catch (error) {
    console.error("Error updating Dyte meeting:", error.response?.data || error.message);
    res.status(500).json({
      error: "Failed to update meeting",
      details: error.response?.data?.message || error.message,
    });
  }
};


export const cancelMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const meeting = await LiveSession.findOne({ dyte_meeting_id: meetingId });
    if (!meeting) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    meeting.status = "cancelled";
    meeting.updated_at = new Date();
    await meeting.save();
    res.json({ message: "Meeting cancelled successfully", meeting });
  } catch (error) {
    res.status(500).json({ error: "Failed to cancel meeting", details: error.message });
  }
};


export const deleteMeeting = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const result = await LiveSession.deleteOne({ dyte_meeting_id: meetingId });

    if (result.deletedCount === 0) {
      return res.status(404).json({ error: "Meeting not found" });
    }

    res.json({ message: "Meeting deleted successfully" });
  } catch (error) {
    console.error("Error deleting meeting:", error);
    res.status(500).json({ error: "Failed to delete meeting", details: error.message });
  }
};

// Assign batch to live session
export const assignBatchToLiveSession = async (req, res) => {
  try {
    const { meetingId } = req.params;
    const { batch_id } = req.body;

    const liveSession = await LiveSession.findOne({
      dyte_meeting_id: meetingId,
    });
    if (!liveSession) {
      return res.status(404).json({ error: "Live session not found" });
    }

    liveSession.batch_id = batch_id;
    await liveSession.save();

    res.json({
      message: "Batch assigned successfully",
      liveSession,
    });
  } catch (error) {
    console.error("Error assigning batch to live session:", error);
    res.status(500).json({
      error: "Failed to assign batch to live session",
      details: error.message,
    });
  }
};

// Get live sessions by batch
export const getLiveSessionsByBatch = async (req, res) => {
  try {
    const { batchId } = req.params;

    const liveSessions = await LiveSession.find({ batch_id: batchId })
      .populate({
        path: "batch_id",
        select: "batch_name course_id instructor_id",
        populate: {
          path: "course_id",
          select: "course_title",
        },
      })
      .populate("tenant_id", "tenant_name")
      .sort({ scheduled_start_time: 1 });

    res.json({
      success: true,
      liveSessions,
    });
  } catch (error) {
    console.error("Error getting live sessions by batch:", error);
    res.status(500).json({
      error: "Failed to get live sessions by batch",
      details: error.message,
    });
  }
};

// Get live sessions with batch information
export const getMeetingsWithBatches = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const liveSessions = await LiveSession.find({ tenant_id: tenantId })
      .populate({
        path: "batch_id",
        select: "batch_name course_id instructor_id",
        populate: {
          path: "course_id",
          select: "course_title",
        },
      })
      .populate("tenant_id", "tenant_name")
      .sort({ scheduled_start_time: 1 });

    res.json({
      success: true,
      liveSessions,
    });
  } catch (error) {
    console.error("Error getting live sessions with batches:", error);
    res.status(500).json({
      error: "Failed to get live sessions with batches",
      details: error.message,
    });
  }
};

// Get live sessions for a student based on their enrolled batches
// Get live sessions for instructor - filtered by instructor's assigned batches
export const getInstructorLiveSessions = async (req, res) => {
  try {
    const instructorId = req.user.id;
    const tenantId = req.user.tenant_id;

    console.log("Debug - Instructor ID:", instructorId);
    console.log("Debug - Tenant ID:", tenantId);

    // Get instructor's assigned batches first
    const instructorBatches = await Batch.find({
      instructor_id: instructorId,
      tenant_id: tenantId,
    }).select("_id batch_name");

    const instructorBatchIds = instructorBatches.map((b) => b._id);

    if (instructorBatchIds.length === 0) {
      return res.json({
        success: true,
        liveSessions: [],
      });
    }

    // Fetch meetings from DB
    const dbMeetings = await LiveSession.find({
      batch_id: { $in: instructorBatchIds },
      tenant_id: tenantId,
    })
      .populate("batch_id", "batch_name")
      .populate("tenant_id", "tenant_name")
      .sort({ scheduled_start_time: 1 });

    const processedMeetings = await Promise.all(
      dbMeetings.map(async (dbMeeting) => {
        const now = new Date();
        let updatedStatus = dbMeeting.status;

        // ✅ Handle status update based on time
        if (dbMeeting.scheduled_start_time) {
          const startTime = new Date(dbMeeting.scheduled_start_time);
          const duration = parseInt(dbMeeting.duration) || 60;
          const endTime = new Date(startTime.getTime() + duration * 60000);

          const nowTs = now.getTime();
          if (nowTs > endTime.getTime()) {
            updatedStatus = "completed";
          } else if (
            nowTs >= startTime.getTime() &&
            nowTs <= endTime.getTime()
          ) {
            updatedStatus = "ongoing";
          } else {
            updatedStatus = "scheduled";
          }

          // Don't override cancelled
          if (dbMeeting.status === 'cancelled') {
            updatedStatus = 'cancelled';
          }

          if (updatedStatus !== dbMeeting.status) {
            dbMeeting.status = updatedStatus;
            dbMeeting.updated_at = new Date();
            await dbMeeting.save();

            // 🎯 Auto-generate payroll when session is completed
            if (
              updatedStatus === "completed" &&
              dbMeeting.batch_id
            ) {
              try {
                await generateInstructorPayroll(
                  instructorId,
                  tenantId,
                  dbMeeting
                );
              } catch (error) {
                console.error("Error auto-generating payroll:", error);
              }
            }
          }
        }

        return {
          live_session_Id: dbMeeting._id,
          topic: dbMeeting.topic,
          agenda: dbMeeting.agenda,
          start_time: dbMeeting.scheduled_start_time,
          date: new Date(dbMeeting.scheduled_start_time).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          duration: dbMeeting.duration,
          scheduled_start_time: dbMeeting.scheduled_start_time,
          scheduled_end_time: dbMeeting.scheduled_end_time,
          dyte_meeting_id: dbMeeting.dyte_meeting_id,
          passcode: dbMeeting.passcode,
          host_url: dbMeeting.host_url,
          join_url: dbMeeting.join_url,
          status: updatedStatus,
          meeting_duration_completed: dbMeeting.meeting_duration_completed,
          meeting_participants_count: dbMeeting.meeting_participants_count,
          batch_id: dbMeeting.batch_id,
          tenant_id: dbMeeting.tenant_id,
          created_at: dbMeeting.created_at,
          updated_at: dbMeeting.updated_at,
        };
      })
    );

    res.json({
      success: true,
      liveSessions: processedMeetings,
    });
  } catch (error) {
    console.error("Error getting instructor live sessions:", error);
    res.status(500).json({
      error: "Failed to get instructor live sessions",
      details: error.message,
    });
  }
};




// Update meeting status based on current time

// Update meeting status based on current time
export const updateMeetingStatus = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;
    const { meetingId } = req.params;

    // Find the meeting in database
    const dbMeeting = await LiveSession.findOne({
      dyte_meeting_id: meetingId,
      tenant_id: tenantId
    });

    if (!dbMeeting) {
      return res.status(404).json({
        success: false,
        error: "Meeting not found"
      });
    }

    const now = new Date();
    let updatedStatus = dbMeeting.status;

    // Calculate status based on current time
    if (dbMeeting.scheduled_start_time) {
      const startTime = new Date(dbMeeting.scheduled_start_time);
      const duration = parseInt(dbMeeting.duration) || 60;
      const endTime = new Date(startTime.getTime() + duration * 60000);

      const nowTs = now.getTime();

      if (nowTs > endTime.getTime()) {
        updatedStatus = "completed";
      } else if (nowTs >= startTime.getTime() && nowTs <= endTime.getTime()) {
        updatedStatus = "ongoing";
      } else {
        updatedStatus = "scheduled";
      }

      if (dbMeeting.status === 'cancelled') {
        updatedStatus = 'cancelled';
      }

      // Update the meeting status if it has changed
      if (updatedStatus !== dbMeeting.status) {
        dbMeeting.status = updatedStatus;
        dbMeeting.updated_at = new Date();
        await dbMeeting.save();
      }
    }

    res.json({
      success: true,
      data: {
        meetingId: meetingId,
        oldStatus: dbMeeting.status, // might be stale if we just updated it, but fine
        newStatus: updatedStatus,
        updated: updatedStatus !== dbMeeting.status
      }
    });

  } catch (error) {
    console.error("Error updating meeting status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update meeting status",
      details: error.message,
    });
  }
};

// Update all meeting statuses for a tenant
export const updateAllMeetingStatuses = async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    // Get all meetings for the tenant that might need update
    const dbMeetings = await LiveSession.find({
      tenant_id: tenantId,
      status: { $in: ['scheduled', 'ongoing'] }
    });

    if (dbMeetings.length === 0) {
      return res.json({
        success: true,
        message: "No meetings found to update",
        updatedCount: 0
      });
    }

    let updatedCount = 0;
    const now = new Date();
    const nowTs = now.getTime();

    for (const dbMeeting of dbMeetings) {
      try {
        let updatedStatus = dbMeeting.status;

        if (dbMeeting.scheduled_start_time) {
          const startTime = new Date(dbMeeting.scheduled_start_time);
          const duration = parseInt(dbMeeting.duration) || 60;
          const endTime = new Date(startTime.getTime() + duration * 60000);

          if (nowTs > endTime.getTime()) {
            updatedStatus = "completed";
          } else if (nowTs >= startTime.getTime() && nowTs <= endTime.getTime()) {
            updatedStatus = "ongoing";
          } else {
            updatedStatus = "scheduled";
          }

          if (dbMeeting.status === "cancelled") {
            updatedStatus = "cancelled";
          }

          if (updatedStatus !== dbMeeting.status) {
            dbMeeting.status = updatedStatus;
            dbMeeting.updated_at = new Date();
            await dbMeeting.save();
            updatedCount++;

            // 🎯 Auto-generate payroll when session is completed
            if (
              updatedStatus === "completed" &&
              dbMeeting.batch_id
              // We'd need to populate batch_id to check instructor, or just rely on meeting data if populated
            ) {
              // If we need to generate payroll, we might need instructor ID. 
              // But usually payroll generation happens when fetching instructor sessions or specific trigger.
              // For bulk update, maybe we just update status. 
              // If strict, we should populate.
              // dbMeeting is not populated here.
            }
          }
        }
      } catch (error) {
        console.error(`Error updating meeting ${dbMeeting._id}:`, error.message);
      }
    }

    res.json({
      success: true,
      message: `Updated ${updatedCount} meeting statuses`,
      updatedCount: updatedCount,
      totalMeetings: dbMeetings.length
    });

  } catch (error) {
    console.error("Error updating all meeting statuses:", error);
    res.status(500).json({
      success: false,
      error: "Failed to update meeting statuses",
      details: error.message,
    });
  }
};

export const getStudentLiveSessions = async (req, res) => {
  try {
    const loginId = req.user.id || req.user._id;
    const tenantId = req.user.tenant_id;

    // Get the user_id from the login record
    const loginRecord = await Login.findById(loginId).select('user_id');
    if (!loginRecord) {
      return res.status(404).json({ error: "Student login record not found" });
    }
    const studentId = loginRecord.user_id;

    // First, get the student's enrolled batches
    const BatchStudent = (await import("../../models/Batch_Students.js")).default;
    const enrolledBatches = await BatchStudent.find({
      student_id: loginId,
      status: { $in: ["active", "completed"] },
    }).populate({
      path: "batch_id",
      select: "batch_name course_id instructor_id subscription_enabled subscription_price",
      populate: {
        path: "course_id",
        select: "course_title",
      },
    });

    const BatchSubscription = (await import("../../models/Batch_Subscription.js")).default;
    const activeSubscriptions = await BatchSubscription.find({
      user_id: studentId,
      status: 'active'
    }).select('batch_id status');

    const subscriptionMap = activeSubscriptions.reduce((map, sub) => {
      map[sub.batch_id.toString()] = sub.status;
      return map;
    }, {});


    // Filter batches (simplified to allow all for now as per original code)
    const accessibleBatches = enrolledBatches;

    const enrolledBatchIds = accessibleBatches.map(
      (enrollment) => enrollment.batch_id._id
    );

    // Fetch from DB 
    const dbMeetings = await LiveSession.find({
      batch_id: { $in: enrolledBatchIds },
      tenant_id: tenantId,
      status: { $in: ["scheduled", "ongoing", "completed"] },
    }).populate({
      path: "batch_id",
      select: "batch_name course_id instructor_id",
      populate: {
        path: "course_id",
        select: "course_title",
      },
    }).sort({ scheduled_start_time: 1 });

    const processedMeetings = await Promise.all(
      dbMeetings.map(async (dbMeeting) => {
        const now = new Date();
        let updatedStatus = dbMeeting.status;

        // Calculate status based on current time
        if (dbMeeting.scheduled_start_time) {
          const startTime = new Date(dbMeeting.scheduled_start_time);
          const duration = parseInt(dbMeeting.duration) || 60;
          const endTime = new Date(startTime.getTime() + duration * 60000);

          const nowTs = now.getTime();
          if (nowTs > endTime.getTime()) {
            updatedStatus = "completed";
          } else if (
            nowTs >= startTime.getTime() &&
            nowTs <= endTime.getTime()
          ) {
            updatedStatus = "ongoing";
          } else {
            updatedStatus = "scheduled";
          }

          if (dbMeeting.status === 'cancelled') {
            updatedStatus = 'cancelled';
          }

          if (updatedStatus !== dbMeeting.status) {
            dbMeeting.status = updatedStatus;
            dbMeeting.updated_at = new Date();
            await dbMeeting.save();
          }
        }

        return {
          live_session_Id: dbMeeting._id,
          topic: dbMeeting.topic,
          agenda: dbMeeting.agenda,
          start_time: dbMeeting.scheduled_start_time,
          date: new Date(dbMeeting.scheduled_start_time).toLocaleDateString("en-US", {
            year: "numeric",
            month: "short",
            day: "numeric",
          }),
          duration: dbMeeting.duration,
          scheduled_start_time: dbMeeting.scheduled_start_time,
          scheduled_end_time: dbMeeting.scheduled_end_time,
          dyte_meeting_id: dbMeeting.dyte_meeting_id,
          passcode: dbMeeting.passcode,
          host_url: dbMeeting.host_url,
          join_url: dbMeeting.join_url,
          status: updatedStatus,
          meeting_duration_completed: dbMeeting.meeting_duration_completed,
          meeting_participants_count: dbMeeting.meeting_participants_count,
          batch_id: dbMeeting.batch_id,
          tenant_id: dbMeeting.tenant_id,
          created_at: dbMeeting.created_at,
          updated_at: dbMeeting.updated_at,
        };
      })
    );

    res.json({
      success: true,
      liveSessions: processedMeetings,
      enrolledBatches: enrolledBatches.map((enrollment) => ({
        batch_id: enrollment.batch_id._id,
        batch_name: enrollment.batch_id.batch_name,
        course_title: enrollment.batch_id.course_id?.course_title,
        enrollment_status: enrollment.status,
        subscription_enabled: enrollment.batch_id.subscription_enabled,
        subscription_price: enrollment.batch_id.subscription_price,
        has_active_subscription: subscriptionMap[enrollment.batch_id._id.toString()] === 'active',
      })),
    });
  } catch (error) {
    console.error("Error getting student live sessions:", error);
    res.status(500).json({
      error: "Failed to get student live sessions",
      details: error.message,
    });
  }
};
