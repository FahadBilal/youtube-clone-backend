import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";
import { Comment } from "../models/comment.model.js";
import { Like } from "../models/like.model.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../utils/cloudinary.js";
import { User } from "../models/user.model.js";

const getAllVideos = asyncHandler(async (req, res) => {
  const { page = 1, limit = 10, query, sortBy, sortType, userId } = req.query;
  const pipeline = [];

  if (query) {
    pipeline.push({
      $search: {
        index: "Search-videos",
        text: {
          query: query,
          path: ["title", "description"],
        },
      },
    });
  }

  if (userId) {
    if (!isValidObjectId(userId)) {
      throw new ApiError(400, "Invalid UserId");
    }
  }

  pipeline.push({
    $match: {
      owner: new mongoose.Types.ObjectId(userId),
    },
  });

  pipeline.push({
    $match: {
      isPublished: true,
    },
  });

  if (sortBy && sortType) {
    pipeline.push({
      $sort: {
        [sortBy]: sortType === "asc" ? 1 : -1,
      },
    });
  } else {
    pipeline.push({
      $sort: {
        createdAt: -1,
      },
    });
  }

  pipeline.push(
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "ownerDetail",
      },
    },
    {
      $unwind: {
        path: "$ownerDetail",
        preserveNullAndEmptyArrays: true, // Keeps videos even if no owner details exist
      },
    }
  );

  pipeline.push({
    $project: {
      _id: 1,
      "videoFile.url": 1,
      "thumbnail.url": 1,
      title: 1,
      description: 1,
      duration: 1,
      views: 1,
      isPublished: 1,
      owner: 1,
      createdAt: 1,
      updatedAt: 1,
      "ownerDetail.username": 1,
      "ownerDetail.avatar.url": 1,
    },
  });

  const videoAggregate = await Video.aggregate(pipeline);

  const options = {
    page: parseInt(page, 10),
    limit: parseInt(limit, 10),
  };
  const videos = await Video.aggregatePaginate(videoAggregate, options);

  return res
    .status(200)
    .json(new ApiResponse(200, videos, "All videos Fetched successfully"));
});

const publishVideo = asyncHandler(async (req, res) => {
  const { title, description } = req.body;
  if (!title || !description) {
    throw new ApiError(400, "Title and description are required");
  }

  const videoLocalPath = req.files.videoFile[0]?.path;
  const thumbnailLocalPath = req.files.thumbnail[0]?.path;

  if (!videoLocalPath) {
    throw new ApiError(400, "Video File is missing");
  }

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "thumbnail is missing");
  }

  const videoFile = await uploadOnCloudinary(videoLocalPath);
  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!videoFile) {
    throw new ApiError(500, "Failed to upload the video on cloudinary ");
  }

  if (!thumbnail) {
    throw new ApiError(500, "Failed to upload the thumbnail on cloudinary ");
  }

  const video = await Video.create({
    title,
    description,
    duration: videoFile?.duration,
    videoFile: {
      url: videoFile?.url,
      public_id: videoFile?.public_id,
      resource_type: videoFile?.resource_type,
    },
    thumbnail: {
      url: thumbnail?.url,
      public_id: thumbnail?.public_id,
      resource_type: thumbnail?.resource_type,
    },
    isPublished: false,
    owner: req.user?._id,
  });

  const videoUploaded = await Video.findById(video._id);

  if (!videoUploaded) {
    throw new ApiError(500, "Failed to upload the video");
  }

  return res
    .status(200)
    .json(new ApiResponse(200, videoUploaded, "Video Uploaded Successfully"));
});

