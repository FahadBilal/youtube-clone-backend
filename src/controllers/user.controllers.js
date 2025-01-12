import { asyncHandler } from "../utils/asyncHandler.js";
import { ApiError } from "../utils/ApiError.js";
import { User } from "../models/user.model.js";
import { uploadOnCloudinary, deleteOnCloudinary } from "../utils/cloudinary.js";
import { ApiResponse } from "../utils/ApiResponse.js";
import jwt from "jsonwebtoken";
import mongoose from "mongoose";

const generateAccessAndRefreshTokens = async (userId) => {
  try {
    const user = await User.findById(userId);
    const accessToken = user.generateAccessToken();
    const refreshToken = user.generateRefreshToken();

    user.refreshToken = refreshToken;

    await user.save({ validateBeforeSave: false });

    return { accessToken, refreshToken };
  } catch (error) {
    throw new ApiError(
      500,
      "Something went wrong while generating a access or refresh token"
    );
  }
};

const registerUser = asyncHandler(async (req, res) => {
  //Get user Detail from frontend
  //check validation
  //check the user already exist (username.email)
  //check for images for avatar and cover image
  //upload them cloudinary
  //create user object entry in db
  //remove password and refresh token
  //check for user creation
  //return res

  const { username, email, fullName, password } = req.body;

  // console.log("Email:",email,"Username:",username, "FullName:",fullName, "Password:",password)

  if (
    [fullName, username, password, email].some((field) => field?.trim() === "")
  ) {
    throw new ApiError(400, "All Fields are required");
  }

  const existedUser = await User.findOne({
    $or: [{ email }, { username }],
  });

  if (existedUser) {
    throw new ApiError(409, "User with username and email already exists");
  }

  //const avatarLocalPath=req.files?.avatar[0]?.path;

  let avatarLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.avatar) &&
    req.files.avatar.length > 0
  ) {
    avatarLocalPath = req.files.avatar[0].path;
  }

  //const coverImageLocalPath=req.files?.coverImage[0]?.path;

  let coverImageLocalPath;
  if (
    req.files &&
    Array.isArray(req.files.coverImage) &&
    req.files.coverImage.length > 0
  ) {
    coverImageLocalPath = req.files.coverImage[0].path;
  }

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is required");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!avatar) {
    throw new ApiError(200, "Avatar file is required");
  }

  const user = await User.create({
    fullName,
    avatar: {
      url: avatar?.url,
      public_id: avatar?.public_id,
      resource_type:avatar?.resource_type,
    },
    coverImage: {
      url: coverImage?.url || "",
      public_id: coverImage?.public_id || "",
      resource_type:coverImage?.resource_type || "",
    },
    email,
    password,
    username: username.toLowerCase(),
  });

  const createdUser = await User.findOne(user._id).select(
    "-password -refreshToken"
  );

  if (!createdUser) {
    throw ApiError(500, "Something went wrong when registering a user");
  }

  return res
    .status(201)
    .json(new ApiResponse(200, createdUser, "User register Successfully"));
});

const loginUser = asyncHandler(async (req, res) => {
  // get user info
  //check email or username
  // find the user by id
  // check the password
  // access and refresh token
  // send cookie

  const { username, password, email } = req.body;
  //console.log(email)

  if (!(username || email)) {
    throw new ApiError(400, "Username or email are required ");
  }

  const user = await User.findOne({
    $or: [{ username }, { email }],
  });
  //console.log(user)

  if (!user) {
    throw new ApiError(400, "User does not exist");
  }

  const isPasswordValid = await user.isPasswordCorrect(password);
  //console.log(isPasswordValid)

  if (!isPasswordValid) {
    throw new ApiError(401, "User credentials Invalid");
  }

  const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
    user._id
  );

  const loggedInUser = await User.findById(user._id).select(
    "-password -refreshToken"
  );

  const options = {
    httpOnly: true,
    secure: true,
  };
  res
    .status(200)
    .cookie("accessToken", accessToken, options)
    .cookie("refreshToken", refreshToken, options)
    .json(
      new ApiResponse(
        200,
        {
          user: loggedInUser,
          accessToken,
          refreshToken,
        },
        "User logged In Successfully"
      )
    );
});

