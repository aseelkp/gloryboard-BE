import { EventRegistration } from "../models/eventRegistration.models.js";
import { Event } from "../models/event.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import { Result } from "../models/result.models.js";
import { User } from "../models/user.models.js";
import { DEPARTMENTS } from "../constants.js";

const validateParticipationLimit = async (event, participants) => {
  const eventDetails = await Event.findById(event).populate("event_type");
  const is_group = eventDetails.event_type.is_group;
  const college = (await User.findById(participants[0].user)).college;

  if (is_group) {
    const groupRegistrations = await EventRegistration.find({
      event,
      "participants.user": { $in: await User.find({ college }).select('_id') },
    });

    if (groupRegistrations.length > 0) {
      throw new ApiError(400, "Only one group participation allowed per college");
    }
  } else {
    const individualRegistrations = await EventRegistration.find({
      event,
      "participants.user": { $in: await User.find({ college }).select('_id') },
    });

    if (individualRegistrations.length >= 2) {
      throw new ApiError(400, "Only two individual participations allowed per college");
    }

    for (const participant of participants) {
      const onstageRegistrations = await EventRegistration.find({
        "participants.user": participant.user
      }).populate({
        path: 'event',
        populate: {
          path: 'event_type',
          match: { is_onstage: true }
        }
      }).exec();

      const filteredOnstageRegistrations = onstageRegistrations.filter(reg => reg.event.event_type);

      if (onstageRegistrations.length >= 4) {
        throw new ApiError(400, `Participant ${participant.user} has reached the limit of 4 onstage individual items`);
      }
    }
  }
};

const createEventRegistration = asyncHandler(async (req, res, next) => {
  const { event, group_name, participants } = req.body;

  if (!Array.isArray(participants) || participants.length === 0) {
    return next(new ApiError(400, "Participants must be a non-empty array"));
  }

  for (const participant of participants) {
    if (!participant.user || typeof participant.user !== "string") {
      return next(
        new ApiError(400, "Each participant must have a valid user_id")
      );
    }
  }

  if (!event || !participants) {
    return next(new ApiError(400, "Please provide all required fields"));
  }

  const userAlreadyRegistered = await EventRegistration.findOne({
    event,
    "participants.user": { $in: participants.map((p) => p.user) },
  });

  if (userAlreadyRegistered) {
    return next(new ApiError(409, "User already registered for this event"));
  }

  await validateParticipationLimit(event, participants);

  const eventDetails = await Event.findById(event).populate("event_type");
  const is_group = eventDetails.event_type.is_group;

  if (is_group) {
    let departmentCategory;
    for (const participant of participants) {
      const user = await User.findById(participant.user);
      const departmentGroup = Object.keys(DEPARTMENTS).find((group) =>
        DEPARTMENTS[group].includes(user.department)
      );

      if (departmentCategory && departmentCategory !== departmentGroup) {
        return next(
          new ApiError(
            400,
            "Participants must be from the same department group"
          )
        );
      }
      departmentCategory = departmentGroup;
    }
  }

  let addedEvent;

  if (is_group) {
    addedEvent = await EventRegistration.create({
      event,
      group_name,
      participants,
    });
  } else {
    addedEvent = [];
    for (const participant of participants) {
      const individualEvent = await EventRegistration.create({
        event,
        participants: [participant],
      });
      addedEvent.push(individualEvent);
    }
  }
  res
    .status(201)
    .json(
      new ApiResponse(
        201,
        addedEvent,
        "Event registration created successfully"
      )
    );
});

// Get all event registrations
const getAllEventRegistrations = asyncHandler(async (req, res, next) => {
  const { user_type, department } = req.user;

  let matchStage = {};
  if (user_type === "rep") {
    const departmentGroup = Object.keys(DEPARTMENTS).find((group) =>
      DEPARTMENTS[group].includes(department)
    );
    if (departmentGroup) {
      matchStage = {
        "participants.user.department": { $in: DEPARTMENTS[departmentGroup] },
      };
    }
  }

  const eventRegistrations = await EventRegistration.aggregate([
    {
      $lookup: {
        from: "users",
        localField: "participants.user",
        foreignField: "_id",
        as: "participants.user",
      },
    },
    { $unwind: "$participants.user" },
    { $match: matchStage },
    {
      $lookup: {
        from: "events",
        localField: "event",
        foreignField: "_id",
        as: "event",
      },
    },
    { $unwind: "$event" },
    {
      $lookup: {
        from: "eventtypes",
        localField: "event.event_type",
        foreignField: "_id",
        as: "event.event_type",
      },
    },
    { $unwind: "$event.event_type" },
    {
      $group: {
        _id: "$_id",
        event: { $first: "$event" },
        group_name: { $first: "$group_name" },
        participants: { $push: "$participants.user" },
        college : { $first: "$participants.user.college" },
        score: { $first: "$score" },
        created_at: { $first: "$created_at" },
        updated_at: { $first: "$updated_at" },
      },
    },
    {
      $project: {
        __v: 0,
        created_at: 0,
        updated_at: 0,
      },
    },
    ]);

    // if (!eventRegistrations.length) {
    //   // 204 No Content
    //   return next(new ApiError(204, "No event registrations found"));
  // }

  res
    .status(200)
    .json(
      new ApiResponse(200, eventRegistrations, "Event registrations found")
    );
});

