const express = require('express');
const Joi = require('joi');
const jwt = require('jsonwebtoken');
const chatbotController = require('./chatbot.controller');
const { validateRequest } = require('../../middlewares/validation.middleware');

const router = express.Router();

const messageSchema = Joi.object({
  message: Joi.string().min(3).max(500).required(),
});

const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;
  if (authHeader && authHeader.startsWith('Bearer ')) {
    const token = authHeader.split(' ')[1];
    try {
      req.user = jwt.verify(token, process.env.JWT_SECRET);
    } catch (err) {
      // ignore invalid token for chat
    }
  }
  next();
};

router.post('/chat', optionalAuth, validateRequest(messageSchema), chatbotController.chat);

module.exports = router;
