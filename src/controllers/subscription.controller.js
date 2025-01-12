import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import mongoose, { isValidObjectId } from "mongoose";
import { Subscription } from '../models/subscription.models.js'
import { ApiResponse } from "../utils/ApiResponse.js";

const toggleSubscription = asyncHandler( async(req, res)=>{

    const {channelId} = req.params;

    if(!isValidObjectId(channelId)){
        throw new ApiError(400,"invalid ChannelId")
    }

    const isSubscribed = await Subscription.findOne({
        subscriber:req.user?._id,
        channel:channelId
    })

    if(isSubscribed){
        await Subscription.findByIdAndDelete(isSubscribed?._id)

        return res.status(200)
        .json(new ApiResponse(200,{subscribed:false},"Unsubscribed Successfully"))
    }

    await Subscription.create({
        subscriber:req.user?._id,
        channel:channelId,
    })
     return res.status(200)
     .json(new ApiResponse(200,{subscribed:true} ,"Subscribed Successfully"))
})

const getUserChannelSubscriber = asyncHandler(async (req, res) => {
    const { channelId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(channelId)) {
      throw new ApiError(400, "Invalid ChannelId");
    }
  
    const subscriber = await Subscription.aggregate([
      {
        $match: {
          channel: new mongoose.Types.ObjectId(channelId), 
        },
      },
      {
        $lookup: {
          from: "users",
          localField: "subscriber", 
          foreignField: "_id",
          as: "subscribers",
          pipeline: [
            {
              $lookup: {
                from: "subscriptions",
                localField: "_id",
                foreignField: "channel",
                as: "subscribedToSubscriber",
              },
            },
            {
              $addFields: {
                subscribedToSubscriber: {
                  $cond: {
                    if: {
                      $in: [new mongoose.Types.ObjectId(channelId), "$subscribedToSubscriber.subscriber"],  
                    },
                    then: true,
                    else: false,
                  },
                },
                subscriberCount: {
                  $size: "$subscribedToSubscriber",  
                },
              },
            },
          ],
        },
      },
      {
        $unwind: "$subscribers", 
      },
      {
        $project: {
          _id: 0,
          subscribers: {
            _id: 1,
            username: 1,
            fullName: 1,
            "avatar.url": 1,
            subscriberCount: 1,
            subscribedToSubscriber: 1,
          },
        },
      },
    ]);
  
    if (!subscriber || subscriber.length === 0) {
      throw new ApiError(404, "No subscribers found for the given channel");
    }
  
    res.status(200).json(new ApiResponse(200, subscriber, "Subscribers Fetched Successfully"));
  });
  

const getSubscribedChannels = asyncHandler( async(req, res)=>{

    const {subscriberId} = req.params;


    const subscribedChannels = await Subscription.aggregate([
        {
            $match:{
                subscriber:new mongoose.Types.ObjectId(subscriberId)
            }
        },
        {
            $lookup:{
                from:"users",
                localField:"subscriber",
                foreignField:"_id",
                as:"subscribedChannel",
                pipeline:[
                    {
                        $lookup:{
                            from:"videos",
                            localField:"_id",
                            foreignField:"owner",
                            as:"videos"
                        }
                    },
                    {
                        $addFields:{
                            latestVideo:{
                                $last:"$videos"
                            }
                        }
                    }
                ]
            }
        },
        {
            $unwind:"$subscribedChannel"
        },
        {
            $project:{
                _id:0,
                subscribedChannel:{
                    _id:1,
                    username:1,
                    fullName:1,
                    "avatar.url":1,
                    latestVideo:{
                        _id:1,
                        "videoFile.url":1,
                        "thumbnail.url":1,
                        title:1,
                        duration:1,
                        views:1,
                        createdAt:1,
                        description:1,
                        owner:1
                    }
                }
            }
        }
    ])

    if(!subscribedChannels){
        throw new ApiError(400,"Failed to fetched Subscribed Channels")
    }

    return res.status(200)
    .json(new ApiResponse(200,subscribedChannels,"Subscribed Channels Sucessfully"))
})


export { toggleSubscription, getUserChannelSubscriber, getSubscribedChannels }