const getVideoById = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }

  const video = await Video.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(videoId),
      },
    },
    {
      $lookup: {
        from: "likes",
        localField: "_id",
        foreignField: "video",
        as: "likes",
      },
    },
    {
      $lookup: {
        from: "users",
        localField: "owner",
        foreignField: "_id",
        as: "owner",
        pipeline: [
          {
            $lookup: {
              from: "subscriptions",
              localField: "_id",
              foreignField: "channel",
              as: "subscribers",
            },
          },
          {
            $addFields: {
              subscriberCount: {
                $size: "$subscribers",
              },
              isSubscribed: {
                $cond: {
                  if: {
                    $in: [
                      new mongoose.Types.ObjectId(req.user?._id),
                      { $ifNull: ["$subscribers.subscriber", []] },
                    ],
                  },
                  then: true,
                  else: false,
                },
              },
            },
          },
          {
            $project: {
              username: 1,
              "avatar.url": 1,
              subscriberCount: 1,
              isSubscribed: 1,
            },
          },
        ],
      },
    },
    {
      $addFields: {
        likesCount: {
          $size: "$likes",
        },
        owner: {
          $first: "$owner",
        },
        isLiked: {
          $cond: {
            if: {
              $in: [new mongoose.Types.ObjectId(req.user?._id), { $ifNull: ["$likes.likedBy", []] }],
            },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        likesCount: 1,
        owner: 1,
        isLiked: 1,
        "videoFile.url": 1,
        title: 1,
        description: 1,
        views: 1,
        duration: 1,
        comments: 1,
        createdAt: 1,
      },
    },
  ]);

  if (!video.length) {
    throw new ApiError(400, "Failed to fetch video");
  }
  const updatedVideo = video[0];

  await Video.findByIdAndUpdate(videoId, {
    $inc: {
      views: 1,
    },
  });

  if (req.user?._id) {
    await User.findByIdAndUpdate(req.user?._id, {
      $addToSet: {
        watchHistory: videoId,
      },
    },{new:true});
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video detailed fetched successfully"));
});

const updateVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;
  const { title, description } = req.body;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }

  if (!(title && description)) {
    throw new ApiError(400, "Both fields are required");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video Not found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "Only Owner can update the video");
  }

  const thumbnailToDelete = video.thumbnail.public_id;
  const resource_type = video.thumbnail.resource_type;

  const thumbnailLocalPath = req.file?.path;

  if (!thumbnailLocalPath) {
    throw new ApiError(400, "thumbnail is missing");
  }

  const thumbnail = await uploadOnCloudinary(thumbnailLocalPath);

  if (!thumbnail) {
    throw new ApiError(500, "Failed to upload the thumbnail");
  }
  const updatedVideo = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        title,
        description,
        thumbnail: {
          url: thumbnail?.url,
          public_id: thumbnail?.public_id,
          resource_type: thumbnail?.resource_type,
        },
      },
    },
    {
      new: true,
    }
  );

  if (!updatedVideo) {
    throw new ApiError(500, "Failed to update the video");
  }

  if (thumbnailToDelete && resource_type && updatedVideo.thumbnail.public_id) {
    await deleteOnCloudinary(thumbnailToDelete, resource_type);
  }
  return res
    .status(200)
    .json(new ApiResponse(200, updatedVideo, "Video updated Successfully"));
});

const deleteVideo = await asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid VideoId");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video Not found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "Only Owner can delete the video");
  }

  const deletedVideo = await Video.findByIdAndDelete(video._id);

  if (!deletedVideo) {
    throw new ApiResponse(500, "Failed to delete the the video");
  }

  await deleteOnCloudinary(
    video?.videoFile.public_id,
    video?.videoFile.resource_type
  );
  await deleteOnCloudinary(
    video?.thumbnail.public_id,
    video?.thumbnail.resource_type
  );

  await Like.deleteMany({
    video: videoId,
  });

  await Comment.deleteMany({
    video: videoId,
  });
  return res.status(200).json(200, {}, "Video deleted Successfully");
});

const togglePublishVideo = asyncHandler(async (req, res) => {
  const { videoId } = req.params;

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid VideoId");
  }

  const video = await Video.findById(videoId);

  if (!video) {
    throw new ApiError(404, "Video Not found");
  }

  if (video?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, "Only Owner can toggle publish the video");
  }
  const togglePublished = await Video.findByIdAndUpdate(
    videoId,
    {
      $set: {
        isPublished: !video?.isPublished,
      },
    },
    { new: true }
  );

  return res
    .status(200)
    .json(
      200,
      { isPublished: togglePublished.isPublished },
      "Video publish toggle Successfully"
    );
});

export {
  getAllVideos,
  publishVideo,
  getVideoById,
  updateVideo,
  deleteVideo,
  togglePublishVideo,
};
