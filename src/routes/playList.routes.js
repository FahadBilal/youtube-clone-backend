import { Router } from "express";
import { verifyJWT } from "../middlewares/auth.middleware.js";
import {
  addVideoToPlayList,
  createPlayList,
  deletePlayList,
  getPlayListById,
  getUserPlayLists,
  removeVideoToPlayList,
  updatePlayList,
} from "../controllers/playlist.controller.js";

const router = Router();

router.use(verifyJWT);

router.route("/create").post(createPlayList);
router
  .route("/:playListId")
  .patch(updatePlayList)
  .delete(deletePlayList)
  .get(getPlayListById);

router.route("/add/:videoId/:playListId").get(addVideoToPlayList);
router.route("/remove/:videoId/:playListId").get(removeVideoToPlayList);

router.route("/user/:userId").get(getUserPlayLists);

export default router;
