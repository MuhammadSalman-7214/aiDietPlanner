const User = require('./user.model');

const createUser = async (data) => User.create(data);
const findByEmail = async (email) => User.findOne({ email });
const findById = async (id) => User.findById(id).select('-passwordHash');
const updateUser = async (id, data) => User.findByIdAndUpdate(id, data, { new: true }).select('-passwordHash');

module.exports = { createUser, findByEmail, findById, updateUser };
