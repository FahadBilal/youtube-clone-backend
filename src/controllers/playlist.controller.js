import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { PlayList } from "../models/playlist.model.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Video } from "../models/video.model.js";

const createPlayList = asyncHandler(async (req, res) => {
  const { name, description } = req.body;

  if (!name || !description) {
    throw new ApiError(400, "name and description bith are required");
  }

  const playList = await PlayList.create({
    name,
    description,
    owner: req.user?._id,
  });

  if (!playList) {
    throw new ApiError(500, "Failed to create the playlist");
  }
  return res
    .status(200)
    .json(new ApiResponse(201, playList, "PlayList created Successfully"));
});

const updatePlayList = asyncHandler(async (req, res) => {
  const { playListId } = req.params;
  const { name, description } = req.body;

  if (!name || !description) {
    throw new ApiError(400, "name and description bith are required");
  }

  if (!isValidObjectId(playListId)) {
    throw new ApiError(400, "Invalid PlayListId");
  }

  const playList = await PlayList.findById(playListId);

  if (!playList) {
    throw new ApiError(404, "PlayList Not Found");
  }

  if (playList?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, " Only owner can edit the Playlist");
  }

  const newPlayList = await PlayList.findByIdAndUpdate(
    playListId,
    {
      $set: {
        name,
        description,
      },
    },
    { new: true }
  );

  if (!newPlayList) {
    throw new ApiError(500, "Failed to edit the playlist");
  }
  return res
    .status(200)
    .json(new ApiResponse(200, newPlayList, "PlayList Updated Successfully"));
});

const deletePlayList = asyncHandler(async (req, res) => {
  const { playListId } = req.params;

  if (!isValidObjectId(playListId)) {
    throw new ApiError(400, "Invalid PlayListId");
  }

  const playList = await PlayList.findById(playListId);

  if (!playList) {
    throw new ApiError(404, "PlayList Not Found");
  }

  if (playList?.owner.toString() !== req.user?._id.toString()) {
    throw new ApiError(400, " Only owner can delete the Playlist");
  }

  await PlayList.findByIdAndDelete(playListId);

  return res
    .status(200)
    .json(new ApiResponse(200, {}, "PlayList Deleted Sucessfully"));
});

const addVideoToPlayList = asyncHandler(async (req, res) => {
  const { playListId, videoId } = req.params;

  if (!isValidObjectId(playListId)) {
    throw new ApiError(400, "Invalid playlistId");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }

  const playList = await PlayList.findById(playListId);

  const video = await Video.findById(videoId);

  if (!playList) {
    throw new ApiError(404, "PlayList Not Found");
  }

  if (!video) {
    throw new ApiError(404, "Video Not Found");
  }

  if (
    (playList.owner.toString() && video.owner.toString()) !==
    req.user?._id.toString()
  ) {
    throw new ApiError(400, "Only Owner can  add the video to their PlayList");
  }

  const updatePlayList = await PlayList.findByIdAndUpdate(
    playList._id,
    {
      $addToSet: {
        videos: videoId,
      },
    },
    { new: true }
  );
  return res
    .status(200)
    .json(new ApiResponse(200, updatePlayList, "Video added to the PlayList Sucessfully"));
});

const removeVideoToPlayList = asyncHandler(async (req, res) => {
  const { playListId, videoId } = req.params;

  if (!isValidObjectId(playListId)) {
    throw new ApiError(400, "Invalid playlistId");
  }

  if (!isValidObjectId(videoId)) {
    throw new ApiError(400, "Invalid videoId");
  }

  const playList = await PlayList.findById(playListId);

  const video = await Video.findById(videoId);

  if (!playList) {
    throw new ApiError(404, "PlayList Not Found");
  }

  if (!video) {
    throw new ApiError(404, "Video Not Found");
  }

  if (
    (playList.owner.toString() && video.owner.toString()) !==
    req.user?._id.toString()
  ) {
    throw new ApiError(
      400,
      "Only Owner can  delete the video to their PlayList"
    );
  }

  const updatePlayList = await PlayList.findByIdAndUpdate(
    playList._id,
    {
      $pull: {
        videos: videoId,
      },
    },
    { new: true }
  );
  return res
    .status(200)
    .json(
      new ApiResponse(200, updatePlayList, "Video removed   to the PlayList Sucessfully")
    );
});

const getPlayListById = asyncHandler( async(req, res)=>{

    const { playListId } = req.params;

    if (!isValidObjectId(playListId)) {
        throw new ApiError(400, "Invalid PlayListId");
    }
    
    const playList = await PlayList.findById(playListId);

    if(!playList){
        throw new ApiError(400, "PlayList Not Found")
    }

    const playListVideos = await PlayList.aggregate([
        {
            $match:{
                _id : new mongoose.Types.ObjectId(playListId)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"videos",
                foreignField:"_id",
                as:"videos"
            }
        },
        {
            $match:{
                "videos.isPublished":true,
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"owner",
                foreignField:"_id",
                as:"owner"
            }
        },
        {
            $addFields:{
                totalVideos:{
                    $size:"$videos"
                },
                totalViews:{
                    $sum:"$videos.views"
                },
                owner:{
                    $first:"$owner"
                }
            }
        },
        {
            $project:{
                name:1,
                description:1,
                createdAt:1,
                updatedAt:1,
                totalVideos:1,
                totalViews:1,
                videos:{
                    _id:1,
                    "thumbnail.url":1,
                    "videoFile.url":1,
                    duraton:1,
                    views:1,
                    title:1,
                    description:1,
                    createdAt:1,
                },
                owner:{
                  username:1,
                  fullName:1,
                  "avatar.url":1
              }
            }
        }
    ])

    if(!playListVideos.length){
        throw new ApiError(404, "Record Not Found")
    }

    return res.status(200)
    .json(new ApiResponse(200,playListVideos,"PlayList Feteched Sucessfully"))
})

const getUserPlayLists= asyncHandler( async( req, res)=>{

    const {userId} = req.params;

    if(!isValidObjectId(userId)){
        throw new ApiError(400,"Invalid userId")
    }

    const playLists = await PlayList.aggregate([
        {
            $match:{
                owner:new mongoose.Types.ObjectId(userId)
            }
        },
        {
            $lookup:{
                from:"videos",
                localField:"videos",
                foreignField:"_id",
                as:"videos"
            }
        },
        {
            $addFields:{
                totalVideos:{
                    $size:"$videos",
                },
                totalViews:{
                    $sum:"$videos.views"
                }
            }
        },
        {
            $project:{
                _id:1,
                name:1,
                description:1,
                totalVideos:1,
                totalViews:1,
                createdAt:1,
                updatedAt:1
            }
        }
    ])

    if(!playLists){
        throw new ApiError(404,"Records Not Found")
    }

    return res.status(200)
    .json(new ApiResponse(200,playLists,"User playlists Feteched Sucessfully"))
})

export {
  createPlayList,
  updatePlayList,
  deletePlayList,
  addVideoToPlayList,
  removeVideoToPlayList,
  getPlayListById,
  getUserPlayLists,
};
