const jytDouyaApp = require('./jyt-douya');
const rtcP2PApp = require('./rtc-p2p');

const apps = [];
apps.push(jytDouyaApp);
apps.push(rtcP2PApp);

module.exports = {
    apps: apps
};