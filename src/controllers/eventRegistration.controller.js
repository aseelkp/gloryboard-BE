import { EventRegistration } from "../models/eventRegistration.models.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";

// Create a new event registration
const createEventRegistration = asyncHandler(async (req, res, next) => {
  const { event, group_name, participants, helpers } = req.body;

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

  if (!event || !participants || !helpers) {
    return next(new ApiError(400, "Please provide all required fields"));
  }

  const newEvent = await EventRegistration.create({
    event,
    group_name,
    participants,
    helpers,
  });

  if (!newEvent) {
    return next(new ApiError(500, "Failed to create event registration"));
  }

  const addedEvent = await EventRegistration.findById(newEvent._id)
    .populate({
      path: "event",
      select: "name event_type",
      populate: {
        path: "event_type",
        select: "name",
      },
    })
    .populate("participants.user", "name number department year_of_study")
    .populate("helpers.user", "name")
    .select("-__v -created_at -updated_at");

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
  const eventRegistrations = await EventRegistration.find()
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

  if (!eventRegistrations) {
    return next(new ApiError(404, "No event registrations found"));
  }

  res
    .status(200)
    .json(
      new ApiResponse(200, eventRegistrations, "Event registrations found")
    );
});

const getEventRegistrationByEventId = asyncHandler(async (req, res, next) => {
  const { event_id } = req.params;

  const eventRegistration = await EventRegistration.find({ event: event_id })
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

  if (!eventRegistration) {
    return next(new ApiError(404, "Event registration not found"));
  }

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
  .populate("helpers.user", "name")
  .select("-__v -created_at -updated_at");

  if (!eventRegistration) {
    return next(new ApiError(404, "Event registration not found"));
  }

  res
    .status(200)
    .json(new ApiResponse(200, eventRegistration, "Event registration found"));
});

// Update event registration by ID using patch

const updateEventRegistration = asyncHandler(async (req, res, next) => {
  const { id } = req.params;

  const { event, group_name, participants, helpers } = req.body;

  const updateEvent = await EventRegistration.findByIdAndUpdate(
    id,
    { event, group_name, participants, helpers },
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

export {
  createEventRegistration,
  getAllEventRegistrations,
  getEventRegistrationById,
  getEventRegistrationByEventId,
  updateEventRegistration,
  deleteEventRegistration,
};
