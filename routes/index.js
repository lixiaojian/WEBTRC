var express = require('express');
var router = express.Router();

/* GET home page. */
router.get('/meeting', function(req, res, next) {
  res.render('index', { title: 'WEBRTC会议室' });
});

module.exports = router;
