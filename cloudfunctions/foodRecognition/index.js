const https = require('https');

function postJson(url, headers, body) {
  return new Promise(function (resolve, reject) {
    const payload = JSON.stringify(body);
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: 'POST',
      headers: Object.assign({
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(payload)
      }, headers)
    };
    const req = https.request(options, function (res) {
      let chunks = '';
      res.setEncoding('utf8');
      res.on('data', function (c) { chunks += c; });
      res.on('end', function () {
        let json = null;
        try { json = JSON.parse(chunks); } catch (e) { json = null; }
        resolve({ status: res.statusCode, json: json, text: chunks });
      });
    });
    req.on('error', reject);
    req.write(payload);
    req.end();
  });
}

exports.main = async function (event) {
  const apiKey = process.env.HUNYUAN_API_KEY;
  if (!apiKey) {
    return { ok: false, error: '未配置 HUNYUAN_API_KEY 环境变量' };
  }

  const imageBase64 = event.imageBase64;
  if (!imageBase64) {
    return { ok: false, error: '缺少图片数据' };
  }

  const prompt = '识别图片中的食物，估算营养成分。只返回一个 JSON 对象，不要任何多余文字，格式：{"name":"食物名称","protein":蛋白质克数,"calories":卡路里数}。如果识别不出食物，name 填「无法识别」。';

  const dataUrl = imageBase64.indexOf('data:') === 0
    ? imageBase64
    : 'data:image/jpeg;base64,' + imageBase64;

  try {
    const result = await postJson(
      'https://api.hunyuan.cloud.tencent.com/v1/chat/completions',
      { Authorization: 'Bearer ' + apiKey },
      {
        model: 'hunyuan-vision',
        messages: [
          {
            role: 'user',
            content: [
              { type: 'text', text: prompt },
              { type: 'image_url', image_url: { url: dataUrl } }
            ]
          }
        ]
      }
    );

    if (result.status !== 200 || !result.json || !result.json.choices) {
      return { ok: false, error: '混元调用失败', detail: result.text };
    }

    const content = (result.json.choices[0].message.content || '').trim();

    let parsed = null;
    const match = content.match(/\{[\s\S]*\}/);
    if (match) {
      try { parsed = JSON.parse(match[0]); } catch (e) { parsed = null; }
    }

    if (!parsed) {
      return { ok: true, name: content.slice(0, 30), protein: 0, calories: 0, raw: content };
    }

    return {
      ok: true,
      name: parsed.name || '无法识别',
      protein: Number(parsed.protein) || 0,
      calories: Number(parsed.calories) || 0
    };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
};
