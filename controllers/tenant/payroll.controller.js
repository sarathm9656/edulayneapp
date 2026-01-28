import Login from "../../models/login.model.js";
import InstructorPricing from "../../models/instructor_pricing.js";
import Course from "../../models/Course.js";
import Batch from "../../models/Batch_table.js";
import LiveSession from "../../models/Live_Session.model.js";
import InstructorPayment from "../../models/instructor_payment.js";
import mongoose from "mongoose";

// Get comprehensive payroll data for all instructors
export const getPayrollData = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

    // Get all instructors for this tenant
    const instructors = await Login.find({
      tenant_id: tenant_id,
    })
      .populate("user_id role_id")
      .select("-password");

    const filteredInstructors = instructors.filter(
      (instructor) => instructor.role_id?.name === "instructor"
    );

    // Enrich instructor data with payroll information
    const enrichedInstructors = await Promise.all(
      filteredInstructors.map(async (instructor) => {
        try {
          // Get pricing information
          const pricing = await InstructorPricing.findOne({
            instructor_id: instructor._id,
          });

          // Get instructor's courses
          const courses = await Course.find({
            instructors: instructor.user_id._id,
          }).populate("category subcategory language level");

          // Get instructor's batches
          const batches = await Batch.find({
            instructor_id: instructor._id,
          }).populate("course_id");

          // Get instructor's live sessions through batch relationship
          const liveSessions = await LiveSession.find({
            batch_id: { $in: batches.map(batch => batch._id) },
            tenant_id: tenant_id
          }).populate("batch_id");

          // Calculate total hours from completed live sessions
          const completedSessions = liveSessions.filter(
            (session) => session.status === "completed"
          );

          const totalHours = completedSessions.reduce((total, session) => {
            // Use meeting_duration_completed if available, otherwise calculate from scheduled times
            let duration = 0;
            if (session.meeting_duration_completed) {
              duration = parseInt(session.meeting_duration_completed) || 0;
            } else if (session.scheduled_start_time && session.scheduled_end_time) {
              // Calculate duration from scheduled times as fallback
              const [startHours, startMinutes] = session.scheduled_start_time.split(':').map(Number);
              const [endHours, endMinutes] = session.scheduled_end_time.split(':').map(Number);
              const startTime = startHours * 60 + startMinutes;
              const endTime = endHours * 60 + endMinutes;
              duration = endTime - startTime;
              if (duration < 0) duration += 24 * 60; // Handle next day
            }
            return total + duration / 60; // Convert minutes to hours
          }, 0);

          // Calculate total payment due
          const hourlyRate = pricing ? (pricing.payment_type === 'hourly' ? (pricing.payment_amount || pricing.price_per_hour) : pricing.price_per_hour) : 0;
          const totalPayment = pricing?.payment_type === 'salary' ? (pricing.payment_amount || 0) : (totalHours * hourlyRate);

          // Get current month's payment record
          const currentDate = new Date();
          const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
          const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

          const paymentRecord = await InstructorPayment.findOne({
            instructor_id: instructor._id,
            tenant_id: tenant_id,
            payment_date: { $gte: startOfMonth, $lte: endOfMonth }
          });

          const paymentStatus = paymentRecord ? (paymentRecord.status === 'completed' ? 'paid' : 'unpaid') : 'unpaid';

          return {
            id: instructor._id,
            email: instructor.email,
            name: instructor.user_id.fname + " " + instructor.user_id.lname,
            fname: instructor.user_id.fname,
            lname: instructor.user_id.lname,
            role: instructor.role_id.name,
            role_id: instructor.role_id._id,
            phone_number: instructor.user_id.phone_number,
            dob: instructor.user_id.dob,
            age: instructor.user_id.age,
            user_id: instructor.user_id._id,
            status: instructor.is_active,
            price_per_hour: hourlyRate,
            payment_type: pricing ? pricing.payment_type : "salary",
            payment_amount: pricing ? pricing.payment_amount : 0,
            created_at: instructor.createdAt,
            updatedAt: instructor.updatedAt,
            courses: courses.map(course => ({
              _id: course._id,
              course_title: course.course_title,
              category: course.category?.category || 'N/A',
              subcategory: course.subcategory?.subcategory_name || 'N/A',
              language: course.language?.language || 'N/A',
              level: course.level?.course_level || 'N/A',
              is_active: course.is_active
            })),
            batches: batches.map(batch => ({
              _id: batch._id,
              batch_name: batch.batch_name,
              course_title: batch.course_id?.course_title || 'N/A',
              start_date: batch.start_date,
              end_date: batch.end_date,
              status: batch.status
            })),
            liveSessions: liveSessions.map(session => ({
              _id: session._id,
              topic: session.topic,
              agenda: session.agenda,
              start_time: session.start_time,
              duration: session.meeting_duration_completed || 0,
              status: session.status,
              scheduled_start_time: session.scheduled_start_time,
              scheduled_end_time: session.scheduled_end_time,
              batch_name: session.batch_id?.batch_name || 'N/A'
            })),
            totalHours: parseFloat(totalHours.toFixed(2)),
            totalPayment: parseFloat(totalPayment.toFixed(2)),
            completedSessions: completedSessions.length,
            pendingSessions: liveSessions.filter(session => session.status === 'scheduled').length,
            ongoingSessions: liveSessions.filter(session => session.status === 'ongoing').length,
            paymentStatus: paymentStatus,
            paymentDate: paymentRecord ? paymentRecord.payment_date : null,
            transactionId: paymentRecord ? paymentRecord.transaction_id : null
          };
        } catch (error) {
          console.error(`Error processing instructor ${instructor._id}:`, error);
          return {
            id: instructor._id,
            email: instructor.email,
            name: instructor.user_id.fname + " " + instructor.user_id.lname,
            fname: instructor.user_id.fname,
            lname: instructor.user_id.lname,
            role: instructor.role_id.name,
            role_id: instructor.role_id._id,
            phone_number: instructor.user_id.phone_number,
            dob: instructor.user_id.dob,
            age: instructor.user_id.age,
            user_id: instructor.user_id._id,
            status: instructor.is_active,
            price_per_hour: 0,
            payment_type: "salary",
            payment_amount: 0,
            created_at: instructor.createdAt,
            updatedAt: instructor.updatedAt,
            courses: [],
            batches: [],
            liveSessions: [],
            totalHours: 0,
            totalPayment: 0,
            completedSessions: 0,
            pendingSessions: 0,
            ongoingSessions: 0,
            paymentStatus: 'unpaid',
            paymentDate: null,
            transactionId: null
          };
        }
      })
    );

    res.status(200).json({
      success: true,
      data: enrichedInstructors,
    });
  } catch (error) {
    console.error("Error in getPayrollData:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get payroll data for a specific instructor
export const getInstructorPayrollData = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const tenant_id = req.user.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

    // Verify instructor belongs to this tenant
    const instructor = await Login.findOne({
      _id: instructorId,
      tenant_id: tenant_id,
    }).populate("user_id role_id");

    if (!instructor || instructor.role_id?.name !== "instructor") {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    // Get pricing information
    const pricing = await InstructorPricing.findOne({
      instructor_id: instructor._id,
    });

    // Get instructor's courses
    const courses = await Course.find({
      instructors: instructor.user_id._id,
    }).populate("category subcategory language level");

    // Get instructor's batches
    const batches = await Batch.find({
      instructor_id: instructor._id,
    }).populate("course_id");

    // Get instructor's live sessions through batch relationship
    const liveSessions = await LiveSession.find({
      batch_id: { $in: batches.map(batch => batch._id) },
      tenant_id: tenant_id
    }).populate("batch_id");

    // Calculate total hours from completed live sessions
    const completedSessions = liveSessions.filter(
      (session) => session.status === "completed"
    );

    const totalHours = completedSessions.reduce((total, session) => {
      const duration = parseInt(session.duration) || 0;
      return total + duration / 60; // Convert minutes to hours
    }, 0);

    // Calculate total payment due
    const hourlyRate = pricing ? (pricing.payment_type === 'hourly' ? (pricing.payment_amount || pricing.price_per_hour) : pricing.price_per_hour) : 0;
    const totalPayment = pricing?.payment_type === 'salary' ? (pricing.payment_amount || 0) : (totalHours * hourlyRate);

    const payrollData = {
      id: instructor._id,
      email: instructor.email,
      name: instructor.user_id.fname + " " + instructor.user_id.lname,
      fname: instructor.user_id.fname,
      lname: instructor.user_id.lname,
      role: instructor.role_id.name,
      role_id: instructor.role_id._id,
      phone_number: instructor.user_id.phone_number,
      dob: instructor.user_id.dob,
      age: instructor.user_id.age,
      user_id: instructor.user_id._id,
      status: instructor.is_active,
      price_per_hour: hourlyRate,
      payment_type: pricing ? pricing.payment_type : "salary",
      payment_amount: pricing ? pricing.payment_amount : 0,
      created_at: instructor.createdAt,
      updatedAt: instructor.updatedAt,
      courses: courses.map(course => ({
        _id: course._id,
        course_title: course.course_title,
        category: course.category?.category || 'N/A',
        subcategory: course.subcategory?.subcategory_name || 'N/A',
        language: course.language?.language || 'N/A',
        level: course.level?.course_level || 'N/A',
        is_active: course.is_active
      })),
      batches: batches.map(batch => ({
        _id: batch._id,
        batch_name: batch.batch_name,
        course_title: batch.course_id?.course_title || 'N/A',
        start_date: batch.start_date,
        end_date: batch.end_date,
        status: batch.status
      })),
      liveSessions: liveSessions.map(session => ({
        _id: session._id,
        topic: session.topic,
        agenda: session.agenda,
        start_time: session.start_time,
        duration: session.duration,
        status: session.status,
        scheduled_start_time: session.scheduled_start_time,
        scheduled_end_time: session.scheduled_end_time,
        batch_name: session.batch_id?.batch_name || 'N/A'
      })),
      totalHours: parseFloat(totalHours.toFixed(2)),
      totalPayment: parseFloat(totalPayment.toFixed(2)),
      completedSessions: completedSessions.length,
      pendingSessions: liveSessions.filter(session => session.status === 'scheduled').length,
      ongoingSessions: liveSessions.filter(session => session.status === 'ongoing').length
    };

    res.status(200).json({
      success: true,
      data: payrollData,
    });
  } catch (error) {
    console.error("Error in getInstructorPayrollData:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Process payment for an instructor
export const processInstructorPayment = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const { amount, note, paymentMethod } = req.body;
    const tenant_id = req.user.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

    if (!amount || amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Valid payment amount is required",
      });
    }

    // Verify instructor belongs to this tenant
    const instructor = await Login.findOne({
      _id: instructorId,
      tenant_id: tenant_id,
    }).populate("user_id role_id");

    if (!instructor || instructor.role_id?.name !== "instructor") {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    // Get instructor's current payroll data
    const pricing = await InstructorPricing.findOne({
      instructor_id: instructor._id,
    });

    // Get instructor's batches first
    const instructorBatches = await Batch.find({
      instructor_id: instructor._id,
      tenant_id: tenant_id
    }).select('_id');

    const liveSessions = await LiveSession.find({
      batch_id: { $in: instructorBatches.map(batch => batch._id) },
      tenant_id: tenant_id,
      status: "completed",
    });

    const totalHours = liveSessions.reduce((total, session) => {
      const duration = parseInt(session.duration) || 0;
      return total + duration / 60;
    }, 0);

    const hourlyRate = pricing ? pricing.price_per_hour : 0;
    const calculatedPayment = totalHours * hourlyRate;

    // Create and save payment record
    const paymentRecord = new InstructorPayment({
      instructor_id: instructor._id,
      tenant_id: tenant_id,
      amount: parseFloat(amount),
      calculated_amount: calculatedPayment,
      payment_method: paymentMethod || 'manual',
      note: note || '',
      payment_date: new Date(),
      status: 'completed',
      total_hours: totalHours,
      hourly_rate: hourlyRate,
      processed_by: req.user._id
    });

    await paymentRecord.save();

    res.status(200).json({
      success: true,
      message: "Payment processed successfully",
      data: {
        instructor_name: instructor.user_id.fname + " " + instructor.user_id.lname,
        amount: amount,
        payment_date: paymentRecord.payment_date,
        transaction_id: paymentRecord.transaction_id
      }
    });
  } catch (error) {
    console.error("Error in processInstructorPayment:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get payroll summary for tenant
export const getPayrollSummary = async (req, res) => {
  try {
    const tenant_id = req.user.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

    // Get all instructors for this tenant
    const instructors = await Login.find({
      tenant_id: tenant_id,
    })
      .populate("user_id role_id")
      .select("-password");

    const filteredInstructors = instructors.filter(
      (instructor) => instructor.role_id?.name === "instructor"
    );

    // Calculate summary statistics
    let totalInstructors = filteredInstructors.length;
    let activeInstructors = 0;
    let totalHours = 0;
    let totalPaymentDue = 0;
    let totalCompletedSessions = 0;

    for (const instructor of filteredInstructors) {
      if (instructor.is_active) activeInstructors++;

      const pricing = await InstructorPricing.findOne({
        instructor_id: instructor._id,
      });

      // Get instructor's batches first
      const instructorBatches = await Batch.find({
        instructor_id: instructor._id,
        tenant_id: tenant_id
      }).select('_id');

      const liveSessions = await LiveSession.find({
        batch_id: { $in: instructorBatches.map(batch => batch._id) },
        tenant_id: tenant_id,
        status: "completed",
      });

      const instructorHours = liveSessions.reduce((total, session) => {
        const duration = parseInt(session.duration) || 0;
        return total + duration / 60;
      }, 0);

      const hourlyRate = pricing ? pricing.price_per_hour : 0;
      const instructorPayment = instructorHours * hourlyRate;

      totalHours += instructorHours;
      totalPaymentDue += instructorPayment;
      totalCompletedSessions += liveSessions.length;
    }

    const summary = {
      totalInstructors,
      activeInstructors,
      totalHours: parseFloat(totalHours.toFixed(2)),
      totalPaymentDue: parseFloat(totalPaymentDue.toFixed(2)),
      totalCompletedSessions,
      averageHourlyRate: totalInstructors > 0 ? parseFloat((totalPaymentDue / totalHours).toFixed(2)) : 0
    };

    res.status(200).json({
      success: true,
      data: summary,
    });
  } catch (error) {
    console.error("Error in getPayrollSummary:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get payment history for an instructor
export const getInstructorPaymentHistory = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const tenant_id = req.user.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

    // Verify instructor belongs to this tenant
    const instructor = await Login.findOne({
      _id: instructorId,
      tenant_id: tenant_id,
    }).populate("user_id role_id");

    if (!instructor || instructor.role_id?.name !== "instructor") {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    // Get payment history
    const payments = await InstructorPayment.find({
      instructor_id: instructorId,
      tenant_id: tenant_id,
    })
      .populate("processed_by", "email")
      .sort({ payment_date: -1 });

    res.status(200).json({
      success: true,
      data: payments,
    });
  } catch (error) {
    console.error("Error in getInstructorPaymentHistory:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Update payment status for an instructor
export const updatePaymentStatus = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const { status, note } = req.body;
    const tenant_id = req.user.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

    if (!status || !['paid', 'unpaid', 'pending'].includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Valid status is required (paid, unpaid, pending)",
      });
    }

    // Verify instructor belongs to this tenant
    const instructor = await Login.findOne({
      _id: instructorId,
      tenant_id: tenant_id,
    }).populate("user_id role_id");

    if (!instructor || instructor.role_id?.name !== "instructor") {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    // Get instructor's current payroll data
    const pricing = await InstructorPricing.findOne({
      instructor_id: instructor._id,
    });

    // Get instructor's batches first
    const instructorBatches = await Batch.find({
      instructor_id: instructor._id,
      tenant_id: tenant_id
    }).select('_id');

    const liveSessions = await LiveSession.find({
      batch_id: { $in: instructorBatches.map(batch => batch._id) },
      tenant_id: tenant_id,
      status: "completed",
    });

    const totalHours = liveSessions.reduce((total, session) => {
      // Use meeting_duration_completed if available, otherwise calculate from scheduled times
      let duration = 0;
      if (session.meeting_duration_completed) {
        duration = parseInt(session.meeting_duration_completed) || 0;
      } else if (session.scheduled_start_time && session.scheduled_end_time) {
        // Calculate duration from scheduled times as fallback
        const [startHours, startMinutes] = session.scheduled_start_time.split(':').map(Number);
        const [endHours, endMinutes] = session.scheduled_end_time.split(':').map(Number);
        const startTime = startHours * 60 + startMinutes;
        const endTime = endHours * 60 + endMinutes;
        duration = endTime - startTime;
        if (duration < 0) duration += 24 * 60; // Handle next day
      }
      return total + duration / 60;
    }, 0);

    const hourlyRate = pricing ? pricing.price_per_hour : 0;
    const calculatedPayment = totalHours * hourlyRate;

    // Check if there's an existing payment record for this month
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    let paymentRecord = await InstructorPayment.findOne({
      instructor_id: instructor._id,
      tenant_id: tenant_id,
      payment_date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    if (paymentRecord) {
      // Update existing payment record
      paymentRecord.status = status === 'paid' ? 'completed' : status === 'unpaid' ? 'pending' : 'pending';
      if (note) paymentRecord.note = note;
      paymentRecord.updated_at = new Date();
      await paymentRecord.save();
    } else {
      // Create new payment record
      paymentRecord = new InstructorPayment({
        instructor_id: instructor._id,
        tenant_id: tenant_id,
        amount: calculatedPayment,
        calculated_amount: calculatedPayment,
        payment_method: 'manual',
        note: note || `Payment status updated to ${status}`,
        payment_date: new Date(),
        status: status === 'paid' ? 'completed' : status === 'unpaid' ? 'pending' : 'pending',
        total_hours: totalHours,
        hourly_rate: hourlyRate,
        processed_by: req.user._id
      });
      await paymentRecord.save();
    }

    res.status(200).json({
      success: true,
      message: `Payment status updated to ${status}`,
      data: {
        instructor_name: instructor.user_id.fname + " " + instructor.user_id.lname,
        status: status,
        amount: calculatedPayment,
        total_hours: totalHours,
        hourly_rate: hourlyRate,
        payment_date: paymentRecord.payment_date,
        transaction_id: paymentRecord.transaction_id
      }
    });
  } catch (error) {
    console.error("Error in updatePaymentStatus:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};

// Get payment status for an instructor
export const getPaymentStatus = async (req, res) => {
  try {
    const { instructorId } = req.params;
    const tenant_id = req.user.tenant_id;

    if (!tenant_id) {
      return res.status(400).json({
        success: false,
        message: "Tenant ID is required",
      });
    }

    // Verify instructor belongs to this tenant
    const instructor = await Login.findOne({
      _id: instructorId,
      tenant_id: tenant_id,
    }).populate("user_id role_id");

    if (!instructor || instructor.role_id?.name !== "instructor") {
      return res.status(404).json({
        success: false,
        message: "Instructor not found",
      });
    }

    // Get current month's payment record
    const currentDate = new Date();
    const startOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth(), 1);
    const endOfMonth = new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 0, 23, 59, 59, 999);

    const paymentRecord = await InstructorPayment.findOne({
      instructor_id: instructor._id,
      tenant_id: tenant_id,
      payment_date: { $gte: startOfMonth, $lte: endOfMonth }
    });

    // Get instructor's current payroll data
    const pricing = await InstructorPricing.findOne({
      instructor_id: instructor._id,
    });

    // Get instructor's batches first
    const instructorBatches = await Batch.find({
      instructor_id: instructor._id,
      tenant_id: tenant_id
    }).select('_id');

    const liveSessions = await LiveSession.find({
      batch_id: { $in: instructorBatches.map(batch => batch._id) },
      tenant_id: tenant_id,
      status: "completed",
    });

    const totalHours = liveSessions.reduce((total, session) => {
      // Use meeting_duration_completed if available, otherwise calculate from scheduled times
      let duration = 0;
      if (session.meeting_duration_completed) {
        duration = parseInt(session.meeting_duration_completed) || 0;
      } else if (session.scheduled_start_time && session.scheduled_end_time) {
        // Calculate duration from scheduled times as fallback
        const [startHours, startMinutes] = session.scheduled_start_time.split(':').map(Number);
        const [endHours, endMinutes] = session.scheduled_end_time.split(':').map(Number);
        const startTime = startHours * 60 + startMinutes;
        const endTime = endHours * 60 + endMinutes;
        duration = endTime - startTime;
        if (duration < 0) duration += 24 * 60; // Handle next day
      }
      return total + duration / 60;
    }, 0);

    const hourlyRate = pricing ? pricing.price_per_hour : 0;
    const calculatedPayment = totalHours * hourlyRate;

    const paymentStatus = {
      instructor_id: instructor._id,
      instructor_name: instructor.user_id.fname + " " + instructor.user_id.lname,
      total_hours: parseFloat(totalHours.toFixed(2)),
      hourly_rate: hourlyRate,
      calculated_payment: parseFloat(calculatedPayment.toFixed(2)),
      payment_status: paymentRecord ? (paymentRecord.status === 'completed' ? 'paid' : 'unpaid') : 'unpaid',
      payment_date: paymentRecord ? paymentRecord.payment_date : null,
      transaction_id: paymentRecord ? paymentRecord.transaction_id : null,
      note: paymentRecord ? paymentRecord.note : null
    };

    res.status(200).json({
      success: true,
      data: paymentStatus,
    });
  } catch (error) {
    console.error("Error in getPaymentStatus:", error);
    res.status(500).json({
      success: false,
      message: "Internal server error",
      error: error.message,
    });
  }
};
