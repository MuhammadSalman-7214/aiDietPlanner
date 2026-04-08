const consultationRepo = require('./consultation.repository');

const requestConsultation = async (userId, payload) =>
  consultationRepo.createRequest(userId, payload);

const listMyConsultations = async (userId) => consultationRepo.listByUser(userId);

module.exports = { requestConsultation, listMyConsultations };
