const fs = require('fs');
const path = require('path');
const { supabase, isSupabaseMock } = require('../config/supabase');

const MOCK_STORAGE_DIR = path.join(__dirname, '../../storage_mock');

// Ensure mock directory exists
if (isSupabaseMock) {
  if (!fs.existsSync(MOCK_STORAGE_DIR)) {
    fs.mkdirSync(MOCK_STORAGE_DIR, { recursive: true });
  }
}

const storageService = {
  /**
   * Upload a file buffer to a specific bucket
   * @param {string} bucketName - Name of the bucket (transcripts, backups, media, welcomes, logs)
   * @param {Buffer} fileBuffer - File contents as a Buffer
   * @param {string} fileName - File name to save as
   * @param {string} contentType - MIME type of the file
   */
  uploadFile: async (bucketName, fileBuffer, fileName, contentType = 'application/octet-stream') => {
    if (isSupabaseMock) {
      const bucketDir = path.join(MOCK_STORAGE_DIR, bucketName);
      if (!fs.existsSync(bucketDir)) {
        fs.mkdirSync(bucketDir, { recursive: true });
      }
      const filePath = path.join(bucketDir, fileName);
      
      // Ensure nested subdirectories in filename exist
      const fileDir = path.dirname(filePath);
      if (!fs.existsSync(fileDir)) {
        fs.mkdirSync(fileDir, { recursive: true });
      }

      fs.writeFileSync(filePath, fileBuffer);
      console.log(`[Storage Mock] Saved ${fileName} in bucket "${bucketName}"`);
      
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      return {
        path: `${bucketName}/${fileName}`,
        publicUrl: `${backendUrl}/api/storage/mock/${bucketName}/${fileName}`
      };
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .upload(fileName, fileBuffer, {
        contentType,
        upsert: true
      });

    if (error) {
      console.error(`[Supabase Storage Error] Upload failed for ${bucketName}/${fileName}:`, error.message);
      throw error;
    }

    const { data: publicUrlData } = supabase.storage.from(bucketName).getPublicUrl(fileName);

    return {
      path: data.path,
      publicUrl: publicUrlData.publicUrl
    };
  },

  /**
   * Get a temporary signed URL for private bucket access
   */
  getSignedUrl: async (bucketName, fileName, expiresIn = 3600) => {
    if (isSupabaseMock) {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      return `${backendUrl}/api/storage/mock/${bucketName}/${fileName}?token=mock_signed_url`;
    }

    const { data, error } = await supabase.storage
      .from(bucketName)
      .createSignedUrl(fileName, expiresIn);

    if (error) {
      console.error(`[Supabase Storage Error] Signed URL failed for ${bucketName}/${fileName}:`, error.message);
      throw error;
    }

    return data.signedUrl;
  },

  /**
   * Get a public URL for a file in a public bucket
   */
  getPublicUrl: (bucketName, fileName) => {
    if (isSupabaseMock) {
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:5000';
      return `${backendUrl}/api/storage/mock/${bucketName}/${fileName}`;
    }

    const { data } = supabase.storage
      .from(bucketName)
      .getPublicUrl(fileName);

    return data.publicUrl;
  },

  /**
   * Delete a file from a bucket
   */
  deleteFile: async (bucketName, fileName) => {
    if (isSupabaseMock) {
      const filePath = path.join(MOCK_STORAGE_DIR, bucketName, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        console.log(`[Storage Mock] Deleted ${fileName} from bucket "${bucketName}"`);
      }
      return true;
    }

    const { error } = await supabase.storage
      .from(bucketName)
      .remove([fileName]);

    if (error) {
      console.error(`[Supabase Storage Error] Delete failed for ${bucketName}/${fileName}:`, error.message);
      throw error;
    }

    return true;
  }
};

module.exports = storageService;