// Get all event college registrations
const getAllEventRegistrationsCollege = asyncHandler(async (req, res, next) => {
  const college = req.user.name; // Accept college as a query parameter
  if (!college) {
    throw new ApiError(400, "College is required");
  }

  const eventRegistrations = await EventRegistration.aggregate([
    {
      $lookup: {
        from: "users", // Refers to the User collection
        localField: "participants.user",
        foreignField: "_id",
        as: "participants.user",
      },
    },
    { $unwind: "$participants.user" },
    {
      $match: {
        "participants.user.college": college, // Match by college
      },
    },
    {
      $lookup: {
        from: "events", // Refers to the Event collection
        localField: "event",
        foreignField: "_id",
        as: "event",
      },
    },
    { $unwind: "$event" },
    {
      $lookup: {
        from: "eventtypes", // Refers to EventType collection
        localField: "event.event_type",
        foreignField: "_id",
        as: "event.event_type",
      },
    },
    { $unwind: "$event.event_type" },
    {
      $group: {
        _id: "$_id",
        event: { $first: "$event" },
        group_name: { $first: "$group_name" },
        participants: { $push: "$participants.user" },
        score: { $first: "$score" },
        college: { $first: "$participants.user.college" },
        created_at: { $first: "$created_at" },
        updated_at: { $first: "$updated_at" },
      },
    },
    {
      $project: {
        __v: 0,
        created_at: 0,
        updated_at: 0,
      },
    },
  ]);

  if (!eventRegistrations.length) {
    return res.status(200).json(new ApiResponse(200, [], "No event registrations found for the specified college"));
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, eventRegistrations, "Event registrations found")
    );
});

const getEventRegistrationByEventId = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const eventRegistration = await EventRegistration.find({ event: id })
    .populate({
      path: "event",
      select: "name event_type",
      populate: {
        path: "event_type",
        select: "name is_group",
      },
    })
    .populate("participants.user", "name number department year_of_study")
    .select("-__v -created_at -updated_at");

  // if (!eventRegistration) {
  //   return res.status(204).json(new ApiResponse(204, [], "No event registration found"));
  // }

  res
    .status(200)
    .json(new ApiResponse(200, eventRegistration, "Event registration found"));
});

// Get event registration by ID
const getEventRegistrationById = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const eventRegistration = await EventRegistration.findById(id)
    .populate({
      path: "event",
      select: "name event_type",
      populate: {
        path: "event_type",
        select: "name is_group",
      },
    })
    .populate("participants.user", "name number department year_of_study")
    .select("-__v -created_at -updated_at");

  // if (!eventRegistration) {
  //   return next(new ApiError(404, "Event registration not found"));
  // }

  res
    .status(200)
    .json(new ApiResponse(200, eventRegistration, "Event registration found"));
});

// Update event registration by ID using patch

const updateEventRegistration = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const { event, group_name, participants } = req.body;

  const updateEvent = await EventRegistration.findByIdAndUpdate(
    id,
    { event, group_name, participants },
    { new: true }
  );

  if (!updateEvent) {
    return next(new ApiError(500, "Failed to update event registration"));
  }

  const updatedEvent = await EventRegistration.findById(updatedEvent._id)
    .populate({
      path: "event",
      select: "name event_type",
      populate: {
        path: "event_type",
        select: "name is_group",
      },
    })
    .populate("participants.user", "name number department year_of_study")
    .populate("helpers.user", "name")
    .select("-__v -created_at -updated_at");
  if (!event) {
    return next(new ApiError(404, "Event registration not found"));
  }

  res
    .status(200)
    .json(
      new ApiResponse(
        200,
        updatedEvent,
        "Event registration updated successfully"
      )
    );
});

// Delete event registration by ID
const deleteEventRegistration = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const eventRegistration = await EventRegistration.findById(id);

  if (!eventRegistration) {
    return next(new ApiError(404, "Event registration not found"));
  }

  const results = await Result.find({
    "winningRegistrations.eventRegistration": id,
  });

  if (results.length > 0) {
    return next(
      new ApiError(400, "Cannot delete registration with associated results")
    );
  }

  const deletedEvent = await EventRegistration.findByIdAndDelete(id);

  if (!deletedEvent) {
    return next(new ApiError(500, "Failed to delete event registration"));
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, null, "Event registration deleted successfully")
    );
});

export const eventRegistrationController = {
  createEventRegistration,
  getAllEventRegistrations,
  getEventRegistrationById,
  getEventRegistrationByEventId,
  updateEventRegistration,
  deleteEventRegistration,
  getAllEventRegistrationsCollege
};
