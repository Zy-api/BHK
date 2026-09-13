// 视频代理 - 解决视频CORS问题，支持流式转发
const https = require('https');
const http = require('http');
const url = require('url');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

function proxyVideo(videoUrl, req, res) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = url.parse(videoUrl);
      const proto = parsed.protocol === 'https:' ? https : http;
      
      // 转发请求头
      const headers = {
        'User-Agent': UA,
        'Accept': '*/*',
        'Range': req.headers['range'] || '',
        'Referer': 'https://www.xcyycn.tv/',
      };

      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.path,
        method: 'GET',
        headers: headers
      };

      const proxyReq = proto.request(options, (proxyRes) => {
        // 设置响应头
        res.statusCode = proxyRes.statusCode;
        if (proxyRes.headers['content-type']) {
          res.setHeader('Content-Type', proxyRes.headers['content-type']);
        }
        if (proxyRes.headers['content-length']) {
          res.setHeader('Content-Length', proxyRes.headers['content-length']);
        }
        if (proxyRes.headers['content-range']) {
          res.setHeader('Content-Range', proxyRes.headers['content-range']);
        }
        if (proxyRes.headers['accept-ranges']) {
          res.setHeader('Accept-Ranges', proxyRes.headers['accept-ranges']);
        }
        res.setHeader('Cache-Control', 'public, max-age=3600');
        
        // 流式转发
        proxyRes.pipe(res);
        
        proxyRes.on('end', () => resolve());
        proxyRes.on('error', reject);
      });

      proxyReq.on('error', reject);
      proxyReq.setTimeout(30000, () => { 
        proxyReq.destroy(); 
        reject(new Error('timeout')); 
      });
      
      req.pipe(proxyReq);
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Range');
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length, Content-Range');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const query = req.query || {};
    let videoUrl = query.url || '';

    if (!videoUrl) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Missing URL parameter');
      return;
    }

    // 解码URL
    videoUrl = decodeURIComponent(videoUrl);

    // 验证URL
    if (!videoUrl.startsWith('http://') && !videoUrl.startsWith('https://')) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Invalid URL');
      return;
    }

    await proxyVideo(videoUrl, req, res);
  } catch (e) {
    console.error('Video proxy error:', e);
    if (!res.headersSent) {
      res.statusCode = 500;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Video proxy error: ' + e.message);
    }
  }
};
