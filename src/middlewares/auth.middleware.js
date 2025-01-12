import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import jwt from 'jsonwebtoken'


export const verifyJWT = asyncHandler(async(req,_,next)=>{
 try {
       const token = await req.cookies?.accessToken || req.header("Authorizatin")?.replace("Bearer ", "");
       //console.log("token",token)
   
       if (!token) {
           throw new ApiError(401,"Unauthorized request");
       }
   
       const deCodedToken = jwt.verify(token, process.env.ACCESS_TOKEN_SECRET)
       //console.log("Decoded Token",deCodedToken);
   
       const user = await User.findById(deCodedToken?._id).select(
           "-password -refreshToken"
       )
      // console.log(user);
       if (!user) {
           throw new ApiError(401,"Inavlid Access token")
       }
       req.user = user;
       next();
 } catch (error) {
    throw new ApiError(401,error?.message || "invalid Access Token")
 }


})
