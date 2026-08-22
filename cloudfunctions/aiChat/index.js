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
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    return { ok: false, error: '未配置 DEEPSEEK_API_KEY 环境变量' };
  }

  const messages = event.messages || [];
  const context = event.context || '';

  const systemPrompt = '你是「Lux私教笔记」里的 AI 教练助手，用中文、简短、口语化地回答用户关于健身、饮食、训练的问题。不要长篇大论，一次给一个清晰有用的建议。' +
    (context ? '\n\n当前用户的数据：\n' + context : '');

  const fullMessages = [{ role: 'system', content: systemPrompt }].concat(messages.slice(-10));

  try {
    const result = await postJson(
      'https://api.deepseek.com/chat/completions',
      { Authorization: 'Bearer ' + apiKey },
      { model: 'deepseek-chat', messages: fullMessages, temperature: 0.7, max_tokens: 1000 }
    );

    if (result.status !== 200 || !result.json || !result.json.choices) {
      return { ok: false, error: 'DeepSeek 调用失败', detail: result.text };
    }

    const reply = result.json.choices[0].message.content;
    return { ok: true, reply: reply };
  } catch (e) {
    return { ok: false, error: String((e && e.message) || e) };
  }
};
