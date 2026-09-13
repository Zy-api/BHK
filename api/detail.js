// 详情接口 - 获取动漫详情和播放地址
const https = require('https');
const http = require('http');
const url = require('url');

const BASE_URL = 'https://www.xcyycn.tv';
const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

function getProxy() {
  return process.env.HTTPS_PROXY || process.env.HTTP_PROXY || process.env.https_proxy || process.env.http_proxy || '';
}

function fetchHtml(targetUrl) {
  return new Promise((resolve, reject) => {
    const parsed = url.parse(targetUrl);
    const proxy = getProxy();
    
    if (proxy) {
      const proxyUrl = url.parse(proxy);
      const proto = proxyUrl.protocol === 'https:' ? https : http;
      const options = {
        hostname: proxyUrl.hostname,
        port: proxyUrl.port,
        path: targetUrl,
        method: 'GET',
        headers: {
          'Host': parsed.hostname,
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        }
      };
      const req = proto.request(options, (res) => {
        let data = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    } else {
      const proto = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.path,
        method: 'GET',
        headers: {
          'User-Agent': UA,
          'Accept': 'text/html,application/xhtml+xml',
          'Accept-Language': 'zh-CN,zh;q=0.9',
        }
      };
      const req = proto.request(options, (res) => {
        let data = '';
        res.setEncoding('utf-8');
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => resolve(data));
      });
      req.on('error', reject);
      req.setTimeout(20000, () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    }
  });
}

function parseDetail(html, id) {
  const result = {
    id: id,
    name: '',
    cover: '',
    status: '',
    description: '',
    director: '',
    actors: '',
    year: '',
    area: '',
    episodes: 0,
    sources: []
  };

  // 提取标题
  const titleMatch = html.match(/<title>([^<]*)-/);
  if (titleMatch) result.name = titleMatch[1].trim();

  // 提取封面
  const coverMatch = html.match(/data-src="([^"]+)"[^>]*alt="[^"]*封面图/);
  if (coverMatch) result.cover = coverMatch[1];

  // 提取状态
  const statusMatch = html.match(/状态：<\/em><span>([^<]*)<\/span>/);
  if (statusMatch) result.status = statusMatch[1].trim();

  // 提取简介
  const descMatch = html.match(/简介：<\/em>([\s\S]*?)<\/li>/);
  if (descMatch) {
    result.description = descMatch[1].replace(/<[^>]*>/g, '').trim();
  }

  // 提取导演
  const directorMatch = html.match(/导演：<\/em>([\s\S]*?)<\/li>/);
  if (directorMatch) {
    result.director = directorMatch[1].replace(/<[^>]*>/g, '').trim();
  }

  // 提取主演
  const actorsMatch = html.match(/主演：<\/em>([\s\S]*?)<\/li>/);
  if (actorsMatch) {
    result.actors = actorsMatch[1].replace(/<[^>]*>/g, '').trim();
  }

  // 提取年份
  const yearMatch = html.match(/年份：<\/em>([^<]*)</);
  if (yearMatch) result.year = yearMatch[1].trim();

  // 提取地区
  const areaMatch = html.match(/地区：<\/em>([^<]*)</);
  if (areaMatch) result.area = areaMatch[1].trim();

  // 提取所有MP4播放链接并按线路分组
  const videoUrls = [];
  const urlPattern = /href="(https?:\/\/[^"]+\.(?:mp4|m3u8)[^"]*)"[^>]*>([^<]*)<\/a>/g;
  let match;
  while ((match = urlPattern.exec(html)) !== null) {
    const videoUrl = match[1];
    const label = match[2].trim();
    if (videoUrl && label && videoUrl.includes('http')) {
      videoUrls.push({ url: videoUrl, label: label });
    }
  }

  // 按域名分组为不同线路
  const sourceMap = {};
  const sourceNames = ['极速线路', '蓝光线路', '高清线路', '备用线路'];
  
  videoUrls.forEach((item, idx) => {
    try {
      const parsed = new URL(item.url);
      const domain = parsed.hostname;
      if (!sourceMap[domain]) {
        const sourceIdx = Object.keys(sourceMap).length;
        sourceMap[domain] = {
          name: sourceNames[sourceIdx] || `线路${sourceIdx + 1}`,
          domain: domain,
          quality: sourceIdx === 0 ? '1080p' : (sourceIdx === 1 ? '1080p' : '720p'),
          episodes: []
        };
      }
      // 解析集数
      let epNum = 0;
      const epMatch = item.label.match(/第(\d+)集/);
      if (epMatch) {
        epNum = parseInt(epMatch[1]);
      } else {
        const numMatch = item.label.match(/(\d+)/);
        if (numMatch) epNum = parseInt(numMatch[1]);
      }
      if (epNum > 0) {
        sourceMap[domain].episodes.push({
          num: epNum,
          title: item.label,
          url: item.url
        });
      }
    } catch (e) {}
  });

  // 转换为数组并按集数排序
  Object.keys(sourceMap).forEach(domain => {
    const source = sourceMap[domain];
    source.episodes.sort((a, b) => a.num - b.num);
    if (source.episodes.length > result.episodes) {
      result.episodes = source.episodes.length;
    }
    result.sources.push({
      name: source.name,
      quality: source.quality,
      episodes: source.episodes
    });
  });

  // 如果没有找到线路，尝试提取下载链接
  if (result.sources.length === 0) {
    const dlPattern = /href="(https?:\/\/[^"]+\/[^"]+\.(?:mp4|m3u8)[^"]*)"/g;
    const dlUrls = [];
    while ((match = dlPattern.exec(html)) !== null) {
      if (match[1].includes('dow') || match[1].includes('video')) {
        dlUrls.push(match[1]);
      }
    }
    if (dlUrls.length > 0) {
      const episodes = dlUrls.map((url, idx) => {
        const epMatch = url.match(/第(\d+)集/);
        const num = epMatch ? parseInt(epMatch[1]) : idx + 1;
        return { num: num, title: `第${num}集`, url: url };
      }).sort((a, b) => a.num - b.num);
      
      result.episodes = episodes.length;
      result.sources.push({
        name: '高清线路',
        quality: '1080p',
        episodes: episodes
      });
    }
  }

  return result;
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const query = req.query || {};
    const id = query.id || '';
    
    if (!id) {
      res.statusCode = 400;
      res.end(JSON.stringify({ code: 400, msg: '缺少视频ID', data: null }));
      return;
    }

    const detailUrl = `${BASE_URL}/d-${id}.html`;
    const html = await fetchHtml(detailUrl);
    const detail = parseDetail(html, id);

    res.statusCode = 200;
    res.end(JSON.stringify({
      code: 200,
      msg: 'success',
      data: detail
    }));
  } catch (e) {
    console.error('Detail error:', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ code: 500, msg: '获取详情失败: ' + e.message, data: null }));
  }
};