const logoutUser = asyncHandler(async (req, res) => {
  await User.findByIdAndUpdate(
    req.user._id,
    {
      $unset: {
        refreshToken: "",
      },
    },
    {
      new: true,
    }
  );
  const options = {
    httpOnly: true,
    secure: true,
  };

  return res
    .status(200)
    .clearCookie("accessToken", options)
    .clearCookie("refreshToken", options)
    .json(new ApiResponse(200, {}, "User logged Out"));
});

const refreshAccessToken = asyncHandler(async (req, res) => {
  const incomingRefreshToken =
    (await req.cookies?.refreshToken) || req.body.refreshToken;
  //console.log("InComingRefreshToken", incomingRefreshToken);

  if (!incomingRefreshToken) {
    throw new ApiError(401, "Unauthorized request");
  }
  try {
    const decodedToken = jwt.verify(
      incomingRefreshToken,
      process.env.REFRESH_TOKEN_SECRET
    );
    //console.log("DecodedToken", decodedToken);

    const user = await User.findById(decodedToken?._id);

    if (!user) {
      throw new ApiError(401, "Invalid Token");
    }

    if (incomingRefreshToken !== user?.refreshToken) {
      throw new ApiError(401, "Refresh token is expired or used");
    }
    const options = {
      httpOnly: true,
      secure: true,
    };
    const { accessToken, refreshToken } = await generateAccessAndRefreshTokens(
      user._id
    );
    res
      .status(200)
      .cookie("accessToken", accessToken, options)
      .cookie("refreshToken", refreshToken, options)
      .json(
        new ApiResponse(
          200,
          { accessToken, refreshToken: refreshToken },
          "Access Token Refreshed"
        )
      );
  } catch (error) {
    throw new ApiError(200, error?.message || "invalid Refresh Token");
  }
});

const changeCurrentPassword = asyncHandler(async (req, res) => {
  const { oldPassword, newPassword } = req.body;

  // if(!(newPassword === confPassword))

  const user = await User.findById(req.user?._id);

  const isPasswordCorrect = await user.isPasswordCorrect(oldPassword);

  if (!isPasswordCorrect) {
    throw new ApiError(400, "Old Password is Incorrect");
  }

  user.password = newPassword;

  await user.save({ validateBeforeSave: false });

  return res
    .status(200)
    .json(new ApiResponse(200, "Changed Password Successfully"));
});

const getCurrentUser = asyncHandler(async (req, res) => {
  return res
    .status(200)
    .json(new ApiResponse(200, req.user, "Current user fetched Successfully"));
});

const updateAccountDetails = asyncHandler(async (req, res) => {
  const { fullName, email } = req.body;
  //console.log(fullName,email);
  

  if (!fullName || !email) {
    throw new ApiError(400, "fullName and Email both are required");
  }

  const user = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        fullName,
        email,
        //email,
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  return res
    .status(200)
    .json(new ApiResponse(200, user, "Account details update Successfully"));
});

const avatarUserUpdate = asyncHandler(async (req, res) => {
  const avatarLocalPath = req.file?.path;

  if (!avatarLocalPath) {
    throw new ApiError(400, "Avatar file is missing");
  }

  const avatar = await uploadOnCloudinary(avatarLocalPath);
  //console.log(avatar);
  

  if (!avatar) {
    throw new ApiError(400, "Error while uploading  avatar on cloudinary ");
  }

  const user = await User.findById(req.user?._id);
  //console.log(user);
  
  const avatarToDelete = user?.avatar.public_id;
  //console.log(avatarToDelete);
  const resource_type = user?.avatar.resource_type
  

  const updatedUser = await User.findByIdAndUpdate(
    user._id,
    {
      $set: {
        avatar: {
          url: avatar?.url,
          public_id: avatar?.public_id,
          resource_type:avatar?.resource_type,
        },
      },
    },
    { new: true }
  ).select("-password -refreshToken");
  //console.log(updatedUser);
  

  if (avatarToDelete && resource_type && updatedUser?.avatar.public_id) {
    await deleteOnCloudinary(avatarToDelete, resource_type);
  }

  return res
    .status(200)
    .json(new ApiResponse(200, updatedUser, "Avatar is updated successfully"));
});

