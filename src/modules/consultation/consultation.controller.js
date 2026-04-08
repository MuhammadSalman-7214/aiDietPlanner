const consultationService = require('./consultation.service');

const requestConsultation = async (req, res, next) => {
  try {
    const result = await consultationService.requestConsultation(req.user.id, req.body);
    res.status(201).json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

const listMyConsultations = async (req, res, next) => {
  try {
    const result = await consultationService.listMyConsultations(req.user.id);
    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
};

module.exports = { requestConsultation, listMyConsultations };
