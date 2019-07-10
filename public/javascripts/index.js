/**
 * @ignore  ==============================================================
 * @fileoverview 该文档主要完成主要任务是……
 * @author  xiaojianli(872458899@qq.com)
 * @version 1.0.0
 * @date  2019/7/3
 * @ignore  ==============================================================
 */
const iceServer = {
  iceServers: [{
    urls: 'stun:stun.ekiga.net'
  }, {
    urls: 'stun:stun.fwdnet.net'
  }, {
    urls: 'stun:stun.ideasip.com'
  },{
    urls: 'stun:stun.softjoys.com'
  }, {
    urls: 'stun:stun.voxgratia.org'
  }, {
    urls: 'stun:stun.xten.com'
  }]
};
/**
 * bytes转Kbits
 * 1 Byte = 8 Bits
 * 1 KB = 1024 Bytes
 * @param bytes
 */
const bytes2Kbits = (bytes = 0) => Math.round(bytes / 1024) * 8;
const getScreenMsg = () => {
  try {
    const { width, height } = window.screen;
    return {
      width,
      height
    };
  } catch (e) {
    return {
      width: 0,
      height: 0
    };
  }
};

//屏幕的宽
const screenWidth = getScreenMsg().width;
/**
 * 生成一个guid
 * @returns {string}
 */
