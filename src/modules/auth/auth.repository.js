const User = require('../user/user.model');

const findByEmail = async (email) => User.findOne({ email });
const createUser = async (data) => User.create(data);

module.exports = { findByEmail, createUser };
