const chatbotService = require('./chatbot.service');

const chat = async (req, res, next) => {
  try {
    const result = await chatbotService.chat({
      message: req.body.message,
      userId: req.user?.id,
      isPremium: Boolean(req.user?.isPremium),
    });

    if (result.intent === 'rate_limited') {
      return res.status(429).json({ success: false, message: result.response.message, details: result.response });
    }
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { chat };