const coverImageUserUpdate = asyncHandler(async (req, res) => {
  const coverImageLocalPath = req.file?.path;

  if (!coverImageLocalPath) {
    throw new ApiError(400, "CoverImage file is missing");
  }

  const coverImage = await uploadOnCloudinary(coverImageLocalPath);

  if (!coverImage) {
    throw new ApiError(400, "Error while uploading  avatar on cloudinary ");
  }

  const user = await User.findById(req.user?._id).select("coverImage");

  const coverImageToDelete = user?.coverImage.public_id;
  const resource_type = user?.coverImage.resource_type

  const updatedUser = await User.findByIdAndUpdate(
    req.user?._id,
    {
      $set: {
        coverImage: {
          url: coverImage?.url,
          public_id: coverImage?.public_id,
          resource_type:coverImage?.resource_type
        },
      },
    },
    { new: true }
  ).select("-password -refreshToken");

  if (coverImageToDelete && resource_type && updatedUser.coverImage.public_id) {
    await deleteOnCloudinary(coverImageToDelete,resource_type);
  }
  return res
    .status(200)
    .json(
      new ApiResponse(200, updatedUser, "CoverImage is updated Successfully")
    );
});

const getUserChannelProfile = asyncHandler(async (req, res) => {
  const { username } = req.params;

  if (!username?.trim()) {
    throw new ApiError(400, "username is missing");
  }

  const channel = await User.aggregate([
    {
      $match: {
        username: username?.toLowerCase(),
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "channel",
        as: "subscribers",
      },
    },
    {
      $lookup: {
        from: "subscriptions",
        localField: "_id",
        foreignField: "subscriber",
        as: "subscribedTo",
      },
    },
    {
      $addFields: {
        subscriberCount: {
          $size: "$subscribers",
        },
        channelSubscribedToCount: {
          $size: "$subscribedTo",
        },
        isSubscribed: {
          $cond: {
            if: { $in: [req.user?._id, "$subscribers.subscriber"] },
            then: true,
            else: false,
          },
        },
      },
    },
    {
      $project: {
        fullName: 1,
        email: 1,
        subscriberCount: 1,
        channelSubscribedToCount: 1,
        username: 1,
        "avatar.url": 1,
        "coverImage.url": 1,
      },
    },
  ]);
  // console.log(channel);

  if (!channel?.length) {
    throw new ApiError(404, "Channel does not exit");
  }

  return res
    .status(200)
    .json(
      new ApiResponse(200, channel[0], "User channel fetched Successfully")
    );
});

const getWatchHistory = asyncHandler(async (req, res) => {
  const user = await User.aggregate([
    {
      $match: {
        _id: new mongoose.Types.ObjectId(req.user?._id),
      },
    },
    {
      $lookup: {
        from: "videos",
        localField: "watchHistory",
        foreignField: "_id",
        as: "watchHistory",
        pipeline: [
          {
            $lookup: {
              from: "users",
              localField: "owner",
              foreignField: "_id",
              as: "owner",
              pipeline: [
                {
                  $project: {
                    fullName: 1,
                    username: 1,
                    "avatar.url": 1,
                  },
                },
              ],
            },
          },
          {
            $addFields: {
              owner: {
                $first: "$owner",
              },
            },
          },
        ],
      },
    },
  ]);

  if(!user.length){
    throw new ApiError(400,"User not found")
  }
  return res
    .status(200)
    .json(
      new ApiResponse(
        200,
        user[0].watchHistory,
        " Watch HIstory fetched Successfully"
      )
    );
});

export {
  registerUser,
  loginUser,
  logoutUser,
  refreshAccessToken,
  changeCurrentPassword,
  getCurrentUser,
  updateAccountDetails,
  avatarUserUpdate,
  coverImageUserUpdate,
  getUserChannelProfile,
  getWatchHistory,
};


