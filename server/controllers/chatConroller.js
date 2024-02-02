// controllers/chatController.js

const chatModel = require('../models/chatModel');

// Controller logic for chat-related actions
const chatController = {
  getChatMessages: () => {
    // Fetch chat messages from the model
    return chatModel.getChatMessages();
  },
  // Other chat-related controller functions...
};

module.exports = chatController;
