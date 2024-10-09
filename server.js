const express = require('express');
const multer = require('multer');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();

// CORS configuration
app.use(cors({
  origin: 'https://scorm-frontend.vercel.app', // Replace with your frontend URL
  methods: ['GET', 'POST', 'DELETE'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// Cloudinary configuration
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET
});

// Cloudinary storage configuration
const storage = new CloudinaryStorage({
  cloudinary: cloudinary,
  params: {
    folder: 'scorm_files',
    resource_type: 'auto'
  },
});

const upload = multer({ storage: storage }).array('files', 100); // Adjust the number based on your needs

// Upload endpoint
app.post('/upload', (req, res) => {
  upload(req, res, function(err) {
    if (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Upload error', details: err.message });
    }
    console.log('Files uploaded successfully');
    res.status(200).json({ message: 'Folder uploaded successfully' });
  });
});

// Get folders endpoint
app.get('/folders', async (req, res) => {
  try {
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'scorm_files/',
      max_results: 500
    });
    const folders = result.resources.map(resource => ({
      name: resource.public_id.split('/').pop(),
      link: resource.secure_url
    }));
    res.json(folders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Server error', details: error.message });
  }
});

// Delete folder endpoint
app.delete('/folders/:folderName', async (req, res) => {
  const folderName = req.params.folderName;
  try {
    const result = await cloudinary.api.delete_resources_by_prefix(`scorm_files/${folderName}`);
    res.status(200).json({ message: `Folder "${folderName}" deleted successfully` });
  } catch (error) {
    console.error('Error deleting folder:', error);
    res.status(500).json({ error: 'Error deleting folder', details: error.message });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});