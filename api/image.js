// 图片代理 - 解决图片CORS和防盗链问题
const https = require('https');
const http = require('http');
const url = require('url');

const UA = 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148';

function fetchImage(imgUrl, referer) {
  return new Promise((resolve, reject) => {
    try {
      const parsed = url.parse(imgUrl);
      const proto = parsed.protocol === 'https:' ? https : http;
      const options = {
        hostname: parsed.hostname,
        port: parsed.port || (parsed.protocol === 'https:' ? 443 : 80),
        path: parsed.path,
        method: 'GET',
        headers: {
          'User-Agent': UA,
          'Accept': 'image/webp,image/apng,image/*,*/*;q=0.8',
          'Referer': referer || 'https://www.xcyycn.tv/',
        }
      };
      const req = proto.request(options, (res) => {
        const chunks = [];
        res.on('data', (chunk) => { chunks.push(chunk); });
        res.on('end', () => {
          resolve({
            buffer: Buffer.concat(chunks),
            contentType: res.headers['content-type'] || 'image/jpeg',
            statusCode: res.statusCode
          });
        });
      });
      req.on('error', reject);
      req.setTimeout(10000, () => { req.destroy(); reject(new Error('timeout')); });
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

module.exports = async (req, res) => {
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Cache-Control', 'public, max-age=86400');
  
  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  try {
    const query = req.query || {};
    let imgUrl = query.url || '';
    const referer = query.referer || '';

    if (!imgUrl) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Missing URL parameter');
      return;
    }

    // 解码URL
    imgUrl = decodeURIComponent(imgUrl);

    // 验证URL
    if (!imgUrl.startsWith('http://') && !imgUrl.startsWith('https://')) {
      res.statusCode = 400;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Invalid URL');
      return;
    }

    const result = await fetchImage(imgUrl, referer);
    
    if (result.statusCode >= 400) {
      res.statusCode = result.statusCode;
      res.setHeader('Content-Type', 'text/plain');
      res.end('Image fetch failed');
      return;
    }

    res.statusCode = 200;
    res.setHeader('Content-Type', result.contentType);
    res.end(result.buffer);
  } catch (e) {
    console.error('Image proxy error:', e);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'text/plain');
    res.end('Image proxy error: ' + e.message);
  }
};
