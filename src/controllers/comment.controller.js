import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";

const getVideoComments = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { page = 1, limit = 10 } = req.query;

  // Validate and find the video
  if (!mongoose.Types.ObjectId.isValid(videoId)) {
    throw new ApiError(400, "Invalid Video ID");
  }

  const video = await Video.findById(videoId);
  if (!video) {
    throw new ApiError(404, "Video Not Found");
  }

  // Comment aggregation pipeline
  const commentAggregate = [
    {
      $match: {
        video: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "comment",
        as: "likes",
      },
    },
    {
      $addFields: {
        likesCount: { $size: "$likes" },
        owner: { $first: "$owner" },
        isLiked: {
          $cond: {
            if: { $in: [new mongoose.Types.ObjectId(req.user?._id), "$likes.likedBy"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        _id: 1,
        content: 1,
        createdAt: 1,
        likesCount: 1,
        isLiked: 1,
        owner: {
          username: 1,
          fullName: 1,
          "avatar.url": 1,
        },
      },
    },
  ];

  // Pagination options
  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };

  // Aggregate and paginate
  const comments = await Comment.aggregatePaginate(commentAggregate, options);

  // Response
  return res
    .status(200)
    .json(new ApiResponse(200, comments, "Comments Fetched Successfully"));
});


const addComment = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { content } = req.body;

  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(400, "Video Not Found");
  }

  const comment = await Comment.create({
    content,
    video: videoId,
    owner: req.user?._id,
  });

  if (!comment) {
    throw new ApiError(500, "Failed to create Comment");
  }

  return res
    .status(200)
    .json(new ApiResponse(201, comment, "Comment created Successfully"));
});

const updateComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;
  const { content } = req.body;

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(400, "Comment Not Found");
  }

  if (!content) {
    throw new ApiError(400, "Content is required");
  }

  if (comment?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "Only Owner can edit the comment");
  }

  const updatedComment = await Comment.findByIdAndUpdate(
    comment._id,
    {
      $set: {
        content,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(new ApiResponse(200, updatedComment, "Comment Updated Successfully"));
});

const deleteComment = asyncHandler(async (req, res) => {
  const { commentId } = req.params;

  const comment = await Comment.findById(commentId);

  if (!comment) {
    throw new ApiError(400, "Comment Not Found");
  }

  if (comment?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "Only Owner can delete the comment");
  }

  await Comment.findByIdAndDelete(comment._id);

  await Like.deleteMany({
    comment: commentId,
    likedBy: req.user,
  });

  return res
    .status(200)
    .json(new ApiResponse(200, { commentId }, "Comment Deleted Successfully"));
});

export { getVideoComments, addComment, updateComment, deleteComment };
