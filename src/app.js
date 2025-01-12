import express from 'express'
import cors from 'cors'
import cookieParser from 'cookie-parser';

const app =express()

app.use(express.json({limit:"16kb"}));

app.use(express.urlencoded({extended:true}))
app.use(express.static("public"));

app.use(cors({
    origin:process.env.CORS_ORIGIN,
    credientials:true,
}))
app.use(cookieParser())


//http://localhost:3000/api/v1/users/register
//mport User Route

import userRouter from './routes/user.routes.js';
import commentRouter from './routes/comment.routes.js'
import likeRouter from './routes/like.routes.js'
import dashboardRouter from './routes/dashboard.routes.js'
import healthCheckRouter from './routes/healthCheck.routes.js'
import playListRouter from './routes/playList.routes.js'
import subscriptionRouter from './routes/subscription.routes.js'
import tweetRouter from './routes/tweet.routes.js'
import videoRouter from './routes/video.routes.js'

app.use("/api/v1/users",userRouter)
app.use("/api/v1/comments",commentRouter)
app.use("/api/v1/likes",likeRouter)
app.use("/api/v1/dashboard",dashboardRouter)
app.use("/api/v1/healthCheck",healthCheckRouter)
app.use("/api/v1/playList",playListRouter)
app.use("/api/v1/subscription",subscriptionRouter)
app.use("/api/v1/tweet",tweetRouter)
app.use("/api/v1/video",videoRouter)

export {  app }