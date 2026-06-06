const cloudinary = require('../config/cloudinary');
const multer = require('multer');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

async function uploadImage(buffer, folder, publicId) {
  return new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(
      { folder: `knotty/${folder}`, public_id: publicId, overwrite: true },
      (err, result) => (err ? reject(err) : resolve(result.secure_url))
    );
    stream.end(buffer);
  });
}

async function deleteImage(publicId) {
  return cloudinary.uploader.destroy(publicId);
}

module.exports = { upload, uploadImage, deleteImage };
