const express = require('express');
const multer = require('multer');
const cors = require('cors');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
require('dotenv').config();

const app = express();

// Increase JSON and URL-encoded payload limits
app.use(express.json({ limit: '150mb' }));
app.use(express.urlencoded({ limit: '150mb', extended: true }));

// CORS configuration
app.use(cors({
  origin: 'https://scorm-frontend.vercel.app', // Replace with your frontend URL
  methods: ['GET', 'POST', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

// Add this line before your routes
app.options('*', cors());

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

// Adjust multer configuration
const upload = multer({
  storage: storage,
  limits: { fileSize: 150 * 1024 * 1024 } // 150MB limit
}).array('files', 100);

// Upload endpoint
app.post('/upload', (req, res) => {
  upload(req, res, function(err) {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({ error: 'File too large', details: 'Max file size is 150MB' });
      }
      return res.status(500).json({ error: 'Upload error', details: err.message });
    } else if (err) {
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
    console.log('Fetching folders from Cloudinary...');
    const result = await cloudinary.api.resources({
      type: 'upload',
      prefix: 'scorm_files/',
      max_results: 500
    });
    console.log('Cloudinary response:', result);
    const folders = result.resources.map(resource => ({
      name: resource.public_id.split('/').pop(),
      link: resource.secure_url
    }));
    res.json(folders);
  } catch (error) {
    console.error('Error fetching folders:', error);
    res.status(500).json({ error: 'Server error', details: error.message, stack: error.stack });
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

const fs = require('fs');
const path = require('path');
const multer = require('multer');

const upload = multer({ dest: 'uploads/' });

app.post('/upload-chunk', upload.single('file'), (req, res) => {
  const { chunkIndex, totalChunks, fileName } = req.body;
  const tempDir = path.join(__dirname, 'temp');
  
  if (!fs.existsSync(tempDir)) {
    fs.mkdirSync(tempDir);
  }
  
  const chunkDir = path.join(tempDir, fileName);
  if (!fs.existsSync(chunkDir)) {
    fs.mkdirSync(chunkDir);
  }
  
  const chunkPath = path.join(chunkDir, `chunk-${chunkIndex}`);
  fs.renameSync(req.file.path, chunkPath);
  
  res.status(200).json({ message: 'Chunk uploaded successfully' });
});

app.post('/complete-upload', async (req, res) => {
  const { fileName } = req.body;
  const chunkDir = path.join(__dirname, 'temp', fileName);
  const outputPath = path.join(__dirname, 'uploads', fileName);
  
  const chunkFiles = fs.readdirSync(chunkDir).sort((a, b) => {
    return parseInt(a.split('-')[1]) - parseInt(b.split('-')[1]);
  });
  
  const writeStream = fs.createWriteStream(outputPath);
  
  for (let chunkFile of chunkFiles) {
    const chunkPath = path.join(chunkDir, chunkFile);
    const chunkBuffer = fs.readFileSync(chunkPath);
    writeStream.write(chunkBuffer);
    fs.unlinkSync(chunkPath);
  }
  
  writeStream.end();
  fs.rmdirSync(chunkDir);
  
  // Upload the complete file to Cloudinary
  try {
    const result = await cloudinary.uploader.upload(outputPath, {
      folder: 'scorm_files',
      resource_type: 'auto'
    });
    fs.unlinkSync(outputPath);
    res.status(200).json({ message: 'File uploaded successfully', url: result.secure_url });
  } catch (error) {
    console.error('Error uploading to Cloudinary:', error);
    res.status(500).json({ error: 'Upload to Cloudinary failed' });
  }
});