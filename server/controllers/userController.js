// src/controllers/userController.js

const User = require('../models/userModel');

const userController = {
  getUserById: (userID) => {
    // Instantiate the User class and call the getUserById method
    const userModel = new User();
    return userModel.getUserById(userID);
  },
  // Other user-related controller functions...
};

module.exports = userController;