const generateGuId = () => 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
  const random = Math.random() * 16 | 0;
  const v = c === 'x' ? random : (random & 0x3 | 0x8);
  return v.toString(16);
});
$(function () {
  //本地的视频序号 用于生成视频Id
  let localStreamIndex = 0;
  //当前房间ID
  let localRoomId = null;
  //当前房间名称
  let roomName = null;
  //当前用户昵称
  let userName = null;
  //当前用户ID
  let localUserId = null;
  let socket = null;
  //所有的视频
  let videos = [];
  //本地的媒体流
  const localStream = {};
  //所有的PeerConnection对象
  const allPeers = {};
  const roomNameSpan = $('#roomNameSpan');
  //选择房间的弹层
  const inputRoomModal = $('#input_room_modal');
  //loading弹层
  const loaddingModal = $('#loadding_modal');
  //统计的弹层
  const statsModal = $('#stats_modal');
  //提示信息的弹层
  const messageModal = $('#messageModal');
  //显示提示信息的区域
  const messageSpan = $('#messageSpan');
  //发布媒体的按钮
  const publishCameraBtn = $('#publish_camera_btn');
  const unpublishCameraBtn = $('#unpublish_camera_btn');
  //发布桌面
  const publishScreenBtn = $('#publish_screen_btn');
  const unpublishScreenBtn = $('#unpublish_screen_btn');
  //视频区域
  const videoBox = $('#video-box');
  //进入页面先显示输入房间的弹层
  inputRoomModal.modal({show:true,backdrop:'static'});
  //初始化统计图表
  const myChart = echarts.init(document.getElementById('stats_div'));

  /**
   * 显示或隐藏提示信息
   * @param content
   */
  function toggleMessage(content){
    if(content){
      $('#show_text_span').html(content);
      messageModal.modal('show');
    }else{
      messageModal.modal('hide');
    }
  }
  //点击进入房间
  $('#enter_room_btn').on('click',()=>{
    const roomSelect = $('#room_select');
    const userNameInput = $('#user_name_input');
    localRoomId = roomSelect.val();
    roomName = roomSelect.find("option:selected").text();
    userName = userNameInput.val() || '匿名用户';
    inputRoomModal.modal('hide');
    roomNameSpan.html(roomName);
    toggleLoadding(true);
    createConnect();
  });

  //点击发布媒体
  publishCameraBtn.on('click',function () {
    //打开本地摄像头
    createLocalStream(true,true).then(resp => {
      const stream = resp.stream;
      socket.emit('publish',localRoomId,(resp) => {
        const {code, data} = resp;
        if(code === 0){
          const {streamId} = data;
          videos.push({userId:localUserId, hasVideo:true, hasAudio:true, userName,streamId, stream, isLocal:true});
          localStream[streamId] = stream;
          //隐藏发布按钮
          publishCameraBtn.hide();
          unpublishCameraBtn.show();
          unpublishCameraBtn.data('streamid',streamId);
          unpublishCameraBtn[0].disabled = false;
          renderVideoDom();
        }
      })
    });
  });

  //点击发布桌面
  publishScreenBtn.on('click',function () {
    //打开本地摄像头
    createLocalStream(true,false).then(resp => {
      const stream = resp.stream;
      socket.emit('publish',localRoomId,(resp) => {
        const {code, data} = resp;
        if(code === 0){
          const {streamId} = data;
          stream.addEventListener('inactive', () => {
            //发布流离开的信令
            socket.emit('unpublish',{ streamId,roomId:localRoomId },(resp) => {
              removeStream(streamId);
              unpublishScreenBtn.hide();
              publishScreenBtn.show();
            });
          });
          videos.push({userId:localUserId, hasVideo:true, hasAudio:false, userName,streamId, stream, isLocal: true});
          localStream[streamId] = stream;
          //隐藏发布按钮
          publishScreenBtn.hide();
          unpublishScreenBtn.show();
          unpublishScreenBtn.data('streamid',streamId);
          unpublishScreenBtn[0].disabled = false;
          renderVideoDom();
        }
      })
    });
  });

  //点击取消发布按钮
  $('body').on('click','.unpublish_btn',function () {
    const streamId = $(this).data('streamid');
    const stream = localStream[streamId];
    if(stream && stream.stop){
      stream.stop();
    }
    if (stream.getTracks) {
      stream.getTracks().map(track => {
        track.stop();
      });
    }
    //发布流离开的信令
    socket.emit('unpublish',{ streamId,roomId:localRoomId },(resp) => {
      removeStream(streamId);
      const type = $(this).data('type');
      if(type === 'camera'){
        unpublishCameraBtn.hide();
        publishCameraBtn.show();
      }else{
        unpublishScreenBtn.hide();
        publishScreenBtn.show();
      }
    })
  })

  //点击统计按钮
  $('body').on('click','.getstats-btn',function () {
    const $this = $(this)
    const streamId = $this.data('streamid');
    const hasVideo = $this.data('hasvideo');
    const hasAudio = $this.data('hasaudio');
    let peer = null;
    Object.keys(allPeers).map(peerId => {
      const peerObj = allPeers[peerId];
      if(peerObj.streamId === streamId){
        //获取peer
        peer = peerObj.peerConnection;
      }
    });
    myChart.clear();
    //开始获取统计
    if(peer){
      statsModal.modal('show');
      statsStream(hasVideo,hasAudio, myChart, peer);
    }else{
      toggleMessage('还没有其他人与您连接！');
    }
  });

  //显示之后
  statsModal.on('shown.bs.modal',function () {
    myChart.resize();
  })
  //隐藏之后
  statsModal.on('hidden.bs.modal',function () {
    stopStatsStream();
  })

  /**
   * 显示和隐藏loadding
   * @param flag
   */
  function toggleLoadding(flag, content='数据处理中，请稍后！') {
    messageSpan.html(content);
    if(flag){
      loaddingModal.modal({show:true,backdrop:'static'});
    }else{
      loaddingModal.modal('hide');
    }
  }

  /**
   * 移除一条流的显示
   * @param streamId
   */
  function removeStream(streamId) {
    videos = videos.filter(video=> video.streamId !== streamId);
    Object.keys(allPeers).map(peerId => {
      const peerObj = allPeers[peerId];
      if(peerObj.streamId === streamId){
        peerObj.peerConnection.close();
        delete allPeers[peerId];
      }
    });
    renderVideoDom();
  }

  /**
   * 创建信令的连接
   */
  function createConnect() {
    socket = io.connect();
    socket.on('connect', () => {
      console.log('连接成功');
      /**
       * 加入房间
       */
      socket.emit('joinRoom', {roomId:localRoomId, userName}, resp =>{
        console.log('加入房间成功', resp);
        const {code , data} = resp;
        if(code === 0){
          const {userId, users} = data;
          publishCameraBtn[0].disabled = false;
          publishScreenBtn[0].disabled = false;
          localUserId = userId;
          //订阅房间内的所有流
          Object.keys(users).map(userId => {
            const user = users[userId];
            user.streams.map(streamId => {
              const {userId, userName} = user;
              subscribleStream({userId,userName,streamId});
            })
          })
          toggleLoadding(false);
          renderVideoDom();
        }else{
          toggleLoadding(true,'进入房间失败，请稍后刷新页面重试！');
        }
      });

      /**
       * 有用户加入房间
       */
      socket.on('userJoin',data => {
        console.log('有用户加入',data);
      });

      /**
       * 有用户离开房间
       */
      socket.on('userLeave', data => {
        console.log('有用户离开',data);
        const {userId} = data;
        //清除已离开用户的数据
        videos = videos.filter(video => video.userId !== userId);
        Object.keys(allPeers).map(peerId => {
          const peerObj = allPeers[peerId];
          if(peerObj.userId === userId){
            delete allPeers[peerId];
          }
        });
        //重新渲染页面
        renderVideoDom();
      });

      /**
       * 有流加入
       */
      socket.on('streamAdd', data => {
        subscribleStream(data);
        console.log('有流加入',data);
      });

      /**
       * 接收offer
       */
      socket.on('receiveOffer', data => {
        const { userId, peerId, sessionDesc, streamId } = data;
        createAnswerRTCPeerConnection(peerId, userId, streamId, sessionDesc);
        //接收到offer
        console.log('接收offer',data);
      });

      /**
       * 接收offer
       */
      socket.on('receiveAnswer', data => {
        const {userId, peerId, streamId, sessionDesc} = data;
        const peerObj = allPeers[peerId];
        const peer = peerObj.peerConnection;
        peer.setRemoteDescription(new RTCSessionDescription(sessionDesc)).then(resp => {
          peerObj.candidate.map((candidate) => {
            socket.emit('candidate',{peerId, userId, candidate:candidate.candidate}, resp => {
              // console.log('candidate信令发送完成', resp);
            })
          })
        })
      });
      /**
       * 接收Candidate
       */
      socket.on('receiveCandidate',data => {
        const {peerId, candidate} = data;
        const peerObj = allPeers[peerId];
        peerObj.peerConnection.addIceCandidate(candidate);
      });

      socket.on('streamRemove',data => {
        console.log('有流离开',data);
        const { streamId } = data;
        removeStream(streamId);
      })
    });

    socket.on('disconnect', function(){
      console.log('连接断开');
    });
  }

  //打开本地的媒体流
  function createLocalStream(video=true , audio=true) {
    //视频的参数
    const constraints = {
      width: { ideal: 640, max: 1280 },
      aspectRatio: { ideal: 1.777777778 },
      frameRate: { max: 25, ideal: 20, min: 15 }
    };

    //摄像头
    if (audio) {
      return navigator.mediaDevices.getUserMedia({ video, audio }).then(stream => {
        const videoTracks = stream.getVideoTracks();
        videoTracks.map(track => {
          track.applyConstraints(constraints);
        });
        const audioConstraints = {
          echoCancellation: true, //echoCancellation：是否使用回声消除来尝试去除通过麦克风回传到扬声器的音频
          noiseSuppression: true, //noiseSuppression：是否尝试去除音频信号中的背景噪声
          autoGainControl: true //autoGainControl：是否要修改麦克风的输入音量
        };
        const audioTracks = stream.getAudioTracks();
        audioTracks.map(track => {
          track.applyConstraints(audioConstraints);
        });
        return Promise.resolve({stream});
      }).catch(ex => {
        switch (ex.name) {
          case 'NotReadableError':
            ex.msg = '请查看媒体设备是否正常，或者已被占用';
            break;
          case 'NotFoundError':
            ex.msg = '没有找到可用的媒体设备';
            break;
          case 'NotAllowedError':
            ex.msg = '您已禁止当前网页使用媒体设备';
            break;
          default:
            ex.msg = ex.message;
        }
        return Promise.reject(ex);
      });
    }else{
      let getDisplayMedia = null;
      //桌面
      if(!navigator.getDisplayMedia && !navigator.mediaDevices.getDisplayMedia){
        return Promise.reject(new Error('您的浏览器不支持桌面分享'));
      }
      if (navigator.getDisplayMedia) {
        getDisplayMedia = navigator.getDisplayMedia.bind(navigator);
      } else if (navigator.mediaDevices.getDisplayMedia) {
        getDisplayMedia = navigator.mediaDevices.getDisplayMedia.bind(navigator.mediaDevices);
      }
      return getDisplayMedia({ video: true }).then(stream => {
        const videoTracks = stream.getVideoTracks();
        constraints.width = { ideal: screenWidth || 1920 };
        constraints.frameRate = {max: 20, ideal: 15, min: 10};
        videoTracks.map(track => {
          track.applyConstraints(constraints);
        });
        return Promise.resolve({stream});
      });
    }
  }

  /**
   * 订阅视频流
   * @param userId
   * @param userName
   * @param streamId
   */
  function subscribleStream(data) {
    const {userId, userName, streamId} = data;
    createOfferRTCPeerConnection(userId, userName, streamId);
  }

  /**
   * 给peer添加自定义的统计方法
   * @param pc
   */
  function addPerrStatsMethod(pc) {
    pc.getMyStats = () => pc.getStats(null).then(stats => {
      const myStatArray = [];
      //流的类型 1:上行流 2:下行流
      const type = pc.isLocal ? 1 : 2;
      stats.forEach(report => {
        const myStat = {
          type,
          timestamp: report.timestamp,
          //媒体类型 audio:音频  video:视频
          kind: report.kind || report.mediaType
        };
        //推流
        if (report.type === 'outbound-rtp' && type === 1) {
          //发送的数据
          //发送字节数 码率
          myStat.bytesSent = bytes2Kbits(report.bytesSent);
          //已发送的包数
          myStat.packetsSent = report.packetsSent;
          //视频帧数
          if (report.kind === 'video') {
            myStat.frames = report.framesEncoded;
            myStat.qpSum = report.qpSum;
          }
          myStatArray.push(myStat);
        } else if (report.type === 'inbound-rtp' && type === 2) {
          //接收字节数  码率
          myStat.bytesReceived = bytes2Kbits(report.bytesReceived);
          //丢包数
          myStat.packetsLost = report.packetsLost;
          //已接收的包数
          myStat.packetsReceived = report.packetsReceived;
          //视频帧数
          if (report.kind === 'video') {
            myStat.frames = report.framesDecoded;
            myStat.qpSum = report.qpSum;
          }
          //数据包的发送次数
          myStatArray.push(myStat);
        }
      });
      return Promise.resolve(myStatArray);
    });
  }
  /**
   * 创建一个OfferRTCPeerConnection
   */
  function createOfferRTCPeerConnection(userId, userName, streamId) {
    const pc = new RTCPeerConnection(iceServer);
    const peerId = generateGuId();
    const pcObj = {
      userId,
      id : peerId,
      streamId,
      peerConnection: pc,
      candidate:[]
    }

    allPeers[peerId] = pcObj;
    addPerrStatsMethod(pc);
    //收集candidate
    pc.onicecandidate = evt => {
      const { candidate } = evt;
      if (!candidate) {
        return;
      }
      pcObj.candidate.push({peerId,candidate});
    }

    //连接状态发生变化
    pc.onconnectionstatechange = evt => {
      const { connectionState } = evt.target;
      //连接断开
      if (connectionState === 'disconnected'){
        pc.close();
        delete allPeers[peerId];
      }
    }

    //当有流加入时
    pc.onaddstream = evt =>{
      const stream = evt.stream;
      const hasVideo = stream.getVideoTracks().length > 0;
      const hasAudio = stream.getAudioTracks().length > 0;
      videos.push({userId, userName, hasVideo, hasAudio, streamId, stream});
      renderVideoDom();
    };

    //创建OFFER
    pc.createOffer({offerToReceiveAudio: true, offerToReceiveVideo: true}).then(resp => {
      pc.setLocalDescription(resp);
      // //发一个offer的信令 给指定的用户
      socket.emit('offer',{peerId, userId, streamId, sessionDesc:resp}, resp => {
        console.log('offer发送完成', resp);
      })
    });
  }

  function createAnswerRTCPeerConnection(peerId, userId, streamId, sessionDesc) {
    const pc = new RTCPeerConnection(iceServer);
    const pcObj = {
      userId,
      id : peerId,
      streamId,
      peerConnection: pc
    }
    allPeers[peerId] = pcObj;
    addPerrStatsMethod(pc);
    //收集candidate
    pc.onicecandidate = evt => {
      const { candidate } = evt;
      if (!candidate) {
        return;
      }
      socket.emit('candidate',{peerId, userId, candidate}, resp => {
        console.log('candidate信令发送完成', resp);
      });
    }
    //本地视频
    pc.isLocal = true;
    //添加本地流到pc
    const stream = localStream[streamId];
    if(stream){
      pc.addStream(stream);
    }

    //连接状态发生变化
    pc.onconnectionstatechange = evt => {
      const { connectionState } = evt.target;
      //连接断开
      if (connectionState === 'disconnected'){
        pc.close();
        delete allPeers[peerId];
      }
    }
    pc.setRemoteDescription(new RTCSessionDescription(sessionDesc)).then(resp => {
      pc.createAnswer().then(resp => {
        pc.setLocalDescription(resp);
        // //发一个offer的信令 给指定的用户
        socket.emit('anwser',{peerId, userId, streamId, sessionDesc:resp}, resp => {
         // console.log('offer发送完成', resp);
        });
      });
    });
  }
  //渲染视频列表
  function renderVideoDom() {
    //把所有的视频暂停掉
    const videoDoms = $('video',videoBox);
    for(let i=0,len=videoDoms.length; i<len; i++){
      videoDoms[i].pause();
    };
    videoBox.empty();
    if(videos.length === 0){
      const videoDom = `<div class="card empty-card">
                          <h5 class="card-header">暂无视频</h5>
                          <div class="card-body">
                            暂无视频
                          </div>
                        </div>`;
      videoBox.html(videoDom);
    }else{
      const videoBoxDom = videoBox[0];
      videos.map(video=>{
        const {hasVideo, hasAudio, stream} = video;
        const videoDom = document.createElement('video');
        videoDom.className = 'preview-video';
        videoDom.srcObject = stream;
        videoDom.autoplay = true;
        videoDom.controls = true;
        //本地视频静音
        if(video.isLocal){
          videoDom.muted = true;
        }

        const preImg = document.createElement('img');
        preImg.src = '/images/empty.png';
        preImg.className = 'preview-img';
        const cardBody = document.createElement('div');
        cardBody.className = 'card-body';
        cardBody.appendChild(preImg);
        cardBody.appendChild(videoDom);
        const cardHeadDom = document.createElement('h5');
        cardHeadDom.innerHTML = video.userName;
        cardHeadDom.className = 'card-header clearfix';
        const statBtnDom = document.createElement('button');
        statBtnDom.className = 'btn btn-outline-info btn-sm float-right getstats-btn';
        statBtnDom.type = 'button';
        statBtnDom.innerHTML = '流状态';
        statBtnDom.setAttribute('data-streamid', video.streamId);
        if(hasVideo){
          statBtnDom.setAttribute('data-hasvideo', hasVideo);
        }
        if(hasAudio){
          statBtnDom.setAttribute('data-hasaudio', hasAudio);
        }
        cardHeadDom.appendChild(statBtnDom);
        const cardBox = document.createElement('div');
        cardBox.className = 'card preview-video-card';
        cardBox.appendChild(cardHeadDom);
        cardBox.appendChild(cardBody);
        videoBoxDom.appendChild(cardBox);
      });
    }
  }
});
