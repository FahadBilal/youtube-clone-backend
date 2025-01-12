import { v2 as cloudinary } from "cloudinary";
import fs from "fs";

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET, // Click 'View API Keys' above to copy your API secret
});

const uploadOnCloudinary = async (localFilePath) => {
  try {
    if (!localFilePath) return null;
    const response = await cloudinary.uploader.upload(localFilePath, {
      resource_type: "auto",
    });
    //file uploaded sucessfull
    //console.log("File is upload on cloudinary Sucessful",response.url);
    // console.log(response);

    await fs.unlinkSync(localFilePath);
    return response;
  } catch (error) {
    fs.unlinkSync(localFilePath);
    //removed the locally file if the upload opertion is failed
    return null;
  }
};

const deleteOnCloudinary = async (public_id,resource_type) => {
  try {
    //console.log(public_id);

    if (!public_id) return null;
    const response =  await cloudinary.uploader.destroy(public_id, {
      resource_type,
    });
    return {response}
  } catch (error) {
    console.log(error);
    
    console.log("Delete on cloudinary failed");
    return null;
  }
};
export { uploadOnCloudinary, deleteOnCloudinary };
