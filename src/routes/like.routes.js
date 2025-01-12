import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  getLikedvideos,
  toggleCommentLike,
  toggleTweetLike,
  toggleVideoLike,
} from "../controllers/like.contoller.js";

const router = Router();

router.use(verifyJWT);

router.route("/toggleVideo/:videoId").post(toggleVideoLike);
router.route("/toggleTweet/:tweetId").post(toggleTweetLike);
router.route("/toggleComment/:commentId").post(toggleCommentLike);
router.route("/videos").get(getLikedvideos);

export default router;
