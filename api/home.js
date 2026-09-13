// 首页推荐接口 - 获取热门国漫推荐
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

function parseAnimeList(html) {
  const results = [];
  // 匹配动漫列表项
  const itemPattern = /<div class="public-list-box[^"]*">[\s\S]*?<a[^>]*href="\/d-(\d+)\.html"[^>]*title="([^"]*)"[\s\S]*?data-src="([^"]*)"[\s\S]*?<span class="public-list-prb[^"]*">([^<]*)<\/span>/g;
  let match;
  while ((match = itemPattern.exec(html)) !== null) {
    const id = match[1];
    const name = match[2].trim();
    const cover = match[3];
    const status = match[4].trim();
    if (id && name && cover && !results.find(r => r.id === id)) {
      results.push({
        id: id,
        name: name,
        cover: cover,
        status: status,
        source: 'xcyycn'
      });
    }
  }
  // 备用匹配
  if (results.length === 0) {
    const altPattern = /<a[^>]*href="\/d-(\d+)\.html"[^>]*title="([^"]*)"[\s\S]*?<img[^>]*data-src="([^"]*)"[\s\S]*?<\/a>/g;
    while ((match = altPattern.exec(html)) !== null) {
      const id = match[1];
      const name = match[2].trim();
      const cover = match[3];
      if (id && name && cover && !results.find(r => r.id === id)) {
        results.push({
          id: id,
          name: name,
          cover: cover,
          status: '',
          source: 'xcyycn'
        });
      }
    }
  }
  return results;
}

function parseBanner(html) {
  const banners = [];
  // 匹配轮播图
  const bannerPattern = /<div[^>]*class="[^"]*swiper-slide[^"]*"[^>]*>[\s\S]*?<a[^>]*href="\/d-(\d+)\.html"[^>]*>[\s\S]*?data-src="([^"]*)"[\s\S]*?title="([^"]*)"/g;
  let match;
  while ((match = bannerPattern.exec(html)) !== null) {
    banners.push({
      id: match[1],
      cover: match[2],
      title: match[3].trim()
    });
  }
  return banners;
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
    const type = query.type || 'home';
    const page = parseInt(query.page) || 1;

    let html = '';
    let banners = [];
    let animeList = [];

    if (type === 'home') {
      // 首页数据 - 抓取首页
      html = await fetchHtml(BASE_URL + '/');
      banners = parseBanner(html);
      animeList = parseAnimeList(html);
    } else if (type === 'guoman' || type === '4') {
      // 国漫分类 - 国产动漫分类页
      const categoryUrl = `${BASE_URL}/v/4-${page}.html`;
      html = await fetchHtml(categoryUrl);
      animeList = parseAnimeList(html);
    } else {
      // 其他分类
      const categoryUrl = `${BASE_URL}/v/${type}-${page}.html`;
      html = await fetchHtml(categoryUrl);
      animeList = parseAnimeList(html);
    }

    // 如果首页列表不够，补充国漫分类的数据
    if (type === 'home' && animeList.length < 10) {
      try {
        const guomanHtml = await fetchHtml(BASE_URL + '/v/4.html');
        const guomanList = parseAnimeList(guomanHtml);
        guomanList.forEach(item => {
          if (!animeList.find(a => a.id === item.id)) {
            animeList.push(item);
          }
        });
      } catch (e) {}
    }

    res.statusCode = 200;
    res.end(JSON.stringify({
      code: 200,
      msg: 'success',
      data: {
        banners: banners.slice(0, 5),
        list: animeList.slice(0, 50),
        total: animeList.length,
        page: page
      }
    }));
  } catch (e) {
    console.error('Home error:', e);
    res.statusCode = 500;
    res.end(JSON.stringify({ code: 500, msg: '获取数据失败: ' + e.message, data: { banners: [], list: [] } }));
  }
};
