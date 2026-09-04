const express = require('express');
const router = express.Router();
const controller = require('../controllers/downloadController');

router.post('/', controller.createDownload);
router.get('/', controller.listDownloads);
router.get('/:id', controller.getDownload);
router.get('/:id/file', controller.serveFile);
router.delete('/:id', controller.deleteDownload);

module.exports = router;
