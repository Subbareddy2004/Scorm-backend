const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs-extra');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.static('public')); // Serve static files from 'public' directory

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const folderName = req.body.folderName;
    const relativePath = file.fieldname.split('/');
    relativePath.shift(); // Remove the first element (which is 'files')
    relativePath.pop(); // Remove the last element (file name)
    const fullPath = path.join(__dirname, 'public', ...relativePath);
    fs.mkdirpSync(fullPath);
    cb(null, fullPath);
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});

const upload = multer({ storage: storage }).any();

app.post('/upload', (req, res) => {
  upload(req, res, function (err) {
    if (err) {
      console.error('Upload error:', err);
      return res.status(500).json({ error: 'Upload error', details: err.message });
    }
    console.log('Files uploaded successfully');
    res.status(200).json({ message: 'Folder uploaded successfully' });
  });
});

app.get('/folders', (req, res) => {
    const publicPath = path.join(__dirname, 'public');
    fs.readdir(publicPath, { withFileTypes: true }, (err, entries) => {
      if (err) {
        console.error('Error reading public directory:', err);
        return res.status(500).json({ error: 'Server error', details: err.message });
      }
    const folders = entries
      .filter(entry => entry.isDirectory())
      .map(folder => ({
        name: folder.name,
        link: `/${folder.name}/index.html`
      }));
    res.json(folders);
  });
});

// Add this new endpoint for deleting folders
app.delete('/folders/:folderName', (req, res) => {
  const folderName = req.params.folderName;
  const folderPath = path.join(__dirname, 'public', folderName);

  fs.remove(folderPath, (err) => {
    if (err) {
      console.error('Error deleting folder:', err);
      return res.status(500).json({ error: 'Error deleting folder', details: err.message });
    }
    console.log(`Folder "${folderName}" deleted successfully`);
    res.status(200).json({ message: `Folder "${folderName}" deleted successfully` });
  });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});