// server/api/api.images.js
import express from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { v4 as uuidv4 } from 'uuid';
import Image from '../models/mongo.image.js';

const router = express.Router();

// Middleware to check if the user is a host
function checkHost(req, res, next) {
	// console.log('checkHost:', req.session, req.url, req.originalUrl, req.baseUrl, req.path, req.params, req.query);
	if (req.session && req.session.host) {
		next();
	} else {
		return res.status(404).json({ message: 'No user identified' });
	}
}

router.use([checkHost]);

// Configure storage
const storage = multer.diskStorage({
	destination: (req, file, cb) => {
		// Store in user-specific folder
		const userID = req.user._id;
		const folder = req.body.folder || '';

		let uploadDir = path.join(process.cwd(), 'public', 'uploads', userID);
		if (folder) {
			uploadDir = path.join(uploadDir, folder);
		}

		// Create directory if it doesn't exist
		if (!fs.existsSync(uploadDir)) {
			fs.mkdirSync(uploadDir, { recursive: true });
		}

		cb(null, uploadDir);
	},
	filename: (req, file, cb) => {
		// Generate unique filename
		const uniqueId = uuidv4();
		const extension = path.extname(file.originalname).toLowerCase();
		cb(null, `${uniqueId}${extension}`);
	}
});

// File filter
const fileFilter = (req, file, cb) => {
	const allowedTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
	if (allowedTypes.includes(file.mimetype)) {
		cb(null, true);
	} else {
		cb(new Error('Invalid file type. Only JPEG, PNG, GIF, and WEBP are allowed.'), false);
	}
};

const upload = multer({
	storage: storage,
	limits: { fileSize: 5 * 1024 * 1024 }, // 5MB limit
	fileFilter: fileFilter
});

// Upload endpoint
router.post('/upload', upload.single('image'), async (req, res) => {
	try {
		if (!req.file) {
			return res.status(400).json({
				success: false,
				message: 'No file uploaded',
				error: { details: 'Please select a file to upload' }
			});
		}

		const userID = req.user._id;
		const folder = req.body.folder || '';

		// Create relative URL
		const relativeUrl = `/uploads/${userID}${folder ? '/' + folder : ''}/${req.file.filename}`;

		// Save to database
		const image = new Image({
			userID: userID,
			filename: req.file.filename,
			originalName: req.file.originalname,
			mimetype: req.file.mimetype,
			size: req.file.size,
			url: relativeUrl,
			folder: folder
		});

		await image.save();

		return res.status(200).json({
			success: true,
			data: {
				url: relativeUrl,
				id: image._id
			},
			message: 'File uploaded successfully'
		});
	} catch (error) {
		console.error('Error uploading file:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to upload file',
			error: { details: error.message }
		});
	}
});

// Get user's image library
router.get('/library', async (req, res) => {

	console.log('api/image/library:', req.query, req.user);

	try {
		const userID = req.user._id;
		const folder = req.query.folder || '';

		const query = { userID };
		if (folder) {
			query.folder = folder;
		}

		const images = await Image.find(query).sort({ createdAt: -1 });

		return res.status(200).json({
			success: true,
			data: images,
			message: 'Images fetched successfully'
		});
	} catch (error) {
		console.error('Error fetching images:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to fetch images',
			error: { details: error.message }
		});
	}
});

// Get user's folders
router.get('/folders', async (req, res) => {
	try {
		const userID = req.user._id;

		// Get distinct folders for this user
		const folders = await Image.distinct('folder', { userID, folder: { $ne: '' } });

		return res.status(200).json({
			success: true,
			data: folders,
			message: 'Folders fetched successfully'
		});
	} catch (error) {
		console.error('Error fetching folders:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to fetch folders',
			error: { details: error.message }
		});
	}
});

// Create new folder
router.post('/folders', async (req, res) => {
	try {
		const { name } = req.body;
		const userID = req.user._id;

		if (!name) {
			return res.status(400).json({
				success: false,
				message: 'Folder name is required',
				error: { details: 'Please provide a folder name' }
			});
		}

		// Create folder in filesystem
		const folderPath = path.join(process.cwd(), 'public', 'uploads', userID, name);
		if (!fs.existsSync(folderPath)) {
			fs.mkdirSync(folderPath, { recursive: true });
		}

		return res.status(200).json({
			success: true,
			data: { name },
			message: 'Folder created successfully'
		});
	} catch (error) {
		console.error('Error creating folder:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to create folder',
			error: { details: error.message }
		});
	}
});

// Delete image
// Delete image
router.delete('/:imageId', async (req, res) => {
	try {
		const { imageId } = req.params;
		 // Assuming req.user contains the authenticated user id
		const userID = req.user._id;

		// Find the image
		const image = await Image.findOne({ _id: imageId });

		if (!image) {
			return res.status(404).json({
				success: false,
				message: 'Image not found',
				error: { details: 'The requested image does not exist' }
			});
		}

		// Check if the user owns this image
		if (image.userID && image.userID.toString() !== userID.toString()) {
			return res.status(403).json({
				success: false,
				message: 'Permission denied',
				error: { details: 'You do not have permission to delete this image' }
			});
		}

		// Delete file from filesystem if it's stored locally
		// This is only needed if you're storing files on disk
		if (image.url && image.url.startsWith('/uploads/')) {
			const filePath = path.join(process.cwd(), 'public', image.url);
			if (fs.existsSync(filePath)) {
				fs.unlinkSync(filePath);
			}
		}

		// Delete from database
		await Image.deleteOne({ _id: imageId });

		return res.status(200).json({
			success: true,
			data: null,
			message: 'Image deleted successfully'
		});
		
	} catch (error) {
		console.error('Error deleting image:', error);
		return res.status(500).json({
			success: false,
			message: 'Failed to delete image',
			error: { details: error.message }
		});
	}
});
export default router;