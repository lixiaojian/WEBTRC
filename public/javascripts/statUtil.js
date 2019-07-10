/**
 * @ignore  ==============================================================
 * @fileoverview 统计音视频的数据
 * @author  xiaojianli(872458899@qq.com)
 * @version 1.0.0
 * @date  2019/6/15
 * @ignore  ==============================================================
 */
/**
 * 图表的默认参数
 * @type {{yAxis: {type: string}, xAxis: {minInterval: number, maxInterval: number, type: string}, color: string[], grid: {top: number, left: number, bottom: number, right: number, containLabel: boolean}, series: Array, tooltip: {formatter: (function(*): *), trigger: string, hideDelay: number}, dataZoom: *[], title: {show: boolean}}}
 */
(function () {
  const padLeft = (str, length = 2, pre = '0') => (Array(length).join(pre) + str).slice(-length);
  //统计的定时器
  let getStatTimmer = null;
  const statOptions = {
    title: {
      show: false
    },
    color: ['#178fcf', '#1cb2d8', '#00CC00', '#FF0000', '#88b0bb', '#749f83', '#ca8622', '#bda29a', '#6e7074', '#546570', '#c4ccd3'],
    tooltip: {
      trigger: 'axis',
      hideDelay: 1500,
      formatter: items => {
        const [, time] = items[0].value[0].split(' ');
        let str = time;
        items.map(item => {
          str = `${str}<br /> ${item.marker} ${item.seriesName} : ${item.value[1]}`;
        });
        return str;
      }
    },
    grid: {
      top: 50,
      left: 10,
      right: 50,
      bottom: 40,
      containLabel: true
    },
    xAxis: {
      type: 'time',
      maxInterval: 60 * 1000,
      minInterval: 5 * 1000
    },
    yAxis: {
      type: 'value'
    },
    dataZoom: [{
      type: 'slider',
      xAxisIndex: 0,
      filterMode: 'empty'
    }, {
      type: 'slider',
      yAxisIndex: 0,
      filterMode: 'empty'
    }],
    series: []
  };

  /**
   * 统计视频的数据
   * @param sta
   * @param statsObj
   * @param dateTime
   * @param tempObj
   */
  const statVideo = (sta, statsObj, dateTime, tempObj) => {
    const { videoBitsData, videoPackageLostData, videoFramsData, videoQPData } = statsObj;
    //视频码率
    let videoBitsPreSecond = 0;
    //视频丢包数
    let videoPacketsLost = 0;
    //视频的帧率
    let videoframes = 0;
    let videoQP = 0;

    let newbytesData = 0;
    //推流
    if (sta.type === 1) {
      newbytesData = sta.bytesSent;
    } else {
      //拉流
      newbytesData = sta.bytesReceived;
      videoPacketsLost = sta.packetsLost;
    }
    //码率
    videoBitsPreSecond = newbytesData - tempObj.videoBitsPreSecondTemp;
    tempObj.videoBitsPreSecondTemp = newbytesData;
    //帧率
    videoframes = sta.frames - tempObj.videoframesTemp;
    tempObj.videoframesTemp = sta.frames;
    //量化参数QP
    videoQP = sta.qpSum - tempObj.videoQPTemp;
    tempObj.videoQPTemp = sta.qpSum;

    videoBitsData.data.push({ name: dateTime, value: [dateTime, videoBitsPreSecond] });
    videoPackageLostData.data.push({ name: dateTime, value: [dateTime, videoPacketsLost] });
    videoFramsData.data.push({ name: dateTime, value: [dateTime, videoframes] });
    videoQPData.data.push({ name: dateTime, value: [dateTime, videoQP] });
  };

  /**
   * 统计音频的数据
   * @param sta
   * @param statsObj
   * @param dateTime
   * @param tempObj
   */
  const statAudio = (sta, statsObj, dateTime, tempObj) => {
    const { audioBitsData, audioPackageLostData } = statsObj;
    let audioBitsPreSecond = 0;
    let audioPacketsLost = 0;
    if (sta.type === 1) {
      audioBitsPreSecond = sta.bytesSent - tempObj.audioBitsPreSecondTemp;
      tempObj.audioBitsPreSecondTemp = sta.bytesSent;
    } else {
      audioBitsPreSecond = sta.bytesReceived - tempObj.audioBitsPreSecondTemp;
      tempObj.audioBitsPreSecondTemp = sta.bytesReceived;
      audioPacketsLost = sta.packetsLost;
    }
    audioBitsData.data.push({ name: dateTime, value: [dateTime, audioBitsPreSecond] });
    audioPackageLostData.data.push({ name: dateTime, value: [dateTime, audioPacketsLost] });
  };

  /**
   * 删除对象数组中的第一个元素
   * @param statsObj
   */
  const shiftSrrsys = (statsObj) => {
    Object.keys(statsObj).map(key => {
      const stat = statsObj[key];
      if (stat.data.length > 0) {
        stat.data.shift();
      }
    });
  };

  /**
   * 获取统计的最终数据
   * @param statsObj
   * @param hasVideo
   * @param hasAudio
   */
  const getOptions = (statsObj, hasVideo, hasAudio) => {
    const { videoBitsData, videoPackageLostData, videoFramsData, videoQPData, audioBitsData, audioPackageLostData } = statsObj;
    const data = [];
    const legend = {
      data: [],
      top: 5
    };
    if (hasVideo) {
      data.push(videoBitsData);
      legend.data.push('视频码率');
      data.push(videoPackageLostData);
      legend.data.push('视频丢包数');
      data.push(videoFramsData);
      legend.data.push('视频的帧率');
      data.push(videoQPData);
      legend.data.push('量化参数QP');
    }

    if (hasAudio) {
      data.push(audioBitsData);
      legend.data.push('音频码率');
      data.push(audioPackageLostData);
      legend.data.push('音频丢包数');
    }
    return {
      legend,
      series: data
    };
  };
  /**
   * 统计流的状态
   * @param video 视频信息
   * @param peerConnection
   */
  const statsStream = (hasVideo,hasAudio, myChart, peerConnection) => {
    myChart.setOption(statOptions);
    //显示的统计数据
    const statsObj = {
      //视频的码率数据
      videoBitsData: { name: '视频码率', type: 'line', showSymbol: false, smooth: true, data: [] },
      //视频的丢包数
      videoPackageLostData: { name: '视频丢包数', type: 'line', showSymbol: false, smooth: true, data: [] },
      //视频的帧率
      videoFramsData: { name: '视频的帧率', type: 'line', showSymbol: false, smooth: true, data: [] },
      //量化参数QP
      videoQPData: { name: '量化参数QP', type: 'line', showSymbol: false, smooth: true, data: [] },
      //音频码率
      audioBitsData: { name: '音频码率', type: 'line', showSymbol: false, smooth: true, data: [] },
      //音频丢包数
      audioPackageLostData: { name: '音频丢包数', type: 'line', showSymbol: false, smooth: true, data: [] }
    };
    const { videoBitsData, audioBitsData } = statsObj;

    //记录所有数据的前一次数据
    const tempObj = {
      //记录所有数据的前一次数据
      videoBitsPreSecondTemp: 0,
      audioBitsPreSecondTemp: 0,
      videoframesTemp: 0,
      videoQPTemp: 0
    };

    //统计时去掉第一个数据
    let subFirstNumber = false;

    clearInterval(getStatTimmer);
    //每秒获取一次流数据
    getStatTimmer = setInterval(() => {

      peerConnection.getMyStats().then(resp => {
        resp.map(sta => {
          //时间
          const date = new Date(sta.timestamp);
          const dateTime = date.getFullYear()+'-'+padLeft(date.getMonth()+1)+'-'+padLeft(date.getDate())+' '+padLeft(date.getHours())+':'+padLeft(date.getMinutes())+':'+padLeft(date.getSeconds());
          //数据长度
          let dataLength = 0;
          if (hasVideo) {
            dataLength = statsObj.videoFramsData.data.length;
          } else {
            dataLength = statsObj.audioBitsData.data.length;
          }
          //最多只保存10分钟的数据
          if (dataLength > 600) {
            shiftSrrsys(statsObj);
            dataLength = 600;
          }
          if (sta.kind === 'video') {
            statVideo(sta, statsObj, dateTime, tempObj);
          } else {
            statAudio(sta, statsObj, dateTime, tempObj);
          }
        });
      });

      //去掉统计里的第一个数据
      if (!subFirstNumber && ((hasVideo && videoBitsData.data.length > 0) || hasAudio && audioBitsData.data.length > 0)) {
        shiftSrrsys(statsObj);
        subFirstNumber = true;
      }

      const options = getOptions(statsObj, hasVideo, hasAudio);
      if (options.series[0].data.length > 0) {
        myChart.setOption(options);
      }
    }, 1005);
  };
  window.statsStream = statsStream;
  //取消统计
  window.stopStatsStream = () => {
    clearInterval(getStatTimmer);
  };
}());
