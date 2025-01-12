import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  createTweet,
  deleteTweet,
  getUserTweet,
  updateTweet,
} from "../controllers/tweet.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/create").post(createTweet);

router.route("/:tweetId").patch(updateTweet).delete(deleteTweet);

router.route("/user/:userId").get(getUserTweet);

export default router;
