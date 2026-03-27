const chatbotService = require('./chatbot.service');

const chat = async (req, res, next) => {
  try {
    const result = await chatbotService.chat({
      message: req.body.message,
      userId: req.user?.id,
    });

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { chat };
