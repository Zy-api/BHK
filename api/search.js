// 搜索接口 - 搜索国漫
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
      // 使用代理
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
      // 直连
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

function parseSearchResults(html) {
  const results = [];
  const seen = new Set();

  // 模式1: 搜索结果列表 - thumb-txt格式
  const thumbPattern = /<a[^>]*href="\/d-(\d+)\.html"[^>]*>[\s\S]*?data-src="([^"]+)"[\s\S]*?<div class="thumb-txt[^"]*">([^<]+)<\/div>/g;
  let match;
  while ((match = thumbPattern.exec(html)) !== null) {
    const id = match[1];
    const cover = match[2];
    const name = match[3].trim();
    if (id && name && !seen.has(id)) {
      seen.add(id);
      results.push({ id, name, cover, status: '', source: 'xcyycn' });
    }
  }

  // 模式2: 图片卡片格式
  if (results.length === 0) {
    const cardPattern = /<a[^>]*href="\/d-(\d+)\.html"[^>]*title="([^"]*)"[\s\S]*?data-src="([^"]+)"[\s\S]*?<span class="public-list-prb[^"]*">([^<]*)<\/span>/g;
    while ((match = cardPattern.exec(html)) !== null) {
      const id = match[1];
      const name = match[2].trim();
      const cover = match[3];
      const status = match[4].trim();
      if (id && name && !seen.has(id)) {
        seen.add(id);
        results.push({ id, name, cover, status, source: 'xcyycn' });
      }
    }
  }

  // 模式3: 通用 - 从vod-link中提取
  if (results.length === 0) {
    const vodPattern = /<a[^>]*href="\/d-(\d+)\.html"[^>]*class="vod-link[^"]*"[\s\S]*?data-src="([^"]+)"[\s\S]*?<span class="vod-title"[^>]*title="([^"]*)"/g;
    while ((match = vodPattern.exec(html)) !== null) {
      const id = match[1];
      const cover = match[2];
      const name = match[3].trim();
      if (id && name && !seen.has(id)) {
        seen.add(id);
        results.push({ id, name, cover, status: '', source: 'xcyycn' });
      }
    }
  }

  // 模式4: 最宽松的匹配
  if (results.length === 0) {
    const loosePattern = /href="\/d-(\d+)\.html"[^>]*>[\s\S]{0,300}?data-src="([^"]+)"[^>]*alt="([^"]*?)封面图"/g;
    while ((match = loosePattern.exec(html)) !== null) {
      const id = match[1];
      const cover = match[2];
      const name = match[3].trim();
      if (id && name && !seen.has(id)) {
        seen.add(id);
        results.push({ id, name, cover, status: '', source: 'xcyycn' });
      }
    }
  }

  return results.slice(0, 30);
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
    const wd = query.wd || query.keyword || '';
    const page = parseInt(query.page) || 1;
    
    if (!wd) {
      res.statusCode = 400;
      res.end(JSON.stringify({ code: 400, msg: '缺少搜索关键词', data: [] }));
      return;
    }

    const searchUrl = `${BASE_URL}/s.html?wd=${encodeURIComponent(wd)}`;
    const html = await fetchHtml(searchUrl);
    const results = parseSearchResults(html);

    res.statusCode = 200;
    res.end(JSON.stringify({
      code: 200,
      msg: 'success',
      data: results,
      total: results.length,
      page: page
    }));
  } catch (e) {
    console.error('Search error:', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ code: 500, msg: '搜索失败: ' + e.message, data: [] }));
  }
};
